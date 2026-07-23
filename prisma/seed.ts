import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

const genId = () => crypto.randomUUID();

// Thứ tự KHÔNG quan trọng cho TRUNCATE (FK checks tắt tạm thời), nhưng liệt kê đủ toàn bộ bảng thật
// (đối chiếu @@map trong schema.prisma) để đảm bảo reset sạch 100%, kể cả 4 bảng Kho vận mới thêm.
const ALL_TABLES = [
  'notifications',
  'settlements',
  'deposits',
  'supplier_transaction_items',
  'supplier_transactions',
  'change_request_items',
  'change_requests',
  'survey_reports',
  'attendances',
  'schedule_plan_assignees',
  'schedule_plans',
  'work_tasks',
  'collected_equipment_report_items',
  'collected_equipment_reports',
  'inventory_movements',
  'inventory',
  'order_items',
  'orders',
  'quotation_items',
  'quotations',
  'evidences',
  'items',
  'item_types',
  'item_categories',
  'business_policies',
  'suppliers',
  'customers',
  'users',
];

async function resetDatabase() {
  console.log('Resetting database (TRUNCATE all tables)...');
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');
  for (const table of ALL_TABLES) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\`;`);
  }
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
  console.log('Database reset complete.');
}

async function main() {
  await resetDatabase();

  console.log('Seeding new data...');

  // 1. Users — đủ 4 role
  const passwordHash = await bcrypt.hash('123456', BCRYPT_ROUNDS);

  const adminId = genId();
  const managerId = genId();
  const leaderId = genId();
  const techId = genId();

  await prisma.user.createMany({
    data: [
      { userId: adminId, username: 'admin', passwordHash, fullName: 'System Admin', role: 'ADMIN', email: 'admin@bnw.com', phone: '0900000001', deviceToken: 'dummy-device-token-admin' },
      { userId: managerId, username: 'manager', passwordHash, fullName: 'Project Manager', role: 'MANAGER', email: 'manager@bnw.com', phone: '0900000002', deviceToken: 'dummy-device-token-manager' },
      { userId: leaderId, username: 'leader', passwordHash, fullName: 'Team Leader', role: 'LEADER', email: 'leader@bnw.com', phone: '0900000003', deviceToken: 'dummy-device-token-leader' },
      { userId: techId, username: 'tech', passwordHash, fullName: 'Technician', role: 'TECHNICAL', email: 'tech@bnw.com', phone: '0900000004', deviceToken: 'dummy-device-token-tech' },
    ],
  });

  // 2. Master data — Business Policies
  const policyId1 = genId();
  await prisma.businessPolicy.createMany({
    data: [
      { policyId: policyId1, policyCode: 'DEP-50', policyName: '50% Deposit', policyType: 'DEPOSIT', policyValue: 50, unit: 'PERCENT' },
      { policyId: genId(), policyCode: 'CAN-10', policyName: '10% Cancellation Fee', policyType: 'CANCELLATION', policyValue: 10, unit: 'PERCENT' },
    ],
  });

  // 3. Master data — Catalog (Category -> Type -> Item)
  const catAudioId = genId();
  const catLightId = genId();
  const catFurnitureId = genId();
  await prisma.itemCategory.createMany({
    data: [
      { categoryId: catAudioId, categoryCode: 'CAT-AUDIO', categoryName: 'Âm thanh' },
      { categoryId: catLightId, categoryCode: 'CAT-LIGHT', categoryName: 'Ánh sáng' },
      { categoryId: catFurnitureId, categoryCode: 'CAT-FURN', categoryName: 'Nội thất sự kiện' },
    ],
  });

  const typeSpeakerId = genId();
  const typeSpotlightId = genId();
  const typeTableId = genId();
  await prisma.itemType.createMany({
    data: [
      { typeId: typeSpeakerId, categoryId: catAudioId, typeCode: 'TYPE-SPK', typeName: 'Loa' },
      { typeId: typeSpotlightId, categoryId: catLightId, typeCode: 'TYPE-SPOT', typeName: 'Đèn chiếu' },
      { typeId: typeTableId, categoryId: catFurnitureId, typeCode: 'TYPE-TABLE', typeName: 'Bàn ghế' },
    ],
  });

  const item1Id = genId(); // Loa JBL 1000W
  const item2Id = genId(); // Đèn Beam 230
  const item3Id = genId(); // Bàn tiệc tròn
  await prisma.item.createMany({
    data: [
      { itemId: item1Id, itemCode: 'ITM-SPK-01', itemName: 'Loa JBL 1000W', typeId: typeSpeakerId, unit: 'Cái', rentalPrice: 500000, purchasePrice: 15000000 },
      { itemId: item2Id, itemCode: 'ITM-LGT-01', itemName: 'Đèn Beam 230', typeId: typeSpotlightId, unit: 'Cái', rentalPrice: 300000, purchasePrice: 8000000 },
      { itemId: item3Id, itemCode: 'ITM-TBL-01', itemName: 'Bàn tiệc tròn', typeId: typeTableId, unit: 'Cái', rentalPrice: 150000, purchasePrice: 2000000 },
    ],
  });

  // 4. Customers + Suppliers
  const customerId1 = genId();
  const customerId2 = genId();
  await prisma.customer.createMany({
    data: [
      { customerId: customerId1, customerCode: 'CUS-001', customerName: 'Tech Corp', phone: '0911111111', email: 'techcorp@example.com', address: '123 Tech St.' },
      { customerId: customerId2, customerCode: 'CUS-002', customerName: 'Event Pro', phone: '0922222222', email: 'eventpro@example.com', address: '456 Event Ave.' },
    ],
  });

  const supplierId1 = genId();
  await prisma.supplier.createMany({
    data: [
      { supplierId: supplierId1, supplierCode: 'SUP-001', supplierName: 'Mega Sound', serviceType: 'Audio Equipment', phone: '0933333333', address: '789 Sound Blvd', rating: 4.8 },
    ],
  });

  // 5. Evidence (cần có trước vì SurveyReport tham chiếu evidenceId)
  const evidence1Id = genId();
  await prisma.evidence.createMany({
    data: [
      { evidenceId: evidence1Id, fileUrl: 'https://example.com/evidence1.jpg', description: 'Hình ảnh khảo sát', uploadedBy: leaderId },
    ],
  });

  // 6. Quotation — 1 APPROVED (dùng để tạo Order), 1 DRAFT (khách hàng khác, minh hoạ đủ trạng thái)
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
          { itemId: item2Id, itemName: 'Đèn Beam 230', quantity: 2, price: 300000, discount: 0, lineTotal: 600000 },
        ],
      },
    },
  });

  await prisma.quotation.create({
    data: {
      quotationId: genId(),
      quotationCode: 'QUO-002',
      customerId: customerId2,
      version: 'v1',
      subtotal: 3000000,
      discountTotal: 0,
      totalAmount: 3000000,
      status: 'DRAFT',
      createdBy: managerId,
      items: {
        create: [{ itemId: item3Id, itemName: 'Bàn tiệc tròn', quantity: 20, price: 150000, discount: 0, lineTotal: 3000000 }],
      },
    },
  });

  // 7. Order — sinh từ báo giá đã APPROVED (QUO-001)
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
          { itemId: item2Id, quantity: 2, unitPrice: 300000, subtotal: 600000, preparedQty: 0 },
        ],
      },
    },
  });

  // 8. WorkTask
  const task1Id = genId();
  const task2Id = genId();
  await prisma.workTask.createMany({
    data: [
      { taskId: task1Id, taskCode: 'TSK-SETUP', taskName: 'Lắp đặt thiết bị' },
      { taskId: task2Id, taskCode: 'TSK-TEARDOWN', taskName: 'Tháo dỡ thiết bị' },
      { taskId: genId(), taskCode: 'TSK-SURVEY', taskName: 'Khảo sát hiện trường' },
      { taskId: genId(), taskCode: 'TSK-COLLECT', taskName: 'Thu hồi thiết bị' },
    ],
  });

  // 9. SchedulePlan + đa phân công (SchedulePlanAssignee) + Attendance
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
          {
            assigneeId: genId(),
            userId: techId,
            role: 'TECHNICAL',
            attendance: { create: { checkInAt: new Date('2026-08-14T13:50:00Z') } },
          },
        ],
      },
    },
  });

  // 10. SurveyReport
  await prisma.surveyReport.create({
    data: {
      surveyId: genId(),
      reportCode: 'SUR-001',
      orderId: order1Id,
      planId: plan1Id,
      evidenceId: evidence1Id,
      surveyDate: new Date('2026-08-01T10:00:00Z'),
      location: '123 Tech St. Hall A',
      area: 250.0,
      length: 25.0,
      width: 10.0,
      entrance: 'Cửa chính phía Đông, rộng 3m, xe tải nhỏ ra vào được',
      siteConstraints: 'Trần cao 3.5m hạn chế lắp giàn đèn cao; sàn gạch trơn cần trải thảm chống trượt',
      additionalRequests: 'Khách yêu cầu bổ sung 2 màn hình LED phụ tại khu vực lối vào',
      proposedItems: 'Loa JBL 1000W x4, Đèn Beam 230 x8, Bàn tiệc tròn x20',
      notes: 'Đã khảo sát thực địa, hồ sơ đã được quản lý xác nhận',
      status: 'CONFIRMED',
      reportedBy: leaderId,
      confirmedBy: managerId,
      confirmedAt: new Date('2026-08-02T09:00:00Z'),
    },
  });

  // 11. ChangeRequest
  await prisma.changeRequest.create({
    data: {
      changeRequestId: genId(),
      orderId: order1Id,
      type: 'add',
      status: 'approved',
      items: { create: [{ catalogItemId: item2Id, quantity: 1, action: 'add' }] },
    },
  });

  // 12. SupplierTransaction
  const supplierTransaction1Id = genId();
  await prisma.supplierTransaction.create({
    data: {
      transactionId: supplierTransaction1Id,
      transactionCode: 'STX-001',
      supplierId: supplierId1,
      orderId: order1Id,
      transactionType: 'RENTAL',
      serviceTitle: 'Thuê thêm Loa',
      estimatedCost: 800000,
      status: 'APPROVED',
      items: { create: [{ itemId: item1Id, itemName: 'Loa Sub', quantity: 1, unitCost: 800000, subtotal: 800000 }] },
    },
  });

  // 13. Deposit + Settlement
  await prisma.deposit.create({
    data: {
      depositId: genId(),
      depositCode: 'DEP-001',
      orderId: order1Id,
      amount: 800000,
      dueDate: new Date('2026-08-05T00:00:00Z'),
      status: 'PENDING',
      requestedBy: managerId,
    },
  });

  await prisma.settlement.create({
    data: {
      settlementId: genId(),
      orderId: order1Id,
      additionalFee: 0,
      compensation: 0,
      discount: 0,
      finalAmount: 800000,
      status: 'DRAFT',
      requestedBy: managerId,
    },
  });

  // 14. Inventory — 1 dòng/item (quantity_available/reserved theo đúng CHECK invariant
  // available + reserved + damaged = total). item1/item2 đang có 2 đơn vị "reserved" cho ORD-001.
  await prisma.inventory.createMany({
    data: [
      { inventoryId: genId(), itemId: item1Id, quantityTotal: 10, quantityDamaged: 0, quantityReserved: 2, quantityAvailable: 8 },
      { inventoryId: genId(), itemId: item2Id, quantityTotal: 15, quantityDamaged: 1, quantityReserved: 2, quantityAvailable: 12 },
      { inventoryId: genId(), itemId: item3Id, quantityTotal: 20, quantityDamaged: 0, quantityReserved: 0, quantityAvailable: 20 },
    ],
  });

  // 15. InventoryMovement — sổ biến động minh hoạ (ghi log lịch sử, không nhất thiết khớp tuyệt đối
  // với snapshot Inventory ở bước 14 — 2 nguồn dữ liệu độc lập giống hệ thống thật, nơi bảng tồn kho là
  // cache hiện tại còn sổ biến động là lịch sử append-only).
  await prisma.inventoryMovement.createMany({
    data: [
      { movementId: genId(), itemId: item1Id, orderId: order1Id, movementType: 'OUTBOUND', quantity: 2, performedBy: leaderId, notes: 'Xuất kho lắp đặt sự kiện Tech Summit 2026' },
      { movementId: genId(), itemId: item2Id, orderId: order1Id, movementType: 'OUTBOUND', quantity: 2, performedBy: leaderId, notes: 'Xuất kho lắp đặt sự kiện Tech Summit 2026' },
      { movementId: genId(), itemId: item2Id, orderId: null, movementType: 'ADJUSTMENT', quantity: -1, performedBy: managerId, notes: 'Ghi nhận 1 đèn Beam hỏng trong kho' },
    ],
  });

  // 16. CollectedEquipmentReport — biên bản thu hồi sau sự kiện, đang chờ Manager xác nhận (SUBMITTED)
  const collectedReport1Id = genId();
  await prisma.collectedEquipmentReport.create({
    data: {
      reportId: collectedReport1Id,
      orderId: order1Id,
      reportType: 'INTERNAL',
      status: 'SUBMITTED',
      reportedBy: leaderId,
      notes: 'Thu hồi thiết bị sau sự kiện Tech Summit 2026',
      items: {
        create: [
          { cerItemId: genId(), itemId: item1Id, goodQuantity: 2, damagedQuantity: 0, lostQuantity: 0 },
          { cerItemId: genId(), itemId: item2Id, goodQuantity: 1, damagedQuantity: 1, lostQuantity: 0 },
        ],
      },
    },
  });

  // 17. Notifications
  await prisma.notification.createMany({
    data: [
      { userId: managerId, title: 'Đơn hàng mới', content: 'Có đơn hàng mới cần xác nhận.', notificationType: 'ORDER' },
      { userId: techId, title: 'Phân công công việc', content: 'Bạn được phân công lắp đặt thiết bị.', notificationType: 'TASK' },
      { userId: managerId, title: 'Chờ xác nhận thu hồi thiết bị', content: 'Leader đã nộp biên bản thu hồi cho ORD-001.', notificationType: 'INVENTORY' },
    ],
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
