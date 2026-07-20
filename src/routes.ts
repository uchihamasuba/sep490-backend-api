import { Router } from 'express';
import customerRoutes from './modules/sales/customer.routes';

// Root router — mounted under /api/v1 in app.ts.
// Feature modules (Phase 3+, e.g. identity/, catalog/, sales/...) register themselves here:
//   import authRoutes from './modules/identity/auth.routes';
//   api.use('/auth', authRoutes);
const api = Router();

api.use('/customers', customerRoutes);

export default api;
