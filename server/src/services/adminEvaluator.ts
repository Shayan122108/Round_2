import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { SERVER_ROOT } from '../config.js';
import { logger } from '../logger.js';
import { paths } from './storage.js';

export interface AdminEvalSuccess {
  status: 'success';
  samples_evaluated: number;
  rmse: number;
  mse: number;
  mae: number;
  accuracy: number;
  macro_f1: number;
  precision: number;
  recall: number;
}

export interface AdminEvalFailure {
  status: 'error';
  error_code: string;
  message: string;
}

export type AdminEvalResult = AdminEvalSuccess | AdminEvalFailure;

/**
 * Runs the organizer evaluator script against the hidden admin holdout dataset (test_for_admin.csv).
 * Executes in a separate subprocess worker with resource limits and numpy exchange.
 */
export async function runAdminEvaluator(
  artifactPath: string,
  timeoutMs: number = 120_000,
): Promise<AdminEvalResult> {
  const featuresPath = paths.adminEvalFeatures();
  const labelsPath = paths.adminEvalLabels();

  if (!fs.existsSync(featuresPath) || !fs.existsSync(labelsPath)) {
    logger.warn('Admin evaluation holdout files not found, re-run import_datasets.py');
    return {
      status: 'error',
      error_code: 'HOLD_OUT_NOT_FOUND',
      message: 'Admin evaluation dataset not found on server.',
    };
  }

  const scriptPath = path.resolve(SERVER_ROOT, '..', 'scripts', 'evaluator.py');
  const pythonBin = process.env.PYTHON_BIN || 'python';

  const args = [
    scriptPath,
    '--model', artifactPath,
    '--features', featuresPath,
    '--labels', labelsPath,
    '--label-column', 'sort_bin',
    '--drop-columns', 'id',
    '--timeout', String(Math.floor(timeoutMs / 1000)),
  ];

  return new Promise<AdminEvalResult>((resolve) => {
    let stdoutData = '';
    let stderrData = '';
    let timedOut = false;

    const child = spawn(pythonBin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONPATH: path.resolve(SERVER_ROOT, '..', 'sandbox'),
      },
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
      resolve({
        status: 'error',
        error_code: 'TIMEOUT',
        message: 'Evaluation timed out.',
      });
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      if (stderrData.length < 4000) stderrData += chunk.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      logger.error({ err: err.message }, 'Failed to spawn admin evaluator process');
      resolve({
        status: 'error',
        error_code: 'SPAWN_FAILED',
        message: err.message,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return;

      const trimmed = stdoutData.trim();
      const lastLine = trimmed.split('\n').filter(Boolean).pop();

      if (!lastLine) {
        logger.warn({ code, stderr: stderrData }, 'Admin evaluator produced no stdout');
        return resolve({
          status: 'error',
          error_code: 'NO_OUTPUT',
          message: 'The evaluator produced no output.',
        });
      }

      try {
        const parsed = JSON.parse(lastLine) as AdminEvalResult;
        resolve(parsed);
      } catch (e) {
        logger.error({ raw: lastLine, stderr: stderrData }, 'Failed to parse admin evaluator output');
        resolve({
          status: 'error',
          error_code: 'PARSE_ERROR',
          message: 'Invalid evaluator output format.',
        });
      }
    });
  });
}

