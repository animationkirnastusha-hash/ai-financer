import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import {
  createLoan,
  createReminder,
  deleteLoan,
  getLoan,
  getLoans,
  getObligationSummary,
  getReminders,
  markLoanPaid,
  updateLoan,
  updateReminderStatus,
} from './controller';

const router = Router();

router.use(authMiddleware);

router.get('/summary', getObligationSummary);
router.get('/loans', getLoans);
router.post('/loans', createLoan);
router.get('/loans/:id', getLoan);
router.patch('/loans/:id', updateLoan);
router.delete('/loans/:id', deleteLoan);
router.post('/loans/:id/payments', markLoanPaid);
router.get('/reminders', getReminders);
router.post('/reminders', createReminder);
router.patch('/reminders/:id', updateReminderStatus);

export default router;
