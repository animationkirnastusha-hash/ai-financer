import dotenv from 'dotenv';

dotenv.config({ override: true });

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') throw new Error(`Missing required environment variable: ${name}`);
  return value;
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

export type AIProviderName = 'deepseek';

const aiProvider = getEnv('AI_PROVIDER', getEnv('AI_MODE', 'deepseek')).toLowerCase() as AIProviderName;

if (aiProvider !== 'deepseek') {
  throw new Error(`Unsupported AI_PROVIDER=${aiProvider}. Current backend pack supports AI_PROVIDER=deepseek.`);
}

export const env = {
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: getNumberEnv('PORT', 3000),
  databaseUrl: getEnv('DATABASE_URL'),
  jwtSecret: getEnv('JWT_SECRET', 'dev-secret'),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  adminTelegramId: process.env.ADMIN_TELEGRAM_ID ?? '',

  aiProvider,
  aiMode: getEnv('AI_MODE', aiProvider),
  aiDebug: getBooleanEnv('AI_DEBUG', false),
  aiFastTimeoutMs: getNumberEnv('AI_FAST_TIMEOUT_MS', 8_000),
  aiLlmTimeoutMs: getNumberEnv('AI_LLM_TIMEOUT_MS', getNumberEnv('AI_TIMEOUT_MS', 12_000)),

  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? '',
  deepseekBaseUrl: getEnv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com'),
  deepseekModel: getEnv('DEEPSEEK_MODEL', 'deepseek-chat'),
  deepseekFastModel: getEnv('DEEPSEEK_FAST_MODEL', getEnv('DEEPSEEK_MODEL', 'deepseek-chat')),
  deepseekReasoningModel: getEnv('DEEPSEEK_REASONING_MODEL', 'deepseek-reasoner'),

  // Compatibility only. These prevent stale unused provider files from breaking typecheck.
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
  ollamaModel: process.env.OLLAMA_MODEL ?? '',
  ollamaFastModel: process.env.OLLAMA_FAST_MODEL ?? '',
  ollamaFreeReasoningModel: process.env.OLLAMA_FREE_REASONING_MODEL ?? '',
  ollamaPremiumModel: process.env.OLLAMA_PREMIUM_MODEL ?? '',
  ollamaTimeoutMs: getNumberEnv('OLLAMA_TIMEOUT_MS', 60_000),
  ollamaNumCtx: getNumberEnv('OLLAMA_NUM_CTX', 768),
  ollamaNumPredict: getNumberEnv('OLLAMA_NUM_PREDICT', 64),
  groqApiKey: process.env.GROQ_API_KEY ?? '',
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? '',

  frontendUrl: getEnv('FRONTEND_URL', 'http://localhost:5173'),
  enableCron: getBooleanEnv('ENABLE_CRON', true),
  isDevelopment: (process.env.NODE_ENV ?? 'development') === 'development',
  isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
} as const;
