import express from 'express';
import cors from 'cors';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import projectRoutes from './routes/project.routes.js';
import taskRoutes from './routes/task.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import teamRoutes from './routes/team.routes.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';
import { sendSuccess } from './utils/apiResponse.js';

export const app = express();

app.use(helmet({
  crossOriginResourcePolicy: false
}));
// Sanitize data to prevent NoSQL injection and XSS
app.use(mongoSanitize());
app.use(xss());
// Support multiple origins (comma-separated). Supports exact origins and wildcard subdomains like https://*.example.com.
const allowedOriginRules = (env.clientUrl || '').split(',').map((s) => s.trim()).filter(Boolean);
const normalizeOrigin = (value) => {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
};

const isAllowedByRule = (origin, rule) => {
  if (!rule) return false;
  if (rule.includes('*')) {
    const wildcardPattern = rule
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace('\\*', '.*');
    return new RegExp(`^${wildcardPattern}$`).test(origin);
  }
  return normalizeOrigin(rule) === origin;
};

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    try {
      const url = new URL(origin);
      const host = url.hostname;
      // allow localhost and loopback
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return callback(null, true);
      // allow common private LAN ranges (10.x.x.x, 192.168.x.x, 172.16.x.x - 172.31.x.x)
      if (/^(10|192\.168|172)\./.test(host)) return callback(null, true);
    } catch (e) {
      // if origin is not a valid URL, fall through to allowedOrigins check
    }
    if (allowedOriginRules.some((rule) => isAllowedByRule(origin, rule))) return callback(null, true);
    return callback(new Error('CORS not allowed for origin ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
}));
app.use(express.json({ limit: '10kb' }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
const buildRateLimitHandler = (message) => (req, res) => {
  res.status(429).json({
    success: false,
    message
  });
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.nodeEnv === 'development' ? 1200 : 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.nodeEnv === 'test',
  handler: buildRateLimitHandler('Too many requests. Please try again in a moment.')
});

app.use(apiLimiter);

// Stronger rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.nodeEnv === 'development' ? 60 : 25,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.nodeEnv === 'test',
  handler: buildRateLimitHandler('Too many auth attempts. Please wait and try again.')
});

app.get('/health', (req, res) => {
  sendSuccess(res, { message: 'Team Task Manager API is healthy', data: {} });
});

app.get('/', (req, res) => {
  sendSuccess(res, {
    message: 'Team Task Manager API is running',
    data: {
      docs: '/api',
      health: '/health'
    }
  });
});

app.get('/api', (req, res) => {
  sendSuccess(res, {
    message: 'Team Task Manager API is running',
    data: {
      endpoints: {
        health: '/health',
        auth: '/api/auth',
        users: '/api/users',
        teams: '/api/teams',
        projects: '/api/projects',
        tasks: '/api/tasks',
        dashboard: '/api/dashboard'
      }
    }
  });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(notFound);
app.use(errorHandler);
