# API cho modal "Tạo đơn đặt lịch tiệc mới" (`BookingFormModal`)

> Phạm vi tài liệu này: **chỉ** modal tạo/sửa 1 đơn đặt (`BookingFormModal.tsx`, tiêu đề "Tạo đơn đặt lịch
> tiệc mới" / "Chỉnh sửa đơn đặt · DDxxxx") mở từ nút "Khởi tạo đơn đặt hàng" ở `/manager/orders` và
> `/admin/orders_audit`. **Không** bao gồm bảng danh sách + 6 thẻ KPI + bộ lọc của 2 trang đó (đã có
> [`docs/danhsachdondat_api.md`](danhsachdondat_api.md)), không bao gồm trang chi tiết đơn đặt
> (`/manager/orders/[id]`, `/admin/orders_audit/[id]`), và không bao gồm modal "Chọn báo giá để tạo đơn"
> (`CreateOrderPickQuotationModal.tsx`, dùng ở `/admin/contracts`, đã có
> [`docs/danhsachhopdong_api.md`](danhsachhopdong_api.md)) — 2 modal tạo đơn này **độc lập nhau**, không
> dùng chung component.
>
> Nguồn tham chiếu:
> - FE: `src/components/bookings/BookingFormModal.tsx` (component chính), `src/mocks/db/orders.ts`
>   (`AdminOrderRow`, `emptyValues()`, `nextAdminOrderId()`, `buildOrderItems()`), `src/mocks/db/customers.ts`
>   (`getAdminCustomers()`), `src/types/order.ts` (`CreateOrderPayload`/`CreateOrderItemPayload`/
>   `CreateOrderResult` — shape thật khớp backend đã refactor), `src/services/order.service.ts`,
>   `src/services/mockAdapter.ts` (route `POST /orders` dòng 225-272, `mapOrderToApi()` dòng 64-82 —
>   bằng chứng trực tiếp field nào có/không có căn cứ thật khi map ngược `Order` → `AdminOrderRow`).
> - DB thật: đối chiếu trực tiếp qua MySQL MCP ngày 2026-07-20 — `SHOW CREATE TABLE orders`,
>   `order_items`, `deposits`, `customers`; dữ liệu mẫu thật hiện có: 1 order (`ORD-001`,
>   `order_status = CONFIRMED`, `payment_status = UNPAID`, `event_type = "Conference"`,
>   `event_name = "Tech Summit 2026"`), 2 customers, 1 quotation `APPROVED`, chỉ 2 item thật trong
>   `items`.
>
> Kết luận tổng quát trùng với phần "Modal Khởi tạo đơn đặt hàng" đã phân tích ở
> `docs/danhsachdondat_api.md` mục 5 — tài liệu này tách riêng, viết lại đầy đủ và tự chứa để giao thẳng
> cho backend mà không cần đọc file kia.

## 0. Base URL & Auth

- Base path: `/api/v1`, JWT Bearer theo `AuthContext` hiện có.
- Endpoint tạo đơn (mục 2) chỉ dành cho **Manager** — theo CLAUDE.md mục 1, Admin không xử lý vận hành
  hằng ngày (tạo Order là hành động vận hành). Nút "Khởi tạo đơn đặt hàng" hiện xuất hiện y hệt ở cả
  `/admin/orders_audit` và `/manager/orders` — cần Product xác nhận có ẩn nút này khỏi bản Admin hay
  không trước khi code phân quyền (chưa chốt, xem thêm `docs/danhsachdondat_api.md` mục 1.4).

## 1. Endpoint chính — `POST /api/v1/orders`

Endpoint **đã có sẵn** trong `order.service.ts`/`types/order.ts` (không phải endpoint mới) — tài liệu
này làm rõ payload thật cần gửi khi submit từ modal, đối chiếu `SHOW CREATE TABLE orders`/`order_items`
thật.

**Request body** (`CreateOrderPayload`, theo đúng cột NOT NULL của `orders`/`order_items` thật):

```json
{
  "customerId": "4c700a21-5440-41f7-b66e-acedd12a0e76",
  "quotationId": null,
  "eventType": "Lễ cưới - Gói Platinum",
  "eventName": "Lễ cưới Nguyễn Minh Trí",
  "eventDate": "2026-08-15T10:00:00.000Z",
  "location": "Riverside Palace (Sảnh Hera)",
  "guestCount": 100,
  "items": [
    { "itemId": "88dc60e1-89fa-497b-8bd5-b9c2ece4986e", "quantity": 2, "unitPrice": 500000, "source": "INTERNAL" }
  ],
  "notes": "string, optional"
}
```

- `items` **bắt buộc, tối thiểu 1 dòng** — `order_items.item_id`/`quantity`/`unit_price` đều `NOT NULL`,
  `item_id` có FK `RESTRICT` tới `items.item_id` (không cho phép hạng mục không gắn item catalog thật).
  Đây là vấn đề nghiêm trọng nhất của modal hiện tại — xem mục 3.
- `eventDate`: **1 mốc `timestamp` duy nhất**, không phải khoảng ngày — xem mục 3 về trường "Ngày kết
  thúc" của modal.
- `guestCount`: optional trên payload thật (`int DEFAULT NULL` trên `orders`), modal hiện bắt buộc
  `>= 20` — chặt hơn backend, chấp nhận được như validate UX bổ sung, không cần backend nới lỏng.
- `quotationId`: optional, chỉ có khi đơn được tạo từ 1 báo giá đã duyệt cụ thể — modal
  `BookingFormModal` hiện **không có bước chọn báo giá**, luôn gửi `null`/bỏ trống field này khi tạo mới
  từ đây (khác `CreateOrderPickQuotationModal`, xem đầu tài liệu).
- `policyId`: optional, không có ô nhập tương ứng trên modal — bỏ qua, để backend tự gán chính sách mặc
  định hoặc `null` nếu chưa có UI chọn chính sách cọc/hủy.

**Response 201** (`CreateOrderResult` — **chỉ trả 2 field**, không trả full object):

```json
{
  "success": true,
  "code": "ORDER_CREATED",
  "message": "Tạo đơn hàng thành công",
  "data": {
    "orderId": "c1cae042-93c9-4e0a-9ce3-673424e8adc9",
    "orderCode": "ORD-002"
  }
}
```

- `orderCode`: sinh ở backend tại thời điểm `INSERT` (prefix `ORD-`, dữ liệu thật `ORD-001`) — **khác
  hẳn** mã `DD0065` mà modal hiện hiển thị ở dòng phụ đề "Mã đơn đặt dự kiến". Modal **không được** tự
  đoán/hiển thị mã trước khi lưu — bỏ dòng subtitle này, hoặc đổi thành text trung tính kiểu "Mã đơn sẽ
  được hệ thống cấp sau khi lưu" nếu Product muốn giữ một dòng phụ đề.
- FE cần tự gọi tiếp `GET /api/v1/orders/:orderId` sau khi tạo để lấy lại đầy đủ dữ liệu hiển thị (đã
  đúng chuẩn OpenAPI, response tạo mới không trả full object).

**Response lỗi**

| HTTP | Trường hợp | Ghi chú |
|---|---|---|
| 400 | `items` rỗng, `itemId` không tồn tại/không phải UUID hợp lệ, `quantity <= 0`, thiếu `eventType`/`eventDate`/`location` | `{ "success": false, "code": "VALIDATION_ERROR", "message": "...", "errors": { "items[0].itemId": "..." } }` |
| 404 | `customerId` không tồn tại | Xảy ra nếu khách hàng bị xóa giữa lúc mở modal và lúc bấm Lưu |
| 403 | Người gọi không phải Manager (nếu Product chốt Admin không được tạo đơn — mục 0) | Theo chuẩn lỗi chung hệ thống |

## 2. Ánh xạ từng trường trên UI hiện tại

| Trường UI (`BookingFormModal.tsx`) | Theo `CreateOrderPayload` thật |
|---|---|
| Khách hàng liên kết * | `customerId` — khớp, bắt buộc đúng như payload thật. |
| Tên liên hệ * / Số điện thoại * | **Không có trong `CreateOrderPayload`** — 2 field snapshot dư thừa, backend luôn tra `customers` theo `customerId` để lấy tên/SĐT hiện hành. Đề xuất: giữ hiển thị read-only (tự điền khi chọn khách hàng ở dropdown trên, không cho sửa tay) để tránh lệch với dữ liệu khách hàng thật, **không gửi lên payload**. |
| Ngày tổ chức * / Ngày kết thúc * | `eventDate` — chỉ **1** giá trị `timestamp`. `orders` thật không có cột lưu khoảng ngày (không có `event_end_date`). Modal hiện bắt buộc nhập cả 2 và validate `weddingEndDate >= weddingDate` (dòng 88-90) — **cần Product xác nhận**: (a) bỏ hẳn "Ngày kết thúc" khỏi UI cho tới khi có yêu cầu sự kiện đa ngày thật, hay (b) yêu cầu Backend thêm cột `event_end_date` trước. Chưa nên tự thêm field ở FE. |
| Số lượng khách * | `guestCount` — khớp, optional ở backend nhưng modal validate chặt hơn (`>= 20`), giữ nguyên được. |
| Gói dịch vụ | Không có cột "gói dịch vụ" cố định trên `orders` — map tạm vào `eventType` (text tự do, dữ liệu mẫu thật `"Conference"`) hoặc `eventName`. **Cần Product xác nhận**: giữ danh sách gói cố định (`PACKAGE_OPTIONS` ở `db/orders.ts`) làm UX rồi gửi label vào `eventType`, hay đổi hẳn thành ô nhập tự do khớp đúng bản chất cột `varchar(100)` không ràng buộc. |
| Sảnh tiệc | `location` (`text`, tự do) — khớp về lưu trữ, nhưng modal ép chọn từ `VENUE_OPTIONS` (danh sách cố định) trong khi cột thật nhận text bất kỳ. Chấp nhận được nếu Product muốn giữ danh sách hội trường cố định làm UX, không phải lỗi kỹ thuật. |
| Tổng giá trị dự kiến (VNĐ) | **Không gửi lên** — `orders.total_amount` do **backend tự tính** = tổng `order_items[].quantity × unit_price` (đối chiếu `order_items.subtotal`). Đây là hệ quả trực tiếp của mục 3: phải có bước nhập `items[]` thật để tổng này có ý nghĩa, không phải 1 ô nhập tay độc lập. |
| Khoản tiền đặt cọc (VNĐ) | **Không có trên `CreateOrderPayload`/bảng `orders`** — đặt cọc là 1 bản ghi riêng trên bảng `deposits` (`deposit_id`, `order_id`, `amount`, `status`, `payment_method`...), tạo qua luồng "yêu cầu cọc" **sau khi Order đã tồn tại**, không phải field khi tạo Order. **Bỏ khỏi form tạo mới** — nếu cần tạo yêu cầu cọc ngay sau khi tạo đơn, đó là 1 lời gọi API riêng (`POST /api/v1/orders/:orderId/deposits`, ngoài phạm vi tài liệu này) sau khi có `orderId` từ response mục 1. |
| Trạng thái đặt cọc / thanh toán | `orders.payment_status` có `DEFAULT 'UNPAID'` — **không nằm trong `CreateOrderPayload`**, được cập nhật sau bởi luồng xác nhận cọc/thanh toán (Manager xác nhận), không phải giá trị người dùng tự chọn lúc tạo đơn. **Bỏ khỏi form tạo mới.** |
| Checkbox "Đã khảo sát hiện trường trước khi tạo đơn" | Không có trường tương ứng trên `Order`/`CreateOrderPayload` — khảo sát là entity riêng (`survey_reports`, có endpoint `GET /orders/:orderId/survey-reports` riêng). Checkbox này chỉ lưu 1 `surveyAssignment` cục bộ trên mock, không có tác dụng thật khi tạo Order. Đề xuất bỏ khỏi modal tạo đơn, để nghiệp vụ khảo sát ở màn Khảo sát riêng. |
| Điều phối viên | **Không có cột nào trên `orders` lưu "người điều phối"** — khái niệm gần nhất trong DB thật là `schedule_plan_assignees` (`plan_id`, `user_id`, `role ENUM('LEAD','TECHNICAL')`) nối qua `schedule_plans.order_id`, tức **nhiều người, có vai trò**, không phải "1 điều phối viên duy nhất" chọn ngay lúc tạo đơn. Việc phân công nhân sự thuộc bước "Lịch trình/Schedule Plan" **sau khi** Order đã tồn tại, không phải field khi tạo Order. **Cần Product xác nhận bỏ hẳn field này khỏi modal tạo đơn** (khuyến nghị) hoặc giữ lại như 1 gợi ý nội bộ không gửi API. |
| Ghi chú | `notes` — khớp, optional, gửi thẳng. |

## 3. Vấn đề kiến trúc nghiêm trọng nhất — modal thiếu hẳn bước nhập `items[]` bắt buộc

`CreateOrderPayload.items` là mảng **bắt buộc, tối thiểu 1 dòng**, mỗi dòng cần `itemId` (UUID thật
trong bảng `items`) + `quantity` + `unitPrice` — nhưng `BookingFormModal.tsx` (modal thật sự đứng sau nút
"Khởi tạo đơn đặt hàng") **hoàn toàn không có UI chọn hạng mục/thiết bị nào**, chỉ có 1 ô nhập tay "Tổng
giá trị dự kiến (VNĐ)".

Route mock `POST /orders` (`mockAdapter.ts` dòng 225-272) đã code sẵn để **nhận** `items` trong payload
và map đúng sang `order_items` thật, nhưng vì modal không gửi `items`, route luôn rơi vào nhánh dự phòng
`buildOrderItems(orderId, totalPrice, payload.location, 'NEW')` (dòng 268) — **tự bịa 4 hạng mục cố định
theo tỷ lệ % của tổng giá trị nhập tay** (Tiệc bàn 55%, Trang trí sảnh 20%, MC & âm thanh 15%, Quay phim
phần còn lại), không phản ánh hạng mục/thiết bị thật khách chọn. Khi nối API thật, backend sẽ nhận đúng
`items: []` (mảng rỗng) từ modal hiện tại và trả lỗi 400 `VALIDATION_ERROR` — **modal không thể tạo đơn
được với backend thật ở trạng thái hiện tại**.

**Khuyến nghị xử lý** (chọn 1 trong 2, cần Product/Backend xác nhận trước khi sửa FE):

- **(A) Thêm bước chọn hạng mục vào chính `BookingFormModal`** — tái dùng đúng pattern "chọn nhanh từ
  danh mục kho thiết bị có sẵn" đã làm ở Bước 2 của `CreateQuotationWizardModal` (xem
  `docs/taobaogiamoi_api.md` mục 1, "Bước 2 — Danh sách hạng mục"): tải `GET /api/v1/catalog/items?status=ACTIVE`
  (không phân trang), nhóm theo danh mục, mỗi dòng bắt buộc gắn `itemId` thật. Ô "Tổng giá trị dự kiến"
  đổi thành **hiển thị tổng tính lại từ các dòng đã chọn** (read-only), không còn là ô nhập tay tự do.
- **(B) Bỏ hẳn luồng "tạo đơn không qua báo giá"** — chuyển hướng nút "Khởi tạo đơn đặt hàng" sang dùng
  lại `CreateOrderPickQuotationModal` + wizard tạo đơn từ báo giá đã duyệt (đã có ở trang chi tiết báo
  giá, đủ bước nhập `eventType`/`eventDate`/`location`/`items[]`) — chỉ tạo được Order từ 1 Quotation đã
  duyệt trước, không tạo đơn "trắng" nữa.

Tài liệu này không tự chọn hướng thay cho Product — **đây là quyết định kiến trúc cần chốt trước khi sửa
FE**, khác các điểm ở mục 2 (đã có thể tự xử lý bằng cách bỏ field khỏi payload).

## 4. Tổng hợp việc cần sửa ở FE khi nối API thật

- **Bắt buộc trước tiên**: giải quyết mục 3 (thêm bước chọn `items[]` hoặc đổi hẳn sang luồng tạo đơn từ
  báo giá) — nếu không, mọi thay đổi khác ở mục 2 cũng không giúp modal gọi `POST /orders` thành công.
- Bỏ khỏi payload gửi lên: `customerName`/`customerPhone` (snapshot dư thừa), `totalPrice`/`totalAmount`
  (backend tự tính), `depositAmount`, `paymentStatus`, `surveyAssignment` (checkbox khảo sát) — tất cả
  không có chỗ nhận trên `CreateOrderPayload`.
- Chờ quyết định Product trước khi giữ/bỏ: "Ngày kết thúc" (`weddingEndDate`, không có cột thật),
  "Điều phối viên" (`coordinatorName`, không có cột thật, cần join `schedule_plan_assignees` nếu giữ),
  "Gói dịch vụ" (map vào `eventType` tự do hay giữ danh sách cố định).
- Đổi dòng subtitle "Mã đơn đặt dự kiến: DD0065" — không tự sinh mã trước khi lưu, `orderCode` thật chỉ
  có sau khi `POST /orders` trả về (mục 1).
- Sau khi lưu thành công: gọi tiếp `GET /api/v1/orders/:orderId` để lấy dữ liệu đầy đủ hiển thị lại (nếu
  cần), không dùng lại object đã nhập ở form làm dữ liệu hiển thị cuối cùng.
- Gọi qua `orderApiService` (`order.service.ts`, cần hàm `createOrder` dùng đúng `POST /orders`) thay vì
  `addAdminOrder()` mock, đúng CLAUDE.md mục 4 ("Mọi gọi API phải đi qua lớp `services/*.service.ts`").
