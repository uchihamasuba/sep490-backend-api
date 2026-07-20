import type { User } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { userRepository } from './user.repository';
import type { ListUsersQuery } from './user.validators';

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

export const userService = {
  listUsers,
  getUserById,
};
