import {
  loginBodySchema,
  forgotPasswordBodySchema,
  resetPasswordBodySchema,
  updateProfileBodySchema,
  changePasswordBodySchema,
} from '../auth.validators';
import {
  createEmployeeBodySchema,
  updateEmployeeBodySchema,
  updateEmployeeStatusBodySchema,
  inviteEmployeeBodySchema,
  listEmployeesQuerySchema,
} from '../employee.validators';
import {
  createUserBodySchema,
  updateUserBodySchema,
  updateUserStatusBodySchema,
  listUsersQuerySchema,
} from '../user.validators';
import { EMPLOYEE_ROLES } from '../employeeRole.constants';

describe('Zod Validators Bulk Tests', () => {
  const validRole = EMPLOYEE_ROLES[0].id;

  describe('auth.validators.ts', () => {
    describe('loginBodySchema', () => {
      const validPayload = { username: 'user1', password: 'password123' };
      it.each([
        { payload: validPayload, expected: true },
        { payload: { username: 'user1' }, expected: false },
        { payload: { password: 'password123' }, expected: false },
        { payload: { username: '', password: 'password123' }, expected: false },
        { payload: { username: 'user1', password: '' }, expected: false },
        ...Array.from({ length: 15 }, (_, i) => ({
          payload: { username: `user${i}`, password: `pass${i}` },
          expected: true,
        })),
      ])('validates %j => %s', ({ payload, expected }) => {
        expect(loginBodySchema.safeParse(payload).success).toBe(expected);
      });
    });

    describe('forgotPasswordBodySchema', () => {
      it.each([
        { payload: { username: 'user1' }, expected: true },
        { payload: { username: '' }, expected: false },
        { payload: {}, expected: false },
        ...Array.from({ length: 15 }, (_, i) => ({
          payload: { username: `user${i}` },
          expected: true,
        })),
      ])('validates %j => %s', ({ payload, expected }) => {
        expect(forgotPasswordBodySchema.safeParse(payload).success).toBe(expected);
      });
    });

    describe('resetPasswordBodySchema', () => {
      it.each([
        { payload: { email: 'test@bnw.com' }, expected: true },
        { payload: { email: 'not-an-email' }, expected: false },
        { payload: { email: '' }, expected: false },
        { payload: {}, expected: false },
        ...Array.from({ length: 15 }, (_, i) => ({
          payload: { email: `test${i}@bnw.com` },
          expected: true,
        })),
      ])('validates %j => %s', ({ payload, expected }) => {
        expect(resetPasswordBodySchema.safeParse(payload).success).toBe(expected);
      });
    });

    describe('updateProfileBodySchema', () => {
      it.each([
        { payload: {}, expected: true },
        { payload: { fullName: 'Name' }, expected: true },
        { payload: { phone: '0901234567' }, expected: true },
        { payload: { email: 'test@bnw.com' }, expected: true },
        { payload: { bio: 'hello', avatarUrl: 'http://img.jpg' }, expected: true },
        { payload: { email: 'invalid' }, expected: false },
        { payload: { fullName: '' }, expected: false },
        { payload: { phone: '' }, expected: false },
        ...Array.from({ length: 15 }, (_, i) => ({
          payload: { fullName: `User ${i}`, phone: `09000000${i.toString().padStart(2, '0')}` },
          expected: true,
        })),
      ])('validates %j => %s', ({ payload, expected }) => {
        expect(updateProfileBodySchema.safeParse(payload).success).toBe(expected);
      });
    });

    describe('changePasswordBodySchema', () => {
      it.each([
        { payload: { oldPassword: 'old', newPassword: 'new123', confirmNewPassword: 'new123' }, expected: true },
        { payload: { oldPassword: 'old', newPassword: 'new123', confirmNewPassword: 'wrong' }, expected: false },
        { payload: { oldPassword: 'old', newPassword: 'short', confirmNewPassword: 'short' }, expected: false },
        { payload: { newPassword: 'new123', confirmNewPassword: 'new123' }, expected: false },
        ...Array.from({ length: 15 }, (_, i) => ({
          payload: { oldPassword: 'old', newPassword: `newPass${i}`, confirmNewPassword: `newPass${i}` },
          expected: true,
        })),
      ])('validates %j => %s', ({ payload, expected }) => {
        expect(changePasswordBodySchema.safeParse(payload).success).toBe(expected);
      });
    });
  });

  describe('employee.validators.ts', () => {
    describe('createEmployeeBodySchema', () => {
      it.each([
        { payload: { name: 'Emp', email: 'e@bnw.com', roleId: validRole }, expected: true },
        { payload: { name: 'Emp', email: 'e@bnw.com', roleId: validRole, role: 'STAFF', status: 'ACTIVE' }, expected: true },
        { payload: { name: 'Emp', email: 'e@bnw.com', roleId: validRole, role: 'ADMIN' }, expected: false },
        { payload: { name: 'Emp', email: 'e@bnw.com', roleId: 'INVALID_ROLE' }, expected: false },
        { payload: { name: '', email: 'e@bnw.com', roleId: validRole }, expected: false },
        { payload: { name: 'Emp', email: 'not-email', roleId: validRole }, expected: false },
        ...Array.from({ length: 15 }, (_, i) => ({
          payload: { name: `Emp ${i}`, email: `e${i}@bnw.com`, roleId: validRole },
          expected: true,
        })),
      ])('validates %j => %s', ({ payload, expected }) => {
        expect(createEmployeeBodySchema.safeParse(payload).success).toBe(expected);
      });
    });

    describe('updateEmployeeBodySchema', () => {
      it.each([
        { payload: { name: 'Emp', email: 'e@bnw.com', roleId: validRole }, expected: true },
        { payload: { name: 'Emp', email: 'e@bnw.com', roleId: validRole, role: 'STAFF' }, expected: true },
        { payload: { name: 'Emp', email: 'e@bnw.com', roleId: validRole, role: 'ADMIN' }, expected: false },
        { payload: { name: 'Emp', email: 'e@bnw.com', roleId: 'INVALID_ROLE' }, expected: false },
        ...Array.from({ length: 15 }, (_, i) => ({
          payload: { name: `Emp ${i}`, email: `e${i}@bnw.com`, roleId: validRole },
          expected: true,
        })),
      ])('validates %j => %s', ({ payload, expected }) => {
        expect(updateEmployeeBodySchema.safeParse(payload).success).toBe(expected);
      });
    });

    describe('updateEmployeeStatusBodySchema', () => {
      it.each([
        { payload: { status: 'ACTIVE' }, expected: true },
        { payload: { status: 'INACTIVE' }, expected: true },
        { payload: { status: 'SUSPENDED' }, expected: false },
        { payload: {}, expected: false },
      ])('validates %j => %s', ({ payload, expected }) => {
        expect(updateEmployeeStatusBodySchema.safeParse(payload).success).toBe(expected);
      });
    });

    describe('inviteEmployeeBodySchema', () => {
      it.each([
        { payload: { fullName: 'Emp', email: 'e@bnw.com', roleId: validRole }, expected: true },
        { payload: { fullName: '', email: 'e@bnw.com', roleId: validRole }, expected: false },
        { payload: { fullName: 'Emp', email: 'not-email', roleId: validRole }, expected: false },
        { payload: { fullName: 'Emp', email: 'e@bnw.com', roleId: 'INVALID' }, expected: false },
        ...Array.from({ length: 15 }, (_, i) => ({
          payload: { fullName: `Emp ${i}`, email: `e${i}@bnw.com`, roleId: validRole },
          expected: true,
        })),
      ])('validates %j => %s', ({ payload, expected }) => {
        expect(inviteEmployeeBodySchema.safeParse(payload).success).toBe(expected);
      });
    });

    describe('listEmployeesQuerySchema', () => {
      it.each([
        { payload: {}, expected: true },
        { payload: { page: 1, limit: 10 }, expected: true },
        { payload: { page: '2', limit: '20' }, expected: true }, // coercing
        { payload: { page: 0 }, expected: false },
        { payload: { limit: 201 }, expected: false },
        { payload: { search: '' }, expected: false },
        ...Array.from({ length: 15 }, (_, i) => ({
          payload: { page: i + 1, limit: 10 + i },
          expected: true,
        })),
      ])('validates %j => %s', ({ payload, expected }) => {
        expect(listEmployeesQuerySchema.safeParse(payload).success).toBe(expected);
      });
    });
  });

  describe('user.validators.ts', () => {
    describe('createUserBodySchema', () => {
      it.each([
        { payload: { username: 'user1', email: 'u1@bnw.com', fullName: 'User', role: 'STAFF', status: 'ACTIVE' }, expected: false }, // missing password
        { payload: { username: 'user1', password: 'password123', email: 'u1@bnw.com', fullName: 'User', role: 'STAFF', status: 'ACTIVE' }, expected: true },
        { payload: { username: '', email: 'u1@bnw.com', fullName: 'User', role: 'STAFF', status: 'ACTIVE' }, expected: false },
        { payload: { username: 'user1', password: 'password123', email: 'not-email', fullName: 'User', role: 'STAFF', status: 'ACTIVE' }, expected: false },
        { payload: { username: 'user1', password: 'password123', email: 'u1@bnw.com', fullName: 'User', role: 'INVALID', status: 'ACTIVE' }, expected: false },
        ...Array.from({ length: 45 }, (_, i) => ({
          payload: { username: `user${i}`, password: 'password123', email: `u${i}@bnw.com`, fullName: `User ${i}`, role: 'STAFF', status: 'ACTIVE' },
          expected: true,
        })),
      ])('validates %j => %s', ({ payload, expected }) => {
        expect(createUserBodySchema.safeParse(payload).success).toBe(expected);
      });
    });

    describe('updateUserBodySchema', () => {
      it.each([
        { payload: {}, expected: false }, // missing required email
        { payload: { fullName: 'Name', email: 'test@bnw.com' }, expected: true },
        { payload: { email: 'test@bnw.com' }, expected: true },
        { payload: { role: 'MANAGER', email: 'test@bnw.com' }, expected: true },
        { payload: { email: 'invalid' }, expected: false },
        { payload: { email: 'test@bnw.com', role: 'INVALID' }, expected: false },
        ...Array.from({ length: 45 }, (_, i) => ({
          payload: { fullName: `Name ${i}`, email: `test${i}@bnw.com` },
          expected: true,
        })),
      ])('validates %j => %s', ({ payload, expected }) => {
        expect(updateUserBodySchema.safeParse(payload).success).toBe(expected);
      });
    });

    describe('updateUserStatusBodySchema', () => {
      it.each([
        { payload: { status: 'ACTIVE' }, expected: true },
        { payload: { status: 'INACTIVE' }, expected: true },
        { payload: { status: 'SUSPENDED' }, expected: true },
        { payload: { status: 'INVALID' }, expected: false },
        { payload: {}, expected: false },
      ])('validates %j => %s', ({ payload, expected }) => {
        expect(updateUserStatusBodySchema.safeParse(payload).success).toBe(expected);
      });
    });

    describe('listUsersQuerySchema', () => {
      it.each([
        { payload: {}, expected: true },
        { payload: { role: 'MANAGER' }, expected: true },
        { payload: { status: 'ACTIVE' }, expected: true },
        { payload: { role: 'INVALID' }, expected: false },
        ...Array.from({ length: 45 }, (_, i) => ({
          payload: { page: i + 1, limit: 15 },
          expected: true,
        })),
      ])('validates %j => %s', ({ payload, expected }) => {
        expect(listUsersQuerySchema.safeParse(payload).success).toBe(expected);
      });
    });
  });
});
