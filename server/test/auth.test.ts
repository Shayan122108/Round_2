import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';

describe('Auth & API Access Security Tests', () => {
  const app = createApp();

  beforeAll(async () => {
    // ensure db has at least admin & test user
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects unauthenticated requests to protected endpoints', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe('UNAUTHENTICATED');
  });

  it('rejects access to admin endpoints by anonymous user', async () => {
    const res = await request(app).get('/api/admin/overview');
    expect(res.status).toBe(401);
  });

  it('authenticates valid participant with session cookie and csrfToken', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ registrationId: 'REG-101', pin: '1234' });

    expect(res.status).toBe(200);
    expect(res.body.data?.user?.registrationId).toBe('REG-101');
    expect(res.body.data?.csrfToken).toBeDefined();

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/mlc_session=/);
  });

  it('rejects invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ registrationId: 'ADMIN', pin: 'wrong-pin' });

    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe('INVALID_CREDENTIALS');
  });

  it('prevents participant from accessing admin endpoints', async () => {
    // Login as participant
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ registrationId: 'REG-101', pin: '1234' });

    const cookie = loginRes.headers['set-cookie'];

    const adminRes = await request(app)
      .get('/api/admin/overview')
      .set('Cookie', cookie);

    expect(adminRes.status).toBe(403);
    expect(adminRes.body.error?.code).toBe('FORBIDDEN');
  });
});

