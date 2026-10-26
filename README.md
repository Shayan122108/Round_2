# ML Challenge Platform

A web platform for a timed (90-minute), multi-stage machine-learning competition built around the **Precision-Parts Sorting Line** dataset.

Teams train a model, decode their predictions into letters, solve an anagram to discover a hidden algorithm, and then use that algorithm in a final stage. Scores and a live leaderboard are managed by the server.

---

## How the competition works

| Stage | What teams do | Points |
|---|---|---|
| **1. Logistic Regression** | Train `LogisticRegression` on the shared `train.csv`, predict their own `test.csv`, and upload `id,prediction`. Qualify with ≥ 75% accuracy. | **+30** |
| **2. Anagram** | Predictions are ASCII codes (65–90). Decode them into letters and unscramble them into the name of an ML algorithm. | **+50** |
| **3. Final ML evaluation** | Use the discovered algorithm (starter code unlocks after the anagram) on the Stage 2 data. Must meet an accuracy and Macro-F1 target for that variant. | **+70** |
| Penalty | Each wrong anagram guess | **−30** |

`Total = Stage1 + Anagram + Stage2 − 30 × wrong guesses`, kept between **0 and 150**.
Leaderboard ties are broken by the earliest last qualifying submission.

### Variants

Every team is secretly assigned one of four test sets. Each set decodes to a different algorithm:

| Variant | Hidden algorithm | Rows | Scrambled letters |
|---|---|---|---|
| A (1) | RANDOM FOREST | 12 | `ADMFOERNOSRT` |
| B (2) | DECISION TREE | 12 | `CREEOITIDSEN` |
| C (3) | NAIVE BAYES | 10 | `YVEAEASIBN` |
| D (4) | GRADIENT BOOSTING | 16 | `GTNATINGOIODSRBE` |

Teams never see their variant label or algorithm name until they solve the anagram. The test file is always downloaded as `test.csv`.

---

## Tech stack

- **Client:** React 19 + Vite 8, Tailwind CSS v4, `lucide-react`, `canvas-confetti`
- **Server:** Node.js + Express 4, `multer` (file uploads), JSON file storage
- **Evaluation:** done in Node ([`server/evaluator.js`](server/evaluator.js))

## Project structure

```
ml-challenge-platform/
├── package.json            # Root scripts (dev / start / build)
├── start-dev.js            # Runs the server and the Vite dev server together
├── client/                 # React frontend
│   ├── vite.config.js      # Port 3000, proxies /api → localhost:5000
│   └── src/
│       ├── App.jsx
│       ├── index.css       # Design tokens + custom styles (in @layer components)
│       └── components/     # Navbar, Stage1Card, AnagramCard, Stage2Card,
│                           # Leaderboard, AdminPanel, modals, ...
└── server/
    ├── server.js           # REST API; also serves client/dist when it exists
    ├── storage.js          # State, scoring, seed data, starter code per variant
    ├── evaluator.js        # Stage 1 / Stage 2 scoring
    ├── python_worker.py    # Optional scikit-learn evaluator (not wired in yet)
    ├── uploads/            # Temporary upload folder
    └── data/
        ├── datasets/       # train.csv, variant_N/{test, sample_submission, clue_dataset}.csv, stage2/
        ├── answer_keys/    # ⚠ CONFIDENTIAL answer keys
        └── state.json      # Created at runtime: teams, scores, submissions, audit log
```

---

## Getting started

**Requirements:** Node.js 18+ (developed on Node 22).

```bash
# install dependencies
npm --prefix server install
npm --prefix client install
```

### Development (hot reload)

```bash
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:5000

### Production-style (single port)

```bash
npm run build:client   # builds client/dist
npm start              # Express serves the API and the built UI
```

Open http://localhost:5000.

Use the `PORT` environment variable to change the server port.

---

## Using the app

- **Dashboard:** the team's score summary, dataset downloads, and the three stage cards. Later stages unlock as earlier ones are completed.
- **Leaderboard:** top-3 podium and the full ranking table. Refreshes every 4 seconds.
- **Admin:** the confidential view. Includes team → variant mapping (can be reassigned), all four variant configs, competition clock (start / pause / reset), team registration, score reset, and audit logs for submissions and anagram guesses.

### Demo teams

The first time it runs, the server creates sample teams (PIN `1234`) in different states:

| ID | Team | Variant | State |
|---|---|---|---|
| REG-101 | Neural Knights | A | All stages cleared (150) |
| REG-102 | Gradient Gurus | B | Anagram solved after 1 wrong guess (50) |
| REG-103 | Vector Voyagers | C | Stage 1 qualified (30) |
| REG-104 | Tensor Titans | D | Not started (0) |
| REG-105 | Deep Divers | A | 2 wrong guesses (0) |

Use the team button in the top-right to switch teams.

**Start fresh for a real event:** stop the server, delete `server/data/state.json`, and restart. Or use **Admin → Reset Scores**, which keeps the teams but clears all progress.

### Submission format

```csv
id,prediction
P78165,65
P56216,68
...
```

For Stage 1, rows must be in the **same order as `test.csv`**. The order is what makes the decoded letters spell the word.

---

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Log in with `registrationId` (+ optional `pin`) |
| GET | `/api/team/:id` | Team state as the contestant sees it |
| GET | `/api/datasets/train` | Shared training set |
| GET | `/api/datasets/test/:teamId` | The team's assigned test set (served as `test.csv`) |
| GET | `/api/datasets/sample-submission/:teamId` | Sample submission |
| GET | `/api/datasets/clue-dataset/:teamId` | Clue CSV (requires Stage 1) |
| GET | `/api/datasets/stage2/{train,test}` | Stage 2 data |
| POST | `/api/submissions/stage1` | Upload a Stage 1 CSV (`file` or `csvContent`, plus `teamId`) |
| POST | `/api/anagram/submit` | `{ teamId, answer }`. Spaces, case and punctuation are ignored |
| POST | `/api/submissions/stage2` | Upload a Stage 2 CSV (requires the solved anagram) |
| GET | `/api/leaderboard` | Rankings + competition clock |
| GET | `/api/admin/overview` | Confidential admin data |
| POST | `/api/admin/timer` | `{ action: start \| pause \| reset, durationMinutes }` |
| POST | `/api/admin/teams` | Register a team |
| POST | `/api/admin/teams/:id/reassign-variant` | Change a team's variant |
| POST | `/api/admin/variants/:id` | Update variant targets / starter code |
| POST | `/api/admin/reset-scores` | Clear all progress |

---

## ⚠ Known limitations (read before a live event)

- **No admin authentication.** Anyone who can reach the server can open the Admin tab and `/api/admin/*`, which expose every team's hidden algorithm. Add authentication, or run the server only on a trusted network, before contestants connect.
- **PINs are optional.** The login and team switcher do not require a PIN. The quick-switch list is meant for demos only.
- **Stage 2 data is a placeholder.** `stage2_train.csv` and `stage2_test.csv` are a 1200/400 split of the Stage 1 `train.csv`. Teams already hold the labels for the Stage 2 test rows. Replace these files with a real held-out dataset.
- **The clue dataset shows the target.** Each clue row includes `sort_bin` and an `observed_resonance_char` column. Teams already know their letters after Stage 1, but review whether this gives away more than you want.
- **Answer keys live in the repo.** `server/data/answer_keys/` and `server/data/datasets/variant_*` should not be shared with contestants or pushed to a public repository.
- **JSON file storage.** Fine for a single server process. Use a real database if several server instances will run at once.
- **Clock pause/resume** is basic. "Start" restarts the full duration instead of resuming the remaining time.

---

## Related files (parent folder)

- `ORGANIZER_GUIDE.md`: confidential organizer notes (variants, fairness, leak prevention)
- `PARTICIPANT_INSTRUCTIONS.md`: instructions handed to teams
- `baseline_solution.py` / `validate_answer.py`: reference solution and answer validation
