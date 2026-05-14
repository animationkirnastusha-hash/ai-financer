import dotenv from 'dotenv';

dotenv.config();

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

const DEFAULT_OPENROUTER_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';

const aiProvider = (process.env.AI_PROVIDER || process.env.AI_MODE || 'openrouter').trim().toLowerCase();

export const env = {
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: getNumberEnv('PORT', 3000),
  databaseUrl: getEnv('DATABASE_URL'),
  jwtSecret: getEnv('JWT_SECRET', 'dev-secret'),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  adminTelegramId: process.env.ADMIN_TELEGRAM_ID ?? '',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? '',

  aiMode: getEnv('AI_MODE', aiProvider),
  aiProvider,
  aiDebug: getBooleanEnv('AI_DEBUG', false),

  openrouterApiKey: getOptionalEnv('OPENROUTER_API_KEY'),
  openrouterBaseUrl: getOptionalEnv('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
  openrouterModel: getOptionalEnv('OPENROUTER_MODEL', DEFAULT_OPENROUTER_MODEL),
  openrouterFastModel: getOptionalEnv('OPENROUTER_FAST_MODEL', getOptionalEnv('OPENROUTER_MODEL', DEFAULT_OPENROUTER_MODEL)),
  openrouterReasoningModel: getOptionalEnv('OPENROUTER_REASONING_MODEL', getOptionalEnv('OPENROUTER_MODEL', DEFAULT_OPENROUTER_MODEL)),
  openrouterAppTitle: getOptionalEnv('OPENROUTER_APP_TITLE', 'AI-financer'),

  groqApiKey: getOptionalEnv('GROQ_API_KEY'),
  groqBaseUrl: getOptionalEnv('GROQ_BASE_URL', 'https://api.groq.com/openai/v1'),
  groqModel: getOptionalEnv('GROQ_MODEL', 'llama-3.1-8b-instant'),
  groqFastModel: getOptionalEnv('GROQ_FAST_MODEL', getOptionalEnv('GROQ_MODEL', 'llama-3.1-8b-instant')),


  aiFastTimeoutMs: getNumberEnv('AI_FAST_TIMEOUT_MS', 8_000),
  aiLlmTimeoutMs: getNumberEnv('AI_LLM_TIMEOUT_MS', getNumberEnv('AI_TIMEOUT_MS', getNumberEnv('OLLAMA_TIMEOUT_MS', 60_000))),
  aiTimeoutMs: getNumberEnv('AI_TIMEOUT_MS', 10_000),

  frontendUrl: getEnv('FRONTEND_URL', 'http://localhost:5173'),
  enableCron: getBooleanEnv('ENABLE_CRON', true),
  isDevelopment: (process.env.NODE_ENV ?? 'development') === 'development',
  isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
} as const;
