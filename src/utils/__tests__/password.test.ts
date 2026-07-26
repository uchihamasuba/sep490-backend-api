import { hashPassword, hashPasswordRequiringChange, passwordRequiresChange } from '../password';

describe('password must-change marker (bcrypt cost factor, no DB column)', () => {
  it('hashPassword produces a hash that does not require a change', async () => {
    const hash = await hashPassword('some-password');
    expect(passwordRequiresChange(hash)).toBe(false);
  });

  it('hashPasswordRequiringChange produces a hash that requires a change', async () => {
    const hash = await hashPasswordRequiringChange('some-password');
    expect(passwordRequiresChange(hash)).toBe(true);
  });

  it('passwordRequiresChange returns false for a malformed/unexpected hash string', () => {
    expect(passwordRequiresChange('not-a-bcrypt-hash')).toBe(false);
  });
});
