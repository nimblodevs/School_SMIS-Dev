import { Router } from 'express';
import { FinanceController } from './finance.controller.js';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { authorizeRoles } from '../../api/middlewares/roleMiddleware.js';

const router = Router();

router.use(authenticate, authorizeRoles('ADMIN', 'BURSAR', 'MANAGER'));
router.post('/invoices/generate', FinanceController.generateTermInvoices);
router.post('/payments', FinanceController.recordPayment);
router.post('/payments/:paymentId/reverse', FinanceController.reversePayment);
router.post('/payments/:paymentId/refund', FinanceController.refundPayment);
router.post('/credits/apply', FinanceController.applyCredit);

export default router;