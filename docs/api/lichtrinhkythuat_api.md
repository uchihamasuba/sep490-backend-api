# API cho tab "Lịch trình & Kỹ thuật" (trang chi tiết đơn đặt)

> Phạm vi tài liệu này: **chỉ** tab `plans` ("Lịch trình & Kỹ thuật") của trang chi tiết 1 đơn đặt —
> khối "Lịch thi công & đơn vị phụ trách kỹ thuật" hiển thị danh sách thẻ hoạt động/công việc kỹ thuật
> (mã `LICH-xxx`, người/đội phụ trách, ngày giờ, địa điểm, trạng thái HOÀN THÀNH/CHỜ XỬ LÝ,
> check-in/check-out, nút Xem chi tiết/Sửa/Xóa/Bắt đầu làm việc/Tải ảnh thi công) cùng modal "Xem chi
> tiết" của 1 thẻ — đúng như ảnh mẫu cung cấp. Trang dùng chung layout ở cả `/manager/orders/[id]` và
> `/admin/orders_audit/[id]` (mirror 1:1, chỉ khác tiền tố route).
>
> **Không** bao gồm 5 tab còn lại của cùng trang (đã có tài liệu riêng: tab "Tổng quan sự kiện" ở
> [`docs/tongquansukien_api.md`](tongquansukien_api.md), tab "Tiến độ sự kiện" ở
> [`docs/tiendosukien_api.md`](tiendosukien_api.md), tab "Thiết bị & Kho hàng" ở
> [`docs/thietbikhohang_api.md`](thietbikhohang_api.md)). Cũng **không** bao gồm trang danh sách
> `/manager/schedule/plans` hay `/manager/schedule/tasks` mà nút "Lập kế hoạch điều phối"/"Quản lý
> trong Kế hoạch & phân công" điều hướng tới — 2 trang đó chưa có tài liệu API riêng, ngoài phạm vi ở
> đây (xem mục 8).
>
> **Phát hiện quan trọng nhất tài liệu này lặp lại nguyên trạng từ `docs/tiendosukien_api.md` mục 4**
> (tab "Tiến độ sự kiện" — Mốc 3) vì cả 2 tab cùng đọc chung 1 nguồn mock (`linkedPlan =
> getAdminSchedulePlans().find(...)`) và cùng model thật `schedule_plans`: **1 dòng `schedule_plans`
> thật = 1 order + 1 loại việc (`task_id`), KHÔNG PHẢI 1 "kế hoạch" chứa nhiều hoạt động/công việc con**
> như mock `SchedulePlan.activities[]`/`SchedulePlan.tasks[]` đang mô tả. Tài liệu này áp dụng lại phát
> hiện đó cho đúng danh sách thẻ của tab này (mục 2-3), không phân tích lại từ đầu, chỉ nêu thêm các
> phát hiện **riêng của tab "Lịch trình & Kỹ thuật"** (modal chi tiết, nút thao tác, đa phân công,
> danh mục loại việc, thiếu endpoint xóa...).
>
> Nguồn tham chiếu:
> - FE: `src/app/manager/orders/[id]/page.tsx` (dòng 86-95 khai báo tab, dòng 186-266
>   `ScheduleCardItem`/`buildScheduleCardItems` gộp `PlanActivity`+`PlanWorkTask` thành 1 danh sách thẻ,
>   dòng 376-412 handler `handleSelectTaskEvidence`/`handleStartTask`/`handleDeleteScheduleActivity`/
>   `handleDeleteScheduleTask`/`handleConfirmTaskEvidence`, dòng 441 `linkedPlan`, dòng 1099-1253 JSX
>   danh sách thẻ, dòng 1630-1689 modal "Xem chi tiết"), `src/app/admin/orders_audit/[id]/page.tsx` (bản
>   mirror), `src/mocks/db/schedulePlans.ts` (toàn bộ — `SchedulePlan`/`PlanActivity`/`PlanWorkTask`/
>   `PlanStaffMember`/`ActivityType`/`TaskStatus`/`PLANNING_STAFF_POOL`/`startAdminScheduleTask`/
>   `confirmAdminScheduleTaskWithEvidence`/`removeAdminScheduleActivity`/`removeAdminScheduleTask`),
>   `src/mocks/db/employees.ts` (`FIELD_OPS_STAFF`), `src/types/schedulePlan.ts`, `src/types/workTask.ts`,
>   `src/types/evidence.ts`, `src/types/user.ts`, `src/services/schedulePlan.service.ts`,
>   `workTask.service.ts`, `evidence.service.ts`, `user.service.ts`.
> - DB thật: đối chiếu trực tiếp qua MySQL MCP ngày 2026-07-20 (cùng phiên với
>   `docs/tongquansukien_api.md`/`docs/tiendosukien_api.md`) — `SHOW CREATE TABLE schedule_plans/
>   schedule_plan_assignees/work_tasks/evidences/users/orders`; dữ liệu mẫu thật: 1 order (`ORD-001`),
>   1 schedule_plan (`PLN-001`, `task_id` → `work_tasks.task_name = "Lắp đặt thiết bị"`,
>   `status = IN_PROGRESS`, `evidence_id = NULL`), 2 `schedule_plan_assignees` cho đúng 1 plan đó
>   (1 `role = LEAD`, 1 `role = TECHNICAL` — xác nhận model **đa phân công thật đang được dùng**, xem
>   mục 4), `work_tasks` chỉ có **đúng 2 dòng** (`TSK-SETUP` "Lắp đặt thiết bị", `TSK-TEARDOWN` "Tháo dỡ
>   thiết bị" — xem mục 5).
> - `docs/api/` **không tồn tại trong repo hiện tại** — dùng comment đầu từng file `types/*.ts` (đối
>   chiếu trực tiếp `prisma/schema.prisma`/`*.route.ts`/`*.service.ts` của backend ngày 2026-07-06) làm
>   căn cứ chính, giống các tài liệu trước.

## 0. Base URL & Auth

- Base path: `/api/v1`, JWT Bearer theo `AuthContext` hiện có.
- **Đã chốt ranh giới vai trò (2026-07-20)**, theo đúng CLAUDE.md mục 1 ("phần lớn dữ liệu hiện trường...
  do Leader Staff ghi nhận trước, Manager chỉ xác nhận trên web"): 2 chuyển trạng thái `IN_PROGRESS`
  ("bắt đầu làm việc") và `COMPLETED` kèm ảnh minh chứng ("tải ảnh thi công") là hành động của **Leader
  Staff qua mobile** (ngoài phạm vi repo web) — **không** phải hành động Manager tự bấm trên web. Web
  Manager (tab này) chỉ có đúng **1** hành động ghi thật: xác nhận kế hoạch `PENDING → CONFIRMED` trước
  khi thi công (mục 6); phần còn lại là **đọc/xem lại** — trạng thái `IN_PROGRESS`/`COMPLETED` và ảnh
  minh chứng do mobile cập nhật, hiển thị read-only (mục 6-7). Bản Admin (`/admin/orders_audit/[id]`)
  vẫn nên là read-only hoàn toàn cho cả tab này (giống ghi chú ở `docs/tongquansukien_api.md` mục 0).

## 1. Cấu trúc 1 thẻ lịch trình (`ScheduleCardItem`) — nguồn dữ liệu từng field

Bảng dưới map từng field UI đang hiển thị trên 1 thẻ (và modal "Xem chi tiết") sang nguồn thật, áp dụng
**sau khi** đã đọc đúng nhiều dòng `schedule_plans` theo mục 2-3 (không phải đọc từ 1 "linkedPlan" duy
nhất như mock).

| Field UI (`ScheduleCardItem`) | Nguồn thật | Ghi chú |
|---|---|---|
| Mã thẻ (`LICH-001`...) | **Không có cột thật** | Tự đánh số thứ tự phía client trong phạm vi 1 đơn đặt (giống cách mock đang làm) — không cần Backend sinh mã riêng cho từng dòng `schedule_plans` hiển thị ở tab này, khác hẳn `plan_code` (`PLN-001`) vốn là mã của **cả dòng plan**, không phải mã hiển thị theo thẻ. |
| Loại việc (`category`, hiển thị đậm) | `schedule_plans.task_id` → join `work_tasks.task_name` | Cần Backend join sẵn `taskName` vào response `GET /schedule-plans` (`types/schedulePlan.ts` dòng 25 đã khai trường `taskName?: string` nhưng cần xác nhận backend thật có trả hay không — xem mục 9.2). |
| Người/đội phụ trách (`assigneeName`, `assigneeRole`, `assigneePhone`) | `schedule_plan_assignees` (nhiều dòng cùng `plan_id`) → join `users` | **Không phải 1 chuỗi tên đơn** như mock `PlanWorkTask.assignee`/`PlanActivity` (suy từ `staffList` theo index) — xem mục 4. |
| Ngày/giờ (`date`, `timeRangeLabel`) | `schedule_plans.start_time`/`end_time` | Khớp trực tiếp — mock tách `date` và `timeRangeLabel` từ 1 chuỗi `startTime` kiểu cũ, cần đổi cách format khi đọc timestamp thật. |
| Địa điểm (`location`) | `schedule_plans.location` | Khớp trực tiếp (cột `text`, đủ chứa cả dạng "Kho trung tâm → {venue}" nếu cần cho việc vận chuyển). |
| Ghi chú (`notes`) | `schedule_plans.notes` | Khớp trực tiếp. |
| Trạng thái HOÀN THÀNH/CHỜ XỬ LÝ (`completed`) | `schedule_plans.status === 'COMPLETED'` | Mock tự suy `completed` theo 2 cách khác nhau tùy `kind` (`activity`: so sánh ngày với hôm nay; `task`: so `status === 'COMPLETED'`) — không nhất quán. Model thật chỉ có **1** cột `status` (`ScheduleStatus`) cho mọi dòng, nên suy trực tiếp từ đó, bỏ hẳn nhánh so ngày. |
| Check-in/Check-out (`checkInTime`/`checkOutTime`) | **Chưa có cột thật — đã chốt hướng bổ sung, xem ghi chú dưới bảng** | Cùng vấn đề `actualStartTime`/`actualEndTime` đã nêu ở `docs/tiendosukien_api.md` mục 4 điểm 4, nay chốt hướng xử lý — không lặp lại phân tích, chỉ nêu quyết định. |

**Đã chốt hướng (A)** cho câu hỏi "lưu giờ thực tế ở đâu" (áp dụng chung cho cả tài liệu này và
`docs/tiendosukien_api.md`): thêm 2 cột nullable mới `schedule_plans.actual_start_time`/
`actual_end_time` (`timestamp`), tách biệt hẳn khỏi `start_time`/`end_time` gốc (giờ **kế hoạch**, đặt
lúc Manager lập/xác nhận lịch). Backend tự ghi `actual_start_time` khi Leader Staff (mobile) chuyển
`status → IN_PROGRESS` và `actual_end_time` khi chuyển `status → COMPLETED` (2 transition tài liệu hóa ở
mục 6-7). Chọn (A) thay vì (B) (ghi đè `start_time`/`end_time` gốc) vì `start_time NOT NULL` hiện đang
dùng làm mốc lập kế hoạch/sắp xếp (hiển thị "Ngày/giờ" ở bảng trên) — ghi đè bằng giờ thực tế sẽ xóa mất
thông tin kế hoạch ban đầu, làm mất khả năng so sánh kế hoạch-vs-thực tế (nhu cầu báo cáo hợp lý cho phần
mềm vận hành). Cần đồng bộ lại `docs/tiendosukien_api.md` mục 9.2 điểm 1 theo đúng quyết định này khi có
dịp cập nhật file đó.

## 2. Đọc danh sách lịch trình & phân công của 1 đơn hàng

| # | Endpoint | Dùng cho | Ghi chú |
|---|---|---|---|
| 1 | `GET /api/v1/schedule-plans?orderId=:orderId` | Nạp toàn bộ thẻ cho khối "Lịch thi công & đơn vị phụ trách kỹ thuật" | **Đã có sẵn** (`schedulePlanApiService.getSchedulePlans`, hỗ trợ đúng query `orderId` — `types/schedulePlan.ts` dòng 32). Trả **mảng nhiều dòng `SchedulePlan`** (1 dòng/loại việc), không phải 1 object lồng `activities[]`/`tasks[]` như mock. |

**Việc cần đổi khi nối API thật (không phải chỉ đổi tên field):**

1. Bỏ hẳn `getAdminSchedulePlans().find((p) => p.orderId === row.orderId)` (`linkedPlan`, dòng 441) —
   `.find()` chỉ lấy **1** dòng đầu tiên trong khi thực tế 1 order có thể có **nhiều** dòng
   `schedule_plans` (mỗi dòng 1 loại việc: khảo sát, vận chuyển, lắp đặt, thu hồi...). Đổi thành đọc
   **toàn bộ mảng** trả về từ `GET /schedule-plans?orderId=:id`.
2. Bỏ hẳn `buildScheduleCardItems()` (gộp `plan.activities` + `plan.tasks` từ 1 plan) — với dữ liệu
   thật, danh sách thẻ chính là **map trực tiếp 1-1** từ mảng `schedule_plans` trả về (mỗi dòng = 1 thẻ),
   không cần gộp 2 mảng con nữa.
3. Điều kiện rỗng `!linkedPlan` → "Chưa có kế hoạch điều phối nào được lập cho đơn hàng này" đổi thành
   `schedulePlans.length === 0`.

## 3. Enum trạng thái — dùng lại `ScheduleStatus`, bỏ `TaskStatus` mock

Mock dùng 2 enum khác nhau cho 2 "lớp" dữ liệu: `PlanStatus = 'DRAFT' | 'CONFIRMED'` (mức plan) và
`TaskStatus = 'TODO' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED'` (mức từng task/activity,
dùng để tô màu badge + điều kiện hiện nút "Bắt đầu làm việc"/"Sửa"/"Xóa"). DB thật **chỉ có 1 enum duy
nhất** cho mỗi dòng: `schedule_plans.status = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' |
'CANCELLED'` (`types/schedulePlan.ts` `ScheduleStatus`) — không có `TODO`/`ASSIGNED`/`BLOCKED`, có thêm
`CANCELLED` mock chưa xử lý. Đây là cùng phát hiện đã ghi ở `docs/tiendosukien_api.md` mục 4 điểm 3, áp
dụng y hệt cho badge trạng thái của từng thẻ ở tab này — viết lại toàn bộ style map (`TASK_STATUS_META`)
theo đúng `ScheduleStatus` thật, gồm cả case `CANCELLED` (badge xám/đỏ) hiện chưa có UI tương ứng.

## 4. Người/đội phụ trách — đa phân công thật (`schedule_plan_assignees`)

Mock có **2 cách suy "người phụ trách" khác nhau, đều không khớp model thật**:

- Với `PlanActivity` (khảo sát/vận chuyển/lắp đặt/thu hồi): lấy `plan.staffList[index %
  plan.staffList.length]` — 1 người, chọn theo index vòng lặp, không gắn thật với hoạt động đó.
- Với `PlanWorkTask`: `task.assignee` (1 chuỗi tên) + `task.team: string[]` (mảng tên phụ, hiển thị dạng
  "Tên (+N người)").

Dữ liệu mẫu thật xác nhận: 1 dòng `schedule_plans` (`PLN-001`) có **2 dòng** `schedule_plan_assignees`
tương ứng — 1 `role = 'LEAD'`, 1 `role = 'TECHNICAL'` (không phải chuỗi tên đơn, cũng không phải mảng
tên phụ tự do). Đây là **đúng phát hiện đã ghi ở `docs/tongquansukien_api.md` mục 5** ("`schedule_plans`
+ `schedule_plan_assignees` là khái niệm gần đúng nhất... người được giao nằm ở bảng phụ nhiều
người/vai trò, không phải 1 `assigneeName` duy nhất") — áp dụng y hệt ở đây, và **xác nhận thêm** bằng
dữ liệu mẫu thật (2 assignee cho 1 plan) rằng model đa phân công **đang thật sự được dùng**, không phải
lý thuyết suông.

**Việc cần đổi khi nối API thật — đã chốt cả 2 hướng còn treo (2026-07-20):**

1. **Đã chốt**: dùng model **đa phân công thật** (`assignees[]`, không phải `assignedTo` đơn) — dữ liệu
   mẫu thật (2 assignee/1 plan, role khác nhau) là bằng chứng trực tiếp cho thấy `schedule_plan_assignees`
   đang được dùng thật, còn comment "1 plan = 1 người được giao" ở đầu `types/schedulePlan.ts` đã lỗi
   thời so với schema hiện tại. `GET /schedule-plans` (và `GET /schedule-plans/:id`) cần trả kèm mảng
   `assignees: { userId, fullName, role, phone }[]` (join `schedule_plan_assignees` → `users`, xem điểm 3
   dưới) — Frontend cập nhật lại `SchedulePlan` type: bỏ `assignedTo: string`, thêm `assignees: PlanAssignee[]`.
2. Field UI `assigneeRole` hiện bị **hardcode cứng chuỗi `'Nhân viên kỹ thuật'`** cho mọi thẻ (dòng 231,
   251 `buildScheduleCardItems`) — không đọc từ đâu cả, kể cả trong mock. Đổi thành map
   `schedule_plan_assignees.role` (`LEAD`/`TECHNICAL`) sang nhãn tiếng Việt (vd "Trưởng nhóm kỹ
   thuật"/"Nhân viên kỹ thuật") thay vì chuỗi tĩnh.
3. **Đã chốt hướng (A)**: `assigneePhone` hiện lấy từ `FIELD_OPS_STAFF` — 1 pool nhân sự **mock độc lập,
   không gắn với bất kỳ `user_id` nào** (`db/employees.ts` dòng 1-4: "Employee — KHÁC RBAC User đăng
   nhập"). Người được gán ở `schedule_plan_assignees.user_id` trỏ thẳng vào bảng `users` thật, nhưng
   **`GET /api/v1/users` (danh sách) không trả `phone`** — comment đầu `types/user.ts` dòng 10 ghi rõ
   "KHÔNG có email/phone/bio/avatarUrl (chỉ có ở `GET /auth/profile`)". Chọn hướng Backend **join sẵn
   `phone` vào từng phần tử `assignees` của response `GET /schedule-plans`** (thay vì hướng (B) mở
   `GET /users/:id` trả thêm `phone` rồi bắt FE gọi round-trip riêng cho từng assignee) — lý do: tab này
   cần hiển thị phone ngay trên danh sách thẻ (không phải màn hình chi tiết 1 user), join sẵn 1 lần ở
   nguồn dữ liệu chính tránh N lời gọi phụ khi 1 thẻ có nhiều assignee.

## 5. Danh mục loại việc (`work_tasks`) — thiếu 2/4 loại UI đang cần

Mock `ActivityType = 'Khảo sát' | 'Vận chuyển' | 'Lắp đặt' | 'Thu hồi'` (4 loại, mỗi `SchedulePlan` luôn
seed đủ cả 4 hoạt động này). Dữ liệu mẫu thật `work_tasks` **chỉ có 2 dòng**: `"Lắp đặt thiết bị"`
(`TSK-SETUP`) và `"Tháo dỡ thiết bị"` (`TSK-TEARDOWN`) — thiếu hẳn danh mục cho "Khảo sát" và "Vận
chuyển", và tên "Tháo dỡ thiết bị" không rõ có phải cùng nghĩa với "Thu hồi" (thu hồi + kiểm đếm sau
tiệc, theo vòng đời Order ở CLAUDE.md mục 1) hay là 2 việc khác nhau.

Đây là **đúng phần đã chốt hướng ở `docs/tiendosukien_api.md` mục 9.1 điểm 5**: "seed thêm `work_tasks`
row 'Khảo sát hiện trường' (và 'Vận chuyển' nếu tab Lịch trình cần)" — tài liệu đó viết trước khi tài
liệu này tồn tại, nay **xác nhận tab "Lịch trình & Kỹ thuật" (đây) chính là nơi cần** — Backend cần seed
thêm tối thiểu 2 dòng `work_tasks` mới ("Khảo sát hiện trường", "Vận chuyển thiết bị"), và làm rõ với
Product liệu "Tháo dỡ thiết bị" hiện có có nên đổi tên/gộp thành "Thu hồi thiết bị" cho khớp thuật ngữ
vòng đời Order, hay giữ nguyên là 2 khái niệm tách biệt (vd "Tháo dỡ" = gỡ lắp đặt tại chỗ, "Thu hồi" =
mang thiết bị về kho + kiểm đếm) — chưa đủ căn cứ để tự chốt 1 hướng.

## 6. Hành động Manager trên web: xác nhận kế hoạch (`PENDING → CONFIRMED`) — thay cho nút "Bắt đầu làm việc"

**Đã chốt (mục 0)**: nút "Bắt đầu làm việc" (`handleStartTask`, chuyển `status → IN_PROGRESS`) **bỏ khỏi
web Manager** — đây là hành động Leader Staff bấm tại hiện trường qua mobile khi thực sự bắt đầu thi
công, ngoài phạm vi repo web (mobile gọi thẳng cùng endpoint `PATCH /schedule-plans/:id/status
{ "status": "IN_PROGRESS" }` đã có sẵn, chỉ đổi phía gọi).

Việc thật Manager cần làm trên web ở bước này là **xác nhận kế hoạch trước khi thi công** — tận dụng
đúng giá trị `CONFIRMED` sẵn có trong `ScheduleStatus` (`PENDING → CONFIRMED → IN_PROGRESS → COMPLETED →
CANCELLED`) mà mock/UI hiện tại **chưa hề dùng tới** (mock nhảy thẳng `TODO/ASSIGNED → IN_PROGRESS`, bỏ
qua hẳn bước xác nhận):

| # | Endpoint | Dùng cho | Ghi chú |
|---|---|---|---|
| 1 | `PATCH /api/v1/schedule-plans/:id/status` `{ "status": "CONFIRMED" }` | Nút mới **"Xác nhận kế hoạch"** — thay thế "Bắt đầu làm việc" ở đúng vị trí cũ trên thẻ, chỉ hiện khi `status === 'PENDING'` | **Đã có sẵn** (`schedulePlanApiService.updateSchedulePlanStatus`), chỉ cần đổi giá trị `status` gửi lên và đổi nhãn/điều kiện hiện nút. |

Sau khi Manager xác nhận (`CONFIRMED`), thẻ chuyển sang trạng thái **chờ Leader Staff thi công** — badge
đọc thẳng `status` (mục 3), không còn nút thao tác nào khác cho tới khi mobile tự cập nhật
`IN_PROGRESS`/`COMPLETED`.

## 7. Ảnh minh chứng thi công — web Manager chỉ xem lại, không tự tải

**Đã chốt (mục 0)**: nút "Tải ảnh thi công" (`handleSelectTaskEvidence`/`handleConfirmTaskEvidence`, gọi
`POST /evidence/upload` rồi `PATCH .../status { status: 'COMPLETED', evidenceId }`) **bỏ khỏi web
Manager** — Leader Staff là người trực tiếp thi công và tải ảnh minh chứng ngay tại hiện trường qua
mobile khi hoàn thành; đây là luồng ghi dữ liệu của mobile, ngoài phạm vi repo web. 2 endpoint
`POST /evidence/upload` và `PATCH /schedule-plans/:id/status { status: 'COMPLETED', evidenceId }` **vẫn
đã có sẵn** đúng như trước, chỉ đổi phía gọi từ "web Manager" sang "mobile Leader Staff" — lưu ý cho
mobile: `referenceType`/`referenceId` của evidence **không có cột lưu** (`types/evidence.ts` dòng 14,
"được controller nhận nhưng KHÔNG có cột lưu — bị bỏ qua"), nên phải gắn `evidenceId` ngược lại vào bước
`PATCH .../status` ngay sau khi upload, không có cách nào khác để evidence tự biết nó thuộc
`schedule_plans` nào.

Việc thật web Manager cần làm ở bước này chỉ là **xem lại** kết quả, không có hành động ghi:

| # | Endpoint | Dùng cho | Ghi chú |
|---|---|---|---|
| 1 | `GET /api/v1/evidence/:id` (dùng `schedule_plans.evidence_id` của thẻ đó) | Xem ảnh minh chứng khi thẻ đã `COMPLETED` — thay cho nút "Tải ảnh thi công" ở vị trí cũ | **Đã có sẵn** (`evidenceApiService.getEvidenceById`). Chỉ hiện khi `evidence_id` khác `null`; nếu `COMPLETED` mà chưa có `evidence_id` (Leader Staff hoàn thành nhưng chưa kịp gắn ảnh), hiển thị placeholder "Chưa có ảnh minh chứng" thay vì lỗi. |

Giữ nguyên 1 lưu ý về giới hạn schema đã ghi trước đây: `schedule_plans.evidence_id` là cột **đơn** (1-1,
FK `evidences.evidence_id`) — chỉ lưu được **1 ảnh minh chứng cho cả dòng plan**, không phải nhiều ảnh.

## 8. Nút "Sửa"/"Xóa" — thiếu endpoint xóa, điều kiện sửa không khớp

**8.1 "Sửa"** — mock điều hướng cứng sang `/manager/schedule/plans` (trang danh sách kế hoạch chung,
ngoài phạm vi tài liệu này) mà không truyền kèm `planId` cụ thể để trang đó tự mở đúng form sửa — cần bổ
sung query param (vd `?planId=:id`) khi trang đó có tài liệu/implement thật.

Điều kiện hiện nút "Sửa" trên mock là `!item.completed` (mọi trạng thái khác `COMPLETED`, **kể cả**
`IN_PROGRESS`). Endpoint thật `PUT /api/v1/schedule-plans/:id` (`schedulePlanApiService.updateSchedulePlan`)
theo comment tại `types/schedulePlan.ts` dòng 49 **chỉ sửa được khi status khác `IN_PROGRESS`/
`COMPLETED`** — chặt hơn điều kiện UI hiện tại. Cần thu hẹp điều kiện hiện nút "Sửa" thành
`status !== 'IN_PROGRESS' && status !== 'COMPLETED'` khi nối API thật, nếu không nút sẽ hiện cho các thẻ
đang `IN_PROGRESS` nhưng bấm vào sẽ bị backend từ chối (giả định 409/400, cần Backend xác nhận mã lỗi cụ
thể).

**8.2 "Xóa" — đã chốt hướng (B): đổi thành hủy (`CANCELLED`), không thêm endpoint xóa cứng**

`handleDeleteScheduleActivity`/`handleDeleteScheduleTask` (→ `removeAdminScheduleActivity`/
`removeAdminScheduleTask`) hiện xóa thẳng bản ghi khỏi mock. **Không có `DELETE /api/v1/schedule-plans/:id`**
trong `schedulePlan.service.ts` (chỉ có `getSchedulePlans`/`createSchedulePlan`/`updateSchedulePlan`/
`updateSchedulePlanStatus`) và **không cần thêm** — đã chốt bỏ hẳn khái niệm "xóa cứng" 1 dòng
`schedule_plans` ở tab này, thay bằng chuyển trạng thái `CANCELLED` (đã có sẵn trong `ScheduleStatus`,
dùng lại đúng `PATCH /schedule-plans/:id/status` đã tài liệu hóa ở mục 6, không cần endpoint mới):

| # | Endpoint | Dùng cho | Ghi chú |
|---|---|---|---|
| 1 | `PATCH /api/v1/schedule-plans/:id/status` `{ "status": "CANCELLED" }` | Nút "Xóa" đổi tên thành "Hủy" — chỉ hiện khi `status` chưa `IN_PROGRESS`/`COMPLETED`/`CANCELLED` (cùng điều kiện với nút "Sửa" ở 8.1) | Tái dùng đúng endpoint đã có, không cần Backend làm thêm gì ngoài đảm bảo transition `* → CANCELLED` được cho phép ở state machine phía server. |

Lý do chọn (B) thay vì thêm `DELETE`: giữ được lịch sử (ai lập kế hoạch, khi nào hủy) thay vì mất hẳn bản
ghi, nhất quán với cách các entity khác trong hệ thống dùng trạng thái thay vì xóa cứng sau khi đã ghi
nhận (Order/Quotation cũng không xóa cứng sau khi confirm — CLAUDE.md mục 1), và không cần Backend thêm
route mới. Badge `CANCELLED` cần bổ sung style riêng (xám/gạch ngang) vào bảng màu viết lại ở mục 3.

## 9. Modal "Xem chi tiết" — không có endpoint riêng

Toàn bộ field trong modal (`scheduleDetailItem`) lấy thẳng từ `ScheduleCardItem` đã build sẵn ở danh
sách thẻ (mục 1) — không gọi thêm API khi mở modal. Khi nối dữ liệu thật, chỉ cần đảm bảo mọi field liệt
kê ở mục 1 đã có đủ trong 1 dòng `schedule_plans` (kèm `assignees`/`taskName` join sẵn) trước khi build
`ScheduleCardItem`, không cần round-trip gọi riêng `GET /schedule-plans/:id` khi mở modal.

## 9b. Nút "Tạo lịch trình" — ĐÃ NỐI 2026-07-21, phát hiện endpoint gán nhân sự riêng chưa có trong tài liệu này

Web Manager giờ có nút **"Tạo lịch trình"** ở đầu tab (`CreateSchedulePlanModal.tsx`, chỉ hiện ở
`/manager/orders/[id]`, không hiện ở bản Admin read-only) — chọn loại việc (`work_tasks`), thời gian bắt
đầu/kết thúc, địa điểm, ghi chú, và **nhân sự phụ trách** (nhiều dòng, chọn từ user role
`LEADER`/`TECHNICAL`).

**Phát hiện quan trọng qua `curl` thật (2026-07-21), khác hẳn giả định cũ ở mục 4/`types/schedulePlan.ts`**:

- `POST /schedule-plans` nhận field `assignedTo: string` (validator không báo lỗi khi thiếu, cũng
  không lỗi khi có) nhưng **field này bị bỏ qua hoàn toàn ở tầng service** — response luôn trả
  `assignees: []` dù gửi kèm `assignedTo`. Không dùng field này nữa.
- Gán người vào 1 plan phải qua **endpoint riêng, chưa từng được tài liệu hóa**:
  `POST /api/v1/schedule-plans/:id/assignees` body `{ "userId": string, "role": "LEAD" | "TECHNICAL" }`
  — trả lại **full `SchedulePlan`** kèm `assignees[]` mới nhất, lỗi `{code:'ALREADY_ASSIGNED'}` nếu gán
  trùng 1 người 2 lần vào cùng 1 plan. Đã xác nhận hoạt động thật (tạo `PLN-004` cho `ORD-001`, gán 2
  người `LEAD`+`TECHNICAL`, `GET` lại đúng cả 2 — đã hủy plan test ngay sau khi xác nhận).
- Modal gọi tuần tự: `createSchedulePlan()` (không gửi `assignedTo`) → lấy `planId` → `Promise.all` gọi
  `addAssignee(planId, {userId, role})` cho từng người đã chọn. Role gửi lên map từ `users.role` thật
  (`LEADER → 'LEAD'`, `TECHNICAL → 'TECHNICAL'`), không phải role tự chọn tay trên UI.
- Đã cập nhật `types/schedulePlan.ts` (thêm `AddScheduleAssigneePayload`, sửa comment đầu file từng ghi
  sai "không còn khái niệm nhiều người") và `schedulePlanApiService.addAssignee()`.
- **Chưa làm**: không có nút "Xóa nhân sự khỏi plan đã tạo" trên UI dù `DELETE
  /schedule-plans/:id/assignees/:userId` cũng đã xác nhận hoạt động qua `curl` — ngoài phạm vi nút "Tạo
  lịch trình", để dành cho nhu cầu "sửa phân công" sau này nếu cần.

## 10. Tổng hợp — đã chốt vs. còn cần Backend xác nhận

### 10.1 Đã chốt hướng (2026-07-20) — Backend có thể bắt đầu implement theo đúng mô tả ở mục tương ứng

1. **Đọc danh sách (mục 2)**: bỏ `.find()` lấy 1 plan, đổi sang đọc toàn bộ mảng
   `GET /schedule-plans?orderId=:id` — mỗi dòng trả về = 1 thẻ hiển thị trực tiếp, không gộp
   `activities[]`/`tasks[]` như mock.
2. **Enum trạng thái (mục 3)**: dùng đúng `ScheduleStatus` thật (`PENDING`/`CONFIRMED`/`IN_PROGRESS`/
   `COMPLETED`/`CANCELLED`) cho badge của từng thẻ, viết lại `TASK_STATUS_META` tương ứng (kèm style mới
   cho `CANCELLED` — mục 8.2).
3. **Danh mục loại việc (mục 5)**: seed thêm `work_tasks` "Khảo sát hiện trường" và "Vận chuyển thiết
   bị" — nối tiếp quyết định đã chốt ở `docs/tiendosukien_api.md` mục 9.1 điểm 5, nay xác nhận cụ thể tab
   này là nơi cần dùng.
4. **Ranh giới vai trò (mục 0, 6, 7)**: 2 nút "Bắt đầu làm việc" và "Tải ảnh thi công" **bỏ khỏi web
   Manager** — đây là hành động Leader Staff ghi nhận qua mobile (`PATCH .../status { IN_PROGRESS }` và
   `POST /evidence/upload` + `PATCH .../status { COMPLETED, evidenceId }` vẫn đúng 2 endpoint đã có sẵn,
   chỉ đổi phía gọi). Web Manager chuyển sang **đọc/xem lại**: badge trạng thái đọc thẳng `status`, ảnh
   minh chứng xem qua `GET /evidence/:id` (mục 7) khi `evidence_id` đã có giá trị.
5. **Hành động ghi thật duy nhất của Manager trên web (mục 6)**: nút mới "Xác nhận kế hoạch" —
   `PATCH /schedule-plans/:id/status { status: 'CONFIRMED' }`, chỉ hiện khi `status === 'PENDING'`, tận
   dụng đúng giá trị `CONFIRMED` sẵn có trong `ScheduleStatus` mà mock hiện tại bỏ qua.
6. **Điều kiện hiện nút "Sửa" (mục 8.1)**: thu hẹp thành `status !== 'IN_PROGRESS' && status !==
   'COMPLETED'` cho khớp ràng buộc đã ghi ở `PUT /schedule-plans/:id`.
7. **Nút "Xóa" → "Hủy" (mục 8.2)**: đổi hẳn sang chuyển `status = 'CANCELLED'` qua
   `PATCH /schedule-plans/:id/status` đã có sẵn — không thêm `DELETE /api/v1/schedule-plans/:id`.
8. **Model đa phân công (mục 4)**: dùng `assignees[]` (join `schedule_plan_assignees` → `users`), bỏ
   `assignedTo: string` đơn trong `types/schedulePlan.ts` — dữ liệu mẫu thật (2 assignee/1 plan, role
   khác nhau) xác nhận model đa phân công đang được dùng thật.
9. **Số điện thoại người phụ trách (mục 4)**: Backend join sẵn `phone` vào từng phần tử `assignees` của
   response `GET /schedule-plans`, không bắt FE gọi round-trip riêng `GET /users/:id` cho từng assignee.
10. **Giờ thực tế check-in/check-out (mục 1)**: thêm 2 cột nullable mới `schedule_plans.actual_start_time`/
    `actual_end_time`, tách biệt khỏi `start_time`/`end_time` kế hoạch — Backend ghi khi mobile chuyển
    `status → IN_PROGRESS`/`COMPLETED`. Quyết định này cần đồng bộ lại vào
    `docs/tiendosukien_api.md` mục 9.2 điểm 1 (cùng câu hỏi, áp dụng chung 2 tab).
11. Gọi API qua đúng lớp `services/*.service.ts` đã có (`schedulePlanApiService`, `workTaskApiService`,
    `evidenceApiService`, `userApiService`) theo CLAUDE.md mục 4, không tạo lời gọi `axios`/`fetch` mới
    trong component.

### 10.2 Còn cần Backend xác nhận chính thức

Không còn mục nào tại thời điểm 2026-07-20 — toàn bộ câu hỏi mở của tài liệu này đã được chốt hướng ở
mục 10.1 sau buổi làm việc cùng ngày. Nếu Backend phản hồi khác với hướng đã chọn ở bất kỳ điểm nào
(đặc biệt điểm 8-10, phụ thuộc trực tiếp cách backend cài đặt `schedule_plan_assignees`/cột giờ thực tế),
cập nhật lại mục tương ứng thay vì chỉ sửa ở đây.
