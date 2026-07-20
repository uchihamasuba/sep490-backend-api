import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { User, UserRole, UserStatus } from '@prisma/client';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { userRepository } from './user.repository';
import type { ChangePasswordBody, LoginBody, UpdateProfileBody } from './auth.validators';

const BCRYPT_ROUNDS = 10;

export type ApiUserStatus = 'active' | 'inactive' | 'locked';

// Không có bảng `roles` riêng — roleId chỉ là slug cố định theo role, không phải FK thật.
// Khớp bảng ánh xạ ở docs/api/login_api.md §1.
const ROLE_MAP: Record<UserRole, { roleId: string; roleName: string }> = {
  ADMIN: { roleId: 'role-admin', roleName: 'Admin' },
  MANAGER: { roleId: 'role-manager', roleName: 'Manager' },
  LEADER: { roleId: 'role-leader', roleName: 'LEADER_STAFF' },
  TECHNICAL: { roleId: 'role-technical', roleName: 'TECHNICAL_STAFF' },
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
  return jwt.sign({ id: user.userId, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
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

async function forgotPassword(username: string): Promise<void> {
  const user = await userRepository.findByUsername(username);
  // Luôn trả 200 ở tầng controller dù tài khoản có tồn tại hay không (tránh lộ thông tin).
  // Chưa có hạ tầng gửi email/SMS thật — chỉ ghi log nội bộ khi tìm thấy tài khoản (doc §2.2).
  if (user) {
    logger.info({ userId: user.userId, username: user.username }, 'Password reset requested');
  }
}

async function getProfile(userId: string): Promise<AuthProfileDTO> {
  const user = await userRepository.findById(userId);
  if (!user) throw AppError.notFound('User not found');
  return mapProfile(user);
}

async function updateProfile(userId: string, body: UpdateProfileBody): Promise<AuthProfileDTO> {
  const existing = await userRepository.findById(userId);
  if (!existing) throw AppError.notFound('User not found');

  const data: Record<string, string> = {};
  if (body.fullName !== undefined) data.fullName = body.fullName;
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.bio !== undefined) data.bio = body.bio;
  if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl;

  const updated = await userRepository.update(userId, data);
  return mapProfile(updated);
}

async function changePassword(userId: string, body: ChangePasswordBody): Promise<void> {
  const user = await userRepository.findById(userId);
  if (!user) throw AppError.notFound('User not found');

  const oldPasswordMatches = await bcrypt.compare(body.oldPassword, user.passwordHash);
  if (!oldPasswordMatches) {
    throw AppError.badRequest('Mật khẩu hiện tại không đúng');
  }

  const passwordHash = await bcrypt.hash(body.newPassword, BCRYPT_ROUNDS);
  await userRepository.updatePasswordHash(userId, passwordHash);
}

export const authService = {
  login,
  forgotPassword,
  getProfile,
  updateProfile,
  changePassword,
};
