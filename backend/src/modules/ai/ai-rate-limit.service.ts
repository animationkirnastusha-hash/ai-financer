import { AppError } from '../../shared/core/errors';

type Bucket = {
  count: number;
  resetAt: number;
  lastAt: number;
};

const buckets = new Map<string, Bucket>();

const DEFAULT_LIMITS = {
  parsePerMinute: Number(process.env.AI_RATE_LIMIT_PARSE_PER_MINUTE ?? 20),
  confirmPerMinute: Number(process.env.AI_RATE_LIMIT_CONFIRM_PER_MINUTE ?? 12),
  cooldownMs: Number(process.env.AI_RATE_LIMIT_COOLDOWN_MS ?? 600),
};

class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}

export class AIRateLimitService {
  assertAllowed(params: {
    userId: string;
    scope: 'parse' | 'confirm';
    now?: number;
  }) {
    const now = params.now ?? Date.now();
    const limit = this.limitForScope(params.scope);
    const key = `${params.scope}:${params.userId}`;
    const current = buckets.get(key);

    if (current && now < current.resetAt) {
      if (now - current.lastAt < DEFAULT_LIMITS.cooldownMs) {
        throw new TooManyRequestsError('Too many AI requests. Slow down.');
      }

      if (current.count >= limit) {
        throw new TooManyRequestsError('AI rate limit exceeded. Try again later.');
      }

      current.count += 1;
      current.lastAt = now;
      buckets.set(key, current);
      return;
    }

    buckets.set(key, {
      count: 1,
      resetAt: now + 60_000,
      lastAt: now,
    });
  }

  cleanup() {
    const now = Date.now();

    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }

  private limitForScope(scope: 'parse' | 'confirm') {
    if (scope === 'confirm') return DEFAULT_LIMITS.confirmPerMinute;
    return DEFAULT_LIMITS.parsePerMinute;
  }
}

export const aiRateLimitService = new AIRateLimitService();
