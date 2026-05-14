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

const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';

export const env = {
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: getNumberEnv('PORT', 3000),
  databaseUrl: getEnv('DATABASE_URL'),
  jwtSecret: getEnv('JWT_SECRET', 'dev-secret'),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  adminTelegramId: process.env.ADMIN_TELEGRAM_ID ?? '',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? '',

  aiMode: getEnv('AI_MODE', getEnv('AI_PROVIDER', 'groq')),
  aiProvider: getEnv('AI_PROVIDER', getEnv('AI_MODE', 'groq')),
  aiDebug: getBooleanEnv('AI_DEBUG', false),
  aiLlmTimeoutMs: getNumberEnv('AI_LLM_TIMEOUT_MS', getNumberEnv('AI_TIMEOUT_MS', 12_000)),
  aiFastTimeoutMs: getNumberEnv('AI_FAST_TIMEOUT_MS', getNumberEnv('AI_TIMEOUT_MS', 8_000)),

  groqApiKey: getOptionalEnv('GROQ_API_KEY'),
  groqBaseUrl: getEnv('GROQ_BASE_URL', 'https://api.groq.com/openai/v1'),
  groqModel: getEnv('GROQ_MODEL', DEFAULT_GROQ_MODEL),
  groqFastModel: getEnv('GROQ_FAST_MODEL', getEnv('GROQ_MODEL', DEFAULT_GROQ_MODEL)),
  groqPremiumModel: getEnv('GROQ_PREMIUM_MODEL', getEnv('GROQ_MODEL', DEFAULT_GROQ_MODEL)),

  // Deprecated. Kept only so old imports do not break during migration.
  ollamaBaseUrl: getOptionalEnv('OLLAMA_BASE_URL', 'http://127.0.0.1:11434'),
  ollamaModel: getOptionalEnv('OLLAMA_MODEL', ''),
  ollamaFastModel: getOptionalEnv('OLLAMA_FAST_MODEL', ''),
  ollamaFreeReasoningModel: getOptionalEnv('OLLAMA_FREE_REASONING_MODEL', ''),
  ollamaPremiumModel: getOptionalEnv('OLLAMA_PREMIUM_MODEL', ''),
  ollamaTimeoutMs: getNumberEnv('OLLAMA_TIMEOUT_MS', 60_000),
  ollamaNumCtx: getNumberEnv('OLLAMA_NUM_CTX', 768),
  ollamaNumPredict: getNumberEnv('OLLAMA_NUM_PREDICT', 64),

  frontendUrl: getEnv('FRONTEND_URL', 'http://localhost:5173'),
  enableCron: getBooleanEnv('ENABLE_CRON', true),
  isDevelopment: (process.env.NODE_ENV ?? 'development') === 'development',
  isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
} as const;
