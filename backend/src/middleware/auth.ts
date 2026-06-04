import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  userId?: string;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: {
        message: 'Authorization header is required',
        code: 'NO_TOKEN',
      },
    });
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      error: {
        message: 'Invalid authorization format. Use Bearer <token>',
        code: 'INVALID_AUTH_FORMAT',
      },
    });
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret, {
      issuer: process.env.AUTH_JWT_ISSUER || 'ai-financer-api',
      audience: process.env.AUTH_JWT_AUDIENCE || 'ai-financer-web',
    }) as { userId?: string; sub?: string };
    const userId = typeof decoded.userId === 'string'
      ? decoded.userId
      : typeof decoded.sub === 'string'
        ? decoded.sub
        : '';

    if (!userId) {
      return res.status(401).json({
        error: {
          message: 'Invalid token payload',
          code: 'INVALID_TOKEN_PAYLOAD',
        },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return res.status(401).json({
        error: {
          message: 'User not found. Generate a fresh token after database reset.',
          code: 'USER_NOT_FOUND',
        },
      });
    }

    req.userId = user.id;
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: {
          message: 'Invalid or expired token',
          code: 'INVALID_TOKEN',
        },
      });
    }

    return next(error);
  }
}
