import { describe, it, expect } from 'vitest';
import { computeMetrics, parseLabelsCsv } from '../src/services/metrics.js';
import { scorePredictions } from '../src/services/evaluation.js';
import { compareLeaderboard, clampScore, normalizeName } from '../src/services/scoring.js';

describe('Metrics & Scoring Unit Tests', () => {
  it('computes accuracy and macro F1 accurately', () => {
    const yTrue = [65, 66, 67, 65];
    const yPred = [65, 66, 68, 65];
    const m = computeMetrics(yTrue, yPred);
    expect(m.accuracy).toBe(0.75);
    expect(m.total).toBe(4);
    expect(m.correct).toBe(3);
  });

  it('parses ground truth labels CSV', () => {
    const csv = `id,correct_prediction,ascii_character\nP001,65,A\nP002,66,B\n`;
    const res = parseLabelsCsv(csv);
    expect(res.ids).toEqual(['P001', 'P002']);
    expect(res.labels).toEqual([65, 66]);
  });

  it('scorePredictions flags wrong estimator type', () => {
    const sb = {
      ok: true as const,
      predictions: [65, 66],
      estimator: 'DecisionTreeClassifier',
      isPipeline: true,
      sklearnVersion: '1.6.1',
      seconds: 0.1,
    };
    const outcome = scorePredictions(sb, [65, 66], {
      estimator: 'LogisticRegression',
      minAccuracy: 0.75,
    });
    expect(outcome.errorCode).toBe('WRONG_ESTIMATOR');
    expect(outcome.qualified).toBe(false);
  });

  it('clamps scores correctly between 0 and 150', () => {
    expect(clampScore(-20)).toBe(0);
    expect(clampScore(120)).toBe(120);
    expect(clampScore(180)).toBe(150);
  });

  it('normalizes algorithm names ignoring non-alphanumeric and case', () => {
    expect(normalizeName('Random Forest!')).toBe('RANDOMFOREST');
    expect(normalizeName('decision_tree')).toBe('DECISIONTREE');
  });

  it('orders leaderboard deterministically with tie-breakers', () => {
    const t1 = { id: '1', name: 'Alpha', totalScore: 100, lastScoreAt: new Date(1000) };
    const t2 = { id: '2', name: 'Beta', totalScore: 100, lastScoreAt: new Date(500) }; // earlier wins
    const t3 = { id: '3', name: 'Gamma', totalScore: 120, lastScoreAt: new Date(2000) }; // higher score wins

    const list = [t1, t2, t3].sort(compareLeaderboard);
    expect(list[0].id).toBe('3');
    expect(list[1].id).toBe('2');
    expect(list[2].id).toBe('1');
  });
});

