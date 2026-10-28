#!/usr/bin/env python3
"""
Evaluator for submitted ML models (backend of the event website).

Usage
-----
    python evaluator.py --model submission.joblib \\
                        --features hidden_features.csv \\
                        --labels hidden_labels.csv

Prints exactly ONE line of JSON on stdout and exits with:
    0  success
    1  the submission is at fault (bad / slow / crashing model, invalid predictions)
    2  the evaluator is at fault (missing or malformed organizer files, internal error)

Success:  {"status": "success", "samples_evaluated": N, "rmse": ..., "mse": ..., "mae": ..., "accuracy": ..., "macro_f1": ...}
Failure:  {"status": "error", "error_code": "...", "message": "..."}

Details of failures (tracebacks, paths, worker output) go to STDERR only.
Never forward stderr to participants.

SECURITY MODEL
--------------
A .joblib file is a pickle. Loading it executes arbitrary code chosen by the
participant. This script therefore NEVER loads the model in its own process.
Loading and predicting happen in a separate "worker" process which

  * receives only the model and the hidden FEATURES (never the labels),
  * runs with an empty environment, its own temp dir, no stdin/stdout,
  * is limited in wall-clock time, CPU time, memory, file size and open files,
  * is killed together with all of its children afterwards,
  * hands back predictions as a plain .npy file, loaded here with allow_pickle=False.

The parent computes the metrics.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import warnings
from pathlib import Path
from typing import Optional, Sequence

import numpy as np
import pandas as pd

LOG = logging.getLogger("evaluator")

# ----------------------------------------------------------------------------
# Constants
# ----------------------------------------------------------------------------
EXIT_OK = 0
EXIT_SUBMISSION_ERROR = 1
EXIT_SERVER_ERROR = 2

# Worker exit codes (internal protocol between parent and worker)
W_LOAD_FAILED = 10
W_PREDICT_FAILED = 11
W_BAD_OUTPUT = 12
W_MEMORY = 13

DEFAULT_TIMEOUT_S = 120
DEFAULT_MEMORY_MB = 4096
DEFAULT_MAX_MODEL_MB = 500
MAX_FILE_WRITE_BYTES = 64 * 1024 * 1024
STDERR_TAIL_BYTES = 4096

# Messages that are safe to show to participants. No paths, no internals.
PUBLIC_MESSAGES = {
    "MODEL_FILE_INVALID": "The uploaded model file is missing, empty or too large.",
    "MODEL_LOAD_FAILED": "The model file could not be loaded.",
    "PREDICTION_FAILED": "The model failed while generating predictions.",
    "INVALID_PREDICTIONS": (
        "The model did not return finite numeric predictions for every test row."
    ),
    "TIMEOUT": "Evaluation timed out.",
    "RESOURCE_LIMIT_EXCEEDED": "The model exceeded the allowed memory or CPU limits.",
    "EVALUATION_UNAVAILABLE": (
        "Evaluation is temporarily unavailable. Please contact the organizers."
    ),
}


class EvalError(Exception):
    """An error with a public code. `detail` is logged, never returned."""

    def __init__(self, code: str, detail: str = "", server_fault: bool = False):
        super().__init__(f"{code}: {detail}")
        self.code = code
        self.detail = detail
        self.server_fault = server_fault


# ----------------------------------------------------------------------------
# Organizer-side inputs (trusted)
# ----------------------------------------------------------------------------
def _split_columns(value: Optional[str]) -> list[str]:
    return [c.strip() for c in (value or "").split(",") if c.strip()]


def _server_fault(detail: str) -> EvalError:
    return EvalError("EVALUATION_UNAVAILABLE", detail, server_fault=True)


def load_labels(path: Path, column: Optional[str]) -> np.ndarray:
    """Load the hidden labels as a finite float64 vector."""
    if not path.is_file():
        raise _server_fault(f"labels file not found: {path}")
    try:
        df = pd.read_csv(path)
    except Exception as exc:
        raise _server_fault(f"labels file unreadable: {exc}") from exc

    if column:
        if column not in df.columns:
            raise _server_fault(f"label column {column!r} not in labels file")
        series = df[column]
    elif df.shape[1] == 1:
        series = df.iloc[:, 0]
    elif "sort_bin" in df.columns:
        series = df["sort_bin"]
    elif "correct_prediction" in df.columns:
        series = df["correct_prediction"]
    else:
        raise _server_fault("labels file has several columns; pass --label-column")

    try:
        y = pd.to_numeric(series, errors="raise").to_numpy(dtype=np.float64)
    except Exception as exc:
        raise _server_fault(f"labels are not numeric: {exc}") from exc

    if y.size == 0:
        raise _server_fault("labels file is empty")
    if not np.isfinite(y).all():
        raise _server_fault("labels contain missing or non-finite values")
    return y


def count_feature_rows(path: Path, drop_columns: Sequence[str]) -> int:
    """Check the hidden feature file and return its number of rows."""
    if not path.is_file():
        raise _server_fault(f"features file not found: {path}")
    try:
        df = pd.read_csv(path)
    except Exception as exc:
        raise _server_fault(f"features file unreadable: {exc}") from exc
    if df.empty:
        raise _server_fault("features file has no rows")
    missing = [c for c in drop_columns if c not in df.columns]
    if missing:
        raise _server_fault(f"columns to drop not in features file: {missing}")
    return len(df)


# ----------------------------------------------------------------------------
# Metrics (Regression + Classification)
# ----------------------------------------------------------------------------
def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    """Compute regression (RMSE, MSE, MAE) and classification (Accuracy, F1) metrics."""
    with np.errstate(over="ignore", invalid="ignore"):
        err = y_pred - y_true
        mse = float(np.mean(err * err))
        mae = float(np.mean(np.abs(err)))
    rmse = float(np.sqrt(mse)) if np.isfinite(mse) else float("inf")

    # Classification metrics (round predictions to nearest integer)
    y_pred_cls = np.rint(y_pred).astype(np.int64)
    y_true_cls = np.rint(y_true).astype(np.int64)
    accuracy = float(np.mean(y_pred_cls == y_true_cls))

    # Macro F1, Precision, Recall
    classes = np.unique(np.concatenate([y_true_cls, y_pred_cls]))
    f1s, precs, recs = [], [], []
    for c in classes:
        tp = int(np.sum((y_pred_cls == c) & (y_true_cls == c)))
        fp = int(np.sum((y_pred_cls == c) & (y_true_cls != c)))
        fn = int(np.sum((y_pred_cls != c) & (y_true_cls == c)))
        p = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        r = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        denom = 2 * tp + fp + fn
        f1 = (2 * tp / denom) if denom > 0 else 0.0
        f1s.append(f1)
        precs.append(p)
        recs.append(r)

    macro_f1 = float(np.mean(f1s)) if f1s else 0.0
    macro_precision = float(np.mean(precs)) if precs else 0.0
    macro_recall = float(np.mean(recs)) if recs else 0.0

    metrics = {
        "rmse": round(rmse, 4),
        "mse": round(mse, 4),
        "mae": round(mae, 4),
        "accuracy": round(accuracy, 4),
        "macro_f1": round(macro_f1, 4),
        "precision": round(macro_precision, 4),
        "recall": round(macro_recall, 4),
    }
    if not all(np.isfinite(v) for v in metrics.values()):
        raise EvalError("INVALID_PREDICTIONS", "metrics overflowed to non-finite")
    return metrics


# ----------------------------------------------------------------------------
# Worker (runs the untrusted pickle). Executed as a separate process.
# ----------------------------------------------------------------------------
def _apply_limits(mem_mb: int, cpu_seconds: int) -> None:
    """Hard resource limits for the worker. Soft == hard so they cannot be raised."""
    try:
        import resource
    except ImportError:  # non-POSIX (Windows)
        return

    def cap(which: int, value: int) -> None:
        try:
            resource.setrlimit(which, (value, value))
        except (ValueError, OSError):
            pass

    cap(resource.RLIMIT_CORE, 0)
    cap(resource.RLIMIT_FSIZE, MAX_FILE_WRITE_BYTES)
    cap(resource.RLIMIT_NOFILE, 256)
    if cpu_seconds > 0:
        cap(resource.RLIMIT_CPU, cpu_seconds)
    if mem_mb > 0:
        cap(resource.RLIMIT_AS, mem_mb * 1024 * 1024)


def worker_main(argv: Sequence[str]) -> int:
    parser = argparse.ArgumentParser(prog="evaluator --worker")
    parser.add_argument("--model", required=True)
    parser.add_argument("--features", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--drop-columns", default="")
    parser.add_argument("--mem-mb", type=int, default=0)
    parser.add_argument("--cpu-seconds", type=int, default=0)
    parser.add_argument("--extra-pythonpath", default="")
    args = parser.parse_args(list(argv))

    if args.extra_pythonpath:
        for p in reversed(args.extra_pythonpath.split(os.pathsep)):
            if p and p not in sys.path:
                sys.path.insert(0, p)

    _apply_limits(args.mem_mb, args.cpu_seconds)
    warnings.filterwarnings("ignore")
    if hasattr(os, "umask"):
        try:
            os.umask(0o022)
        except Exception:
            pass

    import traceback

    try:
        import joblib

        model = joblib.load(args.model)  # <- untrusted code may run here
    except MemoryError:
        return W_MEMORY
    except BaseException:
        traceback.print_exc()
        return W_LOAD_FAILED

    try:
        X = pd.read_csv(args.features)
        drop = _split_columns(args.drop_columns)
        if drop:
            X = X.drop(columns=[c for c in drop if c in X.columns])
        raw = model.predict(X)
        preds = np.asarray(raw, dtype=np.float64).reshape(-1)
    except MemoryError:
        return W_MEMORY
    except BaseException:
        traceback.print_exc()
        return W_PREDICT_FAILED

    try:
        np.save(args.out, preds, allow_pickle=False)
    except BaseException:
        traceback.print_exc()
        return W_BAD_OUTPUT
    return 0


# ----------------------------------------------------------------------------
# Parent side: run the worker and collect predictions
# ----------------------------------------------------------------------------
def _kill_group(pid: int) -> None:
    try:
        if os.name == "posix":
            os.killpg(pid, signal.SIGKILL)
        elif os.name == "nt":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(pid)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
    except (ProcessLookupError, PermissionError, OSError, AttributeError):
        pass


def _tail(path: Path, nbytes: int = STDERR_TAIL_BYTES) -> str:
    try:
        with open(path, "rb") as fh:
            fh.seek(0, os.SEEK_END)
            fh.seek(max(0, fh.tell() - nbytes))
            return fh.read().decode("utf-8", "replace")
    except OSError:
        return ""


def run_worker(
    model: Path,
    features: Path,
    drop_columns: Sequence[str],
    n_rows: int,
    timeout_s: int,
    mem_mb: int,
    worker_user: Optional[str],
    worker_group: Optional[str],
    extra_pythonpath: Optional[str] = None,
) -> np.ndarray:
    """Run the untrusted model in a child process and return its predictions."""
    workdir = Path(tempfile.mkdtemp(prefix="eval_"))
    try:
        if hasattr(os, "chmod"):
            try:
                os.chmod(workdir, 0o733 if worker_user or worker_group else 0o700)
            except Exception:
                pass
        out_path = workdir / "preds.npy"
        err_path = workdir / "worker.stderr"

        cmd = [
            sys.executable, "-I", str(Path(__file__).resolve()), "--worker",
            "--model", str(model),
            "--features", str(features),
            "--out", str(out_path),
            "--mem-mb", str(mem_mb),
            "--cpu-seconds", str(timeout_s),
        ]
        if drop_columns:
            cmd += ["--drop-columns", ",".join(drop_columns)]
        if extra_pythonpath:
            cmd += ["--extra-pythonpath", extra_pythonpath]

        env = {
            "HOME": str(workdir),
            "TMPDIR": str(workdir),
            "JOBLIB_TEMP_FOLDER": str(workdir),
            "LANG": "C.UTF-8",
            "PYTHONDONTWRITEBYTECODE": "1",
            "OMP_NUM_THREADS": "1",
            "OPENBLAS_NUM_THREADS": "1",
            "MKL_NUM_THREADS": "1",
            "NUMEXPR_NUM_THREADS": "1",
        }
        if extra_pythonpath:
            env["PYTHONPATH"] = extra_pythonpath

        if os.name == "nt":
            if os.environ.get("PATH"):
                env["PATH"] = os.environ["PATH"]
            if os.environ.get("SYSTEMROOT"):
                env["SYSTEMROOT"] = os.environ["SYSTEMROOT"]
            if os.environ.get("TEMP"):
                env["TEMP"] = os.environ["TEMP"]
        else:
            env["PATH"] = os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin")

        popen_kwargs: dict = {}
        if os.name == "posix":
            popen_kwargs["start_new_session"] = True
            if worker_user:
                popen_kwargs["user"] = worker_user
            if worker_group:
                popen_kwargs["group"] = worker_group

        with open(err_path, "wb") as err_fh:
            try:
                proc = subprocess.Popen(
                    cmd,
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=err_fh,
                    cwd=str(workdir),
                    env=env,
                    close_fds=(os.name != "nt"),
                    **popen_kwargs,
                )
            except (OSError, ValueError, PermissionError) as exc:
                raise _server_fault(f"could not start worker: {exc}") from exc

            try:
                returncode = proc.wait(timeout=timeout_s)
            except subprocess.TimeoutExpired:
                _kill_group(proc.pid)
                proc.wait()
                raise EvalError("TIMEOUT", f"worker exceeded {timeout_s}s")
            finally:
                _kill_group(proc.pid)

        stderr_tail = _tail(err_path)
        if stderr_tail:
            LOG.info("worker stderr (tail): %s", stderr_tail.strip())

        if returncode == W_LOAD_FAILED:
            raise EvalError("MODEL_LOAD_FAILED", "worker could not load the model")
        if returncode == W_PREDICT_FAILED:
            raise EvalError("PREDICTION_FAILED", "worker raised during predict")
        if returncode in (W_MEMORY,) or returncode < 0:
            raise EvalError("RESOURCE_LIMIT_EXCEEDED", f"worker exit status {returncode}")
        if returncode != 0:
            raise EvalError("PREDICTION_FAILED", f"worker exit status {returncode}")

        return _read_predictions(out_path, n_rows)
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def _read_predictions(path: Path, n_rows: int) -> np.ndarray:
    """Read and strictly validate the worker's output. The worker is untrusted."""
    if not path.is_file():
        raise EvalError("INVALID_PREDICTIONS", "worker produced no predictions file")
    if path.stat().st_size > n_rows * 8 + 4096:
        raise EvalError("INVALID_PREDICTIONS", "predictions file is unexpectedly large")
    try:
        preds = np.load(path, allow_pickle=False)
    except Exception as exc:
        raise EvalError("INVALID_PREDICTIONS", f"predictions unreadable: {exc}") from exc
    if not isinstance(preds, np.ndarray) or preds.dtype != np.float64:
        raise EvalError("INVALID_PREDICTIONS", "predictions are not a float64 array")
    if preds.shape != (n_rows,):
        raise EvalError(
            "INVALID_PREDICTIONS", f"expected {n_rows} predictions, got shape {preds.shape}"
        )
    if not np.isfinite(preds).all():
        raise EvalError("INVALID_PREDICTIONS", "predictions contain NaN or infinity")
    return preds


# ----------------------------------------------------------------------------
# Orchestration
# ----------------------------------------------------------------------------
def evaluate(args: argparse.Namespace) -> dict:
    model = Path(args.model).resolve()
    features = Path(args.features).resolve()
    labels = Path(args.labels).resolve()
    drop_columns = _split_columns(args.drop_columns)

    # Submission file checks (participant's fault).
    try:
        size = model.stat().st_size if model.is_file() else 0
    except OSError:
        size = 0
    if size <= 0 or size > args.max_model_mb * 1024 * 1024:
        raise EvalError("MODEL_FILE_INVALID", f"model file size {size} bytes")

    # Organizer files checks (our fault).
    y_true = load_labels(labels, args.label_column)
    n_rows = count_feature_rows(features, drop_columns)
    if n_rows != y_true.size:
        raise _server_fault(f"{n_rows} feature rows but {y_true.size} labels")

    extra_pythonpath = args.extra_pythonpath
    if not extra_pythonpath:
        # Auto-detect location of challenge_features.py
        candidate_dirs = [
            Path(__file__).resolve().parent.parent / "sandbox",
            Path(__file__).resolve().parent / "sandbox",
            Path(__file__).resolve().parent.parent / "server" / "storage" / "public",
        ]
        found = [str(d) for d in candidate_dirs if (d / "challenge_features.py").is_file()]
        if found:
            extra_pythonpath = os.pathsep.join(found)

    preds = run_worker(
        model=model,
        features=features,
        drop_columns=drop_columns,
        n_rows=n_rows,
        timeout_s=args.timeout,
        mem_mb=args.max_memory_mb,
        worker_user=args.worker_user,
        worker_group=args.worker_group,
        extra_pythonpath=extra_pythonpath,
    )

    return {
        "status": "success",
        "samples_evaluated": int(n_rows),
        **compute_metrics(y_true, preds),
    }


def _emit(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload, allow_nan=False) + "\n")
    sys.stdout.flush()


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Evaluate a submitted .joblib model (RMSE, MSE, MAE, Accuracy, F1)."
    )
    p.add_argument("--model", required=True, help="Path to the submitted .joblib file")
    p.add_argument("--features", required=True, help="Path to hidden test features CSV")
    p.add_argument("--labels", required=True, help="Path to private test labels CSV")
    p.add_argument("--label-column", help="Label column (needed if the labels CSV has several)")
    p.add_argument("--drop-columns", help="Comma-separated feature columns to drop, e.g. id")
    p.add_argument("--extra-pythonpath", help="Additional paths to prepend to PYTHONPATH")
    p.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT_S,
                   help="Wall-clock/CPU limit for loading + predicting, seconds")
    p.add_argument("--max-memory-mb", type=int, default=DEFAULT_MEMORY_MB,
                   help="Address-space limit for the worker, MB (0 = no limit)")
    p.add_argument("--max-model-mb", type=int, default=DEFAULT_MAX_MODEL_MB,
                   help="Largest accepted model file, MB")
    p.add_argument("--worker-user", help="Run the worker as this user (needs privileges)")
    p.add_argument("--worker-group", help="Run the worker as this group (needs privileges)")
    return p


def main(argv: Optional[Sequence[str]] = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv and argv[0] == "--worker":
        return worker_main(argv[1:])

    logging.basicConfig(
        stream=sys.stderr,
        level=os.environ.get("EVALUATOR_LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s evaluator: %(message)s",
    )
    args = build_parser().parse_args(argv)

    try:
        result = evaluate(args)
        LOG.info("evaluation ok: %s", result)
        _emit(result)
        return EXIT_OK
    except EvalError as exc:
        LOG.warning("evaluation failed: %s", exc)
        _emit({
            "status": "error",
            "error_code": exc.code,
            "message": PUBLIC_MESSAGES.get(exc.code, PUBLIC_MESSAGES["EVALUATION_UNAVAILABLE"]),
        })
        return EXIT_SERVER_ERROR if exc.server_fault else EXIT_SUBMISSION_ERROR
    except Exception:
        LOG.exception("unexpected evaluator error")
        _emit({
            "status": "error",
            "error_code": "EVALUATION_UNAVAILABLE",
            "message": PUBLIC_MESSAGES["EVALUATION_UNAVAILABLE"],
        })
        return EXIT_SERVER_ERROR


if __name__ == "__main__":
    sys.exit(main())
