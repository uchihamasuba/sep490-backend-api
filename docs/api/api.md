# API cho BNWEMS Staff Frontend (app di động Leader/Technical)

> Tài liệu này liệt kê **toàn bộ API mà app `bnwems-staff-frontend` cần** để thay thế lớp mock hiện tại
> (`src/mocks/*`, `src/context/*`). Được tổng hợp bằng cách đối chiếu 3 nguồn:
> 1. Code FE thật (`src/types/*`, `src/mocks/*`, `src/context/*`, `src/components/tasks/*`, các trang
>    `src/app/staff/**`) — để biết chính xác field/hành vi UI cần.
> 2. Schema DB thật `bnwems` (MySQL, đọc qua MCP `mcp__mysql__mysql_query` ngày 2026-07-22).
> 3. Backend thật đang chạy tại `D:\sep490-backend-api` (route prefix `/api/v1`, module
>    `src/modules/{identity,sales,operations,inventory,mobile,shared}`) — **đã có sẵn rất nhiều endpoint
>    dùng được ngay**, tài liệu này chỉ ra rõ cái nào dùng được, cái nào cần chỉnh, cái nào chưa có.

**Trạng thái hiện tại của FE**: 100% mock — chưa có file `services/*ApiService.ts` nào, chưa gọi `fetch`
tới backend thật ở bất kỳ đâu (kể cả đăng nhập, xem `src/mocks/authAccounts.ts`). Toàn bộ dữ liệu đọc/ghi
qua `localStorage` (`src/mocks/db/utils.ts`).

## Chú giải trạng thái

| Ký hiệu | Ý nghĩa |
|---|---|
| ✅ | Backend đã có sẵn, dùng được ngay, khớp đúng nhu cầu FE |
| ⚠️ | Backend đã có nhưng cần chỉnh nhỏ (role, thêm query filter, thêm field) trước khi dùng được |
| ❌ | Backend **chưa có** — cần code mới |

Quy ước chung mọi endpoint bên dưới:
- Base URL: `{BACKEND_HOST}/api/v1`
- Auth: header `Authorization: Bearer <JWT>` (trừ `POST /auth/login`, `POST /auth/forgot-password`)
- Response envelope: `{ "success": true, "data": ..., "meta"?: {...} }` (lỗi: xem `AppError` — không mô tả lại ở đây)
- Role của app này chỉ gồm 2 giá trị: `LEADER`, `TECHNICAL` (không có Admin/Manager — xem `StaffRoleName`, `src/types/auth.ts`)

---

## 1. Đăng nhập / Hồ sơ cá nhân

| Method | Path | Role | Trạng thái |
|---|---|---|---|
| POST | `/auth/login` | public | ✅ |
| GET | `/auth/profile` | mọi role | ✅ |
| PUT | `/auth/profile` | mọi role | ✅ |
| PUT | `/auth/change-password` | mọi role | ✅ |

**Request `POST /auth/login`**: `{ "username": string, "password": string }`
**Response**: `{ token: string, user: { userId, username, fullName, role: { roleId, roleName }, status } }`

### ⚠️ (a) `role.roleName` trả về không khớp `StaffRoleName` phía FE
Backend trả `role.roleName` là `'LEADER_STAFF'` / `'TECHNICAL_STAFF'` (xem `ROLE_MAP` trong
`auth.service.ts`), trong khi FE (`src/types/auth.ts`) định nghĩa `StaffRoleName = 'LEADER' | 'TECHNICAL'`
(dùng để so sánh, hiển thị badge, gate tính năng Leader-only). **Cần thống nhất 1 trong 2 hướng** trước khi
nối API thật: (1) FE đổi lại type để nhận `'LEADER_STAFF' | 'TECHNICAL_STAFF'`, hoặc (2) Backend đổi
`ROLE_MAP` trả đúng `'LEADER' | 'TECHNICAL'`. Trường `user.role` thật của bảng `users` (enum DB) đã sẵn là
`'LEADER'`/`'TECHNICAL'` — hướng (2) ít việc hơn.

`user.userId` (backend) so với `AuthUser.id` (FE) — chỉ khác tên field, map lại khi tích hợp.

---

## 2. Danh mục loại việc

| Method | Path | Role | Trạng thái |
|---|---|---|---|
| GET | `/work-tasks` | mọi role | ✅ |

Trả về đúng 4 dòng `work_tasks` thật (`TSK-SURVEY`/`TSK-SETUP`/`TSK-TEARDOWN`/`TSK-COLLECT`) — khớp
`WorkTaskCatalog` (`src/types/workTaskCatalog.ts`) không cần chỉnh gì.

---

## 3. Kế hoạch được giao (Dashboard / Lịch / Công việc / Chi tiết kế hoạch)

| Method | Path | Role | Trạng thái |
|---|---|---|---|
| GET | `/schedule-plans` | mọi role đã đăng nhập | ⚠️ (xem (b)) |
| GET | `/schedule-plans/:planId` | mọi role | ✅ |
| PATCH | `/schedule-plans/:planId/status` | MANAGER only | ⚠️ (xem (c)) |
| PATCH | `/schedule-plans/:planId/evidence` | LEADER, TECHNICAL | ⚠️ (xem (d), 1 ảnh) |
| POST | `/schedule-plans/:planId/assignees/:userId/check-in` | LEADER, TECHNICAL | ✅ |
| POST | `/schedule-plans/:planId/assignees/:userId/check-out` | LEADER, TECHNICAL | ✅ |

Đây là API lõi của toàn bộ app — tương ứng `SchedulePlan` (`src/types/workTask.ts`), nguồn cho
`TaskContext.myPlans` (dùng ở Dashboard, Lịch, Công việc, Chi tiết kế hoạch, Nhóm của tôi).

### ❌ (b) `GET /schedule-plans` chưa có filter "chỉ plan của tôi"
`listSchedulePlansQuerySchema` (`schedule.validators.ts`) hiện chỉ nhận `orderId/status/taskId/dateFrom/
dateTo/page/limit` — **không có** filter theo `userId`/`assigneeId`. Route cũng không giới hạn role
(`scheduleRouter.get('/')` không có `requireRole`), nghĩa là 1 Leader/Technical gọi API này sẽ nhận **toàn
bộ** schedule_plans trong hệ thống thay vì chỉ các plan họ được phân công — sai với tinh thần
`TaskContext.myPlans` ("chỉ các plan mà tài khoản đang đăng nhập có mặt trong assignees").
**Cần bổ sung** 1 trong 2 hướng:
- Thêm query param `assigneeUserId` (hoặc `mine=true` tự suy ra từ token) vào
  `listSchedulePlansQuerySchema`, lọc theo `schedule_plan_assignees.user_id`.
- Hoặc thêm endpoint riêng `GET /me/schedule-plans`.

Không có hướng nào trong 2 cái trên thì FE buộc phải tải toàn bộ `schedule_plans` hệ thống về máy rồi lọc
client-side — vừa lãng phí băng thông trên di động, vừa lộ dữ liệu plan/khách hàng của người khác.

### ⚠️ (c) Transition trạng thái PENDING→CONFIRMED→IN_PROGRESS→COMPLETED không khớp thiết kế FE
FE (`src/app/staff/tasks/[id]/page.tsx`, hàm `NEXT_STATUS` + nút "Xác nhận kế hoạch"/"Bắt đầu thực
hiện"/"Hoàn thành kế hoạch") giả định **Leader tự bấm nút chuyển trạng thái** ở cả 3 bước. Nhưng theo
comment trong `schedule.routes.ts` (đã chốt ở `docs/api/more-require.md` mục (ae) phía backend, 2026-07-21):
`PATCH /:planId/status` chỉ nhận `CONFIRMED`/`CANCELLED` và **chỉ Manager gọi được**; còn
`IN_PROGRESS`/`COMPLETED` không còn là transition gọi tay nữa — **service tự suy ra** khi assignee LEAD
check-in (→ `IN_PROGRESS`) / check-out (→ `COMPLETED`, cần xác nhận lại logic chính xác này với backend).
**Cần xác nhận lại với backend đội này**: Staff Leader có được chuyển `PENDING → CONFIRMED` bằng tay không,
hay bước "Xác nhận kế hoạch" cũng thuộc về Manager trên web (giống `more-require.md` mục (ae) đã ghi)? Nếu
đúng vậy, FE cần bỏ nút "Xác nhận kế hoạch" và chỉ giữ lại luồng check-in/check-out tự chuyển trạng thái.

### ⚠️ (d) `PATCH /schedule-plans/:planId/evidence` chỉ nhận 1 `evidenceId`
FE (`evidencePhotoUrls: string[]`, mục "Ảnh minh chứng tiến độ hiện trường" ở tab Tổng quan) cho phép thêm
**nhiều ảnh tích luỹ** cho TSK-SETUP/TEARDOWN/COLLECT trước khi hoàn thành. Backend `schedule_plans` chỉ có
1 cột `evidence_id` (1-1 với `evidences`). Xem mục 14 (Ảnh minh chứng) — vấn đề chung cho toàn bộ tài liệu
này, cần chốt hướng trước khi code phần ảnh ở bất kỳ màn nào.

### Response `GET /schedule-plans/:planId` cần có (để khớp `SchedulePlan`)
Cần backend xác nhận response đã join đủ các trường sau chưa (không thấy field tương ứng nào bị loại trừ
tường minh trong code đã đọc, nhưng cần test thực tế qua `curl` trước khi FE code theo):
- `assignees[]` (join `schedule_plan_assignees`, kèm `fullName` join từ `users`)
- `items[]` — join `order_items` where `source = 'INTERNAL'` của `orders.order_id = schedule_plans.order_id`
- `customerName/customerPhone/customerAddress` — join `orders.customer_id → customers`
- `orderCode`, `eventName` — join `orders`
- `supplierTransactions[]` — join `supplier_transactions` theo `order_id`
- Không có sẵn trong response gốc (theo model): `surveyReport`, `fieldPayment`/`deposits`,
  `handoverRecord`, `warehouseMovement`, `internalCollectedReport`, `supplierCollectedReport`, `settlement`
  — các mục này chắc chắn phải gọi endpoint riêng (mục 5–12 bên dưới) rồi FE tự ráp vào state theo `planId`
  / `orderId`, **không** kỳ vọng 1 API trả về tất cả.

---

## 4. Chấm công (Attendance)

| Method | Path | Role | Trạng thái |
|---|---|---|---|
| POST | `/schedule-plans/:planId/assignees/:userId/check-in` | LEADER, TECHNICAL | ✅ |
| POST | `/schedule-plans/:planId/assignees/:userId/check-out` | LEADER, TECHNICAL | ✅ |

Đã có sẵn đúng nhu cầu, khớp bảng `attendances` thật (1 dòng / 1 `assignee_id`, `UNIQUE`). Request check-in:
`{ "checkInEvidenceId"?: string }` — muốn có ảnh check-in thì **gọi `POST /evidence/upload` trước** để lấy
`evidenceId`, rồi mới gọi check-in kèm `checkInEvidenceId` đó (không upload trực tiếp trong request
check-in). Check-out không nhận evidence (đã chốt, không có cột `check_out_evidence_id`).

**Không có GET attendance riêng** — trạng thái check-in/out của 1 assignee chắc chắn phải đọc lồng trong
response của `GET /schedule-plans/:planId` (assignee tương ứng) — cần backend xác nhận field đặt tên gì
trong response (map với `checkInAt/checkInPhotoUrl/checkOutAt` phía FE, `src/types/attendance.ts`).

---

## 5. Khảo sát hiện trường (Survey Report) — chỉ áp dụng TSK-SURVEY

| Method | Path | Role | Trạng thái |
|---|---|---|---|
| POST | `/survey-reports` | LEADER, MANAGER | ✅ |
| GET | `/survey-reports` | MANAGER, ADMIN only | ❌ (xem (e)) |
| GET | `/survey-reports/:surveyId` | MANAGER, ADMIN only | ❌ (xem (e)) |

**Request tạo báo cáo** (field FE ↔ field backend):

| FE (`SurveyReport`) | Backend body | Ghi chú |
|---|---|---|
| — | `orderId` (bắt buộc) | FE lấy từ `plan.orderId` |
| — | `planId` (tùy chọn) | FE nên luôn gửi `plan.planId` |
| — | `surveyDate` (bắt buộc) | FE dùng `new Date().toISOString()` lúc nộp |
| — | `location` (bắt buộc) | FE dùng `plan.location` |
| `area`, `length`, `width` | `area`, `length`, `width` | **Backend bắt buộc khai đủ cả 3 hoặc bỏ hẳn cả 3** — FE hiện validate `canSubmit` yêu cầu cả 3 > 0, đã khớp |
| `entrance` | `entrance` | FE bắt buộc, backend optional — giữ nguyên validate FE |
| `siteConstraints` | `siteConstraints` | |
| `proposedItems` | `proposedItems` | |
| `notes` | `notes` | |
| `evidencePhotoUrls: string[]` | `evidenceId?: string` (**1 giá trị**) | Gap — xem mục 14 |

### ❌ (e) Leader không đọc lại được báo cáo khảo sát của chính mình
`GET /survey-reports` và `GET /survey-reports/:surveyId` giới hạn `requireRole('MANAGER', 'ADMIN')` —
Leader gọi sẽ nhận `403`. Nhưng `SurveyReportSection` cần hiển thị lại báo cáo đã nộp (`initialReport`) khi
Leader quay lại xem chi tiết plan. **Cần bổ sung** 1 trong 2 hướng:
- Nới `requireRole` cho GET để chấp nhận thêm `LEADER` (ít nhất khi tự lọc theo `reported_by = mình` hoặc
  theo `planId` plan họ được phân công).
- Hoặc trả `surveyReport` lồng sẵn trong response `GET /schedule-plans/:planId` (xem mục 3) — Leader không
  cần gọi `/survey-reports` trực tiếp nữa.

Xác nhận (status → `CONFIRMED`) đã đúng: chỉ Manager, ngoài phạm vi app Staff — không cần đổi.

---

## 6. Ghi nhận cọc tại hiện trường (Field Payment / `deposits`) — chỉ TSK-SURVEY

| Method | Path | Role | Trạng thái |
|---|---|---|---|
| POST | `/orders/:orderId/deposits` | MANAGER only | ❌ (xem (f)) |
| GET | `/orders/:orderId/deposits` | MANAGER, ADMIN only | ❌ (xem (f)) |
| PUT | `/deposits/:depositId` (đổi status) | MANAGER only | không dùng ở app Staff |

Bảng `deposits` khớp khá tốt với `FieldPaymentRecord` (`amount`, `payment_method`, `status`,
`evidence_id` — 1 giá trị), nhưng **toàn bộ route hiện chỉ Manager gọi được**.

### ❌ (f) Leader không tạo/xem được deposit tại hiện trường
`FieldPaymentSection` cần Leader (không phải Manager) tạo 1 `deposit` mới ngay khi khách đặt cọc tại buổi
khảo sát, và xem lại deposit đã ghi nhận cho order đó. Cần bổ sung:
1. Cho phép `LEADER` gọi `POST /orders/:orderId/deposits` (ít nhất khi họ là assignee của 1
   `schedule_plans` thuộc `orderId` đó, task `TSK-SURVEY`) — hoặc thêm route riêng dưới `/mobile`.
2. Cho phép `LEADER` gọi `GET /orders/:orderId/deposits` (đọc lại field payment đã ghi nhận) với cùng điều
   kiện phạm vi trên.
3. `depositTargetStatusEnum` hiện chỉ có `SUCCESS/OVERDUE/CANCELLED` cho `PUT /deposits/:id` (Manager) —
   khớp với "Manager xác nhận cọc trên web", app Staff **không cần** gọi PUT này, chỉ tạo (POST) và đọc (GET).

---

## 7. Xuất kho tại hiện trường (Warehouse Movement) — chỉ TSK-SETUP

| Method | Path | Role | Trạng thái |
|---|---|---|---|
| — | — | — | ❌ Chưa có endpoint nào Leader gọi được |

### ❌ (g) Không có API nào để Leader ghi nhận "đã xuất kho tại hiện trường"
`WarehouseMovementSection` cần Leader xác nhận danh sách thiết bị kho doanh nghiệp đã thực xuất tại buổi
lắp đặt (mặc định lấy từ `plan.items`, cho sửa số lượng/thêm dòng). Đối chiếu bảng `inventory_movements`
(có `movement_type = 'OUTBOUND'`, đúng nghiệp vụ này) — nhưng **mọi endpoint ghi vào `inventory_movements`
đều `requireRole('MANAGER')`** (`POST /inventory/adjust|reserve|release`, `PUT /orders/:id/
picklist/picked-up`, `POST /orders/:id/export-equipment`). Không có route nào Leader gọi được.
**Cần bàn với backend** 1 trong 2 hướng:
- Thêm endpoint mới, ví dụ `POST /schedule-plans/:planId/warehouse-movement` (role `LEADER`), tạo 1 dòng
  `inventory_movements` `OUTBOUND` cho từng `item_id` trong `plan.items`, ghi `performed_by = leader`.
- Hoặc xác nhận rằng xuất kho **luôn do Manager làm trên web trước khi Leader ra hiện trường** (tức
  `WarehouseMovementSection` chỉ là màn hình **đọc lại** xác nhận, không phải ghi mới) — nếu vậy sửa lại
  UI thay vì chờ endpoint ghi mới.

---

## 8. Đơn mua/thuê từ nhà cung cấp (xem + xác nhận nhận hàng) — TSK-SETUP

| Method | Path | Role | Trạng thái |
|---|---|---|---|
| GET | `/supplier-transactions` | MANAGER, ADMIN only | ❌ (xem (h)) |
| — | xác nhận nhận hàng theo từng dòng | — | ❌ chưa có endpoint nào (xem (i)) |

### ❌ (h) Leader không đọc được đơn mua/thuê NCC gắn với plan của mình
`SupplierTransactionSection` cần hiển thị danh sách `supplier_transactions` + `supplier_transaction_items`
của order đang thi công. `GET /supplier-transactions` hiện `requireRole('MANAGER', 'ADMIN')`. Cần nới cho
`LEADER` đọc được (lọc theo `orderId` họ đang được phân công), hoặc trả lồng sẵn trong response
`GET /schedule-plans/:planId` (xem mục 3).

### ❌ (i) Không có endpoint xác nhận "đã nhận hàng" theo từng dòng `supplier_transaction_items`
FE gọi `onReceiveItem(transactionId, stItemId, quantity)` → cập nhật `receivedQuantity` của 1 dòng. Cần
bổ sung, ví dụ: `PATCH /supplier-transactions/:transactionId/items/:stItemId { receivedQuantity }`
(role `LEADER`, giới hạn transaction thuộc order của plan họ được phân công). Cần backend quyết định thêm:
khi `transactionType = PURCHASE` và nhận đủ hàng, có tự động cộng vào `inventory` (INBOUND) không, hay
Leader phải gọi thêm 1 bước nữa (liên quan gap (g) — cùng vướng do ghi `inventory` hiện Manager-only)?

---

## 9. Thu hồi thiết bị (Collected Equipment Report) — chỉ TSK-COLLECT

| Method | Path | Role | Trạng thái |
|---|---|---|---|
| POST | `/mobile/orders/:orderId/collected-reports` | LEADER | ✅ (tạo, status `SUBMITTED`) |
| GET | `/inventory/collected-equipment-reports?orderId=` | MANAGER, ADMIN only | ❌ (xem (j)) |
| PUT | `/inventory/collected-equipment-reports/:reportId/confirm` | MANAGER only | ❌ (xem (k)) |

Request tạo (khớp `CollectedEquipmentReport`):
```json
{
  "reportType": "INTERNAL" | "SUPPLIER",
  "transactionId": "string (bắt buộc nếu SUPPLIER)",
  "notes": "string?",
  "items": [{ "itemId": "string", "goodQuantity": 0, "damagedQuantity": 0, "lostQuantity": 0, "notes": "string?" }]
}
```
Lưu ý: `unitCompensationPrice` (dùng để FE tính tiền đền bù hiển thị) **không** có trong request/response
backend — cột này không tồn tại ở `collected_equipment_report_items`. FE phải tự tra giá từ `items.
purchase_price` (catalog) phía client, backend không tính hộ.

Có 1 route thứ 2 làm đúng việc y hệt: `POST /inventory/collected-equipment-reports` (alias
`/inventory/return-reports`), cũng role `LEADER`, cùng gọi `inventoryService.createReport` — **trùng lặp
với route `/mobile` ở trên** (khác chỗ `orderId` nằm trong body thay vì path). Khuyến nghị: **dùng route
`/mobile/orders/:id/collected-reports`** vì đây là route thiết kế riêng cho app Staff.

### ❌ (j) Leader không đọc lại được báo cáo thu hồi đã nộp
Cần đọc lại `internalCollectedReport`/`supplierCollectedReport` khi quay lại xem plan (giống gap (e)) —
`GET /inventory/collected-equipment-reports` hiện chỉ Manager/Admin. Cần nới role hoặc trả lồng trong
`GET /schedule-plans/:planId`.

### ❌ (k) Không có endpoint để Leader tự xác nhận "đã trả xong" (CONFIRMED)
Theo đúng thiết kế nghiệp vụ ghi trong comment `CollectedEquipmentReport` (`src/types/workTask.ts`):
"CONFIRMED = Leader xác nhận đã trả xong về đúng nơi (UC-81 cho kho, UC-77 cho NCC)" — tức **Leader** là
người bấm nút "Xác nhận đã trả kho"/"Xác nhận đã trả NCC" trên app, sau khi vận chuyển thiết bị về xong.
Nhưng backend `PUT /inventory/collected-equipment-reports/:reportId/confirm` hiện **chỉ Manager** gọi
được, và **không có route tương đương nào dưới `/mobile`**. Đây là mâu thuẫn rõ ràng nhất giữa 2 phía cần
Product Owner + Backend + FE chốt lại: hoặc (1) mở thêm 1 route `/mobile` cho Leader tự confirm, hoặc (2)
xác nhận lại rằng bước CONFIRMED thực ra thuộc Manager trên web (và sửa lại UI Staff app, bỏ nút xác nhận,
chỉ hiển thị trạng thái "chờ Manager xác nhận" — giống đúng cách `FieldPaymentSection`/`HandoverSection`/
`WarehouseMovementSection` đang ghi chú "chờ Manager xác nhận trên web").

---

## 10. Biên bản nghiệm thu / bàn giao (Handover Record) — TSK-SETUP đã hoàn thành

| Method | Path | Role | Trạng thái |
|---|---|---|---|
| — | — | — | ❌ Chưa có bảng, chưa có endpoint |

### ❌ (l) Không có bảng nào trong DB thật tương ứng `HandoverRecord`
Đã rà soát toàn bộ danh sách bảng trong `bnwems` (28 bảng) — **không có bảng `handovers` hay tương đương**
lưu `representativeName`/`handoverNote`/`customerSatisfied`. Đây là tính năng FE thiết kế sẵn
(`HandoverSection`) nhưng backend hoàn toàn chưa có chỗ lưu. Cần backend:
1. Tạo bảng mới, ví dụ `handovers`: `handover_id, order_id, plan_id, representative_name, handover_note,
   customer_satisfied (tinyint), evidence_id (hoặc bảng nối nhiều ảnh — xem mục 14), submitted_by,
   submitted_at, confirmed_by, confirmed_at (nếu cần bước Manager xác nhận riêng, giống Settlement/Survey)`.
2. Thêm route `POST /schedule-plans/:planId/handover` hoặc `POST /orders/:orderId/handover` (role
   `LEADER`) + `GET` tương ứng để đọc lại.
3. Xác nhận có cần bước Manager confirm riêng không (các nghiệp vụ khác — Survey/Settlement/Collected
   report — đều có bước confirm 2 giai đoạn; Handover hiện FE chỉ có 1 bước "Đã ghi nhận — chờ Manager xác
   nhận trên web" nhưng chưa rõ có cần API riêng cho bước confirm đó hay không).

**Trạng thái**: FE giữ nguyên mock cho tính năng này cho tới khi có bảng + endpoint.

---

## 11. Quyết toán cuối kỳ (Settlement) — chỉ TSK-COLLECT

| Method | Path | Role | Trạng thái |
|---|---|---|---|
| POST | `/orders/:orderId/settlement` | MANAGER only | ❌ (xem (m)) |
| GET | `/orders/:orderId/settlement` | MANAGER, ADMIN only | ❌ (xem (m)) |
| PUT | `/settlements/:settlementId/confirm` (`status: "CONFIRMED"`) | MANAGER only | ✅ đúng — bước Manager, ngoài phạm vi Staff app |
| — | Chuyển `REQUESTED` → `PAID` kèm ảnh bằng chứng | — | ❌ chưa có (xem (n)) |

Bảng `settlements` có đủ cột khớp `Settlement` (`additional_fee/compensation/discount/final_amount/
payment_method/qr_code_url/paid_at/evidence_id/status/requested_at`), **status enum
`DRAFT/AGREED/REQUESTED/PAID/CONFIRMED` khớp hoàn toàn** với `SettlementStatus` phía FE — model đã đúng,
chỉ thiếu quyền + 1 transition.

### ❌ (m) Leader không tự tạo được yêu cầu quyết toán
`SettlementSection` cần **Leader** (không phải Manager) bấm "Tạo yêu cầu quyết toán" ngay tại hiện trường
khi thu hồi xong (tính `finalAmount = compensation + additionalFee - discount`, chuyển status →
`REQUESTED`). Nhưng `POST /orders/:orderId/settlement` hiện chỉ Manager gọi được. Cần nới cho `LEADER`
(giới hạn theo order của plan `TSK-COLLECT` họ được phân công), và nới luôn `GET` để đọc lại yêu cầu đã tạo.

Cần backend xác nhận: `compensation` gửi lên có được **tin theo giá trị FE tính sẵn** (tổng đền bù từ 2
báo cáo thu hồi) hay backend tự tính lại từ `collected_equipment_report_items` + giá `items` để tránh
client thao túng số tiền? Khuyến nghị **backend tự tính**, không nhận `compensation` từ body.

### ❌ (n) Không có transition `REQUESTED → PAID`
Sau khi khách thanh toán (tiền mặt hoặc quét QR), Leader cần bấm "Xác nhận đã thu tiền" kèm ảnh bằng
chứng — chuyển `status: PAID`, ghi `paidAt`, `evidenceId`. Route hiện tại chỉ có
`PUT /settlements/:id/confirm` nhận đúng `{status: "CONFIRMED"}` (bước Manager, khác giai đoạn). Cần thêm
1 endpoint mới cho transition này, ví dụ `PUT /settlements/:settlementId/mark-paid` (role `LEADER`), body
`{ evidenceId: string }`.

---

## 12. Nhóm của tôi (Team roster, chỉ hiển thị khi giữ vai trò LEAD)

| Method | Path | Trạng thái |
|---|---|---|
| — | không cần endpoint riêng | tự suy ra từ `GET /schedule-plans` (xem gap (b)) |

`buildTeamRoster` (`src/utils/teamRoster.ts`) hiện tự gộp từ `myPlans` phía client (lọc các plan mình giữ
`LEAD`, rồi gom theo từng `TECHNICAL` cùng plan). **Không cần API mới** — chỉ cần gap (b) (`GET
/schedule-plans` lọc theo "plan của tôi") được giải quyết là đủ dữ liệu để tính lại đúng logic này ở FE
như hiện tại.

---

## 13. Thông báo sự kiện sắp diễn ra

Không cần API — `useUpcomingEventNotifications` (`src/hooks/useUpcomingEventNotifications.ts`) dùng
Browser Notification API thuần túy, tự tính từ `myPlans` đã tải sẵn (ngưỡng 2 ngày, xem
`src/utils/upcomingEvents.ts`). Không có bảng `notifications` nào được dùng ở app Staff dù bảng đó tồn tại
trong DB (có thể phục vụ app khác).

---

## 14. Ảnh minh chứng (Evidence) — vấn đề xuyên suốt cần chốt trước

| Method | Path | Trạng thái |
|---|---|---|
| POST | `/evidence/upload` (multipart, field `file`, body `description?`) | ✅ |
| GET | `/evidence/:id` | ✅ |

Upload trả về **1 evidence** (`evidenceId`, `fileUrl`, ...) mỗi lần gọi. Đây là cơ chế đúng cho các chỗ
FE chỉ cần **1 ảnh** (check-in). Nhưng vấn đề chung: hầu hết bảng nghiệp vụ liên quan tới app Staff chỉ có
**1 cột `evidence_id` (quan hệ 1-1)**: `schedule_plans.evidence_id`, `deposits.evidence_id`,
`survey_reports.evidence_id`, `settlements.evidence_id`. Bảng `collected_equipment_reports` **không có
cột evidence nào**. Trong khi đó FE thiết kế `evidencePhotoUrls: string[]` (nhiều ảnh) ở **5 chỗ**:
- Ảnh minh chứng tiến độ hiện trường (`schedule_plans`, TSK-SETUP/TEARDOWN/COLLECT)
- Báo cáo khảo sát (`SurveyReport.evidencePhotoUrls`, bắt buộc ≥ 1 ảnh)
- Biên bản bàn giao (`HandoverRecord.evidencePhotoUrls`, bắt buộc ≥ 1 ảnh)
- Ghi nhận cọc hiện trường (`FieldPaymentRecord.evidencePhotoUrls`, tùy chọn)
- Xác nhận đã thu tiền quyết toán (`Settlement.evidencePhotoUrls`, bắt buộc ≥ 1 ảnh)

**Cần backend + FE chốt 1 trong 2 hướng trước khi code phần ảnh ở bất kỳ màn nào trên**:
- **(A) Đổi FE chỉ cho 1 ảnh/lần ghi nhận** — khớp đúng schema hiện tại, không cần đổi DB, nhanh nhất,
  nhưng giảm trải nghiệm (nhiều nghiệp vụ hiện trường thực tế cần > 1 ảnh góc chụp khác nhau).
- **(B) Backend thêm bảng nối nhiều-nhiều**, ví dụ `entity_evidences(entity_type varchar, entity_id
  varchar, evidence_id varchar)`, dùng chung cho mọi entity thay vì thêm cột riêng lẻ từng bảng. Cần thêm
  `GET` kèm entity trả về mảng evidence, và bảng `collected_equipment_reports` cũng cần được thêm vào cơ
  chế này (hiện chưa có cột evidence nào).

---

## Tổng hợp danh sách cần Backend xử lý (a)–(n)

| # | Vấn đề | Mức độ chặn |
|---|---|---|
| (a) | `role.roleName` trả `LEADER_STAFF`/`TECHNICAL_STAFF` thay vì `LEADER`/`TECHNICAL` | Chặn đăng nhập thật |
| (b) | `GET /schedule-plans` thiếu filter "plan của tôi" + không giới hạn role | Chặn toàn bộ app (Dashboard/Lịch/Công việc/Nhóm) |
| (c) | Cần xác nhận Leader có tự chuyển PENDING→CONFIRMED được không | Chặn UI nút chuyển trạng thái |
| (d) | `PATCH .../evidence` chỉ nhận 1 ảnh, FE thiết kế nhiều ảnh | Xem mục 14 |
| (e) | Leader không đọc lại được `survey-reports` của mình | Chặn hiển thị lại báo cáo đã nộp |
| (f) | Leader không tạo/xem được `deposits` (ghi nhận cọc hiện trường) | Chặn tính năng Field Payment |
| (g) | Không có API Leader ghi "xuất kho tại hiện trường" | Chặn tính năng Warehouse Movement |
| (h) | Leader không đọc được `supplier-transactions` của order mình | Chặn hiển thị đơn mua/thuê NCC |
| (i) | Không có API xác nhận nhận hàng theo dòng `supplier_transaction_items` | Chặn tính năng nhận hàng NCC |
| (j) | Leader không đọc lại được báo cáo thu hồi thiết bị | Chặn hiển thị lại báo cáo đã nộp |
| (k) | Leader không tự confirm "đã trả kho/NCC" được (chỉ Manager) | Mâu thuẫn thiết kế — cần chốt lại |
| (l) | Handover Record: chưa có bảng, chưa có endpoint | Chặn hoàn toàn tính năng Bàn giao |
| (m) | Leader không tự tạo yêu cầu quyết toán được (chỉ Manager) | Chặn tính năng Settlement |
| (n) | Thiếu transition `REQUESTED → PAID` cho Settlement | Chặn tính năng Settlement |

---

## Checklist thực hiện (theo thứ tự ưu tiên)

### Giai đoạn 0 — Chốt hướng trước khi code (quyết định, chưa cần viết code)

- [ ] (a) Chốt `role.roleName` trả đúng `LEADER`/`TECHNICAL` (đổi backend) hay FE tự đổi type nhận `LEADER_STAFF`/`TECHNICAL_STAFF`
- [ ] (c) Chốt Leader có được tự chuyển `PENDING → CONFIRMED` bằng tay không, hay bước đó cũng thuộc Manager
- [ ] (k) Chốt ai là người xác nhận "đã trả kho/NCC" (`CONFIRMED`) — Leader trên app hay Manager trên web
- [ ] (d)/(14) Chốt hướng ảnh minh chứng: (A) chỉ 1 ảnh/bản ghi (giữ schema hiện tại) hay (B) thêm bảng nối nhiều ảnh `entity_evidences`

### Giai đoạn 1 — Sửa quyền trên route đã có (nhanh)

- [ ] (a) Sửa `ROLE_MAP` trong `auth.service.ts` trả đúng `LEADER`/`TECHNICAL`
- [ ] (e) Nới `requireRole` cho `GET /survey-reports` và `GET /survey-reports/:surveyId` thêm `LEADER`
- [ ] (h) Nới `requireRole` cho `GET /supplier-transactions` thêm `LEADER` (lọc theo order của plan được phân công)
- [ ] (j) Nới `requireRole` cho `GET /inventory/collected-equipment-reports` thêm `LEADER`
- [ ] (f) Nới `requireRole` cho `POST /orders/:orderId/deposits` và `GET /orders/:orderId/deposits` thêm `LEADER`
- [ ] (m) Nới `requireRole` cho `POST /orders/:orderId/settlement` và `GET /orders/:orderId/settlement` thêm `LEADER`

### Giai đoạn 2 — Endpoint mới (route + controller + service)

- [ ] (b) Thêm filter "chỉ plan của tôi" cho `GET /schedule-plans` (query `assigneeUserId`/`mine=true`, hoặc endpoint riêng `GET /me/schedule-plans`)
- [ ] (i) `PATCH /supplier-transactions/:transactionId/items/:stItemId` — xác nhận nhận hàng từng dòng, quyết định thêm có tự cộng `inventory` (INBOUND) khi PURCHASE nhận đủ hay không
- [ ] (g) `POST /schedule-plans/:planId/warehouse-movement` — ghi `inventory_movements` OUTBOUND cho `plan.items` (chỉ nếu giai đoạn 0 không chốt hướng "Manager xuất kho trước")
- [ ] (n) `PUT /settlements/:settlementId/mark-paid` — transition `REQUESTED → PAID` kèm `evidenceId`
- [ ] (k) Route/role cho Leader tự confirm "đã trả kho/NCC" (chỉ nếu giai đoạn 0 chốt theo hướng Leader tự confirm)

### Giai đoạn 3 — Việc lớn nhất (bảng mới)

- [ ] (l) Tạo bảng `handovers` (`handover_id, order_id, plan_id, representative_name, handover_note, customer_satisfied, evidence_id, submitted_by, submitted_at, confirmed_by?, confirmed_at?`)
- [ ] (l) `POST /schedule-plans/:planId/handover` (hoặc `/orders/:orderId/handover`) + `GET` tương ứng, role `LEADER`

### Cần xác nhận lại bằng test thật (không chắc phải code thêm, nhưng phải kiểm tra trước khi FE code theo)

- [ ] `GET /schedule-plans/:planId` đã join đủ `assignees[]/items[]/customerName,customerPhone,customerAddress/orderCode,eventName/supplierTransactions[]` chưa
- [ ] Field đặt tên gì trong response cho trạng thái check-in/out của 1 assignee (map `checkInAt/checkInPhotoUrl/checkOutAt`)

---

## Phụ lục: Ánh xạ Type FE ⇄ Bảng DB thật

| Type FE (`src/types/*`) | Bảng DB | Trạng thái backend |
|---|---|---|
| `AuthUser` | `users` | ✅ (xem gap (a)) |
| `WorkTaskCatalog` | `work_tasks` | ✅ |
| `SchedulePlan` | `schedule_plans` (+ join `orders`, `customers`) | ✅ (xem gap (b), (c)) |
| `SchedulePlanAssignee` | `schedule_plan_assignees` | ✅ |
| `WorkTaskItem` | `order_items` (where `source='INTERNAL'`) | ✅ (đọc), ❌ ghi outbound (gap (g)) |
| `Attendance` | `attendances` | ✅ (qua check-in/check-out, không có GET riêng) |
| `SurveyReport` | `survey_reports` | ✅ tạo, ❌ đọc lại (gap (e)) |
| `FieldPaymentRecord` | `deposits` | ❌ Leader chưa gọi được (gap (f)) |
| `HandoverRecord` | *(không tồn tại)* | ❌ (gap (l)) |
| `WarehouseMovementRecord` | `inventory_movements` (`movement_type='OUTBOUND'`) | ❌ Leader chưa gọi được (gap (g)) |
| `SupplierTransaction` / `SupplierTransactionItem` | `supplier_transactions` / `supplier_transaction_items` | ❌ Leader chưa đọc/ghi được (gap (h), (i)) |
| `CollectedEquipmentReport` / `...Item` | `collected_equipment_reports` / `collected_equipment_report_items` | ✅ tạo, ❌ đọc lại + tự confirm (gap (j), (k)) |
| `Settlement` | `settlements` | ❌ Leader chưa tạo/chuyển PAID được (gap (m), (n)) |
| `TeamMember` / `TeamMemberPlanEntry` | *(suy ra từ `schedule_plans`)* | không cần bảng riêng |
| Ảnh minh chứng (mọi type có `evidencePhotoUrls`) | `evidences` (1-1 hiện tại) | ⚠️ xem mục 14 |
