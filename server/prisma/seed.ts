import { PrismaClient } from '@prisma/client';
import { hashPin } from '../src/auth/auth.js';

const prisma = new PrismaClient();

const INITIAL_BOILERPLATES: Record<number, string> = {
  1: `# Round 3 - Assigned ML Model Challenge: Random Forest Classifier Boilerplate
# Problem: Sort parts into 26 sorting bins (ASCII 65-90)
# Instructions:
# 1. Train your model locally using train.csv.
# 2. Compute local evaluation metrics: MAE, RMSE, and MSE.
# 3. Present your calculated metrics to an invigilator for Round 3 verification.

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import train_test_split

train_df = pd.read_csv("train.csv")
TARGET = "sort_bin" if "sort_bin" in train_df.columns else train_df.columns[-1]

X = train_df.drop(columns=["id", TARGET], errors="ignore")
y = train_df[TARGET]

cat_cols = [c for c in X.columns if X[c].dtype == "object"]
num_cols = [c for c in X.columns if c not in cat_cols and c != "batch_number"]

preprocessor = ColumnTransformer(
    transformers=[
        ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())]), num_cols),
        ("cat", Pipeline([("imp", SimpleImputer(strategy="most_frequent")), ("ohe", OneHotEncoder(handle_unknown="ignore"))]), cat_cols)
    ]
)

rf_pipeline = Pipeline([
    ("preprocessor", preprocessor),
    ("classifier", RandomForestClassifier(n_estimators=150, max_depth=14, min_samples_split=4, random_state=42, n_jobs=-1))
])

X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)
rf_pipeline.fit(X_train, y_train)

val_preds = rf_pipeline.predict(X_val)
mae = mean_absolute_error(y_val, val_preds)
mse = mean_squared_error(y_val, val_preds)
rmse = np.sqrt(mse)

print("--- Round 3 Random Forest Metrics ---")
print(f"MAE:  {mae:.4f}")
print(f"RMSE: {rmse:.4f}")
print(f"MSE:  {mse:.4f}")
print("Please show these values to the invigilator for Round 3 approval.")
`,
  2: `# Round 3 - Assigned ML Model Challenge: Decision Tree Classifier Boilerplate
# Problem: Sort parts into 26 sorting bins (ASCII 65-90)
# Instructions:
# 1. Train your model locally using train.csv.
# 2. Compute local evaluation metrics: MAE, RMSE, and MSE.
# 3. Present your calculated metrics to an invigilator for Round 3 verification.

import pandas as pd
import numpy as np
from sklearn.tree import DecisionTreeClassifier
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import train_test_split

train_df = pd.read_csv("train.csv")
TARGET = "sort_bin" if "sort_bin" in train_df.columns else train_df.columns[-1]

X = train_df.drop(columns=["id", TARGET], errors="ignore")
y = train_df[TARGET]

cat_cols = [c for c in X.columns if X[c].dtype == "object"]
num_cols = [c for c in X.columns if c not in cat_cols and c != "batch_number"]

preprocessor = ColumnTransformer([
    ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())]), num_cols),
    ("cat", Pipeline([("imp", SimpleImputer(strategy="most_frequent")), ("ohe", OneHotEncoder(handle_unknown="ignore"))]), cat_cols)
])

dt_pipeline = Pipeline([
    ("preprocessor", preprocessor),
    ("classifier", DecisionTreeClassifier(criterion="entropy", max_depth=12, min_samples_split=6, min_samples_leaf=2, random_state=42))
])

X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)
dt_pipeline.fit(X_train, y_train)

val_preds = dt_pipeline.predict(X_val)
mae = mean_absolute_error(y_val, val_preds)
mse = mean_squared_error(y_val, val_preds)
rmse = np.sqrt(mse)

print("--- Round 3 Decision Tree Metrics ---")
print(f"MAE:  {mae:.4f}")
print(f"RMSE: {rmse:.4f}")
print(f"MSE:  {mse:.4f}")
print("Please show these values to the invigilator for Round 3 approval.")
`,
  3: `# Round 3 - Assigned ML Model Challenge: Naive Bayes Boilerplate
# Problem: Sort parts into 26 sorting bins (ASCII 65-90)
# Instructions:
# 1. Train your model locally using train.csv.
# 2. Compute local evaluation metrics: MAE, RMSE, and MSE.
# 3. Present your calculated metrics to an invigilator for Round 3 verification.

import pandas as pd
import numpy as np
from sklearn.naive_bayes import GaussianNB
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import RobustScaler, OneHotEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import train_test_split

train_df = pd.read_csv("train.csv")
TARGET = "sort_bin" if "sort_bin" in train_df.columns else train_df.columns[-1]

X = train_df.drop(columns=["id", TARGET], errors="ignore")
y = train_df[TARGET]

cat_cols = [c for c in X.columns if X[c].dtype == "object"]
num_cols = [c for c in X.columns if c not in cat_cols and c != "batch_number"]

preprocessor = ColumnTransformer([
    ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", RobustScaler())]), num_cols),
    ("cat", Pipeline([("imp", SimpleImputer(strategy="most_frequent")), ("ohe", OneHotEncoder(handle_unknown="ignore", sparse_output=False))]), cat_cols)
])

nb_pipeline = Pipeline([
    ("preprocessor", preprocessor),
    ("classifier", GaussianNB(var_smoothing=1e-3))
])

X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)
nb_pipeline.fit(X_train, y_train)

val_preds = nb_pipeline.predict(X_val)
mae = mean_absolute_error(y_val, val_preds)
mse = mean_squared_error(y_val, val_preds)
rmse = np.sqrt(mse)

print("--- Round 3 Naive Bayes Metrics ---")
print(f"MAE:  {mae:.4f}")
print(f"RMSE: {rmse:.4f}")
print(f"MSE:  {mse:.4f}")
print("Please show these values to the invigilator for Round 3 approval.")
`,
  4: `# Round 3 - Assigned ML Model Challenge: Gradient Boosting Classifier Boilerplate
# Problem: Sort parts into 26 sorting bins (ASCII 65-90)
# Instructions:
# 1. Train your model locally using train.csv.
# 2. Compute local evaluation metrics: MAE, RMSE, and MSE.
# 3. Present your calculated metrics to an invigilator for Round 3 verification.

import pandas as pd
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OrdinalEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import train_test_split

train_df = pd.read_csv("train.csv")
TARGET = "sort_bin" if "sort_bin" in train_df.columns else train_df.columns[-1]

X = train_df.drop(columns=["id", TARGET], errors="ignore")
y = train_df[TARGET]

cat_cols = [c for c in X.columns if X[c].dtype == "object"]
num_cols = [c for c in X.columns if c not in cat_cols and c != "batch_number"]

preprocessor = ColumnTransformer([
    ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())]), num_cols),
    ("cat", Pipeline([("imp", SimpleImputer(strategy="most_frequent")), ("ord", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1))]), cat_cols)
])

gb_pipeline = Pipeline([
    ("preprocessor", preprocessor),
    ("classifier", HistGradientBoostingClassifier(max_iter=150, learning_rate=0.08, max_depth=8, random_state=42))
])

X_train, X_val, y_train, y_val = train_test_split(X, y, test_size=0.2, random_state=42)
gb_pipeline.fit(X_train, y_train)

val_preds = gb_pipeline.predict(X_val)
mae = mean_absolute_error(y_val, val_preds)
mse = mean_squared_error(y_val, val_preds)
rmse = np.sqrt(mse)

print("--- Round 3 Gradient Boosting Metrics ---")
print(f"MAE:  {mae:.4f}")
print(f"RMSE: {rmse:.4f}")
print(f"MSE:  {mse:.4f}")
print("Please show these values to the invigilator for Round 3 approval.")
`
};

async function main() {
  console.log('Seeding SDC ML Challenge database...');

  // 1. Competition Config singleton
  await prisma.competitionConfig.upsert({
    where: { id: 1 },
    update: {
      status: 'RUNNING',
      stage1Points: 30,
      anagramPoints: 50,
      stage2Points: 70,
      anagramPenalty: 0,
      maxScore: 150,
    },
    create: {
      id: 1,
      status: 'RUNNING',
      durationSeconds: 90 * 60,
      stage1Points: 30,
      anagramPoints: 50,
      stage2Points: 70,
      anagramPenalty: 0,
      maxScore: 150,
    },
  });

  // 2. Singleton BenchmarkConfig for Round 1
  await prisma.benchmarkConfig.upsert({
    where: { id: 1 },
    update: {
      round1Mae: 1.25,
      round1Rmse: 1.85,
      round1Mse: 3.42,
    },
    create: {
      id: 1,
      round1Mae: 1.25,
      round1Rmse: 1.85,
      round1Mse: 3.42,
      updatedBy: 'SYSTEM',
    },
  });

  // 3. Variants 1..4 with Round 3 reference metrics
  const variants = [
    {
      id: 1,
      label: 'Variant 1',
      hiddenModel: 'RANDOM FOREST',
      shuffledLetters: 'ADMFOERNOSRT',
      estimator: 'RandomForestClassifier',
      round3Mae: 0.85,
      round3Rmse: 1.20,
      round3Mse: 1.44,
      starterTemplate: INITIAL_BOILERPLATES[1]!,
    },
    {
      id: 2,
      label: 'Variant 2',
      hiddenModel: 'DECISION TREE',
      shuffledLetters: 'CREEOITIDSEN',
      estimator: 'DecisionTreeClassifier',
      round3Mae: 1.05,
      round3Rmse: 1.55,
      round3Mse: 2.40,
      starterTemplate: INITIAL_BOILERPLATES[2]!,
    },
    {
      id: 3,
      label: 'Variant 3',
      hiddenModel: 'NAIVE BAYES',
      shuffledLetters: 'YVEAEASIBN',
      estimator: 'GaussianNB',
      round3Mae: 1.35,
      round3Rmse: 1.90,
      round3Mse: 3.61,
      starterTemplate: INITIAL_BOILERPLATES[3]!,
    },
    {
      id: 4,
      label: 'Variant 4',
      hiddenModel: 'GRADIENT BOOSTING',
      shuffledLetters: 'GTNATINGOIODSRBE',
      estimator: 'HistGradientBoostingClassifier',
      round3Mae: 0.75,
      round3Rmse: 1.10,
      round3Mse: 1.21,
      starterTemplate: INITIAL_BOILERPLATES[4]!,
    },
  ];

  for (const v of variants) {
    await prisma.variant.upsert({
      where: { id: v.id },
      update: v,
      create: v,
    });
  }

  // 4. Admin Account
  const adminRegId = process.env.ADMIN_REGISTRATION_ID || 'ADMIN';
  const adminPin = process.env.ADMIN_PIN || 'AdminSecure123!';
  const adminPinHash = await hashPin(adminPin);

  await prisma.user.upsert({
    where: { registrationId: adminRegId },
    update: { pinHash: adminPinHash, role: 'ADMIN', displayName: 'Head Admin' },
    create: {
      registrationId: adminRegId,
      displayName: 'Head Admin',
      role: 'ADMIN',
      pinHash: adminPinHash,
    },
  });
  console.log(`Admin account initialized: ${adminRegId}`);

  // 5. Default Seed Participant Accounts (SDC-2026-001 through SDC-2026-005)
  const defaultParticipants = [
    { regId: 'SDC-2026-001', name: 'Participant 001' },
    { regId: 'SDC-2026-002', name: 'Participant 002' },
    { regId: 'SDC-2026-003', name: 'Participant 003' },
    { regId: 'SDC-2026-004', name: 'Participant 004' },
    { regId: 'SDC-2026-005', name: 'Participant 005' },
    // Also keep legacy REG-101 .. REG-105 for backward compatibility with existing tests
    { regId: 'REG-101', name: 'Team Neural Knights' },
    { regId: 'REG-102', name: 'Team Gradient Gurus' },
    { regId: 'REG-103', name: 'Team Vector Voyagers' },
    { regId: 'REG-104', name: 'Team Tensor Titans' },
    { regId: 'REG-105', name: 'Team Deep Divers' },
  ];

  for (const dp of defaultParticipants) {
    const existing = await prisma.user.findUnique({ where: { registrationId: dp.regId } });
    if (!existing) {
      const created = await prisma.user.create({
        data: {
          registrationId: dp.regId,
          displayName: dp.name,
          role: 'PARTICIPANT',
        },
      });
      // Set variantId using 4k rule based on created.webId: ((webId - 1) % 4) + 1
      const variantId = ((created.webId - 1) % 4) + 1;
      await prisma.user.update({
        where: { id: created.id },
        data: { variantId },
      });
    }
  }

  console.log(`Seeded default participants successfully.`);
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
