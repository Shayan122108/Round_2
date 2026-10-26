"""Isolated Python evaluator worker for ML Challenge platform.
Calculates metrics against hidden ground-truth labels in a controlled sandbox.
Outputs standardized JSON with metrics, status, and verification checks.
"""
import sys
import json
import argparse
import pandas as pd
import numpy as np
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, confusion_matrix

def evaluate_stage1(submission_path, answer_key_path, target_accuracy=0.75):
    sub = pd.read_csv(submission_path)
    ak = pd.read_csv(answer_key_path)

    if "id" not in sub.columns or "prediction" not in sub.columns:
        return {"passed": False, "error": "CSV must contain 'id' and 'prediction' columns."}

    if len(sub) != len(ak):
        return {"passed": False, "error": f"Row count mismatch: expected {len(ak)} rows, got {len(sub)}."}

    # Verify ID alignment
    if list(sub["id"]) != list(ak["id"]):
        return {"passed": False, "error": "Prediction IDs do not strictly match test row sequence."}

    # Compute metrics
    y_true = ak["correct_prediction"].astype(int).values
    y_pred = sub["prediction"].astype(int).values

    acc = float(accuracy_score(y_true, y_pred))
    correct = int((y_true == y_pred).sum())
    
    # Decode string from predictions
    decoded = "".join(chr(p) if 65 <= p <= 90 else "?" for p in y_pred)

    passed = acc >= target_accuracy

    return {
        "stage": 1,
        "passed": passed,
        "metrics": {
            "accuracy": round(acc, 4),
            "correctCount": correct,
            "totalCount": len(ak),
            "targetAccuracy": target_accuracy,
            "decodedString": decoded
        }
    }

def evaluate_stage2(submission_path, answer_key_path, target_accuracy=0.70, target_f1=0.65):
    sub = pd.read_csv(submission_path)
    ak = pd.read_csv(answer_key_path)

    if "id" not in sub.columns or "prediction" not in sub.columns:
        return {"passed": False, "error": "CSV must contain 'id' and 'prediction' columns."}

    merged = ak.merge(sub, on="id", suffixes=("_true", "_pred"))
    if len(merged) != len(ak):
        return {"passed": False, "error": f"Missing or invalid IDs. Expected {len(ak)} rows."}

    y_true = merged["correct_prediction"].astype(int).values
    y_pred = merged["prediction"].astype(int).values

    acc = float(accuracy_score(y_true, y_pred))
    macro_f1 = float(f1_score(y_true, y_pred, average="macro", zero_division=0))
    correct = int((y_true == y_pred).sum())

    passed = acc >= target_accuracy and macro_f1 >= target_f1

    return {
        "stage": 2,
        "passed": passed,
        "metrics": {
            "accuracy": round(acc, 4),
            "macroF1": round(macro_f1, 4),
            "correctCount": correct,
            "totalCount": len(ak),
            "targetAccuracy": target_accuracy,
            "targetF1": target_f1
        }
    }

def main():
    parser = argparse.ArgumentParser(description="Isolated ML Challenge Evaluator")
    parser.add_argument("--stage", type=int, required=True, choices=[1, 2])
    parser.add_argument("--submission", type=str, required=True)
    parser.add_argument("--answer-key", type=str, required=True)
    parser.add_argument("--target-acc", type=float, default=0.75)
    parser.add_argument("--target-f1", type=float, default=0.65)

    args = parser.parse_args()

    try:
        if args.stage == 1:
            res = evaluate_stage1(args.submission, args.answer_key, args.target_acc)
        else:
            res = evaluate_stage2(args.submission, args.answer_key, args.target_acc, args.target_f1)
        print(json.dumps(res))
    except Exception as e:
        print(json.dumps({"passed": False, "error": str(e)}))

if __name__ == "__main__":
    main()
