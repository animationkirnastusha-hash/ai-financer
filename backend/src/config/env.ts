import dotenv from 'dotenv';

dotenv.config();

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;

  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }

  return parsed;
}

function getBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;

  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

export const env = {
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: getNumberEnv('PORT', 3000),
  databaseUrl: getEnv('DATABASE_URL'),
  jwtSecret: getEnv('JWT_SECRET', 'dev-secret'),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  adminTelegramId: process.env.ADMIN_TELEGRAM_ID ?? '',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? '',

  aiMode: getEnv('AI_MODE', 'ollama'),
  aiDebug: getBooleanEnv('AI_DEBUG', false),

  ollamaBaseUrl: getEnv('OLLAMA_BASE_URL', 'http://127.0.0.1:11434'),
  ollamaModel: getEnv('OLLAMA_MODEL', 'qwen2.5:3b'),
  ollamaFastModel: getEnv('OLLAMA_FAST_MODEL', getEnv('OLLAMA_MODEL', 'qwen2.5:3b')),
  ollamaFreeReasoningModel: getEnv('OLLAMA_FREE_REASONING_MODEL', getEnv('OLLAMA_MODEL', 'qwen2.5:3b')),
  ollamaPremiumModel: getEnv('OLLAMA_PREMIUM_MODEL', getEnv('OLLAMA_MODEL', 'qwen2.5:7b')),

  aiLlmTimeoutMs: getNumberEnv('AI_LLM_TIMEOUT_MS', getNumberEnv('OLLAMA_TIMEOUT_MS', 45_000)),
  ollamaTimeoutMs: getNumberEnv('OLLAMA_TIMEOUT_MS', getNumberEnv('AI_LLM_TIMEOUT_MS', 45_000)),
  ollamaNumCtx: getNumberEnv('OLLAMA_NUM_CTX', 1024),
  ollamaNumPredict: getNumberEnv('OLLAMA_NUM_PREDICT', 160),

  frontendUrl: getEnv('FRONTEND_URL', 'http://localhost:5173'),
  enableCron: getBooleanEnv('ENABLE_CRON', true),
  isDevelopment: (process.env.NODE_ENV ?? 'development') === 'development',
  isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
} as const;
