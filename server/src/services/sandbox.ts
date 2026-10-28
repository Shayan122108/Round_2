import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { config, SERVER_ROOT } from '../config.js';
import { paths } from './storage.js';

export type SandboxResult =
  | { ok: true; predictions: number[]; estimator: string; isPipeline: boolean; sklearnVersion: string; seconds: number }
  | { ok: false; errorCode: string };

/** Thrown for infrastructure faults (docker daemon down, disk full). These are retried; model faults are not. */
export class InfraError extends Error {}

const KNOWN_CODES = new Set([
  'RUNNER_ENV', 'OUT_OF_MEMORY', 'LOAD_FAILED', 'NOT_AN_ESTIMATOR', 'FEATURE_MISMATCH',
  'PREDICT_FAILED', 'BAD_PREDICTION_SHAPE', 'INVALID_PREDICTIONS',
]);

export interface SandboxInput {
  artifactPath: string;
  featuresPath: string;
}

/**
 * Runs the untrusted artifact. ONLY the artifact and the permitted test FEATURES are made available;
 * reference labels, env secrets and database credentials are never mounted or passed.
 */
export async function runInSandbox(input: SandboxInput): Promise<SandboxResult> {
  const jobId = crypto.randomUUID();
  const jobDir = path.join(paths.jobs(), jobId);
  const inDir = path.join(jobDir, 'in');
  const outDir = path.join(jobDir, 'out');
  try {
    await fsp.mkdir(inDir, { recursive: true });
    await fsp.mkdir(outDir, { recursive: true, mode: 0o777 });
    await fsp.chmod(outDir, 0o777).catch(() => undefined);
    await fsp.copyFile(input.artifactPath, path.join(inDir, 'model.joblib'));
    await fsp.copyFile(input.featuresPath, path.join(inDir, 'features.csv'));
    await fsp.chmod(path.join(inDir, 'model.joblib'), 0o444).catch(() => undefined);
    await fsp.chmod(inDir, 0o755).catch(() => undefined);

    const timedOut = config.SANDBOX_MODE === 'docker'
      ? await runDocker(jobId, inDir, outDir)
      : await runLocal(inDir, outDir);
    if (timedOut) return { ok: false, errorCode: 'TIMEOUT' };

    let raw: string;
    try {
      raw = await fsp.readFile(path.join(outDir, 'result.json'), 'utf8');
    } catch {
      return { ok: false, errorCode: 'WORKER_CRASH' };
    }
    if (raw.length > 5_000_000) return { ok: false, errorCode: 'INVALID_PREDICTIONS' };
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { return { ok: false, errorCode: 'WORKER_CRASH' }; }

    if (parsed?.ok === true && Array.isArray(parsed.predictions) && parsed.predictions.every((p: unknown) => Number.isInteger(p))) {
      return {
        ok: true,
        predictions: parsed.predictions,
        estimator: String(parsed.estimator ?? '').slice(0, 80),
        isPipeline: !!parsed.isPipeline,
        sklearnVersion: String(parsed.sklearnVersion ?? '').slice(0, 20),
        seconds: Number(parsed.seconds) || 0,
      };
    }
    // Only whitelisted codes are ever surfaced - never raw text produced by untrusted code.
    const code = KNOWN_CODES.has(parsed?.errorCode) ? parsed.errorCode : 'WORKER_CRASH';
    return { ok: false, errorCode: code };
  } finally {
    await fsp.rm(jobDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function toDockerPath(p: string) {
  return p.replace(/\\/g, '/');
}

function exec(cmd: string, args: string[], timeoutMs: number, onTimeout: () => void, env?: NodeJS.ProcessEnv) {
  return new Promise<{ code: number | null; timedOut: boolean; stderr: string }>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'], env, windowsHide: true });
    let stderr = '';
    let timedOut = false;
    child.stderr.on('data', (d) => { if (stderr.length < 4000) stderr += d.toString(); });
    const timer = setTimeout(() => { timedOut = true; onTimeout(); }, timeoutMs);
    child.on('error', (e) => { clearTimeout(timer); reject(new InfraError(`spawn ${cmd}: ${e.message}`)); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, timedOut, stderr }); });
  });
}

async function runDocker(jobId: string, inDir: string, outDir: string): Promise<boolean> {
  const name = `mlc-eval-${jobId}`;
  const mem = `${config.SANDBOX_MEMORY_MB}m`;
  const args = [
    'run', '--rm', '--name', name,
    '--network', 'none',
    '--read-only',
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges',
    '--user', '65534:65534',
    '--pids-limit', String(config.SANDBOX_PIDS),
    '--memory', mem, '--memory-swap', mem,
    '--cpus', String(config.SANDBOX_CPUS),
    '--ulimit', 'nofile=256:256',
    '-e', 'HOME=/tmp', '-e', 'JOBLIB_TEMP_FOLDER=/tmp', '-e', `MLC_MEM_BYTES=${config.SANDBOX_MEMORY_MB * 1024 * 1024}`,
    '-v', `${toDockerPath(inDir)}:/in:ro`,
    '-v', `${toDockerPath(outDir)}:/out:rw`,
    config.SANDBOX_IMAGE,
  ];
  // Clean env: nothing from the API process (DATABASE_URL, SESSION_SECRET...) can reach the container.
  const cleanEnv: NodeJS.ProcessEnv = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, DOCKER_HOST: process.env.DOCKER_HOST, USERPROFILE: process.env.USERPROFILE, HOME: process.env.HOME };
  const res = await exec('docker', args, config.SANDBOX_TIMEOUT_SEC * 1000, () => {
    spawn('docker', ['kill', name], { stdio: 'ignore', windowsHide: true }).on('error', () => undefined);
  }, cleanEnv);
  if (res.timedOut) return true;
  // 125/126/127 = docker itself failed (daemon down, image missing): infrastructure, not the model's fault.
  if (res.code === 125 || /Cannot connect to the Docker daemon|error during connect|pipe\/docker/i.test(res.stderr))
    throw new InfraError(`docker run failed: ${res.stderr.slice(0, 300)}`);
  return false;
}

/** DEV/TEST ONLY. No isolation. Refused by config validation when NODE_ENV=production. */
async function runLocal(inDir: string, outDir: string): Promise<boolean> {
  const python = process.env.PYTHON_BIN || 'python';
  const sandboxDir = path.resolve(SERVER_ROOT, '..', 'sandbox');
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
    MLC_IN: inDir, MLC_OUT: outDir, PYTHONPATH: sandboxDir, OMP_NUM_THREADS: '1',
  };
  let child: ReturnType<typeof spawn> | undefined;
  const res = await new Promise<{ timedOut: boolean }>((resolve, reject) => {
    child = spawn(python, [path.join(sandboxDir, 'runner.py')], { stdio: 'ignore', env, windowsHide: true });
    const t = setTimeout(() => { child?.kill('SIGKILL'); resolve({ timedOut: true }); }, config.SANDBOX_TIMEOUT_SEC * 1000);
    child.on('error', (e) => { clearTimeout(t); reject(new InfraError(e.message)); });
    child.on('close', () => { clearTimeout(t); resolve({ timedOut: false }); });
  });
  return res.timedOut;
}

