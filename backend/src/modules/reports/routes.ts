import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { downloadReport, getReportPreview } from './controller';

const router = Router();

router.use(authMiddleware);
router.get('/preview', getReportPreview);
router.get('/download', downloadReport);

export default router;
