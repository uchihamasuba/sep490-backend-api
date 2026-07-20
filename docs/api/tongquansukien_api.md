# API cho tab "Tổng quan sự kiện" (trang chi tiết đơn đặt)

> Phạm vi tài liệu này: **chỉ** phần dùng chung của trang chi tiết 1 đơn đặt — header (mã đơn, các badge
> trạng thái, tiêu đề sự kiện, dropdown đổi trạng thái, nút "Hủy đơn hàng"/"Chỉnh sửa đơn đặt"), thanh mốc
> tiến trình 4 bước ("Mốc tiến trình vận hành sự kiện"), và nội dung **tab mặc định "Tổng quan sự kiện"**
> gồm 3 khối: "Hồ sơ thông tin sự kiện", "Hồ sơ khách hàng liên đới", "Phân công khảo sát báo giá" — đúng
> như ảnh mẫu cung cấp. Trang chi tiết này dùng chung layout ở cả `/manager/orders/[id]` và
> `/admin/orders_audit/[id]` (mirror 1:1, chỉ khác tiền tố route).
>
> **Không** bao gồm 5 tab còn lại của cùng trang ("Tiến độ sự kiện", "Thiết bị & Kho hàng", "Lịch trình &
> Kỹ thuật", "Báo giá & Hợp đồng", "Tranh chấp") — mỗi tab cần tài liệu API riêng khi tới lượt triển khai
> vì độ phức tạp nghiệp vụ khác nhau. Nút "Chỉnh sửa đơn đặt" mở lại `BookingFormModal` — payload/response
> đã tài liệu hóa đầy đủ ở [`docs/taodondatlichtiecmoi_api.md`](taodondatlichtiecmoi_api.md), **không lặp
> lại ở đây**.
>
> Nguồn tham chiếu:
> - FE: `src/app/manager/orders/[id]/page.tsx` (dòng 268-662 — header + tab "overview"),
>   `src/app/admin/orders_audit/[id]/page.tsx` (bản mirror), `src/mocks/db/orders.ts` (`AdminOrderRow`,
>   `AdminOrderDetail`, `getAdminOrderDetail()`), `src/mocks/db/approachingEvents.ts`
>   (`getApproachingEventsForOrder()` — nguồn badge "Còn N ngày"), `src/mocks/db/schedulePlans.ts`
>   (`ActivityType`), `src/types/order.ts`, `src/types/customer.ts`, `src/types/survey.ts`,
>   `src/types/schedulePlan.ts`, `src/types/workTask.ts`, `src/services/order.service.ts`,
>   `customer.service.ts`, `survey.service.ts`, `schedulePlan.service.ts`, `workTask.service.ts`,
>   `user.service.ts`, `staff.service.ts`.
> - DB thật: đối chiếu trực tiếp qua MySQL MCP ngày 2026-07-20 — `SHOW TABLES` (24 bảng: `attendances`,
>   `business_policies`, `change_request_items`, `change_requests`, `customers`, `deposits`, `evidences`,
>   `item_categories`, `item_types`, `items`, `notifications`, `order_items`, `orders`, `quotation_items`,
>   `quotations`, `schedule_plan_assignees`, `schedule_plans`, `settlements`,
>   `supplier_transaction_items`, `supplier_transactions`, `suppliers`, `survey_reports`, `users`,
>   `work_tasks`), `SHOW CREATE TABLE orders/customers/survey_reports/schedule_plans/
>   schedule_plan_assignees/deposits/quotations/users/work_tasks`; dữ liệu mẫu thật: 1 order (`ORD-001`,
>   `order_status = CONFIRMED`), 2 customers, và **`work_tasks` chỉ có đúng 2 dòng seed**
>   (`TSK-SETUP` "Lắp đặt thiết bị", `TSK-TEARDOWN` "Tháo dỡ thiết bị") — không có "Khảo sát" hay
>   "Vận chuyển" (xem mục 5, phát hiện quan trọng nhất tài liệu này).
> - `docs/api/` (thư mục CLAUDE.md mục 2 nhắc tới) **không tồn tại trong repo hiện tại** — dùng comment
>   đầu từng file `types/*.ts` (đối chiếu trực tiếp `prisma/schema.prisma`/`*.route.ts`/`*.service.ts` của
>   backend ngày 2026-07-06) làm căn cứ chính, giống các tài liệu trước.

## 0. Base URL & Auth

- Base path: `/api/v1`, JWT Bearer theo `AuthContext` hiện có.
- Trang chi tiết đơn có ở cả Admin (`/admin/orders_audit/[id]`, chỉ xem/audit) và Manager
  (`/manager/orders/[id]`, có quyền thao tác) — theo CLAUDE.md mục 1, nút "Hủy đơn hàng"/dropdown đổi
  trạng thái/"Phân công khảo sát" chỉ nên **cho phép ghi (write) ở phía Manager**; bản Admin nên là
  read-only dù FE hiện chưa phân biệt (2 trang share y hệt component). Cần Product xác nhận có ẩn các nút
  ghi này khỏi bản Admin hay không trước khi gắn quyền `usePermission`.

## 1. Vấn đề định danh — route `id` phải là `order_id` (UUID), không phải `order_code`

Mock hiện dùng **1 field `orderId` duy nhất** (`AdminOrderRow.orderId`, giá trị mẫu `"DD0001"`) vừa làm
khóa định tuyến (`useParams<{ id: string }>()` → `getAdminOrderDetail(id)`) vừa làm chuỗi hiển thị ở tiêu
đề header. Bảng `orders` thật có **2 cột tách biệt**: `order_id` (PK, UUID, vd
`c1cae042-93c9-4e0a-9ce3-673424e8adc9`) và `order_code` (chuỗi hiển thị, unique, vd `ORD-001`) — khớp phát
hiện đã ghi ở `docs/taodondatlichtiecmoi_api.md` mục 1.

**Hệ quả cho trang này**: đường dẫn `/manager/orders/:id` phải điều hướng bằng **`order_id` (UUID) thật**
(vì `GET /api/v1/orders/:id` chắc chắn nhận PK theo chuẩn REST), còn tiêu đề header (`<h1>{row.orderId}</h1>`
trong ảnh mẫu hiển thị `DD0001`) phải đổi sang hiển thị **`orderCode`** (`ORD-001`) lấy từ response, không
phải chính giá trị dùng để điều hướng. Nơi tạo link tới trang này (danh sách đơn, xem
`docs/danhsachdondat_api.md`) cũng phải đổi theo — dùng `orderId` (UUID) làm `href`, `orderCode` làm text
hiển thị.

## 2. Endpoint cần gọi khi mở trang (tab "Tổng quan sự kiện")

| # | Endpoint | Dùng cho | Ghi chú |
|---|---|---|---|
| 1 | `GET /api/v1/orders/:orderId` | Toàn bộ khối "Hồ sơ thông tin sự kiện" + header/badges + mốc tiến trình | **Đã có sẵn** (`orderApiService.getOrder`), trả `OrderDetail` (`types/order.ts` dòng 44-49) — kèm `orderItems`/`orderWarnings`/`deposits`/`settlements` nhưng **không kèm object `customer`** (mục 3). |
| 2 | `GET /api/v1/customers/:customerId` | Khối "Hồ sơ khách hàng liên đới" (Họ tên/Điện thoại/Địa chỉ) | Gọi tiếp sau bước 1, dùng `customerId` lấy từ response bước 1 — xem vấn đề round-trip ở mục 3. |
| 3 | `GET /api/v1/schedule-plans?orderId=:orderId` | Khối "Phân công khảo sát báo giá" | **Không đủ dữ liệu catalog để dùng được** — xem mục 5, phát hiện kiến trúc nghiêm trọng nhất tài liệu này. |
| 4 | `PUT /api/v1/orders/:orderId/status` | Dropdown đổi trạng thái + nút "Hủy đơn hàng" ở header | **Đã có sẵn** (`orderApiService.updateOrderStatus`) — xem mục 6. |

Không cần gọi `GET /api/v1/orders` (danh sách) hay bất kỳ endpoint nào khác cho riêng tab này.

## 3. Ánh xạ "Hồ sơ thông tin sự kiện"

| Trường UI | Nguồn thật (`OrderDetail`, `types/order.ts`) | Ghi chú |
|---|---|---|
| Ngày diễn ra sự kiện | `eventDate` (`orders.event_date`, `timestamp NOT NULL`) | Khớp trực tiếp, dùng `formatDate()`. |
| Ngày kết thúc | **Không có cột thật** (`orders` không có `event_end_date`) | Giống hệt phát hiện ở `docs/taodondatlichtiecmoi_api.md` mục 2 — `event_date` chỉ là **1 mốc timestamp duy nhất**, không có khoảng ngày. **Cần Product xác nhận**: (a) bỏ hẳn ô "Ngày kết thúc" khỏi tab này cho tới khi có yêu cầu sự kiện đa ngày thật, hay (b) yêu cầu Backend thêm cột `event_end_date`. Không tự thêm field ở FE. |
| Khách mời dự kiến | `guestCount` (`orders.guest_count`, `int DEFAULT NULL`) | Optional ở backend — UI cần xử lý trường hợp `null` (hiện mock luôn có số, chưa test case rỗng). |
| Địa điểm tổ chức | `location` (`orders.location`, `text NOT NULL`) | Khớp trực tiếp — cột thật là 1 field text tự do, không tách "sảnh/tên venue" riêng như `AdminOrderRow.venue` (mock) ngụ ý; giữ nguyên 1 field. |
| Mô tả và dặn dò đặc biệt | `notes` (`orders.notes`, nullable) | Khớp trực tiếp — hiển thị "Không có ghi chú gì thêm." khi `null`/rỗng như UI hiện tại đã làm. |
| Tiêu đề "Lễ cưới Nguyễn Minh Trí" (subtitle header) | `eventName` (`orders.event_name`, `varchar(255) DEFAULT NULL`) | **Khác mock** — mock tự ghép chuỗi `Lễ cưới ${customerName}` (`getAdminOrderDetail()` dòng 552) thay vì đọc cột thật. Cột thật **có thể `null`** (không bắt buộc khi tạo đơn qua `CreateOrderPayload`) — cần fallback hiển thị (vd `eventType` hoặc "Chưa đặt tên sự kiện") khi `eventName` rỗng, không tự suy ra từ tên khách hàng. |

## 4. Ánh xạ "Hồ sơ khách hàng liên đới"

| Trường UI | Nguồn thật (`Customer`, `types/customer.ts`) | Ghi chú |
|---|---|---|
| Họ tên | `customerName` (`customers.customer_name`) | Cần gọi riêng `GET /customers/:customerId` — xem vấn đề dưới. |
| Điện thoại | `phone` (`customers.phone`) | Khớp trực tiếp. |
| Địa chỉ | `address` (`customers.address`, nullable) | Khớp trực tiếp — cần fallback khi `null`. |

**Vấn đề round-trip 2 lời gọi**: `OrderDetail` (endpoint #1 mục 2) chỉ trả `customerId` (chuỗi UUID), **không
kèm object khách hàng lồng bên trong** — khác với `AdminOrderDetail` mock hiện tại vốn đã tự ghép sẵn
`customerAddress`/`customerEmail` một lần. FE bắt buộc gọi thêm `GET /api/v1/customers/:customerId` sau khi
có response #1 mới hiển thị đủ khối này. **Đề xuất** (cần Backend xác nhận trước khi FE code theo hướng
nào): thêm `customer: { customerName, phone, address }` lồng sẵn trong response `GET /orders/:id` để giảm 1
round-trip — hợp lý vì khối "Hồ sơ khách hàng liên đới" luôn hiển thị cùng lúc với chi tiết đơn, không có
trường hợp cần đơn mà không cần thông tin khách. Nếu Backend không muốn đổi response chung, FE chấp nhận gọi
2 lần tuần tự.

## 5. "Phân công khảo sát báo giá" — vấn đề kiến trúc nghiêm trọng nhất

UI hiện tại (nút "Phân công"/"Đổi phân công") cho phép Manager chọn 1 người phụ trách + ngày + giờ + ghi
chú để **lên lịch một buổi khảo sát trong tương lai**, lưu tạm trên `AdminOrderRow.surveyAssignment` (mock,
1 object đơn: `{ assigneeName, date, time, notes }`). Đối chiếu DB thật, khái niệm này **không có bảng nào
mô hình hóa đúng nghĩa** vì 2 lý do:

1. **`survey_reports` là bảng ghi KẾT QUẢ đã khảo sát xong, không phải bảng phân công trước.** Cột
   `survey_reports.reported_by` là người đã nộp báo cáo (thực hiện xong), `confirmed_by`/`confirmed_at` là
   Manager xác nhận sau đó — không có khái niệm "sẽ cử ai đi khảo sát lúc mấy giờ ngày nào" trước khi việc
   diễn ra. Ngoài ra `GET /survey-reports/:id` **không join tên người khảo sát** (chỉ trả ID thô, xem
   comment đầu `types/survey.ts`), nên kể cả khi có report cũng không tự lấy được `assigneeName` để hiển
   thị như UI.
2. **`schedule_plans` + `schedule_plan_assignees` là khái niệm gần đúng nhất cho "phân công trước" nhưng
   thiếu catalog** — 1 `schedule_plans` row cần `task_id NOT NULL` trỏ tới `work_tasks` (loại công việc), và
   người được giao nằm ở bảng phụ `schedule_plan_assignees` (`plan_id`, `user_id`, `role ENUM('LEAD',
   'TECHNICAL')` — **nhiều người/vai trò**, không phải 1 `assigneeName` duy nhất như mock). Vấn đề: bảng
   `work_tasks` thật **chỉ seed đúng 2 dòng** — `"Lắp đặt thiết bị"` (`TSK-SETUP`) và `"Tháo dỡ thiết bị"`
   (`TSK-TEARDOWN`) — **không có dòng nào cho "Khảo sát"** (hay "Vận chuyển", loại hoạt động khác mock cũng
   dùng ở tab "Lịch trình & Kỹ thuật", ngoài phạm vi tài liệu này nhưng cùng gốc vấn đề). `work_tasks` là
   "danh mục tĩnh, không có route tạo/sửa/xóa phía FE" (comment `types/workTask.ts`) — nghĩa là FE **không
   thể tự tạo** dòng "Khảo sát" này được, phải chờ Backend seed thêm.

**Kết luận**: khối "Phân công khảo sát báo giá" **chưa thể nối API thật** ở trạng thái hiện tại của DB.

**Cập nhật 2026-07-20 — đã chốt hướng (A)** (quyết định đưa ra khi viết tài liệu cho tab "Tiến độ sự
kiện", xem [`docs/tiendosukien_api.md`](tiendosukien_api.md) mục 3.2 và mục 9.1 — áp dụng chung cho cả 2
tab vì cùng phụ thuộc 1 nguồn dữ liệu `surveyAssignment`): seed thêm `work_tasks` row "Khảo sát hiện
trường" (và "Vận chuyển" nếu tab Lịch trình cần), dùng đúng flow `schedule_plans` +
`schedule_plan_assignees` thật cho việc phân công, `survey_reports` cho kết quả/xác nhận đã khảo sát —
**không** đi theo hướng (B) bỏ khối này khỏi tab Tổng quan. Lý do: giữ được đúng luồng thao tác đang có
trên UI (Manager phân công trước, xác nhận sau ở cả 2 tab) mà không phải thiết kế lại điều hướng, và chi
phí triển khai thấp hơn hẳn (chỉ cần Backend seed 1-2 dòng `work_tasks` tĩnh). Chi tiết 2 hướng đã cân
nhắc (giữ nguyên bên dưới để tham khảo bối cảnh quyết định):

- **(A) Seed thêm `work_tasks` row "Khảo sát hiện trường"** (và "Vận chuyển" nếu tab Lịch trình cũng cần) —
  khi đó luồng phân công dùng đúng flow đã có sẵn: `POST /api/v1/schedule-plans` (`taskId` = ID dòng khảo
  sát mới, `orderId`, `startTime` = ngày+giờ gộp lại thành 1 ISO timestamp, `location`, `notes`) để tạo lịch,
  sau đó `POST` (endpoint chưa có ở `schedulePlanApiService`, cần bổ sung — tương đương thêm 1 dòng
  `schedule_plan_assignees`) để gán người phụ trách theo `user_id` (lấy danh sách ứng viên qua
  `GET /api/v1/users?role=LEADER` hoặc `role=TECHNICAL`, `userApiService.getUsers` đã có sẵn). Khối hiển thị
  đọc lại qua `GET /api/v1/schedule-plans?orderId=:id`, lọc `taskName === 'Khảo sát hiện trường'`, lấy tên
  người phụ trách từ assignee (cần Backend join thêm tên user trong response, hiện `SchedulePlan.assigneeName`
  ở `types/schedulePlan.ts` dòng 26 giả định "join thêm khi GET" nhưng chưa rõ có áp dụng được cho mô hình
  nhiều-assignee/role hay không — model 1-plan-1-người mà comment đầu file mô tả **không khớp** bảng
  `schedule_plan_assignees` thật (many-to-many có `role`), cần Backend làm rõ lại type `SchedulePlan` trước).
- **(B) Bỏ hẳn khối "Phân công khảo sát báo giá" khỏi tab Tổng quan** — chuyển toàn bộ luồng khảo sát
  (phân công lẫn xem kết quả) sang 1 màn/khu vực "Khảo sát" riêng dùng đúng `survey_reports` +
  `surveyApiService` đã có, chỉ hiển thị **kết quả đã nộp** (nếu có) ở tab Tổng quan dưới dạng tóm tắt
  read-only, không có bước "phân công trước" trên web nữa (có thể việc cử người khảo sát diễn ra ngoài hệ
  thống, chỉ ghi nhận báo cáo sau khi xong).

Tài liệu này không tự chọn hướng — đây là quyết định kiến trúc cần chốt trước khi sửa FE, tương tự cách xử
lý ở `docs/danhsachhopdong_api.md` mục 1.

## 6. Nút hành động trên header

| Hành động UI | Endpoint | Payload | Ghi chú |
|---|---|---|---|
| Dropdown đổi trạng thái (Mới/Đã xác nhận/Đang thực hiện/Hoàn thành) | `PUT /api/v1/orders/:orderId/status` | `{ "orderStatus": "CONFIRMED" }` (`UpdateOrderStatusPayload`) | **Đã có sẵn** (`orderApiService.updateOrderStatus`). Dropdown hiện loại bỏ `CANCELLED` khỏi danh sách chọn (đúng, vì hủy đơn có nút riêng) — giữ nguyên hành vi này. |
| Nút "Hủy đơn hàng" | `PUT /api/v1/orders/:orderId/status` | `{ "orderStatus": "CANCELLED", "cancelReason": "..." }` | Payload thật **có** field `cancelReason` (optional) nhưng UI hiện chỉ có `confirm()` (dòng 310-314), không có ô nhập lý do hủy — nên bổ sung 1 ô nhập lý do trước khi gửi, tận dụng đúng field đã có sẵn ở backend thay vì bỏ trống. |
| Nút "Chỉnh sửa đơn đặt" | Xem `docs/taodondatlichtiecmoi_api.md` | — | Ngoài phạm vi tài liệu này — đã tài liệu hóa đầy đủ ở file kia (cùng modal `BookingFormModal`, chỉ đổi tiêu đề khi có `orderId` sẵn). |
| Badge "Tổ chức sự kiện · Còn N ngày" | Không gọi API riêng | — | Tính hoàn toàn phía client từ `eventDate` (endpoint #1) so với ngày hiện tại — giữ nguyên cách tính client-side, không cần endpoint mới. |
| Badge "Đã đóng đơn" / khóa chỉnh sửa khi đã đóng | **Không có cột thật** (`orders` không có `closed_at`/`closed_by`) | — | Mock có `AdminOrderRow.closedAt`/`closedBy` cho nút "Đóng đơn hàng" (tab Tiến độ, ngoài phạm vi tab này) nhưng **DB thật không có cột lưu trạng thái đóng đơn** — badge này ở header sẽ không bao giờ hiển thị được với backend hiện tại. Ghi nhận ở đây vì badge nằm ở phần header dùng chung, nhưng quyết định xử lý (thêm cột hay bỏ khái niệm "đóng đơn") thuộc phạm vi tab "Tiến độ sự kiện" — nêu lại khi viết tài liệu cho tab đó. |

## 7. Tổng hợp việc cần chốt trước khi nối API thật

1. **Bắt buộc trước tiên**: chọn hướng (A) hoặc (B) ở mục 5 cho khối "Phân công khảo sát báo giá" — nếu
   không, khối này không thể hiển thị/thao tác được với dữ liệu thật.
2. Xác nhận với Backend: có nên thêm `customer` lồng sẵn vào `GET /orders/:id` (mục 3) hay FE chấp nhận gọi
   2 API tuần tự.
3. Sửa route `/manager/orders/[id]`, `/admin/orders_audit/[id]` và mọi nơi tạo link tới đây để dùng
   `order_id` (UUID) làm tham số điều hướng, `orderCode` chỉ dùng để hiển thị (mục 1).
4. Chờ quyết định Product: giữ/bỏ ô "Ngày kết thúc" (mục 3) — không có cột `event_end_date` thật.
5. Đổi tiêu đề header từ tự ghép `Lễ cưới ${customerName}` sang đọc thẳng `eventName` (có fallback khi
   `null`) — mục 3.
6. Bổ sung ô nhập lý do khi bấm "Hủy đơn hàng" để tận dụng field `cancelReason` đã có sẵn ở backend — mục 6.
7. Gọi API qua đúng lớp `services/*.service.ts` đã có (`orderApiService`, `customerApiService`,
   `schedulePlanApiService`, `userApiService`) theo CLAUDE.md mục 4, không tạo lời gọi `axios`/`fetch` mới
   trong component.
