# API cho tab "Tiến độ sự kiện" (trang chi tiết đơn đặt)

> Phạm vi tài liệu này: **chỉ** tab `lifecycle` ("Tiến độ sự kiện") của trang chi tiết 1 đơn đặt — khối
> banner "Hồ sơ giám sát tiến độ sự kiện" (kèm số đếm "Tiến độ chung N/5 Mốc") và 6 mốc thời gian dạng
> timeline dọc: **Mốc 1** Khởi tạo đơn & khai lập hợp đồng, **Mốc 2** Xác nhận cọc & khảo sát hiện
> trường, **Mốc 3** Lập kế hoạch & thi công hạ tầng kỹ thuật, **Mốc 4** Vận hành chạy chương trình sự
> kiện (Live Show), **Mốc 5** Quyết toán đối soát & nghiệm thu tháo dỡ, **Mốc 6** Đóng đơn hàng — đúng
> như 2 ảnh mẫu cung cấp (ảnh 1: banner + Mốc 1/2/3, ảnh 2: Mốc 4/5). Trang dùng chung layout ở cả
> `/manager/orders/[id]` và `/admin/orders_audit/[id]` (mirror 1:1, chỉ khác tiền tố route).
>
> **Không** bao gồm 5 tab còn lại của cùng trang. Tab "Tổng quan sự kiện" đã có tài liệu riêng ở
> [`docs/tongquansukien_api.md`](tongquansukien_api.md) — nhiều phát hiện ở đó (vấn đề định danh
> `order_id`/`order_code`, round-trip lấy `customer`, và đặc biệt **mục 5 "Phân công khảo sát báo giá"**)
> áp dụng trực tiếp cho tab này nữa, được tham chiếu lại thay vì lặp lại toàn bộ.
>
> Nguồn tham chiếu:
> - FE: `src/app/manager/orders/[id]/page.tsx` (dòng 86-105 khai báo tab + `LIFECYCLE_STEPS`, dòng
>   305-446 các handler `handleApproveDeposit`/`handleOpenSurveyModal`/`handleActivateLiveShow`/
>   `handleChecklistChange`/`handleSettleAndClose`/`handleCloseOrder`, dòng 664-1016 toàn bộ JSX 6 mốc),
>   `src/app/admin/orders_audit/[id]/page.tsx` (bản mirror), `src/mocks/db/orders.ts`
>   (`AdminOrderRow`, `LIVE_SHOW_CHECKLIST_ITEMS`, `updateAdminOrder`, `updateAdminOrderLiveChecklist`,
>   `closeAdminOrder`), `src/mocks/db/schedulePlans.ts` (`SchedulePlan`, `PlanWorkTask`, `TaskStatus`,
>   `TASK_STATUS_META`, `getAdminSchedulePlans`), `src/types/order.ts`, `src/types/schedulePlan.ts`,
>   `src/types/workTask.ts`, `src/types/survey.ts`, `src/types/payment.ts`, `src/types/settlement.ts`,
>   `src/services/order.service.ts`, `payment.service.ts`, `settlement.service.ts`,
>   `schedulePlan.service.ts`, `workTask.service.ts`, `survey.service.ts`, `evidence.service.ts`.
> - DB thật: đối chiếu trực tiếp qua MySQL MCP ngày 2026-07-20 (cùng phiên với
>   `docs/tongquansukien_api.md`) — `SHOW CREATE TABLE orders/deposits/settlements/work_tasks/
>   schedule_plans/schedule_plan_assignees/evidences/survey_reports/order_items/items/item_types/
>   item_categories/users`; dữ liệu mẫu thật: 1 order (`ORD-001`, `order_status = CONFIRMED`,
>   `payment_status = UNPAID`, `total_amount = 1.600.000đ`), 1 deposit (`amount = 800.000đ`, đúng 50%,
>   `status = PENDING`), 1 settlement (`status = DRAFT`, `final_amount = 800.000đ`), 1 schedule_plan
>   (`task = "Lắp đặt thiết bị"`, `status = IN_PROGRESS`), 2 order_items thuộc 2 category khác nhau
>   ("Âm thanh", "Ánh sáng") — dùng làm căn cứ ở mục 3 và mục 5.
> - `docs/api/` **không tồn tại trong repo hiện tại** — dùng comment đầu từng file `types/*.ts` (đối
>   chiếu trực tiếp `prisma/schema.prisma`/`*.route.ts`/`*.service.ts` của backend ngày 2026-07-06) làm
>   căn cứ chính, giống các tài liệu trước.

## 0. Base URL & Auth

- Base path: `/api/v1`, JWT Bearer theo `AuthContext` hiện có.
- Toàn bộ hành động ghi (xác nhận cọc, xác nhận khảo sát, kích hoạt live show, tick checklist, quyết
  toán, đóng đơn) theo CLAUDE.md mục 1 **chỉ Manager được làm** — bản Admin (`/admin/orders_audit/[id]`)
  nên là read-only dù FE hiện chưa phân biệt (giống ghi chú ở `docs/tongquansukien_api.md` mục 0).

## 1. Banner "Hồ sơ giám sát tiến độ sự kiện" — không có endpoint riêng

Số đếm "Tiến độ chung N/5 Mốc" tính hoàn toàn phía client từ dữ liệu đã lấy được ở các mốc bên dưới
(`paymentStatus`, `surveyAssignment`, `status`) — không cần gọi thêm API. **Lưu ý cho FE khi build lại
bằng dữ liệu thật**: công thức hiện tại (dòng 680-687) đếm trên thang **5** trong khi UI liệt kê **6 mốc**
("Mốc 6: Đóng đơn hàng" không được tính vào N/5) — đây là sai lệch có sẵn trong code hiện tại (denominator
lẽ ra phải là 6, hoặc Mốc 6 cố ý không tính vì là hành động thủ công cuối cùng chứ không phải "tiến độ vận
hành") — cần Product xác nhận lại ý đồ trước khi giữ nguyên logic đếm này.

## 2. Mốc 1: Khởi tạo đơn & khai lập hợp đồng (luôn "Hoàn thành")

| Trường UI | Nguồn thật | Ghi chú |
|---|---|---|
| Mã đơn (`DD0001`) | `GET /api/v1/orders/:id` → `orderCode` | Theo mục 1 `docs/tongquansukien_api.md`: hiển thị `orderCode`, không phải `orderId` (UUID) dùng để điều hướng. |
| Giá trị đơn hàng | `GET /api/v1/orders/:id` → `totalAmount` | Khớp trực tiếp (`orders.total_amount`). |
| Khách hàng chủ quản | `GET /api/v1/customers/:customerId` → `customerName` | Round-trip 2 lời gọi — vấn đề đã ghi ở `docs/tongquansukien_api.md` mục 4, không lặp lại ở đây. |
| Điều phối viên | `GET /api/v1/orders/:id` → `createdBy` | **Đã chốt**: dùng thẳng `orders.created_by` (người tạo đơn) làm "Điều phối viên", không thêm cột `coordinator_id` riêng. Mock hiện lấy `row.coordinatorName` từ 1 pool tên giả (`COORDINATOR_POOL`), không gắn với dữ liệu order — cần đổi sang đọc `createdBy`. Lưu ý: `GET /orders/:id` hiện chỉ trả `createdBy` dạng ID thô (`types/order.ts` dòng 38, không phải object join sẵn) — Backend cần join thêm tên (vd `createdByName`) vào response, hoặc FE tự gọi thêm `GET /api/v1/users/:id`. |
| Hạng mục thiết bị: "N nhóm thiết bị" | **Không tính được từ response hiện tại** | Xem mục 6 — cần join thêm category vào `orderItems`. |

## 3. Mốc 2: Xác nhận cọc & khảo sát hiện trường

Mốc này coi là "Hoàn thành" khi **cả 2 việc dưới đây cùng xong** — khớp đúng field đã có sẵn ở backend,
không cần thêm cột trạng thái tổng hợp riêng cho "Mốc 2".

### 3.1 Thu tiền tạm ứng đặt cọc 50%

| # | Endpoint | Dùng cho | Ghi chú |
|---|---|---|---|
| 1 | `GET /api/v1/orders/:orderId/deposits` | Đọc khoản cọc hiện có (số tiền, trạng thái) | **Đã có sẵn** (`paymentApiService.getOrderDeposits`). Trả `Deposit[]` — cần lấy bản ghi mới nhất/`status='PENDING'` để hiển thị và lấy `depositId` cho bước xác nhận. |
| 2 | `PUT /api/v1/deposits/:depositId` `{ "status": "SUCCESS" }` | Nút "Xác nhận đã nhận cọc 50%" | **Đã có sẵn** (`paymentApiService.updateDepositStatus`). Backend tự set `approvedBy`/`approvedAt`/`paymentDate` và cập nhật `orders.payment_status = DEPOSITED` — khớp đúng điều kiện `isDeposited` UI đang dùng (`row.paymentStatus === 'DEPOSITED'`), **không cần** FE tự gọi thêm `PUT /orders/:id/status`. |

**2 phát hiện cần chốt trước khi nối thật:**

1. **Sai lệch % cọc trong mock**: `AdminOrderRow.depositAmount` hiện tính `= totalPrice * 0.3` (30%,
   `mocks/db/orders.ts` dòng 271) trong khi label UI ghi cứng "Thu tiền tạm ứng đặt cọc **50%**" — dữ liệu
   mẫu thật trong DB (`deposits.amount = 800.000đ` / `orders.total_amount = 1.600.000đ`) đúng là 50%,
   khớp label UI. Khi nối API thật, **bỏ hẳn công thức tính `depositAmount` phía client**, đọc thẳng
   `amount` từ response `GET /orders/:orderId/deposits` (bản ghi cọc do backend tạo theo
   `business_policies`/chính sách cọc, không tự suy ra tỉ lệ ở FE).
2. **Trường hợp chưa có khoản cọc nào** (`deposits` rỗng): mock không xử lý case này (`depositAmount`
   luôn có giá trị tính sẵn). Thực tế khoản cọc phải được tạo trước đó (`POST /orders/:orderId/deposits`
   — thường ở bước lập báo giá/xác nhận đơn, ngoài phạm vi tab này) — **cần Product xác nhận**: nếu mở
   tab "Tiến độ sự kiện" mà đơn chưa có `deposits` nào, ô này hiển thị gì (ẩn nút xác nhận + thông báo
   "Chưa có yêu cầu cọc", hay tự tạo cọc ngay tại đây bằng `POST /orders/:orderId/deposits`)?

### 3.2 Khảo sát hiện trường

Nút "Xác nhận đã khảo sát" (`handleOpenSurveyModal`) mở modal nhập `assigneeName`/`date`/`time`/`notes`,
lưu vào `row.surveyAssignment` — **là cùng 1 field mock với khối "Phân công khảo sát báo giá"** ở tab
Tổng quan (`docs/tongquansukien_api.md` mục 5). Nghĩa là đây chỉ là **1 điểm hiển thị/thao tác khác** của
đúng 1 vấn đề kiến trúc đã ghi nhận ở tài liệu kia — **không lặp lại phân tích đầy đủ ở đây**, chỉ nêu 2 ý
khác biệt riêng của tab này:

**Đã chốt hướng (A)** — seed thêm `work_tasks` row "Khảo sát hiện trường" (và "Vận chuyển" nếu tab Lịch
trình cần), dùng đúng model thật `schedule_plans` + `schedule_plan_assignees` cho việc phân công, và
`survey_reports` cho kết quả/xác nhận đã khảo sát — thay vì hướng (B) bỏ hẳn khối này khỏi tab Tổng quan.
Lý do chọn (A): giữ được đúng luồng thao tác đang có trên UI (Manager phân công trước, xác nhận sau) mà
không phải thiết kế lại điều hướng sang 1 khu vực "Khảo sát" riêng; chi phí triển khai cũng thấp hơn hẳn —
chỉ cần Backend seed 1-2 dòng `work_tasks` tĩnh, không phải đổi luồng màn hình. Cần cập nhật lại
`docs/tongquansukien_api.md` mục 5 để khớp quyết định này (xem ghi chú ở file đó).

- Nhãn nút ở tab này là "Xác nhận đã khảo sát" (xác nhận việc **đã xong**), khác nhãn "Phân
  công"/"Đổi phân công" (đặt lịch **trước khi** làm) ở tab Tổng quan — cho thấy 2 nơi trong cùng 1 trang
  đang không thống nhất ý nghĩa của cùng 1 field (`surveyAssignment`): vừa là "lịch đã đặt" vừa là "việc
  đã hoàn thành". Nếu đi theo hướng (A) đã đề xuất ở tài liệu kia (dùng `schedule_plans` +
  `survey_reports` thật), điều kiện `isSurveyed` ở Mốc 2 tab này nên đổi thành **có `survey_reports` với
  `status = 'CONFIRMED'`** (khảo sát đã nộp và Manager xác nhận — dùng đúng
  `surveyApiService.confirmSurveyReport(id, { status: 'CONFIRMED' })`, **đã có sẵn**), không phải chỉ "đã
  có lịch hẹn" như field mock hiện tại ngụ ý.
- Text hiển thị khi đã xong ("Người khảo sát: ... — ngày · giờ") cũng gặp đúng vấn đề "`GET
  /survey-reports/:id` không join tên người khảo sát" đã ghi ở tài liệu kia — cần Backend join thêm hoặc
  FE tự ghép qua `GET /api/v1/users/:id`.

## 4. Mốc 3: Lập kế hoạch & thi công hạ tầng kỹ thuật

| Trường UI | Nguồn thật | Ghi chú |
|---|---|---|
| Trạng thái mốc (Hoàn thành / Chưa bắt đầu) | `GET /api/v1/orders/:id` → `orderStatus` (`IN_PROGRESS`/`COMPLETED`) | Không cần endpoint riêng. |
| Danh sách "Lịch trình phân công kỹ thuật" | `GET /api/v1/schedule-plans?orderId=:id` | **Đã có sẵn** (`schedulePlanApiService.getSchedulePlans`) nhưng shape trả về **không khớp** cách UI đang dùng — xem phát hiện dưới. |

**Phát hiện kiến trúc (cùng gốc với `docs/tongquansukien_api.md` mục 5, áp dụng riêng cho khối này):**

1. UI hiện đọc `linkedPlan.tasks` — 1 `SchedulePlan` (mock) chứa **nhiều** `PlanWorkTask` con, mỗi task có
   `title`/`assignee`/`status`/`actualStartTime`/`actualEndTime` riêng. Model thật: `schedule_plans` là
   **1 dòng phẳng = 1 order + 1 task (loại việc) + khả năng nhiều `schedule_plan_assignees`** (không có
   khái niệm "nhiều task con trong 1 plan"). Muốn hiển thị đúng danh sách "công việc kỹ thuật" như UI hiện
   tại, FE phải đọc **nhiều dòng `schedule_plans`** cùng `orderId` (mỗi dòng là 1 việc: "Lắp đặt thiết
   bị", "Tháo dỡ thiết bị", ...) thay vì 1 plan chứa nhiều task — cần đổi hẳn cách map dữ liệu, không phải
   chỉ đổi tên field.
2. `task.assignee` (1 chuỗi tên) không khớp model thật (`schedule_plan_assignees` nhiều người/role
   `LEAD`/`TECHNICAL` cho cùng 1 `plan_id`) — **đã ghi ở tài liệu kia**, áp dụng y hệt ở đây.
3. **Enum trạng thái task không khớp**: mock dùng `TaskStatus = 'TODO' | 'ASSIGNED' | 'IN_PROGRESS' |
   'COMPLETED' | 'BLOCKED'` (`TASK_STATUS_META`, `mocks/db/schedulePlans.ts` dòng 20), DB thật dùng
   `schedule_plans.status = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'` — không
   có `TODO`/`ASSIGNED`/`BLOCKED`, không có `CANCELLED` ở phía mock. Cần viết lại `TASK_STATUS_META` theo
   đúng `ScheduleStatus` thật (`types/schedulePlan.ts`) khi nối API.
4. **`actualStartTime`/`actualEndTime` không có cột thật tương ứng**: mock phân biệt rõ giờ **kế hoạch**
   (không hiển thị ở UI này) và giờ **thực tế Leader Staff bắt đầu/hoàn thành** (`startAdminScheduleTask`
   set `actualStartTime`, confirm evidence set `actualEndTime`). DB thật `schedule_plans` chỉ có **đúng 1
   cặp cột** `start_time`/`end_time` — không có cột "thực tế" riêng, và `UpdateSchedulePlanStatusPayload`
   (`PATCH /schedule-plans/:id/status`) cũng không nhận field thời gian, chỉ `{ status, notes,
   evidenceId }`. Nghĩa là khi Leader Staff chuyển 1 plan sang `IN_PROGRESS`/`COMPLETED` qua endpoint này,
   **không có nơi nào lưu lại giờ bắt đầu/kết thúc thực tế** khác với `start_time`/`end_time` đã đặt lúc
   tạo lịch (kế hoạch). Dòng chữ "Giờ bắt đầu/hoàn thành thực tế do Leader Staff cập nhật tại hiện
   trường" ở UI hiện tại **không thể hiện thực hóa được** với schema hiện có. **Cần Backend chọn 1
   hướng**: (a) cho phép `PATCH .../status` nhận thêm `actualStartTime`/`actualEndTime` và thêm 2 cột
   tương ứng vào `schedule_plans`, hoặc (b) chấp nhận ghi đè `start_time`/`end_time` gốc bằng giờ thực tế
   (mất thông tin "kế hoạch ban đầu" — không khớp mục đích cột `start_time NOT NULL` được set khi tạo
   lịch).

## 5. Mốc 4: Vận hành chạy chương trình sự kiện (Live Show)

| Trường UI | Nguồn thật | Ghi chú |
|---|---|---|
| Ngày tổ chức chính thức | `GET /api/v1/orders/:id` → `eventDate` | Khớp trực tiếp, dùng `formatDate()`. |
| Nút "Kích hoạt chạy Live Show" | `PUT /api/v1/orders/:orderId/status` `{ "orderStatus": "IN_PROGRESS" }` | **Đã có sẵn** (`orderApiService.updateOrderStatus`) — cùng endpoint đã tài liệu hóa ở `docs/tongquansukien_api.md` mục 6, chỉ khác giá trị `orderStatus`. |
| Trạng thái "Hệ thống đang chạy trực tiếp..." / "Sự kiện đã kết thúc tốt đẹp" | Suy ra client-side từ `orderStatus` (`IN_PROGRESS`/`COMPLETED`) | Không cần endpoint riêng. |

**Checklist an toàn & kỹ thuật sân khấu (4 mục: `backdrop`/`soundTest`/`powerBackup`/`operatorReady`) —
không có bảng nào lưu dữ liệu này trong DB thật.** Đối chiếu `SHOW TABLES` (24 bảng, mục nguồn tham chiếu
ở đầu file) — không có bảng checklist/task-item nào, `orders` cũng không có cột JSON nào tương đương
`liveChecklist` (`Record<string, boolean>`) mock đang dùng.

**Đã chốt hướng (A)** — thêm 1 cột JSON trên `orders` (vd `orders.live_show_checklist JSON`) lưu thẳng
`{ backdrop: boolean, soundTest: boolean, powerBackup: boolean, operatorReady: boolean }`, kèm 1 endpoint
mới `PATCH /api/v1/orders/:orderId/live-checklist` nhận `{ key, checked }` (hoặc cả object) và trả lại
`liveChecklist` mới nhất. Lý do chọn (A) thay vì (B)/(C): đây là checklist thao tác nhanh tại chỗ ngay
trước giờ diễn ra (không phải 1 biên bản chính thức cần lưu vết ai/lúc nào tick từng mục như các mốc
cọc/settlement/hỏng-mất — Manager vẫn chịu trách nhiệm chung qua việc xác nhận Mốc 4 rồi mới bấm "Kích
hoạt chạy Live Show"/tiếp tục sang Mốc 5), và không tận dụng `work_tasks`/`schedule_plans` (C) vì ngữ nghĩa
lệch hẳn — checklist không có người phụ trách hay giờ bắt đầu/kết thúc riêng như 1 `schedule_plans` row.
Phương án (B) (bảng phụ có audit `checked_by`/`checked_at`) bị loại vì chi phí triển khai không tương xứng
với giá trị nghiệp vụ của 1 checklist tạm thời, ngắn hạn.

## 6. Mốc 5: Quyết toán đối soát & nghiệm thu tháo dỡ

| Trường UI | Nguồn thật | Ghi chú |
|---|---|---|
| Số dư còn cần quyết toán | `GET /api/v1/orders/:orderId/settlement` → `finalAmount` | **Không tự tính ở client.** Mock hiện tính `remainingAmount = totalPrice - depositAmount` (dòng 445) — sai với thiết kế backend thật, nơi **server tự tính** `finalAmount = totalAmount + additionalFee + compensation - depositAmount(SUCCESS) - discount` (comment `types/settlement.ts` dòng 16). FE chỉ nên đọc `finalAmount` từ response, không tự cộng trừ lại. |
| Trạng thái thanh toán | `GET /api/v1/orders/:id` → `paymentStatus` | Khớp trực tiếp, dùng `PAYMENT_STATUS_META`. |
| Nút "Xác nhận thu nốt ... & Quyết toán" | Xem luồng 3 bước dưới | **Không phải 1 lệnh đơn** như `handleSettleAndClose` (mock) hiện làm — mock chỉ gọi 1 hàm set thẳng `status: 'COMPLETED', paymentStatus: 'PAID'`, không khớp mô hình `Settlement` có state machine riêng (`DRAFT → AGREED → REQUESTED → PAID → CONFIRMED`). |

**Luồng thật cần dùng (đã có sẵn service, nhưng UI hiện tại chưa gọi đúng thứ tự) — đã chốt đủ 4 bước,
kể cả bước 4 (không chờ giả định backend tự làm hộ):**

1. `GET /api/v1/orders/:orderId/settlement` — đọc bản ghi settlement mới nhất (có sẵn từ lúc order
   chuyển `IN_PROGRESS`, ví dụ dữ liệu mẫu thật đã có 1 dòng `status='DRAFT'`) hoặc `null` nếu chưa có.
2. Nếu chưa có/cần điều chỉnh: `POST /api/v1/orders/:orderId/settlement` `{ additionalFee?, compensation?,
   discount?, paymentMethod?, notes? }` (**đã có sẵn**, `settlementApiService.recordSettlement`) — backend
   tự tính lại `finalAmount`, trả về `{ settlementId }`.
3. `PUT /api/v1/settlements/:settlementId/confirm` `{ "status": "CONFIRMED" }` (**đã có sẵn**,
   `settlementApiService.confirmSettlement`) — đây mới là hành động khớp nghĩa "Xác nhận thu nốt &
   Quyết toán" trên UI.
4. **Đã chốt**: ngay sau bước 3, FE **luôn tự gọi thêm** `PUT /api/v1/orders/:orderId/status`
   `{ "orderStatus": "COMPLETED" }`, rồi đọc lại `GET /orders/:id` để lấy `paymentStatus` mới nhất thay vì
   tự suy đoán — không chờ giả định backend tự cập nhật `orders.payment_status = 'PAID'`/
   `orders.order_status = 'COMPLETED'` khi confirm settlement (comment đầu `types/settlement.ts` không ghi
   rõ hành vi này, khác hẳn `types/payment.ts` dòng 36 ghi rất rõ cho deposit). Nếu backend sau này tự làm
   việc này khi confirm settlement thì bước 4 chỉ là no-op (order đã ở đúng trạng thái) — an toàn để giữ
   nguyên vĩnh viễn trong luồng FE, không cần gỡ bỏ ngay cả khi Backend xác nhận có tự làm.

Bước 4 đảm bảo Mốc 5 không báo "Tất toán hoàn thành" (đọc từ `settlement.status`) trong khi
`orders.payment_status` vẫn là `UNPAID`/`DEPOSITED` (điều kiện `isCompletedAndPaid` UI đang dùng
`row.status === 'COMPLETED' && row.paymentStatus === 'PAID'`, đọc trực tiếp từ `orders`, không đọc từ
`settlement.status`). Backend vẫn có thể tối ưu thêm (tự làm bước 4 phía server, tránh 2 lượt gọi từ FE)
nhưng đây không còn là điều kiện chặn để FE code luồng này.

## 7. Mốc 6: Đóng đơn hàng

**Không có cột thật lưu trạng thái "đã đóng đơn"** — đã ghi nhận trước ở `docs/tongquansukien_api.md`
mục 6 ("badge 'Đã đóng đơn' ở header... quyết định xử lý thuộc phạm vi tab Tiến độ sự kiện — nêu lại khi
viết tài liệu cho tab đó"), đối chiếu lại `SHOW CREATE TABLE orders` lần nữa trong phiên này xác nhận
**vẫn không có** `closed_at`/`closed_by` (hay bất kỳ cột tương đương nào, kể cả giá trị enum `order_status`
mới cho trạng thái "đã đóng").

| Trường UI | Nguồn thật | Ghi chú |
|---|---|---|
| Điều kiện "Sẵn sàng đóng" | `orderStatus === 'COMPLETED' && paymentStatus === 'PAID'` | Suy ra client-side từ dữ liệu Mốc 4/5, không cần endpoint riêng. |
| Nút "Đóng đơn hàng" | **Chưa có endpoint** | Xem đề xuất dưới. |
| "Đã đóng bởi {closedBy} ngày {closedAt}" | **Chưa có nguồn dữ liệu thật** | Cần cột mới. |

**Đã chốt hướng (A)**: thêm 2 cột nullable `orders.closed_at` (`timestamp`), `orders.closed_by` (FK
`users.user_id`) + endpoint mới `PUT /api/v1/orders/:orderId/close` (không có body, hoặc `{ notes? }`),
điều kiện hợp lệ phía backend: `order_status = 'COMPLETED' AND payment_status = 'PAID' AND closed_at IS
NULL`. Chọn (A) thay vì (B) (thêm `CLOSED` vào enum `order_status`) vì: "đóng đơn" là 1 cờ độc lập lớp
trên `COMPLETED`, không ảnh hưởng mọi chỗ khác đang so sánh `order_status` (dashboard, báo cáo, filter
danh sách đơn...) — trong khi (B) buộc phải rà soát lại **mọi** nơi FE/BE đang switch theo 5 giá trị enum
hiện tại (`BOOKING_STATUS_META`, filter danh sách đơn, dashboard đếm theo trạng thái...) để thêm case
`CLOSED`, phạm vi ảnh hưởng rộng hơn hẳn mà không mang lại lợi ích tương xứng.

Sau khi đóng đơn, UI hiện tại còn ngụ ý khóa toàn bộ chỉnh sửa ("không thể chỉnh sửa sau khi đóng" —
comment dòng 995) — cần Backend đảm bảo các endpoint ghi khác (`PUT /orders/:id/status`, `PUT
/orders/:id/items`, tạo/sửa `schedule_plans`...) tự chặn (403) khi `closed_at IS NOT NULL`, không chỉ dựa
vào FE ẩn nút.

## 8. Mốc 1 (tiếp) — "N nhóm thiết bị" cần join thêm category

Nhắc lại từ mục 2: label "Hạng mục thiết bị: **4 nhóm thiết bị**" trong ảnh mẫu ngụ ý đếm theo **số
category khác nhau** (vd "Âm thanh", "Ánh sáng"...), không phải số dòng `order_items` thô. Đối chiếu dữ
liệu mẫu thật: `order_items` của `ORD-001` có 2 dòng, item join qua `items.type_id → item_types.category_id
→ item_categories.category_name` cho ra 2 category khác nhau ("Âm thanh", "Ánh sáng") — 4-cấp join, không
có sẵn trong response `GET /orders/:id` hiện tại (`OrderItem.item` chỉ có `{ itemName }`, không có
category, theo `types/order.ts` dòng 18).

**Đã chốt hướng (B)** — giữ đúng nghĩa "nhóm theo category" như label hiện tại (không đổi text UI): cần
Backend join thêm `item.category` (`{ categoryId, categoryName }`) vào từng phần tử `orderItems` trả về ở
`GET /orders/:id` (mở rộng `OrderItem.item` trong `types/order.ts` từ `{ itemName }` thành `{ itemName,
category: { categoryId, categoryName } }`), FE tự `new Set(orderItems.map(i =>
i.item.category.categoryId)).size` để đếm số nhóm khác nhau — không đổi hướng (A) vì "nhóm thiết bị" mang
đúng ý nghĩa nghiệp vụ hữu ích cho Manager (biết đơn có bao nhiêu loại hạng mục cần chuẩn bị, không chỉ số
dòng thô).

## 9. Tổng hợp — đã chốt vs. còn cần Backend xác nhận

### 9.1 Đã chốt hướng (2026-07-20) — Backend có thể bắt đầu implement theo đúng mô tả ở mục tương ứng

1. **Checklist Live Show (mục 5)**: hướng (A) — thêm cột `orders.live_show_checklist` (JSON) + endpoint
   `PATCH /api/v1/orders/:orderId/live-checklist`.
2. **Đóng đơn hàng (mục 7)**: hướng (A) — thêm `orders.closed_at`/`orders.closed_by` + endpoint
   `PUT /api/v1/orders/:orderId/close`.
3. **Điều phối viên (mục 2)**: dùng thẳng `orders.created_by`, không thêm cột riêng — Backend join thêm
   tên (`createdByName`) vào `GET /orders/:id` để FE khỏi gọi thêm round-trip.
4. **Label "N nhóm thiết bị" (mục 8)**: hướng (B) — Backend join thêm `item.category` vào `orderItems`
   trong response `GET /orders/:id`.
5. **Khảo sát hiện trường (mục 3.2, áp dụng chung với `docs/tongquansukien_api.md` mục 5)**: hướng (A) —
   seed thêm `work_tasks` row "Khảo sát hiện trường" (và "Vận chuyển" nếu tab Lịch trình cần), dùng
   `schedule_plans` + `schedule_plan_assignees` cho phân công, `survey_reports` cho kết quả/xác nhận. Đã
   cập nhật lại kết luận ở `docs/tongquansukien_api.md` mục 5 để khớp quyết định này.
6. Bỏ công thức tính `depositAmount = totalPrice * 0.3` và `remainingAmount` tự tính ở client (mục 3.1,
   mục 6) — đọc thẳng `amount`/`finalAmount` từ response backend, không tự cộng trừ lại ở FE.
7. Viết lại cách FE đọc `schedule_plans` ở Mốc 3 (mục 4) theo đúng model 1-plan-1-task-nhiều-assignee
   thật (nhiều dòng `schedule_plans` cùng `orderId`, không phải 1 plan chứa nhiều task con như mock);
   đồng bộ lại `TaskStatus`/`TASK_STATUS_META` theo đúng enum `ScheduleStatus` thật.
8. **(mục 6)** Sau `PUT /settlements/:id/confirm`, FE **luôn tự gọi thêm** `PUT /orders/:id/status`
   `{ "orderStatus": "COMPLETED" }` rồi đọc lại `GET /orders/:id` — không chờ giả định backend tự cập nhật
   `orders.payment_status`/`order_status` khi confirm settlement. Quyết định này áp dụng vĩnh viễn cho
   luồng FE dù sau này Backend có tự làm hộ hay không (gọi thêm khi đó chỉ là no-op).
9. Gọi API qua đúng lớp `services/*.service.ts` đã có (`orderApiService`, `paymentApiService`,
   `settlementApiService`, `schedulePlanApiService`, `surveyApiService`) theo CLAUDE.md mục 4, không tạo
   lời gọi `axios`/`fetch` mới trong component.

### 9.2 Còn cần Backend xác nhận chính thức (chưa thể tự chốt, phụ thuộc cách backend đã/sẽ cài đặt)

1. **(mục 4)** Cách lưu giờ bắt đầu/kết thúc **thực tế** của `schedule_plans` (khác giờ kế hoạch đã đặt
   lúc tạo lịch) — cần Backend chọn thêm cột `actualStartTime`/`actualEndTime` riêng, hay chấp nhận ghi
   đè `start_time`/`end_time` gốc (mất thông tin kế hoạch ban đầu). Chưa có đủ căn cứ để tự đề xuất 1
   hướng vì ảnh hưởng tới ý nghĩa cột `start_time NOT NULL` hiện có — cần Backend cho biết cột này đang
   được dùng ở những màn hình/luồng nào khác trước khi đổi.
