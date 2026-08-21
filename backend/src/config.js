import dotenv from 'dotenv';

dotenv.config();

const asList = (value = '') => value.split(',').map((item) => item.trim()).filter(Boolean);
const asNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isProduction = process.env.NODE_ENV === 'production';

export const config = Object.freeze({
  env: process.env.NODE_ENV || 'development',
  isProduction,
  port: asNumber(process.env.PORT, 4000),
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: process.env.DATABASE_SSL === 'true',
  corsOrigins: asList(process.env.CORS_ORIGIN),
  trustProxy: process.env.TRUST_PROXY === 'true' || isProduction,
  jwtSecret: process.env.JWT_SECRET || '',
  jwtIssuer: process.env.JWT_ISSUER || 'faithhaven',
  jwtAudience: process.env.JWT_AUDIENCE || 'faithhaven-web',
  accessTokenMinutes: asNumber(process.env.ACCESS_TOKEN_TTL_MINUTES, 15),
  refreshTokenDays: asNumber(process.env.REFRESH_TOKEN_TTL_DAYS, 30),
  cookieSecure: process.env.COOKIE_SECURE === 'true' || isProduction,
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  csrfCookieName: process.env.CSRF_COOKIE_NAME || 'fh_csrf',
  refreshCookieName: process.env.REFRESH_COOKIE_NAME || 'fh_refresh',
  authRateLimitWindowMs: asNumber(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  authRateLimitMax: asNumber(process.env.AUTH_RATE_LIMIT_MAX, 10),
  apiRateLimitWindowMs: asNumber(process.env.API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  apiRateLimitMax: asNumber(process.env.API_RATE_LIMIT_MAX, 300),
  aiRateLimitWindowMs: asNumber(process.env.AI_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
  aiRateLimitMax: asNumber(process.env.AI_RATE_LIMIT_MAX, 20),
  genxApiKey: process.env.GENX_API_KEY || '',
  genxApiUrl: process.env.GENX_API_URL || '',
  genxModel: process.env.GENX_MODEL || 'faithhaven-default',
  genxTimeoutMs: asNumber(process.env.GENX_TIMEOUT_MS, 30_000),
  smtpUrl: process.env.SMTP_URL || '',
  emailFrom: process.env.EMAIL_FROM || '',
  appUrl: process.env.APP_URL || '',
  payfastMerchantId: process.env.PAYFAST_MERCHANT_ID || '',
  payfastMerchantKey: process.env.PAYFAST_MERCHANT_KEY || '',
  payfastPassphrase: process.env.PAYFAST_PASSPHRASE || '',
  payfastEndpoint: process.env.PAYFAST_ENDPOINT || 'https://sandbox.payfast.co.za/eng/process',
  payfastReturnUrl: process.env.PAYFAST_RETURN_URL || '',
  payfastCancelUrl: process.env.PAYFAST_CANCEL_URL || '',
  payfastNotifyUrl: process.env.PAYFAST_NOTIFY_URL || '',
  payfastIpWhitelist: asList(process.env.PAYFAST_IP_WHITELIST),
  mediaProviderUrl: process.env.MEDIA_PROVIDER_URL || '',
  mediaProviderKey: process.env.MEDIA_PROVIDER_KEY || '',
});

export function assertProductionConfiguration() {
  if (!config.isProduction) return;

  const missing = [];
  if (!config.databaseUrl) missing.push('DATABASE_URL');
  if (config.jwtSecret.length < 32 || config.jwtSecret === 'change-me') missing.push('JWT_SECRET');
  if (!config.appUrl.startsWith('https://')) missing.push('APP_URL (https URL)');
  if (!config.corsOrigins.length || config.corsOrigins.includes('*')) missing.push('CORS_ORIGIN (specific https origin)');
  if (!config.emailFrom || !config.smtpUrl) missing.push('EMAIL_FROM and SMTP_URL');
  if (!config.genxApiKey || !config.genxApiUrl) missing.push('GENX_API_KEY and GENX_API_URL');
  if (!config.payfastMerchantId || !config.payfastMerchantKey || !config.payfastNotifyUrl) {
    missing.push('PAYFAST production configuration');
  }

  if (missing.length) {
    throw new Error(`Missing or unsafe production configuration: ${missing.join(', ')}`);
  }
}
