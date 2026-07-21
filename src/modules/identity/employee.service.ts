import { randomBytes, randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import type { User } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { sendEmail } from '../../utils/mailer';
import { generateTempPassword } from '../../utils/password';
import { employeeRepository } from './employee.repository';
import { jobTitleById, roleOptionByJobTitle, type EmployeeRoleOption } from './employeeRole.constants';
import type {
  CreateEmployeeBody,
  InviteEmployeeBody,
  ListEmployeesQuery,
  UpdateEmployeeBody,
} from './employee.validators';

const BCRYPT_ROUNDS = 10;

export interface EmployeeDTO {
  id: string;
  employeeCode: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  role: EmployeeRoleOption | null;
  accountRole: string;
  status: 'ACTIVE' | 'INACTIVE';
  // Đã chốt ở docs/api/admin_danhsachnguoidung__api.md mục 1: chưa có FK phân công thật, luôn trả 0
  // cho tới khi các bảng Schedule Plan/Work Task đổi sang tham chiếu user_id thật (ngoài phạm vi này).
  assignedBookings: number;
}

export interface EmployeeCreatedDTO extends EmployeeDTO {
  username: string;
  tempPassword: string;
}

export interface EmployeeInvitedDTO extends EmployeeDTO {
  username: string;
}

export interface EmployeeListMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  counts: Record<string, number>;
}

// users.status có 3 giá trị (ACTIVE/INACTIVE/SUSPENDED) nhưng phạm vi "Nhân viên" chỉ dùng 2 (mục 1
// file gốc) — SUSPENDED (khóa do vi phạm) không xuất hiện trong domain này, quy về INACTIVE khi hiển thị
// để không vỡ type FE, dù set qua endpoint riêng /users/:id/status vẫn ghi đúng SUSPENDED trong DB.
function toEmployeeStatus(status: User['status']): 'ACTIVE' | 'INACTIVE' {
  return status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
}

function mapEmployee(user: User): EmployeeDTO {
  return {
    id: user.userId,
    employeeCode: user.employeeCode,
    name: user.fullName,
    phone: user.phone,
    email: user.email,
    role: roleOptionByJobTitle(user.jobTitle),
    accountRole: user.role,
    status: toEmployeeStatus(user.status),
    assignedBookings: 0,
  };
}

async function listEmployees(query: ListEmployeesQuery): Promise<{ data: EmployeeDTO[]; meta: EmployeeListMeta }> {
  const { page, limit } = query;
  const skip = (page - 1) * limit;
  const jobTitle = query.roleId ? jobTitleById(query.roleId)?.name : undefined;

  const [{ rows, totalItems }, groupCounts, totalAll] = await Promise.all([
    employeeRepository.findMany({ jobTitle, search: query.search, skip, take: limit }),
    employeeRepository.countByJobTitle(query.search),
    employeeRepository.countAll(query.search),
  ]);

  const counts: Record<string, number> = { all: totalAll };
  for (const group of groupCounts) {
    const role = roleOptionByJobTitle(group.jobTitle);
    if (role) counts[role.id] = (counts[role.id] ?? 0) + group.count;
  }

  return {
    data: rows.map(mapEmployee),
    meta: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit), counts },
  };
}

async function getEmployeeById(userId: string): Promise<EmployeeDTO> {
  const user = await employeeRepository.findById(userId);
  if (!user) throw AppError.notFound('Employee not found');
  return mapEmployee(user);
}

// Sinh username không trùng từ số điện thoại (đề xuất docs/api/admin_themnhansu_api.md mục 3.3) — thử
// tối đa vài hậu tố trước khi rơi về hậu tố ngẫu nhiên, tránh vòng lặp vô hạn trong trường hợp hiếm.
async function generateUniqueUsername(phone: string): Promise<string> {
  const base = phone.replace(/\D/g, '') || 'nv';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${attempt}`;
    const existing = await employeeRepository.findByUsername(candidate);
    if (!existing) return candidate;
  }
  return `${base}${randomBytes(3).toString('hex')}`;
}

function buildInviteEmailHtml(fullName: string, username: string, tempPassword: string): string {
  return `
    <p>Xin chào ${fullName},</p>
    <p>Tài khoản nhân viên của bạn tại BNW EMS đã được tạo. Thông tin đăng nhập:</p>
    <ul>
      <li>Tên đăng nhập: <strong>${username}</strong></li>
      <li>Mật khẩu tạm thời: <strong>${tempPassword}</strong></li>
    </ul>
    <p>Vui lòng đăng nhập và đổi mật khẩu ngay trong lần sử dụng đầu tiên.</p>
  `;
}

async function createEmployee(body: CreateEmployeeBody): Promise<EmployeeCreatedDTO> {
  const roleOption = jobTitleById(body.roleId);
  if (!roleOption) throw AppError.badRequest('Unknown roleId');

  const username = await generateUniqueUsername(body.phone);
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
  const employeeCode = await employeeRepository.generateNextEmployeeCode();

  const created = await employeeRepository.create({
    userId: randomUUID(),
    username,
    passwordHash,
    fullName: body.name,
    phone: body.phone,
    email: body.email ?? null,
    role: body.role,
    status: body.status,
    jobTitle: roleOption.name,
    employeeCode,
  });

  return { ...mapEmployee(created), username, tempPassword };
}

// Mời nhân viên: giống createEmployee nhưng email là bắt buộc (mật khẩu tạm được gửi qua email thay
// vì trả thẳng trong response — tránh lộ mật khẩu qua log FE/API một khi đã có kênh email đáng tin cậy).
async function inviteEmployee(body: InviteEmployeeBody): Promise<EmployeeInvitedDTO> {
  const roleOption = jobTitleById(body.roleId);
  if (!roleOption) throw AppError.badRequest('Unknown roleId');

  const [existingByEmail, existingByPhone] = await Promise.all([
    employeeRepository.findByEmail(body.email),
    employeeRepository.findByPhone(body.phone),
  ]);
  if (existingByEmail) throw AppError.conflict('Email đã được sử dụng');
  if (existingByPhone) throw AppError.conflict('Số điện thoại đã được sử dụng');

  const username = await generateUniqueUsername(body.phone);
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
  const employeeCode = await employeeRepository.generateNextEmployeeCode();

  const created = await employeeRepository.create({
    userId: randomUUID(),
    username,
    passwordHash,
    fullName: body.fullName,
    phone: body.phone,
    email: body.email,
    role: 'TECHNICAL',
    status: 'ACTIVE',
    jobTitle: roleOption.name,
    employeeCode,
  });

  await sendEmail(body.email, 'Tài khoản nhân viên BNW EMS của bạn', buildInviteEmailHtml(body.fullName, username, tempPassword));

  return { ...mapEmployee(created), username };
}

async function updateEmployee(userId: string, body: UpdateEmployeeBody): Promise<EmployeeDTO> {
  const existing = await employeeRepository.findById(userId);
  if (!existing) throw AppError.notFound('Employee not found');

  const roleOption = jobTitleById(body.roleId);
  if (!roleOption) throw AppError.badRequest('Unknown roleId');

  const updated = await employeeRepository.update(userId, {
    fullName: body.name,
    phone: body.phone,
    email: body.email ?? null,
    jobTitle: roleOption.name,
    ...(body.role !== undefined ? { role: body.role } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
  });

  return mapEmployee(updated);
}

async function updateEmployeeStatus(userId: string, status: 'ACTIVE' | 'INACTIVE'): Promise<EmployeeDTO> {
  const existing = await employeeRepository.findById(userId);
  if (!existing) throw AppError.notFound('Employee not found');

  const updated = await employeeRepository.update(userId, { status });
  return mapEmployee(updated);
}

export const employeeService = {
  listEmployees,
  getEmployeeById,
  createEmployee,
  inviteEmployee,
  updateEmployee,
  updateEmployeeStatus,
};
