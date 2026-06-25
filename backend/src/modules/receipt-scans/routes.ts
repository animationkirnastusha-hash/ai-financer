import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import {
  createReceiptExpense,
  getReceiptScan,
  listReceiptScans,
  receiptUploadMiddleware,
  reviewReceiptScan,
  uploadReceiptScan,
} from './controller';

const router = Router();

router.use(authMiddleware);
router.get('/', listReceiptScans);
router.post('/upload', receiptUploadMiddleware, uploadReceiptScan);
router.get('/:receiptScanId', getReceiptScan);
router.patch('/:receiptScanId/review', reviewReceiptScan);
router.post('/:receiptScanId/expense', createReceiptExpense);

export default router;
