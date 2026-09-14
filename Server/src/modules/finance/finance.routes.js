import { Router } from 'express';
import { FinanceController } from './finance.controller.js';
import { authenticate } from '../../api/middlewares/authMiddleware.js';
import { requirePermission } from '../../api/middlewares/roleMiddleware.js';

const router = Router();

router.use(authenticate);
router.post('/invoices/generate', requirePermission('fees:create'), FinanceController.generateTermInvoices);
router.post('/payments', requirePermission('fees:create'), FinanceController.recordPayment);
router.post('/payments/:paymentId/reverse', requirePermission('fees:refund'), FinanceController.reversePayment);
router.post('/payments/:paymentId/refund', requirePermission('fees:refund'), FinanceController.refundPayment);
router.post('/credits/apply', requirePermission('fees:update'), FinanceController.applyCredit);

export default router;
