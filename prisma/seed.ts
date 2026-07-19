import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

// Helper to generate IDs
const genId = () => crypto.randomUUID();

async function main() {
  console.log('Clearing existing data...');
  // We rely on `prisma migrate reset` to clear data, but just in case we can also do a quick clear if running this script standalone
  // Not strictly needed if `npx prisma migrate reset` is used.

  console.log('Seeding new data...');
  
  // 1. Users
  const passwordHash = await bcrypt.hash('123456', BCRYPT_ROUNDS);
  
  const adminId = genId();
  const managerId = genId();
  const leaderId = genId();
  const techId = genId();

  await prisma.user.createMany({
    data: [
      { userId: adminId, username: 'admin', passwordHash, fullName: 'System Admin', role: 'ADMIN', email: 'admin@bnw.com', phone: '0900000001' },
      { userId: managerId, username: 'manager', passwordHash, fullName: 'Project Manager', role: 'MANAGER', email: 'manager@bnw.com', phone: '0900000002' },
      { userId: leaderId, username: 'leader', passwordHash, fullName: 'Team Leader', role: 'LEADER', email: 'leader@bnw.com', phone: '0900000003' },
      { userId: techId, username: 'tech', passwordHash, fullName: 'Technician', role: 'TECHNICAL', email: 'tech@bnw.com', phone: '0900000004' }
    ]
  });

  // 2. Customers
  const customerId1 = genId();
  const customerId2 = genId();
  await prisma.customer.createMany({
    data: [
      { customerId: customerId1, customerCode: 'CUS-001', customerName: 'Tech Corp', phone: '0911111111', email: 'techcorp@example.com', address: '123 Tech St.' },
      { customerId: customerId2, customerCode: 'CUS-002', customerName: 'Event Pro', phone: '0922222222', email: 'eventpro@example.com', address: '456 Event Ave.' }
    ]
  });

  // 3. Suppliers
  const supplierId1 = genId();
  await prisma.supplier.createMany({
    data: [
      { supplierId: supplierId1, supplierCode: 'SUP-001', supplierName: 'Mega Sound', serviceType: 'Audio Equipment', phone: '0933333333', address: '789 Sound Blvd', rating: 4.8 }
    ]
  });

  // 4. Business Policies
  const policyId1 = genId();
  await prisma.businessPolicy.createMany({
    data: [
      { policyId: policyId1, policyCode: 'DEP-50', policyName: '50% Deposit', policyType: 'DEPOSIT', policyValue: 50, unit: 'PERCENT' },
      { policyId: genId(), policyCode: 'CAN-10', policyName: '10% Cancellation Fee', policyType: 'CANCELLATION', policyValue: 10, unit: 'PERCENT' }
    ]
  });

  // 5. Catalog (Categories -> Types -> Items)
  const catAudioId = genId();
  const catLightId = genId();
  await prisma.itemCategory.createMany({
    data: [
      { categoryId: catAudioId, categoryCode: 'CAT-AUDIO', categoryName: 'Âm thanh' },
      { categoryId: catLightId, categoryCode: 'CAT-LIGHT', categoryName: 'Ánh sáng' }
    ]
  });

  const typeSpeakerId = genId();
  const typeSpotlightId = genId();
  await prisma.itemType.createMany({
    data: [
      { typeId: typeSpeakerId, categoryId: catAudioId, typeCode: 'TYPE-SPK', typeName: 'Loa' },
      { typeId: typeSpotlightId, categoryId: catLightId, typeCode: 'TYPE-SPOT', typeName: 'Đèn chiếu' }
    ]
  });

  const item1Id = genId();
  const item2Id = genId();
  await prisma.item.createMany({
    data: [
      { itemId: item1Id, itemCode: 'ITM-SPK-01', itemName: 'Loa JBL 1000W', typeId: typeSpeakerId, unit: 'Cái', rentalPrice: 500000, purchasePrice: 15000000 },
      { itemId: item2Id, itemCode: 'ITM-LGT-01', itemName: 'Đèn Beam 230', typeId: typeSpotlightId, unit: 'Cái', rentalPrice: 300000, purchasePrice: 8000000 }
    ]
  });

  // 6. Evidence
  const evidence1Id = genId();
  await prisma.evidence.createMany({
    data: [
      { evidenceId: evidence1Id, fileUrl: 'https://example.com/evidence1.jpg', description: 'Hình ảnh khảo sát', uploadedBy: leaderId }
    ]
  });

  // 7. Quotation & Items
  const quotation1Id = genId();
  await prisma.quotation.create({
    data: {
      quotationId: quotation1Id,
      quotationCode: 'QUO-001',
      customerId: customerId1,
      version: 'v1',
      subtotal: 1600000,
      discountTotal: 0,
      totalAmount: 1600000,
      status: 'APPROVED',
      createdBy: managerId,
      items: {
        create: [
          { itemId: item1Id, itemName: 'Loa JBL 1000W', quantity: 2, price: 500000, discount: 0, lineTotal: 1000000 },
          { itemId: item2Id, itemName: 'Đèn Beam 230', quantity: 2, price: 300000, discount: 0, lineTotal: 600000 }
        ]
      }
    }
  });

  // 8. Order & Items
  const order1Id = genId();
  await prisma.order.create({
    data: {
      orderId: order1Id,
      orderCode: 'ORD-001',
      customerId: customerId1,
      quotationId: quotation1Id,
      policyId: policyId1,
      eventType: 'Conference',
      eventName: 'Tech Summit 2026',
      eventDate: new Date('2026-08-15T09:00:00Z'),
      location: '123 Tech St. Hall A',
      guestCount: 500,
      totalAmount: 1600000,
      paymentStatus: 'UNPAID',
      orderStatus: 'CONFIRMED',
      createdBy: managerId,
      orderItems: {
        create: [
          { itemId: item1Id, quantity: 2, unitPrice: 500000, subtotal: 1000000, preparedQty: 0 },
          { itemId: item2Id, quantity: 2, unitPrice: 300000, subtotal: 600000, preparedQty: 0 }
        ]
      }
    }
  });

  // 9. WorkTask
  const task1Id = genId();
  const task2Id = genId();
  await prisma.workTask.createMany({
    data: [
      { taskId: task1Id, taskCode: 'TSK-SETUP', taskName: 'Lắp đặt thiết bị' },
      { taskId: task2Id, taskCode: 'TSK-TEARDOWN', taskName: 'Tháo dỡ thiết bị' }
    ]
  });

  // 10. SchedulePlan & Assignees & Attendance
  const plan1Id = genId();
  await prisma.schedulePlan.create({
    data: {
      planId: plan1Id,
      planCode: 'PLN-001',
      orderId: order1Id,
      taskId: task1Id,
      startTime: new Date('2026-08-14T14:00:00Z'),
      endTime: new Date('2026-08-14T18:00:00Z'),
      location: '123 Tech St. Hall A',
      status: 'IN_PROGRESS',
      createdBy: managerId,
      assignees: {
        create: [
          { assigneeId: genId(), userId: leaderId, role: 'LEAD' },
          { assigneeId: genId(), userId: techId, role: 'TECHNICAL', attendance: {
            create: { checkInAt: new Date('2026-08-14T13:50:00Z') }
          }}
        ]
      }
    }
  });

  // 11. SurveyReport
  await prisma.surveyReport.create({
    data: {
      surveyId: genId(),
      reportCode: 'SUR-001',
      orderId: order1Id,
      surveyDate: new Date('2026-08-01T10:00:00Z'),
      location: '123 Tech St. Hall A',
      status: 'CONFIRMED',
      reportedBy: leaderId,
      confirmedBy: managerId,
      evidenceId: evidence1Id
    }
  });

  // 12. ChangeRequest
  await prisma.changeRequest.create({
    data: {
      changeRequestId: genId(),
      orderId: order1Id,
      type: 'add',
      status: 'approved',
      items: {
        create: [
          { catalogItemId: item2Id, quantity: 1, action: 'add' }
        ]
      }
    }
  });

  // 13. SupplierTransaction
  await prisma.supplierTransaction.create({
    data: {
      transactionId: genId(),
      transactionCode: 'STX-001',
      supplierId: supplierId1,
      orderId: order1Id,
      transactionType: 'RENTAL',
      serviceTitle: 'Thuê thêm Loa',
      estimatedCost: 800000,
      status: 'APPROVED',
      items: {
        create: [
          { itemId: item1Id, itemName: 'Loa Sub', quantity: 1, unitCost: 800000, subtotal: 800000 }
        ]
      }
    }
  });

  // 14. Deposit
  await prisma.deposit.create({
    data: {
      depositId: genId(),
      depositCode: 'DEP-001',
      orderId: order1Id,
      amount: 800000,
      dueDate: new Date('2026-08-05T00:00:00Z'),
      status: 'PENDING',
      requestedBy: managerId
    }
  });

  // 15. Settlement
  await prisma.settlement.create({
    data: {
      settlementId: genId(),
      orderId: order1Id,
      additionalFee: 0,
      compensation: 0,
      discount: 0,
      finalAmount: 800000,
      status: 'DRAFT',
      requestedBy: managerId
    }
  });

  // 16. Notification
  await prisma.notification.createMany({
    data: [
      { userId: managerId, title: 'Đơn hàng mới', content: 'Có đơn hàng mới cần xác nhận.', notificationType: 'ORDER' },
      { userId: techId, title: 'Phân công công việc', content: 'Bạn được phân công lắp đặt thiết bị.', notificationType: 'TASK' }
    ]
  });

  console.log('Seed data generated successfully.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
