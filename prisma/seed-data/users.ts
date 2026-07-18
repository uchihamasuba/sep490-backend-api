// Trích xuất từ sep490-web-frontend/src/mocks/apiFixtures.ts (MOCK_USERS) + mật khẩu 2 tài khoản
// admin/manager khớp sep490-web-frontend/src/mocks/authAccounts.ts (MOCK_ACCOUNTS) — để có thể đăng
// nhập bằng đúng thông tin mà UI mock hiện đang hiển thị. password_hash không có sẵn trong mock (mock
// không lưu hash) — seed.ts sẽ bcrypt-hash `passwordPlaintext` lúc insert. CHỈ dùng cho seed/dev,
// KHÔNG dùng các mật khẩu này trong môi trường production.

export type UserRole = 'ADMIN' | 'MANAGER' | 'LEADER' | 'TECHNICAL';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface UserSeed {
  userId: string;
  username: string;
  passwordPlaintext: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
}

export const USERS: UserSeed[] = [
  { userId: 'mock-admin-1', username: 'admin', passwordPlaintext: 'Admin@123', fullName: 'Quản trị viên hệ thống', role: 'ADMIN', status: 'ACTIVE' },
  { userId: 'mock-manager-1', username: 'manager', passwordPlaintext: 'Manager@123', fullName: 'Trưởng phòng vận hành', role: 'MANAGER', status: 'ACTIVE' },
  { userId: 'mock-leader-1', username: 'leader.long', passwordPlaintext: 'Staff@123', fullName: 'Vũ Hoàng Long', role: 'LEADER', status: 'ACTIVE' },
  { userId: 'mock-leader-2', username: 'leader.huong', passwordPlaintext: 'Staff@123', fullName: 'Nguyễn Thị Hương', role: 'LEADER', status: 'ACTIVE' },
  { userId: 'mock-tech-1', username: 'tech.dung', passwordPlaintext: 'Staff@123', fullName: 'Lê Minh Dũng', role: 'TECHNICAL', status: 'ACTIVE' },
  { userId: 'mock-tech-2', username: 'tech.tuan', passwordPlaintext: 'Staff@123', fullName: 'Trần Anh Tuấn', role: 'TECHNICAL', status: 'ACTIVE' },
  { userId: 'mock-tech-3', username: 'tech.mai', passwordPlaintext: 'Staff@123', fullName: 'Phạm Thị Mai', role: 'TECHNICAL', status: 'ACTIVE' },
];
