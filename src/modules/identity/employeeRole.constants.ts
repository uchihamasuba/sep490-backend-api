// Danh mục "vai trò chuyên môn" nhân sự vận hành — docs/api/admin_themnhansu_api.md mục 3.2/3.4.
// KHÔNG có bảng employee_roles thật trong DB (chỉ có users.job_title dạng free-text) — Hướng A đã
// chốt: danh sách này TĨNH, cấu hình cứng ở backend, không phải CRUD catalog. GET trả lại đúng 6 giá
// trị đã seed sẵn ở FE (EMPLOYEE_ROLES); POST/PUT/DELETE bị từ chối vì không có gì để sửa/xóa.
export interface EmployeeRoleOption {
  id: string;
  name: string;
}

export const EMPLOYEE_ROLES: readonly EmployeeRoleOption[] = [
  { id: 'quan-ly', name: 'Quản lý' },
  { id: 'dieu-phoi-vien', name: 'Điều phối viên' },
  { id: 'ky-thuat', name: 'Kỹ thuật' },
  { id: 'bep-truong', name: 'Bếp trưởng' },
  { id: 'mc-lead', name: 'MC/MC Lead' },
  { id: 'trang-tri', name: 'Trang trí' },
];

const BY_ID = new Map(EMPLOYEE_ROLES.map((role) => [role.id, role]));
const BY_NAME = new Map(EMPLOYEE_ROLES.map((role) => [role.name, role]));

export function jobTitleById(roleId: string): EmployeeRoleOption | undefined {
  return BY_ID.get(roleId);
}

export function roleOptionByJobTitle(jobTitle: string | null): EmployeeRoleOption | null {
  if (!jobTitle) return null;
  return BY_NAME.get(jobTitle) ?? { id: jobTitle, name: jobTitle };
}
