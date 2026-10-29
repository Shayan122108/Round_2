import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'node:path';
import fs from 'node:fs';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { startCompetition } from '../src/services/competition.js';

describe('End-to-End Competition Workflow Tests', () => {
  const app = createApp();
  let participantCookie: string;
  let csrfToken: string;

  beforeAll(async () => {
    // Start competition
    await startCompetition(90 * 60).catch(() => undefined);

    // Login as participant REG-101
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ registrationId: 'REG-101', pin: '1234' });

    participantCookie = loginRes.headers['set-cookie'];
    csrfToken = loginRes.body.data.csrfToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('allows authenticated participant to fetch dashboard progress', async () => {
    const res = await request(app)
      .get('/api/me')
      .set('Cookie', participantCookie);

    expect(res.status).toBe(200);
    expect(res.body.data?.user?.registrationId).toBe('REG-101');
    expect(res.body.data?.score?.total).toBeDefined();
    expect(res.body.data?.nextAction).toBeDefined();
  });

  it('downloads Stage 1 training dataset', async () => {
    const res = await request(app)
      .get('/api/datasets/stage1/train')
      .set('Cookie', participantCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.length).toBeGreaterThan(100);
  });

  it('rejects Anagram submission before Stage 1 qualification', async () => {
    // Verify stage 1 is required
    const res = await request(app)
      .post('/api/anagram/submit')
      .set('Cookie', participantCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ answer: 'RANDOM FOREST' });

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('ROUND1_REQUIRED');
  });

  it('rejects Round 3 boilerplate download before solving anagram', async () => {
    const res = await request(app)
      .get('/api/datasets/round3/boilerplate')
      .set('Cookie', participantCookie);

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('ROUND2_REQUIRED');
  });
});

