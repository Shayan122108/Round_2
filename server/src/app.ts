import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { loadUser, csrfProtection } from './auth/auth.js';
import { authRouter } from './http/authRoutes.js';
import { playerRouter } from './http/playerRoutes.js';
import { submissionRouter } from './http/submissionRoutes.js';
import { adminRouter } from './http/adminRoutes.js';
import { errorHandler, notFound, ok } from './http/util.js';
import { getCompetition, publicCompetition } from './services/competition.js';

export function createApp() {
  const app = express();

  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: config.NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }));

  // CORS
  app.use(cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (config.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }));

  // Standard middleware
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Load authenticated user from session cookie
  app.use(loadUser);

  // CSRF protection for mutating requests
  app.use(csrfProtection);

  // Health / Readiness check
  app.get('/api/health', async (_req, res) => {
    try {
      const comp = await getCompetition();
      ok(res, { status: 'healthy', competition: publicCompetition(comp) });
    } catch (err: any) {
      res.status(503).json({ status: 'unhealthy', error: err.message });
    }
  });

  // Mount API routers
  app.use('/api/auth', authRouter);
  app.use('/api', playerRouter);
  app.use('/api/submissions', submissionRouter);
  app.use('/api/admin', adminRouter);

  // 404 & Error handlers
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

