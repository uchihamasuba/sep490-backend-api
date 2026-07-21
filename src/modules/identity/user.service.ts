import type { User } from '@prisma/client';
import bcrypt from 'bcrypt';
import { AppError } from '../../utils/AppError';
import { userRepository } from './user.repository';
import type { CreateUserBody, ListUsersQuery, UpdateUserBody } from './user.validators';

// GET /api/v1/users (danh sách) KHÔNG trả email/phone/bio/avatarUrl — đã chốt ở docs/api/
// lichtrinhkythuat_api.md mục 4 điểm 3 ("chỉ có ở GET /auth/profile"); GET /users/:id (chi tiết) vẫn
// cần các trường này để hiển thị hồ sơ 1 nhân sự cụ thể.
export interface UserListItemDTO {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  status: string;
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
  return { userId: user.userId, username: user.username, fullName: user.fullName, role: user.role, status: user.status };
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
  if (!user) throw AppError.notFound('User not found');
  return mapDetail(user);
}

async function updateUserStatus(userId: string, status: User['status']): Promise<UserDetailDTO> {
  const existing = await userRepository.findById(userId);
  if (!existing) throw AppError.notFound('User not found');

  const updated = await userRepository.update(userId, { status });
  return mapDetail(updated);
}

async function createUser(body: CreateUserBody): Promise<UserDetailDTO> {
  const existing = await userRepository.findByUsername(body.username);
  if (existing) {
    throw AppError.badRequest('Tên đăng nhập đã tồn tại');
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await userRepository.create({
    username: body.username,
    passwordHash,
    fullName: body.fullName,
    role: body.role,
    email: body.email || null,
    phone: body.phone || null,
    status: 'ACTIVE',
  });

  return mapDetail(user);
}

async function updateUser(userId: string, body: UpdateUserBody): Promise<UserDetailDTO> {
  const existing = await userRepository.findById(userId);
  if (!existing) {
    throw AppError.notFound('User not found');
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
};
