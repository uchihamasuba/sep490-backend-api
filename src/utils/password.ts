import { randomBytes } from 'crypto';

// 12-ký-tự hex ngẫu nhiên — đủ entropy cho mật khẩu tạm dùng một lần, dùng chung cho invite employee
// và reset password.
export function generateTempPassword(): string {
  return randomBytes(6).toString('hex');
}
