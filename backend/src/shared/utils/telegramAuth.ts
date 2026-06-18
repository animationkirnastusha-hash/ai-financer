import crypto from 'crypto';

export type TelegramInitDataUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
};
export type TelegramUser = TelegramInitDataUser;

const DEFAULT_MAX_INIT_DATA_AGE_SEC = 24 * 60 * 60;

function getMaxInitDataAgeSec() {
  const raw = process.env.TELEGRAM_INIT_DATA_MAX_AGE_SEC;
  if (!raw) return DEFAULT_MAX_INIT_DATA_AGE_SEC;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_INIT_DATA_AGE_SEC;
}

export function verifyTelegramWebAppData(
  initData: string,
  botToken: string,
): boolean {
  if (!initData || !botToken) return false;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  const authDate = Number(params.get('auth_date'));

  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return false;
  if (!Number.isFinite(authDate)) return false;

  const nowSec = Math.floor(Date.now() / 1000);
  const ageSec = nowSec - authDate;
  if (ageSec < 0 || ageSec > getMaxInitDataAgeSec()) return false;

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
