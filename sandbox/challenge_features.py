"""Participant-facing feature helpers (PUBLIC file; contains no labels or secrets).

Download this file next to your training script. Use it inside your sklearn Pipeline so the
submitted ``.joblib`` is self-contained and the evaluator can unpickle it:

    from sklearn.preprocessing import FunctionTransformer
    from challenge_features import add_engineered_features
    ("fe", FunctionTransformer(add_engineered_features))

The evaluation sandbox has this exact module on its import path.
"""
import numpy as np
import pandas as pd

CATEGORICAL = ["material", "supplier", "coating", "line_id", "shift"]
NOISE = ["batch_number"]
FEATURE_COLUMNS = [
    "material", "supplier", "coating", "line_id", "shift", "batch_number", "length_mm", "width_mm",
    "thickness_mm", "weight_g", "hardness_hv", "surface_roughness_um", "conductivity_iacs",
    "magnetic_response_idx", "ambient_temp_c", "humidity_pct", "vibration_rms", "inspection_time_s",
]


def add_engineered_features(df: pd.DataFrame) -> pd.DataFrame:
    """Adds density / aspect / thinness / log features and drops the pure-noise batch_number column."""
    d = df.copy()
    vol = (d["length_mm"] * d["width_mm"] * d["thickness_mm"]) / 1000.0
    d["density"] = d["weight_g"] / (vol + 1e-6)
    d["aspect_ratio"] = d["length_mm"] / (d["width_mm"] + 1e-6)
    d["thinness"] = d["thickness_mm"] / (d["width_mm"] + 1e-6)
    d["log_volume"] = np.log1p(vol)
    d["log_roughness"] = np.log1p(d["surface_roughness_um"])
    d["log_magnetic"] = np.log1p(d["magnetic_response_idx"])
    return d.drop(columns=[c for c in NOISE if c in d.columns])

