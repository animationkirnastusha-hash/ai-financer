import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

const buckets = new Map<string, { count: number; resetAt: number }>();

function getClientKey(req: Request) {
  const auth = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  if (auth.startsWith('Bearer ')) {
    return `auth:${crypto.createHash('sha256').update(auth).digest('hex').slice(0, 24)}`;
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const firstForwardedIp = typeof forwardedIp === 'string' ? forwardedIp.split(',')[0]?.trim() : '';

  return String(req.userId ?? firstForwardedIp ?? req.ip ?? 'anonymous');
}

export function rateLimit(options: { windowMs: number; max: number }) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') return next();

    const now = Date.now();
    const key = getClientKey(req);
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    current.count += 1;

    if (current.count > options.max) {
      return res.status(429).json({
        error: {
          message: 'Слишком много запросов. Попробуй ещё раз через минуту.',
          code: 'RATE_LIMITED',
        },
      });
    }

    return next();
  };
}
