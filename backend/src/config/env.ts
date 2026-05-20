import dotenv from 'dotenv';

dotenv.config({ override: true });

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') throw new Error(`Missing required environment variable: ${name}`);
  return value;
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
const DEFAULT_OPENROUTER_MODEL = 'meta-llama/llama-3.2-3b-instruct:free';
const aiProvider = (process.env.AI_PROVIDER || process.env.AI_MODE || 'deepseek').trim().toLowerCase();

export const env = {
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: getNumberEnv('PORT', 3000),
  databaseUrl: getEnv('DATABASE_URL'),
  jwtSecret: getEnv('JWT_SECRET', 'dev-secret'),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  adminTelegramId: process.env.ADMIN_TELEGRAM_ID ?? '',

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
  isDevelopment: (process.env.NODE_ENV ?? 'development') === 'development',
  isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
} as const;
