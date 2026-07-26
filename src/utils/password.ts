import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';

// 12-ký-tự hex ngẫu nhiên — đủ entropy cho mật khẩu tạm dùng một lần, dùng chung cho invite employee
// và reset password.
export function generateTempPassword(): string {
  return randomBytes(6).toString('hex');
}

const NORMAL_ROUNDS = 10;
// Không thêm cột DB mới để đánh dấu "phải đổi mật khẩu" — mượn cost factor bcrypt (đã nằm sẵn trong
// passwordHash, dạng $2b$<cost>$...) làm cờ. changePassword luôn hash lại bằng NORMAL_ROUNDS nên cờ tự
// động được xoá ngay khi user đổi mật khẩu, không cần code dọn cờ riêng.
const MUST_CHANGE_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, NORMAL_ROUNDS);
}

export function hashPasswordRequiringChange(password: string): Promise<string> {
  return bcrypt.hash(password, MUST_CHANGE_ROUNDS);
}

export function passwordRequiresChange(passwordHash: string): boolean {
  const match = /^\$2[aby]\$(\d+)\$/.exec(passwordHash);
  return match !== null && Number(match[1]) === MUST_CHANGE_ROUNDS;
}
