import { FinanceService } from './finance.service.js';
import { generateInvoicesSchema, recordPaymentSchema } from './finance.validation.js';
import { BadRequestError } from '../../shared/errors/AppError.js';

export class FinanceController {
    static async generateTermInvoices(req, res, next) {
        try {
            const validation = generateInvoicesSchema.safeParse(req.body);
            if (!validation.success) {
                throw new BadRequestError('Validation Error', validation.error.format());
            }

            const result = await FinanceService.generateTermInvoices(validation.data, req.user);

            return res.status(201).json({
                success: true,
                message: 'Term invoices generated successfully',
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }

    static async recordPayment(req, res, next) {
        try {
            const validation = recordPaymentSchema.safeParse(req.body);
            if (!validation.success) {
                throw new BadRequestError('Validation Error', validation.error.format());
            }

            const payment = await FinanceService.recordPayment(
                validation.data,
                req.user,
                { ipAddress: req.ip, userAgent: req.headers['user-agent'] }
            );

            return res.status(201).json({
                success: true,
                message: 'Payment recorded and invoice balance updated',
                data: payment,
            });
        } catch (error) {
            next(error);
        }
    }
}