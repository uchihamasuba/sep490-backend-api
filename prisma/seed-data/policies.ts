// Trích xuất từ sep490-web-frontend/src/mocks/apiFixtures.ts (MOCK_POLICIES).
//
// LƯU Ý: MOCK_POLICIES gốc có thêm 2 policy kiểu 'WAGE' (pol-7 "Tiền công Leader Staff mỗi buổi",
// pol-8 "Tiền công Technical Staff mỗi buổi") — nhưng cột business_policies.policy_type trong
// docs/TABLES.md chỉ định nghĩa enum DEPOSIT/CANCELLATION/COMPENSATION/FEE (không có WAGE). Bảng
// tiền công không nằm trong 28 bảng của schema này. Đã BỎ QUA 2 policy đó khi seed để không vi phạm
// enum của DB — quy tắc "tiền công theo buổi" vẫn đúng về nghiệp vụ nhưng chưa có chỗ lưu trong DB.

export type PolicyType = 'DEPOSIT' | 'CANCELLATION' | 'COMPENSATION' | 'FEE';

export interface PolicySeed {
  policyId: string;
  policyCode: string;
  policyName: string;
  policyType: PolicyType;
  description: string;
  policyValue: number;
  unit: string;
  isActive: boolean;
}

export const POLICIES: PolicySeed[] = [
  { policyId: 'pol-1', policyCode: 'HOAN-COC-30', policyName: 'Hoàn cọc khi hủy đơn ≥30 ngày trước sự kiện', policyType: 'CANCELLATION', policyValue: 100, unit: '%', description: 'Khách báo hủy trước ≥30 ngày so với ngày lắp đặt: hoàn 100% tiền cọc.', isActive: true },
  { policyId: 'pol-2', policyCode: 'HOAN-COC-7-30', policyName: 'Hoàn cọc khi hủy đơn 7–30 ngày trước sự kiện', policyType: 'CANCELLATION', policyValue: 50, unit: '%', description: 'Khách báo hủy trong khoảng 7–30 ngày trước ngày lắp đặt: hoàn 50% tiền cọc.', isActive: true },
  { policyId: 'pol-3', policyCode: 'HOAN-COC-DUOI-7', policyName: 'Hoàn cọc khi hủy đơn <7 ngày trước sự kiện', policyType: 'CANCELLATION', policyValue: 0, unit: '%', description: 'Khách báo hủy dưới 7 ngày trước ngày lắp đặt: không hoàn cọc.', isActive: true },
  { policyId: 'pol-4', policyCode: 'COC-TIEU-CHUAN', policyName: 'Tỉ lệ đặt cọc tiêu chuẩn', policyType: 'DEPOSIT', policyValue: 50, unit: '%', description: 'Tỉ lệ tiền cọc yêu cầu trên tổng giá trị báo giá khi xác nhận đơn.', isActive: true },
  { policyId: 'pol-5', policyCode: 'DEN-BU-HONG-MAT', policyName: 'Đền bù thiết bị hỏng/mất', policyType: 'COMPENSATION', policyValue: 100, unit: '% giá mua', description: 'Số tiền đền bù = giá mua thiết bị × số lượng hỏng/mất (tính theo giá mua, không theo giá thuê/bán).', isActive: true },
  { policyId: 'pol-6', policyCode: 'PHI-VC-PHATSINH', policyName: 'Ngưỡng miễn phí vận chuyển thiết bị bổ sung', policyType: 'FEE', policyValue: 2, unit: 'km', description: 'Chỉ tính phụ phí vận chuyển khi thêm thiết bị tại hiện trường nếu khoảng cách kho → địa điểm thi công > 2km.', isActive: true },
];
