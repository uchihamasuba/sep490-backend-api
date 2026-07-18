import { Router } from 'express';

// Root router — mounted under /api/v1 in app.ts.
// Feature modules (Phase 3+, e.g. identity/, catalog/, sales/...) register themselves here:
//   import authRoutes from './modules/identity/auth.routes';
//   api.use('/auth', authRoutes);
const api = Router();

export default api;
