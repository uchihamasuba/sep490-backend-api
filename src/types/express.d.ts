export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF';

export interface AuthPrincipal {
  id: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPrincipal;
    }
  }
}

export {};
