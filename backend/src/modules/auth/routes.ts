import { Router } from 'express';
import { login, getMe } from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.post('/login', login);
router.get('/me', authMiddleware, getMe);

export default router;