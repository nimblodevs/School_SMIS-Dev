import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter;

function getTransporter() {
    if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASSWORD) {
        throw new Error('SMTP configuration is incomplete');
    }

    transporter ??= nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    });
    return transporter;
}

export async function sendPasswordResetOtp({ to, otp }) {
    await getTransporter().sendMail({
        from: env.SMTP_FROM || env.SMTP_USER,
        to,
        subject: 'School SMIS password reset code',
        text: `Your password reset code is ${otp}. It expires in ${env.PASSWORD_RESET_OTP_MINUTES} minutes.`,
    });
}

export async function sendLoginOtp({ to, otp }) {
    await getTransporter().sendMail({
        from: env.SMTP_FROM || env.SMTP_USER,
        to,
        subject: 'Your School SMIS login verification code',
        text: `Your School SMIS login verification code is ${otp}. It expires in ${env.LOGIN_OTP_MINUTES} minutes.`,
    });
}

export async function sendTemporaryCredentials({ to, firstName, role, temporaryPassword }) {
    await getTransporter().sendMail({
        from: env.SMTP_FROM || env.SMTP_USER,
        to,
        subject: 'Your School SMIS account credentials',
        text: `Hello ${firstName},\n\nYour ${role.toLowerCase()} School SMIS account has been created.\n\nEmail: ${to}\nTemporary password: ${temporaryPassword}\n\nYou must change this password immediately after your first login.`,
    });
}

export async function sendParentActivationInvite({ to, firstName, token }) {
    await getTransporter().sendMail({
        from: env.SMTP_FROM || env.SMTP_USER,
        to,
        subject: 'Activate your School SMIS parent account',
        text: `Hello ${firstName},\n\nUse this activation token to activate your parent account: ${token}\n\nThis token expires in 48 hours.`,
    });
}

export async function sendPayslipEmail({ to, employeeName, month, downloadUrl }) {
    await getTransporter().sendMail({
        from: env.SMTP_FROM || env.SMTP_USER,
        to,
        subject: `School SMIS payslip for ${month}`,
        text: `Hello ${employeeName},\n\nYour payslip for ${month} is ready. Download it using this private link, which expires soon:\n${downloadUrl}`,
    });
}
