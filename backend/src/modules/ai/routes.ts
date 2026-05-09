import { Router } from 'express';
import {
  parseCommand,
  confirmCommand,
  cancelCommand,
  updatePendingAction,
  getPendingActions,
  getAuditLogs,
  undoCommand,
} from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/pending-actions', getPendingActions);
router.get('/audit-logs', getAuditLogs);

router.post('/parse', parseCommand);
router.post('/confirm', confirmCommand);
router.post('/cancel', cancelCommand);
router.post('/undo', undoCommand);
router.patch('/pending-actions/:pendingActionId', updatePendingAction);

export default router;
