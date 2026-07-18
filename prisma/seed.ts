// Nạp dữ liệu mock từ sep490-web-frontend (xem prisma/seed-data/*.ts) vào DB backend.
//
// LƯU Ý QUAN TRỌNG: script này gọi `prisma.businessPolicy` / `prisma.user` / `prisma.itemCategory` /
// `prisma.itemType` / `prisma.item` / `prisma.customer` / `prisma.supplier` / `prisma.order` — các
// model này CHƯA tồn tại trong prisma/schema.prisma (Task 2.1 chỉ chuẩn bị dữ liệu + script seed).
// Task 2.2 sẽ định nghĩa 24 bảng lõi vào schema.prisma theo đúng tên field/kiểu dữ liệu mà file này
// giả định (camelCase, @map về snake_case theo docs/TABLES.md), sau đó chạy
// `npx prisma migrate dev --name init_core && npx prisma db seed` để thực thi file này thật.
//
// Thứ tự insert tôn trọng khóa ngoại: policies/users (độc lập) -> categories -> types -> items ->
// customers -> suppliers -> orders (phụ thuộc customers + users.createdBy).
// Dùng createMany({ skipDuplicates: true }) để chạy lại seed nhiều lần trong lúc dev không bị lỗi
// trùng khóa chính.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { POLICIES } from './seed-data/policies';
import { USERS } from './seed-data/users';
import { CATEGORIES, TYPES, ITEMS } from './seed-data/catalog';
import { CUSTOMERS } from './seed-data/customers';
import { SUPPLIERS } from './seed-data/suppliers';
import { ORDERS } from './seed-data/orders';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

async function seedPolicies() {
  const result = await prisma.businessPolicy.createMany({ data: POLICIES, skipDuplicates: true });
  console.log(`business_policies: ${result.count} inserted (${POLICIES.length} in seed data)`);
}

async function seedUsers() {
  const data = await Promise.all(
    USERS.map(async ({ passwordPlaintext, ...user }) => ({
      ...user,
      passwordHash: await bcrypt.hash(passwordPlaintext, BCRYPT_ROUNDS),
    })),
  );
  const result = await prisma.user.createMany({ data, skipDuplicates: true });
  console.log(`users: ${result.count} inserted (${USERS.length} in seed data)`);
}

async function seedCatalog() {
  const categoryResult = await prisma.itemCategory.createMany({ data: CATEGORIES, skipDuplicates: true });
  console.log(`item_categories: ${categoryResult.count} inserted (${CATEGORIES.length} in seed data)`);

  const typeResult = await prisma.itemType.createMany({ data: TYPES, skipDuplicates: true });
  console.log(`item_types: ${typeResult.count} inserted (${TYPES.length} in seed data)`);

  const itemResult = await prisma.item.createMany({ data: ITEMS, skipDuplicates: true });
  console.log(`items: ${itemResult.count} inserted (${ITEMS.length} in seed data)`);
}

async function seedCustomers() {
  const result = await prisma.customer.createMany({ data: CUSTOMERS, skipDuplicates: true });
  console.log(`customers: ${result.count} inserted (${CUSTOMERS.length} in seed data)`);
}

async function seedSuppliers() {
  const result = await prisma.supplier.createMany({ data: SUPPLIERS, skipDuplicates: true });
  console.log(`suppliers: ${result.count} inserted (${SUPPLIERS.length} in seed data)`);
}

async function seedOrders() {
  const result = await prisma.order.createMany({ data: ORDERS, skipDuplicates: true });
  console.log(`orders: ${result.count} inserted (${ORDERS.length} in seed data)`);
}

async function main() {
  await seedPolicies();
  await seedUsers();
  await seedCatalog();
  await seedCustomers();
  await seedSuppliers();
  await seedOrders();
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
