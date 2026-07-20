# API cho màn "Kế hoạch và phân công" (`/manager/schedule/plans`)

> Phạm vi tài liệu này: trang danh sách **tổng hợp đa đơn hàng** "Kế hoạch và phân công" —
> 3 tab **Lịch điều phối** (calendar tháng + panel "Lịch ngày"), **Lịch timeline** (10 ngày, xếp theo
> hàng ngang từng đơn), **Danh sách kế hoạch** (bảng), banner cảnh báo "sắp diễn ra" ở đầu trang, drawer
> **Lập/Sửa kế hoạch** (`PlanFormDrawer`), drawer **Chi tiết kế hoạch** (`PlanDetailDrawer`) và modal xóa
> kế hoạch — đúng như ảnh mẫu cung cấp. Trang dùng chung layout ở cả `/manager/schedule/plans` và
> `/admin/coordination/planning` (mirror 1:1, theo comment đầu `src/app/manager/schedule/plans/page.tsx`
> dòng 29-33 — không phân tích lại riêng bản Admin).
>
> **Không** bao gồm: tab "Lịch trình & Kỹ thuật" ở trang chi tiết 1 đơn đặt (đã có tài liệu riêng
> [`docs/lichtrinhkythuat_api.md`](lichtrinhkythuat_api.md) — tài liệu đó đã phân tích sâu cùng 2 bảng
> DB thật `schedule_plans`/`schedule_plan_assignees` dùng lại ở đây, **không lặp lại phân tích gốc**, chỉ
> áp dụng/mở rộng cho phạm vi màn tổng hợp đa đơn); và trang "Công việc (Work Task)"
> (`/manager/schedule/tasks`, danh sách phẳng `getAllAdminWorkTasks()`) — trang đó có model UI riêng
> (Kanban theo trạng thái), chưa có tài liệu API, ngoài phạm vi ở đây.
>
> Nguồn tham chiếu:
> - FE: `src/app/manager/schedule/plans/page.tsx` (toàn bộ — 3 tab, banner sắp diễn ra dòng 98-112, state
>   calendar/timeline/list), `src/components/planning/PlanFormDrawer.tsx` (form 4 section: chọn đơn/báo
>   giá, hoạt động điều phối, nhân sự phối hợp, phân công việc chi tiết), `src/components/planning/
>   PlanDetailDrawer.tsx` (drawer chi tiết), `src/mocks/db/schedulePlans.ts` (toàn bộ — nguồn dữ liệu
>   DUY NHẤT của màn này: `SchedulePlan`/`PlanActivity`/`PlanWorkTask`/`PlanStaffMember`/`ActivityType`/
>   `TaskStatus`/`PLANNING_STAFF_POOL`/`getPlanStatusInfo`/`getUnplannedOrders`/`getUnplannedQuotations`),
>   `src/mocks/db/approachingEvents.ts` (banner "sắp diễn ra"), `src/utils/eventDate.ts`, `src/types/
>   schedulePlan.ts`, `src/types/workTask.ts`, `src/types/user.ts`, `src/services/schedulePlan.service.ts`,
>   `workTask.service.ts`, `user.service.ts`, `order.service.ts`.
> - DB thật: đối chiếu trực tiếp qua MySQL MCP ngày 2026-07-20 (cùng phiên với
>   `docs/lichtrinhkythuat_api.md`) — `SHOW CREATE TABLE schedule_plans/schedule_plan_assignees/
>   work_tasks/orders/users/customers/quotations/evidences`; dữ liệu mẫu thật **giống hệt** phiên trước
>   (chưa có thay đổi): 1 order (`ORD-001`, `order_status = CONFIRMED`), 1 `schedule_plans`
>   (`PLN-001`, `task_id → "Lắp đặt thiết bị"`, `status = IN_PROGRESS`), 2 `schedule_plan_assignees`
>   (1 `LEAD`, 1 `TECHNICAL`), `work_tasks` chỉ 2 dòng (`TSK-SETUP`/`TSK-TEARDOWN`), 4 `users`
>   (admin/manager/leader/tech, mỗi role đúng 1 người), 1 `quotations` (`status = DRAFT` hoặc tương ứng).
> - Enum `order_status` thật (`NEW`/`CONFIRMED`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED`) đã được xác nhận ở
>   [`docs/danhsachdondat_api.md`](danhsachdondat_api.md) mục 1 — dùng lại, không đối chiếu lại ở đây.
> - `docs/api/` **không tồn tại trong repo hiện tại** — dùng comment đầu từng file `types/*.ts` (đối
>   chiếu `prisma/schema.prisma`/`*.route.ts`/`*.service.ts` backend) làm căn cứ chính, giống các tài
>   liệu trước.

## 0. Base URL & Auth

Base path `/api/v1`, JWT Bearer theo `AuthContext` hiện có — giống mọi tài liệu khác trong `docs/`.

## 1. Phát hiện cốt lõi: "kế hoạch" (mock) không phải 1 entity lưu trữ thật

Đây là phát hiện quan trọng nhất, quyết định gần như toàn bộ phần còn lại của tài liệu — **kế thừa và mở
rộng** phát hiện đã ghi ở `docs/lichtrinhkythuat_api.md` mục 1-2 (đã xác nhận `schedule_plans` thật = 1
order + 1 task_id, không phải 1 "kế hoạch" chứa nhiều hoạt động/công việc con), áp dụng cho **toàn bộ**
màn hình này chứ không riêng 1 tab.

| | Mock (`SchedulePlan`, `db/schedulePlans.ts`) | DB thật |
|---|---|---|
| Đơn vị lưu trữ | 1 object `SchedulePlan` = 1 mã `KHOP-2026-xxxx`, chứa **lồng** `activities: PlanActivity[]` (4 loại: Khảo sát/Vận chuyển/Lắp đặt/Thu hồi) + `tasks: PlanWorkTask[]` (việc kỹ thuật tự do, có `assignee`+`team[]` riêng) + `staffList: PlanStaffMember[]` (nhân sự tham gia chung cả kế hoạch) | Bảng `schedule_plans` **phẳng** — 1 dòng = 1 `order_id` + 1 `task_id` (FK bắt buộc tới `work_tasks`) + `start_time`/`end_time` + `status` + `notes` + `evidence_id` (1-1). Không có cột nào gộp nhiều dòng lại thành 1 "kế hoạch". |
| Người phụ trách | `staffList[]` (chung cả kế hoạch) + mỗi `task` có thêm `assignee`(1 tên)+`team[]`(tên phụ) riêng — **3 nguồn khác nhau** cho "ai làm gì" | `schedule_plan_assignees` — nhiều dòng/`plan_id`, mỗi dòng 1 `user_id` + `role` (chỉ 2 giá trị: `LEAD`/`TECHNICAL`) |
| Trạng thái | `plan.status`: `DRAFT`\|`CONFIRMED` (mức kế hoạch) — **cộng thêm** `task.status`: `TODO`\|`ASSIGNED`\|`IN_PROGRESS`\|`COMPLETED`\|`BLOCKED` (mức từng task) → `getPlanStatusInfo()` tổng hợp 2 tầng này thành 4 nhãn hiển thị (Chuẩn bị/Đã chốt/Đang thực hiện/Hoàn thành) | Mỗi dòng `schedule_plans` chỉ có **1** cột `status` (`PENDING`\|`CONFIRMED`\|`IN_PROGRESS`\|`COMPLETED`\|`CANCELLED`) — không có khái niệm 2 tầng, không có `TODO`/`ASSIGNED`/`BLOCKED`. |
| Mã hiển thị | `id` tự sinh `KHOP-2026-0001...` | **Không có cột tương ứng** — `plan_code` (`PLN-001`) là mã của **1 dòng** `schedule_plans`, không phải mã của cả nhóm nhiều dòng cùng đơn. |

**Kết luận dùng cho toàn bộ tài liệu**: 1 "kế hoạch" hiển thị trên UI (calendar/timeline/danh sách/drawer
chi tiết) tương ứng với **nhiều dòng `schedule_plans` có cùng `order_id`** — không tồn tại như 1 bản ghi
lưu trữ riêng. Mọi endpoint đọc cho màn này đều phải **group theo `order_id` phía client (hoặc backend
join sẵn)** sau khi lấy về danh sách phẳng `schedule_plans`, không có 1 "GET kế hoạch theo ID" nào trả
thẳng cấu trúc lồng như mock.

## 2. Danh mục loại việc (`work_tasks`) — thiếu hầu hết loại UI đang cần

Áp dụng lại nguyên phát hiện đã chốt ở `docs/lichtrinhkythuat_api.md` mục 5/10.1 điểm 3 (seed thêm
"Khảo sát hiện trường", "Vận chuyển thiết bị"), và bổ sung thêm 1 vấn đề **riêng của màn này**: Section 4
("Phân công việc chi tiết") trong `PlanFormDrawer` cho nhập **tiêu đề việc tự do** (`taskTitle`, ví dụ
"Lắp dựng sân khấu & backdrop", "Trang trí sảnh tiệc", "Kiểm tra âm thanh ánh sáng", "Thu hồi thiết bị
sau tiệc") — đây **không phải** tên lấy từ danh mục `work_tasks`, mà là text tự nhập không giới hạn.
`schedule_plans.task_id` là FK **bắt buộc** tới `work_tasks` (danh mục tĩnh, chỉ GET, không có
create/update/delete phía FE theo comment `types/workTask.ts` dòng 4) — không thể lưu tiêu đề tự do vào
đó.

**Đề xuất** (cần Backend/Product xác nhận): dùng `task_id` để chọn **loại việc lớn** (từ danh mục đã seed
mở rộng — Khảo sát/Vận chuyển/Lắp đặt/Thu hồi...), còn nội dung cụ thể ("Lắp dựng sân khấu & backdrop")
ghi vào cột `schedule_plans.notes` (đã có sẵn, kiểu `text`) thay vì cần thêm cột tiêu đề việc riêng — bỏ
hẳn khái niệm "tên việc tự do không giới hạn danh mục" ở UI, đổi Section 4 thành: chọn loại việc (dropdown
từ `work_tasks`) + ô mô tả chi tiết (map vào `notes`) thay vì ô nhập tên việc tự do.

## 3. Tab "Lịch điều phối" — nguồn field

| Field UI | Nguồn thật | Ghi chú |
|---|---|---|
| Chấm/badge mã đơn trên ô ngày lịch tháng | Group `schedule_plans` theo `DATE(start_time)` (và `DATE(end_time)` nếu qua đêm — mock coi 1 activity nằm ở ngày `date` đơn, giờ `endTime` có thể là "YYYY-MM-DD HH:mm" nếu qua đêm, xem comment `PlanActivity.endTime` dòng 37) | Cần lấy **toàn bộ** `schedule_plans` rơi vào tháng đang xem, không lọc theo 1 `orderId` — khác hẳn cách dùng `orderId` query ở `docs/lichtrinhkythuat_api.md` (tab đó luôn có 1 đơn cụ thể). |
| "Lịch ngày DD/MM/YYYY" — 1 thẻ sự kiện/đơn | 1 nhóm `schedule_plans` cùng `order_id`, lọc còn các dòng rơi vào đúng ngày được chọn | Giờ bắt đầu/kết thúc hiển thị = `MIN(start_time)`/`MAX(end_time)` của các dòng cùng đơn trong ngày đó (mock lấy `dayActivities[0].startTime`/`dayActivities.at(-1).endTime` — cùng ý tưởng, chỉ đổi nguồn). |
| Mã đơn (`p.orderId`, badge xanh) | `orders.order_code` | Khớp trực tiếp. |
| Tên sự kiện (`p.eventName`) | `orders.event_name` | **Tốt hơn mock**: mock tự dựng chuỗi `Lễ cưới ${customerName}` (dòng 154 `db/schedulePlans.ts`) vì không biết cột `event_name` đã có sẵn trên `orders` — dùng thẳng cột thật, không cần tự ghép chuỗi nữa. |
| Địa điểm (`p.location`) | `orders.location` (mức đơn) — hoặc `schedule_plans.location` (mức từng dòng, cụ thể hơn, vd "Kho trung tâm → {venue}" cho hoạt động vận chuyển) | 2 nguồn khác nhau, cần chọn rõ hiển thị cái nào ở panel tổng hợp — đề xuất dùng `orders.location` cho dòng địa điểm chung của thẻ, còn `schedule_plans.location` của từng dòng con hiển thị trong drawer chi tiết (mục 6). |
| "Chỉ huy: {tên} (N nhân sự)" | **Không có cột `coordinatorName`/tương đương trên `orders`** — bảng `orders` không có cột người phụ trách hiện trường | Mock đọc `order.coordinatorName` (field không tồn tại trong `orders` thật — bảng `orders` chỉ có `created_by`, là người **tạo đơn**, không phải người **chỉ huy thi công**). Cần đổi nguồn: lấy `user` có `schedule_plan_assignees.role = 'LEAD'` trong nhóm dòng của đơn đó ngày hôm đó — nếu nhiều dòng có LEAD khác nhau (vd LEAD khảo sát khác LEAD lắp đặt), cần quyết định hiển thị LEAD của dòng nào (đề xuất: LEAD của dòng có `start_time` sớm nhất trong ngày). "N nhân sự" = `COUNT(DISTINCT assignee.user_id)` toàn bộ dòng của đơn trong ngày đó. |
| Trạng thái/màu chấm (Chuẩn bị/Đã chốt/Đang thực hiện/Hoàn thành) | Suy từ tập `status` của các dòng `schedule_plans` cùng đơn | Xem thuật toán đề xuất ở mục 7 — không có cột `plan.status` 2 tầng như mock. |

## 4. Tab "Lịch timeline"

Cùng nguồn dữ liệu và cách group theo `order_id` như mục 3, nhưng hiển thị dạng **1 thanh ngang liên tục**
từ ngày sớm nhất đến ngày muộn nhất trong số các dòng `schedule_plans` của đơn đó (mock tính qua
`planDateRange()` — lấy min/max `activities[].date`, `page.tsx` dòng 62-67). Áp dụng y hệt với dữ liệu
thật: `rangeStart = MIN(DATE(start_time))`, `rangeEnd = MAX(DATE(end_time))` trong tập dòng
`schedule_plans` cùng `order_id` — không đổi gì về công thức, chỉ đổi nguồn từ `activities[]` sang tập
dòng phẳng.

Click vào thanh mở `PlanDetailDrawer` — dùng lại đúng dữ liệu đã group ở mục 3, không gọi thêm API.

## 5. Tab "Danh sách kế hoạch"

| Cột | Nguồn thật | Ghi chú |
|---|---|---|
| Mã kế hoạch (`KHOP-2026-xxxx`) | **Không có cột thật** | Tự sinh phía client theo `order_id` (ví dụ dùng thẳng `order_code` làm khóa nhóm, bỏ hẳn khái niệm mã `KHOP-*` riêng) — tương tự cách `docs/lichtrinhkythuat_api.md` mục 1 xử lý mã thẻ `LICH-xxx` (không cần Backend sinh mã). |
| Mã đơn đặt | `orders.order_code` | Khớp trực tiếp. |
| Khách hàng / Tiệc cưới | `customers.customer_name` (join qua `orders.customer_id`) + `orders.event_name` | Khớp trực tiếp, tốt hơn mock (mục 3). |
| Ngày thi công | `MIN(start_time)`–`MAX(end_time)` nhóm theo đơn (mục 4) | — |
| Địa điểm | `orders.location` | — |
| Số công việc | `COUNT(schedule_plans)` nhóm theo đơn | Mock chỉ đếm `plan.tasks.length` (bỏ qua `activities.length`) — với dữ liệu thật, "hoạt động" và "công việc" không còn là 2 khái niệm tách biệt (mục 1), nên đếm **toàn bộ** số dòng `schedule_plans` của đơn, không tách riêng 2 loại như mock. |
| Nhân sự | `COUNT(DISTINCT schedule_plan_assignees.user_id)` nhóm theo đơn | — |
| Trạng thái | Suy từ tập `status` các dòng — xem mục 7 | Bộ lọc dropdown hiện chỉ có `ALL`\|`DRAFT`\|`CONFIRMED` (2 giá trị) — cần viết lại theo enum thật 5 giá trị (mục 7). |
| Nút Xem/Sửa/Xóa | Xem mục 6, 8 | — |

## 6. Endpoint đọc — cần bổ sung so với `GetSchedulePlansQuery` hiện có

`types/schedulePlan.ts` hiện chỉ hỗ trợ `page`, `limit`, `orderId`, `assignedTo`, `status`, `date` (khớp
đúng **1 ngày** `YYYY-MM-DD`). Với màn hình này — hiển thị đồng thời **nhiều đơn** trong 1 khoảng ngày
(cả tháng cho tab lịch, 10 ngày cho tab timeline) — cần bổ sung, **đề xuất mới, chưa có trong type hiện
tại**:

1. **`dateFrom`/`dateTo`** (thay vì chỉ `date` đơn) — để 1 lần gọi lấy đủ dữ liệu cho cả tháng/cả cửa sổ
   10 ngày, tránh gọi lặp lại từng ngày. Không tìm thấy dấu hiệu param này đã tồn tại phía backend (chỉ
   suy từ tên cột `idx_schedule_plans_start` — có index trên `start_time`, khả thi để thêm range query).
2. **Không truyền `orderId`** (để trống) phải trả về **toàn bộ đơn** trong khoảng ngày — cần Backend xác
   nhận query builder hiện tại có cho phép bỏ trống `orderId` hay đang coi đây là param bắt buộc.
3. **Join sẵn thông tin đơn/khách hàng vào từng dòng response** — `orderCode`, `customerName`,
   `eventName`, `orderLocation` — khác với `docs/lichtrinhkythuat_api.md` (tab đó luôn ở trong ngữ cảnh
   1 trang chi tiết đơn nên không cần join, đã có sẵn thông tin đơn ở nơi khác trên trang). Màn **này**
   hiển thị nhiều đơn cùng lúc không có trang chi tiết bao quanh, nên **bắt buộc** phải có các field trên
   ngay trong response `GET /schedule-plans`, nếu không FE phải gọi thêm N lần `GET /orders/:id` — N+1,
   không chấp nhận được cho 1 trang lịch/danh sách.
4. **`taskName`** (join `work_tasks.task_name`) và **`assignees: { userId, fullName, role, phone }[]`**
   (join `schedule_plan_assignees` → `users`) — **đã chốt hướng** ở `docs/lichtrinhkythuat_api.md` mục 4
   /10.1 điểm 8-9, dùng lại nguyên, không phân tích lại.

## 7. Trạng thái tổng hợp cho 1 nhóm "kế hoạch" (nhiều dòng cùng đơn) — đề xuất thuật toán

Vì DB không có cột trạng thái ở mức "kế hoạch" (mục 1), badge trạng thái hiển thị ở cả 3 tab đều phải
**tự suy từ tập `status` của các dòng `schedule_plans` cùng `order_id`** (trong phạm vi đang xét — ví dụ
trong ngày với tab lịch, hoặc toàn bộ đơn với tab danh sách). **Đây là đề xuất của tài liệu này, chưa
được Backend/Product xác nhận** — cần chốt trước khi implement:

| # | Điều kiện tập `status` (loại trừ `CANCELLED` trước khi xét, trừ case 1) | Nhãn hiển thị đề xuất |
|---|---|---|
| 1 | Tất cả dòng đều `CANCELLED` | "Đã hủy" (nhãn/màu mới — mock hiện chưa có) |
| 2 | Tất cả dòng còn lại đều `PENDING` | "Chuẩn bị" (giữ đúng nhãn mock cho `DRAFT`) |
| 3 | Có ít nhất 1 dòng `IN_PROGRESS` | "Đang thực hiện" |
| 4 | Không có `IN_PROGRESS`, có ít nhất 1 `CONFIRMED` và ít nhất 1 `COMPLETED` (hỗn hợp) | "Đang thực hiện" (đã bắt đầu 1 phần) |
| 5 | Tất cả dòng còn lại đều `COMPLETED` | "Hoàn thành" |
| 6 | Tất cả dòng còn lại đều `CONFIRMED` (chưa dòng nào bắt đầu) | "Đã chốt" |

So với `getPlanStatusInfo()` gốc (`db/schedulePlans.ts` dòng 104-119): giữ đúng 4 nhãn cũ (Chuẩn
bị/Đã chốt/Đang thực hiện/Hoàn thành), bổ sung thêm case "Đã hủy" cho `CANCELLED` (enum thật có, mock
không xử lý — đúng khoảng trống đã nêu ở `docs/lichtrinhkythuat_api.md` mục 3).

## 8. Drawer "Lập/Sửa kế hoạch" (`PlanFormDrawer`) — 4 section, đối chiếu từng phần

### 8.1 Section 1 — Chọn đơn đặt/báo giá

- Nguồn danh sách "chưa có kế hoạch": `GET /api/v1/orders` (đã có sẵn, `orderApiService.getOrders`), lọc
  phía client các đơn **chưa có dòng `schedule_plans` nào** (đối chiếu chéo với kết quả `GET
  /schedule-plans` không lọc `orderId`) — số lượng đơn hiện tại nhỏ, không cần Backend thêm filter riêng
  kiểu `hasSchedulePlan=false`.
- **`quotationOrderOption` — "đơn đặt ảo" từ báo giá chưa duyệt (lập lịch khảo sát sớm) — đã chốt hướng
  (A), CHƯA IMPLEMENT ĐƯỢC (chờ Backend sửa database)**: `schedule_plans.order_id` là FK **`NOT NULL`**
  trỏ thẳng `orders.order_id` (không có cột thay thế trỏ `quotations.quotation_id`), trong khi vòng đời
  Order ở CLAUDE.md mục 1 mô tả **Request → Survey → Quotation → mới có Order** — nghĩa là tại thời điểm
  cần lên lịch khảo sát, `order_id` thật **chưa tồn tại**. Đây là mâu thuẫn kiến trúc, không phải chỗ đổi
  tên field.

  **Đã chốt (2026-07-20): hướng (A) — đổi schema**, thay vì hướng (B) đổi quy trình tạo `orders` sớm hơn
  (đảo ngược thứ tự Request→Survey→Quotation→Order đang mô tả ở CLAUDE.md mục 1 — không chọn vì ảnh hưởng
  toàn bộ state machine `OrderStatus`, vốn đã ghi nhận nhiều bất đồng bộ khác ở `docs/
  danhsachdondat_api.md`, không nên đảo thêm 1 tầng nghiệp vụ nữa chỉ để phục vụ 1 luồng phụ). Chi tiết
  hướng (A): thêm cột `schedule_plans.quotation_id` (nullable, FK → `quotations.quotation_id`) song song
  `order_id` (nới `order_id` thành nullable), ràng buộc **đúng 1 trong 2 cột có giá trị** ở tầng ứng dụng
  (không enforce được bằng constraint SQL thường, cần CHECK constraint hoặc validate ở service layer).

  **Trạng thái: API cho luồng này chưa làm được** — cần Backend đổi migration/schema trước (thêm cột
  `quotation_id`, nới `order_id` nullable, cập nhật `CreateSchedulePlanPayload` nhận 1 trong 2
  `orderId`/`quotationId`) rồi mới viết được endpoint thật. Đã ghi yêu cầu bổ sung này vào
  [`docs/more-require.md`](more-require.md) mục (a) — xem thêm mục 12 cuối tài liệu này.

### 8.2 Section 2 — Hoạt động điều phối (`activities[]`)

Mỗi hoạt động (Khảo sát/Vận chuyển/Lắp đặt/Thu hồi, ngày, giờ, địa điểm, ghi chú) = **1 dòng
`schedule_plans` riêng** khi lưu (mục 1) — không có 1 request duy nhất lưu cả mảng lồng trong 1 "kế
hoạch". `POST /api/v1/schedule-plans` (đã có sẵn, `CreateSchedulePlanPayload`) chỉ nhận **1 dòng/lần
gọi**.

### 8.3 Section 3 — Lựa chọn nhân sự phối hợp (`PLANNING_STAFF_POOL`)

Mock có đúng **5 người cố định**, mỗi người gắn 1 "vai trò hiện trường bespoke" tự đặt (Trưởng nhóm điều
phối, Kỹ thuật âm thanh ánh sáng, Điều phối khách mời, Trang trí & setup, Hậu cần — comment `db/
schedulePlans.ts` dòng 85-94 đã tự ghi rõ đây là khái niệm **khác** `EmployeeRole`/`UserRole` chính thức).
DB thật chỉ có **2** giá trị `role` hợp lệ trong `schedule_plan_assignees` (`LEAD`/`TECHNICAL`), và danh
sách người chọn phải là **users thật** với `role ∈ {LEADER, TECHNICAL}` (`GET /api/v1/users?role=LEADER`
hoặc `role=TECHNICAL`, đã có sẵn `userApiService.getUsers`, hỗ trợ đúng query `role`). Cần bỏ hẳn 5 "vai
trò hiện trường bespoke" khi nối API thật — đổi Section 3 thành chọn user thật + gán `role` = `LEAD` hoặc
`TECHNICAL` cho từng người trong danh sách chọn (không phải 1 nhãn vai trò tự do gắn theo tên).

### 8.4 Section 4 — Phân công việc chi tiết (`tasks[]`)

Mỗi việc (`taskTitle`, `taskAssignee` 1 người, `taskTeam[]` nhiều người phụ, giờ, địa điểm, yêu cầu) khi
lưu cũng là **1 dòng `schedule_plans` riêng** (mục 1) với **nhiều** `schedule_plan_assignees` (1 người
`assignee` chính → `role = LEAD`, các người trong `team[]` → `role = TECHNICAL`) — không phải 1
`assignedTo` đơn. Về tên việc tự do, xem đề xuất đổi sang chọn từ danh mục + `notes` ở mục 2.

### 8.5 Tổng hợp — thay đổi cần khi nối API thật cho toàn bộ form

1. Đổi `CreateSchedulePlanPayload.assignedTo: string` → `assignees: { userId: string; role: 'LEAD' |
   'TECHNICAL' }[]` — nhất quán quyết định đã chốt ở `docs/lichtrinhkythuat_api.md` mục 4/10.1 điểm 8.
2. Bấm "Lưu kế hoạch" phải gọi `POST /schedule-plans` **nhiều lần tuần tự** (1 lần/hoạt động + 1 lần/việc
   trong Section 2 + 4) — **đề xuất mới**: thêm `POST /api/v1/schedule-plans/batch` nhận mảng payload,
   tạo nhiều dòng cùng `order_id` trong 1 transaction, để tránh trạng thái lưu dở dang nếu 1 trong N
   request lỗi giữa chừng (vd mất mạng giữa lúc lưu — 1 số hoạt động đã lưu, số khác thì chưa). Cần
   Backend xác nhận có làm được endpoint batch hay FE chấp nhận tự lặp gọi tuần tự + tự rollback bằng tay
   khi lỗi (kém an toàn hơn).
3. Dropdown "Trạng thái kế hoạch" (`DRAFT`/`CONFIRMED`) ở Section 1 — `CreateSchedulePlanPayload` hiện
   **không có field `status`** khi tạo (mặc định `PENDING` theo schema, cột `status` có `DEFAULT
   'PENDING'`) — cần bỏ dropdown này khỏi bước tạo, mọi dòng mới luôn `PENDING`; muốn `CONFIRMED` ngay
   phải gọi thêm `PATCH .../status` sau khi tạo xong toàn bộ dòng (dùng lại endpoint đã chốt ở mục 9).
4. Bỏ hẳn `PLANNING_STAFF_POOL` (5 vai trò bespoke) — đổi Section 3 sang chọn user thật theo mục 8.3.
5. Đổi Section 4 (tên việc tự do) sang chọn `task_id` + `notes` theo đề xuất mục 2.

## 9. Xác nhận / Hủy kế hoạch

Tái dùng nguyên các endpoint đã chốt ở `docs/lichtrinhkythuat_api.md` mục 6 và 8.2, áp dụng cho **từng
dòng** `schedule_plans` (không phải cả nhóm) — không phân tích lại:

| # | Endpoint | Dùng cho |
|---|---|---|
| 1 | `PATCH /api/v1/schedule-plans/:id/status` `{ "status": "CONFIRMED" }` | Xác nhận 1 dòng kế hoạch trước khi thi công (nút "Xác nhận kế hoạch") |
| 2 | `PATCH /api/v1/schedule-plans/:id/status` `{ "status": "CANCELLED" }` | Thay cho "Xóa" — không có `DELETE /api/v1/schedule-plans/:id` |

Modal "Xóa kế hoạch điều phối" ở màn này xóa **cả nhóm** (mọi dòng `schedule_plans` cùng `order_id`) chứ
không phải 1 dòng đơn lẻ như tab "Lịch trình & Kỹ thuật" — cần gọi endpoint #2 **lặp lại cho từng dòng**
trong nhóm, hoặc dùng chung endpoint batch đề xuất ở mục 8.5 điểm 2 (nếu Backend làm) dưới dạng
`PATCH /schedule-plans/batch/status`. Chỉ cho phép hủy khi **mọi** dòng trong nhóm đều chưa
`IN_PROGRESS`/`COMPLETED` (giữ đúng điều kiện đã chốt ở `docs/lichtrinhkythuat_api.md` mục 8.1 áp dụng
cho từng dòng con) — nếu có dòng đã `IN_PROGRESS`/`COMPLETED`, cần chặn nút "Xóa" ở cả nhóm và báo rõ lý
do thay vì cho hủy 1 phần.

## 10. Banner "sắp diễn ra" (`getApproachingEvents`)

Theo đúng quyết định đã chốt ở `docs/tongquansukien_api.md` (badge "Còn N ngày" — tính hoàn toàn phía
client, không cần endpoint riêng): banner này tổng hợp 2 nguồn đã có sẵn — `orders.event_date` (từ `GET
/orders`) và `schedule_plans.start_time` (từ `GET /schedule-plans` trong khoảng ngày đang xem, mục 6) —
so sánh với ngày hiện tại phía client (`daysUntil`/`getEventUrgency`, `src/utils/eventDate.ts`, giữ
nguyên logic ngưỡng ≤3 ngày = khẩn cấp, 4-7 ngày = sắp tới). Không cần Backend thêm endpoint mới cho phần
này.

## 11. Tổng hợp — đã chốt (kế thừa) vs. đề xuất mới cần Backend/Product xác nhận

### 11.1 Đã chốt từ trước (kế thừa nguyên trạng `docs/lichtrinhkythuat_api.md`, không đổi)

1. Enum `ScheduleStatus` thật, model đa phân công `schedule_plan_assignees` (`assignees[]`, bỏ
   `assignedTo` đơn), join sẵn `phone` vào `assignees`, seed thêm `work_tasks`, "Xóa" → `CANCELLED` qua
   `PATCH .../status` (không thêm `DELETE`), điều kiện "Sửa" chỉ khi status khác `IN_PROGRESS`/
   `COMPLETED`.
2. Badge "Còn N ngày"/"sắp diễn ra" tính client-side, không cần endpoint riêng (`docs/
   tongquansukien_api.md`).
3. Enum `order_status` thật 5 giá trị uppercase (`docs/danhsachdondat_api.md`).

### 11.2 Đề xuất mới của riêng tài liệu này — cần Backend/Product xác nhận trước khi implement

1. Bổ sung `dateFrom`/`dateTo` cho `GetSchedulePlansQuery` (thay `date` đơn) và cho phép bỏ trống
   `orderId` để lấy nhiều đơn cùng lúc (mục 6).
2. `GET /schedule-plans` join sẵn `orderCode`/`customerName`/`eventName`/`orderLocation` vào mỗi dòng —
   bắt buộc cho màn đa đơn này, khác các tài liệu trước (mục 6).
3. Thuật toán tổng hợp trạng thái nhóm nhiều dòng thành 1 badge hiển thị (mục 7) — đề xuất, chưa được
   Product duyệt.
4. Đổi `task_id` (danh mục) + `notes` (mô tả tự do) thay cho tên việc tự do không giới hạn ở Section 4
   (mục 2, 8.4).
5. Bỏ `PLANNING_STAFF_POOL` (5 vai trò bespoke), đổi sang chọn user thật theo `role ∈ {LEADER,
   TECHNICAL}` + gán `LEAD`/`TECHNICAL` khi lưu (mục 8.3).
6. Endpoint batch tạo/hủy nhiều dòng `schedule_plans` cùng lúc trong 1 transaction (`POST
   /schedule-plans/batch`, `PATCH /schedule-plans/batch/status`) — đề xuất để tránh trạng thái lưu dở
   dang, Backend có thể từ chối và yêu cầu FE tự lặp gọi tuần tự (mục 8.5, 9).
7. Bỏ dropdown "Trạng thái kế hoạch" (`DRAFT`/`CONFIRMED`) khỏi bước tạo mới — `CreateSchedulePlanPayload`
   hiện không hỗ trợ set status khi tạo (mục 8.5 điểm 3).

## 12. API chưa làm được — chờ Backend sửa database

Danh sách API/luồng trong tài liệu này **không thể implement với schema hiện tại**, phải chờ Backend đổi
database trước. Không code phía FE cho các luồng này (kể cả dùng mock) cho tới khi có xác nhận schema mới
— tránh code 2 lần khi schema đổi.

1. **Lập lịch khảo sát hiện trường khi báo giá chưa có Order thật** (mục 8.1, `quotationOrderOption`).
   Đã chốt hướng (A) — thêm `schedule_plans.quotation_id` (nullable, FK → `quotations.quotation_id`),
   nới `schedule_plans.order_id` thành nullable, ràng buộc đúng 1 trong 2 cột có giá trị ở tầng ứng dụng.
   **Chờ Backend migrate schema xong** rồi mới viết `POST /api/v1/schedule-plans` nhận `orderId` **hoặc**
   `quotationId` (thay vì chỉ `orderId` bắt buộc như hiện tại) và `GET /api/v1/schedule-plans` trả kèm
   `quotationId` khi dòng đó chưa gắn Order thật. Đã ghi yêu cầu bổ sung vào
   [`docs/more-require.md`](more-require.md) mục (a).
