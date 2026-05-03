import crypto from 'crypto';

export type TelegramInitDataUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};
export type TelegramUser = TelegramInitDataUser;
export function verifyTelegramWebAppData(
  initData: string,
  botToken: string,
): boolean {
  if (!initData || !botToken) return false;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');

  if (!hash) return false;

  params.delete('hash');

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(calculatedHash, 'hex'),
    Buffer.from(hash, 'hex'),
  );
}

export function parseTelegramInitData(
  initData: string,
): TelegramInitDataUser | null {
  const params = new URLSearchParams(initData);
  const rawUser = params.get('user');

  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser) as TelegramInitDataUser;
  } catch {
    return null;
  }
}