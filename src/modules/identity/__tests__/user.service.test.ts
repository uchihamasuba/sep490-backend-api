import type { User } from '@prisma/client';
import bcrypt from 'bcrypt';
import { userRepository } from '../user.repository';
import { userService } from '../user.service';
import { sendEmail } from '../../../utils/mailer';
import type { CreateUserBody } from '../user.validators';

jest.mock('../user.repository', () => ({
  userRepository: {
    findByUsername: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updatePasswordHash: jest.fn(),
  },
}));

jest.mock('../../../utils/mailer', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

const mockedRepo = userRepository as jest.Mocked<typeof userRepository>;
const mockedSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockedBcryptHash = bcrypt.hash as unknown as jest.Mock;

function baseUser(overrides: Partial<User> = {}): User {
  return {
    userId: 'u1',
    username: 'newuser',
    passwordHash: 'hashed-password',
    fullName: 'Nguyen Van A',
    role: 'STAFF',
    status: 'ACTIVE',
    email: null,
    phone: null,
    bio: null,
    avatarUrl: null,
    employeeCode: null,
    jobTitle: null,
    deviceToken: null,
    createdAt: new Date('2026-01-10T00:00:00Z'),
    updatedAt: new Date('2026-01-10T00:00:00Z'),
    ...overrides,
  };
}

function validBody(overrides: Partial<CreateUserBody> = {}): CreateUserBody {
  return {
    username: 'newuser',
    password: 'plain-password',
    fullName: 'Nguyen Van A',
    role: 'STAFF',
    ...overrides,
  } as CreateUserBody;
}

describe('userService.createUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRepo.findByUsername.mockResolvedValue(null);
    mockedRepo.findByEmail.mockResolvedValue(null);
    mockedRepo.findByPhone.mockResolvedValue(null);
  });

  it('sends the account email with the username and plaintext password when body.email is provided', async () => {
    mockedRepo.create.mockResolvedValue(baseUser({ email: 'newuser@example.com' }));
    mockedSendEmail.mockResolvedValue(undefined);

    const result = await userService.createUser(validBody({ email: 'newuser@example.com' }));

    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    const [to, , html] = mockedSendEmail.mock.calls[0];
    expect(to).toBe('newuser@example.com');
    expect(html).toContain('newuser');
    expect(html).toContain('plain-password');
    expect(result).toMatchObject({ userId: 'u1', username: 'newuser' });

    // Password emailed in plaintext -> must be forced to change on next login (cost-factor marker,
    // no DB column added). See src/utils/password.ts.
    expect(mockedBcryptHash).toHaveBeenCalledWith('plain-password', 12);
  });

  it('does not send an email when body.email is not provided', async () => {
    mockedRepo.create.mockResolvedValue(baseUser());

    await userService.createUser(validBody({ email: undefined }));

    expect(mockedSendEmail).not.toHaveBeenCalled();
    // No email sent -> no forced change, hashed with the normal cost factor.
    expect(mockedBcryptHash).toHaveBeenCalledWith('plain-password', 10);
  });

  it('does not throw and still returns the user detail when sending the email fails', async () => {
    mockedRepo.create.mockResolvedValue(baseUser({ email: 'newuser@example.com' }));
    mockedSendEmail.mockRejectedValue(new Error('SMTP connection refused'));

    const result = await userService.createUser(validBody({ email: 'newuser@example.com' }));

    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ userId: 'u1', username: 'newuser' });
  });
});

describe('userService.resetUserPassword', () => {
  it('throws 404 when the user does not exist, without touching the DB write or sending an email', async () => {
    mockedRepo.findById.mockResolvedValue(null);

    await expect(userService.resetUserPassword('missing', 'newpass1')).rejects.toMatchObject({
      status: 404,
      message: 'Không tìm thấy người dùng',
    });

    expect(mockedRepo.updatePasswordHash).not.toHaveBeenCalled();
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it('hashes the new password as must-change, stores it, and emails it when the user has an email on file', async () => {
    mockedRepo.findById.mockResolvedValue(baseUser({ email: 'newuser@example.com' }));
    mockedRepo.updatePasswordHash.mockResolvedValue(baseUser({ email: 'newuser@example.com' }));
    mockedSendEmail.mockResolvedValue(undefined);

    const result = await userService.resetUserPassword('u1', 'newpass1');

    expect(mockedBcryptHash).toHaveBeenCalledWith('newpass1', 12);
    expect(mockedRepo.updatePasswordHash).toHaveBeenCalledWith('u1', 'hashed-password');

    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    const [to, , html] = mockedSendEmail.mock.calls[0];
    expect(to).toBe('newuser@example.com');
    expect(html).toContain('newpass1');
    expect(result).toMatchObject({ userId: 'u1' });
  });

  it('skips sending an email when the user has no email on file, but still resets the password', async () => {
    mockedRepo.findById.mockResolvedValue(baseUser({ email: null }));
    mockedRepo.updatePasswordHash.mockResolvedValue(baseUser({ email: null }));

    await userService.resetUserPassword('u1', 'newpass1');

    expect(mockedRepo.updatePasswordHash).toHaveBeenCalledTimes(1);
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it('does not throw and still returns the user detail when sending the email fails', async () => {
    mockedRepo.findById.mockResolvedValue(baseUser({ email: 'newuser@example.com' }));
    mockedRepo.updatePasswordHash.mockResolvedValue(baseUser({ email: 'newuser@example.com' }));
    mockedSendEmail.mockRejectedValue(new Error('SMTP connection refused'));

    const result = await userService.resetUserPassword('u1', 'newpass1');

    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ userId: 'u1' });
  });
});
