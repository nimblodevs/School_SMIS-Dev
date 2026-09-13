import { HRService } from './hr.service.js';
import { requestLeaveSchema } from './hr.validation.js';
import { BadRequestError } from '../../shared/errors/AppError.js';

export class HRController {
    static async requestLeave(req, res, next) {
        try {
            const validation = requestLeaveSchema.safeParse(req.body);
            if (!validation.success) {
                throw new BadRequestError('Validation Error', validation.error.format());
            }

            const request = await HRService.requestLeave(validation.data, req.user);

            return res.status(201).json({
                success: true,
                message: 'Leave request submitted successfully',
                data: request,
            });
        } catch (error) {
            next(error);
        }
    }

    static async approveLeave(req, res, next) {
        try {
            const { leaveRequestId } = req.params;
            const approved = await HRService.approveLeave(
                leaveRequestId,
                req.user,
                { ipAddress: req.ip, userAgent: req.headers['user-agent'] }
            );

            return res.status(200).json({
                success: true,
                message: 'Leave request approved and balance updated',
                data: approved,
            });
        } catch (error) {
            next(error);
        }
    }
}