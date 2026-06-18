import crypto from 'crypto';

type PublicUserIdSource = {
  id: string;
  telegramId?: bigint | number | string | null;
};

function stableSource(user: PublicUserIdSource) {
  const telegram = user.telegramId === null || user.telegramId === undefined ? '' : user.telegramId.toString();
  return `${user.id}:${telegram}`;
}

export function createPublicUserId(user: PublicUserIdSource) {
  const hash = crypto.createHash('sha256').update(stableSource(user)).digest();
  const value = hash.readUInt32BE(0) % 90_000;
  return String(10_000 + value).padStart(5, '0');
}
