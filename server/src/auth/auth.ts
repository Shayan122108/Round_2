
import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { prisma } from '../db.js';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

// ---------- PIN hashing (scrypt, no native deps) ----------

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pin, salt);

  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPin(
  pin: string,
  stored: string,
): Promise<boolean> {
  try {
    const parts = stored.split('$');

    if (parts.length !== 6 || parts[0] !== 'scrypt') {
      return false;
    }

    const storedN = Number(parts[1]);
    const storedR = Number(parts[2]);
    const storedP = Number(parts[3]);

    // Only accept the parameters used by this application's hashPin().
    if (storedN !== N || storedR !== R || storedP !== P) {
      return false;
    }

    const salt = Buffer.from(parts[4]!, 'base64');
    const expected = Buffer.from(parts[5]!, 'base64');

    if (salt.length !== 16 || expected.length !== KEYLEN) {
      return false;
    }

    const actual = await scrypt(pin, salt);

    return (
      actual.length === expected.length &&
      crypto.timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
}

function scrypt(pin: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      pin,
      salt,
      KEYLEN,
      {
        N,
        r: R,
        p: P,
        maxmem: 64 * 1024 * 1024,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
        } else {
          resolve(derivedKey);
        }
      },
    );
  });
}

// ---------- Sessions ----------

export const COOKIE_NAME = 'mlc_session';

const hashToken = (token: string) =>
  crypto
    .createHmac('sha256', config.SESSION_SECRET)
    .update(token)
    .digest('hex');

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  const csrfToken = crypto.randomBytes(24).toString('base64url');

  const expiresAt = new Date(
    Date.now() + config.SESSION_TTL_HOURS * 3600_000,
  );

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      csrfToken,
      expiresAt,
    },
  });

  return { token, csrfToken, expiresAt };
}

export function setSessionCookie(
  res: Response,
  token: string,
  expiresAt: Date,
) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.COOKIE_SECURE,
    expires: expiresAt,
    path: '/',
  });
}

export async function destroySession(token: string | undefined) {
  if (token) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }
}

export interface AuthUser {
  id: string;
  webId: number;
  registrationId: string;
  displayName: string;
  role: 'PARTICIPANT' | 'ADMIN';
  teamId: string | null;
  variantId?: number | null;
  csrfToken: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

/**
 * Resolves the session cookie to a user.
 * Identity always comes from the validated session, never the request body.
 */
export async function loadUser(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const token = req.cookies?.[COOKIE_NAME] as string | undefined;

    if (token) {
      const session = await prisma.session.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { user: true },
      });

      if (session && session.expiresAt > new Date()) {
        req.user = {
          id: session.user.id,
          webId: session.user.webId,
          registrationId: session.user.registrationId,
          displayName: session.user.displayName,
          role: session.user.role,
          teamId: session.user.teamId,
          variantId: session.user.variantId,
          csrfToken: session.csrfToken,
        };
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return next(
      new HttpError(401, 'UNAUTHENTICATED', 'Please sign in.'),
    );
  }

  next();
}

export function requireParticipant(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return next(
      new HttpError(401, 'UNAUTHENTICATED', 'Please sign in.'),
    );
  }

  if (req.user.role !== 'PARTICIPANT') {
    return next(
      new HttpError(
        403,
        'FORBIDDEN',
        'Participant account is required.',
      ),
    );
  }

  next();
}

export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return next(
      new HttpError(401, 'UNAUTHENTICATED', 'Please sign in.'),
    );
  }

  if (req.user.role !== 'ADMIN') {
    return next(
      new HttpError(
        403,
        'FORBIDDEN',
        'Administrator access required.',
      ),
    );
  }

  next();
}

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth:
 * strict SameSite cookie, Origin allow-list, and per-session token header.
 */
export function csrfProtection(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (SAFE.has(req.method)) {
    return next();
  }

  const origin = req.get('origin');

  if (origin && !config.allowedOrigins.includes(origin)) {
    return next(
      new HttpError(403, 'BAD_ORIGIN', 'Origin not allowed.'),
    );
  }

  // Login/logout establish or clear sessions; they need no existing CSRF token.
  if (
    req.path === '/login' ||
    req.path === '/api/auth/login' ||
    req.path === '/logout' ||
    req.path === '/api/auth/logout'
  ) {
    return next();
  }

  if (!req.user) {
    return next();
  }

  const token = req.get('x-csrf-token');

  if (
    !token ||
    token.length !== req.user.csrfToken.length ||
    !crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(req.user.csrfToken),
    )
  ) {
    return next(
      new HttpError(403, 'BAD_CSRF', 'Missing or invalid CSRF token.'),
    );
  }

  next();
}

// ---------- Login throttling (per registration ID) ----------

const failures = new Map<
  string,
  { count: number; lockedUntil: number }
>();

const MAX_FAILS = 5;
const LOCK_MS = 5 * 60_000;

export function loginLocked(key: string): boolean {
  const failure = failures.get(key);
  return !!failure && failure.lockedUntil > Date.now();
}

export function recordLoginFailure(key: string) {
  const failure = failures.get(key) ?? {
    count: 0,
    lockedUntil: 0,
  };

  failure.count += 1;

  if (failure.count >= MAX_FAILS) {
    failure.lockedUntil = Date.now() + LOCK_MS;
    failure.count = 0;
  }

  failures.set(key, failure);
}

export function clearLoginFailures(key: string) {
  failures.delete(key);
}

export function resetLoginThrottle() {
  failures.clear();
}
