import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';
import { AppError } from './AppError';

let transporter: Transporter | null = null;

// SMTP_* là optional ở env.ts (chỉ các tính năng gửi email phụ thuộc) — lazy-init để không chặn boot
// server khi chưa cấu hình, chỉ báo lỗi rõ ràng đúng lúc gọi sendEmail (cùng pattern config/firebase.ts).
function getTransporter(): Transporter {
  if (transporter) return transporter;

  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS) {
    throw AppError.internal('SMTP chưa được cấu hình (thiếu SMTP_* env vars)');
  }

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const client = getTransporter();
  try {
    await client.sendMail({ from: env.SMTP_FROM || env.SMTP_USER, to, subject, html });
  } catch (err) {
    throw AppError.internal('Gửi email thất bại', err instanceof Error ? err.message : err);
  }
}
