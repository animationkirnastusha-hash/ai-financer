const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const env = {
  apiBaseUrl: trimTrailingSlash(
    import.meta.env.VITE_API_BASE_URL || '/api',
  ),
  telegramBotUrl: String(import.meta.env.VITE_TELEGRAM_BOT_URL || '').trim(),
};
