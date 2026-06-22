import dotenv from 'dotenv';

dotenv.config({ override: false });

function getEnv(name: string, fallback?: string): string {
  const value = (process.env[name] ?? fallback)?.trim();
  if (value === undefined || value === '') throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getRequiredInProduction(name: string, fallback?: string): string {
  const value = (process.env[name] ?? fallback)?.trim();
  if ((process.env.NODE_ENV ?? 'development') === 'production' && !value) {
    throw new Error(`Missing required production environment variable: ${name}`);
  }
  return value ?? '';
}

function getOptionalEnv(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function getNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`Environment variable ${name} must be a number`);
  return parsed;
}

function getBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function getListEnv(name: string, fallback: string[] = []): string[] {
  const raw = process.env[name];
  if (!raw) return fallback;

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';
const nodeEnv = process.env.NODE_ENV?.trim() || 'development';
const isProduction = nodeEnv === 'production';
const jwtSecret = getRequiredInProduction('JWT_SECRET', isProduction ? undefined : 'dev-secret-only-local');

if (isProduction && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters in production');
}

const aiProvider = (process.env.AI_PROVIDER || process.env.AI_MODE || 'deepseek').trim().toLowerCase();

export const env = {
  nodeEnv,
  port: getNumberEnv('PORT', 3000),
  databaseUrl: getEnv('DATABASE_URL'),
  jwtSecret,
  telegramBotToken: getRequiredInProduction('TELEGRAM_BOT_TOKEN'),
  telegramPaymentsWebhookSecret: getRequiredInProduction('TELEGRAM_PAYMENTS_WEBHOOK_SECRET'),
  yookassaEnabled: getBooleanEnv('YOOKASSA_ENABLED', false),
  yookassaShopId: getOptionalEnv('YOOKASSA_SHOP_ID'),
  yookassaSecretKey: getOptionalEnv('YOOKASSA_SECRET_KEY'),
  yookassaReturnUrl: getOptionalEnv('YOOKASSA_RETURN_URL'),
  adminTelegramId: process.env.ADMIN_TELEGRAM_ID ?? '',
  adminTelegramIds: getListEnv('ADMIN_TELEGRAM_IDS', [process.env.ADMIN_TELEGRAM_ID ?? ''].filter(Boolean)),

  adminAlertsEnabled: getBooleanEnv('ADMIN_ALERTS_ENABLED', false),
  adminAlertWebhookUrl: getOptionalEnv('ADMIN_ALERT_WEBHOOK_URL'),
  adminAlertCooldownMs: getNumberEnv('ADMIN_ALERT_COOLDOWN_MS', 300_000),
  apiSlowRequestMs: getNumberEnv('API_SLOW_REQUEST_MS', 2_500),
  apiErrorRateThreshold: getNumberEnv('API_ERROR_RATE_THRESHOLD', 0.2),

  aiMode: getEnv('AI_MODE', aiProvider),
  aiProvider,
  aiDebug: getBooleanEnv('AI_DEBUG', false),

  deepseekApiKey: getOptionalEnv('DEEPSEEK_API_KEY'),
  deepseekBaseUrl: getOptionalEnv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com'),
  deepseekModel: getOptionalEnv('DEEPSEEK_MODEL', DEFAULT_DEEPSEEK_MODEL),
  deepseekFastModel: getOptionalEnv('DEEPSEEK_FAST_MODEL', getOptionalEnv('DEEPSEEK_MODEL', DEFAULT_DEEPSEEK_MODEL)),
  deepseekReasoningModel: getOptionalEnv('DEEPSEEK_REASONING_MODEL', 'deepseek-reasoner'),

  aiFastTimeoutMs: getNumberEnv('AI_FAST_TIMEOUT_MS', 8_000),
  aiLlmTimeoutMs: getNumberEnv('AI_LLM_TIMEOUT_MS', getNumberEnv('AI_TIMEOUT_MS', 12_000)),
  aiTimeoutMs: getNumberEnv('AI_TIMEOUT_MS', 10_000),

  frontendUrl: getEnv('FRONTEND_URL', 'http://localhost:5173'),
  corsOrigins: getListEnv('CORS_ORIGINS', [
    'http://localhost:5173',
    'https://ai-financer.pages.dev',
  ]),
  enableCron: getBooleanEnv('ENABLE_CRON', true),
  isDevelopment: nodeEnv === 'development',
  isProduction,
} as const;
