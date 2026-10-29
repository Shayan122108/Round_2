import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { hashPin } from '../src/auth/auth.js';

describe('SDC ML Challenge - Full Competition & Security Integration Tests', () => {
  const app = createApp();

  let adminCookie: string;
  let adminCsrfToken: string;

  const testParticipantRegId = `SDC-2026-${Date.now().toString().slice(-4)}`;
  let participantCookie: string;
  let participantCsrfToken: string;
  let participantWebId: number;
  let participantId: string;

  beforeAll(async () => {
    // 1. Ensure admin account exists with known PIN
    const adminPinHash = await hashPin('AdminSecure123!');
    await prisma.user.upsert({
      where: { registrationId: 'ADMIN' },
      update: { pinHash: adminPinHash, role: 'ADMIN', displayName: 'Head Admin' },
      create: {
        registrationId: 'ADMIN',
        displayName: 'Head Admin',
        role: 'ADMIN',
        pinHash: adminPinHash,
      },
    });

    // 2. Ensure variants 1..4 and benchmarks exist
    await prisma.benchmarkConfig.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, round1Mae: 1.25, round1Rmse: 1.85, round1Mse: 3.42 },
    });

    const variants = [
      { id: 1, label: 'Variant 1', hiddenModel: 'RANDOM FOREST', shuffledLetters: 'ADMFOERNOSRT', estimator: 'RandomForestClassifier', starterTemplate: '# RF Boilerplate' },
      { id: 2, label: 'Variant 2', hiddenModel: 'DECISION TREE', shuffledLetters: 'CREEOITIDSEN', estimator: 'DecisionTreeClassifier', starterTemplate: '# DT Boilerplate' },
      { id: 3, label: 'Variant 3', hiddenModel: 'NAIVE BAYES', shuffledLetters: 'YVEAEASIBN', estimator: 'GaussianNB', starterTemplate: '# NB Boilerplate' },
      { id: 4, label: 'Variant 4', hiddenModel: 'GRADIENT BOOSTING', shuffledLetters: 'GTNATINGOIODSRBE', estimator: 'HistGradientBoostingClassifier', starterTemplate: '# GB Boilerplate' },
    ];
    for (const v of variants) {
      await prisma.variant.upsert({ where: { id: v.id }, update: v, create: v });
    }

    // 3. Login as Admin
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ registrationId: 'ADMIN', pin: 'AdminSecure123!' });

    adminCookie = adminLoginRes.headers['set-cookie'];
    adminCsrfToken = adminLoginRes.body.data.csrfToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. First login creates one persistent participant identity with sequential web_id', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ registrationId: testParticipantRegId });

    expect(res.status).toBe(200);
    expect(res.body.data?.user?.registrationId).toBe(testParticipantRegId);
    expect(typeof res.body.data?.user?.webId).toBe('number');
    expect(res.body.data?.user?.webId).toBeGreaterThan(0);

    participantCookie = res.headers['set-cookie'];
    participantCsrfToken = res.body.data.csrfToken;
    participantWebId = res.body.data.user.webId;
    participantId = res.body.data.user.id;

    // Check DB record
    const inDb = await prisma.user.findUnique({ where: { registrationId: testParticipantRegId } });
    expect(inDb).not.toBeNull();
    expect(inDb?.webId).toBe(participantWebId);
    // 4k variant mapping rule: ((webId - 1) % 4) + 1
    const expectedVariant = ((participantWebId - 1) % 4) + 1;
    expect(inDb?.variantId).toBe(expectedVariant);
  });

  it('2. Repeated login does not create duplicate participants or change web_id', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ registrationId: testParticipantRegId });

    expect(res.status).toBe(200);
    expect(res.body.data?.user?.webId).toBe(participantWebId);
    expect(res.body.data?.user?.id).toBe(participantId);

    const count = await prisma.user.count({ where: { registrationId: testParticipantRegId } });
    expect(count).toBe(1);
  });

  it('3. Rejects invalid registration ID format', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ registrationId: 'INVALID-ID-123' });

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('INVALID_REGISTRATION_ID');
  });

  it('4. Participant endpoints cannot access admin functionality', async () => {
    const res = await request(app)
      .get('/api/admin/overview')
      .set('Cookie', participantCookie);

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('FORBIDDEN');
  });

  it('5. Round 2 remains locked before Round 1 approval', async () => {
    // Attempt small_test.csv download
    const dlRes = await request(app)
      .get('/api/datasets/round2/small-test')
      .set('Cookie', participantCookie);

    expect(dlRes.status).toBe(403);
    expect(dlRes.body.error?.code).toBe('ROUND1_REQUIRED');

    // Attempt Round 2 answer submission
    const ansRes = await request(app)
      .post('/api/rounds/round2/check-answer')
      .set('Cookie', participantCookie)
      .set('X-CSRF-Token', participantCsrfToken)
      .send({ answer: 'RANDOM FOREST' });

    expect(ansRes.status).toBe(403);
    expect(ansRes.body.error?.code).toBe('ROUND1_REQUIRED');
  });

  it('6. Participant can request Round 1 verification and appears in pending queue', async () => {
    const reqRes = await request(app)
      .post('/api/rounds/request-verification')
      .set('Cookie', participantCookie)
      .set('X-CSRF-Token', participantCsrfToken)
      .send({ round: 1 });

    expect(reqRes.status).toBe(200);

    // Verify in Admin Pending Queue
    const qRes = await request(app)
      .get('/api/admin/pending-verifications')
      .set('Cookie', adminCookie);

    expect(qRes.status).toBe(200);
    const found = qRes.body.data.find((item: any) => item.userId === participantId);
    expect(found).toBeDefined();
    expect(found.round).toBe(1);
  });

  it('7. Rejections award no points', async () => {
    const rejRes = await request(app)
      .post(`/api/admin/participants/${participantId}/review`)
      .set('Cookie', adminCookie)
      .set('X-CSRF-Token', adminCsrfToken)
      .send({ round: 1, action: 'REJECT', reason: 'MAE exceeds acceptable threshold' });

    expect(rejRes.status).toBe(200);

    // Check participant score remains 0
    const meRes = await request(app)
      .get('/api/me')
      .set('Cookie', participantCookie);

    expect(meRes.body.data?.score?.total).toBe(0);
    expect(meRes.body.data?.stages?.stage1?.status).toBe('REJECTED');
  });

  it('8. Round 1 approval awards exactly 30 points once and unlocks Round 2', async () => {
    const appRes = await request(app)
      .post(`/api/admin/participants/${participantId}/review`)
      .set('Cookie', adminCookie)
      .set('X-CSRF-Token', adminCsrfToken)
      .send({ round: 1, action: 'APPROVE', reason: 'In-person verification confirmed' });

    expect(appRes.status).toBe(200);

    // Verify 30 points awarded and Round 2 unlocked
    const meRes = await request(app)
      .get('/api/me')
      .set('Cookie', participantCookie);

    expect(meRes.body.data?.score?.total).toBe(30);
    expect(meRes.body.data?.stages?.stage1?.status).toBe('APPROVED');
    expect(meRes.body.data?.stages?.anagram?.unlocked).toBe(true);

    // Duplicate approval attempt must be rejected or not award extra points
    const dupRes = await request(app)
      .post(`/api/admin/participants/${participantId}/review`)
      .set('Cookie', adminCookie)
      .set('X-CSRF-Token', adminCsrfToken)
      .send({ round: 1, action: 'APPROVE' });

    expect(dupRes.status).toBe(400);

    // Score remains strictly 30
    const checkScore = await prisma.user.findUnique({ where: { id: participantId } });
    expect(checkScore?.totalScore).toBe(30);
  });

  it('9. Round 2 allows downloading small_test.csv after Round 1 approval', async () => {
    const res = await request(app)
      .get('/api/datasets/round2/small-test')
      .set('Cookie', participantCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('small_test.csv');
  });

  it('10. Round 2 incorrect answers do not award points and allow unlimited attempts', async () => {
    const res = await request(app)
      .post('/api/rounds/round2/check-answer')
      .set('Cookie', participantCookie)
      .set('X-CSRF-Token', participantCsrfToken)
      .send({ answer: 'WRONG_ALGORITHM_NAME' });

    expect(res.status).toBe(200);
    expect(res.body.data?.correct).toBe(false);

    // Score remains 30
    const meRes = await request(app)
      .get('/api/me')
      .set('Cookie', participantCookie);
    expect(meRes.body.data?.score?.total).toBe(30);
  });

  it('11. Round 2 answer checking is case-insensitive, ignores extra spaces, and awards 50 points exactly once', async () => {
    // Find expected model name for participant's variant
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: participantId },
      include: { variant: true },
    });
    const expectedModel = user.variant!.hiddenModel;

    // Send with mixed case and leading/trailing whitespace
    const submittedAnswer = `   ${expectedModel.toLowerCase()}   `;

    const res = await request(app)
      .post('/api/rounds/round2/check-answer')
      .set('Cookie', participantCookie)
      .set('X-CSRF-Token', participantCsrfToken)
      .send({ answer: submittedAnswer });

    expect(res.status).toBe(200);
    expect(res.body.data?.correct).toBe(true);

    // Verify 30 + 50 = 80 points
    const meRes = await request(app)
      .get('/api/me')
      .set('Cookie', participantCookie);

    expect(meRes.body.data?.score?.total).toBe(80);
    expect(meRes.body.data?.stages?.anagram?.completed).toBe(true);

    // Repeated submissions after correct answer must not award additional points
    const repeatRes = await request(app)
      .post('/api/rounds/round2/check-answer')
      .set('Cookie', participantCookie)
      .set('X-CSRF-Token', participantCsrfToken)
      .send({ answer: expectedModel });

    expect(repeatRes.status).toBe(200);
    expect(repeatRes.body.data?.alreadySolved).toBe(true);

    const checkDb = await prisma.user.findUnique({ where: { id: participantId } });
    expect(checkDb?.totalScore).toBe(80);
  });

  it('12. Round 3 boilerplate remains unavailable until explicitly released by authorized admin', async () => {
    // Attempt download before admin release
    const dlRes = await request(app)
      .get('/api/datasets/round3/boilerplate')
      .set('Cookie', participantCookie);

    expect(dlRes.status).toBe(403);
    expect(dlRes.body.error?.code).toBe('BOILERPLATE_NOT_RELEASED');

    // Admin explicitly releases boilerplate
    const relRes = await request(app)
      .post(`/api/admin/participants/${participantId}/release-boilerplate`)
      .set('Cookie', adminCookie)
      .set('X-CSRF-Token', adminCsrfToken);

    expect(relRes.status).toBe(200);

    // Now participant can download boilerplate
    const afterRelDl = await request(app)
      .get('/api/datasets/round3/boilerplate')
      .set('Cookie', participantCookie);

    expect(afterRelDl.status).toBe(200);
    expect(afterRelDl.headers['content-disposition']).toContain('round3_boilerplate.py');
    expect(afterRelDl.text.length).toBeGreaterThan(10);
  });

  it('13. Participant cannot access admin reference metrics or private variant assignments through public API', async () => {
    const meRes = await request(app)
      .get('/api/me')
      .set('Cookie', participantCookie);

    // Variant internal numeric ID and benchmarks must not be exposed in participant reveal
    expect(meRes.body.data?.variantId).toBeUndefined();
    expect(meRes.body.data?.referenceMetrics).toBeUndefined();
    expect(meRes.body.data?.benchmark).toBeUndefined();
  });

  it('14. Round 3 approval awards exactly 70 points and caps score at 150', async () => {
    // Request Round 3 verification
    await request(app)
      .post('/api/rounds/request-verification')
      .set('Cookie', participantCookie)
      .set('X-CSRF-Token', participantCsrfToken)
      .send({ round: 3 });

    // Admin approves Round 3
    const appRes = await request(app)
      .post(`/api/admin/participants/${participantId}/review`)
      .set('Cookie', adminCookie)
      .set('X-CSRF-Token', adminCsrfToken)
      .send({ round: 3, action: 'APPROVE', reason: 'Round 3 model verified in person' });

    expect(appRes.status).toBe(200);

    // Verify total score is exactly 30 + 50 + 70 = 150
    const meRes = await request(app)
      .get('/api/me')
      .set('Cookie', participantCookie);

    expect(meRes.body.data?.score?.total).toBe(150);
    expect(meRes.body.data?.stages?.stage2?.completed).toBe(true);

    // Duplicate Round 3 approval attempt rejected
    const dupRes = await request(app)
      .post(`/api/admin/participants/${participantId}/review`)
      .set('Cookie', adminCookie)
      .set('X-CSRF-Token', adminCsrfToken)
      .send({ round: 3, action: 'APPROVE' });

    expect(dupRes.status).toBe(400);

    // Database score capped at 150
    const finalUser = await prisma.user.findUnique({ where: { id: participantId } });
    expect(finalUser?.totalScore).toBe(150);
  });

  it('15. Leaderboard reflects persisted scores and ranks correctly', async () => {
    const boardRes = await request(app).get('/api/leaderboard');
    expect(boardRes.status).toBe(200);

    const board = boardRes.body.data?.leaderboard;
    expect(Array.isArray(board)).toBe(true);
    expect(board.length).toBeGreaterThan(0);

    const candidateEntry = board.find((entry: any) => entry.numericWebId === participantWebId);
    expect(candidateEntry).toBeDefined();
    expect(candidateEntry.totalScore).toBe(150);
    expect(candidateEntry.stages?.stage1).toBe(true);
    expect(candidateEntry.stages?.anagram).toBe(true);
    expect(candidateEntry.stages?.stage2).toBe(true);
  });

  it('16. Audit events correctly identify the authenticated admin', async () => {
    const logsRes = await request(app)
      .get('/api/admin/audit-logs')
      .set('Cookie', adminCookie);

    expect(logsRes.status).toBe(200);
    const logs = logsRes.body.data;
    const r1Approval = logs.find((l: any) => l.action === 'ROUND_1_APPROVED' && l.target === participantId);
    expect(r1Approval).toBeDefined();

    const r3Approval = logs.find((l: any) => l.action === 'ROUND_3_APPROVED' && l.target === participantId);
    expect(r3Approval).toBeDefined();
  });

  it('17. Admin can export participants to CSV', async () => {
    const csvRes = await request(app)
      .get('/api/admin/export/csv')
      .set('Cookie', adminCookie);

    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.text).toContain('Rank,Web ID,Registration ID');
    expect(csvRes.text).toContain(testParticipantRegId);
  });

  it('18. Admin round controls: pause, resume, end, and restart round', async () => {
    // 1. Pause round
    const pauseRes = await request(app)
      .post('/api/admin/competition/pause')
      .set('Cookie', adminCookie)
      .set('X-CSRF-Token', adminCsrfToken);
    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.data.status).toBe('PAUSED');

    // Participant verification request fails while paused
    const reqWhilePaused = await request(app)
      .post('/api/rounds/request-verification')
      .set('Cookie', participantCookie)
      .set('X-CSRF-Token', participantCsrfToken)
      .send({ round: 1 });
    expect(reqWhilePaused.status).toBe(403);

    // 2. Resume round
    const resumeRes = await request(app)
      .post('/api/admin/competition/resume')
      .set('Cookie', adminCookie)
      .set('X-CSRF-Token', adminCsrfToken);
    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.data.status).toBe('RUNNING');

    // 3. End round
    const endRes = await request(app)
      .post('/api/admin/competition/end')
      .set('Cookie', adminCookie)
      .set('X-CSRF-Token', adminCsrfToken);
    expect(endRes.status).toBe(200);
    expect(endRes.body.data.status).toBe('ENDED');

    // 4. Restart round with custom duration
    const startRes = await request(app)
      .post('/api/admin/competition/start')
      .set('Cookie', adminCookie)
      .set('X-CSRF-Token', adminCsrfToken)
      .send({ durationSeconds: 3600, force: true });
    expect(startRes.status).toBe(200);
    expect(startRes.body.data.status).toBe('RUNNING');
  });
});
