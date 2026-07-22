# API Contracts để tích hợp FE ⇄ BE thật

> Khác với `docs/api.md` (phân tích gap, việc cần backend làm thêm), file này liệt kê **request/response
> chính xác** của từng endpoint FE cần gọi — lấy trực tiếp từ code service/DTO thật ở
> `D:\sep490-backend-api\src\modules\**\*.service.ts` (không suy đoán). Dùng file này khi viết
> `src/services/*ApiService.ts` ở FE. Các field còn thiếu so với nhu cầu FE được đánh dấu `// ⚠️ GAP (x)`
> kèm mã gap tương ứng trong `docs/api.md`.

## Quy ước chung

- Base URL: `{BACKEND_HOST}/api/v1`
- Header: `Authorization: Bearer <JWT>` (trừ `POST /auth/login`, `POST /auth/forgot-password`)
- Response thành công: `{ "success": true, "data": ..., "meta"?: {...} }`
- Response lỗi (mọi endpoint):
  ```json
  { "success": false, "error": { "code": "BAD_REQUEST", "message": "...", "details": {} } }
  ```
  Các `code` thường gặp: `VALIDATION_ERROR` (400, lỗi Zod), `UNAUTHORIZED` (401), `FORBIDDEN` (403),
  `NOT_FOUND` (404), `CONFLICT` (409), `INTERNAL_ERROR` (500).

---

## 1. Đăng nhập

- [x] **`POST /auth/login`** — public

Request:
```json
{ "username": "leader", "password": "staff123" }
```

Response `data`:
```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "userId": "15584b69-...",
    "username": "leader",
    "fullName": "Team Leader",
    "role": { "roleId": "role-leader", "roleName": "LEADER_STAFF" },
    "status": "active"
  }
}
```
`role.roleName` = `LEADER_STAFF` / `TECHNICAL_STAFF` — ⚠️ GAP (a), không khớp `StaffRoleName` FE
(`'LEADER' | 'TECHNICAL'`). `status` là `'active' | 'inactive' | 'locked'`.

- [x] **`GET /auth/profile`** — mọi role, response `data`:
```json
{
  "userId": "...", "username": "leader", "fullName": "Team Leader",
  "role": { "roleId": "role-leader", "roleName": "LEADER_STAFF" }, "status": "active",
  "email": null, "phone": "0987...", "bio": null, "avatarUrl": null,
  "createdAt": "2026-...", "updatedAt": "2026-..."
}
```

- [x] **`PUT /auth/profile`** — body: `{ "fullName"?, "phone"?, "bio"?, "avatarUrl"? }` → response giống GET profile.

- [x] **`PUT /auth/change-password`** — body: `{ "oldPassword": "...", "newPassword": "..." }` → `data: null`.

---

## 2. Danh mục loại việc

- [x] **`GET /work-tasks`** — mọi role, response `data`:
```json
[
  { "taskId": "f4720f74-...", "taskCode": "TSK-SURVEY", "taskName": "Khảo sát hiện trường", "description": null },
  { "taskId": "a64af56c-...", "taskCode": "TSK-SETUP", "taskName": "Lắp đặt thiết bị", "description": null },
  { "taskId": "e857ca67-...", "taskCode": "TSK-TEARDOWN", "taskName": "Tháo dỡ thiết bị", "description": null },
  { "taskId": "2ab97250-...", "taskCode": "TSK-COLLECT", "taskName": "Thu hồi thiết bị", "description": null }
]
```
Gọi 1 lần lúc app khởi động, cache lại `taskId → taskCode` (cần dùng để bù gap (o) — xem mục 3).

---

## 3. Kế hoạch (Schedule Plans)

- [x] **`GET /schedule-plans`** — query: `orderId?, status?, taskId?, dateFrom?, dateTo?, assigneeUserId?,
page?, limit?` (✅ gap (b) đã xong: thêm `assigneeUserId` — Leader/Technical gọi kèm `assigneeUserId =
user.id` đang đăng nhập để chỉ lấy "plan của tôi", không truyền thì vẫn trả toàn bộ hệ thống như cũ, tối
đa 500 dòng nếu không phân trang). Response `data`: mảng `SchedulePlanDTO` (xem GET by id bên dưới). `meta`:
```json
{ "page": null, "limit": null, "totalItems": 12, "totalPages": null }
```
(chỉ có số khi truyền `page`/`limit`).

- [x] **`GET /schedule-plans/:planId`** — response `data` (`SchedulePlanDTO` thật):
```json
{
  "planId": "cb8c176f-...",
  "planCode": "PLN-001",
  "orderId": "2167b437-...",
  "orderCode": "ORD-001",
  "customerName": "Tech Corp",
  "eventName": "Tech Summit 2026",
  "eventDate": "2026-08-14T00:00:00.000Z",
  "orderLocation": "123 Tech St.",
  "taskId": "a64af56c-...",
  "taskName": "Lắp đặt thiết bị",
  "startTime": "2026-08-14T07:00:00.000Z",
  "endTime": "2026-08-14T11:00:00.000Z",
  "location": "123 Tech St. Hall A",
  "status": "IN_PROGRESS",
  "evidenceId": null,
  "notes": "Mang thêm dây rút và đèn led dự phòng.",
  "assignees": [
    {
      "userId": "15584b69-...",
      "fullName": "Team Leader",
      "role": "LEAD",
      "phone": "0987...",
      "checkInAt": "2026-08-14T06:55:00.000Z",
      "checkOutAt": null
    },
    { "userId": "e23098f0-...", "fullName": "Technician", "role": "TECHNICAL", "phone": null, "checkInAt": null, "checkOutAt": null }
  ]
}
```

**KHÔNG có trong DTO này** (phải lấy từ nguồn khác — xem mục dưới):
- `customerPhone`, `customerAddress`, `taskCode` — ⚠️ GAP (o). Lấy `customerPhone`/`customerAddress` từ
  `GET /mobile/orders/:orderId` (mục 5); lấy `taskCode` bằng cách map `taskId` qua catalog `GET
  /work-tasks` (mục 2) đã cache sẵn.
- `checkInEvidenceId`/ảnh check-in trong `assignees[]` — ⚠️ GAP (p), hiện không có cách đọc lại ảnh
  check-in đã chụp.
- `items[]` (thiết bị) — không có ở đây, lấy qua `GET /inventory/picklist/:orderId` (mục 6).
- `supplierTransactions[]` — lấy qua `GET /supplier-transactions?orderId=` (mục 9, nhưng thiếu `items[]`
  — GAP (q)).
- `surveyReport`, `fieldPayment` (deposits), `handoverRecord`, `warehouseMovement`,
  `internalCollectedReport`, `supplierCollectedReport`, `settlement` — gọi endpoint riêng theo `orderId`
  (mục 7–12), **không** kỳ vọng có sẵn ở đây.

- [x] **`POST /schedule-plans/:planId/assignees/:userId/check-in`** — role LEADER/TECHNICAL, chỉ tự check-in
cho chính mình (`actor.id !== userId` → 403). Body:
```json
{ "checkInEvidenceId": "evidence-id-tuỳ-chọn" }
```
Response `data`: `SchedulePlanDTO` đầy đủ (đã cập nhật `assignees[].checkInAt`). Nếu người check-in là
`LEAD`, backend **tự chuyển** `status` plan sang `IN_PROGRESS`. Lỗi 400 nếu đã check-in trước đó.

- [x] **`POST /schedule-plans/:planId/assignees/:userId/check-out`** — tương tự, không nhận body. Nếu là
`LEAD`, backend tự chuyển `status` → `COMPLETED`. Lỗi 400 nếu chưa check-in hoặc đã check-out rồi.

- [x] **`PATCH /schedule-plans/:planId/evidence`** — role LEADER/TECHNICAL, bất kỳ ai trong `assignees`. Body:
```json
{ "evidenceId": "evidence-id" }
```
Response: `SchedulePlanDTO` (đã gắn `evidenceId`) — ⚠️ GAP (d): chỉ 1 giá trị, ghi đè lần gọi trước, không
cộng dồn thành mảng như FE cần.

- [x] **`PATCH /schedule-plans/:planId/status`** — role **MANAGER only** (FE Staff **không gọi được**, xem gap
(c)). Body: `{ "status": "CONFIRMED" | "CANCELLED", "notes"?, "evidenceId"? }`.

---

## 4. Chấm công

Không có endpoint riêng — đọc/ghi hoàn toàn qua `assignees[].checkInAt/checkOutAt` trong
`SchedulePlanDTO` (mục 3). Luồng chụp ảnh check-in:
1. `POST /evidence/upload` (multipart, field `file`) → nhận `evidenceId`.
2. `POST /schedule-plans/:planId/assignees/:userId/check-in` với `{ "checkInEvidenceId": evidenceId }`.

---

## 5. Chi tiết đơn hàng (dùng bù field thiếu ở mục 3)

- [x] **`GET /mobile/orders/:orderId`** — role LEADER/TECHNICAL/MANAGER/ADMIN. Response `data`
(`OrderDetailDTO`):
```json
{
  "orderId": "2167b437-...",
  "orderCode": "ORD-001",
  "customerId": "...",
  "customerName": "Tech Corp",
  "customerPhone": "0911111111",
  "customerEmail": "",
  "customerAddress": "123 Tech St.",
  "eventType": "conference",
  "eventName": "Tech Summit 2026",
  "eventDate": "2026-08-14T00:00:00.000Z",
  "location": "123 Tech St.",
  "guestCount": 200,
  "totalAmount": 50000000,
  "paymentStatus": "DEPOSITED",
  "orderStatus": "IN_PROGRESS",
  "quotationId": null,
  "cancelReason": null,
  "notes": null,
  "createdBy": { "userId": "...", "fullName": "...", "role": "MANAGER" },
  "createdAt": "...", "updatedAt": "...",
  "closedAt": null, "closedBy": null,
  "items": [
    {
      "orderItemId": "...", "itemId": "item-01", "itemName": "Phông nền backdrop LED", "unit": "bộ",
      "quantity": 1, "unitPrice": 500000, "subtotal": 500000, "source": "INTERNAL", "preparedQty": 1,
      "notes": null
    }
  ]
}
```
Đây là nguồn chính xác nhất cho `customerPhone`/`customerAddress` (bù gap (o)) và cho `items[]` đầy đủ cả
`INTERNAL` lẫn `SUPPLIER` (lọc `source === 'INTERNAL'` phía FE nếu chỉ cần thiết bị kho doanh nghiệp).

---

## 6. Tồn kho / Pick-list thiết bị theo đơn

- [x] **`GET /inventory/picklist/:orderId`** — mọi role đã đăng nhập (không giới hạn role). Response `data`:
```json
[
  { "orderItemId": "...", "itemId": "item-01", "itemName": "Phông nền backdrop LED", "unit": "bộ",
    "source": "INTERNAL", "quantityOrdered": 1, "quantityAvailable": 3 }
]
```
Dùng thay cho `plan.items` (không có ở `SchedulePlanDTO`) — có thêm `quantityAvailable` (tồn kho khả dụng
hiện tại) tiện hiển thị ở `EquipmentTable`.

- [x] **`GET /inventory/:itemId`** — mọi role, response 1 `InventoryDTO`:
```json
{ "itemId": "item-01", "itemName": "...", "itemCode": "...", "unit": "bộ", "categoryName": "...",
  "typeName": "...", "rentalPrice": 500000, "purchasePrice": null,
  "quantityTotal": 3, "quantityDamaged": 0, "quantityReserved": 1, "quantityAvailable": 2,
  "updatedAt": "..." }
```

---

## 7. Khảo sát hiện trường (Survey Report)

- [x] **`POST /survey-reports`** — role LEADER/MANAGER. Body:
```json
{
  "orderId": "2167b437-...",
  "planId": "139c11f0-...",
  "surveyDate": "2026-07-22T11:30:00.000Z",
  "location": "123 Tech St. Hall A",
  "area": 120, "length": 12, "width": 10,
  "entrance": "Cổng sau rộng 3m",
  "siteConstraints": "Trần cao 3.5m",
  "proposedItems": "Loa JBL x4, Đèn Beam 230 x8",
  "notes": "",
  "evidenceId": "evidence-id-đã-upload"
}
```
(`area/length/width` phải khai đủ cả 3 hoặc bỏ hẳn cả 3 — 400 nếu khai nửa vời). Response `data`
(`SurveyReportDetailDTO`):
```json
{
  "surveyId": "...", "reportCode": "SVR-2026-001", "orderId": "...", "orderCode": "ORD-002",
  "customerName": "Tech Corp", "eventName": "cc", "surveyDate": "...", "location": "...",
  "status": "SUBMITTED", "reportedByName": "Team Leader",
  "planId": "139c11f0-...", "area": 120, "length": 12, "width": 10,
  "entrance": "...", "siteConstraints": "...", "additionalRequests": null, "proposedItems": "...",
  "notes": "", "evidenceId": "evidence-id",
  "confirmedByName": null, "confirmedAt": null,
  "createdAt": "...", "updatedAt": "..."
}
```
`evidenceId` — ⚠️ GAP (e)/(14): chỉ 1 giá trị, không phải mảng như FE (`evidencePhotoUrls: string[]`).

- [x] **`GET /survey-reports`, `GET /survey-reports/:surveyId`** — ✅ gap (e) đã xong: `requireRole`
nới thêm `LEADER` (giữ nguyên `MANAGER`/`ADMIN`), Leader gọi được để đọc lại báo cáo đã nộp.

---

## 8. Ghi nhận cọc tại hiện trường (Deposit)

- [x] **`POST /orders/:orderId/deposits`**, **`GET /orders/:orderId/deposits`** — ✅ gap (f) đã xong:
`requireRole` nới thêm `LEADER` ở cả POST và GET (giữ nguyên MANAGER/ADMIN cho GET).

Response mẫu (`DepositDTO`):
```json
{
  "depositId": "...", "depositCode": "DEP-2026-001", "orderId": "...",
  "amount": 3000000, "dueDate": null, "paymentDate": null,
  "paymentMethod": "bank_transfer", "qrCodeUrl": null,
  "status": "PENDING", "evidenceId": null,
  "requestedBy": "user-id", "approvedBy": null, "approvedAt": null,
  "notes": "", "createdAt": "...", "updatedAt": "..."
}
```
Request tạo (`CreateDepositBody` — suy từ `orderService.createDeposit`): `{ amount, dueDate?, paymentMethod?, qrCodeUrl?, notes? }`.

---

## 9. Đơn mua/thuê nhà cung cấp (Supplier Transaction)

- [x] **`GET /supplier-transactions`** — ✅ gap (h) đã xong: `requireRole` nới thêm `LEADER` (giữ nguyên
MANAGER/ADMIN) — TODO còn lại: lọc theo orderId của plan Leader được phân công thay vì trả toàn hệ thống.
Query: `supplierId?, orderId?, status?, page?, limit?`. Response `data` (`SupplierTransactionDTO`, **không
có `items[]`**):
```json
{
  "transactionId": "...", "transactionCode": "STX-2026-0042", "supplierId": "...",
  "supplierName": "Công ty CP Cho Thuê Thiết Bị Sự Kiện ABC", "orderId": "...", "orderCode": "ORD-001",
  "transactionType": "RENTAL", "serviceTitle": "Thuê khung dàn giáo sân khấu",
  "estimatedCost": 2400000, "depositAmount": 500000,
  "paymentStatus": "UNPAID", "status": "APPROVED",
  "createdAt": "...", "updatedAt": "..."
}
```
- [x] **`GET /supplier-transactions/:id`** — ✅ gap (q) đã xong (endpoint mới): role LEADER/MANAGER/ADMIN,
LEADER bị giới hạn phải là assignee của 1 `schedule_plans` thuộc `orderId` của transaction (403 nếu không).
Response `data` = `SupplierTransactionDTO` + `items: SupplierTransactionItemDTO[]` (`stItemId, transactionId,
itemId, itemName, quantity, unitCost, subtotal, receivedQuantity, notes`).

- [x] **`PATCH /supplier-transactions/:transactionId/items/:stItemId`** — ✅ gap (i) đã xong (endpoint mới):
role LEADER/MANAGER, cùng điều kiện giới hạn LEADER như trên. Body: `{ "receivedQuantity": number }` (giá
trị tuyệt đối, 0 ≤ receivedQuantity ≤ quantity, 400 nếu vượt). Response: `SupplierTransactionItemDTO` đã
cập nhật. **Chưa** tự cộng `inventory` (INBOUND) khi `PURCHASE` nhận đủ hàng — quyết định nghiệp vụ đó còn
để ngỏ, Manager vẫn xử lý nhập kho riêng qua `POST /inventory/adjust`.

---

## 10. Thu hồi thiết bị (Collected Equipment Report)

- [x] **`POST /mobile/orders/:orderId/collected-reports`** — role LEADER. Body:
```json
{
  "reportType": "INTERNAL",
  "transactionId": null,
  "notes": "",
  "items": [
    { "itemId": "item-01", "goodQuantity": 1, "damagedQuantity": 0, "lostQuantity": 0, "notes": "" }
  ]
}
```
(`transactionId` bắt buộc nếu `reportType: "SUPPLIER"`). Response `data` (`ReportDTO`):
```json
{
  "reportId": "...", "orderId": "...", "orderCode": "ORD-001",
  "reportType": "INTERNAL", "transactionId": null, "status": "SUBMITTED",
  "reportedBy": { "userId": "...", "fullName": "Team Leader" },
  "confirmedBy": null, "confirmedAt": null, "notes": "",
  "createdAt": "...",
  "items": [
    { "cerItemId": "...", "itemId": "item-01", "itemName": "Phông nền backdrop LED", "unit": "bộ",
      "goodQuantity": 1, "damagedQuantity": 0, "lostQuantity": 0, "notes": null }
  ]
}
```
Không có `unitCompensationPrice` — FE tự tra giá đền bù từ nguồn khác (vd `InventoryDTO.purchasePrice`,
mục 6) nếu cần hiển thị số tiền đền bù tạm tính.

- [x] **`GET /inventory/collected-equipment-reports?orderId=`** — ✅ gap (j) đã xong: `requireRole` nới
thêm `LEADER` (giữ nguyên MANAGER/ADMIN), Leader đọc lại được báo cáo đã nộp.

- [ ] **`PUT /inventory/collected-equipment-reports/:reportId/confirm`** — vẫn `requireRole('MANAGER')`
only — ⚠️ GAP (k) **chưa code**: mâu thuẫn thiết kế chưa chốt (Leader tự confirm "đã trả kho/NCC" trên
mobile hay Manager confirm trên web) — cần Product Owner quyết định trước khi mở route/role mới cho Leader.

---

## 11. Quyết toán cuối kỳ (Settlement)

- [x] **`POST /orders/:orderId/settlement`** — ✅ gap (m) đã xong: `requireRole` nới thêm `LEADER`. Body:
```json
{ "additionalFee": 200000, "compensation": 0, "discount": 0, "paymentMethod": "cash", "qrCodeUrl": null, "notes": "" }
```
**Quan trọng**: backend **tự tính `finalAmount`**, không nhận từ FE — công thức thật:
```
finalAmount = order.totalAmount + additionalFee + compensation - discount - SUM(deposits có status SUCCESS)
```
Khác với công thức FE hiện đang code trong `SettlementSection` (`compensation + additionalFee -
discount`, thiếu `totalAmount` và không trừ cọc đã thu) — **khi nối API thật, FE chỉ cần gửi
`additionalFee/compensation/discount/paymentMethod`, không tự tính `finalAmount` nữa, luôn hiển thị đúng
số backend trả về**. Response chỉ trả `{ "settlementId": "..." }` (không phải `SettlementDTO` đầy đủ) —
FE cần gọi tiếp `GET /orders/:orderId/settlement` để lấy chi tiết.

- [x] **`GET /orders/:orderId/settlement`** — ✅ gap (m) đã xong: `requireRole` nới thêm `LEADER` (giữ
nguyên MANAGER/ADMIN). Response `data` (`SettlementDTO`, `null` nếu chưa có):
```json
{
  "settlementId": "...", "orderId": "...",
  "additionalFee": 200000, "compensation": 0, "discount": 0, "finalAmount": 50200000,
  "paymentMethod": "cash", "qrCodeUrl": null, "paidAt": null, "evidenceId": null,
  "status": "DRAFT", "requestedBy": "user-id", "requestedAt": null,
  "confirmedBy": null, "confirmedAt": null, "notes": "",
  "createdAt": "...", "updatedAt": "..."
}
```
Gọi `POST` nhiều lần khi settlement đang `DRAFT` sẽ **cập nhật đè** dòng cũ (không tạo dòng mới) — khớp
đúng nhu cầu FE "Sửa yêu cầu" ở `SettlementSection`.

- [x] **`PUT /settlements/:settlementId/confirm`** — role MANAGER, body `{ "status": "CONFIRMED" }` — ngoài
phạm vi app Staff, không gọi.

- [x] **`PUT /settlements/:settlementId/mark-paid`** — ✅ gap (n) đã xong (endpoint mới): role LEADER, body
`{ "evidenceId": string }`. Transition `REQUESTED → PAID`, ghi `paidAt = now()` và `evidenceId`. 400 nếu
settlement không đang ở `REQUESTED`. Response: `SettlementDTO` đã cập nhật.

---

## 12. Ảnh minh chứng (Evidence)

- [x] **`POST /evidence/upload`** — multipart/form-data, field `file` (ảnh, tối đa 10MB, jpeg/png/webp/gif),
field text `description?`. Response `data` (`EvidenceDTO`):
```json
{
  "evidenceId": "...", "fileUrl": "https://storage.../evidences/xxx.jpg",
  "description": null,
  "uploadedBy": { "userId": "...", "fullName": "Team Leader" },
  "createdAt": "..."
}
```

- [x] **`GET /evidence/:id`** — response giống trên, dùng để hiển thị lại ảnh khi chỉ có `evidenceId` (vd từ
`schedule_plans.evidenceId`, `survey_reports.evidenceId`...).

⚠️ Nhắc lại gap (14): tất cả entity trên chỉ nhận **1** `evidenceId`/lần — FE cần chốt hướng 1 ảnh hay
nhiều ảnh trước khi code phần upload ở bất kỳ màn nào (xem `docs/api.md` mục 14).

---

## Thứ tự gợi ý viết `services/*ApiService.ts` ở FE

1. `authApiService` (mục 1) — làm trước để có token cho mọi call khác.
2. `workTaskApiService` (mục 2) — cache `taskId → taskCode` dùng ngay cho bước 3.
3. `schedulePlanApiService` (mục 3) — lõi toàn app; gap (b) đã xong, gọi kèm `assigneeUserId = user.id`
   đang đăng nhập để chỉ lấy "plan của tôi" (không cần tự lọc client-side như trước nữa).
4. `orderApiService.getMobileOrder(orderId)` (mục 5) — gọi kèm mỗi khi vào chi tiết plan, để lấy
   `customerPhone/customerAddress/items[]` bù cho gap (o).
5. `inventoryApiService.getPicklist(orderId)` (mục 6) — thay cho `plan.items`.
6. `evidenceApiService.upload(file)` (mục 12) — dùng chung mọi nơi cần ảnh (check-in, progress evidence).
7. Các mục 7–11 (survey/deposit/supplier/collected-report/settlement) — gap (e)(f)(h)(j)(m)(n)(q) đã xử lý
   xong (role nới cho LEADER + 3 endpoint mới: `GET /supplier-transactions/:id`, `PATCH .../items/:stItemId`,
   `PUT /settlements/:id/mark-paid`). Còn chặn duy nhất gap (k) (`PUT .../collected-equipment-reports/:id/
   confirm` vẫn Manager-only) — chờ Product Owner chốt hướng trước khi code tiếp.
