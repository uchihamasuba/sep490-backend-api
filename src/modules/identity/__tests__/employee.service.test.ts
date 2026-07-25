import type { User } from '@prisma/client';
import { employeeRepository } from '../employee.repository';
import { employeeService } from '../employee.service';
import { sendEmail } from '../../../utils/mailer';
import type { InviteEmployeeBody } from '../employee.validators';

jest.mock('../employee.repository', () => ({
  employeeRepository: {
    findMany: jest.fn(),
    countByJobTitle: jest.fn(),
    countAll: jest.fn(),
    findById: jest.fn(),
    findByUsername: jest.fn(),
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
    generateNextEmployeeCode: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('../../../utils/mailer', () => ({
  sendEmail: jest.fn(),
}));

const mockedRepo = employeeRepository as jest.Mocked<typeof employeeRepository>;
const mockedSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

function baseUser(overrides: Partial<User> = {}): User {
  return {
    userId: 'u1',
    username: '0912345678',
    passwordHash: 'hashed',
    fullName: 'Nguyen Van A',
    role: 'STAFF',
    status: 'ACTIVE',
    email: 'a@bnw.com',
    phone: '0912345678',
    bio: null,
    avatarUrl: null,
    employeeCode: 'NV001',
    jobTitle: 'Kỹ thuật',
    deviceToken: null,
    createdAt: new Date('2026-01-10T00:00:00Z'),
    updatedAt: new Date('2026-01-10T00:00:00Z'),
    ...overrides,
  };
}

function validBody(overrides: Partial<InviteEmployeeBody> = {}): InviteEmployeeBody {
  return {
    email: 'new.employee@bnw.com',
    fullName: 'Nguyen Van B',
    phone: '0987654321',
    roleId: 'ky-thuat',
    ...overrides,
  };
}

describe('employeeService.inviteEmployee', () => {
  beforeEach(() => {
    mockedRepo.findByEmail.mockResolvedValue(null);
    mockedRepo.findByPhone.mockResolvedValue(null);
    mockedRepo.findByUsername.mockResolvedValue(null);
    mockedRepo.generateNextEmployeeCode.mockResolvedValue('NV002');
    mockedSendEmail.mockResolvedValue(undefined);
  });

  it('creates the account, hashes a temp password, emails the credentials, and returns the DTO without the plaintext password', async () => {
    mockedRepo.create.mockResolvedValue(baseUser({ userId: 'u2', email: 'new.employee@bnw.com', employeeCode: 'NV002' }));

    const result = await employeeService.inviteEmployee(validBody());

    expect(mockedRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: 'Nguyen Van B',
        phone: '0987654321',
        email: 'new.employee@bnw.com',
        role: 'STAFF',
        status: 'ACTIVE',
        jobTitle: 'Kỹ thuật',
        employeeCode: 'NV002',
      }),
    );

    expect(mockedSendEmail).toHaveBeenCalledTimes(1);
    const [to, subject, html] = mockedSendEmail.mock.calls[0];
    expect(to).toBe('new.employee@bnw.com');
    expect(subject).toContain('Tài khoản');
    expect(html).toContain(result.username);

    expect(result).toMatchObject({ id: 'u2', employeeCode: 'NV002', email: 'new.employee@bnw.com' });
    expect(result).not.toHaveProperty('tempPassword');
  });

  it('rejects an unknown roleId with 400 before touching the repository', async () => {
    await expect(employeeService.inviteEmployee(validBody({ roleId: 'not-a-real-role' }))).rejects.toMatchObject({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'roleId không hợp lệ',
    });

    expect(mockedRepo.findByEmail).not.toHaveBeenCalled();
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it('rejects with 409 when the email already exists, without creating the account', async () => {
    mockedRepo.findByEmail.mockResolvedValue(baseUser());

    await expect(employeeService.inviteEmployee(validBody())).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'Email đã được sử dụng',
    });

    expect(mockedRepo.create).not.toHaveBeenCalled();
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it('rejects with 409 when the phone already exists, without creating the account', async () => {
    mockedRepo.findByPhone.mockResolvedValue(baseUser());

    await expect(employeeService.inviteEmployee(validBody())).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'Số điện thoại đã được sử dụng',
    });

    expect(mockedRepo.create).not.toHaveBeenCalled();
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it('propagates the error when sending the invite email fails', async () => {
    mockedRepo.create.mockResolvedValue(baseUser({ userId: 'u2', employeeCode: 'NV002' }));
    mockedSendEmail.mockRejectedValue(new Error('SMTP connection refused'));

    await expect(employeeService.inviteEmployee(validBody())).rejects.toThrow('SMTP connection refused');
    expect(mockedRepo.create).toHaveBeenCalledTimes(1);
  });
});

describe('employeeService.createEmployee', () => {
  function validCreateBody(overrides: Partial<Parameters<typeof employeeService.createEmployee>[0]> = {}) {
    return {
      name: 'Nguyen Van C',
      phone: '0977777777',
      email: 'c@bnw.com',
      roleId: 'ky-thuat',
      role: 'STAFF' as const,
      status: 'ACTIVE' as const,
      ...overrides,
    };
  }

  beforeEach(() => {
    mockedRepo.findByEmail.mockResolvedValue(null);
    mockedRepo.findByPhone.mockResolvedValue(null);
    mockedRepo.findByUsername.mockResolvedValue(null);
    mockedRepo.generateNextEmployeeCode.mockResolvedValue('NV003');
  });

  it('rejects an unknown roleId with a Vietnamese message before touching the repository', async () => {
    await expect(employeeService.createEmployee(validCreateBody({ roleId: 'not-a-real-role' }))).rejects.toMatchObject({
      status: 400,
      message: 'roleId không hợp lệ',
    });
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it('rejects with 409 when the email is already used by another account', async () => {
    mockedRepo.findByEmail.mockResolvedValue(baseUser());

    await expect(employeeService.createEmployee(validCreateBody())).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'Email đã được sử dụng',
    });
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it('rejects with 409 when the phone is already used by another account', async () => {
    mockedRepo.findByPhone.mockResolvedValue(baseUser());

    await expect(employeeService.createEmployee(validCreateBody())).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'Số điện thoại đã được sử dụng',
    });
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it('creates the employee when email/phone are not taken', async () => {
    mockedRepo.create.mockResolvedValue(baseUser({ userId: 'u3', employeeCode: 'NV003' }));

    const result = await employeeService.createEmployee(validCreateBody());

    expect(result).toMatchObject({ id: 'u3', employeeCode: 'NV003' });
  });
});

describe('employeeService not-found flows', () => {
  it('getEmployeeById throws 404 with a Vietnamese message', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(employeeService.getEmployeeById('missing')).rejects.toMatchObject({
      status: 404,
      message: 'Không tìm thấy nhân viên',
    });
  });

  it('updateEmployeeStatus throws 404 with a Vietnamese message', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(employeeService.updateEmployeeStatus('missing', 'INACTIVE')).rejects.toMatchObject({
      status: 404,
      message: 'Không tìm thấy nhân viên',
    });
  });
});
