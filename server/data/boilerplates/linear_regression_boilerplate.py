"""
SDC ML Challenge - Round 1: Linear Regression Starter Boilerplate

Instructions:
1. Ensure 'train.csv' is present in your working directory.
2. Train a Linear Regression model on the training features.
3. Compute MAE, RMSE, and MSE locally.
4. Call an invigilator to show your locally calculated metrics for manual verification.
"""

import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import train_test_split

def main():
    print("Loading Round 1 training dataset...")
    df = pd.read_csv("train.csv")
    
    target_col = "sort_bin" if "sort_bin" in df.columns else df.columns[-1]
    feature_cols = [c for c in df.columns if c not in ("id", target_col) and np.issubdtype(df[c].dtype, np.number)]
    
    X = df[feature_cols].fillna(0)
    y = df[target_col]
    
    # Train / validation split
    X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Fit Linear Regression model
    model = LinearRegression()
    model.fit(X_train, y_train)
    
    # Evaluate locally
    preds = model.predict(X_val)
    mae = mean_absolute_error(y_val, preds)
    mse = mean_squared_error(y_val, preds)
    rmse = np.sqrt(mse)
    
    print("\n--- Round 1 Evaluation Metrics ---")
    print(f"MAE  (Mean Absolute Error):     {mae:.4f}")
    print(f"RMSE (Root Mean Squared Error): {rmse:.4f}")
    print(f"MSE  (Mean Squared Error):      {mse:.4f}")
    print("----------------------------------")
    print("\nPlease present these metrics to your invigilator in person for Round 1 approval.")

if __name__ == "__main__":
    main()
