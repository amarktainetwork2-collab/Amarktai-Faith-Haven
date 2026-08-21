import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config, assertProductionConfiguration } from './config.js';
import { query, withTransaction, getPool } from './db/index.js';
import { AIService } from './services/ai/AIService.js';
import { GenXUnavailableError } from './services/ai/GenXClient.js';
import { sendPasswordResetEmail, sendVerificationEmail, sendWelcomeEmail } from './services/email.js';

assertProductionConfiguration();

const app = express();
const aiService = new AIService();
const passwordHash = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
};
const verifyPassword = (password, encoded) => {
  const [scheme, salt, expected] = String(encoded || '').split('$');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
};
const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const ipHash = (ip) => crypto.createHash('sha256').update(String(ip || '')).digest('hex');
const now = () => new Date();
const refreshExpiresAt = () => new Date(Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000);
const randomToken = () => crypto.randomBytes(32).toString('base64url');
const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

app.set('trust proxy', config.trustProxy ? 1 : false);
app.disable('x-powered-by');
app.use((req, res, next) => {
  req.requestId = req.get('x-request-id') || crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
});
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      workerSrc: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
    const error = new Error('Origin is not allowed');
    error.status = 403;
    error.code = 'CORS_ORIGIN_FORBIDDEN';
    return callback(error);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['content-type', 'x-csrf-token', 'x-request-id'],
}));
app.use(express.json({ limit: '100kb', type: ['application/json', 'application/*+json'] }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());

const apiLimiter = rateLimit({
  windowMs: config.apiRateLimitWindowMs,
  limit: config.apiRateLimitMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
});
const authLimiter = rateLimit({
  windowMs: config.authRateLimitWindowMs,
  limit: config.authRateLimitMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'AUTH_RATE_LIMITED', message: 'Too many authentication attempts. Please try again later.' } },
});
const aiLimiter = rateLimit({
  windowMs: config.aiRateLimitWindowMs,
  limit: config.aiRateLimitMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: { code: 'AI_RATE_LIMITED', message: 'AI request limit reached. Please try again later.' } },
});
app.use('/api', apiLimiter);

const cookieBase = {
  secure: config.cookieSecure,
  sameSite: 'strict',
  domain: config.cookieDomain,
};
const accessCookie = { ...cookieBase, httpOnly: true, path: '/', maxAge: config.accessTokenMinutes * 60 * 1000 };
const refreshCookie = { ...cookieBase, httpOnly: true, path: '/api/auth', maxAge: config.refreshTokenDays * 24 * 60 * 60 * 1000 };
const csrfCookie = { ...cookieBase, httpOnly: false, path: '/', maxAge: config.refreshTokenDays * 24 * 60 * 60 * 1000 };

const audit = async ({ requestId, actorId = null, action, entityType = null, entityId = null, ip, metadata = {} }) => {
  await query(
    `INSERT INTO audit_logs(request_id, actor_id, action, entity_type, entity_id, ip_hash, metadata)
     VALUES($1, $2, $3, $4, $5, $6, $7)`,
    [requestId, actorId, action, entityType, entityId, ipHash(ip), metadata],
  );
};

const publicUser = (row) => ({
  id: row.id,
  email: row.email,
  name: row.name,
  denomination: row.denomination,
  language: row.language,
  role: row.role,
  emailVerified: Boolean(row.email_verified_at),
  subscriptionPlan: row.subscription_plan,
  accountStatus: row.account_status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const signAccessToken = (user) => jwt.sign(
  { sub: user.id, role: user.role, emailVerified: Boolean(user.email_verified_at) },
  config.jwtSecret,
  { issuer: config.jwtIssuer, audience: config.jwtAudience, expiresIn: `${config.accessTokenMinutes}m` },
);

const createCsrfToken = (res) => {
  const csrf = randomToken();
  res.cookie(config.csrfCookieName, csrf, csrfCookie);
  return csrf;
};

const setSession = async (res, user, req, familyId = crypto.randomUUID()) => {
  const refresh = randomToken();
  await query(
    `INSERT INTO refresh_tokens(user_id, token_hash, family_id, expires_at, ip_hash, user_agent_hash)
     VALUES($1, $2, $3, $4, $5, $6)`,
    [user.id, tokenHash(refresh), familyId, refreshExpiresAt(), ipHash(req.ip), tokenHash(req.get('user-agent') || '')],
  );
  res.cookie('fh_access', signAccessToken(user), accessCookie);
  res.cookie(config.refreshCookieName, refresh, refreshCookie);
  const csrfToken = createCsrfToken(res);
  return csrfToken;
};

const clearSessionCookies = (res) => {
  res.clearCookie('fh_access', { ...cookieBase, httpOnly: true, path: '/' });
  res.clearCookie(config.refreshCookieName, { ...cookieBase, httpOnly: true, path: '/api/auth' });
  res.clearCookie(config.csrfCookieName, { ...cookieBase, httpOnly: false, path: '/' });
};

const requireCsrf = (req, res, next) => {
  const cookie = req.cookies?.[config.csrfCookieName];
  const header = req.get('x-csrf-token');
  const cookieBytes = cookie ? Buffer.from(cookie) : null;
  const headerBytes = header ? Buffer.from(header) : null;
  if (!cookieBytes || !headerBytes || cookieBytes.length !== headerBytes.length || !crypto.timingSafeEqual(cookieBytes, headerBytes)) {
    return res.status(403).json({ error: { code: 'CSRF_INVALID', message: 'Invalid request token.' } });
  }
  return next();
};

const requireAuth = async (req, res, next) => {
  const token = req.cookies?.fh_access;
  if (!token) return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Sign in is required.' } });
  try {
    const claims = jwt.verify(token, config.jwtSecret, { issuer: config.jwtIssuer, audience: config.jwtAudience });
    const { rows } = await query(
      `SELECT id, email, name, denomination, language, role, account_status, email_verified_at, subscription_plan, ai_quota_monthly, created_at, updated_at
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [claims.sub],
    );
    const user = rows[0];
    if (!user || user.account_status !== 'active') throw new Error('Inactive account');
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: { code: 'SESSION_EXPIRED', message: 'Your session has expired. Please sign in again.' } });
  }
};

const requireVerified = (req, res, next) => {
  if (!req.user.email_verified_at) return res.status(403).json({ error: { code: 'EMAIL_NOT_VERIFIED', message: 'Verify your email address to use this feature.' } });
  return next();
};
const requireRole = (...roles) => (req, res, next) => roles.includes(req.user?.role)
  ? next()
  : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' } });

const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(256).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),
  name: z.string().trim().min(2).max(120),
  denomination: z.string().trim().max(120).optional(),
});
const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(256) });
const calendarSchema = z.object({
  title: z.string().trim().min(1).max(180), description: z.string().trim().max(4000).default(''),
  startsAt: z.string().datetime(), endsAt: z.string().datetime().optional(), timezone: z.string().max(64).default('UTC'),
  category: z.string().trim().min(1).max(48).default('personal'), recurrenceRule: z.string().max(512).nullable().optional(),
  reminderMinutes: z.number().int().min(0).max(43_200).nullable().optional(),
});
const prayerSchema = z.object({ title: z.string().trim().min(1).max(180), content: z.string().trim().min(1).max(6000), tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]) });
const wallSchema = z.object({ content: z.string().trim().min(1).max(4000), isAnonymous: z.boolean().default(false) });
const contactSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().email().max(254), subject: z.string().trim().min(2).max(200), message: z.string().trim().min(5).max(6000) });
const documentSchema = z.object({ type: z.enum(['sermon', 'liturgy', 'family_devotional', 'youth_content', 'little_lambs']), title: z.string().trim().min(1).max(180), content: z.string().trim().min(1).max(50_000), metadata: z.record(z.unknown()).default({}) });

app.get('/health', async (_req, res) => res.json({ ok: true, service: 'faithhaven-api' }));
app.get('/ready', async (_req, res, next) => {
  try {
    await getPool().query('SELECT 1');
    res.json({ ok: true });
  } catch (error) { next(error); }
});
app.get('/api/auth/csrf', (_req, res) => res.json({ csrfToken: createCsrfToken(res) }));

app.post('/api/auth/register', authLimiter, requireCsrf, async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const token = randomToken();
    const user = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO users(email, password_hash, name, denomination) VALUES($1, $2, $3, $4)
         RETURNING id, email, name, denomination, language, role, account_status, email_verified_at, subscription_plan, ai_quota_monthly, created_at, updated_at`,
        [data.email.toLowerCase(), passwordHash(data.password), data.name, data.denomination || null],
      );
      await client.query(
        `INSERT INTO email_verification_tokens(user_id, token_hash, expires_at) VALUES($1, $2, now() + interval '24 hours')`,
        [inserted.rows[0].id, tokenHash(token)],
      );
      return inserted.rows[0];
    });
    try { await sendVerificationEmail({ to: user.email, name: user.name, token }); }
    catch { await audit({ requestId: req.requestId, actorId: user.id, action: 'email.verification_delivery_failed', ip: req.ip }); }
    const csrfToken = await setSession(res, user, req);
    await audit({ requestId: req.requestId, actorId: user.id, action: 'auth.register', entityType: 'user', entityId: user.id, ip: req.ip });
    res.status(201).json({ user: publicUser(user), csrfToken, message: 'Check your inbox to verify your email address.' });
  } catch (error) { next(error); }
});

app.post('/api/auth/login', authLimiter, requireCsrf, async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const { rows } = await query(`SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL`, [data.email.toLowerCase()]);
    const user = rows[0];
    if (!user || !verifyPassword(data.password, user.password_hash) || user.account_status !== 'active') {
      await audit({ requestId: req.requestId, action: 'auth.login_failed', ip: req.ip });
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } });
    }
    const csrfToken = await setSession(res, user, req);
    await audit({ requestId: req.requestId, actorId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id, ip: req.ip });
    return res.json({ user: publicUser(user), csrfToken });
  } catch (error) { return next(error); }
});

app.post('/api/auth/refresh', requireCsrf, async (req, res, next) => {
  try {
    const refresh = req.cookies?.[config.refreshCookieName];
    if (!refresh) return res.status(401).json({ error: { code: 'SESSION_EXPIRED', message: 'Please sign in again.' } });
    const { rows } = await query(
      `SELECT rt.*, u.id AS user_id, u.email, u.name, u.denomination, u.language, u.role, u.account_status, u.email_verified_at, u.subscription_plan, u.ai_quota_monthly, u.created_at, u.updated_at
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1`, [tokenHash(refresh)],
    );
    const record = rows[0];
    if (!record || new Date(record.expires_at) <= now() || record.account_status !== 'active') {
      clearSessionCookies(res);
      return res.status(401).json({ error: { code: 'SESSION_EXPIRED', message: 'Please sign in again.' } });
    }
    if (record.revoked_at) {
      await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL`, [record.family_id]);
      await audit({ requestId: req.requestId, actorId: record.user_id, action: 'auth.refresh_token_reuse_detected', ip: req.ip });
      clearSessionCookies(res);
      return res.status(401).json({ error: { code: 'SESSION_REVOKED', message: 'Please sign in again.' } });
    }
    await withTransaction(async (client) => {
      await client.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`, [record.id]);
      const replacement = randomToken();
      const insert = await client.query(
        `INSERT INTO refresh_tokens(user_id, token_hash, family_id, expires_at, ip_hash, user_agent_hash) VALUES($1, $2, $3, $4, $5, $6) RETURNING id`,
        [record.user_id, tokenHash(replacement), record.family_id, refreshExpiresAt(), ipHash(req.ip), tokenHash(req.get('user-agent') || '')],
      );
      await client.query(`UPDATE refresh_tokens SET replaced_by = $2 WHERE id = $1`, [record.id, insert.rows[0].id]);
      res.cookie(config.refreshCookieName, replacement, refreshCookie);
    });
    const csrfToken = createCsrfToken(res);
    res.cookie('fh_access', signAccessToken(record), accessCookie);
    return res.json({ user: publicUser(record), csrfToken });
  } catch (error) { return next(error); }
});

app.post('/api/auth/logout', requireCsrf, async (req, res, next) => {
  try {
    const refresh = req.cookies?.[config.refreshCookieName];
    if (refresh) await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`, [tokenHash(refresh)]);
    clearSessionCookies(res);
    res.status(204).end();
  } catch (error) { next(error); }
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

app.post('/api/auth/verify-email', authLimiter, requireCsrf, async (req, res, next) => {
  try {
    const token = z.string().min(20).max(256).parse(req.body?.token);
    const { rows } = await query(
      `UPDATE email_verification_tokens SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING user_id`,
      [tokenHash(token)],
    );
    if (!rows[0]) return res.status(400).json({ error: { code: 'TOKEN_INVALID', message: 'This verification link is invalid or has expired.' } });
    const updated = await query(`UPDATE users SET email_verified_at = now() WHERE id = $1 RETURNING *`, [rows[0].user_id]);
    await audit({ requestId: req.requestId, actorId: rows[0].user_id, action: 'auth.email_verified', entityType: 'user', entityId: rows[0].user_id, ip: req.ip });
    try { await sendWelcomeEmail({ to: updated.rows[0].email, name: updated.rows[0].name }); } catch { /* delivery event is intentionally not exposed */ }
    res.json({ user: publicUser(updated.rows[0]) });
  } catch (error) { next(error); }
});

app.post('/api/auth/resend-verification', authLimiter, requireAuth, requireCsrf, async (req, res, next) => {
  try {
    if (req.user.email_verified_at) return res.json({ ok: true, message: 'This email address is already verified.' });
    const token = randomToken();
    await withTransaction(async (client) => {
      await client.query(`UPDATE email_verification_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL`, [req.user.id]);
      await client.query(`INSERT INTO email_verification_tokens(user_id, token_hash, expires_at) VALUES($1, $2, now() + interval '24 hours')`, [req.user.id, tokenHash(token)]);
    });
    try {
      await sendVerificationEmail({ to: req.user.email, name: req.user.name, token });
      await audit({ requestId: req.requestId, actorId: req.user.id, action: 'auth.verification_resent', ip: req.ip });
    } catch {
      await audit({ requestId: req.requestId, actorId: req.user.id, action: 'email.verification_delivery_failed', ip: req.ip });
    }
    res.json({ ok: true, message: 'If delivery is configured, a verification email will be sent shortly.' });
  } catch (error) { next(error); }
});

app.post('/api/auth/request-password-reset', authLimiter, requireCsrf, async (req, res, next) => {
  try {
    const email = z.string().email().max(254).parse(req.body?.email).toLowerCase();
    const { rows } = await query(`SELECT id, email, name FROM users WHERE email = $1 AND deleted_at IS NULL AND account_status = 'active'`, [email]);
    const user = rows[0];
    if (user) {
      const token = randomToken();
      await query(`INSERT INTO password_reset_tokens(user_id, token_hash, expires_at) VALUES($1, $2, now() + interval '30 minutes')`, [user.id, tokenHash(token)]);
      try { await sendPasswordResetEmail({ to: user.email, name: user.name, token }); }
      catch { await audit({ requestId: req.requestId, actorId: user.id, action: 'email.password_reset_delivery_failed', ip: req.ip }); }
      await audit({ requestId: req.requestId, actorId: user.id, action: 'auth.password_reset_requested', ip: req.ip });
    }
    res.json({ ok: true, message: 'If that account exists, a reset email has been sent.' });
  } catch (error) { next(error); }
});

app.post('/api/auth/reset-password', authLimiter, requireCsrf, async (req, res, next) => {
  try {
    const payload = z.object({ token: z.string().min(20).max(256), password: registerSchema.shape.password }).parse(req.body);
    const { rows } = await query(
      `UPDATE password_reset_tokens SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING user_id`,
      [tokenHash(payload.token)],
    );
    if (!rows[0]) return res.status(400).json({ error: { code: 'TOKEN_INVALID', message: 'This reset link is invalid or has expired.' } });
    await withTransaction(async (client) => {
      await client.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [rows[0].user_id, passwordHash(payload.password)]);
      await client.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [rows[0].user_id]);
    });
    clearSessionCookies(res);
    await audit({ requestId: req.requestId, actorId: rows[0].user_id, action: 'auth.password_reset_completed', ip: req.ip });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.post('/api/auth/change-password', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const payload = z.object({ currentPassword: z.string().min(1).max(256), newPassword: registerSchema.shape.password }).parse(req.body);
    const current = await query(`SELECT password_hash FROM users WHERE id = $1`, [req.user.id]);
    if (!verifyPassword(payload.currentPassword, current.rows[0]?.password_hash)) return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect.' } });
    await withTransaction(async (client) => {
      await client.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [req.user.id, passwordHash(payload.newPassword)]);
      await client.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1`, [req.user.id]);
    });
    clearSessionCookies(res);
    await audit({ requestId: req.requestId, actorId: req.user.id, action: 'auth.password_changed', ip: req.ip });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.put('/api/user/profile', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const data = z.object({ name: z.string().trim().min(2).max(120).optional(), denomination: z.string().trim().max(120).nullable().optional(), language: z.string().trim().min(2).max(12).optional() }).parse(req.body);
    const { rows } = await query(
      `UPDATE users SET name = COALESCE($2, name), denomination = COALESCE($3, denomination), language = COALESCE($4, language) WHERE id = $1 RETURNING id, email, name, denomination, language, role, account_status, email_verified_at, subscription_plan, created_at, updated_at`,
      [req.user.id, data.name ?? null, data.denomination ?? null, data.language ?? null],
    );
    await audit({ requestId: req.requestId, actorId: req.user.id, action: 'user.profile_updated', entityType: 'user', entityId: req.user.id, ip: req.ip });
    res.json({ user: publicUser(rows[0]) });
  } catch (error) { next(error); }
});

app.get('/api/user/export', requireAuth, async (req, res, next) => {
  try {
    const [journal, calendar, conversations, documents, subscriptions] = await Promise.all([
      query(`SELECT title, content, tags, is_answered, answered_at, created_at, updated_at FROM prayer_entries WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at`, [req.user.id]),
      query(`SELECT title, description, starts_at, ends_at, timezone, category, recurrence_rule, reminder_minutes, created_at, updated_at FROM calendar_events WHERE owner_id = $1 AND deleted_at IS NULL ORDER BY starts_at`, [req.user.id]),
      query(`SELECT id, title, created_at, updated_at FROM ai_conversations WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at`, [req.user.id]),
      query(`SELECT type, title, content, metadata, created_at, updated_at FROM generated_documents WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at`, [req.user.id]),
      query(`SELECT provider, plan_code, status, started_at, ends_at, cancelled_at, created_at FROM subscriptions WHERE user_id = $1 ORDER BY created_at`, [req.user.id]),
    ]);
    await audit({ requestId: req.requestId, actorId: req.user.id, action: 'privacy.data_export_requested', ip: req.ip });
    res.json({ exportedAt: now().toISOString(), profile: publicUser(req.user), prayerJournal: journal.rows, calendar: calendar.rows, conversations: conversations.rows, savedDocuments: documents.rows, subscriptions: subscriptions.rows });
  } catch (error) { next(error); }
});

app.delete('/api/user/account', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const password = z.string().min(1).max(256).parse(req.body?.password);
    const { rows } = await query(`SELECT email, password_hash FROM users WHERE id = $1 AND deleted_at IS NULL`, [req.user.id]);
    const current = rows[0];
    if (!current || !verifyPassword(password, current.password_hash)) return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Password confirmation is required.' } });
    await withTransaction(async (client) => {
      const anonymizedEmail = `deleted+${req.user.id}@invalid.local`;
      await client.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [req.user.id]);
      await client.query(`UPDATE prayer_entries SET deleted_at = now() WHERE user_id = $1 AND deleted_at IS NULL`, [req.user.id]);
      await client.query(`UPDATE prayer_wall_posts SET deleted_at = now() WHERE user_id = $1 AND deleted_at IS NULL`, [req.user.id]);
      await client.query(`UPDATE ai_conversations SET deleted_at = now() WHERE user_id = $1 AND deleted_at IS NULL`, [req.user.id]);
      await client.query(`UPDATE generated_documents SET deleted_at = now() WHERE user_id = $1 AND deleted_at IS NULL`, [req.user.id]);
      await client.query(`UPDATE calendar_events SET deleted_at = now() WHERE owner_id = $1 AND deleted_at IS NULL`, [req.user.id]);
      await client.query(`UPDATE newsletter_subscriptions SET unsubscribed_at = now() WHERE email = $1`, [current.email]);
      await client.query(`UPDATE users SET email = $2, name = 'Deleted user', denomination = NULL, account_status = 'deleted', deleted_at = now(), email_verified_at = NULL, password_hash = $3 WHERE id = $1`, [req.user.id, anonymizedEmail, passwordHash(randomToken())]);
    });
    await audit({ requestId: req.requestId, actorId: req.user.id, action: 'privacy.account_deleted', ip: req.ip });
    clearSessionCookies(res);
    res.status(204).end();
  } catch (error) { next(error); }
});

app.get('/api/ai/conversations', requireAuth, requireVerified, async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT id, title, created_at, updated_at FROM ai_conversations WHERE user_id = $1 AND deleted_at IS NULL ORDER BY updated_at DESC`, [req.user.id]);
    res.json({ conversations: rows });
  } catch (error) { next(error); }
});

app.get('/api/ai/conversations/:id', requireAuth, requireVerified, async (req, res, next) => {
  try {
    const conversation = await query(`SELECT id, title, created_at, updated_at FROM ai_conversations WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, [req.params.id, req.user.id]);
    if (!conversation.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } });
    const messages = await query(`SELECT id, role, content, created_at FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at`, [req.params.id]);
    res.json({ conversation: conversation.rows[0], messages: messages.rows });
  } catch (error) { next(error); }
});

app.post('/api/ai/chat', requireAuth, requireVerified, requireCsrf, aiLimiter, async (req, res, next) => {
  try {
    const data = z.object({ prompt: z.string().trim().min(1).max(10_000), conversationId: z.string().uuid().optional() }).parse(req.body);
    let conversationId = data.conversationId;
    if (conversationId) {
      const owned = await query(`SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, [conversationId, req.user.id]);
      if (!owned.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } });
    } else {
      const title = data.prompt.slice(0, 80);
      const created = await query(`INSERT INTO ai_conversations(user_id, title) VALUES($1, $2) RETURNING id`, [req.user.id, title]);
      conversationId = created.rows[0].id;
    }
    const result = await aiService.generate({ user: req.user, feature: 'chat', prompt: data.prompt, conversationId });
    await audit({ requestId: req.requestId, actorId: req.user.id, action: 'ai.chat_completed', entityType: 'ai_conversation', entityId: conversationId, ip: req.ip, metadata: { requestId: result.requestId } });
    res.json({ conversationId, content: result.content, requestId: result.requestId, disclaimer: 'Generated guidance is not scripture or pastoral authority.' });
  } catch (error) { next(error); }
});

app.delete('/api/ai/conversations/:id', requireAuth, requireVerified, requireCsrf, async (req, res, next) => {
  try {
    const result = await query(`UPDATE ai_conversations SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, [req.params.id, req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } });
    res.status(204).end();
  } catch (error) { next(error); }
});

app.post('/api/ai/generate/:feature', requireAuth, requireVerified, requireCsrf, aiLimiter, async (req, res, next) => {
  try {
    const feature = z.enum(['sermon', 'liturgy', 'devotional', 'prayer', 'youth', 'family']).parse(req.params.feature);
    const prompt = z.string().trim().min(1).max(12_000).parse(req.body?.prompt);
    const result = await aiService.generate({ user: req.user, feature, prompt, metadata: { form: req.body?.metadata || {} } });
    await audit({ requestId: req.requestId, actorId: req.user.id, action: `ai.${feature}_completed`, ip: req.ip, metadata: { requestId: result.requestId } });
    res.json({ content: result.content, requestId: result.requestId, disclaimer: 'This is generated draft material and requires human review.' });
  } catch (error) { next(error); }
});

app.get('/api/prayer-journal', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM prayer_entries WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`, [req.user.id]);
    res.json({ prayers: rows });
  } catch (error) { next(error); }
});
app.post('/api/prayer-journal', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const data = prayerSchema.parse(req.body);
    const { rows } = await query(`INSERT INTO prayer_entries(user_id, title, content, tags) VALUES($1, $2, $3, $4) RETURNING *`, [req.user.id, data.title, data.content, data.tags]);
    res.status(201).json({ prayer: rows[0] });
  } catch (error) { next(error); }
});
app.patch('/api/prayer-journal/:id', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const data = z.object({ isAnswered: z.boolean() }).parse(req.body);
    const { rows } = await query(`UPDATE prayer_entries SET is_answered = $3, answered_at = CASE WHEN $3 THEN now() ELSE NULL END WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING *`, [req.params.id, req.user.id, data.isAnswered]);
    if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Prayer entry not found.' } });
    res.json({ prayer: rows[0] });
  } catch (error) { next(error); }
});
app.delete('/api/prayer-journal/:id', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const result = await query(`UPDATE prayer_entries SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, [req.params.id, req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Prayer entry not found.' } });
    res.status(204).end();
  } catch (error) { next(error); }
});

app.get('/api/prayer-wall', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 50);
    const cursor = typeof req.query.cursor === 'string' && !Number.isNaN(Date.parse(req.query.cursor)) ? new Date(req.query.cursor).toISOString() : null;
    const { rows } = await query(
      `SELECT p.id, p.content, p.is_anonymous, p.created_at,
       CASE WHEN p.is_anonymous THEN NULL ELSE u.name END AS author_name,
       (p.user_id = $1) AS is_owner,
       (SELECT count(*)::int FROM prayer_wall_reactions r WHERE r.post_id = p.id) AS prayer_count,
       EXISTS(SELECT 1 FROM prayer_wall_reactions r WHERE r.post_id = p.id AND r.user_id = $1) AS prayed
       FROM prayer_wall_posts p JOIN users u ON u.id = p.user_id
       WHERE p.deleted_at IS NULL AND p.visibility = 'public' AND p.moderation_status = 'published'
       AND ($2::timestamptz IS NULL OR p.created_at < $2)
       ORDER BY p.created_at DESC LIMIT $3`, [req.user.id, cursor, limit],
    );
    res.json({ prayers: rows, nextCursor: rows.length === limit ? rows.at(-1).created_at : null });
  } catch (error) { next(error); }
});
app.post('/api/prayer-wall', requireAuth, requireVerified, requireCsrf, async (req, res, next) => {
  try {
    const data = wallSchema.parse(req.body);
    const { rows } = await query(`INSERT INTO prayer_wall_posts(user_id, content, is_anonymous) VALUES($1, $2, $3) RETURNING *`, [req.user.id, data.content, data.isAnonymous]);
    await audit({ requestId: req.requestId, actorId: req.user.id, action: 'prayer_wall.post_created', entityType: 'prayer_wall_post', entityId: rows[0].id, ip: req.ip });
    res.status(201).json({ prayer: rows[0] });
  } catch (error) { next(error); }
});
app.put('/api/prayer-wall/:id', requireAuth, requireVerified, requireCsrf, async (req, res, next) => {
  try {
    const data = wallSchema.parse(req.body);
    const { rows } = await query(`UPDATE prayer_wall_posts SET content = $3, is_anonymous = $4, updated_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id, content, is_anonymous, created_at, updated_at`, [req.params.id, req.user.id, data.content, data.isAnonymous]);
    if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Prayer request not found.' } });
    await audit({ requestId: req.requestId, actorId: req.user.id, action: 'prayer_wall.post_updated', entityType: 'prayer_wall_post', entityId: req.params.id, ip: req.ip });
    res.json({ prayer: rows[0] });
  } catch (error) { next(error); }
});
app.delete('/api/prayer-wall/:id', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const result = await query(`UPDATE prayer_wall_posts SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, [req.params.id, req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Prayer request not found.' } });
    await audit({ requestId: req.requestId, actorId: req.user.id, action: 'prayer_wall.post_deleted', entityType: 'prayer_wall_post', entityId: req.params.id, ip: req.ip });
    res.status(204).end();
  } catch (error) { next(error); }
});
app.post('/api/prayer-wall/:id/pray', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const post = await query(`SELECT id FROM prayer_wall_posts WHERE id = $1 AND deleted_at IS NULL AND visibility = 'public' AND moderation_status = 'published'`, [req.params.id]);
    if (!post.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Prayer request not found.' } });
    await query(`INSERT INTO prayer_wall_reactions(post_id, user_id) VALUES($1, $2) ON CONFLICT DO NOTHING`, [req.params.id, req.user.id]);
    res.status(204).end();
  } catch (error) { next(error); }
});
app.post('/api/prayer-wall/:id/report', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const reason = z.string().trim().min(3).max(800).parse(req.body?.reason);
    await query(`INSERT INTO prayer_wall_reports(post_id, reporter_id, reason) VALUES($1, $2, $3) ON CONFLICT(post_id, reporter_id) DO NOTHING`, [req.params.id, req.user.id, reason]);
    res.status(204).end();
  } catch (error) { next(error); }
});

app.get('/api/calendar', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM calendar_events WHERE owner_id = $1 AND deleted_at IS NULL ORDER BY starts_at`, [req.user.id]);
    res.json({ events: rows });
  } catch (error) { next(error); }
});
app.post('/api/calendar', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const data = calendarSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO calendar_events(owner_id, title, description, starts_at, ends_at, timezone, category, recurrence_rule, reminder_minutes)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.user.id, data.title, data.description, data.startsAt, data.endsAt || null, data.timezone, data.category, data.recurrenceRule || null, data.reminderMinutes ?? null],
    );
    res.status(201).json({ event: rows[0] });
  } catch (error) { next(error); }
});
app.put('/api/calendar/:id', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const data = calendarSchema.parse(req.body);
    const { rows } = await query(
      `UPDATE calendar_events SET title=$3, description=$4, starts_at=$5, ends_at=$6, timezone=$7, category=$8, recurrence_rule=$9, reminder_minutes=$10
       WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL RETURNING *`,
      [req.params.id, req.user.id, data.title, data.description, data.startsAt, data.endsAt || null, data.timezone, data.category, data.recurrenceRule || null, data.reminderMinutes ?? null],
    );
    if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Calendar event not found.' } });
    res.json({ event: rows[0] });
  } catch (error) { next(error); }
});
app.delete('/api/calendar/:id', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const result = await query(`UPDATE calendar_events SET deleted_at = now() WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL`, [req.params.id, req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Calendar event not found.' } });
    res.status(204).end();
  } catch (error) { next(error); }
});

app.get('/api/devotionals', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT id, title, scripture_reference, scripture_text, reflection, prayer, audience, published_at, created_at FROM devotionals WHERE status='published' AND deleted_at IS NULL ORDER BY published_at DESC LIMIT 100`);
    res.json({ devotionals: rows });
  } catch (error) { next(error); }
});
app.post('/api/devotionals', requireAuth, requireVerified, requireCsrf, requireRole('admin', 'moderator'), async (req, res, next) => {
  try {
    const data = z.object({ title: z.string().trim().min(1).max(180), scriptureReference: z.string().trim().min(1).max(180), scriptureText: z.string().trim().max(12_000).nullable().optional(), reflection: z.string().trim().min(1).max(30_000), prayer: z.string().trim().min(1).max(12_000), audience: z.string().trim().max(48).nullable().optional(), status: z.enum(['draft', 'scheduled', 'published']).default('draft'), publishedAt: z.string().datetime().nullable().optional() }).parse(req.body);
    const { rows } = await query(
      `INSERT INTO devotionals(author_id,title,scripture_reference,scripture_text,reflection,prayer,audience,status,published_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.id, data.title, data.scriptureReference, data.scriptureText || null, data.reflection, data.prayer, data.audience || null, data.status, data.status === 'published' ? (data.publishedAt || now()) : data.publishedAt || null],
    );
    res.status(201).json({ devotional: rows[0] });
  } catch (error) { next(error); }
});

app.get('/api/admin/devotionals', requireAuth, requireRole('admin', 'moderator'), async (req, res, next) => {
  try {
    const status = req.query.status ? z.enum(['draft', 'scheduled', 'published', 'archived']).parse(req.query.status) : null;
    const { rows } = await query(`SELECT d.*, u.name AS author_name FROM devotionals d LEFT JOIN users u ON u.id = d.author_id WHERE d.deleted_at IS NULL ${status ? 'AND d.status = $1' : ''} ORDER BY d.updated_at DESC LIMIT 250`, status ? [status] : []);
    res.json({ devotionals: rows });
  } catch (error) { next(error); }
});
app.put('/api/devotionals/:id', requireAuth, requireVerified, requireCsrf, requireRole('admin', 'moderator'), async (req, res, next) => {
  try {
    const data = z.object({ title: z.string().trim().min(1).max(180), scriptureReference: z.string().trim().min(1).max(180), scriptureText: z.string().trim().max(12_000).nullable().optional(), reflection: z.string().trim().min(1).max(30_000), prayer: z.string().trim().min(1).max(12_000), audience: z.string().trim().max(48).nullable().optional(), status: z.enum(['draft', 'scheduled', 'published', 'archived']), publishedAt: z.string().datetime().nullable().optional() }).parse(req.body);
    if (data.status === 'scheduled' && !data.publishedAt) return res.status(400).json({ error: { code: 'SCHEDULE_REQUIRED', message: 'Scheduled devotionals require a publication time.' } });
    const publishedAt = data.status === 'published' ? (data.publishedAt || now()) : data.publishedAt || null;
    const { rows } = await query(`UPDATE devotionals SET title=$2, scripture_reference=$3, scripture_text=$4, reflection=$5, prayer=$6, audience=$7, status=$8, published_at=$9, updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING *`, [req.params.id, data.title, data.scriptureReference, data.scriptureText || null, data.reflection, data.prayer, data.audience || null, data.status, publishedAt]);
    if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Devotional not found.' } });
    await audit({ requestId: req.requestId, actorId: req.user.id, action: 'devotional.updated', entityType: 'devotional', entityId: req.params.id, ip: req.ip, metadata: { status: data.status } });
    res.json({ devotional: rows[0] });
  } catch (error) { next(error); }
});
app.delete('/api/devotionals/:id', requireAuth, requireCsrf, requireRole('admin', 'moderator'), async (req, res, next) => {
  try {
    const result = await query(`UPDATE devotionals SET deleted_at = now() WHERE id=$1 AND deleted_at IS NULL`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Devotional not found.' } });
    await audit({ requestId: req.requestId, actorId: req.user.id, action: 'devotional.deleted', entityType: 'devotional', entityId: req.params.id, ip: req.ip });
    res.status(204).end();
  } catch (error) { next(error); }
});
app.post('/api/devotionals/:id/favorite', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const exists = await query(`SELECT id FROM devotionals WHERE id=$1 AND status='published' AND deleted_at IS NULL`, [req.params.id]);
    if (!exists.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Devotional not found.' } });
    await query(`INSERT INTO devotional_favorites(devotional_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, [req.params.id, req.user.id]);
    res.status(204).end();
  } catch (error) { next(error); }
});
app.delete('/api/devotionals/:id/favorite', requireAuth, requireCsrf, async (req, res, next) => {
  try { await query(`DELETE FROM devotional_favorites WHERE devotional_id=$1 AND user_id=$2`, [req.params.id, req.user.id]); res.status(204).end(); }
  catch (error) { next(error); }
});

app.get('/api/documents', requireAuth, async (req, res, next) => {
  try {
    const type = req.query.type ? z.enum(['sermon', 'liturgy', 'family_devotional', 'youth_content', 'little_lambs']).parse(req.query.type) : null;
    const { rows } = await query(`SELECT * FROM generated_documents WHERE user_id=$1 AND deleted_at IS NULL ${type ? 'AND type=$2' : ''} ORDER BY updated_at DESC`, type ? [req.user.id, type] : [req.user.id]);
    res.json({ documents: rows });
  } catch (error) { next(error); }
});
app.post('/api/documents', requireAuth, requireVerified, requireCsrf, async (req, res, next) => {
  try {
    const data = documentSchema.parse(req.body);
    const { rows } = await query(`INSERT INTO generated_documents(user_id,type,title,content,metadata) VALUES($1,$2,$3,$4,$5) RETURNING *`, [req.user.id, data.type, data.title, data.content, data.metadata]);
    res.status(201).json({ document: rows[0] });
  } catch (error) { next(error); }
});
app.put('/api/documents/:id', requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const data = documentSchema.omit({ type: true }).parse(req.body);
    const { rows } = await query(`UPDATE generated_documents SET title=$3, content=$4, metadata=$5 WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL RETURNING *`, [req.params.id, req.user.id, data.title, data.content, data.metadata]);
    if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found.' } });
    res.json({ document: rows[0] });
  } catch (error) { next(error); }
});

app.get('/api/media/:kind', requireAuth, async (req, res, next) => {
  try {
    const kind = z.enum(['bible_audio', 'worship_music']).parse(req.params.kind);
    const { rows } = await query(`SELECT id, kind, provider, provider_item_id, title, artist, collection, stream_url, duration_seconds, locale, license_reference, metadata FROM media_items WHERE kind=$1 AND is_active=true ORDER BY title`, [kind]);
    res.json({ available: rows.length > 0, items: rows, message: rows.length ? undefined : 'Licensed media is not configured yet.' });
  } catch (error) { next(error); }
});

app.post('/api/contact', authLimiter, requireCsrf, async (req, res, next) => {
  try {
    const data = contactSchema.parse(req.body);
    const { rows } = await query(`INSERT INTO contact_messages(name,email,subject,message) VALUES($1,$2,$3,$4) RETURNING id, created_at`, [data.name, data.email.toLowerCase(), data.subject, data.message]);
    await audit({ requestId: req.requestId, action: 'contact.submitted', entityType: 'contact_message', entityId: rows[0].id, ip: req.ip });
    res.status(201).json({ ok: true });
  } catch (error) { next(error); }
});
app.post('/api/newsletter/subscribe', authLimiter, requireCsrf, async (req, res, next) => {
  try {
    const email = z.string().email().max(254).parse(req.body?.email).toLowerCase();
    await query(`INSERT INTO newsletter_subscriptions(email) VALUES($1) ON CONFLICT(email) DO UPDATE SET unsubscribed_at=NULL, updated_at=now()`, [email]);
    res.status(202).json({ ok: true, message: 'Subscription request received.' });
  } catch (error) { next(error); }
});
app.post('/api/newsletter/unsubscribe', requireCsrf, async (req, res, next) => {
  try {
    const email = z.string().email().max(254).parse(req.body?.email).toLowerCase();
    await query(`UPDATE newsletter_subscriptions SET unsubscribed_at=now() WHERE email=$1`, [email]);
    res.status(204).end();
  } catch (error) { next(error); }
});

const payfastSign = (payload) => {
  const serialized = Object.entries(payload)
    .filter(([key, value]) => key !== 'signature' && value !== undefined && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key).replace(/%20/g, '+')}=${encodeURIComponent(String(value).trim()).replace(/%20/g, '+')}`)
    .join('&');
  return crypto.createHash('md5').update(config.payfastPassphrase ? `${serialized}&passphrase=${encodeURIComponent(config.payfastPassphrase)}` : serialized).digest('hex');
};

app.post('/api/payments/checkout', requireAuth, requireVerified, requireCsrf, async (req, res, next) => {
  try {
    const data = z.object({ planCode: z.enum(['individual', 'family', 'church']), amountCents: z.number().int().positive().max(10_000_000) }).parse(req.body);
    if (!config.payfastMerchantId || !config.payfastMerchantKey || !config.payfastNotifyUrl) return res.status(503).json({ error: { code: 'PAYMENT_NOT_CONFIGURED', message: 'Payments are not configured.' } });
    const idempotencyKey = crypto.randomUUID();
    const paymentId = crypto.randomUUID();
    const amount = (data.amountCents / 100).toFixed(2);
    const payload = {
      merchant_id: config.payfastMerchantId, merchant_key: config.payfastMerchantKey, return_url: config.payfastReturnUrl,
      cancel_url: config.payfastCancelUrl, notify_url: config.payfastNotifyUrl, m_payment_id: paymentId, amount,
      item_name: `FaithHaven ${data.planCode} subscription`, email_address: req.user.email,
    };
    await query(`INSERT INTO payments(user_id, provider_payment_id, plan_code, amount_cents, currency, status, idempotency_key) VALUES($1,$2,$3,$4,'ZAR','pending',$5)`, [req.user.id, paymentId, data.planCode, data.amountCents, idempotencyKey]);
    res.json({ endpoint: config.payfastEndpoint, payload, signature: payfastSign(payload) });
  } catch (error) { next(error); }
});
app.post('/api/payments/payfast/itn', express.urlencoded({ extended: false, limit: '100kb' }), async (req, res, next) => {
  try {
    const payload = req.body;
    const sourceIp = String(req.get('x-forwarded-for') || req.ip || '').split(',')[0].trim();
    if (config.payfastIpWhitelist.length && !config.payfastIpWhitelist.includes(sourceIp)) return res.status(403).send('Forbidden');
    const receivedSignature = String(payload.signature || '').toLowerCase();
    const expectedSignature = payfastSign(payload).toLowerCase();
    if (!receivedSignature || receivedSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature))) return res.status(400).send('Invalid signature');
    if (!config.payfastMerchantId || payload.merchant_id !== config.payfastMerchantId) return res.status(400).send('Invalid merchant');

    const outcome = await withTransaction(async (client) => {
      const payment = await client.query(`SELECT * FROM payments WHERE provider_payment_id=$1 FOR UPDATE`, [payload.m_payment_id]);
      const row = payment.rows[0];
      if (!row) { const error = new Error('Unknown payment'); error.status = 404; throw error; }
      const amountCents = Math.round(Number(payload.amount_gross) * 100);
      if (!Number.isSafeInteger(amountCents) || amountCents !== row.amount_cents || payload.currency !== row.currency) { const error = new Error('Invalid amount'); error.status = 400; throw error; }
      if (row.status === 'complete') return { duplicate: true, row, status: 'complete' };
      const rawStatus = String(payload.payment_status || '').toUpperCase();
      const status = rawStatus === 'COMPLETE' ? 'complete' : rawStatus === 'CANCELLED' ? 'cancelled' : 'failed';
      await client.query(`UPDATE payments SET status=$2::varchar, paid_at=CASE WHEN $2::text='complete' THEN now() ELSE NULL END, provider_payload=$3, updated_at=now() WHERE id=$1`, [row.id, status, JSON.stringify(payload)]);
      if (status === 'complete') {
        const subscription = await client.query(`INSERT INTO subscriptions(user_id, plan_code, status, started_at, metadata) VALUES($1, $2, 'active', now(), $3) RETURNING id`, [row.user_id, row.plan_code, JSON.stringify({ providerPaymentId: row.provider_payment_id })]);
        await client.query(`UPDATE payments SET subscription_id=$2 WHERE id=$1`, [row.id, subscription.rows[0].id]);
        const quota = row.plan_code === 'church' ? 1_000 : row.plan_code === 'family' ? 400 : 200;
        await client.query(`UPDATE users SET subscription_plan=$2, ai_quota_monthly=$3 WHERE id=$1`, [row.user_id, row.plan_code === 'church' ? 'congregation' : row.plan_code, quota]);
      }
      return { duplicate: false, row, status };
    });
    if (!outcome.duplicate) await audit({ requestId: req.requestId, actorId: outcome.row.user_id, action: `payment.${outcome.status}`, entityType: 'payment', entityId: outcome.row.id, ip: req.ip });
    res.status(200).send('OK');
  } catch (error) { next(error); }
});

app.get('/api/admin/stats', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT (SELECT count(*)::int FROM users WHERE deleted_at IS NULL) total_users, (SELECT count(*)::int FROM subscriptions WHERE status='active') active_subscribers, (SELECT COALESCE(sum(amount_cents),0)::int FROM payments WHERE status='complete') total_revenue_cents, (SELECT count(*)::int FROM ai_requests WHERE status='succeeded') ai_requests, (SELECT count(*)::int FROM prayer_wall_posts WHERE deleted_at IS NULL) prayer_posts, (SELECT count(*)::int FROM devotionals WHERE status='published') published_devotionals`);
    res.json({ stats: rows[0] });
  } catch (error) { next(error); }
});
app.get('/api/admin/subscribers', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT u.id, u.name, u.email, s.status, s.plan_code AS plan FROM subscriptions s JOIN users u ON u.id = s.user_id WHERE u.deleted_at IS NULL ORDER BY s.created_at DESC LIMIT 100`);
    res.json({ subscribers: rows.map((row) => ({ id: row.id, name: row.name, email: row.email, status: row.status === 'active' ? 'active' : 'inactive', plan: row.plan })) });
  } catch (error) { next(error); }
});

app.get('/api/admin/audit-logs', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT id, request_id, actor_id, action, entity_type, entity_id, metadata, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 250`);
    res.json({ logs: rows });
  } catch (error) { next(error); }
});
app.get('/api/admin/moderation/reports', requireAuth, requireRole('admin', 'moderator'), async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT r.*, p.content FROM prayer_wall_reports r JOIN prayer_wall_posts p ON p.id=r.post_id WHERE r.status='open' ORDER BY r.created_at ASC LIMIT 250`);
    res.json({ reports: rows });
  } catch (error) { next(error); }
});

app.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' } }));
app.use((error, req, res, _next) => {
  const status = error.status || (error instanceof z.ZodError ? 400 : error instanceof GenXUnavailableError ? 503 : 500);
  const code = error.code || (error instanceof z.ZodError ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR');
  if (status >= 500) console.error(JSON.stringify({ level: 'error', requestId: req.requestId, code, message: error.message }));
  res.status(status).json({ error: { code, message: status >= 500 ? (error instanceof GenXUnavailableError ? error.message : 'An unexpected error occurred.') : error.message } });
});

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(config.port, () => console.log(JSON.stringify({ level: 'info', event: 'server_started', port: config.port })));
  const shutdown = async () => { server.close(async () => { await getPool().end(); process.exit(0); }); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export { app, passwordHash, verifyPassword, payfastSign };
