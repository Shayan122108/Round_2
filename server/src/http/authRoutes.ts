import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import {
  HttpError, clearLoginFailures, createSession, destroySession, loginLocked, recordLoginFailure,
  requireAuth, setSessionCookie, verifyPin, COOKIE_NAME,
} from '../auth/auth.js';
import { ok, parse } from './util.js';
import { getCompetition, publicCompetition } from '../services/competition.js';
import { audit } from '../services/audit.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again shortly.' } },
});

const loginSchema = z.object({
  registrationId: z.string().trim().min(1).max(64),
  pin: z.string().min(1).max(128),
}).strict();

// A fixed dummy hash keeps response time similar for unknown ids.
const DUMMY = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { registrationId, pin } = parse(loginSchema, req.body);
  const key = registrationId.toUpperCase();
  if (loginLocked(key)) throw new HttpError(429, 'LOCKED', 'Too many failed attempts. Try again in a few minutes.');

  const user = await prisma.user.findUnique({ where: { registrationId: key } });
  const valid = await verifyPin(pin, user?.pinHash ?? DUMMY);
  if (!user || !valid) {
    recordLoginFailure(key);
    await audit(null, 'LOGIN_FAILED', key);
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid registration ID or PIN.');
  }
  clearLoginFailures(key);
  const s = await createSession(user.id);
  setSessionCookie(res, s.token, s.expiresAt);
  const comp = publicCompetition(await getCompetition());
  ok(res, {
    user: { registrationId: user.registrationId, displayName: user.displayName, role: user.role },
    csrfToken: s.csrfToken,
    competition: comp,
  });
});

authRouter.post('/logout', async (req, res) => {
  await destroySession(req.cookies?.[COOKIE_NAME]);
  res.clearCookie(COOKIE_NAME, { path: '/' });
  ok(res, { loggedOut: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const u = req.user!;
  const team = u.teamId ? await prisma.team.findUnique({ where: { id: u.teamId }, select: { name: true } }) : null;
  ok(res, {
    user: { registrationId: u.registrationId, displayName: u.displayName, role: u.role, teamName: team?.name ?? null },
    csrfToken: u.csrfToken,
    competition: publicCompetition(await getCompetition()),
  });
});

