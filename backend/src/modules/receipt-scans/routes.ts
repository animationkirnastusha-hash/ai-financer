import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { getReceiptScan, listReceiptScans, receiptUpload, uploadReceiptScan } from './controller';

const router = Router();

router.use(authMiddleware);
router.get('/', listReceiptScans);
router.post('/upload', receiptUpload.single('receipt'), uploadReceiptScan);
router.get('/:receiptScanId', getReceiptScan);

export default router;
