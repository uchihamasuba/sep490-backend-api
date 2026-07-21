import { Router } from 'express';
import authRoutes from './modules/identity/auth.routes';
import userRoutes from './modules/identity/user.routes';
import employeeRoutes from './modules/identity/employee.routes';
import employeeRoleRoutes from './modules/identity/employeeRole.routes';
import customerRoutes from './modules/sales/customer.routes';
import orderRoutes from './modules/sales/order.routes';
import { depositRouter, settlementRouter } from './modules/sales/payment.routes';
import { customerQuotationRouter, quotationRouter } from './modules/sales/quotation.routes';
import { scheduleRouter, workTaskRouter } from './modules/operations/schedule.routes';
import surveyRoutes from './modules/operations/survey.routes';
import eventRoutes from './modules/operations/event.routes';
import { supplierRouter, supplierTransactionRouter } from './modules/operations/supplier.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import catalogItemRoutes from './modules/shared/catalog.routes';
import catalogCategoryRoutes from './modules/shared/catalogCategory.routes';
import catalogTypeRoutes from './modules/shared/catalogType.routes';
import policyRoutes from './modules/shared/policy.routes';
import evidenceRoutes from './modules/shared/evidence.routes';
import settingsRoutes from './modules/shared/settings.routes';
import mobileOrderRoutes from './modules/mobile/mobile.routes';

// Root router — mounted under /api/v1 in app.ts.
// Feature modules register themselves here as they're built out.
const api = Router();

api.use('/auth', authRoutes);
api.use('/users', userRoutes);
api.use('/employees', employeeRoutes);
api.use('/employee-roles', employeeRoleRoutes);
api.use('/customers', customerRoutes);
api.use('/customers/:customerId/quotations', customerQuotationRouter);
api.use('/quotations', quotationRouter);
api.use('/orders', orderRoutes);
api.use('/deposits', depositRouter);
api.use('/settlements', settlementRouter);
api.use('/schedule-plans', scheduleRouter);
api.use('/work-tasks', workTaskRouter);
api.use('/survey-reports', surveyRoutes);
api.use('/events', eventRoutes);
api.use('/suppliers', supplierRouter);
api.use('/supplier-transactions', supplierTransactionRouter);
api.use('/inventory', inventoryRoutes);
api.use('/catalog/items', catalogItemRoutes);
api.use('/catalog/categories', catalogCategoryRoutes);
api.use('/catalog/types', catalogTypeRoutes);
api.use('/policies', policyRoutes);
api.use('/evidence', evidenceRoutes);
api.use('/settings', settingsRoutes);
api.use('/mobile/orders', mobileOrderRoutes);

export default api;
