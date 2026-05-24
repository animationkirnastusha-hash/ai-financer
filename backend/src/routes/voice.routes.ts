import { Router } from 'express';
import multer from 'multer';

import { authMiddleware } from '../middleware/auth';
import { getVoiceStatus, transcribeVoice } from '../controllers/voice.controller';

const router = Router();
const maxAudioMb = Number(process.env.VOICE_MAX_AUDIO_MB || 8);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Math.min(25, Math.max(1, Number.isFinite(maxAudioMb) ? maxAudioMb : 8)) * 1024 * 1024,
    files: 1,
  },
});

router.get('/status', authMiddleware, getVoiceStatus);
router.post('/transcribe', authMiddleware, upload.single('audio'), transcribeVoice);

export default router;
