#!/usr/bin/env python3
"""Reproducible, validating dataset import for the ML Challenge platform.

Reads the competition source files, validates schemas / row counts / labels /
ids / overlaps, computes SHA-256 hashes, copies files into the application's
storage tree and writes a manifest.

    python scripts/import_datasets.py                     # source: server/data
    python scripts/import_datasets.py --source DIR        # different source tree
    python scripts/import_datasets.py --private-dir DIR   # fresh organiser-supplied
                                                          # evaluation holdouts (see docs)

Output tree (all git-ignored, never served statically):
    server/storage/public/    participant-accessible (served only by authenticated routes)
    server/storage/private/   hidden test features + reference labels (server only)
    server/manifest/dataset_manifest.json   hashes + schema (contains NO label data)

Source layout expected (Repository A layout; identical to the organiser guide):
    <source>/datasets/train.csv
    <source>/datasets/variant_N/{test.csv,sample_submission.csv,clue_dataset_variant_N.csv}
    <source>/datasets/stage2/{stage2_train.csv,stage2_test.csv}
    <source>/answer_keys/answer_key_variant_N.csv   (id,correct_prediction,ascii_character)
    <source>/answer_keys/stage2_answer_key.csv      (id,correct_prediction)

--private-dir layout (same file names, takes precedence for the *evaluation* files):
    <dir>/variant_N/{features.csv,labels.csv}, <dir>/stage2/{features.csv,labels.csv}
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "server"

# Hidden-model names come from variant_map.csv in the organiser pack.  They are
# loaded here ONLY to validate the anagram letters; they are never copied into
# any participant-accessible file.
VARIANTS = {
    1: {"hiddenModel": "RANDOM FOREST", "shuffledLetters": "ADMFOERNOSRT",
        "estimator": "RandomForestClassifier"},
    2: {"hiddenModel": "DECISION TREE", "shuffledLetters": "CREEOITIDSEN",
        "estimator": "DecisionTreeClassifier"},
    3: {"hiddenModel": "NAIVE BAYES", "shuffledLetters": "YVEAEASIBN",
        "estimator": "GaussianNB"},
    4: {"hiddenModel": "GRADIENT BOOSTING", "shuffledLetters": "GTNATINGOIODSRBE",
        "estimator": "HistGradientBoostingClassifier"},
}
TARGET = "sort_bin"
CLASS_RANGE = (65, 90)

errors: list[str] = []


def check(cond: bool, msg: str) -> None:
    print(("PASS  " if cond else "FAIL  ") + msg)
    if not cond:
        errors.append(msg)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def require(path: Path) -> Path:
    if not path.is_file():
        sys.exit(f"FATAL: required file missing: {path}")
    return path


def copy(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, default=SERVER / "data")
    ap.add_argument("--private-dir", type=Path, default=None)
    ap.add_argument("--out", type=Path, default=SERVER / "storage")
    args = ap.parse_args()

    src, out = args.source, args.out
    pub, priv = out / "public", out / "private"
    manifest: dict = {"source": str(src), "compromisedEvaluationData": args.private_dir is None,
                      "repositoryB": "UNVERIFIED (404 at audit time)", "stage1": {}, "stage2": {}}

    # ---- Stage 1 shared training set -------------------------------------
    train_p = require(src / "datasets" / "train.csv")
    train = pd.read_csv(train_p)
    features = [c for c in train.columns if c not in ("id", TARGET)]
    check(TARGET in train.columns and "id" in train.columns, "train has id + sort_bin")
    check(train[TARGET].between(*CLASS_RANGE).all() and train[TARGET].nunique() == 26,
          "train: 26 classes within ASCII 65-90")
    check(train["id"].is_unique, "train ids unique")
    check(not train[features].duplicated().any(), "train: no duplicate feature rows")
    check(len(features) == 18, f"train has 18 feature columns (got {len(features)})")
    copy(train_p, pub / "stage1_train.csv")
    manifest["featureColumns"] = features
    manifest["target"] = TARGET
    manifest["stage1"]["train"] = {
        "file": "public/stage1_train.csv", "rows": len(train), "sha256": sha256(train_p),
        "visibility": "participant-accessible", "sourcePath": str(train_p.relative_to(src)),
    }

    # ---- Stage 2 ----------------------------------------------------------
    s2_train_p = require(src / "datasets" / "stage2" / "stage2_train.csv")
    s2_train = pd.read_csv(s2_train_p)
    check(list(s2_train.columns) == list(train.columns), "stage2 train columns identical to stage1 train")
    check(s2_train[TARGET].between(*CLASS_RANGE).all(), "stage2 train labels within ASCII 65-90")
    copy(s2_train_p, pub / "stage2_train.csv")

    if args.private_dir:
        s2f_p = require(args.private_dir / "stage2" / "features.csv")
        s2l_p = require(args.private_dir / "stage2" / "labels.csv")
    else:
        s2f_p = require(src / "datasets" / "stage2" / "stage2_test.csv")
        s2l_p = require(src / "answer_keys" / "stage2_answer_key.csv")
    s2f, s2l = pd.read_csv(s2f_p), pd.read_csv(s2l_p)
    check(list(s2f.columns) == ["id"] + features, "stage2 test features match feature schema")
    check(list(s2f["id"]) == list(s2l["id"]), "stage2 ids/order match reference labels")
    check(len(s2f) == len(s2l), f"stage2 hidden rows == label rows ({len(s2f)})")
    check(s2l["correct_prediction"].between(*CLASS_RANGE).all(), "stage2 labels within 65-90")
    check(not s2f.isna().all(axis=None), "stage2 test features not empty")
    check(not (set(s2f["id"]) & set(s2_train["id"])), "stage2 test ids do not overlap stage2 train ids")
    leak = len(set(s2f["id"]) & set(train["id"]))
    manifest["stage2"]["leakedRowsInPublicStage1Train"] = leak
    if args.private_dir:
        check(leak == 0, "fresh stage2 holdout shares no ids with public train.csv")
    elif leak:
        print(f"WARN  {leak}/{len(s2f)} stage2 hidden test rows are present, WITH LABELS, in the public"
              " stage-1 train.csv -> stage 2 evaluation data is compromised by construction")
    copy(s2f_p, priv / "eval" / "stage2" / "features.csv")
    copy(s2l_p, priv / "eval" / "stage2" / "labels.csv")
    manifest["stage2"].update({
        "train": {"file": "public/stage2_train.csv", "rows": len(s2_train), "sha256": sha256(s2_train_p),
                  "visibility": "participant-accessible"},
        "testFeatures": {"file": "private/eval/stage2/features.csv", "rows": len(s2f),
                         "sha256": sha256(s2f_p), "visibility": "private"},
        "referenceLabels": {"file": "private/eval/stage2/labels.csv", "rows": len(s2l),
                            "sha256": sha256(s2l_p), "visibility": "private"},
    })

    # ---- Variants ---------------------------------------------------------
    seen_ids = set(train["id"]) | set(s2_train["id"]) | set(s2f["id"])
    letter_sets = {}
    manifest["variants"] = {}
    for k, v in VARIANTS.items():
        vd = src / "datasets" / f"variant_{k}"
        if args.private_dir:
            f_p = require(args.private_dir / f"variant_{k}" / "features.csv")
            l_p = require(args.private_dir / f"variant_{k}" / "labels.csv")
        else:
            f_p = require(vd / "test.csv")
            l_p = require(src / "answer_keys" / f"answer_key_variant_{k}.csv")
        clue_p = require(vd / f"clue_dataset_variant_{k}.csv")
        sample_p = require(vd / "sample_submission.csv")
        f, lab, clue = pd.read_csv(f_p), pd.read_csv(l_p), pd.read_csv(clue_p)
        print(f"\n-- variant {k}")
        check(list(f.columns) == ["id"] + features, f"v{k}: test features match schema")
        check(TARGET not in f.columns, f"v{k}: no target column in test features")
        check(list(f["id"]) == list(lab["id"]), f"v{k}: ids/order match reference labels")
        decoded = "".join(chr(int(c)) for c in lab["correct_prediction"])
        want = v["hiddenModel"].replace(" ", "")
        check(sorted(decoded) == sorted(want), f"v{k}: labels decode to an anagram of the hidden model")
        check(decoded == v["shuffledLetters"], f"v{k}: decoded labels == configured shuffled letters")
        check(decoded != want, f"v{k}: letters are shuffled")
        check(not (set(f["id"]) & seen_ids), f"v{k}: test ids disjoint from train/other variants")
        seen_ids |= set(f["id"])
        check(all((train[TARGET] == ord(c)).sum() >= 40 for c in set(decoded)),
              f"v{k}: every letter has >= 40 training rows")
        letter_sets[k] = tuple(sorted(decoded))
        check({"clue_sequence", "observed_resonance_char"} <= set(clue.columns),
              f"v{k}: clue dataset has clue columns")
        check(v["hiddenModel"].upper() not in clue.to_csv().upper(), f"v{k}: clue file does not contain model name")
        copy(clue_p, pub / "clues" / f"variant_{k}.csv")
        copy(f_p, priv / "eval" / f"variant_{k}" / "features.csv")
        copy(l_p, priv / "eval" / f"variant_{k}" / "labels.csv")
        manifest["variants"][str(k)] = {
            "estimator": v["estimator"],
            "anagramLetters": len(decoded),
            "testFeatures": {"file": f"private/eval/variant_{k}/features.csv", "rows": len(f),
                             "sha256": sha256(f_p), "visibility": "private"},
            "referenceLabels": {"file": f"private/eval/variant_{k}/labels.csv", "rows": len(lab),
                                "sha256": sha256(l_p), "visibility": "private"},
            "clue": {"file": f"public/clues/variant_{k}.csv", "rows": len(clue), "sha256": sha256(clue_p),
                     "visibility": "participant-accessible (after Stage 1 qualification)"},
            "sampleSubmission": {"sha256": sha256(sample_p), "visibility": "legacy-csv-only"},
        }
    check(len(set(letter_sets.values())) == 4, "the four letter multisets are pairwise different")

    if errors:
        print(f"\n{len(errors)} CHECK(S) FAILED - manifest NOT written")
        return 1
    (SERVER / "manifest").mkdir(exist_ok=True)
    (SERVER / "manifest" / "dataset_manifest.json").write_text(json.dumps(manifest, indent=2))
    # Organiser-only variant config consumed by the seed script (never served to participants).
    (priv / "variants.json").write_text(json.dumps(
        {str(k): {"hiddenModel": v["hiddenModel"], "shuffledLetters": v["shuffledLetters"],
                  "estimator": v["estimator"]} for k, v in VARIANTS.items()}, indent=2))
    print("\nALL CHECKS PASSED - manifest written to server/manifest/dataset_manifest.json")
    if manifest["compromisedEvaluationData"]:
        print("WARNING: evaluation labels came from the public repository history and are COMPROMISED."
              " Use --private-dir with fresh holdouts before a live event.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
