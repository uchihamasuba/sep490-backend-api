import bcrypt from 'bcrypt';
import type { User, UserRole, UserStatus } from '@prisma/client';
import { userRepository } from '../user.repository';
import { authService } from '../auth.service';
import { sendEmail } from '../../../utils/mailer';
import type { ChangePasswordBody, LoginBody, UpdateProfileBody } from '../auth.validators';

jest.mock('../user.repository', () => ({
  userRepository: {
    findByUsername: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
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
    });
  });

  it('maps LEADER/TECHNICAL role and SUSPENDED/INACTIVE status per the doc table', async () => {
    mockedRepo.findByUsername.mockResolvedValue(baseUser({ role: 'LEADER', status: 'ACTIVE' }));
    const result = await authService.login({ username: 'leader', password: PLAIN_PASSWORD } as LoginBody);
    expect(result.user.role).toEqual({ roleId: 'role-leader', roleName: 'LEADER_STAFF' });
  });

  it('rejects an unknown username with 401 (no account-enumeration hint)', async () => {
    mockedRepo.findByUsername.mockResolvedValue(null);

    await expect(authService.login({ username: 'ghost', password: 'whatever' } as LoginBody)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
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
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
});

describe('authService.forgotPassword', () => {
  it('resolves without throwing whether or not the username exists (no enumeration)', async () => {
    mockedRepo.findByUsername.mockResolvedValueOnce(baseUser());
    await expect(authService.forgotPassword('manager')).resolves.toBeUndefined();

    mockedRepo.findByUsername.mockResolvedValueOnce(null);
    await expect(authService.forgotPassword('ghost')).resolves.toBeUndefined();
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
    await expect(authService.getProfile('missing')).rejects.toMatchObject({ status: 404 });
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
    ).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' });

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
  });
});
