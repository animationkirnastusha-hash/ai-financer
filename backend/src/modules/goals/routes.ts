import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { createGoal, deleteGoal, listGoals, updateGoal } from './controller';

const router = Router();

router.use(authMiddleware);
router.get('/', listGoals);
router.post('/', createGoal);
router.patch('/:id', updateGoal);
router.delete('/:id', deleteGoal);

export default router;
