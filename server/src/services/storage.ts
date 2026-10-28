import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

/** All paths are derived from trusted config + generated ids. Nothing here accepts a participant-supplied path. */
export const paths = {
  publicDir: () => path.join(config.storageRoot, 'public'),
  privateDir: () => path.join(config.storageRoot, 'private'),
  artifacts: () => path.join(config.storageRoot, 'private', 'artifacts'),
  uploadTmp: () => path.join(config.storageRoot, 'private', 'upload-tmp'),
  jobs: () => path.join(config.storageRoot, 'private', 'jobs'),
  stage1Train: () => path.join(config.storageRoot, 'public', 'stage1_train.csv'),
  stage2Train: () => path.join(config.storageRoot, 'public', 'stage2_train.csv'),
  featuresPy: () => path.join(config.storageRoot, 'public', 'challenge_features.py'),
  clue: (variantId: number) => path.join(config.storageRoot, 'public', 'clues', `variant_${Number(variantId)}.csv`),
  evalFeatures: (key: string) => path.join(config.storageRoot, 'private', 'eval', safeKey(key), 'features.csv'),
  evalLabels: (key: string) => path.join(config.storageRoot, 'private', 'eval', safeKey(key), 'labels.csv'),
};

function safeKey(key: string) {
  if (!/^(stage2|variant_[1-9][0-9]?)$/.test(key)) throw new Error('invalid evaluation key');
  return key;
}

export async function ensureDirs() {
  for (const d of [paths.artifacts(), paths.uploadTmp(), paths.jobs()]) await fsp.mkdir(d, { recursive: true });
}

export async function sha256File(file: string): Promise<string> {
  const h = crypto.createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(file).on('data', (c) => h.update(c)).on('end', resolve).on('error', reject);
  });
  return h.digest('hex');
}

export function newArtifactPath(): string {
  return path.join(paths.artifacts(), `${crypto.randomUUID()}.joblib`);
}

export async function safeUnlink(p: string | undefined) {
  if (p) await fsp.rm(p, { force: true }).catch(() => undefined);
}

