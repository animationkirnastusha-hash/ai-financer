import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import {
  createReceiptExpense,
  getReceiptScan,
  listReceiptScans,
  receiptUpload,
  reviewReceiptScan,
  uploadReceiptScan,
} from './controller';

const router = Router();

router.use(authMiddleware);
router.get('/', listReceiptScans);
router.post('/upload', receiptUpload.single('receipt'), uploadReceiptScan);
router.get('/:receiptScanId', getReceiptScan);
router.patch('/:receiptScanId/review', reviewReceiptScan);
router.post('/:receiptScanId/expense', createReceiptExpense);

export default router;
