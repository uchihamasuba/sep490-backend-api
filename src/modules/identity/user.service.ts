import type { User } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { sendEmail } from '../../utils/mailer';
import { hashPassword, hashPasswordRequiringChange } from '../../utils/password';
import { userRepository } from './user.repository';
import type { CreateUserBody, ListUsersQuery, UpdateUserBody } from './user.validators';

// GET /api/v1/users (danh sách) trả email/phone để hiển thị cột thông tin liên hệ trên bảng quản lý
// người dùng. GET /users/:id (chi tiết) trả thêm bio/avatarUrl/createdAt/updatedAt.
export interface UserListItemDTO {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  status: string;
  email: string | null;
  phone: string | null;
}

export interface UserDetailDTO extends UserListItemDTO {
  email: string | null;
  phone: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserListMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

function mapListItem(user: User): UserListItemDTO {
  return {
    userId: user.userId,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    email: user.email,
    phone: user.phone,
  };
}

function buildAccountEmailHtml(username: string, password: string): string {
  return `
    <p>Tài khoản của bạn đã được tạo. Thông tin đăng nhập:</p>
    <ul>
      <li>Tên đăng nhập: <strong>${username}</strong></li>
      <li>Mật khẩu: <strong>${password}</strong></li>
    </ul>
    <p>Vui lòng đăng nhập và đổi mật khẩu ngay trong lần sử dụng đầu tiên.</p>
  `;
}

function buildPasswordResetEmailHtml(username: string, newPassword: string): string {
  return `
    <p>Mật khẩu tài khoản <strong>${username}</strong> của bạn vừa được quản trị viên đặt lại. Mật khẩu mới:</p>
    <p><strong>${newPassword}</strong></p>
    <p>Vui lòng đăng nhập và đổi mật khẩu ngay trong lần sử dụng đầu tiên.</p>
  `;
}

function mapDetail(user: User): UserDetailDTO {
  return {
    ...mapListItem(user),
    email: user.email,
    phone: user.phone,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

async function listUsers(query: ListUsersQuery): Promise<{ data: UserListItemDTO[]; meta: UserListMeta }> {
  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const { rows, totalItems } = await userRepository.findMany({
    role: query.role,
    status: query.status,
    search: query.search,
    skip,
    take: limit,
  });

  return {
    data: rows.map(mapListItem),
    meta: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) },
  };
}

async function getUserById(userId: string): Promise<UserDetailDTO> {
const user = await userRepository.findById(userId);
  if (!user) throw AppError.notFound('Không tìm thấy người dùng');
  return mapDetail(user);
}

async function updateUserStatus(userId: string, status: User['status']): Promise<UserDetailDTO> {
  const existing = await userRepository.findById(userId);
  if (!existing) throw AppError.notFound('Không tìm thấy người dùng');

  const updated = await userRepository.update(userId, { status });
  return mapDetail(updated);
}

async function createUser(body: CreateUserBody): Promise<UserDetailDTO> {
  const existing = await userRepository.findByUsername(body.username);
  if (existing) {
    throw AppError.badRequest('Tên đăng nhập đã tồn tại');
  }

  if (body.email) {
    const existingByEmail = await userRepository.findByEmail(body.email);
    if (existingByEmail) throw AppError.conflict('Email đã được sử dụng');
  }
  if (body.phone) {
    const existingByPhone = await userRepository.findByPhone(body.phone);
    if (existingByPhone) throw AppError.conflict('Số điện thoại đã được sử dụng');
  }

  // Mật khẩu được gửi thẳng qua email cho user (plaintext) — bắt buộc đổi mật khẩu ngay khi đăng nhập
  // lần đầu (đánh dấu qua hashPasswordRequiringChange, xem password.ts). Không gửi email thì giữ hành
  // vi cũ, không bắt đổi.
  const passwordHash = body.email ? await hashPasswordRequiringChange(body.password) : await hashPassword(body.password);
  const user = await userRepository.create({
    username: body.username,
    passwordHash,
    fullName: body.fullName,
    role: body.role,
    email: body.email || null,
    phone: body.phone || null,
    status: 'ACTIVE',
  });

  if (body.email) {
    try {
      await sendEmail(body.email, 'Tài khoản của bạn đã được tạo', buildAccountEmailHtml(body.username, body.password));
    } catch (err) {
      console.error('Gửi email thông báo tài khoản thất bại:', err);
    }
  }

  return mapDetail(user);
}

// Admin đặt mật khẩu mới cho một user cụ thể — gửi email báo mật khẩu mới (nếu có email trên hồ sơ)
// và bắt buộc đổi mật khẩu ở lần đăng nhập kế tiếp, cùng cơ chế với createUser (xem password.ts).
async function resetUserPassword(userId: string, newPassword: string): Promise<UserDetailDTO> {
  const existing = await userRepository.findById(userId);
  if (!existing) throw AppError.notFound('Không tìm thấy người dùng');

  const passwordHash = await hashPasswordRequiringChange(newPassword);
  const user = await userRepository.updatePasswordHash(userId, passwordHash);

  if (existing.email) {
    try {
      await sendEmail(
        existing.email,
        'Mật khẩu tài khoản của bạn đã được đặt lại',
        buildPasswordResetEmailHtml(existing.username, newPassword),
      );
    } catch (err) {
console.error('Gửi email thông báo đặt lại mật khẩu thất bại:', err);
    }
  }

  return mapDetail(user);
}

async function updateUser(userId: string, body: UpdateUserBody): Promise<UserDetailDTO> {
  const existing = await userRepository.findById(userId);
  if (!existing) {
    throw AppError.notFound('Không tìm thấy người dùng');
  }

  if (body.email && body.email !== existing.email) {
    const existingByEmail = await userRepository.findByEmail(body.email);
    if (existingByEmail && existingByEmail.userId !== userId) {
      throw AppError.conflict('Email đã được sử dụng');
    }
  }
  if (body.phone && body.phone !== existing.phone) {
    const existingByPhone = await userRepository.findByPhone(body.phone);
    if (existingByPhone && existingByPhone.userId !== userId) {
      throw AppError.conflict('Số điện thoại đã được sử dụng');
    }
  }

  const data: Record<string, any> = {};
  if (body.fullName !== undefined) data.fullName = body.fullName;
  if (body.role !== undefined) data.role = body.role;
  if (body.email !== undefined) data.email = body.email;
  if (body.phone !== undefined) data.phone = body.phone;

  const updated = await userRepository.update(userId, data);
  return mapDetail(updated);
}

export const userService = {
  listUsers,
  getUserById,
  updateUserStatus,
  createUser,
  updateUser,
  resetUserPassword,
};
