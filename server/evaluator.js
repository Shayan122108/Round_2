import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function parseCSV(content) {
  const lines = content.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must contain a header and at least one row of data.');
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  const idIdx = headers.indexOf('id');
  const predIdx = headers.indexOf('prediction');

  if (idIdx === -1 || predIdx === -1) {
    throw new Error("Missing required headers: CSV must contain 'id' and 'prediction' columns.");
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.trim().replace(/['"]/g, ''));
    if (parts.length >= 2) {
      const id = parts[idIdx];
      const rawPred = parts[predIdx];
      const pred = parseInt(rawPred, 10);
      if (isNaN(pred)) {
        throw new Error(`Row ${i} (ID: ${id}) has invalid non-numeric prediction: '${rawPred}'`);
      }
      rows.push({ id, prediction: pred });
    }
  }
  return rows;
}

export function loadAnswerKey(variantId) {
  const akPath = path.join(__dirname, 'data', 'answer_keys', `answer_key_variant_${variantId}.csv`);
  if (!fs.existsSync(akPath)) {
    throw new Error(`Answer key for variant ${variantId} not found.`);
  }
  const content = fs.readFileSync(akPath, 'utf-8');
  const lines = content.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
  const headers = lines[0].split(',').map(h => h.trim());
  
  const idIdx = headers.indexOf('id');
  const predIdx = headers.indexOf('correct_prediction');
  const charIdx = headers.indexOf('ascii_character');

  const keyMap = new Map();
  const keyList = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const id = cols[idIdx];
    const correct = parseInt(cols[predIdx], 10);
    const char = cols[charIdx] || String.fromCharCode(correct);
    keyMap.set(id, { correct, char, index: i - 1 });
    keyList.push({ id, correct, char });
  }

  return { keyMap, keyList };
}

export function evaluateStage1Submission(csvContent, variantId, targetAccuracy = 0.75) {
  const rows = parseCSV(csvContent);
  const { keyMap, keyList } = loadAnswerKey(variantId);

  if (rows.length !== keyList.length) {
    throw new Error(`Row count mismatch: expected ${keyList.length} predictions for Variant test set, but received ${rows.length}.`);
  }

  let correctCount = 0;
  const decodedChars = [];
  const detailedBreakdown = [];

  for (let i = 0; i < keyList.length; i++) {
    const expected = keyList[i];
    const submitted = rows[i];

    // Check ID alignment
    if (submitted.id !== expected.id) {
      throw new Error(`Row order or ID mismatch at row ${i + 1}: expected ID '${expected.id}' but got '${submitted.id}'. Predictions must strictly follow test.csv row order.`);
    }

    const isMatch = submitted.prediction === expected.correct;
    if (isMatch) correctCount++;

    const char = (submitted.prediction >= 65 && submitted.prediction <= 90)
      ? String.fromCharCode(submitted.prediction)
      : '?';

    decodedChars.push(char);
    detailedBreakdown.push({
      row: i + 1,
      id: submitted.id,
      predictedCode: submitted.prediction,
      decodedChar: char,
      isCorrect: isMatch
    });
  }

  const accuracy = correctCount / keyList.length;
  const passed = accuracy >= targetAccuracy;
  const decodedString = decodedChars.join('');

  return {
    stage: 1,
    passed,
    metrics: {
      accuracy: parseFloat(accuracy.toFixed(4)),
      correctCount,
      totalCount: keyList.length,
      targetAccuracy: parseFloat(targetAccuracy.toFixed(4)),
      decodedString
    },
    detailedBreakdown
  };
}

export function evaluateStage2Submission(csvContent, variantId, targetConfig) {
  const rows = parseCSV(csvContent);
  const s2KeyPath = path.join(__dirname, 'data', 'answer_keys', 'stage2_answer_key.csv');
  if (!fs.existsSync(s2KeyPath)) {
    throw new Error('Stage 2 answer key file not found.');
  }

  const content = fs.readFileSync(s2KeyPath, 'utf-8');
  const lines = content.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
  const keyMap = new Map();
  for (let i = 1; i < lines.length; i++) {
    const [id, correct] = lines[i].split(',').map(c => c.trim());
    keyMap.set(id, parseInt(correct, 10));
  }

  if (rows.length !== keyMap.size) {
    throw new Error(`Row count mismatch: expected ${keyMap.size} predictions for Stage 2 test set, but received ${rows.length}.`);
  }

  let correct = 0;
  const perClass = {};

  for (const row of rows) {
    const groundTruth = keyMap.get(row.id);
    if (groundTruth === undefined) {
      throw new Error(`Unknown test ID: ${row.id}`);
    }

    if (!perClass[groundTruth]) {
      perClass[groundTruth] = { tp: 0, fp: 0, fn: 0, total: 0 };
    }
    perClass[groundTruth].total++;

    if (row.prediction === groundTruth) {
      correct++;
      perClass[groundTruth].tp++;
    } else {
      perClass[groundTruth].fn++;
      if (!perClass[row.prediction]) {
        perClass[row.prediction] = { tp: 0, fp: 0, fn: 0, total: 0 };
      }
      perClass[row.prediction].fp++;
    }
  }

  const accuracy = correct / rows.length;

  // Calculate Macro F1
  let sumF1 = 0;
  let classesWithData = 0;
  for (const c in perClass) {
    const { tp, fp, fn } = perClass[c];
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = (precision + recall > 0) ? (2 * precision * recall) / (precision + recall) : 0;
    sumF1 += f1;
    classesWithData++;
  }
  const macroF1 = classesWithData > 0 ? sumF1 / classesWithData : 0;

  const targetAcc = targetConfig.targetAccuracy || 0.70;
  const targetF1 = targetConfig.targetF1 || 0.65;
  const passed = accuracy >= targetAcc && macroF1 >= targetF1;

  return {
    stage: 2,
    passed,
    metrics: {
      accuracy: parseFloat(accuracy.toFixed(4)),
      macroF1: parseFloat(macroF1.toFixed(4)),
      correctCount: correct,
      totalCount: rows.length,
      targetAccuracy: targetAcc,
      targetF1: targetF1
    }
  };
}
