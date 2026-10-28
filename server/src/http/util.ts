import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { HttpError } from '../auth/auth.js';
import { logger } from '../logger.js';

export const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ data });

export function parse<T extends ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const r = schema.safeParse(input);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    throw new HttpError(400, 'VALIDATION_ERROR', msg);
  }
  return r.data;
}

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, 'NOT_FOUND', 'Resource not found.'));
}

/** Sanitised error responses: no stack traces, SQL, paths or exception text leave the server. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request.' } });
  }
  const e = err as { code?: string; type?: string; status?: number };
  if (e?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: { code: 'FILE_TOO_LARGE', message: 'Uploaded file is too large.' } });
  if (e?.code?.startsWith?.('LIMIT_')) return res.status(400).json({ error: { code: 'UPLOAD_REJECTED', message: 'Upload rejected.' } });
  if (e?.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Malformed JSON body.' } });
  if (e?.type === 'entity.too.large') return res.status(413).json({ error: { code: 'BODY_TOO_LARGE', message: 'Request body too large.' } });
  logger.error({ err: String(err), stack: (err as Error)?.stack, path: req.path, method: req.method }, 'unhandled error');
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } });
}

export const ERROR_MESSAGES: Record<string, string> = {
  TIMEOUT: 'Your model took too long to evaluate and was stopped.',
  OUT_OF_MEMORY: 'Your model exceeded the memory limit.',
  LOAD_FAILED: 'The file could not be loaded as a scikit-learn model. Check your scikit-learn version (1.6.1) and that you saved with joblib.dump.',
  NOT_AN_ESTIMATOR: 'The uploaded object is not a scikit-learn estimator or pipeline.',
  FEATURE_MISMATCH: 'The model expects different input columns than the competition feature schema.',
  PREDICT_FAILED: 'The model failed while generating predictions.',
  BAD_PREDICTION_SHAPE: 'The model returned predictions in an unexpected shape.',
  INVALID_PREDICTIONS: 'The model returned non-integer or invalid predictions.',
  INVALID_LABELS: 'The model predicted labels outside the allowed range (ASCII 65-90).',
  WRONG_ESTIMATOR: 'The final estimator in your pipeline is not the algorithm required for this stage.',
  WORKER_CRASH: 'The evaluation worker crashed while running your model.',
  RUNNER_ENV: 'The evaluation environment could not start. Please contact an organiser.',
  INFRASTRUCTURE_ERROR: 'The platform could not evaluate this submission. Please contact an organiser.',
  INTERNAL_ERROR: 'An internal error occurred while evaluating. Please contact an organiser.',
};

