import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { storage } from './storage.js';
import { evaluateStage1Submission, evaluateStage2Submission } from './evaluator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure upload
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

// Helper: Normalize string for comparison
function normalizeName(str) {
  return (str || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ==========================================
// 1. AUTHENTICATION & TEAM LOOKUP
// ==========================================

app.post('/api/auth/login', (req, res) => {
  const { registrationId, pin } = req.body;
  if (!registrationId) {
    return res.status(400).json({ error: 'Registration ID is required.' });
  }

  const team = storage.getTeam(registrationId.trim());
  if (!team) {
    return res.status(404).json({ error: `Team with Registration ID '${registrationId}' was not found. Please check your ID or contact the event admin.` });
  }

  if (pin && team.pin && pin !== team.pin) {
    return res.status(401).json({ error: 'Invalid PIN.' });
  }

  // Return safe team view (NO variant label, NO hidden algorithm disclosure)
  const safeTeam = storage.getContestantSafeTeam(team.id);
  res.json({
    success: true,
    team: safeTeam,
    competition: {
      status: storage.state.competition.status,
      durationMinutes: storage.state.competition.durationMinutes,
      startTime: storage.state.competition.startTime,
      endTime: storage.state.competition.endTime,
      isDeadlinePassed: storage.isDeadlinePassed()
    }
  });
});

app.get('/api/team/:id', (req, res) => {
  const safeTeam = storage.getContestantSafeTeam(req.params.id);
  if (!safeTeam) {
    return res.status(404).json({ error: 'Team not found.' });
  }
  res.json({
    team: safeTeam,
    competition: {
      status: storage.state.competition.status,
      durationMinutes: storage.state.competition.durationMinutes,
      startTime: storage.state.competition.startTime,
      endTime: storage.state.competition.endTime,
      isDeadlinePassed: storage.isDeadlinePassed()
    }
  });
});

// ==========================================
// 2. DATASET SERVICE (SECURE SERVING)
// ==========================================

// Shared training dataset (1,600 rows)
app.get('/api/datasets/train', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'datasets', 'train.csv');
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Training dataset not found.' });
  }
  res.setHeader('Content-Disposition', 'attachment; filename="train.csv"');
  res.setHeader('Content-Type', 'text/csv');
  res.sendFile(filePath);
});

// Team-assigned test dataset (Silently mapped, handed out as "test.csv")
app.get('/api/datasets/test/:teamId', (req, res) => {
  const team = storage.getTeam(req.params.teamId);
  if (!team) {
    return res.status(404).json({ error: 'Team not found.' });
  }

  const vId = team.variantId;
  const filePath = path.join(__dirname, 'data', 'datasets', `variant_${vId}`, 'test.csv');
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Test set for variant not found.' });
  }
  res.setHeader('Content-Disposition', 'attachment; filename="test.csv"');
  res.setHeader('Content-Type', 'text/csv');
  res.sendFile(filePath);
});

// Sample submission format
app.get('/api/datasets/sample-submission/:teamId', (req, res) => {
  const team = storage.getTeam(req.params.teamId);
  if (!team) return res.status(404).json({ error: 'Team not found.' });

  const vId = team.variantId;
  const filePath = path.join(__dirname, 'data', 'datasets', `variant_${vId}`, 'sample_submission.csv');
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Sample submission not found.' });
  }
  res.setHeader('Content-Disposition', 'attachment; filename="sample_submission.csv"');
  res.setHeader('Content-Type', 'text/csv');
  res.sendFile(filePath);
});

// Personalized clue dataset (Unlocks only AFTER Stage 1 qualification)
app.get('/api/datasets/clue-dataset/:teamId', (req, res) => {
  const team = storage.getTeam(req.params.teamId);
  if (!team) return res.status(404).json({ error: 'Team not found.' });

  if (!team.stage1Qualified) {
    return res.status(403).json({ error: 'Access denied: You must qualify Stage 1 to unlock your personalized clue dataset.' });
  }

  const vId = team.variantId;
  const filePath = path.join(__dirname, 'data', 'datasets', `variant_${vId}`, `clue_dataset_variant_${vId}.csv`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Clue dataset not found.' });
  }
  res.setHeader('Content-Disposition', `attachment; filename="clue_dataset.csv"`);
  res.setHeader('Content-Type', 'text/csv');
  res.sendFile(filePath);
});

// Get clue dataset preview for dashboard
app.get('/api/datasets/clue-preview/:teamId', (req, res) => {
  const team = storage.getTeam(req.params.teamId);
  if (!team) return res.status(404).json({ error: 'Team not found.' });
  if (!team.stage1Qualified) {
    return res.status(403).json({ error: 'Stage 1 qualification required.' });
  }

  const vId = team.variantId;
  const filePath = path.join(__dirname, 'data', 'datasets', `variant_${vId}`, `clue_dataset_variant_${vId}.csv`);
  if (!fs.existsSync(filePath)) return res.json({ samples: [] });

  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  const samples = lines.slice(1, 16).map(line => {
    const vals = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i]);
    return obj;
  });

  res.json({
    totalRows: lines.length - 1,
    headers,
    preview: samples
  });
});

// Stage 2 datasets
app.get('/api/datasets/stage2/train', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'datasets', 'stage2', 'stage2_train.csv');
  res.setHeader('Content-Disposition', 'attachment; filename="stage2_train.csv"');
  res.setHeader('Content-Type', 'text/csv');
  res.sendFile(filePath);
});

app.get('/api/datasets/stage2/test', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'datasets', 'stage2', 'stage2_test.csv');
  res.setHeader('Content-Disposition', 'attachment; filename="stage2_test.csv"');
  res.setHeader('Content-Type', 'text/csv');
  res.sendFile(filePath);
});

// ==========================================
// 3. STAGE 1 SUBMISSION & EVALUATION
// ==========================================

app.post('/api/submissions/stage1', upload.single('file'), (req, res) => {
  const teamId = req.body.teamId;
  const team = storage.getTeam(teamId);
  if (!team) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'Team not found.' });
  }

  if (storage.isDeadlinePassed()) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: 'Submission rejected: 90-minute competition deadline has passed.' });
  }

  let csvContent = '';
  let filename = 'submission.csv';

  if (req.file) {
    csvContent = fs.readFileSync(req.file.path, 'utf-8');
    filename = req.file.originalname;
    fs.unlinkSync(req.file.path); // Clean up upload
  } else if (req.body.csvContent) {
    csvContent = req.body.csvContent;
    filename = req.body.filename || 'manual_submission.csv';
  } else {
    return res.status(400).json({ error: 'Please upload a CSV file or provide submission CSV content.' });
  }

  const vId = team.variantId;
  const variantConfig = storage.state.variants[vId];
  const targetAcc = variantConfig?.targetAccuracyStage1 || storage.state.competition.stage1TargetAccuracy || 0.75;

  try {
    const evalResult = evaluateStage1Submission(csvContent, vId, targetAcc);
    const now = Date.now();
    let newlyQualified = false;

    if (evalResult.passed) {
      if (!team.stage1Qualified) {
        team.stage1Qualified = true;
        team.stage1QualifiedAt = now;
        team.stage1Points = 30; // 30 points awarded once
        newlyQualified = true;
      }
      team.lastSubmissionAt = now;
      storage.updateTeamScore(team.id);
    }

    const subRecord = {
      id: uuidv4(),
      teamId: team.id,
      teamName: team.name,
      stage: 1,
      filename,
      timestamp: now,
      status: evalResult.passed ? 'QUALIFIED' : 'NOT_QUALIFIED',
      metrics: evalResult.metrics,
      error: null
    };
    storage.recordSubmission(subRecord);

    res.json({
      success: true,
      passed: evalResult.passed,
      newlyQualified,
      metrics: evalResult.metrics,
      detailedBreakdown: evalResult.detailedBreakdown,
      team: storage.getContestantSafeTeam(team.id)
    });
  } catch (err) {
    const errorRecord = {
      id: uuidv4(),
      teamId: team.id,
      teamName: team.name,
      stage: 1,
      filename,
      timestamp: Date.now(),
      status: 'ERROR',
      metrics: null,
      error: err.message
    };
    storage.recordSubmission(errorRecord);

    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// ==========================================
// 4. ANAGRAM CHALLENGE & BOILERPLATE UNLOCK
// ==========================================

app.post('/api/anagram/submit', (req, res) => {
  const { teamId, answer } = req.body;
  const team = storage.getTeam(teamId);
  if (!team) return res.status(404).json({ error: 'Team not found.' });

  if (storage.isDeadlinePassed()) {
    return res.status(403).json({ error: 'Deadline passed.' });
  }

  if (!team.stage1Qualified) {
    return res.status(403).json({ error: 'You must qualify Stage 1 before attempting the Anagram challenge.' });
  }

  if (team.anagramSolved) {
    return res.json({
      success: true,
      alreadySolved: true,
      message: 'Algorithm already solved and verified!',
      boilerplate: storage.state.variants[team.variantId]?.boilerplate,
      algorithmName: storage.state.variants[team.variantId]?.hiddenModel,
      team: storage.getContestantSafeTeam(team.id)
    });
  }

  if (!answer || !answer.trim()) {
    return res.status(400).json({ error: 'Please enter an algorithm name.' });
  }

  const vId = team.variantId;
  const variant = storage.state.variants[vId];
  const expectedNormalized = normalizeName(variant.hiddenModel);
  const submittedNormalized = normalizeName(answer);

  const now = Date.now();
  const isCorrect = submittedNormalized === expectedNormalized;

  if (isCorrect) {
    team.anagramSolved = true;
    team.anagramSolvedAt = now;
    team.anagramPoints = 50; // 50 points awarded once
    team.lastSubmissionAt = now;
    storage.updateTeamScore(team.id);

    storage.recordAnagramAttempt({
      teamId: team.id,
      teamName: team.name,
      guess: answer.trim(),
      isCorrect: true,
      pointsAwarded: 50,
      timestamp: now
    });

    return res.json({
      success: true,
      correct: true,
      message: `Brilliant! You correctly decoded the hidden algorithm: ${variant.hiddenModel}! 50 points awarded.`,
      boilerplate: variant.boilerplate,
      algorithmName: variant.hiddenModel,
      team: storage.getContestantSafeTeam(team.id)
    });
  } else {
    // WRONG ANSWER: Atomically add 1 incorrect attempt (-30 points penalty)
    team.anagramIncorrectAttempts = (team.anagramIncorrectAttempts || 0) + 1;
    storage.updateTeamScore(team.id);

    storage.recordAnagramAttempt({
      teamId: team.id,
      teamName: team.name,
      guess: answer.trim(),
      isCorrect: false,
      penaltyApplied: 30,
      timestamp: now
    });

    const penaltyCount = team.anagramIncorrectAttempts;
    const totalPenalty = penaltyCount * 30;

    return res.json({
      success: true,
      correct: false,
      message: `Incorrect guess '${answer.trim()}'. A 30-point penalty has been applied to your round score.`,
      incorrectAttempts: penaltyCount,
      penaltyPoints: totalPenalty,
      remainingPossibleScore: Math.max(0, 150 - totalPenalty),
      team: storage.getContestantSafeTeam(team.id)
    });
  }
});

// ==========================================
// 5. STAGE 2 FINAL ML EVALUATION
// ==========================================

app.post('/api/submissions/stage2', upload.single('file'), (req, res) => {
  const teamId = req.body.teamId;
  const team = storage.getTeam(teamId);
  if (!team) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'Team not found.' });
  }

  if (storage.isDeadlinePassed()) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: 'Competition deadline has passed.' });
  }

  if (!team.anagramSolved) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: 'You must solve the Anagram and unlock the model boilerplate before submitting to Stage 2.' });
  }

  let csvContent = '';
  let filename = 'stage2_submission.csv';

  if (req.file) {
    csvContent = fs.readFileSync(req.file.path, 'utf-8');
    filename = req.file.originalname;
    fs.unlinkSync(req.file.path);
  } else if (req.body.csvContent) {
    csvContent = req.body.csvContent;
    filename = req.body.filename || 'manual_stage2_submission.csv';
  } else {
    return res.status(400).json({ error: 'Please upload a CSV file or provide submission content.' });
  }

  const vId = team.variantId;
  const variant = storage.state.variants[vId];
  const targetConfig = variant?.stage2Config || { targetAccuracy: 0.70, targetF1: 0.65 };

  try {
    const evalResult = evaluateStage2Submission(csvContent, vId, targetConfig);
    const now = Date.now();
    let newlyQualified = false;

    if (evalResult.passed) {
      if (!team.stage2Qualified) {
        team.stage2Qualified = true;
        team.stage2QualifiedAt = now;
        team.stage2Points = 70; // 70 points awarded once
        newlyQualified = true;
      }
      team.lastSubmissionAt = now;
      storage.updateTeamScore(team.id);
    }

    const subRecord = {
      id: uuidv4(),
      teamId: team.id,
      teamName: team.name,
      stage: 2,
      filename,
      timestamp: now,
      status: evalResult.passed ? 'QUALIFIED' : 'NOT_QUALIFIED',
      metrics: evalResult.metrics,
      error: null
    };
    storage.recordSubmission(subRecord);

    res.json({
      success: true,
      passed: evalResult.passed,
      newlyQualified,
      metrics: evalResult.metrics,
      team: storage.getContestantSafeTeam(team.id)
    });
  } catch (err) {
    const errorRecord = {
      id: uuidv4(),
      teamId: team.id,
      teamName: team.name,
      stage: 2,
      filename,
      timestamp: Date.now(),
      status: 'ERROR',
      metrics: null,
      error: err.message
    };
    storage.recordSubmission(errorRecord);

    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

// ==========================================
// 6. LIVE LEADERBOARD
// ==========================================

app.get('/api/leaderboard', (req, res) => {
  const leaderboard = storage.getLeaderboard();
  res.json({
    leaderboard,
    competition: {
      status: storage.state.competition.status,
      durationMinutes: storage.state.competition.durationMinutes,
      startTime: storage.state.competition.startTime,
      endTime: storage.state.competition.endTime,
      isDeadlinePassed: storage.isDeadlinePassed()
    }
  });
});

// ==========================================
// 7. ADMIN PANEL APIS
// ==========================================

app.get('/api/admin/overview', (req, res) => {
  // Returns confidential view: full team info WITH assigned variants, answer keys, live scores
  const teamsWithVariants = storage.state.teams.map(t => {
    const v = storage.state.variants[t.variantId];
    return {
      ...t,
      variantLabel: v?.label || `Variant ${t.variantId}`,
      hiddenAlgorithm: v?.hiddenModel,
      shuffledLetters: v?.shuffledLetters
    };
  });

  res.json({
    competition: storage.state.competition,
    variants: storage.state.variants,
    teams: teamsWithVariants,
    submissionsCount: storage.state.submissions.length,
    recentSubmissions: storage.state.submissions.slice(0, 50),
    anagramAudit: storage.state.anagramAudit.slice(0, 50)
  });
});

app.post('/api/admin/timer', (req, res) => {
  const { action, durationMinutes } = req.body;
  const comp = storage.state.competition;
  const now = Date.now();

  if (action === 'start' || action === 'resume') {
    const durationMs = (durationMinutes || comp.durationMinutes || 90) * 60 * 1000;
    comp.status = 'running';
    comp.startTime = now;
    comp.endTime = now + durationMs;
  } else if (action === 'pause') {
    comp.status = 'paused';
    if (comp.endTime) {
      comp.remainingSeconds = Math.max(0, Math.floor((comp.endTime - now) / 1000));
    }
  } else if (action === 'reset') {
    comp.durationMinutes = durationMinutes || 90;
    comp.status = 'running';
    comp.startTime = now;
    comp.endTime = now + comp.durationMinutes * 60 * 1000;
  }
  storage.saveState();
  res.json({ success: true, competition: comp });
});

app.post('/api/admin/variants/:id', (req, res) => {
  const vId = parseInt(req.params.id, 10);
  const variant = storage.state.variants[vId];
  if (!variant) return res.status(404).json({ error: 'Variant not found.' });

  const { targetAccuracyStage1, stage2Config, boilerplate, hiddenModel, shuffledLetters } = req.body;
  if (targetAccuracyStage1 !== undefined) variant.targetAccuracyStage1 = parseFloat(targetAccuracyStage1);
  if (stage2Config) variant.stage2Config = { ...variant.stage2Config, ...stage2Config };
  if (boilerplate !== undefined) variant.boilerplate = boilerplate;
  if (hiddenModel !== undefined) variant.hiddenModel = hiddenModel;
  if (shuffledLetters !== undefined) variant.shuffledLetters = shuffledLetters;

  storage.saveState();
  res.json({ success: true, variant });
});

app.post('/api/admin/teams', (req, res) => {
  const { id, name, variantId, pin } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'ID and Name required.' });

  const existing = storage.getTeam(id);
  if (existing) return res.status(400).json({ error: 'Team ID already exists.' });

  const newTeam = {
    id: id.trim(),
    name: name.trim(),
    pin: pin || '1234',
    variantId: parseInt(variantId || 1, 10),
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
  };

  storage.state.teams.push(newTeam);
  storage.saveState();
  res.json({ success: true, team: newTeam });
});

app.post('/api/admin/teams/:id/reassign-variant', (req, res) => {
  const team = storage.getTeam(req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found.' });
  const { variantId } = req.body;
  team.variantId = parseInt(variantId, 10);
  storage.saveState();
  res.json({ success: true, team });
});

app.post('/api/admin/reset-scores', (req, res) => {
  storage.state.teams.forEach(t => {
    t.stage1Qualified = false;
    t.stage1QualifiedAt = null;
    t.stage1Points = 0;
    t.anagramSolved = false;
    t.anagramSolvedAt = null;
    t.anagramPoints = 0;
    t.anagramIncorrectAttempts = 0;
    t.stage2Qualified = false;
    t.stage2QualifiedAt = null;
    t.stage2Points = 0;
    t.totalScore = 0;
    t.lastSubmissionAt = null;
  });
  storage.state.submissions = [];
  storage.state.anagramAudit = [];
  storage.saveState();
  res.json({ success: true, message: 'Competition scores and submissions reset.' });
});

// Serve client dist if available
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`ML Challenge Platform Server running on port ${PORT}`);
});
