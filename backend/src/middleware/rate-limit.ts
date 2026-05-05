import { NextFunction, Request, Response } from 'express';

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(options: { windowMs: number; max: number }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = String(req.userId ?? req.ip ?? req.headers['x-forwarded-for'] ?? 'anonymous');
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
