import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../shared/core/errors';
import { env } from '../config/env';

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: {
        message: error.message,
        code: error.code,
        details: error.details ?? null,
      },
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: {
          message: 'Unique constraint violation',
          code: 'UNIQUE_CONSTRAINT',
          details: error.meta ?? null,
        },
      });
    }

    if (error.code === 'P2025') {
      return res.status(404).json({
        error: {
          message: 'Record not found',
          code: 'RECORD_NOT_FOUND',
          details: error.meta ?? null,
        },
      });
    }
  }

  if (error instanceof Error) {
    return res.status(500).json({
      error: {
        message: env.isProduction ? 'Internal server error' : error.message,
        code: 'INTERNAL_SERVER_ERROR',
        details: env.isProduction ? null : error.stack,
      },
    });
  }

  return res.status(500).json({
    error: {
      message: 'Unknown server error',
      code: 'UNKNOWN_ERROR',
      details: null,
    },
  });
}