import type { Prisma, User, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../../db/prisma';

// "Nhân sự vận hành" (Hướng A, docs/api/admin_themnhansu_api.md mục 3.3) = users có role LEADER/
// TECHNICAL — ADMIN/MANAGER là tài khoản quản trị, quản lý qua /users, không thuộc màn "Nhân viên".
const EMPLOYEE_ROLES: UserRole[] = ['LEADER', 'TECHNICAL'];

export interface EmployeeListFilter {
  jobTitle?: string;
  status?: UserStatus;
  search?: string;
}

export interface EmployeeListParams extends EmployeeListFilter {
  skip: number;
  take: number;
}

function buildWhere(filter: EmployeeListFilter): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { role: { in: EMPLOYEE_ROLES } };
  if (filter.jobTitle) where.jobTitle = filter.jobTitle;
  if (filter.status) where.status = filter.status;
  if (filter.search) {
    const q = filter.search;
    where.OR = [
      { fullName: { contains: q } },
      { employeeCode: { contains: q } },
      { phone: { contains: q } },
      { email: { contains: q } },
      { jobTitle: { contains: q } },
    ];
  }
  return where;
}

export const employeeRepository = {
  async findMany(params: EmployeeListParams) {
    const where = buildWhere(params);
    const [rows, totalItems] = await Promise.all([
      prisma.user.findMany({ where, skip: params.skip, take: params.take, orderBy: { fullName: 'asc' } }),
      prisma.user.count({ where }),
    ]);
    return { rows, totalItems };
  },

  async countByJobTitle(search?: string) {
    const where = buildWhere({ search });
    const groups = await prisma.user.groupBy({ by: ['jobTitle'], where, _count: { _all: true } });
    return groups.map((g) => ({ jobTitle: g.jobTitle, count: g._count._all }));
  },

  countAll(search?: string) {
    return prisma.user.count({ where: buildWhere({ search }) });
  },

  findById(userId: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { userId, role: { in: EMPLOYEE_ROLES } } });
  },

  findByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } });
  },

  // email/phone không có unique constraint ở DB (chỉ username/employeeCode) — kiểm tra trùng ở tầng
  // application trước khi tạo tài khoản invite. Quét toàn bộ `users`, không giới hạn EMPLOYEE_ROLES,
  // vì ADMIN/MANAGER cũng dùng chung bảng này và không được trùng email/phone với nhân viên mới.
  findByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { email } });
  },

  findByPhone(phone: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { phone } });
  },

  // Không có DB sequence dành riêng cho employee_code (Hướng A giữ nguyên bảng users) — dùng cùng kiểu
  // đếm-rồi-cộng-1 đã áp dụng nhất quán ở catalogRepository.generateNextItemCode/
  // customerRepository.generateNextCustomerCode trong repo này (chấp nhận race condition hiếm gặp,
  // cùng mức rủi ro với các mã nghiệp vụ khác, không phải việc cần giải quyết riêng ở đợt này).
  async generateNextEmployeeCode(): Promise<string> {
    const count = await prisma.user.count({ where: { employeeCode: { not: null } } });
    return `NV${String(count + 1).padStart(3, '0')}`;
  },

  create(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({ data });
  },

  update(userId: string, data: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({ where: { userId }, data });
  },
};
