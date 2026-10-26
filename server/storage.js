import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.join(__dirname, 'data', 'state.json');

const INITIAL_BOILERPLATES = {
  1: `# Stage 2 - Variant A: Random Forest Classifier Boilerplate
# Problem: Sort parts into 26 sorting bins (ASCII 65-90)
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder

# 1. Load Data
train_df = pd.read_csv("stage2_train.csv")
test_df = pd.read_csv("stage2_test.csv")
TARGET = "sort_bin"

# 2. Feature Engineering
def engineer_features(df):
    d = df.copy()
    vol = (d["length_mm"] * d["width_mm"] * d["thickness_mm"]) / 1000.0
    d["density"] = d["weight_g"] / (vol + 1e-6)
    d["aspect_ratio"] = d["length_mm"] / (d["width_mm"] + 1e-6)
    d["thinness"] = d["thickness_mm"] / (d["width_mm"] + 1e-6)
    d["log_volume"] = np.log1p(vol)
    d["log_roughness"] = np.log1p(d["surface_roughness_um"])
    d["log_magnetic"] = np.log1p(d["magnetic_response_idx"])
    return d

X = engineer_features(train_df.drop(columns=["id", TARGET, "batch_number"]))
y = train_df[TARGET]
X_test = engineer_features(test_df.drop(columns=["id", "batch_number"]))

# 3. Pipelines & Model Training
cat_cols = ["material", "supplier", "coating", "line_id", "shift"]
num_cols = [c for c in X.columns if c not in cat_cols]

preprocessor = ColumnTransformer(
    transformers=[
        ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())]), num_cols),
        ("cat", Pipeline([("imp", SimpleImputer(strategy="most_frequent")), ("ohe", OneHotEncoder(handle_unknown="ignore"))]), cat_cols)
    ]
)

rf_model = Pipeline([
    ("preprocessor", preprocessor),
    ("classifier", RandomForestClassifier(n_estimators=150, max_depth=14, min_samples_split=4, random_state=42, n_jobs=-1))
])

rf_model.fit(X, y)

# 4. Predict & Save
predictions = rf_model.predict(X_test)
submission = pd.DataFrame({"id": test_df["id"], "prediction": predictions})
submission.to_csv("stage2_submission.csv", index=False)
print("Stage 2 Random Forest submission generated successfully!")
`,
  2: `# Stage 2 - Variant B: Decision Tree Classifier Boilerplate
# Problem: Sort parts into 26 sorting bins (ASCII 65-90)
import pandas as pd
import numpy as np
from sklearn.tree import DecisionTreeClassifier
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder

train_df = pd.read_csv("stage2_train.csv")
test_df = pd.read_csv("stage2_test.csv")
TARGET = "sort_bin"

def engineer_features(df):
    d = df.copy()
    vol = (d["length_mm"] * d["width_mm"] * d["thickness_mm"]) / 1000.0
    d["density"] = d["weight_g"] / (vol + 1e-6)
    d["aspect_ratio"] = d["length_mm"] / (d["width_mm"] + 1e-6)
    d["thinness"] = d["thickness_mm"] / (d["width_mm"] + 1e-6)
    d["log_volume"] = np.log1p(vol)
    return d

X = engineer_features(train_df.drop(columns=["id", TARGET, "batch_number"]))
y = train_df[TARGET]
X_test = engineer_features(test_df.drop(columns=["id", "batch_number"]))

cat_cols = ["material", "supplier", "coating", "line_id", "shift"]
num_cols = [c for c in X.columns if c not in cat_cols]

preprocessor = ColumnTransformer([
    ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())]), num_cols),
    ("cat", Pipeline([("imp", SimpleImputer(strategy="most_frequent")), ("ohe", OneHotEncoder(handle_unknown="ignore"))]), cat_cols)
])

dt_model = Pipeline([
    ("preprocessor", preprocessor),
    ("classifier", DecisionTreeClassifier(criterion="entropy", max_depth=12, min_samples_split=6, min_samples_leaf=2, random_state=42))
])

dt_model.fit(X, y)
predictions = dt_model.predict(X_test)
submission = pd.DataFrame({"id": test_df["id"], "prediction": predictions})
submission.to_csv("stage2_submission.csv", index=False)
print("Stage 2 Decision Tree submission generated successfully!")
`,
  3: `# Stage 2 - Variant C: Naive Bayes Boilerplate
# Problem: Sort parts into 26 sorting bins (ASCII 65-90)
import pandas as pd
import numpy as np
from sklearn.naive_bayes import GaussianNB
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import RobustScaler, OneHotEncoder

train_df = pd.read_csv("stage2_train.csv")
test_df = pd.read_csv("stage2_test.csv")
TARGET = "sort_bin"

def engineer_features(df):
    d = df.copy()
    vol = (d["length_mm"] * d["width_mm"] * d["thickness_mm"]) / 1000.0
    d["density"] = d["weight_g"] / (vol + 1e-6)
    d["log_vol"] = np.log1p(vol)
    return d

X = engineer_features(train_df.drop(columns=["id", TARGET, "batch_number"]))
y = train_df[TARGET]
X_test = engineer_features(test_df.drop(columns=["id", "batch_number"]))

cat_cols = ["material", "supplier", "coating", "line_id", "shift"]
num_cols = [c for c in X.columns if c not in cat_cols]

preprocessor = ColumnTransformer([
    ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", RobustScaler())]), num_cols),
    ("cat", Pipeline([("imp", SimpleImputer(strategy="most_frequent")), ("ohe", OneHotEncoder(handle_unknown="ignore", sparse_output=False))]), cat_cols)
])

nb_model = Pipeline([
    ("preprocessor", preprocessor),
    ("classifier", GaussianNB(var_smoothing=1e-3))
])

nb_model.fit(X, y)
predictions = nb_model.predict(X_test)
submission = pd.DataFrame({"id": test_df["id"], "prediction": predictions})
submission.to_csv("stage2_submission.csv", index=False)
print("Stage 2 Naive Bayes submission generated successfully!")
`,
  4: `# Stage 2 - Variant D: Gradient Boosting Classifier Boilerplate
# Problem: Sort parts into 26 sorting bins (ASCII 65-90)
import pandas as pd
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OrdinalEncoder

train_df = pd.read_csv("stage2_train.csv")
test_df = pd.read_csv("stage2_test.csv")
TARGET = "sort_bin"

def engineer_features(df):
    d = df.copy()
    vol = (d["length_mm"] * d["width_mm"] * d["thickness_mm"]) / 1000.0
    d["density"] = d["weight_g"] / (vol + 1e-6)
    d["aspect_ratio"] = d["length_mm"] / (d["width_mm"] + 1e-6)
    d["thinness"] = d["thickness_mm"] / (d["width_mm"] + 1e-6)
    d["log_volume"] = np.log1p(vol)
    d["log_roughness"] = np.log1p(d["surface_roughness_um"])
    d["log_magnetic"] = np.log1p(d["magnetic_response_idx"])
    return d

X = engineer_features(train_df.drop(columns=["id", TARGET, "batch_number"]))
y = train_df[TARGET]
X_test = engineer_features(test_df.drop(columns=["id", "batch_number"]))

cat_cols = ["material", "supplier", "coating", "line_id", "shift"]
num_cols = [c for c in X.columns if c not in cat_cols]

preprocessor = ColumnTransformer([
    ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("sc", StandardScaler())]), num_cols),
    ("cat", Pipeline([("imp", SimpleImputer(strategy="most_frequent")), ("ord", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1))]), cat_cols)
])

gb_model = Pipeline([
    ("preprocessor", preprocessor),
    ("classifier", HistGradientBoostingClassifier(max_iter=150, learning_rate=0.08, max_depth=8, random_state=42))
])

gb_model.fit(X, y)
predictions = gb_model.predict(X_test)
submission = pd.DataFrame({"id": test_df["id"], "prediction": predictions})
submission.to_csv("stage2_submission.csv", index=False)
print("Stage 2 Gradient Boosting submission generated successfully!")
`
};

export class Storage {
  constructor() {
    this.state = this.loadState();
  }

  loadState() {
    if (fs.existsSync(STATE_FILE)) {
      try {
        const raw = fs.readFileSync(STATE_FILE, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        console.error('Error reading state file, initializing fresh state:', err);
      }
    }
    return this.getInitialState();
  }

  saveState() {
    try {
      const dir = path.dirname(STATE_FILE);
      if (!fs.existsSync(dir)) fs.makedirsSync(dir, { recursive: true });
      fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving state:', err);
    }
  }

  getInitialState() {
    const now = Date.now();
    return {
      competition: {
        title: "Precision ML Sorting Line Challenge",
        durationMinutes: 90,
        startTime: now,
        endTime: now + 90 * 60 * 1000,
        status: "running", // "running", "paused", "ended"
        remainingSeconds: 90 * 60,
        stage1TargetAccuracy: 0.75,
        scoringRules: {
          stage1Points: 30,
          anagramPoints: 50,
          stage2Points: 70,
          penaltyPerWrongAnagram: 30,
          maxScore: 150
        }
      },
      variants: {
        1: {
          id: 1,
          label: "Variant A",
          hiddenModel: "RANDOM FOREST",
          shuffledLetters: "ADMFOERNOSRT",
          targetAccuracyStage1: 0.75,
          stage2Config: {
            targetAccuracy: 0.82,
            targetF1: 0.78,
            metricName: "Config A (Random Forest Baseline)"
          },
          boilerplate: INITIAL_BOILERPLATES[1]
        },
        2: {
          id: 2,
          label: "Variant B",
          hiddenModel: "DECISION TREE",
          shuffledLetters: "CREEOITIDSEN",
          targetAccuracyStage1: 0.75,
          stage2Config: {
            targetAccuracy: 0.70,
            targetF1: 0.65,
            metricName: "Config B (Decision Tree Baseline)"
          },
          boilerplate: INITIAL_BOILERPLATES[2]
        },
        3: {
          id: 3,
          label: "Variant C",
          hiddenModel: "NAIVE BAYES",
          shuffledLetters: "YVEAEASIBN",
          targetAccuracyStage1: 0.75,
          stage2Config: {
            targetAccuracy: 0.65,
            targetF1: 0.60,
            metricName: "Config C (Naive Bayes Baseline)"
          },
          boilerplate: INITIAL_BOILERPLATES[3]
        },
        4: {
          id: 4,
          label: "Variant D",
          hiddenModel: "GRADIENT BOOSTING",
          shuffledLetters: "GTNATINGOIODSRBE",
          targetAccuracyStage1: 0.75,
          stage2Config: {
            targetAccuracy: 0.84,
            targetF1: 0.80,
            metricName: "Config D (Gradient Boosting Baseline)"
          },
          boilerplate: INITIAL_BOILERPLATES[4]
        }
      },
      teams: [
        {
          id: "REG-101",
          name: "Neural Knights",
          pin: "1234",
          variantId: 1,
          stage1Qualified: true,
          stage1QualifiedAt: now - 35 * 60 * 1000,
          stage1Points: 30,
          anagramSolved: true,
          anagramSolvedAt: now - 22 * 60 * 1000,
          anagramPoints: 50,
          anagramIncorrectAttempts: 0,
          stage2Qualified: true,
          stage2QualifiedAt: now - 8 * 60 * 1000,
          stage2Points: 70,
          totalScore: 150,
          lastSubmissionAt: now - 8 * 60 * 1000
        },
        {
          id: "REG-102",
          name: "Gradient Gurus",
          pin: "1234",
          variantId: 2,
          stage1Qualified: true,
          stage1QualifiedAt: now - 40 * 60 * 1000,
          stage1Points: 30,
          anagramSolved: true,
          anagramSolvedAt: now - 25 * 60 * 1000,
          anagramPoints: 50,
          anagramIncorrectAttempts: 1,
          stage2Qualified: false,
          stage2QualifiedAt: null,
          stage2Points: 0,
          totalScore: 50, // (30 + 50) - 30 = 50
          lastSubmissionAt: now - 25 * 60 * 1000
        },
        {
          id: "REG-103",
          name: "Vector Voyagers",
          pin: "1234",
          variantId: 3,
          stage1Qualified: true,
          stage1QualifiedAt: now - 20 * 60 * 1000,
          stage1Points: 30,
          anagramSolved: false,
          anagramSolvedAt: null,
          anagramPoints: 0,
          anagramIncorrectAttempts: 0,
          stage2Qualified: false,
          stage2QualifiedAt: null,
          stage2Points: 0,
          totalScore: 30,
          lastSubmissionAt: now - 20 * 60 * 1000
        },
        {
          id: "REG-104",
          name: "Tensor Titans",
          pin: "1234",
          variantId: 4,
          stage1Qualified: false,
          stage1QualifiedAt: null,
          stage1Points: 0,
          anagramSolved: false,
          anagramSolvedAt: null,
          anagramPoints: 0,
          anagramIncorrectAttempts: 0,
          stage2Qualified: false,
          stage2QualifiedAt: null,
          stage2Points: 0,
          totalScore: 0,
          lastSubmissionAt: null
        },
        {
          id: "REG-105",
          name: "Deep Divers",
          pin: "1234",
          variantId: 1,
          stage1Qualified: false,
          stage1QualifiedAt: null,
          stage1Points: 0,
          anagramSolved: false,
          anagramSolvedAt: null,
          anagramPoints: 0,
          anagramIncorrectAttempts: 2, // made 2 wrong guesses earlier
          stage2Qualified: false,
          stage2QualifiedAt: null,
          stage2Points: 0,
          totalScore: 0, // bounded at 0
          lastSubmissionAt: null
        }
      ],
      submissions: [
        {
          id: "sub-seed-1",
          teamId: "REG-101",
          teamName: "Neural Knights",
          stage: 1,
          filename: "submission_stage1.csv",
          timestamp: now - 35 * 60 * 1000,
          status: "QUALIFIED",
          metrics: { accuracy: 1.0, correctCount: 12, totalCount: 12 },
          error: null
        },
        {
          id: "sub-seed-2",
          teamId: "REG-102",
          teamName: "Gradient Gurus",
          stage: 1,
          filename: "sub_stage1_v2.csv",
          timestamp: now - 40 * 60 * 1000,
          status: "QUALIFIED",
          metrics: { accuracy: 0.9167, correctCount: 11, totalCount: 12 },
          error: null
        },
        {
          id: "sub-seed-3",
          teamId: "REG-103",
          teamName: "Vector Voyagers",
          stage: 1,
          filename: "logistic_preds.csv",
          timestamp: now - 20 * 60 * 1000,
          status: "QUALIFIED",
          metrics: { accuracy: 0.9, correctCount: 9, totalCount: 10 },
          error: null
        },
        {
          id: "sub-seed-4",
          teamId: "REG-101",
          teamName: "Neural Knights",
          stage: 2,
          filename: "rf_stage2_final.csv",
          timestamp: now - 8 * 60 * 1000,
          status: "QUALIFIED",
          metrics: { accuracy: 0.885, macroF1: 0.852, correctCount: 354, totalCount: 400 },
          error: null
        }
      ],
      anagramAudit: [
        {
          teamId: "REG-102",
          teamName: "Gradient Gurus",
          guess: "RANDOM FOREST",
          isCorrect: false,
          penaltyApplied: 30,
          timestamp: now - 28 * 60 * 1000
        },
        {
          teamId: "REG-102",
          teamName: "Gradient Gurus",
          guess: "DECISION TREE",
          isCorrect: true,
          pointsAwarded: 50,
          timestamp: now - 25 * 60 * 1000
        },
        {
          teamId: "REG-101",
          teamName: "Neural Knights",
          guess: "RANDOM FOREST",
          isCorrect: true,
          pointsAwarded: 50,
          timestamp: now - 22 * 60 * 1000
        }
      ]
    };
  }

  calculateTotalScore(team) {
    const raw = (team.stage1Points || 0) + (team.anagramPoints || 0) + (team.stage2Points || 0) - (30 * (team.anagramIncorrectAttempts || 0));
    return Math.max(0, Math.min(150, raw));
  }

  getTeam(id) {
    return this.state.teams.find(t => t.id.toUpperCase() === id.toUpperCase());
  }

  getContestantSafeTeam(id) {
    const team = this.getTeam(id);
    if (!team) return null;

    // RULE: Before solving anagram, contestants MUST NOT see their variant label (A/B/C/D),
    // algorithm name, answer key, or other private configs!
    const safe = {
      id: team.id,
      name: team.name,
      stage1Qualified: team.stage1Qualified,
      stage1Points: team.stage1Points,
      anagramSolved: team.anagramSolved,
      anagramPoints: team.anagramPoints,
      anagramIncorrectAttempts: team.anagramIncorrectAttempts,
      stage2Qualified: team.stage2Qualified,
      stage2Points: team.stage2Points,
      totalScore: team.totalScore,
      lastSubmissionAt: team.lastSubmissionAt,
      // After correct anagram, provide unlocked boilerplate
      boilerplate: team.anagramSolved ? this.state.variants[team.variantId]?.boilerplate : null,
      algorithmName: team.anagramSolved ? this.state.variants[team.variantId]?.hiddenModel : null
    };

    return safe;
  }

  updateTeamScore(teamId) {
    const team = this.getTeam(teamId);
    if (team) {
      team.totalScore = this.calculateTotalScore(team);
      this.saveState();
    }
  }

  recordSubmission(sub) {
    this.state.submissions.unshift(sub);
    this.saveState();
  }

  recordAnagramAttempt(attempt) {
    this.state.anagramAudit.unshift(attempt);
    this.saveState();
  }

  getLeaderboard() {
    // Leaderboard sorted by totalScore DESC, then earliest lastSubmissionAt ASC
    return [...this.state.teams].map(team => ({
      id: team.id,
      name: team.name,
      stage1Qualified: team.stage1Qualified,
      stage1Points: team.stage1Points,
      anagramSolved: team.anagramSolved,
      anagramPoints: team.anagramPoints,
      anagramIncorrectAttempts: team.anagramIncorrectAttempts,
      penaltyPoints: team.anagramIncorrectAttempts * 30,
      stage2Qualified: team.stage2Qualified,
      stage2Points: team.stage2Points,
      totalScore: team.totalScore,
      lastSubmissionAt: team.lastSubmissionAt
    })).sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      // Tie breaker: qualified earlier
      if (a.lastSubmissionAt && b.lastSubmissionAt) {
        return a.lastSubmissionAt - b.lastSubmissionAt;
      }
      return a.lastSubmissionAt ? -1 : 1;
    });
  }

  isDeadlinePassed() {
    const comp = this.state.competition;
    if (comp.status === 'ended') return true;
    if (comp.status === 'running' && comp.endTime && Date.now() > comp.endTime) {
      comp.status = 'ended';
      this.saveState();
      return true;
    }
    return false;
  }
}

export const storage = new Storage();
