# SDC ML Challenge Platform — Complete Official Website Implementation

A secure, multi-stage machine learning competition platform designed for offline metric verification, real-time leaderboard tracking, participant identity management, and invigilator administration.

---

## 1. Architecture & Design Principles

```
React 19 Frontend (Vite + Tailwind CSS)
         │  (HttpOnly Session Cookies + CSRF Protection + Rate Limiting)
         ▼
Express API Backend (Node.js 22 LTS, Zod Validation, Helmet)
         │
         ├──► PostgreSQL 16 (Authoritative Database)
         │       • Participants with database-generated sequential web_id
         │       • Atomic score capping (0..150 points)
         │       • 4k Model Variant assignments & private ground truth metrics
         │       • Review decisions, approvals, and immutable audit history
         │
         └──► Protected Dataset & Boilerplate Storage
                 • train.csv, test.csv, linear_regression_boilerplate.py
                 • Variant-specific small_test.csv for Round 2 decoding
                 • Variant-specific Round 3 boilerplate (locked until admin release)
```

### Key Workflow Highlights
- **No Model Uploads / No Worker Containers**: Participants train models locally in VS Code, Jupyter, or Google Colab.
- **In-Person Verification**: Invigilators check locally computed metrics (MAE, RMSE, MSE) against reference benchmarks displayed in the admin panel and record approvals/rejections with a single click.
- **Point Structure (Max 150 pts)**:
  - **Round 1 (Linear Regression)**: 30 Points (Manual metric verification)
  - **Round 2 (Decode the Model)**: 50 Points (Automatic answer verification, unlimited attempts, no penalty)
  - **Round 3 (Assigned ML Model)**: 70 Points (Manual metric verification, boilerplate locked until admin release)

---

## 2. Competition Rounds & Rules

| Round | Challenge | Points | Verification Mode |
|---|---|---:|---|
| **Round 1** | **Linear Regression** | **30** | **Manual Metric Verification**: Participant trains locally on `train.csv`, calculates MAE, RMSE, and MSE. Invigilator compares against Round 1 reference values and approves via admin panel. |
| **Round 2** | **Decode the Model** | **50** | **Automatic Verification**: Predict on `small_test.csv`, convert predictions to ASCII characters, and solve the anagram. Verified case-insensitively on backend. Unlimited attempts without penalties. |
| **Round 3** | **Assigned ML Model Challenge** | **70** | **Manual Metric Verification**: "Now prove your model." Unlocked after Round 2, but boilerplate download is locked until an authorized admin explicitly releases it. Participant trains their assigned model (Random Forest, Decision Tree, Naive Bayes, or Gradient Boosting), calculates MAE, RMSE, and MSE, and shows them to an invigilator for final approval. |

---

## 3. Participant Authentication & 4k Variant Mapping

- **Registration Format**: `SDC-2026-XXX` (e.g. `SDC-2026-001`).
- **Sequential `web_id`**: Generated automatically by a PostgreSQL sequence (`@default(autoincrement())`). Safe under concurrency and row deletions (never uses `count + 1`).
- **Persistent State**: First login automatically registers the participant; returning participants retain their identical `web_id`, score, progress, and assigned model.
- **4k Variant Mapping Rule**:
  $$\text{variantId} = ((\text{web\_id} - 1) \pmod 4) + 1$$
  - $\text{web\_id} \equiv 1 \pmod 4 \implies$ **Variant 1: Random Forest Classifier**
  - $\text{web\_id} \equiv 2 \pmod 4 \implies$ **Variant 2: Decision Tree Classifier**
  - $\text{web\_id} \equiv 3 \pmod 4 \implies$ **Variant 3: Naive Bayes (GaussianNB)**
  - $\text{web\_id} \equiv 0 \pmod 4 \implies$ **Variant 4: Gradient Boosting Classifier**
- **Strict Privacy**: Internal variant IDs, mapping rules, and admin reference benchmarks are never sent to participant browsers. In Round 3, participants only see their assigned model name.

---

## 4. Admin Dashboard & Verification Workflow

1. **Round & Competition Control Center**:
   - Authorized admins can **Start Round**, **Pause Round**, **Resume Round**, and **End Round** with configurable duration (e.g. 60m, 45m, 30m, or custom).
   - Pausing freezes the remaining timer and temporarily halts verification requests; resuming restores submissions.
2. **Export Leaderboard & Participant Data (CSV)**:
   - One-click **Export CSV** button in the header and participant roster to export the complete leaderboard, rank, model assignments, round-by-round points, and verification timestamps.
3. **Pending Verifications Queue**:
   - High-priority table displaying participants awaiting manual metric verification.
   - Shows Web ID, Registration ID, round awaiting review, current score, and a "Review Candidate" action.
4. **Participant Detail Modal**:
   - Shows candidate Web ID, Registration ID, score, round-by-round status, and assigned model variant.
   - Displays authorized reference metrics for Round 1 and Round 3 (Admin Only).
   - Review controls: **Approve (+30 / +70 pts)**, **Reject**, with optional rejection reason and confirmation modal.
   - **Release Boilerplate Control**: Allows admin to release the Round 3 boilerplate once Round 2 is solved.
5. **Benchmark Management**:
   - Admin view & edit of Round 1 benchmarks (MAE, RMSE, MSE) and Round 3 variant benchmarks. Changes are recorded in audit logs.
6. **Audit Trail**:
   - Full history of admin actions, timestamps, actor identity, points awarded, and decisions.

---

## 5. Prerequisites & Local Setup

### Prerequisites
- **Node.js**: v22 LTS or newer
- **Docker**: Docker Desktop with PostgreSQL 16 container
- **Python**: 3.10+ (for local participant modeling)

### Step 1: Environment Configuration
Ensure `.env` in the project root contains:
```ini
NODE_ENV=development
POSTGRES_USER=mlc
POSTGRES_PASSWORD=change-me
POSTGRES_DB=mlchallenge
POSTGRES_PORT=55432
DATABASE_URL=postgresql://mlc:change-me@127.0.0.1:55432/mlchallenge?schema=public

PORT=5000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5000,http://127.0.0.1:5173,http://127.0.0.1:5000
SESSION_SECRET=super-secret-key-at-least-32-chars-long-for-security
COOKIE_SECURE=false

ADMIN_REGISTRATION_ID=ADMIN
ADMIN_PIN=AdminSecure123!
```

### Step 2: Start PostgreSQL Database
```powershell
docker compose up -d
```

### Step 3: Initialize Database Schema & Seed Data
```powershell
cd server
$env:DATABASE_URL="postgresql://mlc:change-me@127.0.0.1:55432/mlchallenge?schema=public"
.\node_modules\.bin\prisma.cmd db push
node --env-file=../.env --import tsx prisma/seed.ts
```

### Step 4: Run Application
To start both backend and frontend together:
```powershell
node start-dev.js
```
Or in separate terminals:
- **Backend API**:
  ```powershell
  cd server
  npm run dev
  ```
- **Frontend Client**:
  ```powershell
  cd client
  npm run dev
  ```

Frontend will be available at `http://localhost:5173`, API server at `http://localhost:5000`.

---

## 6. Default Credentials

- **Admin Account**:
  - Registration ID: `ADMIN`
  - Secret PIN: `AdminSecure123!` (or value configured in `.env`)
- **Participant Accounts**:
  - `SDC-2026-001` through `SDC-2026-005` (or enter any `SDC-2026-XXX` ID on first login)

---

## 7. Running Tests

Run the complete test suite:
```powershell
cd server
npm test
```
Runs 31 automated integration and unit tests covering authentication, participant persistence, 4k variant assignment, locked stages, answer checking, manual approvals, boilerplate release, benchmark privacy, and the live leaderboard.
