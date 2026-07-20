import { Router } from 'express';
import authRoutes from './modules/identity/auth.routes';
import customerRoutes from './modules/sales/customer.routes';
import orderRoutes from './modules/sales/order.routes';
import { customerQuotationRouter, quotationRouter } from './modules/sales/quotation.routes';
import { scheduleRouter, workTaskRouter } from './modules/operations/schedule.routes';
import surveyRoutes from './modules/operations/survey.routes';
import eventRoutes from './modules/operations/event.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';

// Root router — mounted under /api/v1 in app.ts.
// Feature modules register themselves here as they're built out.
const api = Router();

api.use('/auth', authRoutes);
api.use('/customers', customerRoutes);
api.use('/customers/:customerId/quotations', customerQuotationRouter);
api.use('/quotations', quotationRouter);
api.use('/orders', orderRoutes);
api.use('/schedule-plans', scheduleRouter);
api.use('/work-tasks', workTaskRouter);
api.use('/survey-reports', surveyRoutes);
api.use('/events', eventRoutes);
api.use('/inventory', inventoryRoutes);

export default api;
