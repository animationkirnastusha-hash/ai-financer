import multer from 'multer';
import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { BadRequestError } from '../../shared/core/errors';
import { receiptScanService } from './service';

export const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
});

type ReceiptUploadRequest = Request & { file?: Express.Multer.File };

function requireUserId(req: Request): string {
  if (!req.userId) throw new BadRequestError('Unauthorized user');
  return req.userId;
}

export const listReceiptScans = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  res.json({ items: await receiptScanService.list(userId) });
});

export const uploadReceiptScan = asyncHandler(async (req: ReceiptUploadRequest, res: Response) => {
  const userId = requireUserId(req);
  const file = req.file;
  if (!file) throw new BadRequestError('Receipt file is required');

  const result = await receiptScanService.create(userId, {
    fileName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
  });

  res.status(201).json(result);
});

export const getReceiptScan = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const receiptScanId = typeof req.params.receiptScanId === 'string' ? req.params.receiptScanId : '';
  if (!receiptScanId) throw new BadRequestError('Receipt scan is required');
  res.json(await receiptScanService.get(userId, receiptScanId));
});
