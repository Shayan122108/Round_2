import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import {
  HttpError,
  clearLoginFailures,
  createSession,
  destroySession,
  loginLocked,
  recordLoginFailure,
  requireAuth,
  setSessionCookie,
  verifyPin,
  COOKIE_NAME,
} from '../auth/auth.js';
import { ok, parse } from './util.js';
import { getCompetition, publicCompetition } from '../services/competition.js';
import { audit } from '../services/audit.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many login attempts. Try again shortly.',
    },
  },
});

const loginSchema = z
  .object({
    registrationId: z.string().trim().min(1).max(64),
    pin: z.string().max(128).optional().default(''),
  })
  .strict();

const DUMMY =
  'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' +
  Buffer.alloc(64).toString('base64');

// Valid registration ID format: SDC-2026-XXX (also allow ADMIN and legacy REG-10X)
const SDC_FORMAT_REGEX = /^SDC-2026-[A-Z0-9]+$/;
const LEGACY_FORMAT_REGEX = /^REG-10[1-5]$/;

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { registrationId, pin } = parse(loginSchema, req.body);
  const key = registrationId.trim().toUpperCase();

  if (loginLocked(key)) {
    throw new HttpError(
      429,
      'LOCKED',
      'Too many failed attempts. Try again in a few minutes.',
    );
  }

  const isAdmin = key === 'ADMIN' || key === (process.env.ADMIN_REGISTRATION_ID || 'ADMIN').toUpperCase();

  let user = await prisma.user.findUnique({
    where: { registrationId: key },
  });

  if (isAdmin) {
    // Admin authentication strictly requires PIN verification
    const storedHash = user?.pinHash ?? DUMMY;
    const valid = user ? await verifyPin(pin, storedHash) : false;

    if (!user || !valid) {
      recordLoginFailure(key);
      await audit(null, 'ADMIN_LOGIN_FAILED', key);
      throw new HttpError(
        401,
        'INVALID_CREDENTIALS',
        'Invalid administrative credentials.',
      );
    }
  } else {
    // Participant authentication: validate format SDC-2026-XXX
    const isValidFormat = SDC_FORMAT_REGEX.test(key) || LEGACY_FORMAT_REGEX.test(key);
    if (!isValidFormat) {
      throw new HttpError(
        400,
        'INVALID_REGISTRATION_ID',
        'Registration ID must follow the format SDC-2026-XXX (e.g. SDC-2026-001).',
      );
    }

    // If user already exists: returning participant keeps webId, progress, score, assigned variant
    if (!user) {
      // First-time participant: create record with auto-increment webId and 4k variant assignment
      user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            registrationId: key,
            displayName: `Participant ${key}`,
            role: 'PARTICIPANT',
          },
        });

        // 4k variant assignment: ((webId - 1) % 4) + 1
        const variantId = ((created.webId - 1) % 4) + 1;
        const updated = await tx.user.update({
          where: { id: created.id },
          data: {
            variantId,
            displayName: `Participant #${created.webId} (${key})`,
          },
        });

        await audit(null, 'PARTICIPANT_REGISTERED', updated.id, {
          registrationId: key,
          webId: updated.webId,
          variantId,
        }, tx);

        return updated;
      });
    }
  }

  clearLoginFailures(key);

  const session = await createSession(user.id);
  setSessionCookie(res, session.token, session.expiresAt);

  const comp = publicCompetition(await getCompetition());

  ok(res, {
    user: {
      id: user.id,
      webId: user.webId,
      registrationId: user.registrationId,
      displayName: user.displayName,
      role: user.role,
    },
    csrfToken: session.csrfToken,
    competition: comp,
  });
});

authRouter.post('/logout', async (req, res) => {
  await destroySession(req.cookies?.[COOKIE_NAME]);
  res.clearCookie(COOKIE_NAME, { path: '/' });
  ok(res, { loggedOut: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = req.user!;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { webId: true, registrationId: true, displayName: true, role: true },
  });

  ok(res, {
    user: {
      id: user.id,
      webId: dbUser?.webId ?? user.webId,
      registrationId: dbUser?.registrationId ?? user.registrationId,
      displayName: dbUser?.displayName ?? user.displayName,
      role: dbUser?.role ?? user.role,
    },
    csrfToken: user.csrfToken,
    competition: publicCompetition(await getCompetition()),
  });
});
