import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..');

const bool = z.enum(['0', '1', 'true', 'false']).transform((v) => v === '1' || v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://127.0.0.1:56379'),
  PORT: z.coerce.number().default(5000),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:5000'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_TTL_HOURS: z.coerce.number().default(12),
  COOKIE_SECURE: bool.default('false'),
  STORAGE_DIR: z.string().default('storage'),
  MAX_ARTIFACT_MB: z.coerce.number().default(25),
  MAX_QUEUE_DEPTH: z.coerce.number().default(200),
  SUBMISSIONS_PER_MINUTE_PER_TEAM: z.coerce.number().default(3),
  EVAL_CONCURRENCY: z.coerce.number().min(1).default(2),
  SANDBOX_MODE: z.enum(['docker', 'local-insecure']).default('docker'),
  SANDBOX_IMAGE: z.string().default('mlc-sandbox:1'),
  SANDBOX_TIMEOUT_SEC: z.coerce.number().default(60),
  SANDBOX_MEMORY_MB: z.coerce.number().default(1024),
  SANDBOX_CPUS: z.coerce.number().default(1),
  SANDBOX_PIDS: z.coerce.number().default(128),
  ALLOW_COMPROMISED_EVAL_DATA: bool.default('false'),
  QUEUE_NAME: z.string().default('model-evaluations'),
  LOG_LEVEL: z.string().default('info'),
});

export type Config = z.infer<typeof schema> & {
  storageRoot: string;
  allowedOrigins: string[];
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error('Invalid environment: ' + parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  const c = parsed.data;
  if (c.NODE_ENV === 'production') {
    if (c.SANDBOX_MODE !== 'docker') throw new Error('SANDBOX_MODE must be "docker" in production');
    if (!c.COOKIE_SECURE) throw new Error('COOKIE_SECURE must be true in production');
    if (c.ALLOW_COMPROMISED_EVAL_DATA) throw new Error('ALLOW_COMPROMISED_EVAL_DATA must be off in production');
  }
  const storageRoot = path.isAbsolute(c.STORAGE_DIR) ? c.STORAGE_DIR : path.resolve(SERVER_ROOT, c.STORAGE_DIR);
  return { ...c, storageRoot, allowedOrigins: c.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean) };
}

export const config: Config = loadConfig();

