// Module Mobile — chỉ 2 endpoint đã có hợp đồng rõ trong docs/api (xem mobile.routes.ts đầu file để
// biết endpoint nào bị bỏ qua có chủ đích và tại sao). KHÔNG gọi Prisma trực tiếp ở đây — tái dùng
// logic nghiệp vụ đã có sẵn ở inventoryService/orderService (cùng 1 bảng collected_equipment_reports/
// orders đứng sau, tránh phân kỳ 2 nguồn sự thật cho cùng 1 nghiệp vụ).
import { inventoryService, type ReportDTO } from '../inventory/inventory.service';
import { orderService, type OrderDetailDTO } from '../sales/order.service';
import type { CreateMobileReportBody } from './mobile.validators';

async function getAssignedOrder(orderId: string): Promise<OrderDetailDTO> {
  return orderService.getOrderById(orderId);
}

async function submitCollectedReport(orderId: string, body: CreateMobileReportBody, reportedBy: string): Promise<ReportDTO> {
  return inventoryService.createReport(
    {
      orderId,
      reportType: body.reportType,
      transactionId: body.transactionId,
      notes: body.notes,
      items: body.items,
    },
    reportedBy,
  );
}

export const mobileService = {
  getAssignedOrder,
  submitCollectedReport,
};
