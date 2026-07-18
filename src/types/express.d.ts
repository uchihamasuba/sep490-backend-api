export type UserRole = 'ADMIN' | 'MANAGER' | 'LEADER' | 'TECHNICAL';

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
