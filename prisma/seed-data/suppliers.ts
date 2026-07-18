// Trích xuất từ sep490-web-frontend/src/mocks/db/suppliers.ts (SEED_SUPPLIERS) — chỉ lấy các field
// cấp 1 khớp bảng `suppliers` (docs/TABLES.md). Bỏ qua `transactions[]`/`catalogItems[]` lồng bên
// trong — đó là dữ liệu cho `supplier_transactions`/`supplier_transaction_items`, thuộc phạm vi
// Cụm 3 (Task 3.3), chưa seed ở Task 2.1 vì các bảng đó còn phụ thuộc `orders` cụ thể.
// `rating` và `contact_person` không có trong mock nguồn — để trống (null) thay vì bịa số liệu.

export interface SupplierSeed {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  serviceType: string;
  phone: string;
  email: string;
  address: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export const SUPPLIERS: SupplierSeed[] = [
  { supplierId: 'sup-1', supplierCode: 'SUP002', supplierName: 'Ánh Sáng Pro', serviceType: 'Âm thanh biểu diễn', phone: '0978 123 456', email: 'proline.av@yahoo.com', address: 'Hoàng Mai, Hà Nội', status: 'ACTIVE' },
  { supplierId: 'sup-2', supplierCode: 'SUP_TL', supplierName: 'Tùng Lâm Decor', serviceType: 'Hoa tươi cắm tiệc', phone: '0987 654 321', email: 'tunglamdecor@gmail.com', address: 'Thanh Xuân, Hà Nội', status: 'ACTIVE' },
  { supplierId: 'sup-3', supplierCode: 'SUP_HD', supplierName: 'Hoàng Duy Audio', serviceType: 'Âm thanh biểu diễn', phone: '0912 345 678', email: 'hoangduyaudio@gmail.com', address: 'Hai Bà Trưng, Hà Nội', status: 'ACTIVE' },
  { supplierId: 'sup-4', supplierCode: 'SUP_NC', supplierName: 'Nội Thất Ngọc Châu', serviceType: 'Yến tiệc cưới ẩm thực', phone: '0902 456 679', email: 'ngocchaunoithat@gmail.com', address: 'Ba Đình, Hà Nội', status: 'ACTIVE' },
  { supplierId: 'sup-5', supplierCode: 'SUP_MP', supplierName: 'Minh Phát Flowers', serviceType: 'Hoa tươi cắm tiệc', phone: '0933 789 123', email: 'minhphatflowers@gmail.com', address: 'Cầu Giấy, Hà Nội', status: 'ACTIVE' },
  { supplierId: 'sup-6', supplierCode: 'SUP_VP', supplierName: 'Việt Phát Furniture', serviceType: 'Nội thất bàn ghế', phone: '0977 234 567', email: 'vietphatfurniture@gmail.com', address: 'Đống Đa, Hà Nội', status: 'ACTIVE' },
  { supplierId: 'sup-7', supplierCode: 'SUP_TT', supplierName: 'Thiên Trường Rạp Cưới', serviceType: 'Khung rạp & bạt che', phone: '0966 345 678', email: 'thientruongrap@gmail.com', address: 'Long Biên, Hà Nội', status: 'INACTIVE' },
];
