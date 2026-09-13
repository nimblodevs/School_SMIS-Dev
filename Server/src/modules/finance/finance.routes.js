import { Router } from 'express';
import { FinanceController } from './finance.controller.js';

const router = Router();

router.post('/invoices/generate', FinanceController.generateTermInvoices);
router.post('/payments', FinanceController.recordPayment);

export default router;