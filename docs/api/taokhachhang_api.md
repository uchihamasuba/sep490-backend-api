# API cho màn "Thêm khách hàng" (tạo mới khách hàng)

> Phạm vi tài liệu này: **chỉ** endpoint tạo khách hàng mới, phục vụ modal "Thêm khách hàng" hiển thị
> trên cả `/admin/customers` và `/manager/customers`.
>
> Nguồn tham chiếu:
> - FE: `src/components/customers/CustomerFormModal.tsx`, `src/app/manager/customers/page.tsx`,
>   `src/app/admin/customers/page.tsx`, `src/mocks/db/customers.ts`, `src/mocks/db/utils.ts`
>   (`nextSequentialId`), `src/services/customer.service.ts`, `src/types/customer.ts`.
> - DB thật: đối chiếu trực tiếp qua MySQL MCP ngày 2026-07-20 — `SHOW CREATE TABLE customers`,
>   `SHOW CREATE TABLE orders`, `SHOW INDEX FROM customers`, dữ liệu mẫu hiện có (2 dòng: `CUS-001`,
>   `CUS-002`).
> - Đã có tài liệu tổng quát hơn cho toàn module Khách hàng ở [`docs/khach_hang_api.md`](khach_hang_api.md)
>   (mục 2.2 cũng nói về endpoint tạo) — tài liệu này đào sâu riêng phần tạo mới vì phát hiện thêm 1
>   điểm lệch quan trọng giữa FE và DB thật (mục 3 dưới đây) chưa được nêu ở doc cũ.
>
> **Đã chốt với Product/Backend ngày 2026-07-20** — xem mục 4. Các phần dưới đây đã được cập nhật để
> khớp với quyết định đó (không còn là câu hỏi mở), trừ mục 3 (format `customerCode`) vẫn đang chờ chốt.

## 1. Màn hình

Modal "Thêm khách hàng" (xem ảnh mẫu người dùng cung cấp):

| Trường trên UI | Bắt buộc | Field FE (`values`) |
|---|---|---|
| Họ và tên | Có | `customerName` |
| Số điện thoại | Có, đúng 10 số | `phone` |
| Thư điện tử (Email) | Không | `email` |
| Trạng thái vận hành (select: Đang hoạt động / Tạm ngưng) | Có (mặc định "Đang hoạt động") | `status` |
| Địa chỉ khách hàng | Có | `address` |
| Ghi chú cụ thể | Không | `notes` |
| *(hiển thị, không nhập)* "Mã khách hàng dự kiến: KH043" | — | tự sinh ở FE, xem mục 3 |

Validate hiện có ở FE (`CustomerFormModal.tsx` hàm `validate`):
- `customerName`: không rỗng.
- `phone`: không rỗng, đúng regex `^\d{10}$` (10 chữ số) — **FE hiện chưa ép số đầu phải là `0`**, cần
  sửa lại FE + backend cùng áp dụng regex `^0\d{9}$` (đã chốt ở mục 4, quyết định 3).
- `address`: không rỗng.
- `email`: **chưa validate định dạng** ở FE — cần backend validate lại (email hợp lệ nếu có nhập).

## 2. Endpoint đề xuất

### `POST /api/v1/customers`

**Permission**: **đã chốt — chỉ Manager** được gọi endpoint này (mục 4, quyết định 1). Admin gọi phải
nhận `403 Forbidden`; FE cần ẩn/khóa nút "Thêm khách hàng" ở `admin/customers/page.tsx`.

**Request body**

```json
{
  "customerName": "string, required, not blank",
  "phone": "string, required, đúng 10 chữ số, số đầu phải là 0 (regex ^0\\d{9}$)",
  "email": "string, optional, phải là email hợp lệ nếu có",
  "address": "string, required, not blank",
  "notes": "string, optional",
  "status": "active | inactive, optional, default: active"
}
```

**Đã chốt: không cho phép trùng số điện thoại** (mục 4, quyết định 2) — backend phải kiểm tra `phone`
chưa tồn tại trước khi tạo (và nên thêm `UNIQUE INDEX` trên cột `phone` ở migration để chặn tận gốc,
không chỉ dựa vào check ở tầng service — tránh race condition khi 2 request tạo cùng lúc cùng SĐT).

**Response 201**

```json
{
  "success": true,
  "code": "CUSTOMER_CREATED",
  "message": "Tạo khách hàng thành công",
  "data": {
    "customerId": "445cdbd7-5029-4b54-a18f-b8234f1e2486",
    "customerCode": "CUS-003",
    "customerName": "Nguyễn Văn A",
    "phone": "0987654321",
    "email": "",
    "address": "123 ...",
    "notes": "",
    "status": "active",
    "totalBookings": 0,
    "totalSpent": 0,
    "createdAt": "2026-07-20T00:00:00Z",
    "updatedAt": "2026-07-20T00:00:00Z"
  }
}
```

- `totalBookings`/`totalSpent` luôn là `0` khi vừa tạo (khách mới chưa có order) — backend có thể trả
  cứng `0` thay vì query aggregate cho request này.
- `email: null` ở DB → chuẩn hóa về chuỗi rỗng `""` khi trả JSON (khớp convention đã chốt ở
  `docs/khach_hang_api.md` mục 1).
- `status` trả lowercase (`active`/`inactive`), map từ `ENUM('ACTIVE','INACTIVE')` ở DB.

**Response lỗi**

| HTTP | Trường hợp | Body gợi ý |
|---|---|---|
| 400 | Thiếu/sai `customerName`, `phone` (không đủ 10 số hoặc không bắt đầu bằng `0`), `address`; `email` sai định dạng | `{ "success": false, "code": "VALIDATION_ERROR", "message": "...", "errors": { "phone": "Số điện thoại phải đủ 10 số và bắt đầu bằng số 0." } }` |
| 409 | `phone` đã tồn tại (đã chốt: không cho trùng SĐT — mục 4, quyết định 2) | `{ "success": false, "code": "PHONE_ALREADY_EXISTS", "message": "Số điện thoại đã tồn tại trong hệ thống" }` |
| 403 | Không phải role Manager (đã chốt: Admin không được tạo khách hàng — mục 4, quyết định 1) | theo chuẩn lỗi chung của hệ thống |

## 3. Điểm lệch quan trọng phát hiện qua MCP DB — cần chốt trước khi backend code

Đối chiếu trực tiếp `SHOW CREATE TABLE customers` trên DB thật:

```sql
CREATE TABLE `customers` (
  `customer_id` varchar(36) NOT NULL DEFAULT (uuid()),   -- PK, sinh UUID tự động
  `customer_code` varchar(50) NOT NULL,                   -- UNIQUE, mã nghiệp vụ
  `customer_name` varchar(255) NOT NULL,
  `phone` varchar(30) NOT NULL,                           -- KHÔNG có UNIQUE INDEX
  `email` varchar(255) DEFAULT NULL,
  `address` text,
  `notes` text,
  `status` enum('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`customer_id`),
  UNIQUE KEY `customers_customer_code_key` (`customer_code`)
)
```

Dữ liệu thật hiện có (2 dòng, toàn bộ bảng): `customer_code` = `CUS-001`, `CUS-002` (sinh tuần tự,
prefix `CUS-`, không zero-pad theo kiểu `KH001`).

**Vấn đề**: modal FE hiển thị "Mã khách hàng dự kiến: **KH043**" — số này do FE tự tính bằng
`nextSequentialId(rows, 'customerId', 'KH', 3)` (`src/mocks/db/utils.ts`), dựa trên mock data 42 khách
hàng có `customerId` dạng `KH001..KH042`. Đây thuần túy là số liệu giả để demo UI, **không khớp** cách
DB thật sinh mã:

1. DB thật dùng **UUID** làm `customer_id` (khóa chính thật, không phải mã dễ đọc `KH001`).
2. Mã dễ đọc thật trong DB là `customer_code`, đang theo format `CUS-XXX` (không zero-pad 3 chữ số cố
   định, không có prefix `KH`).

→ **Cần Product/Backend chốt lại** một trong hai hướng trước khi nối API thật:

- **Hướng A** (khuyến nghị, ít việc nhất): giữ nguyên `customer_code` format `CUS-XXX` ở backend, sửa
  lại FE để hiển thị đúng prefix/định dạng thật (`CUS-003` thay vì `KH043`) — đồng thời **BE cần trả về
  mã dự kiến qua 1 endpoint riêng** vì FE không thể tự đoán số tiếp theo chính xác (concurrent tạo mới
  từ nhiều Manager cùng lúc → FE tính nhầm nếu chỉ dựa vào danh sách đang có ở client). Đề xuất thêm:

  #### `GET /api/v1/customers/next-code`
  ```json
  { "success": true, "data": { "nextCustomerCode": "CUS-003" } }
  ```
  Chỉ dùng để hiển thị placeholder trên modal trước khi submit — **không** gửi giá trị này lên khi tạo
  thật; `customer_code` luôn do backend sinh tại thời điểm `INSERT` (tránh race condition trùng mã nếu
  2 người tạo khách hàng cùng lúc).

- **Hướng B**: đổi format sinh mã ở DB/backend sang đúng kiểu `KH001`, `KH002`... để khớp toàn bộ UI/mock
  hiện tại (đồng nghĩa phải đổi cả 2 dòng dữ liệu thật `CUS-001`/`CUS-002` đang có, hoặc chấp nhận dữ
  liệu cũ giữ nguyên format cũ, dữ liệu mới theo format mới — không nhất quán).

Tài liệu này giả định **Hướng A** khi viết response mẫu ở mục 2 (field `customerCode` riêng, tách khỏi
`customerId` UUID) — nhưng đây vẫn là **quyết định cần Product/Backend xác nhận**, chưa phải đã chốt.

## 4. Quyết định đã chốt (Product/Backend — 2026-07-20)

1. **Phân quyền tạo khách hàng — chọn hướng (a)**: chỉ **Manager** được tạo khách hàng.
   `POST /api/v1/customers` phải trả `403 Forbidden` nếu người gọi là Admin. FE cần ẩn/khóa nút "Thêm
   khách hàng" (và modal liên quan) ở `src/app/admin/customers/page.tsx` — trang Admin chỉ còn xem/audit
   danh sách khách hàng, không còn thao tác tạo mới. CLAUDE.md không cần sửa vì đây vốn đã đúng ranh
   giới vai trò mô tả ở mục "Vai trò & phân quyền" (Admin không xử lý vận hành hằng ngày).
2. **Không cho phép trùng số điện thoại**: mỗi `phone` chỉ gắn với đúng 1 khách hàng. Backend cần:
   - Thêm `UNIQUE INDEX` trên cột `phone` ở bảng `customers` (migration mới — hiện DB thật chưa có).
   - Trả `409 Conflict` (`PHONE_ALREADY_EXISTS`) khi tạo mới với `phone` đã tồn tại.
   - Áp dụng tương tự cho `PUT /api/v1/customers/:id` (cập nhật) nếu cho phép sửa `phone` — ngoài phạm
     vi tạo mới của tài liệu này nhưng cần lưu ý khi backend implement chung 1 lớp validate.
3. **Định dạng số điện thoại**: đúng 10 chữ số, bắt buộc số đầu là `0` — regex chuẩn: `^0\d{9}$`. Cả FE
   và backend phải cùng áp dụng regex này (FE hiện tại dùng `^\d{10}$`, thiếu ràng buộc số đầu — **cần
   sửa `CustomerFormModal.tsx` khớp lại** khi nối API thật).
