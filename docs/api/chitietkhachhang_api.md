# API cho màn "Chi tiết khách hàng" (`/manager/customers/[id]`)

> Phạm vi tài liệu này: **chỉ** trang chi tiết Manager `/manager/customers/[id]` — header hồ sơ, card
> "Thông tin khách hàng", bảng "Danh sách đơn hàng của khách hàng", card "Hồ sơ nhanh"/"Tổng quan giao
> dịch"/"Công nợ & thanh toán", và modal "Chỉnh sửa khách hàng". Đây là ảnh mẫu người dùng cung cấp
> (cùng bố cục với code hiện tại).
>
> **Khác với các tài liệu trước trong repo**: trang này **không phải mock** — code hiện tại
> (`src/app/manager/customers/[id]/page.tsx`) đã gọi thật qua `customerApiService`
> (`src/services/customer.service.ts`), và `src/types/customer.ts` có comment đầu file ghi rõ "khớp
> response thật từ backend (`D:\sep490-backend-api`...)" — tức FE **đã** được code khớp theo
> [`docs/khach_hang_api.md`](khach_hang_api.md) (tài liệu đã "chốt" ngày 2026-07-19) với giả định
> Backend đã/đang implement đúng theo đó. Tài liệu này **không viết lại từ đầu** — chỉ soát lại đúng
> phần "Chi tiết khách hàng" bằng dữ liệu DB thật mới nhất (MySQL MCP, 2026-07-20) và nêu 1 phát hiện
> quan trọng làm sai lệch 1 quyết định đã "chốt" trước đó (mục 0).
>
> **Không** bao gồm: màn danh sách `/manager/customers` (đã có ở `docs/khach_hang_api.md` mục 2.1) hay
> modal "Thêm khách hàng" (mục 2.2 tài liệu đó, dùng chung `CustomerFormModal` với modal sửa ở trang
> này — không lặp lại). Trang mirror `/admin/customers/[id]` **vẫn đang dùng mock**
> (`getAdminCustomerDetail`/`AdminCustomer` từ `src/mocks/db/customers.ts`, chưa nối
> `customerApiService`) — ngoài phạm vi tài liệu này, chỉ nêu lại ở mục 7 như 1 việc còn tồn.
>
> Nguồn tham chiếu:
> - FE: `src/app/manager/customers/[id]/page.tsx` (toàn bộ trang), `src/services/customer.service.ts`,
>   `src/types/customer.ts`, `src/components/customers/CustomerFormModal.tsx`,
>   `src/constants/customer-status.ts`, `src/mocks/db/orders.ts` (`BOOKING_STATUS_META`, dùng tạm cho
>   badge trạng thái đơn ở bảng con).
> - DB thật: đối chiếu trực tiếp qua MySQL MCP ngày 2026-07-20 (cùng phiên với
>   `docs/picklistxuatkho_api.md`) — `SHOW CREATE TABLE customers/orders/deposits/settlements/users`;
>   dữ liệu mẫu thật hiện có **2** khách hàng (`Tech Corp` mã `CUS-001`, `Event Pro` mã `CUS-002`, cả 2
>   `status = 'ACTIVE'`), **1** đơn (`ORD-001`, gắn `customer_id` của "Tech Corp"), **1** `deposits`,
>   **1** `settlements`.
> - `docs/api/` **không tồn tại trong repo hiện tại** — dùng comment đầu `types/customer.ts` (đối chiếu
>   `prisma/schema.prisma`/`*.service.ts` backend) làm căn cứ chính, giống các tài liệu trước.

## 0. Phát hiện quan trọng nhất — `customerId` trả về là UUID, không phải "mã nghiệp vụ" như đã chốt

`docs/khach_hang_api.md` mục 3, quyết định 1 (2026-07-19) ghi: *"dùng thẳng `customer_id` thật đang có
trong DB (dạng mã nghiệp vụ, vd `KH001`) làm định danh xuyên suốt — không đổi sang UUID, không cần trả
riêng `customer_code`."*

Đối chiếu lại `SHOW CREATE TABLE customers` + dữ liệu mẫu thật (2026-07-20):

```sql
"customer_id"   varchar(36) NOT NULL DEFAULT (uuid())   -- PK, giá trị thật: "6d36f94d-5a60-4673-aba0-fe03aca94424"
"customer_code" varchar(50) NOT NULL                     -- UNIQUE, giá trị thật: "CUS-001"
```

`customer_id` **là UUID thật** (không phải `KH001` như quyết định đã chốt giả định), và `customer_code`
mới là mã nghiệp vụ ngắn dễ đọc (`CUS-001`, `CUS-002`) — **đúng cùng 1 pattern `<entity>_id` (UUID) +
`<entity>_code` (mã nghiệp vụ)** đã xác nhận nhất quán ở mọi bảng khác trong DB này (`items`/
`item_code`, `orders`/`order_code`, `schedule_plans`/`plan_code`... — xem `docs/tonkhodoanhnghiep_api.md`,
`docs/picklistxuatkho_api.md`). Quyết định đã chốt ngày 2026-07-19 (chỉ dùng `customer_id` làm định
danh hiển thị, bỏ hẳn `customer_code`) **không khớp schema thật** — nhiều khả năng lúc chốt đã nhầm giả
định `customer_id` cũng là mã ngắn giống các bảng khác đã thấy trước đó, hoặc dữ liệu seed lúc đó khác.

**Ảnh hưởng trực tiếp tới trang "Chi tiết khách hàng"**: `page.tsx` dòng 169/201 hiển thị
`customer.customerId` làm "Mã khách hàng" ở breadcrumb và ở card header — nếu backend trả đúng UUID
thật theo `types/customer.ts` hiện tại (`customerId: string` = `customer_id`), UI sẽ hiển thị chuỗi
UUID dài (`6d36f94d-5a60-...`) thay vì mã gọn `CUS-001` như ảnh mẫu/kỳ vọng thiết kế (mục 3 CLAUDE.md —
mật độ thông tin, dễ đọc).

**Đề xuất sửa (áp dụng cho cả `docs/khach_hang_api.md`, không chỉ tài liệu này)**: thêm lại field
`customerCode` vào `Customer` (mọi endpoint trả `Customer`/`CustomerSummary` ở mục 2), giữ nguyên
`customerId` = `customer_id` (UUID, dùng cho path param `/customers/:customerId`, không đổi vì URL đã
dùng ổn). FE đổi 2 chỗ hiển thị "Mã khách hàng" (breadcrumb + card header, mục 1) sang đọc
`customer.customerCode` thay vì `customer.customerId`. Không đổi endpoint nào khác — chỉ thêm 1 field
trả về.

## 1. Tổng quan — endpoint trang này đang gọi

| Vùng UI | Hàm service | Endpoint |
|---|---|---|
| Header hồ sơ + toàn bộ card bên phải | `customerApiService.getCustomerSummary(id)` | `GET /api/v1/customers/:customerId/summary` (đã định nghĩa ở `docs/khach_hang_api.md` mục 2.6) |
| Bảng "Danh sách đơn hàng của khách hàng" | `customerApiService.getCustomerOrders(id, params)` | `GET /api/v1/customers/:customerId/orders` (mục 2.7 tài liệu đó) |
| Modal "Chỉnh sửa khách hàng" | `customerApiService.updateCustomer(id, values)` | `PUT /api/v1/customers/:customerId` (mục 2.4 tài liệu đó) |

Cả 3 endpoint **đã được định nghĩa đầy đủ** ở `docs/khach_hang_api.md` — mục 2-6 dưới đây chỉ soát lại
từng phần UI của riêng trang chi tiết đối chiếu dữ liệu DB mới nhất, không định nghĩa lại endpoint mới
trừ phát hiện ở mục 0.

## 2. Header hồ sơ + breadcrumb

| Phần UI | Nguồn (`CustomerSummary`) | Ghi chú |
|---|---|---|
| Breadcrumb cuối (`customer.customerId`) | Đề xuất đổi sang `customer.customerCode` | Xem mục 0. |
| Avatar + "Mã khách hàng" | Đề xuất đổi sang `customer.customerCode` | Xem mục 0 — hiện đọc `customer.customerId`. |
| "Tên khách hàng" | `customer.customerName` | Khớp `customers.customer_name`. |
| "Ngày tạo" | `summary.createdAt` | Khớp `customers.created_at` — đã đúng theo `docs/khach_hang_api.md` mục 1 (dòng ghi chú "trang chi tiết có ô Ngày tạo — nên trả `created_at`"). |
| Badge "Trạng thái" | `customer.status` (`active`/`inactive`) | Khớp `CUSTOMER_STATUS_META`, đã đúng theo quyết định 2 (`docs/khach_hang_api.md` mục 3). |
| "Tổng giá trị giao dịch" | `summary.totalValue` | `SUM(orders.total_amount)` theo `customer_id` — công thức đã chốt, xem mục 2.6 tài liệu kia. |

## 3. Card "Thông tin khách hàng"

| Trường UI | Nguồn | Ghi chú |
|---|---|---|
| Người liên hệ | `customer.customerName` | Trùng "Tên khách hàng" ở header — không phải 2 khái niệm khác nhau (mock cũ từng có field `contactName` riêng, DB thật không có — đã đúng, chỉ dùng lại `customerName`). |
| Số điện thoại | `customer.phone` | Khớp `customers.phone` (`NOT NULL` trên DB — không cần xử lý rỗng). |
| Email | `customer.email \|\| '—'` | `customers.email` **nullable** trên DB thật — `docs/khach_hang_api.md` mục 1 đã chốt: backend chuẩn hoá `NULL → ''` khi trả về, FE hiển thị `'—'` khi rỗng. Khớp đúng code hiện tại. |
| Địa chỉ | `customer.address \|\| '—'` | `customers.address` nullable — khớp tương tự. |
| Ghi chú cụ thể | `customer.notes \|\| 'Không có ghi chú.'` | `customers.notes` nullable — khớp tương tự. |

## 4. Card "Hồ sơ nhanh" (cột phải)

Không có gì mới — dùng lại đúng `customer.customerName`/`phone`/`email`/`address` đã có ở mục 2/3, chỉ
trình bày lại ở vị trí khác trên UI. Không cần field/endpoint riêng.

## 5. Card "Tổng quan giao dịch" + "Công nợ & thanh toán"

| Trường UI | Nguồn (`CustomerSummary`) | Xác nhận lại theo DB 2026-07-20 |
|---|---|---|
| "Tổng đơn hàng" | `customer.totalBookings` | `COUNT(orders WHERE customer_id=?)` — đã chốt ở mục 1 tài liệu kia. |
| "Đang hoạt động" | `summary.activeOrdersCount` | `COUNT(orders WHERE customer_id=? AND order_status IN ('NEW','IN_PROGRESS'))` — enum `order_status` xác nhận đúng 5 giá trị thật (`NEW`/`CONFIRMED`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED`), khớp. |
| "Công nợ còn lại" (x2, 2 card) | `summary.remainingDebt` | `totalValue - paidAmount`. |
| "Tỷ lệ thanh toán" | `summary.paymentRate` | `round(paidAmount / totalValue * 100)`. |
| "Đã thanh toán" | `summary.paidAmount` | Xác nhận lại enum: `deposits.status` thật có `PENDING`/`SUCCESS`/`OVERDUE`/`CANCELLED` — dùng `SUCCESS` đúng như đã chốt; `settlements.status` thật có `DRAFT`/`AGREED`/`REQUESTED`/`PAID`/`CONFIRMED` — dùng `PAID`/`CONFIRMED` đúng như đã chốt (mục 2.6, quyết định 5 tài liệu kia). **Không có thay đổi** so với quyết định cũ, chỉ xác nhận lại enum còn khớp. |
| "Tổng công nợ giao dịch" | `summary.totalValue` | Lặp lại giá trị ở header. |

Không phát hiện sai lệch nào ở mục này — công thức đã chốt trước vẫn đúng với schema thật hiện tại.

## 6. Bảng "Danh sách đơn hàng của khách hàng" — cột "Phụ trách" (`coordinator`)

`docs/khach_hang_api.md` mục 2.7 đang để field này ở mức tạm: *"map tạm từ `orders.created_by →
users.full_name`... giữ tạm cho tới khi có khái niệm phụ trách riêng"*.

**Kể từ 2026-07-20, đã có quyết định chung cho đúng khái niệm "người phụ trách/điều phối 1 đơn"** ở
`docs/danhsachdondat_api.md` mục 4.1 và `docs/picklistxuatkho_api.md` mục 3.4: join
`schedule_plan_assignees.role = 'LEAD'` của dòng `schedule_plans` **sớm nhất theo `start_time`** thuộc
đơn đó. Đây là cùng 1 khái niệm dữ liệu ("ai phụ trách/điều phối đơn này") xuất hiện ở 3 màn khác nhau
— **áp dụng thống nhất cách join này cho cột "Phụ trách" ở bảng này luôn**, thay vì tiếp tục dùng tạm
`created_by` (người *tạo* đơn, không nhất thiết là người *phụ trách*).

Đề xuất cập nhật `docs/khach_hang_api.md` mục 2.7 theo đúng hướng này khi tới lượt sửa tài liệu đó (SQL
mẫu xem `docs/picklistxuatkho_api.md` mục 3.4) — không lặp lại SQL ở đây.

## 7. Modal "Chỉnh sửa khách hàng"

Đối chiếu `CustomerFormModal.tsx` với `UpdateCustomerPayload` (`types/customer.ts`): khớp đầy đủ
(`customerName`, `phone`, `email`, `address`, `notes`, `status`) — không có field thừa/thiếu.

Riêng validate phía FE (`validate()` trong component) **chặt hơn** payload thật:
- `phone` bắt buộc đúng 10 chữ số (`/^\d{10}$/`) — `customers.phone` trên DB chỉ là `varchar(30)` tự do,
  không có CHECK constraint. Giữ nguyên validate FE này (chấp nhận được như UX bổ sung), backend không
  cần validate chặt y hệt trừ khi Product muốn đồng bộ.
- `address` bắt buộc (`required`) trên FE — nhưng `customers.address` là cột **nullable** trên DB thật.
  Đây chỉ là ràng buộc UX chặt hơn khi *sửa từ trang chi tiết Manager*, không phải giới hạn kỹ thuật của
  backend — backend vẫn nên chấp nhận `address` rỗng/thiếu cho các luồng tạo/sửa khác (API tự do hơn
  UI). Không cần thay đổi gì ở backend.

## 8. Trang mirror `/admin/customers/[id]` — vẫn dùng mock, chưa nối API (ngoài phạm vi, ghi nhận)

`src/app/admin/customers/[id]/page.tsx` hiện vẫn gọi `getAdminCustomerDetail`/`updateAdminCustomer` từ
`src/mocks/db/customers.ts` (mock, không phải `customerApiService`) — khác hẳn bản Manager đã nối thật.
Theo CLAUDE.md mục "Vai trò & phân quyền" (Admin chỉ xem/audit, không xử lý vận hành), khi nối API thật
cho trang Admin này cần đảm bảo **chỉ đọc** (ẩn/khoá nút "Chỉnh sửa khách hàng", hoặc backend trả 403
cho `PUT /customers/:id` nếu role gọi là `ADMIN` — theo đúng pattern đã áp dụng ở
`docs/thietbikhohang_api.md` mục 0 cho trường hợp tương tự). Không thuộc phạm vi sửa của tài liệu này,
chỉ ghi nhận lại làm việc còn tồn.

## 9. Tổng hợp

### 9.1. Cần Backend xác nhận/sửa — **toàn bộ đều chỉ ở tầng code (service/query), không cần `ALTER TABLE`/tạo bảng mới cho mục 1-2**

1. **Thêm field `customerCode`** vào response `Customer`/`CustomerSummary` (mọi endpoint ở
   `docs/khach_hang_api.md` mục 2) — trả `customers.customer_code` (mục 0). **Không cần sửa DB**: cột
   `customer_code` **đã tồn tại sẵn** trên bảng `customers` (`UNIQUE`, đã có dữ liệu thật `CUS-001`,
   `CUS-002`) — chỉ cần backend thêm field này vào JSON response ở tầng service/serializer. Không đổi
   `customerId` (vẫn là `customer_id` UUID, dùng cho path param, không đổi hành vi routing hiện tại).
2. **Cột "Phụ trách" (`coordinator`) ở `GET /customers/:id/orders`** (mục 6): đổi từ tạm dùng
   `orders.created_by` sang join `schedule_plan_assignees.role='LEAD'` của `schedule_plans` sớm nhất —
   thống nhất với `docs/danhsachdondat_api.md` mục 4.1 / `docs/picklistxuatkho_api.md` mục 3.4.
   **Không cần sửa DB**: mọi bảng/cột dùng trong câu join (`schedule_plans`, `schedule_plan_assignees`,
   `users`) đã tồn tại sẵn — chỉ cần đổi câu query ở backend.
3. Xác nhận lại `event_type` trên `orders` **vẫn là `varchar(100)` tự do**, chưa có enum cố định — quyết
   định 7 ở `docs/khach_hang_api.md` (chuẩn hoá `serviceFilter`) **chưa được áp dụng ở schema**, vẫn
   đang chờ Backend đề xuất danh sách enum cụ thể như tài liệu đó đã ghi. **Đây là việc kế thừa từ
   `docs/khach_hang_api.md` (nêu từ 2026-07-19), không phải phát hiện mới của tài liệu này** — không bắt
   buộc phải làm để hoàn tất phần còn lại của trang "Chi tiết khách hàng"; nếu Product sau này quyết
   định chuẩn hoá, đây mới là mục **duy nhất** trong tài liệu này thật sự có thể cần đổi DB
   (`orders.event_type` từ `varchar` tự do sang `ENUM` cố định).

### 9.2. Không có thay đổi — đã đúng theo `docs/khach_hang_api.md`

Toàn bộ phần còn lại của trang (header trạng thái/ngày tạo/tổng giá trị, card thông tin liên hệ, công
thức công nợ/tỷ lệ thanh toán, payload modal sửa) đã khớp đúng dữ liệu DB thật ngày 2026-07-20, không
cần thay đổi gì thêm so với tài liệu đã chốt trước.
