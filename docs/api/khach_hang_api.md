# API Khách hàng (Customers) — Manager Portal

> Tài liệu tổng hợp các API mà màn **Khách hàng** (`/manager/customers`) và **Chi tiết khách hàng**
> (`/manager/customers/[id]`) trên web frontend cần backend cung cấp.
>
> Được viết dựa trên:
> - Code FE hiện tại: `src/app/manager/customers/page.tsx`, `src/app/manager/customers/[id]/page.tsx`,
>   `src/components/customers/CustomerFormModal.tsx`, `src/mocks/db/customers.ts`, `src/mocks/db/orders.ts`
>   (nguồn mock đang dùng tạm trong giai đoạn UI-first).
> - Schema DB thật (đối chiếu trực tiếp qua MySQL MCP tại thời điểm viết doc — 2026-07-19): bảng
>   `customers`, `orders`, `deposits`, `settlements`, `quotations`, `users`.
>
> **Đã chốt với Product/Backend ngày 2026-07-19** — xem mục 3. Các phần dưới đây đã được cập nhật để
> khớp với quyết định đó (không còn là câu hỏi mở).
>
> **Đính chính 2026-07-20** (xem [`docs/chitietkhachhang_api.md`](chitietkhachhang_api.md) mục 0): FE
> hiện tại (`/manager/customers/[id]`) đã nối API thật, không còn dùng mock nêu ở trên — soát lại DB
> phát hiện quyết định 1 ở mục 3 (`customerId` là mã nghiệp vụ) **sai với schema thật**
> (`customer_id` thực tế là UUID). Đã sửa lại mục 1/3 dưới đây, thêm field `customerCode`; đồng thời
> cột "Phụ trách" (`coordinator`, mục 2.7) đổi nguồn theo quyết định chung mới hơn — xem ghi chú tại
> chỗ.

## 0. Base URL & Auth

- Base path đề xuất: `/api/v1/customers` (theo convention `docs/api/` của dự án — REST, JWT Bearer token,
  gắn theo `AuthContext` hiện có ở FE).
- Toàn bộ endpoint dưới đây chỉ dành cho role **Manager** (và **Admin** ở chế độ chỉ-xem/audit — xem
  ghi chú permission ở từng endpoint).

## 1. Bảng ánh xạ dữ liệu FE ↔ cột DB thật (`customers`)

| Trường FE (`AdminCustomer`) | Cột DB (`customers`) | Ghi chú |
|---|---|---|
| `customerId` | `customer_id` (PK, varchar 36) | Dùng cho path param (`/customers/:customerId`) — giữ nguyên là UUID thật, không đổi routing hiện tại. **Không** dùng làm nhãn hiển thị "Mã khách hàng" trên UI (xem `customerCode` ngay dưới). |
| `customerCode` *(field mới, 2026-07-20)* | `customer_code` (UNIQUE, varchar 50) | **Đính chính** (xem `docs/chitietkhachhang_api.md` mục 0): quyết định "chốt" ngày 2026-07-19 (bỏ hẳn `customer_code`, dùng `customer_id` làm mã hiển thị dạng `KH001`) **không khớp schema thật** — `customer_id` thực tế là UUID (vd `6d36f94d-5a60-4673-aba0-fe03aca94424`), `customer_code` mới là mã nghiệp vụ ngắn (`CUS-001`, `CUS-002`...), đúng cùng pattern `<entity>_id` (UUID) + `<entity>_code` đã xác nhận nhất quán ở mọi bảng khác (`items`/`orders`/`schedule_plans`...). **Quyết định mới**: thêm lại field này vào mọi response trả `Customer`, FE đổi các chỗ hiển thị "Mã khách hàng" sang đọc `customerCode`. |
| `customerName` | `customer_name` | Khớp. |
| `phone` | `phone` | Khớp. |
| `email` | `email` (nullable) | FE đang coi là chuỗi rỗng `''` khi không có; DB cho phép `NULL` — service cần chuẩn hoá `null → ''` khi trả về, và `'' → null` khi nhận request tạo/sửa. |
| `address` | `address` (text, nullable) | Khớp. |
| `notes` | `notes` (text, nullable) | Khớp. |
| `status` (`'active' \| 'inactive'`, lowercase) | `status` (`ENUM('ACTIVE','INACTIVE')`, uppercase) | **Đã chốt**: API luôn trả `status` dạng lowercase (`active`/`inactive`) để khớp FE hiện tại — backend tự map từ ENUM uppercase khi trả response, và map ngược lại khi nhận request. |
| `totalBookings` | *(không có cột — tính từ)* `COUNT(orders WHERE customer_id = ?)` | Trường tổng hợp (aggregate), backend tính khi trả list, không lưu cứng trong bảng `customers`. |
| `totalSpent` | *(không có cột — tính từ)* `SUM(orders.total_amount WHERE customer_id = ?)` | Cùng loại aggregate như trên. Cần xác nhận: tính theo `total_amount` của mọi order (kể cả `CANCELLED`?) hay chỉ order còn hiệu lực. |
| — | `created_at`, `updated_at` | DB có sẵn, FE hiện chưa hiển thị ở list nhưng trang chi tiết có ô "Ngày tạo" (`detail.createdAt`) — nên trả `created_at` trong response detail. |

## 2. Danh sách endpoint

### 2.1. `GET /api/v1/customers` — Danh sách khách hàng (màn list)

Dùng cho bảng chính ở `page.tsx`: tab trạng thái (Tất cả/Đang hoạt động/Tạm ngưng), ô tìm kiếm, phân trang.

**Query params**

| Param | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `status` | `active \| inactive` | Không | Lọc theo trạng thái. Không truyền = tất cả. |
| `search` | string | Không | Tìm theo `customerName`, `customerId`, `phone`, `email` (khớp logic FE hiện tại — `LIKE` không phân biệt hoa/thường). |
| `page` | number | Không (default 1) | Trang hiện tại. |
| `limit` | number | Không (default 10) | Số dòng/trang — FE đang cố định 10. |

**Response 200**

```json
{
  "data": [
    {
      "customerId": "6d36f94d-5a60-4673-aba0-fe03aca94424",
      "customerCode": "CUS-001",
      "customerName": "Nguyễn Minh Trí",
      "phone": "0910000000",
      "email": "tri.nm@gmail.com",
      "address": "Q.1, TP. Hồ Chí Minh",
      "notes": "Khách quen, ưu tiên tư vấn gói cao cấp.",
      "status": "inactive",
      "totalBookings": 1,
      "totalSpent": 15000000
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "totalItems": 46,
    "totalPages": 5,
    "counts": { "all": 46, "active": 40, "inactive": 6 }
  }
}
```

`meta.counts` dùng để hiển thị số đếm trên 3 tab mà không cần FE gọi 3 lần API riêng.

**Permission**: Manager (đọc), Admin (đọc — audit).

---

### 2.2. `POST /api/v1/customers` — Tạo khách hàng mới

Dùng cho modal "Thêm khách hàng" (`CustomerFormModal`).

**Request body**

```json
{
  "customerName": "string, required",
  "phone": "string, required",
  "email": "string, optional",
  "address": "string, optional",
  "notes": "string, optional",
  "status": "active | inactive, default active"
}
```

**Response 201**: object `AdminCustomer` như mục 2.1 (kèm `customerId` do backend sinh — FE hiện đang
tự đoán mã tiếp theo bằng `nextAdminCustomerId()` chỉ để hiển thị placeholder trước khi submit,
**không** dùng làm giá trị thật gửi lên).

**Validate tối thiểu**: `customerName`, `phone` không rỗng (trùng validate hiện có ở FE); nên thêm
validate định dạng số điện thoại phía backend (FE hiện chưa validate format).

**Permission**: Manager.

---

### 2.3. `GET /api/v1/customers/:customerId` — Chi tiết khách hàng cơ bản

Trả về đúng object `AdminCustomer` (mục 2.1) — dùng khi mở modal "Chỉnh sửa khách hàng" để prefill form.

**Permission**: Manager, Admin (đọc).

---

### 2.4. `PUT /api/v1/customers/:customerId` — Cập nhật khách hàng

Body giống 2.2 (không có `customerId`/`totalBookings`/`totalSpent` — 2 trường sau là aggregate, không
cho sửa tay). Response: object đã cập nhật.

**Permission**: Manager.

---

### 2.5. `DELETE /api/v1/customers/:customerId` — Xóa khách hàng

**Quy tắc đã chốt**: **không cho xóa khách hàng đã có ít nhất 1 Order.** Chỉ cho xóa khi khách hàng
chưa từng phát sinh Order nào.

- Về kỹ thuật, `orders.customer_id` đã có `ON DELETE RESTRICT` nên DB tự chặn xóa nếu còn order tham
  chiếu — backend cần bắt lỗi này và trả **409 Conflict** kèm message rõ ràng (vd: "Không thể xóa khách
  hàng đã có đơn hàng") thay vì để lỗi SQL thô rơi ra API.
- FE hiện tại (mock) cho xóa tự do không kiểm tra gì — **cần sửa lại khi nối API thật** để tôn trọng rule
  này (vd ẩn/disable nút xóa khi `totalBookings > 0`, đồng thời vẫn xử lý lỗi 409 phòng trường hợp dữ
  liệu đổi giữa lúc render và lúc bấm xóa).

**Permission**: Manager.

---

### 2.6. `GET /api/v1/customers/:customerId/summary` — Dữ liệu tổng hợp cho trang Chi tiết khách hàng

Dùng cho phần header + card "Tổng quan giao dịch" / "Công nợ & thanh toán" ở `[id]/page.tsx`.

> **Đã chốt**: bỏ hoàn toàn `clientType`, `tier`, `source`, `coordinatorName` (cấp Customer) và
> `signedContractsCount` ("Hợp đồng đã ký") khỏi API/UI — hệ thống không có dữ liệu/khái niệm thật đứng
> sau các trường này (xem mục 3, quyết định 3 và 4). FE cần gỡ các ô tương ứng khỏi
> `[id]/page.tsx` khi nối API thật.

**Response 200 (đề xuất, sau khi đã loại các trường ở trên)**

```json
{
  "customer": { "...": "giống object Customer ở mục 2.1 (kèm customerCode, xem đính chính 2026-07-20)" },
  "createdAt": "2026-01-10T00:00:00Z",
  "totalValue": 411000000,
  "paidAmount": 411000000,
  "remainingDebt": 0,
  "paymentRate": 100,
  "activeOrdersCount": 1
}
```

| Trường | Nguồn dữ liệu | Trạng thái |
|---|---|---|
| `totalValue` | `SUM(orders.total_amount)` theo `customer_id` | Tính được từ DB thật. |
| `paidAmount` | **Đã chốt (join thật)**: `SUM(deposits.amount WHERE status='SUCCESS') + SUM(settlements.final_amount WHERE status IN ('PAID','CONFIRMED'))`, gộp theo mọi `order_id` thuộc `customer_id` đó | Không dùng cách suy luận nhanh từ `orders.payment_status` nữa (mock cũ dùng công thức giả lập theo mã khách hàng, không phản ánh tiền thật — xem lịch sử ở mục 3, quyết định 5). |
| `remainingDebt` | `totalValue - paidAmount` | Suy ra từ 2 trường trên. |
| `paymentRate` | `round(paidAmount / totalValue * 100)` (trả `100` nếu `totalValue = 0`) | Suy ra. |
| `activeOrdersCount` | `COUNT(orders WHERE customer_id=? AND order_status IN ('NEW','IN_PROGRESS'))` | Tính được, khớp `order_status` enum thật. |

**Permission**: Manager, Admin (đọc).

---

### 2.7. `GET /api/v1/customers/:customerId/orders` — Danh sách đơn hàng của khách hàng

Dùng cho bảng "Danh sách đơn hàng của khách hàng" ở trang chi tiết — có tìm kiếm, lọc trạng thái, lọc
loại dịch vụ, phân trang riêng (limit 6/trang).

> **Đã chốt**: bỏ cột/trường `contract` ("Hợp đồng") khỏi API và UI — hệ thống không có bảng hợp đồng,
> mock cũ chỉ tự sinh chuỗi giả `HD<số>` từ `orderId` (xem mục 3, quyết định 4). FE cần gỡ cột "Hợp đồng"
> khỏi bảng đơn hàng ở `[id]/page.tsx` khi nối API thật.

**Query params**

| Param | Kiểu | Mô tả |
|---|---|---|
| `search` | string | Tìm theo `order_code` hoặc `event_name`/`event_type`. |
| `status` | `NEW \| CONFIRMED \| IN_PROGRESS \| COMPLETED \| CANCELLED` | Khớp trực tiếp `orders.order_status` — **không có mismatch** như enum `OrderStatus` khác ở CLAUDE.md, model mock này (`src/mocks/db/orders.ts`) đã dùng đúng 5 giá trị của DB thật. |
| `serviceFilter` | `all \| wedding \| corporate` (hoặc theo enum chuẩn hóa — xem dưới) | **Đã chốt**: chuẩn hóa `orders.event_type` thành danh sách enum cố định ở DB/backend (vd `WEDDING`, `ENGAGEMENT`, `CORPORATE`, ...) để lọc chính xác trực tiếp trên cột này, thay vì so khớp chuỗi tự do như mock hiện tại (`/(cưới\|đính hôn)/i` trên chuỗi mô tả sự kiện tự sinh). Backend đề xuất danh sách enum cụ thể và xác nhận lại với Product trước khi FE đổi filter. |
| `page`, `limit` | number | Phân trang, FE dùng `limit=6`. |

**Response 200**

```json
{
  "data": [
    {
      "orderId": "DD0043",
      "event": "Đám cưới — Lễ cưới Nguyễn Minh Trí",
      "date": "2026-02-23T17:00:00Z",
      "value": 411000000,
      "status": "COMPLETED",
      "coordinator": "Nguyễn Văn A"
    }
  ],
  "meta": { "page": 1, "limit": 6, "totalItems": 2, "totalPages": 1 }
}
```

- `coordinator`: ~~map tạm từ `orders.created_by → users.full_name`~~ — **đã thay bằng quyết định chung
  mới hơn (2026-07-20)**: join `schedule_plan_assignees.role = 'LEAD'` của dòng `schedule_plans` **sớm
  nhất theo `start_time`** thuộc đơn đó, cùng cách áp dụng cho `docs/danhsachdondat_api.md` mục 4.1 và
  `docs/picklistxuatkho_api.md` mục 3.4 (SQL mẫu ở tài liệu đó) — không dùng `created_by` (người *tạo*
  đơn) nữa vì không phản ánh đúng "người phụ trách". Xem thêm `docs/chitietkhachhang_api.md` mục 6.

**Permission**: Manager, Admin (đọc).

## 3. Quyết định đã chốt (Product/Backend — 2026-07-19)

1. **`customerId`**: dùng thẳng giá trị `customer_id` thật đang có trong DB (dạng mã nghiệp vụ, vd
   `KH001`) làm định danh xuyên suốt — không đổi sang UUID, không cần trả riêng `customer_code`.
2. **Định dạng `status`**: API luôn trả về dạng lowercase (`active`/`inactive`) để khớp FE hiện tại —
   backend tự map từ `ENUM('ACTIVE','INACTIVE')` ở tầng service.
3. **Bỏ khỏi UI/API**: `clientType` (Cá nhân/Doanh nghiệp), `tier` (VIP/Standard), `source` (nguồn
   khách), `coordinatorName` (người phụ trách — cấp Customer). Không có dữ liệu thật đứng sau các trường
   này nên loại khỏi phạm vi, không bổ sung schema mới cho chúng.
4. **Bỏ khái niệm "Hợp đồng"**: loại cả trường `contract` (ở danh sách đơn hàng của khách hàng, mục 2.7)
   lẫn `signedContractsCount`/"Hợp đồng đã ký" (ở tổng quan giao dịch, mục 2.6) — hệ thống không có bảng
   hợp đồng và không có chữ ký điện tử (đúng tinh thần CLAUDE.md mục "Giới hạn/Out of scope").
5. **Công thức `paidAmount`/`remainingDebt`/`paymentRate`**: tính bằng join thật `deposits` (status
   `SUCCESS`) + `settlements` (status `PAID`/`CONFIRMED`) theo các order của khách hàng — không dùng cách
   suy luận nhanh/gần đúng từ `orders.payment_status`.
6. **Rule xóa khách hàng**: không cho xóa khách hàng đã có ít nhất 1 Order; trả **409 Conflict** khi vi
   phạm (DB đã chặn ở tầng FK, backend chỉ cần bắt và trả lỗi nghiệp vụ rõ ràng).
7. **`serviceFilter` (wedding/corporate)**: chuẩn hóa giá trị `orders.event_type` thành danh sách enum cố
   định để lọc chính xác, thay vì so khớp chuỗi tự do như hiện tại.

> Bước tiếp theo: cập nhật `src/mocks/db/customers.ts` / `src/mocks/db/orders.ts` và UI liên quan
> (`src/app/manager/customers/[id]/page.tsx` — gỡ các ô "Loại khách hàng", "Nguồn khách", "Hạng khách
> hàng", "Phụ trách" ở cấp Customer, gỡ cột "Hợp đồng" và card "Hợp đồng đã ký") để khớp các quyết định
> trên, trước khi nối API thật.
