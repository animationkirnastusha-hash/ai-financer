import { Router } from 'express';
import multer from 'multer';

import { authMiddleware } from '../middleware/auth';
import { transcribeVoice } from '../controllers/voice.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/transcribe', authMiddleware, upload.single('audio'), transcribeVoice);

export default router;