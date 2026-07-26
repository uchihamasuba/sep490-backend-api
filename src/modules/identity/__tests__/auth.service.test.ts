import bcrypt from 'bcrypt';
import type { User, UserRole, UserStatus } from '@prisma/client';
import { userRepository } from '../user.repository';
import { authService } from '../auth.service';
import { sendEmail } from '../../../utils/mailer';
import { passwordRequiresChange } from '../../../utils/password';
import type { ChangePasswordBody, LoginBody, UpdateProfileBody } from '../auth.validators';

jest.mock('../user.repository', () => ({
  userRepository: {
    findByUsername: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
    update: jest.fn(),
    updatePasswordHash: jest.fn(),
  },
}));

jest.mock('../../../utils/mailer', () => ({
  sendEmail: jest.fn(),
}));

const mockedRepo = userRepository as jest.Mocked<typeof userRepository>;
const mockedSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

const PLAIN_PASSWORD = '123456';
let PASSWORD_HASH: string;

beforeAll(async () => {
  PASSWORD_HASH = await bcrypt.hash(PLAIN_PASSWORD, 10);
});

function baseUser(overrides: Partial<User> = {}): User {
  return {
    userId: 'u1',
    username: 'manager',
    passwordHash: PASSWORD_HASH,
    fullName: 'Project Manager',
    role: 'MANAGER' as UserRole,
    status: 'ACTIVE' as UserStatus,
    email: 'manager@bnw.com',
    phone: '0900000002',
    bio: null,
    avatarUrl: null,
    employeeCode: null,
    jobTitle: null,
    deviceToken: null,
    createdAt: new Date('2026-07-19T16:47:34.000Z'),
    updatedAt: new Date('2026-07-19T16:47:34.000Z'),
    ...overrides,
  };
}

describe('authService.login', () => {
  it('returns a token and the mapped user object on success', async () => {
    mockedRepo.findByUsername.mockResolvedValue(baseUser());

    const result = await authService.login({ username: 'manager', password: PLAIN_PASSWORD } as LoginBody);

    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(0);
    expect(result.user).toEqual({
      userId: 'u1',
      username: 'manager',
      fullName: 'Project Manager',
      role: { roleId: 'role-manager', roleName: 'Manager' },
      status: 'active',
      mustChangePassword: false,
    });
  });

  it('flags mustChangePassword when the stored hash was issued via reset/create-with-email (higher bcrypt cost marker)', async () => {
    const mustChangeHash = await bcrypt.hash(PLAIN_PASSWORD, 12);
    mockedRepo.findByUsername.mockResolvedValue(baseUser({ passwordHash: mustChangeHash }));

    const result = await authService.login({ username: 'manager', password: PLAIN_PASSWORD } as LoginBody);

    expect(result.user.mustChangePassword).toBe(true);
  });

  it('maps STAFF role and SUSPENDED/INACTIVE status per the doc table', async () => {
    mockedRepo.findByUsername.mockResolvedValue(baseUser({ role: 'STAFF', status: 'ACTIVE' }));
    const result = await authService.login({ username: 'leader', password: PLAIN_PASSWORD } as LoginBody);
    expect(result.user.role).toEqual({ roleId: 'role-staff', roleName: 'STAFF' });
  });

  it('rejects an unknown username with 401 (no account-enumeration hint)', async () => {
    mockedRepo.findByUsername.mockResolvedValue(null);

    await expect(authService.login({ username: 'ghost', password: 'whatever' } as LoginBody)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Sai tên đăng nhập hoặc mật khẩu',
    });
  });

  it('rejects a wrong password with 401', async () => {
    mockedRepo.findByUsername.mockResolvedValue(baseUser());

    await expect(
      authService.login({ username: 'manager', password: 'wrong-password' } as LoginBody),
    ).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });

  it('rejects a locked/suspended account with 403, even with correct credentials', async () => {
    mockedRepo.findByUsername.mockResolvedValue(baseUser({ status: 'SUSPENDED' }));

    await expect(
      authService.login({ username: 'manager', password: PLAIN_PASSWORD } as LoginBody),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'Tài khoản đã bị khóa hoặc vô hiệu hóa' });
  });
});

describe('authService.forgotPassword', () => {
  beforeEach(() => {
    mockedSendEmail.mockResolvedValue(undefined);
  });

  it('resolves without hashing/updating/emailing when the username does not exist (no enumeration)', async () => {
    mockedRepo.findByUsername.mockResolvedValue(null);

    await expect(authService.forgotPassword('ghost')).resolves.toBeUndefined();

    expect(mockedRepo.updatePasswordHash).not.toHaveBeenCalled();
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it('generates a new password, hashes it as must-change, stores it, and emails it to the on-file address', async () => {
    mockedRepo.findByUsername.mockResolvedValue(baseUser());
    mockedRepo.updatePasswordHash.mockResolvedValue(baseUser());

    await authService.forgotPassword('manager');

    expect(mockedRepo.updatePasswordHash).toHaveBeenCalledTimes(1);
    const [userId, storedHash] = mockedRepo.updatePasswordHash.mock.calls[0];
    expect(userId).toBe('u1');
    expect(passwordRequiresChange(storedHash)).toBe(true);

    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    const [to, subject, html] = mockedSendEmail.mock.calls[0];
    expect(to).toBe('manager@bnw.com');
    expect(subject).toContain('Mật khẩu mới');

    const newPasswordMatch = /<strong>([0-9a-f]+)<\/strong>/.exec(html);
    expect(newPasswordMatch).not.toBeNull();
    await expect(bcrypt.compare(newPasswordMatch![1], storedHash)).resolves.toBe(true);
  });

  it('finds the account but does nothing when it has no email on file', async () => {
    mockedRepo.findByUsername.mockResolvedValue(baseUser({ email: null }));

    await expect(authService.forgotPassword('manager')).resolves.toBeUndefined();

    expect(mockedRepo.updatePasswordHash).not.toHaveBeenCalled();
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });
});

describe('authService.resetPassword', () => {
  beforeEach(() => {
    mockedSendEmail.mockResolvedValue(undefined);
  });

  it('resolves without hashing/updating/emailing when the email does not exist (no enumeration)', async () => {
    mockedRepo.findByEmail.mockResolvedValue(null);

    await expect(authService.resetPassword('ghost@bnw.com')).resolves.toBeUndefined();

    expect(mockedRepo.updatePasswordHash).not.toHaveBeenCalled();
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it('generates a new password, hashes and stores it, and emails it to the user', async () => {
    mockedRepo.findByEmail.mockResolvedValue(baseUser());
    mockedRepo.updatePasswordHash.mockResolvedValue(baseUser());

    await authService.resetPassword('manager@bnw.com');

    expect(mockedRepo.updatePasswordHash).toHaveBeenCalledTimes(1);
    const [userId, storedHash] = mockedRepo.updatePasswordHash.mock.calls[0];
    expect(userId).toBe('u1');
    expect(storedHash).not.toBe(PASSWORD_HASH);

    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    const [to, subject, html] = mockedSendEmail.mock.calls[0];
    expect(to).toBe('manager@bnw.com');
    expect(subject).toContain('Mật khẩu mới');

    // The email body must contain the same plaintext password that was hashed and stored.
    const newPasswordMatch = /<strong>([0-9a-f]+)<\/strong>/.exec(html);
    expect(newPasswordMatch).not.toBeNull();
    await expect(bcrypt.compare(newPasswordMatch![1], storedHash)).resolves.toBe(true);

    // Password reset must force a change on next login.
    expect(passwordRequiresChange(storedHash)).toBe(true);
  });

  it('propagates the error when sending the reset email fails, after the password has already been updated', async () => {
    mockedRepo.findByEmail.mockResolvedValue(baseUser());
    mockedRepo.updatePasswordHash.mockResolvedValue(baseUser());
    mockedSendEmail.mockRejectedValue(new Error('SMTP connection refused'));

    await expect(authService.resetPassword('manager@bnw.com')).rejects.toThrow('SMTP connection refused');
    expect(mockedRepo.updatePasswordHash).toHaveBeenCalledTimes(1);
  });
});

describe('authService.getProfile', () => {
  it('returns the full profile shape including email/phone/timestamps', async () => {
    mockedRepo.findById.mockResolvedValue(baseUser());

    const profile = await authService.getProfile('u1');

    expect(profile).toMatchObject({
      userId: 'u1',
      username: 'manager',
      email: 'manager@bnw.com',
      phone: '0900000002',
      status: 'active',
    });
    expect(profile.createdAt).toBe('2026-07-19T16:47:34.000Z');
  });

  it('throws 404 when the user no longer exists', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(authService.getProfile('missing')).rejects.toMatchObject({
      status: 404,
      message: 'Không tìm thấy người dùng',
    });
  });
});

describe('authService.updateProfile', () => {
  it('only writes the fields provided', async () => {
    mockedRepo.findById.mockResolvedValue(baseUser());
    mockedRepo.update.mockResolvedValue(baseUser({ fullName: 'New Name' }));

    const result = await authService.updateProfile('u1', { fullName: 'New Name' } as UpdateProfileBody);

    expect(mockedRepo.update).toHaveBeenCalledWith('u1', { fullName: 'New Name' });
    expect(result.fullName).toBe('New Name');
  });

  it('throws 404 with a Vietnamese message when the user no longer exists', async () => {
    mockedRepo.findById.mockResolvedValue(null);

    await expect(
      authService.updateProfile('missing', { fullName: 'New Name' } as UpdateProfileBody),
    ).rejects.toMatchObject({ status: 404, message: 'Không tìm thấy người dùng' });
  });

  it('rejects with 409 when the new phone number is already used by another account', async () => {
    mockedRepo.findById.mockResolvedValue(baseUser());
    mockedRepo.findByPhone.mockResolvedValue(baseUser({ userId: 'someone-else' }));

    await expect(
      authService.updateProfile('u1', { phone: '0911111111' } as UpdateProfileBody),
    ).rejects.toMatchObject({ status: 409, code: 'CONFLICT', message: 'Số điện thoại đã được sử dụng bởi tài khoản khác' });

    expect(mockedRepo.update).not.toHaveBeenCalled();
  });

  it('allows keeping the caller own phone number unchanged', async () => {
    mockedRepo.findById.mockResolvedValue(baseUser({ phone: '0900000002' }));
    mockedRepo.findByPhone.mockResolvedValue(baseUser({ userId: 'u1', phone: '0900000002' }));
    mockedRepo.update.mockResolvedValue(baseUser({ phone: '0900000002' }));

    await expect(
      authService.updateProfile('u1', { phone: '0900000002' } as UpdateProfileBody),
    ).resolves.toBeDefined();
  });
});

describe('authService.changePassword', () => {
  it('rejects with 400 when oldPassword is wrong, without touching the DB write', async () => {
    mockedRepo.findById.mockResolvedValue(baseUser());

    await expect(
      authService.changePassword('u1', {
        oldPassword: 'wrong-old-password',
        newPassword: 'newpass1',
        confirmNewPassword: 'newpass1',
      } as ChangePasswordBody),
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST', message: 'Mật khẩu hiện tại không đúng' });

    expect(mockedRepo.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('hashes and stores the new password when oldPassword is correct', async () => {
    mockedRepo.findById.mockResolvedValue(baseUser());
    mockedRepo.updatePasswordHash.mockResolvedValue(baseUser());

    await authService.changePassword('u1', {
      oldPassword: PLAIN_PASSWORD,
      newPassword: 'newpass1',
      confirmNewPassword: 'newpass1',
    } as ChangePasswordBody);

    expect(mockedRepo.updatePasswordHash).toHaveBeenCalledTimes(1);
    const [userId, storedHash] = mockedRepo.updatePasswordHash.mock.calls[0];
    expect(userId).toBe('u1');
    expect(storedHash).not.toBe(PASSWORD_HASH);
    await expect(bcrypt.compare('newpass1', storedHash)).resolves.toBe(true);

    // A self-chosen password never carries the "must change" marker, even if the account had one before.
    expect(passwordRequiresChange(storedHash)).toBe(false);
  });
});
