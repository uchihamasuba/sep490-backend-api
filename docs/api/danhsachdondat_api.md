# API cho màn "Quản lý đơn đặt hàng" (`/admin/orders_audit`, `/manager/orders`)

> Phạm vi tài liệu này: **chỉ** màn danh sách đơn đặt hàng (6 thẻ KPI + thanh tìm kiếm/bộ lọc + bảng
> chính + phân trang) và modal "Khởi tạo đơn đặt hàng" (`BookingFormModal`) theo đúng ảnh mẫu người dùng
> cung cấp. **Không** bao gồm trang chi tiết đơn đặt (`/manager/orders/[id]`, `/admin/orders_audit/[id]`
> — có timeline/crew/dispute log/picklist riêng, cần tài liệu khác nếu triển khai).
>
> Nguồn tham chiếu:
> - FE: `src/app/manager/orders/page.tsx` và `src/app/admin/orders_audit/page.tsx` (**2 file giống hệt
>   nhau từng dòng**, chỉ khác tiền tố route `/manager/orders` ↔ `/admin/orders_audit`, xem mục 1.1),
>   `src/components/bookings/BookingFormModal.tsx`, `src/mocks/db/orders.ts` (nguồn dữ liệu "Order" DUY
>   NHẤT cho toàn bộ UI Admin + Manager), `src/mocks/db/employees.ts` (nguồn `COORDINATOR_POOL`),
>   `src/types/order.ts` (type thật khớp backend đã refactor), `src/services/order.service.ts`,
>   `src/services/mockAdapter.ts` (route `GET/POST /orders`, xem mục 1.2 — bằng chứng trực tiếp cho các
>   field không có căn cứ thật).
> - DB thật: đối chiếu trực tiếp qua MySQL MCP ngày 2026-07-20 — `SHOW TABLES` (24 bảng, không đổi so
>   với lần đối chiếu ở `docs/danhsachhopdong_api.md`), `SHOW CREATE TABLE orders/order_items/customers/
>   deposits/users/schedule_plans/schedule_plan_assignees`; dữ liệu mẫu thật hiện có **1 order duy nhất**
>   (`ORD-001`, `order_status = CONFIRMED`, `payment_status = UNPAID`), 2 customers, 1 quotation.
> - `docs/api/` **không tồn tại trong repo** (giống mọi tài liệu API trước đã viết) — dùng trực tiếp
>   comment đầu `src/types/order.ts` (đối chiếu `prisma/schema.prisma`/`order.route.ts`/
>   `order.validator.ts`/`order.service.ts` backend ngày 2026-07-06) làm căn cứ.

## 0. Base URL & Auth

- Base path: `/api/v1`.
- Trang có ở **cả** `/admin/orders_audit` và `/manager/orders` — xem mục 1.1 về vấn đề phân quyền phát
  sinh từ việc này.

## 1. Đối chiếu tổng quan

### 1.1. Tin tốt trước: `orders` là bảng thật, khớp khá sát `types/order.ts` — khác hẳn phát hiện ở tài liệu "Hợp đồng"

Không giống `docs/danhsachhopdong_api.md` (nơi "Hợp đồng" không tồn tại dưới bất kỳ hình thức nào trong
schema thật), `orders` **là bảng thật, đã tồn tại và có dữ liệu mẫu** (`ORD-001`). Đối chiếu
`SHOW CREATE TABLE orders` với `src/types/order.ts` — toàn bộ 17 cột (`order_id`, `order_code`,
`customer_id`, `quotation_id`, `policy_id`, `event_type`, `event_name`, `event_date`, `location`,
`guest_count`, `total_amount`, `payment_status`, `order_status`, `cancel_reason`, `notes`, `created_by`,
`created_at`, `updated_at`) khớp 1:1 với interface `Order`. Enum `order_status`
(`NEW`/`CONFIRMED`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED`) và `payment_status`
(`UNPAID`/`DEPOSITED`/`PAID`) trong DB thật cũng khớp đúng `BOOKING_STATUS_META`/`PAYMENT_STATUS_META`
mà 2 trang danh sách này đang dùng (`src/constants/order-status.ts`) — **đây là điểm khác biệt quan
trọng so với ghi chú ở CLAUDE.md mục 1** (nói `OrderStatus` có 7 giá trị lowercase kiểu
`draft`/`deposit_paid`/`settlement_pending`): comment đầu `types/order.ts` ghi rõ đây là bản **đã refactor
ngày 2026-07-06**, và bản 5-giá-trị UPPERCASE này mới là bản đang được 2 trang danh sách + modal tạo mới
sử dụng thật. **CLAUDE.md mục 1 đang mô tả 1 phiên bản enum cũ hơn** — nên cập nhật lại CLAUDE.md khi có
dịp, không phải lỗi của 2 trang này.

**Do đó phần lớn tài liệu này không cần đề xuất "Hướng A/B" như tài liệu Hợp đồng** — endpoint
`GET/POST /api/v1/orders` **đã đúng đối tượng cần dùng**, vấn đề còn lại chỉ là: (a) một số field UI mock
hiển thị không có cột tương ứng trên `orders` thật (mục 2-4), và (b) 1 vấn đề kiến trúc y hệt tài liệu
Hợp đồng — modal tạo mới thiếu hẳn bước nhập `items[]` bắt buộc (mục 6).

### 1.2. `src/services/mockAdapter.ts` đã tự chứng minh field nào có căn cứ thật, field nào không

Khác các tài liệu trước (phải tự suy luận ánh xạ), lần này **đã có sẵn bằng chứng trực tiếp trong code**:
`mapOrderToApi()` (`src/services/mockAdapter.ts:64-83`) — hàm chuyển `AdminOrderRow` (mock) sang `Order`
(shape thật) cho route `GET /orders` — **chỉ map đúng 10 field** (`orderId`, `orderCode`, `customerId`,
`quotationId`, `eventType` — hard-code cứng `'Đám cưới'`, `eventName` — tự ghép `Lễ cưới ${customerName}`,
`eventDate` ← `weddingDate`, `location` ← `venue`, `guestCount`, `totalAmount` ← `totalPrice`,
`paymentStatus`, `orderStatus`, `notes`, `createdBy` — hard-code `'mock-manager-1'`). **4 field khác trên
`AdminOrderRow` hoàn toàn KHÔNG được map sang API thật — bị bỏ rơi ở tầng service**:
`coordinatorName`, `packageType`, `depositAmount`, `weddingEndDate` — đây chính là các field không có cột
tương ứng trên `orders` thật (mục 3-4 dưới đây phân tích cụ thể từng field).

### 1.3. 2 trang danh sách đọc thẳng mock, không gọi qua `order.service.ts` — chấp nhận được ở giai đoạn hiện tại nhưng cần đổi khi nối API thật

`manager/orders/page.tsx` và `admin/orders_audit/page.tsx` gọi thẳng `getAdminOrders()` từ
`@/mocks/db/orders` (dòng 26-28), **không** gọi `orderApiService.getOrders()` — khác với
`CreateTaskModal.tsx` (dùng cho màn Lịch trình) đã gọi đúng qua service layer
(`orderApiService.getOrders({ limit: 200 })`). Theo CLAUDE.md mục 0 (giai đoạn UI-first), việc này chấp
nhận được tạm thời, nhưng khi nối API thật **bắt buộc đổi sang gọi `orderApiService.getOrders(params)`**
(CLAUDE.md mục 4: "Mọi gọi API phải đi qua lớp `services/*.service.ts`"), đồng thời chuyển toàn bộ lọc
(status/payment/search) hiện đang làm ở client (`useMemo` dòng 56-70) sang gửi qua query param cho
backend xử lý (mục 4 dưới).

**Route `GET /orders` trong `mockAdapter.ts` (dòng 220-224) hiện cũng CHƯA đọc `params.orderStatus`/
`params.paymentStatus`/`params.search`** — dù `GetOrdersQuery` (`order.service.ts`) đã khai báo 3 tham số
này, mock adapter chỉ phân trang (`paginate()`) trên toàn bộ danh sách, không lọc gì cả. Nếu dùng
`orderApiService.getOrders()` ngay bây giờ sẽ **không lọc được** — cần bổ sung logic lọc vào mock adapter
song song với việc yêu cầu backend thật hỗ trợ đúng 3 param này (mục 4.4/7).

### 1.4. Vấn đề phân quyền: trang tồn tại y hệt ở cả Admin và Manager, có cả nút Tạo + Xóa

Giống hệt tình huống tài liệu Hợp đồng đã nêu (mục 34-36 file đó) nhưng nghiêm trọng hơn vì ở đây **có cả
2 hành động ghi dữ liệu vận hành thật** (không chỉ xem):

- Nút "Khởi tạo đơn đặt hàng" (tạo Order mới) xuất hiện ở **cả 2 trang**.
- Nút xóa (icon thùng rác) gọi `deleteAdminOrder()` — xóa cứng bản ghi — cũng xuất hiện ở **cả 2 trang**.

CLAUDE.md mục 1 quy định rõ: **Admin không xử lý vận hành hằng ngày, không trực tiếp ghi nhận cọc/thanh
toán... "**; tạo/xóa Order (đơn hàng đang thi công thật) là hành động vận hành hằng ngày, thuộc trách
nhiệm **Manager**. Việc `admin/orders_audit/page.tsx` cho phép Admin tạo/xóa Order y hệt Manager **trái
với ranh giới phân quyền đã ghi trong CLAUDE.md** — cần Product xác nhận: (a) bỏ nút Tạo + Xóa khỏi bản
Admin, chỉ giữ xem (đúng tinh thần "orders_audit" = màn audit-only), hay (b) giữ nguyên nếu Product coi
đây là ngoại lệ cho phép Admin tạo hộ. Chưa nên code phân quyền cho tới khi có quyết định này (tương tự
khuyến nghị ở tài liệu Hợp đồng mục 3.2 cuối).

## 2. Ánh xạ 6 thẻ KPI

| Thẻ UI | Nguồn (mock) | Theo `orders` thật |
|---|---|---|
| Tổng đơn | `orders.length` | `COUNT(*) FROM orders` |
| Mới | `orders.filter(status === 'NEW').length` | `COUNT(*) WHERE order_status = 'NEW'` |
| Đã xác nhận | `status === 'CONFIRMED'` | `WHERE order_status = 'CONFIRMED'` |
| Đang chuẩn bị | `status === 'IN_PROGRESS'` | `WHERE order_status = 'IN_PROGRESS'` (nhãn UI "Đang chuẩn bị" khác nhãn chuẩn `ORDER_STATUS_LABEL.IN_PROGRESS` = "Đang thực hiện" — lệch nhãn hiển thị giữa 2 nơi trong cùng codebase, nên thống nhất lại 1 nhãn) |
| Hoàn thành | `status === 'COMPLETED'` | `WHERE order_status = 'COMPLETED'` |
| Đã hủy | `status === 'CANCELLED'` | `WHERE order_status = 'CANCELLED'` |

**Không có endpoint thống kê nào cho 6 số liệu này** trong `order.service.ts`/`types/order.ts` hiện tại —
`GetOrdersQuery` chỉ hỗ trợ phân trang + lọc, không có dạng "đếm theo nhóm". 2 lựa chọn:

- **(a) Tận dụng `meta.totalCount`** (đã có sẵn qua `paginate()` trong mock, xem
  `src/mocks/db/utils.ts`/`mockAdapter.ts`): gọi `GET /orders?orderStatus=X&limit=1` 5 lần (mỗi trạng
  thái) + 1 lần không lọc để lấy tổng — 6 lần gọi cho 1 lần tải trang, chấp nhận được nếu số đơn không
  lớn nhưng lãng phí round-trip.
- **(b) Thêm endpoint mới `GET /api/v1/orders/stats`** trả thẳng `{ total, NEW, CONFIRMED, IN_PROGRESS,
  COMPLETED, CANCELLED }` — khuyến nghị hướng này (khớp cách các trang KPI khác trong hệ thống nên làm),
  cần Backend xác nhận trước khi FE đổi.

## 3. Bộ lọc (search, trạng thái, thanh toán, điều phối viên)

| Filter UI | Nguồn (mock) | Theo API thật |
|---|---|---|
| Ô tìm kiếm ("Mã đơn, sự kiện, khách hàng, SĐT...") | So khớp thủ công `orderId`/`customerName`/`customerPhone`/`venue` (client, `page.tsx` dòng 63-68) | `GetOrdersQuery.search` **đã khai báo** nhưng mock adapter chưa lọc theo nó (mục 1.3) — cần Backend xác nhận `search` thật sự quét những cột nào (gợi ý: `order_code`, `event_name`, JOIN `customers.customer_name`/`phone`) vì tên biến không tự mô tả phạm vi. |
| Dropdown "Tất cả trạng thái" | `BOOKING_STATUS_META` (5 giá trị, đã khớp thật — mục 1.1) | `GetOrdersQuery.orderStatus` — **đã có sẵn**, chỉ cần backend/mock adapter thật sự áp dụng. |
| Dropdown "Tất cả thanh toán" | `PAYMENT_STATUS_META` (3 giá trị, đã khớp thật) | `GetOrdersQuery.paymentStatus` — **đã có sẵn**, tương tự trên. |
| Dropdown "Mọi điều phối viên" | `COORDINATOR_POOL` (5 tên cố định từ `db/employees.ts`, lọc client theo `o.coordinatorName`) | **Không có tham số nào tương ứng trong `GetOrdersQuery`, và cũng không có cột nào trên `orders` thật để lọc** — xem phân tích chi tiết ở mục 4 (`coordinatorName`). Đây là filter duy nhất trong 4 filter cần thiết kế lại hoàn toàn nếu muốn giữ, không phải chỉ thêm query param. |

## 4. Bảng chính — ánh xạ từng cột

| Cột UI | Nguồn (mock) | Theo `orders` thật |
|---|---|---|
| Mã đơn (`DD0001`) | `AdminOrderRow.orderId` (tự sinh `nextSequentialId`, prefix `DD` + 4 số) | `orders.order_code` — **đổi hẳn định dạng hiển thị**, không phải prefix `DD` (dữ liệu mẫu thật: `ORD-001`). Client **không được tự đoán mã** — `POST /orders` chỉ trả `{orderId, orderCode}` sau khi tạo (comment `types/order.ts` dòng 103-107), giống vấn đề đã nêu ở các tài liệu trước. |
| Sự kiện / Khách hàng | `packageType` (`"Lễ cưới - Gói Platinum"`...) + `customerName` (2 field lưu trực tiếp trên `AdminOrderRow`) | **Không có cột "gói dịch vụ" trên `orders` thật** — chỉ có `event_type`/`event_name` tự do (dữ liệu mẫu thật: `event_type = "Conference"`, `event_name = "Tech Summit 2026"` — khái niệm sự kiện chung, không phải "gói cưới" cố định). `customerName` phải **JOIN** `customers.customer_name` qua `orders.customer_id`, không lưu snapshot (mock hiện lưu cả `customerId` **và** `customerName`/`customerPhone` riêng trên `AdminOrderRow` — dư thừa, dễ lệch nếu khách đổi tên/SĐT sau khi tạo đơn — nên bỏ 2 field snapshot này khi nối API thật, luôn lấy real-time qua JOIN). Cần Product xác nhận có ràng buộc `event_type` theo danh sách gói cố định (giống `PACKAGE_OPTIONS`) hay giữ tự do như hiện tại — **giống hệt câu hỏi đã đặt ra ở `docs/danhsachhopdong_api.md` mục 2.3**, chưa có câu trả lời. |
| Ngày tổ chức | `weddingDate` (`YYYY-MM-DD`) | `orders.event_date` (thật ra là `timestamp`, không phải chỉ ngày — dữ liệu mẫu `"2026-08-15T02:00:00.000Z"`, có giờ). Riêng `weddingEndDate` (ngày kết thúc, dùng cho sự kiện nhiều ngày) **không có cột tương ứng** — `orders` thật chỉ có 1 mốc `event_date`, không có khoảng ngày bắt đầu/kết thúc. Modal tạo mới bắt buộc nhập cả 2 (`BookingFormModal.tsx` dòng 88-90, validate `weddingEndDate >= weddingDate`) — cần Product xác nhận có cần thêm cột `event_end_date` cho sự kiện đa ngày hay bỏ trường này khỏi UI. |
| Địa điểm | `venue` — chọn từ `VENUE_OPTIONS` (pool tên hội trường cố định, dùng chung với Quotation) | `orders.location` (kiểu `text`, tự do) — khớp về mặt lưu trữ (chuỗi), nhưng UI đang ép chọn từ 1 danh sách cố định trong khi cột thật là text tự do không ràng buộc — chấp nhận được nếu Product muốn giữ danh sách hội trường cố định làm UX, không phải lỗi kỹ thuật. |
| Khách mời | `guestCount` (luôn có giá trị, seed 150-500) | `orders.guest_count` — cột **nullable** (`int DEFAULT NULL`) trên DB thật, khác giả định "luôn có số" của mock — FE cần xử lý hiển thị khi `null` (dấu `—` thay vì `0`). |
| Trị giá | `totalPrice` | `orders.total_amount` (`decimal(14,2)`) — khớp thẳng, không có VAT/discount tách riêng trên `orders` (giống kết luận ở tài liệu Hợp đồng mục 2.1 — nhất quán). |
| Thanh toán (badge) | `paymentStatus` | `orders.payment_status` — khớp 1:1, đã đúng enum thật (mục 1.1). Nhãn hiển thị "Đã đặt cọc 50%"/"Đã thanh toán 100%" (`PAYMENT_STATUS_META` ở `db/orders.ts`) là **số % tự bịa cố định**, không phải giá trị từ `deposits`/`settlements` thật — nên đổi nhãn thành "Đã đặt cọc"/"Đã thanh toán" (không kèm %) để không hiển thị sai số liệu thật (thật ra phải tính % cụ thể qua bảng `deposits`, ngoài phạm vi màn danh sách này). |
| Đơn hàng (badge trạng thái, ví dụ "Mới") | `status` | `orders.order_status` — khớp 1:1 (mục 1.1). |
| Thao tác (Xem/Xóa) | `router` sang `/manager/orders/[id]` hoặc `/admin/orders_audit/[id]`; `deleteAdminOrder()` xóa cứng | Xem chi tiết: `GET /api/v1/orders/:id` (đã có, trả kèm `orderItems`/`orderWarnings`/`deposits`/`settlements`). **Xóa đơn đặt: không có API tương đương an toàn** — `order.service.ts` chỉ có `updateOrderStatus` (dùng chung cho hủy đơn, `PUT /orders/:id/status` với `orderStatus: 'CANCELLED'` + `cancelReason`), **không có `DELETE /api/v1/orders/:id`** nào được tài liệu hóa. CLAUDE.md không liệt kê nghiệp vụ "xóa Order" trong toàn bộ vòng đời — chỉ có "hủy đơn" (mục 1 CLAUDE.md, chính sách hoàn cọc theo mốc thời gian). **Đây là finding giống hệt mục 2.3 của `docs/danhsachhopdong_api.md`** (cùng vấn đề với nút xóa hợp đồng) — nút "Xóa đơn đặt" hiện tại cần đổi thành "Hủy đơn" gọi `updateOrderStatus(id, {orderStatus: 'CANCELLED', cancelReason})` thay vì xóa cứng bản ghi. Về mặt schema, các bảng con (`order_items`, `deposits`, `schedule_plans`) đều có `ON DELETE CASCADE` theo `order_id` nên xóa cứng **khả thi kỹ thuật**, nhưng không có căn cứ nghiệp vụ nào trong CLAUDE.md cho phép — cần Product quyết định trước khi Backend cân nhắc thêm endpoint DELETE thật. |

### 4.1. Field `coordinatorName` ("Điều phối viên") — không có căn cứ trực tiếp trên `orders`, cần join qua `schedule_plan_assignees`

Giống hệt phát hiện "Nhân sự phụ trách ký duyệt" ở `docs/danhsachhopdong_api.md` mục 1.4/3.1:
`COORDINATOR_POOL` lấy từ `db/employees.ts` (`Employee` mock, **KHÁC** bảng `users` RBAC thật). Đối chiếu
schema thật — **`orders` không có cột nào lưu "người điều phối"**. Khái niệm gần nhất tồn tại thật trong
DB là `schedule_plan_assignees` (`plan_id`, `user_id`, `role ENUM('LEAD','TECHNICAL')`) nối qua
`schedule_plans.order_id` — tức là quan hệ **order → nhiều schedule_plan → nhiều user** (nhiều người, có
vai trò LEAD/TECHNICAL, không phải "1 điều phối viên duy nhất" như mock giả định). Hệ quả:

- Không thể lọc "Mọi điều phối viên" ở màn danh sách Order bằng 1 query param đơn giản trên `orders` —
  cần JOIN 2 cấp (`orders` → `schedule_plans` → `schedule_plan_assignees` → `users`) và quyết định lấy
  người có `role = 'LEAD'` đầu tiên tìm thấy làm "điều phối viên đại diện", hoặc bỏ hẳn khái niệm 1-người
  duy nhất này khỏi màn danh sách Order (khuyến nghị, vì thật ra Schedule Plan mới là nơi có nhân sự
  điều phối, không phải Order).
- Cần Product xác nhận: giữ filter này (yêu cầu Backend thêm 1 trong 2: endpoint join sẵn, hoặc query
  param mới trên `GET /orders` kiểu `assignedUserId`), hay bỏ hẳn khỏi UI danh sách Order và để nghiệp vụ
  "xem theo điều phối viên" thuộc về màn Lịch trình/Schedule Plan (nơi đã có sẵn dữ liệu thật).

## 5. Modal "Khởi tạo đơn đặt hàng" — ánh xạ sang `POST /api/v1/orders`

### 5.1. Trường trên UI (`BookingFormModal.tsx`)

| Trường UI | Theo `CreateOrderPayload` thật |
|---|---|
| Khách hàng liên kết * | `customerId` — khớp, bắt buộc đúng như payload thật. |
| Tên liên hệ * / Số điện thoại * | **Không có trong `CreateOrderPayload`** — đây là 2 field snapshot dư thừa (mục 4, cột "Sự kiện/Khách hàng") tự lấy từ khách hàng đã chọn rồi cho sửa tay tiếp, không có ý nghĩa gì khi gửi API thật (backend luôn tra `customers` theo `customerId`) — **bỏ khỏi payload gửi đi**, có thể giữ làm hiển thị read-only sau khi chọn khách hàng nếu muốn, không gửi lên server. |
| Ngày tổ chức * / Ngày kết thúc * | `eventDate` (1 giá trị `timestamp`) — modal có 2 trường, thật chỉ nhận 1. Xem mục 4 (cột "Ngày tổ chức") — cần Product xác nhận có bỏ "Ngày kết thúc" hay yêu cầu Backend thêm cột `event_end_date`. |
| Số lượng khách * | `guestCount` (optional trên payload thật, modal đang bắt buộc `>= 20` — chặt hơn backend, chấp nhận được như validation UX bổ sung). |
| Gói dịch vụ | Không có cột — map tạm vào `eventType`/`eventName` tự do (xem mục 4), **không có validate danh sách cố định ở backend**. |
| Sảnh tiệc | `location` — khớp, nhưng modal ép chọn từ danh sách cố định trong khi backend nhận text tự do (mục 4). |
| Tổng giá trị dự kiến (VNĐ) | **Không có field tương ứng trên `CreateOrderPayload`** — `totalAmount` không được client gửi lên, backend tự tính bằng tổng `items[].quantity * unitPrice` (suy ra từ `order_items.subtotal`). Đây chính là hệ quả trực tiếp của vấn đề mục 5.2: modal cho nhập 1 số tổng duy nhất thay vì nhập từng hạng mục. |
| Khoản tiền đặt cọc (VNĐ) | **Không có trên `CreateOrderPayload`/bảng `orders`** — đặt cọc là 1 bản ghi riêng trên bảng `deposits` (`deposit_id`, `order_id`, `amount`, `status`...), được tạo qua luồng "yêu cầu cọc" riêng sau khi Order đã tồn tại, không phải field khi tạo Order. Bỏ khỏi form tạo mới. |
| Trạng thái đặt cọc / thanh toán | `paymentStatus` **không nằm trong `CreateOrderPayload`** — cột này trên `orders` có `DEFAULT 'UNPAID'`, được cập nhật sau bởi luồng xác nhận cọc/thanh toán, không phải giá trị client tự chọn lúc tạo đơn. Bỏ khỏi form tạo mới. |
| Checkbox "Đã khảo sát hiện trường trước khi tạo đơn" | Không có trường tương ứng nào trên `Order`/`CreateOrderPayload` — khảo sát là entity riêng (`survey_reports`, đã có endpoint `/orders/:orderId/survey-reports` trong `mockAdapter.ts` dòng 286) độc lập với việc tạo Order. Field này không có tác dụng thật ngoài lưu 1 `surveyAssignment` cục bộ trên mock — cân nhắc bỏ khỏi modal tạo Order, để riêng cho màn Khảo sát. |
| Điều phối viên | Xem mục 4.1 — không có căn cứ thật, cần Product xác nhận trước khi giữ. |
| Ghi chú | `notes` — khớp, optional. |

### 5.2. Vấn đề kiến trúc nghiêm trọng nhất của modal — thiếu hẳn bước nhập `items[]` bắt buộc

**Giống hệt vấn đề đã nêu ở `docs/danhsachhopdong_api.md` mục 3.2 cho `ContractCreateModal`**:
`CreateOrderPayload` **yêu cầu bắt buộc** `items: CreateOrderItemPayload[]` (tối thiểu 1 dòng, mỗi dòng
`itemId`/`quantity`/`unitPrice`/`source?`/`notes?`) — nhưng `BookingFormModal.tsx` (modal thật sự được
dùng ở nút "Khởi tạo đơn đặt hàng" của **cả 2 trang** tài liệu này) **hoàn toàn không có bước chọn hạng
mục/thiết bị nào** — chỉ có 1 ô nhập tay "Tổng giá trị dự kiến". Route mock `POST /orders` trong
`mockAdapter.ts` (dòng 225-272) có nhận `items` trong payload và map thành `AdminOrderLineItem[]`, nhưng
vì `BookingFormModal` không gửi `items` (không có UI để nhập), route sẽ luôn rơi vào nhánh dự phòng
`buildOrderItems(orderId, totalPrice, payload.location, 'NEW')` (dòng 268) — **tự bịa 4 hạng mục cố định
theo tỷ lệ % của tổng giá trị** (Tiệc bàn 55%, Trang trí 20%, MC & âm thanh 15%, Quay phim phần còn lại —
xem `buildOrderItems()` dòng 173-228), không phản ánh hạng mục thật khách chọn.

**Khuyến nghị giống tài liệu Hợp đồng**: dùng lại wizard `CreateOrderFromQuotationModal` (đã có ở trang
chi tiết báo giá, đủ bước nhập `eventType`/`eventDate`/`location`/`items[]`) thay vì viết thêm/sửa
`BookingFormModal` thành 1 modal thiếu field bắt buộc. Nếu Product muốn giữ luồng "tạo đơn không qua báo
giá" (đơn không có `quotationId`) như 1 luồng riêng, modal đó vẫn **bắt buộc** phải có bước chọn hạng
mục/thiết bị + đơn giá theo catalog thật (`items`/`catalog`, xem `getCatalogItemsAsApiItems()` đã dùng
sẵn trong `mockAdapter.ts` dòng 236) — không thể chỉ nhập 1 số tổng.

### 5.3. Response chỉ trả `{orderId, orderCode}`

Sau khi tạo, FE cần tự `GET /api/v1/orders/:orderId` để lấy lại đầy đủ dữ liệu (bao gồm `orderCode` thật
do backend sinh) — không trông đợi response tạo mới trả full object, giống lưu ý đã nêu ở tài liệu Hợp
đồng mục 3.2.

## 6. Tổng hợp endpoint cần cho màn này

Không cần endpoint hoàn toàn mới nào cho luồng cơ bản — `order.service.ts` đã khai báo đủ:

- `GET /api/v1/orders` (`?page&limit&orderStatus&paymentStatus&search`) — **cần Backend xác nhận rõ
  phạm vi cột mà `search` quét qua** (mục 3), và **cần FE bổ sung logic lọc còn thiếu trong
  `mockAdapter.ts`** để test được ngay trong giai đoạn mock.
- `GET /api/v1/orders/:id` — dùng cho nút "Xem chi tiết" (ngoài phạm vi tài liệu này, đã có sẵn).
- `POST /api/v1/orders` — dùng cho "Khởi tạo đơn đặt hàng", nhưng **modal hiện tại thiếu field bắt buộc
  `items[]`** (mục 5.2) — cần sửa FE trước, không phải thêm API.
- `PUT /api/v1/orders/:id/status` — nên dùng thay cho nút "Xóa đơn đặt" hiện tại (mục 4, cột Thao tác).

Cần Backend/Product xác nhận thêm (chưa có trong `order.service.ts`/`types/order.ts` hiện tại):

- **(Đề xuất) `GET /api/v1/orders/stats`** — trả số đếm theo từng `order_status` cho 6 thẻ KPI (mục 2),
  tránh gọi 6 lần `GET /orders`.
- **Quyết định giữ/bỏ filter "Điều phối viên"** (mục 4.1) — nếu giữ, cần 1 trong: query param mới trên
  `GET /orders` join `schedule_plan_assignees`, hoặc bỏ khỏi UI danh sách Order.
- **Không đề xuất thêm `DELETE /api/v1/orders/:id`** cho tới khi Product xác nhận nghiệp vụ "xóa Order"
  có thật sự cần thiết ngoài "hủy đơn" đã có (mục 4).

## 7. Tổng hợp việc cần sửa ở FE khi nối API thật

- Đổi 2 trang danh sách sang gọi `orderApiService.getOrders(params)` qua service layer thay vì đọc thẳng
  `getAdminOrders()` (mục 1.3), chuyển lọc status/payment/search/điều phối viên từ client sang query
  param gửi lên backend.
- Bỏ 2 field snapshot `customerName`/`customerPhone` trên `AdminOrderRow` khi nối API thật — luôn lấy
  qua JOIN `customerId` (mục 4).
- Quyết định số phận `packageType`/`weddingEndDate`/`coordinatorName`/`depositAmount` (đều không có cột
  thật) trước khi sửa `BookingFormModal` — không tự bịa thêm field mới ở FE nếu Product chưa xác nhận
  (mục 4, 4.1, 5.1).
- Viết lại `BookingFormModal` để có bước chọn hạng mục/thiết bị (`items[]`) bắt buộc, hoặc thay hẳn bằng
  `CreateOrderFromQuotationModal`/wizard tương đương (mục 5.2) — đây là điều kiện tiên quyết trước khi
  nút "Khởi tạo đơn đặt hàng" tạo được Order đúng chuẩn `CreateOrderPayload`.
- Đổi nút "Xóa đơn đặt" thành "Hủy đơn" gọi `updateOrderStatus(id, {orderStatus: 'CANCELLED', cancelReason})`
  (mục 4).
- Rà soát lại với Product xem `admin/orders_audit` có nên tiếp tục cho phép Tạo/Xóa như Manager hay chỉ
  còn quyền xem (mục 1.4) — quyết định này ảnh hưởng cả 2 trang vì chúng dùng chung 1 component logic.
