import { Router } from 'express';
import authRoutes from './modules/identity/auth.routes';
import customerRoutes from './modules/sales/customer.routes';

// Root router — mounted under /api/v1 in app.ts.
// Feature modules register themselves here as they're built out.
const api = Router();

api.use('/auth', authRoutes);
api.use('/customers', customerRoutes);

export default api;
