"""Untrusted-model runner. Executes INSIDE the sandbox container only.

Inputs  (read-only mount /in):  model.joblib, features.csv
Output  (writable mount /out):  result.json   {"ok": true, "predictions": [...], ...}
                                              {"ok": false, "errorCode": "..."}

This process never sees reference labels, secrets, or the network. Exception text from the
untrusted model is never forwarded; only a fixed set of error codes is emitted.
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

IN = Path(os.environ.get("MLC_IN", "/in"))
OUT = Path(os.environ.get("MLC_OUT", "/out"))
MAX_PREDICTIONS = 100_000


def finish(payload: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = OUT / "result.json.tmp"
    tmp.write_text(json.dumps(payload))
    tmp.replace(OUT / "result.json")
    sys.exit(0)


def fail(code: str) -> None:
    finish({"ok": False, "errorCode": code})


def apply_limits() -> None:
    try:  # defence in depth; the container enforces the real limits
        import resource
        mem = int(os.environ.get("MLC_MEM_BYTES", str(1024 * 1024 * 1024)))
        resource.setrlimit(resource.RLIMIT_AS, (mem * 2, mem * 2))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        resource.setrlimit(resource.RLIMIT_FSIZE, (64 * 1024 * 1024, 64 * 1024 * 1024))
    except Exception:
        pass


def main() -> None:
    apply_limits()
    started = time.time()
    try:
        import numpy as np
        import pandas as pd
        import joblib
        import sklearn
        from sklearn.pipeline import Pipeline
    except Exception:
        fail("RUNNER_ENV")

    try:
        features = pd.read_csv(IN / "features.csv")
    except Exception:
        fail("RUNNER_ENV")
    ids = features["id"] if "id" in features.columns else None
    X = features.drop(columns=["id"], errors="ignore")

    try:
        model = joblib.load(IN / "model.joblib")
    except MemoryError:
        fail("OUT_OF_MEMORY")
    except Exception:
        fail("LOAD_FAILED")

    if not hasattr(model, "predict"):
        fail("NOT_AN_ESTIMATOR")

    is_pipeline = isinstance(model, Pipeline)
    final = model.steps[-1][1] if is_pipeline else model
    estimator = type(final).__name__

    names = getattr(model, "feature_names_in_", None)
    if names is not None:
        if set(map(str, names)) != set(X.columns):
            fail("FEATURE_MISMATCH")
    else:
        n_in = getattr(model, "n_features_in_", None)
        if n_in is not None and n_in != X.shape[1]:
            fail("FEATURE_MISMATCH")

    try:
        pred = np.asarray(model.predict(X[list(names)] if names is not None else X))
    except MemoryError:
        fail("OUT_OF_MEMORY")
    except Exception:
        fail("PREDICT_FAILED")

    if pred.ndim != 1 or len(pred) != len(X) or len(pred) > MAX_PREDICTIONS:
        fail("BAD_PREDICTION_SHAPE")
    try:
        if pred.dtype.kind in "fc":
            if not np.isfinite(pred).all():
                fail("INVALID_PREDICTIONS")
            if not (pred == np.round(pred)).all():
                fail("INVALID_PREDICTIONS")
        pred_list = [int(p) for p in pred]
    except Exception:
        fail("INVALID_PREDICTIONS")

    finish({
        "ok": True,
        "predictions": pred_list,
        "estimator": estimator,
        "isPipeline": is_pipeline,
        "sklearnVersion": sklearn.__version__,
        "seconds": round(time.time() - started, 3),
    })


if __name__ == "__main__":
    main()

