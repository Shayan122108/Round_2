# ML Challenge Platform — Round 2 Production Implementation

Complete, secure, multi-stage machine learning competition platform.

---

## 1. Architecture Overview

```
React 19 Frontend (Vite + Tailwind CSS v4)
         │  (Secure session cookie + CSRF token + Origin validation)
         ▼
Express API Backend (Node.js 22 LTS, Zod validation, Helmet, Rate Limiter)
         │
         ├──► PostgreSQL 16 (Authoritative State, Foreign Keys, Row-Level Locks)
         │       • Participants, Teams, Variants (private metadata)
         │       • Submissions (durable records before enqueueing)
         │       • Stage Completions (unique constraints preventing double awards)
         │       • Atomic Anagram Penalties (30-point deduction, score clamped 0..150)
         │
         ├──► Redis 7 & BullMQ
         │       • Asynchronous evaluation queue with bounded concurrency
         │       • Automated recovery loop for unqueued/stale evaluations
         │
         └──► Isolated Python 3.11 Evaluation Worker
                 • Docker sandbox (`mlc-sandbox:1`) with `--network none`, non-root user (65534:65534), read-only mounts, memory (1GB) and CPU limits
                 • Untrusted `.joblib` pipelines evaluated ONLY against test features
                 • Private reference labels & answer keys NEVER mounted in the container
                 • Trusted scoring service computes authoritative metrics (Accuracy, Macro F1)
```

---

## 2. Competition Rules & Stages

1. **Stage 1 — Logistic Regression Challenge**:
   - Participants download `train.csv` (1,600 precision parts) and helper script `challenge_features.py`.
   - Participants train a `scikit-learn` `LogisticRegression` pipeline and upload `model.joblib`.
   - Worker evaluates against private test features; meeting the 75% accuracy threshold awards **30 points** (once).
2. **Anagram Challenge**:
   - Unlocked only after qualifying Stage 1.
   - Shows scrambled letters (`variant_map.csv`) and allows preview/download of personalized `clue_dataset.csv`.
   - Each incorrect attempt deducts an atomic **30-point penalty**. Total score is clamped to **0–150**.
   - Correct answer awards **50 points** and unlocks Stage 2 dataset & starter boilerplate.
3. **Stage 2 — Secret Variant ML Benchmark**:
   - Accessible only after solving the anagram.
   - Participants train their unlocked algorithm (`RandomForestClassifier`, `DecisionTreeClassifier`, `GaussianNB`, or `HistGradientBoostingClassifier`) on `stage2_train.csv`.
   - Qualifying awards **70 points** (once). Maximum total score: **150 points**.

---

## 3. Local Development & Deployment (Windows & Docker)

### Prerequisites
- Node.js 22 LTS
- Python 3.11 (with `scikit-learn==1.6.1`, `pandas`, `numpy`, `joblib`)
- Docker Desktop (with WSL2 backend enabled)

### Step 1: Environment Configuration
Copy `.env.example` to `.env`:
```powershell
cp .env.example .env
```

Ensure `.env` contains:
```ini
NODE_ENV=development
POSTGRES_PORT=55432
DATABASE_URL=postgresql://mlc:mlc_dev_password@127.0.0.1:55432/mlchallenge?schema=public
REDIS_PORT=56379
REDIS_URL=redis://127.0.0.1:56379
SESSION_SECRET=replace-with-long-random-string-at-least-32-chars
PORT=5000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5000,http://localhost:3000
SANDBOX_MODE=docker
SANDBOX_IMAGE=mlc-sandbox:1
ALLOW_COMPROMISED_EVAL_DATA=1
```

### Step 2: Start Infrastructure (PostgreSQL & Redis)
```powershell
docker compose up -d --wait
```

### Step 3: Build the Python Evaluation Sandbox Image
```powershell
docker build -t mlc-sandbox:1 ./sandbox
```

### Step 4: Import & Verify Competition Datasets
```powershell
python scripts/import_datasets.py
```
*Note: Evaluates train/test schemas, checks 26 ASCII classes (65-90), verifies anagram multisets, and imports datasets to private server storage.*

### Step 5: Database Setup & Seed
```powershell
cd server
node --env-file=.env node_modules\prisma\build\index.js db push
node --env-file=.env --import tsx prisma/seed.ts
```

### Step 6: Start Server, Worker & Frontend
In separate terminals:
- **API Server**:
  ```powershell
  cd server
  npm run dev
  ```
- **BullMQ Python Worker**:
  ```powershell
  cd server
  npm run worker
  ```
- **React Frontend**:
  ```powershell
  cd client
  npm run dev
  ```

---

## 4. Default Seed Accounts

- **Participant Teams**:
  - `REG-101` / PIN: `1234` (Neural Knights — Variant 1: Random Forest)
  - `REG-102` / PIN: `1234` (Gradient Gurus — Variant 2: Decision Tree)
  - `REG-103` / PIN: `1234` (Vector Voyagers — Variant 3: Naive Bayes)
  - `REG-104` / PIN: `1234` (Tensor Titans — Variant 4: Gradient Boosting)
  - `REG-105` / PIN: `1234` (Deep Divers — Variant 1)
- **Administrator**:
  - `ADMIN` / PIN: `AdminSecure123!` (or the PIN configured in your `.env`)

---

## 5. Security & Isolation Controls

1. **Pickle / Joblib Execution Isolation**: Untrusted `.joblib` models run inside unprivileged Docker containers (`--network none`, `--cap-drop ALL`, `--read-only`, non-root user `65534`). Ground-truth labels and answer keys are never placed in the container.
2. **Authoritative Scores**: Evaluator metrics and scores are computed exclusively in trusted Node.js code wrapped in PostgreSQL transactions with `SELECT ... FOR UPDATE` row locks.
3. **Defense Against Answer Key Leaks**: Ground-truth answer keys from public repository history are tagged in `dataset_manifest.json`. Organizers can provide fresh holdouts via `python scripts/import_datasets.py --private-dir <dir>` prior to a live competition.
4. **Cookie Authentication & Anti-CSRF**: Session tokens are encrypted in secure `httpOnly` cookies with `SameSite=Strict`. Mutating endpoints require `X-CSRF-Token` validation matching the session.
