const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const env = {
  apiBaseUrl: trimTrailingSlash(
    import.meta.env.VITE_API_BASE_URL || '/api',
  ),
};