import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { User, UserRole, UserStatus } from '@prisma/client';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { sendEmail } from '../../utils/mailer';
import { generateTempPassword, hashPassword, hashPasswordRequiringChange, passwordRequiresChange } from '../../utils/password';
import { userRepository } from './user.repository';
import type { ChangePasswordBody, LoginBody, UpdateProfileBody } from './auth.validators';

export type ApiUserStatus = 'active' | 'inactive' | 'locked';

// Không có bảng `roles` riêng — roleId chỉ là slug cố định theo role, không phải FK thật.
// Khớp bảng ánh xạ ở docs/api/login_api.md §1.
const ROLE_MAP: Record<UserRole, { roleId: string; roleName: string }> = {
  ADMIN: { roleId: 'role-admin', roleName: 'Admin' },
  MANAGER: { roleId: 'role-manager', roleName: 'Manager' },
  STAFF: { roleId: 'role-staff', roleName: 'STAFF' },
};

const STATUS_MAP: Record<UserStatus, ApiUserStatus> = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'locked',
};

export interface AuthUserDTO {
  userId: string;
  username: string;
  fullName: string;
  role: { roleId: string; roleName: string };
  status: ApiUserStatus;
  mustChangePassword: boolean;
}

export interface AuthProfileDTO extends AuthUserDTO {
  email: string | null;
  phone: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResult {
  token: string;
  user: AuthUserDTO;
}

function mapUser(user: User): AuthUserDTO {
  return {
    userId: user.userId,
    username: user.username,
    fullName: user.fullName,
    role: ROLE_MAP[user.role],
    status: STATUS_MAP[user.status],
    mustChangePassword: passwordRequiresChange(user.passwordHash),
  };
}

function mapProfile(user: User): AuthProfileDTO {
  return {
    ...mapUser(user),
    email: user.email,
    phone: user.phone,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function signToken(user: User): string {
  return jwt.sign(
    { id: user.userId, role: user.role, mustChangePassword: passwordRequiresChange(user.passwordHash) },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions,
  );
}

async function login(body: LoginBody): Promise<LoginResult> {
  const user = await userRepository.findByUsername(body.username);
  if (!user) {
    // Không phân biệt sai username/password để tránh dò tài khoản (doc §2.1).
    throw AppError.unauthorized('Sai tên đăng nhập hoặc mật khẩu');
  }

  const passwordMatches = await bcrypt.compare(body.password, user.passwordHash);
  if (!passwordMatches) {
    throw AppError.unauthorized('Sai tên đăng nhập hoặc mật khẩu');
  }

  if (user.status !== 'ACTIVE') {
    throw AppError.forbidden('Tài khoản đã bị khóa hoặc vô hiệu hóa');
  }

  return { token: signToken(user), user: mapUser(user) };
}

function buildResetPasswordEmailHtml(username: string, newPassword: string): string {
  return `
    <p>Xin chào ${username},</p>
    <p>Mật khẩu mới của bạn là: <strong>${newPassword}</strong></p>
    <p>Vui lòng đăng nhập và đổi mật khẩu ngay sau khi truy cập.</p>
  `;
}

// Sinh mật khẩu mới ngẫu nhiên, hash (đánh dấu bắt buộc đổi ở lần đăng nhập kế tiếp — xem
// utils/password.ts), cập nhật DB rồi gửi email. Dùng chung cho cả forgot-password (tra theo
// username) và reset-password (tra theo email) — 2 lối vào cùng một hành vi.
async function issuePasswordResetEmail(user: User): Promise<void> {
  if (!user.email) return; // Không có email trên hồ sơ thì không có kênh nào để gửi.

  const newPassword = generateTempPassword();
  const passwordHash = await hashPasswordRequiringChange(newPassword);
  await userRepository.updatePasswordHash(user.userId, passwordHash);
  await sendEmail(user.email, 'Mật khẩu mới của bạn', buildResetPasswordEmailHtml(user.username, newPassword));
  logger.info({ userId: user.userId }, 'Password reset email sent');
}

// Luôn resolve thành công dù username có tồn tại hay không (tránh dò tài khoản, doc §2.2).
async function forgotPassword(username: string): Promise<void> {
  const user = await userRepository.findByUsername(username);
  if (user) await issuePasswordResetEmail(user);
}

// Luôn resolve thành công dù email có tồn tại hay không (tránh dò tài khoản qua boundary timing/lỗi).
async function resetPassword(email: string): Promise<void> {
  const user = await userRepository.findByEmail(email);
  if (user) await issuePasswordResetEmail(user);
}

async function getProfile(userId: string): Promise<AuthProfileDTO> {
  const user = await userRepository.findById(userId);
  if (!user) throw AppError.notFound('Không tìm thấy người dùng');
  return mapProfile(user);
}

async function updateProfile(userId: string, body: UpdateProfileBody): Promise<AuthProfileDTO> {
  const existing = await userRepository.findById(userId);
  if (!existing) throw AppError.notFound('Không tìm thấy người dùng');

  if (body.phone !== undefined && body.phone !== existing.phone) {
    const phoneOwner = await userRepository.findByPhone(body.phone);
    if (phoneOwner && phoneOwner.userId !== userId) {
      throw AppError.conflict('Số điện thoại đã được sử dụng bởi tài khoản khác');
    }
  }

  if (body.email !== undefined && body.email !== existing.email) {
    const emailOwner = await userRepository.findByEmail(body.email);
    if (emailOwner && emailOwner.userId !== userId) {
      throw AppError.conflict('Email đã được sử dụng bởi tài khoản khác');
    }
  }

  const data: Record<string, string> = {};
  if (body.fullName !== undefined) data.fullName = body.fullName;
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.email !== undefined) data.email = body.email;
  if (body.bio !== undefined) data.bio = body.bio;
  if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl;

  const updated = await userRepository.update(userId, data);
  return mapProfile(updated);
}

async function changePassword(userId: string, body: ChangePasswordBody): Promise<void> {
  const user = await userRepository.findById(userId);
  if (!user) throw AppError.notFound('Không tìm thấy người dùng');

  const oldPasswordMatches = await bcrypt.compare(body.oldPassword, user.passwordHash);
  if (!oldPasswordMatches) {
    throw AppError.badRequest('Mật khẩu hiện tại không đúng');
  }

  const passwordHash = await hashPassword(body.newPassword);
  await userRepository.updatePasswordHash(userId, passwordHash);
}

export const authService = {
  login,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  changePassword,
};
