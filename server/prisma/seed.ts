import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { hashPin } from '../src/auth/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prisma = new PrismaClient();

const INITIAL_BOILERPLATES: Record<number, string> = {
  1: `# Stage 2 - Variant A: Random Forest Classifier Boilerplate
# Problem: Sort parts into 26 sorting bins (ASCII 65-90)
import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder, FunctionTransformer
from challenge_features import add_engineered_features, CATEGORICAL

# 1. Load Data
train_df = pd.read_csv("stage2_train.csv")
TARGET = "sort_bin"

X = train_df.drop(columns=["id", TARGET], errors="ignore")
y = train_df[TARGET]

cat_cols = CATEGORICAL
num_cols = [c for c in X.columns if c not in cat_cols and c != "batch_number"]

preprocessor = ColumnTransformer(
    transformers=[
        ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())]), num_cols),
        ("cat", Pipeline([("imp", SimpleImputer(strategy="most_frequent")), ("ohe", OneHotEncoder(handle_unknown="ignore"))]), cat_cols)
    ]
)

rf_pipeline = Pipeline([
    ("engineer", FunctionTransformer(add_engineered_features)),
    ("preprocessor", preprocessor),
    ("classifier", RandomForestClassifier(n_estimators=150, max_depth=14, min_samples_split=4, random_state=42, n_jobs=-1))
])

rf_pipeline.fit(X, y)

# Save artifact as model.joblib for upload
joblib.dump(rf_pipeline, "model.joblib")
print("Stage 2 Random Forest Pipeline saved successfully as model.joblib!")
`,
  2: `# Stage 2 - Variant B: Decision Tree Classifier Boilerplate
# Problem: Sort parts into 26 sorting bins (ASCII 65-90)
import pandas as pd
import numpy as np
import joblib
from sklearn.tree import DecisionTreeClassifier
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder, FunctionTransformer
from challenge_features import add_engineered_features, CATEGORICAL

train_df = pd.read_csv("stage2_train.csv")
TARGET = "sort_bin"

X = train_df.drop(columns=["id", TARGET], errors="ignore")
y = train_df[TARGET]

cat_cols = CATEGORICAL
num_cols = [c for c in X.columns if c not in cat_cols and c != "batch_number"]

preprocessor = ColumnTransformer([
    ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())]), num_cols),
    ("cat", Pipeline([("imp", SimpleImputer(strategy="most_frequent")), ("ohe", OneHotEncoder(handle_unknown="ignore"))]), cat_cols)
])

dt_pipeline = Pipeline([
    ("engineer", FunctionTransformer(add_engineered_features)),
    ("preprocessor", preprocessor),
    ("classifier", DecisionTreeClassifier(criterion="entropy", max_depth=12, min_samples_split=6, min_samples_leaf=2, random_state=42))
])

dt_pipeline.fit(X, y)
joblib.dump(dt_pipeline, "model.joblib")
print("Stage 2 Decision Tree Pipeline saved successfully as model.joblib!")
`,
  3: `# Stage 2 - Variant C: Naive Bayes Boilerplate
# Problem: Sort parts into 26 sorting bins (ASCII 65-90)
import pandas as pd
import numpy as np
import joblib
from sklearn.naive_bayes import GaussianNB
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import RobustScaler, OneHotEncoder, FunctionTransformer
from challenge_features import add_engineered_features, CATEGORICAL

train_df = pd.read_csv("stage2_train.csv")
TARGET = "sort_bin"

X = train_df.drop(columns=["id", TARGET], errors="ignore")
y = train_df[TARGET]

cat_cols = CATEGORICAL
num_cols = [c for c in X.columns if c not in cat_cols and c != "batch_number"]

preprocessor = ColumnTransformer([
    ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", RobustScaler())]), num_cols),
    ("cat", Pipeline([("imp", SimpleImputer(strategy="most_frequent")), ("ohe", OneHotEncoder(handle_unknown="ignore", sparse_output=False))]), cat_cols)
])

nb_pipeline = Pipeline([
    ("engineer", FunctionTransformer(add_engineered_features)),
    ("preprocessor", preprocessor),
    ("classifier", GaussianNB(var_smoothing=1e-3))
])

nb_pipeline.fit(X, y)
joblib.dump(nb_pipeline, "model.joblib")
print("Stage 2 Naive Bayes Pipeline saved successfully as model.joblib!")
`,
  4: `# Stage 2 - Variant D: Gradient Boosting Classifier Boilerplate
# Problem: Sort parts into 26 sorting bins (ASCII 65-90)
import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OrdinalEncoder, FunctionTransformer
from challenge_features import add_engineered_features, CATEGORICAL

train_df = pd.read_csv("stage2_train.csv")
TARGET = "sort_bin"

X = train_df.drop(columns=["id", TARGET], errors="ignore")
y = train_df[TARGET]

cat_cols = CATEGORICAL
num_cols = [c for c in X.columns if c not in cat_cols and c != "batch_number"]

preprocessor = ColumnTransformer([
    ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())]), num_cols),
    ("cat", Pipeline([("imp", SimpleImputer(strategy="most_frequent")), ("ord", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1))]), cat_cols)
])

gb_pipeline = Pipeline([
    ("engineer", FunctionTransformer(add_engineered_features)),
    ("preprocessor", preprocessor),
    ("classifier", HistGradientBoostingClassifier(max_iter=150, learning_rate=0.08, max_depth=8, random_state=42))
])

gb_pipeline.fit(X, y)
joblib.dump(gb_pipeline, "model.joblib")
print("Stage 2 Gradient Boosting Pipeline saved successfully as model.joblib!")
`
};

async function main() {
  console.log('Seeding competition database...');

  // 1. Competition Config singleton
  await prisma.competitionConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      status: 'NOT_STARTED',
      durationSeconds: 90 * 60,
      stage1Points: 30,
      anagramPoints: 50,
      stage2Points: 70,
      anagramPenalty: 30,
      maxScore: 150,
    },
  });

  // 2. Variants 1..4
  const variants = [
    {
      id: 1,
      label: 'Variant A',
      hiddenModel: 'RANDOM FOREST',
      shuffledLetters: 'ADMFOERNOSRT',
      estimator: 'RandomForestClassifier',
      stage1MinAccuracy: 0.75,
      stage2MinAccuracy: 0.82,
      stage2MinMacroF1: 0.78,
      starterTemplate: INITIAL_BOILERPLATES[1]!,
    },
    {
      id: 2,
      label: 'Variant B',
      hiddenModel: 'DECISION TREE',
      shuffledLetters: 'CREEOITIDSEN',
      estimator: 'DecisionTreeClassifier',
      stage1MinAccuracy: 0.75,
      stage2MinAccuracy: 0.70,
      stage2MinMacroF1: 0.65,
      starterTemplate: INITIAL_BOILERPLATES[2]!,
    },
    {
      id: 3,
      label: 'Variant C',
      hiddenModel: 'NAIVE BAYES',
      shuffledLetters: 'YVEAEASIBN',
      estimator: 'GaussianNB',
      stage1MinAccuracy: 0.75,
      stage2MinAccuracy: 0.65,
      stage2MinMacroF1: 0.60,
      starterTemplate: INITIAL_BOILERPLATES[3]!,
    },
    {
      id: 4,
      label: 'Variant D',
      hiddenModel: 'GRADIENT BOOSTING',
      shuffledLetters: 'GTNATINGOIODSRBE',
      estimator: 'HistGradientBoostingClassifier',
      stage1MinAccuracy: 0.75,
      stage2MinAccuracy: 0.84,
      stage2MinMacroF1: 0.80,
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

  // 3. Admin Account
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
  console.log(`Admin account created/updated: ${adminRegId}`);

  // 4. Default Seed Teams (REG-101 through REG-105)
  const defaultTeams = [
    { id: 'REG-101', name: 'Neural Knights', variantId: 1, pin: '1234' },
    { id: 'REG-102', name: 'Gradient Gurus', variantId: 2, pin: '1234' },
    { id: 'REG-103', name: 'Vector Voyagers', variantId: 3, pin: '1234' },
    { id: 'REG-104', name: 'Tensor Titans', variantId: 4, pin: '1234' },
    { id: 'REG-105', name: 'Deep Divers', variantId: 1, pin: '1234' },
  ];

  for (const dt of defaultTeams) {
    let team = await prisma.team.findUnique({ where: { name: dt.name } });
    if (!team) {
      team = await prisma.team.create({
        data: {
          name: dt.name,
          variantId: dt.variantId,
          progress: { create: {} },
        },
      });
    }

    const pinHash = await hashPin(dt.pin);
    await prisma.user.upsert({
      where: { registrationId: dt.id },
      update: { pinHash, teamId: team.id, displayName: dt.name },
      create: {
        registrationId: dt.id,
        displayName: dt.name,
        role: 'PARTICIPANT',
        pinHash,
        teamId: team.id,
      },
    });
  }

  console.log(`Seeded ${defaultTeams.length} participant teams.`);
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

