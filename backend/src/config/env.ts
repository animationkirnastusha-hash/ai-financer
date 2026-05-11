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
  if (Number.isNaN(parsed)) {
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

  aiMode: getEnv('AI_MODE', 'mock'),
  ollamaBaseUrl: getEnv('OLLAMA_BASE_URL', 'http://localhost:11434'),
  ollamaModel: getEnv('OLLAMA_MODEL', 'qwen3:14b'),
  ollamaFastModel: getEnv('OLLAMA_FAST_MODEL', 'qwen3:14b'),
  ollamaFreeReasoningModel: getEnv('OLLAMA_FREE_REASONING_MODEL', 'qwen3:14b'),
  ollamaPremiumModel: getEnv('OLLAMA_PREMIUM_MODEL', 'qwen3:14b'),
  aiLlmTimeoutMs: getNumberEnv('AI_LLM_TIMEOUT_MS', 180000),

  frontendUrl: getEnv('FRONTEND_URL', 'http://localhost:5173'),
  enableCron: getBooleanEnv('ENABLE_CRON', true),
  isDevelopment: (process.env.NODE_ENV ?? 'development') === 'development',
  isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
} as const;
