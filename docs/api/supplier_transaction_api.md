# API Contract: Supplier Transaction

Tài liệu này mô tả chi tiết các endpoint quản lý giao dịch mua/thuê từ nhà cung cấp (Supplier Transaction).

## 1. Tìm kiếm hạng mục của nhà cung cấp (GET)
Được sử dụng khi người dùng tìm kiếm sản phẩm trong form tạo giao dịch.

- **Endpoint**: `GET /api/v1/suppliers/:id/items`
- **Auth**: `MANAGER`, `ADMIN`
- **Query Params**:
  - `page`: số trang (mặc định 1)
  - `limit`: số lượng hiển thị (mặc định 20)
  - `search`: (tùy chọn) từ khóa tìm kiếm theo tên món đồ (`itemName`) hoặc mã món đồ (`supplierItemCode`)

**Response (200 OK):**
```json
{
  "data": [
    {
      "supplierId": "uuid-cua-nha-cung-cap",
      "itemId": "uuid-cua-item",
      "itemCode": "ITM-001",
      "itemName": "Đèn LED sự kiện",
      "typeId": "...",
      "rentalPrice": 50000,
      "purchasePrice": 150000,
      "isActive": true,
      "minQuantity": 5,
      "supplierItemCode": "SUP-LED",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "totalItems": 1, "totalPages": 1 }
}
```

---

## 2. Tạo giao dịch (POST)
- **Endpoint**: `POST /api/v1/supplier-transactions`
- **Auth**: `MANAGER`, `ADMIN`

**Request Body (`CreateSupplierTransactionBody`):**
```json
{
  "supplierId": "uuid-cua-nha-cung-cap",
  "orderId": "uuid-cua-don-hang",
  "transactionType": "PURCHASE", 
  "serviceTitle": "Mua bổ sung thiết bị",
  "depositAmount": 0,
  "items": [
    {
      "itemId": "uuid-cua-item-bat-buoc", 
      "quantity": 10,
      "unitCost": 150000, 
      "notes": "Đã chốt giá 150k"
    }
  ]
}
```
*Ghi chú:*
- `transactionType` chỉ cho phép `"PURCHASE"` hoặc `"RENTAL"`.
- Bắt buộc phải có ít nhất 1 hàng hóa trong mảng `items`.
- `itemId` phải nằm trong danh sách hạng mục `isActive` của nhà cung cấp này.
- Nếu không truyền `unitCost`, hệ thống tự động bốc `purchasePrice` (nếu đơn mua) hoặc `rentalPrice` (nếu đơn thuê) trong cơ sở dữ liệu.

**Response (201 Created):** Trả về toàn bộ chi tiết `SupplierTransaction` vừa tạo.

---

## 3. Cập nhật giao dịch (PUT)
Thay thế toàn bộ danh sách item cũ bằng danh sách item mới và cập nhật các thông tin chung của giao dịch.

- **Endpoint**: `PUT /api/v1/supplier-transactions/:id`
- **Auth**: `MANAGER`, `ADMIN`

**Request Body (`UpdateSupplierTransactionBody`):**
```json
{
  "serviceTitle": "Mua bổ sung thiết bị 2",
  "depositAmount": 100000,
  "items": [
    {
      "itemId": "uuid-cua-item-1", 
      "quantity": 10,
      "unitCost": 150000, 
      "notes": "Đã chốt giá 150k"
    }
  ]
}
```
*Ghi chú:* 
- Nếu có truyền mảng `items`, toàn bộ items cũ của giao dịch sẽ bị **xóa bỏ** và thay thế bằng mảng items mới này, đồng thời hệ thống tính toán lại `estimatedCost`.
- Các rules kiểm tra logic tương tự như khi tạo giao dịch.

**Response (200 OK):** Trả về chi tiết `SupplierTransaction` sau khi cập nhật.

---

## 4. Xóa giao dịch (DELETE)
Chỉ cho phép xóa khi giao dịch đang ở trạng thái **PENDING (Chờ duyệt)**.

- **Endpoint**: `DELETE /api/v1/supplier-transactions/:id`
- **Auth**: `MANAGER`, `ADMIN`

**Response (200 OK):**
```json
{
  "message": "Đã xóa giao dịch nhà cung cấp"
}
```
*Ghi chú:* 
- Nếu giao dịch ở trạng thái khác (vd: `APPROVED`), API sẽ trả về lỗi HTTP 400 (Bad Request).
