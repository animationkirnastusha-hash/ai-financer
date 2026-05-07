import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { createSection, deleteSection, getSections, updateSection } from './controller';

const router = Router();

router.use(authMiddleware);

router.get('/', getSections);
router.post('/', createSection);
router.put('/:id', updateSection);
router.delete('/:id', deleteSection);

export default router;
