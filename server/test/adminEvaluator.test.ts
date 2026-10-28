import { describe, it, expect } from 'vitest';
import { runAdminEvaluator } from '../src/services/adminEvaluator.js';

describe('Admin Evaluator Service', () => {
  it('returns an error when model file does not exist', async () => {
    const res = await runAdminEvaluator('non_existent_model.joblib');
    expect(res.status).toBe('error');
    expect(res.error_code).toBeDefined();
  });
});

