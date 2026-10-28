import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://mlc:mlc_dev_password@127.0.0.1:55432/mlchallenge?schema=public',
      REDIS_URL: 'redis://127.0.0.1:56379',
      SESSION_SECRET: 'super-secret-test-key-32-chars-long-1234567890',
      STORAGE_DIR: 'storage',
      SANDBOX_MODE: 'docker',
      SANDBOX_IMAGE: 'mlc-sandbox:1',
      ALLOW_COMPROMISED_EVAL_DATA: '1',
    },
  },
});

