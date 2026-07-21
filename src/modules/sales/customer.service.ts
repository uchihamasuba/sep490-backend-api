import { randomUUID } from 'crypto';
import type { ActiveStatus, Customer, Order, OrderStatus } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { customerRepository } from './customer.repository';
import type {
  CreateCustomerBody,
  ListCustomerOrdersQuery,
  ListCustomersQuery,
  UpdateCustomerBody,
} from './customer.validators';

export type ApiCustomerStatus = 'active' | 'inactive';

export interface CustomerDTO {
  customerId: string;
  customerName: string;
  phone: string;
  email: string;
  address: string | null;
  notes: string | null;
  status: ApiCustomerStatus;
  totalBookings: number;
  totalSpent: number;
}

export interface CustomerListMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  counts: { all: number; active: number; inactive: number };
}

export interface CustomerListResult {
  data: CustomerDTO[];
  meta: CustomerListMeta;
}

export interface CustomerSummaryDTO {
  customer: CustomerDTO;
  createdAt: string;
  totalValue: number;
  paidAmount: number;
  remainingDebt: number;
  paymentRate: number;
  activeOrdersCount: number;
}

export interface CustomerOrderDTO {
  orderId: string;
  event: string;
  date: string;
  value: number;
  status: OrderStatus;
  coordinator: string;
}

export interface CustomerOrdersListResult {
  data: CustomerOrderDTO[];
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
}

function toApiStatus(status: ActiveStatus): ApiCustomerStatus {
  return status === 'ACTIVE' ? 'active' : 'inactive';
}

function toDbStatus(status: ApiCustomerStatus): ActiveStatus {
  return status === 'active' ? 'ACTIVE' : 'INACTIVE';
}

function toDbEmail(email: string | undefined): string | null {
  return email && email.length > 0 ? email : null;
}

function toDbNotes(notes: string | undefined): string | null {
  return notes && notes.length > 0 ? notes : null;
}

function toNumber(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function mapCustomer(customer: Customer, stats?: { totalBookings: number; totalSpent: unknown }): CustomerDTO {
  return {
    customerId: customer.customerId,
    customerName: customer.customerName,
    phone: customer.phone,
    email: customer.email ?? '',
    address: customer.address,
    notes: customer.notes,
    status: toApiStatus(customer.status),
    totalBookings: stats?.totalBookings ?? 0,
    totalSpent: toNumber(stats?.totalSpent),
  };
}

function mapOrder(order: Order & { creator: { fullName: string } }): CustomerOrderDTO {
  return {
    orderId: order.orderId,
    event: order.eventName ? `${order.eventType} — ${order.eventName}` : order.eventType,
    date: order.eventDate.toISOString(),
    value: toNumber(order.totalAmount),
    status: order.orderStatus,
    coordinator: order.creator.fullName,
  };
}

async function findCustomerOrThrow(customerId: string): Promise<Customer> {
  const customer = await customerRepository.findById(customerId);
  if (!customer) throw AppError.notFound('Customer not found');
  return customer;
}

async function listCustomers(query: ListCustomersQuery): Promise<CustomerListResult> {
  const { page, limit } = query;
  const skip = (page - 1) * limit;
  const dbStatus = query.status ? toDbStatus(query.status) : undefined;

  const [{ rows, totalItems }, counts] = await Promise.all([
    customerRepository.findMany({ status: dbStatus, search: query.search, skip, take: limit }),
    customerRepository.countByStatus(query.search),
  ]);

  const customerIds = rows.map((row) => row.customerId);
  const stats = await customerRepository.getOrderStatsByCustomerIds(customerIds);
  const statsMap = new Map(
    stats.map((s) => [s.customerId, { totalBookings: s._count._all, totalSpent: s._sum.totalAmount }]),
  );

  return {
    data: rows.map((row) => mapCustomer(row, statsMap.get(row.customerId))),
    meta: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      counts,
    },
  };
}

async function createCustomer(body: CreateCustomerBody): Promise<CustomerDTO> {
  // Đã chốt ở docs/api/taokhachhang_api.md mục 4, quyết định 2: không cho phép trùng số điện thoại.
  // DB thật chưa có UNIQUE INDEX trên cột phone nên đây là chốt chặn duy nhất hiện có (còn race condition
  // giữa 2 request đồng thời — cần bổ sung UNIQUE INDEX ở migration để chặn tận gốc, ngoài phạm vi sửa đổi
  // ở tầng service này).
  const existingByPhone = await customerRepository.findByPhone(body.phone);
  if (existingByPhone) {
    throw new AppError(409, 'PHONE_ALREADY_EXISTS', 'Số điện thoại đã tồn tại trong hệ thống');
  }

  const customerId = randomUUID();
  const created = await customerRepository.create({
    customerId,
    // customer_code is a legacy NOT NULL/UNIQUE column no longer surfaced by the API
    // (see docs/api/khach_hang_api.md §1) — reuse customerId so it stays trivially unique.
    customerCode: customerId,
    customerName: body.customerName,
    phone: body.phone,
    email: toDbEmail(body.email),
    address: body.address ?? null,
    notes: toDbNotes(body.notes),
    status: toDbStatus(body.status),
  });
  return mapCustomer(created, { totalBookings: 0, totalSpent: 0 });
}

async function getCustomerById(customerId: string): Promise<CustomerDTO> {
  const customer = await findCustomerOrThrow(customerId);
  const stats = await customerRepository.getOrderStatsForCustomer(customerId);
  return mapCustomer(customer, stats);
}

async function updateCustomer(customerId: string, body: UpdateCustomerBody): Promise<CustomerDTO> {
  await findCustomerOrThrow(customerId);
  const updated = await customerRepository.update(customerId, {
    customerName: body.customerName,
    phone: body.phone,
    email: toDbEmail(body.email),
    address: body.address ?? null,
    notes: toDbNotes(body.notes),
    status: toDbStatus(body.status),
  });
  const stats = await customerRepository.getOrderStatsForCustomer(customerId);
  return mapCustomer(updated, stats);
}

async function deleteCustomer(customerId: string): Promise<void> {
  await findCustomerOrThrow(customerId);
  const orderCount = await customerRepository.countOrders(customerId);
  if (orderCount > 0) {
    throw AppError.conflict('Không thể xóa khách hàng đã có đơn hàng');
  }
  await customerRepository.delete(customerId);
}

async function getCustomerSummary(customerId: string): Promise<CustomerSummaryDTO> {
  const customer = await findCustomerOrThrow(customerId);
  const orderIds = await customerRepository.getOrderIdsForCustomer(customerId);

  const [stats, depositSum, settlementSum, activeOrdersCount] = await Promise.all([
    customerRepository.getOrderStatsForCustomer(customerId),
    customerRepository.sumSuccessfulDeposits(orderIds),
    customerRepository.sumSettledAmounts(orderIds),
    customerRepository.countActiveOrders(customerId),
  ]);

  const totalValue = toNumber(stats.totalSpent);
  const paidAmount = toNumber(depositSum._sum.amount) + toNumber(settlementSum._sum.finalAmount);
  const remainingDebt = totalValue - paidAmount;
  const paymentRate = totalValue === 0 ? 100 : Math.round((paidAmount / totalValue) * 100);

  return {
    customer: mapCustomer(customer, stats),
    createdAt: customer.createdAt.toISOString(),
    totalValue,
    paidAmount,
    remainingDebt,
    paymentRate,
    activeOrdersCount,
  };
}

async function getCustomerOrders(
  customerId: string,
  query: ListCustomerOrdersQuery,
): Promise<CustomerOrdersListResult> {
  await findCustomerOrThrow(customerId);

  const { page, limit } = query;
  const skip = (page - 1) * limit;
  const { rows, totalItems } = await customerRepository.listOrders(
    customerId,
    { search: query.search, status: query.status, serviceFilter: query.serviceFilter },
    skip,
    limit,
  );

  return {
    data: rows.map(mapOrder),
    meta: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) },
  };
}

async function getNextCustomerCode(): Promise<{ nextCustomerCode: string }> {
  const nextCustomerCode = await customerRepository.generateNextCustomerCode();
  return { nextCustomerCode };
}

export const customerService = {
  listCustomers,
  getNextCustomerCode,
  createCustomer,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  getCustomerSummary,
  getCustomerOrders,
};
