> ⚠️ **CẢNH BÁO 2026-07-21 — toàn bộ nội dung bên dưới đã LỖI THỜI, đừng tin nguyên văn.** Tài liệu này
> đối chiếu `D:\bnwems-backend-api` — SAI repo, đó là 1 backend cũ/khác, không phải backend đang chạy
> thật ở cổng 3001 (backend thật là `D:\sep490-backend-api`, xem cảnh báo đầu `docs/more-require.md`).
> Kết luận "chưa có bảng", "bug BigInt/UUID", "⛔ chưa cần Backend làm ngay" ở dưới đây đều SAI đối với
> backend thật. Thực tế (xác nhận qua đọc code + curl + Playwright thật, browser thật, ngày 2026-07-21):
> cả 4 endpoint đã hoạt động đầy đủ (`GET`/`POST /inventory/return-reports`, `GET .../:id`,
> `PUT .../:id/confirm`), ID đều là string UUID (không phải BigInt), có phân quyền role đúng chuẩn
> (POST chỉ LEADER, PUT confirm chỉ MANAGER). FE đã nối xong theo đúng thực tế này — xem
> [`docs/more-require.md`](more-require.md) mục (af) để biết chi tiết đầy đủ, chính xác thay thế toàn bộ
> nội dung bên dưới. Giữ lại nguyên văn phần dưới chỉ để tham khảo lịch sử, không dùng làm căn cứ.

# API cho màn "Thu hồi & hoàn kho" (`/manager/inventory/returns`)

> Phạm vi tài liệu này: trang danh sách `/manager/inventory/returns` (3 thẻ không có ở đây — trang này
> không có KPI card, chỉ có ô tìm kiếm + dropdown trạng thái + bảng chính), modal "Tạo phiếu", và trang
> chi tiết `/manager/inventory/returns/[id]` (bảng kiểm đếm Nguyên vẹn/Hỏng/Mất + panel "Tổng hợp sau
> hoàn kho (dự kiến)" + nút "Xác nhận hoàn kho"). Đây là ảnh mẫu người dùng cung cấp cho danh sách; chi
> tiết trang con lấy từ code hiện tại. Mirror `/admin/inventory/returns` (+ `[id]`) dùng **chung 100%**
> code/mock với bản Manager (`getEligibleOrdersForReturn`, `createReturnSlip`, `confirmReturnSlip` từ
> cùng 1 file) — không tách riêng.
>
> **Phát hiện quan trọng nhất nằm ở mục 0** — khác các tài liệu trước, màn này có **sẵn 1 hợp đồng API
> đã được thiết kế trước** (`types/collectedEquipmentReport.ts` + `inventoryApiService.createReturnReport/
> confirmReturnReport`) nhưng **UI thật lại không dùng tới**, thay vào đó tự dựng 1 mock hoàn toàn độc
> lập (`adminInventoryReturnsMock.ts`, shape `ReturnSlip`) với field/enum khác hẳn — cần hợp nhất lại
> trước khi giao Backend, tránh Backend code theo shape sai.
>
> Nguồn tham chiếu:
> - FE: `src/app/manager/inventory/returns/page.tsx` + `[id]/page.tsx` (mirror Admin y hệt),
>   `src/mocks/adminInventoryReturnsMock.ts` (nguồn mock UI đang dùng — `ReturnSlip`, `ReturnSlipItem`,
>   `getEligibleOrdersForReturn`, `createReturnSlip`, `confirmReturnSlip`), `src/types/inventory.ts`
>   (`inventoryApiService` chưa dùng ở màn này), `src/types/collectedEquipmentReport.ts` (hợp đồng đã
>   thiết kế sẵn, xem mục 0), `src/app/manager/field-ops/progress/page.tsx` (khái niệm hoạt động "Thu
>   hồi" ở mock lịch trình khác, chỉ tham chiếu chéo, không thuộc phạm vi), `src/app/manager/suppliers/
>   returns/page.tsx` (màn "Trả thiết bị NCC" riêng — đối tượng `reportType = 'SUPPLIER'`, ngoài phạm
>   vi tài liệu này).
> - DB thật: các bảng `orders`/`order_items`/`items`/`customers`/`users`/`evidences`/`settlements` đã
>   được xác nhận qua MySQL MCP nhiều lần trong cùng phiên làm việc hôm nay (2026-07-20, xem
>   `docs/picklistxuatkho_api.md`, `docs/chitietkhachhang_api.md`) — dùng lại nguyên trạng, **không**
>   thấy bảng nào tên `collected_equipment_reports`/`return_slips`/`inventory` trong danh sách 25 bảng
>   đã liệt kê trước đó. **Lưu ý**: lần thử truy vấn lại trực tiếp trong phiên này để xác nhận thêm bị
>   timeout kết nối tới DB Aiven (`connect ETIMEDOUT`, lặp lại 4 lần liên tiếp) — trùng khớp đúng sự cố
>   P2024 (hết connection pool) đã chẩn đoán ở lượt trò chuyện trước, chưa kịp xác nhận lại schema
>   `supplier_transactions`/`supplier_transaction_items` mới nhất trong phiên này (mục 6 có ghi chú
>   riêng). Toàn bộ phần còn lại dựa trên schema đã xác nhận chắc chắn trong cùng ngày.
> - `docs/api/` **không tồn tại trong repo hiện tại** — dùng comment đầu `types/collectedEquipmentReport.ts`
>   (đối chiếu `prisma/schema.prisma`/`*.route.ts` backend) làm căn cứ chính, giống các tài liệu trước.

## 0. Phát hiện quan trọng nhất — UI đang dùng 1 mock tự chế, trong khi FE đã có sẵn 1 hợp đồng API khác thiết kế đúng hơn cho đúng nghiệp vụ này

`src/types/collectedEquipmentReport.ts` (chưa được UI nào gọi tới) đã định nghĩa sẵn:

```ts
export type CollectedEquipmentReportType = 'INTERNAL' | 'SUPPLIER';
export type CollectedEquipmentReportStatus = 'SUBMITTED' | 'CONFIRMED';

export interface CollectedEquipmentReportItem {
  itemId: string; goodQuantity: number; damagedQuantity: number; lostQuantity: number; notes?: string;
}
export interface CollectedEquipmentReport {
  reportId: string; orderId: string; reportType: CollectedEquipmentReportType; transactionId?: string;
  status: CollectedEquipmentReportStatus; reportedBy: string; confirmedBy?: string; confirmedAt?: string;
  notes?: string; items: CollectedEquipmentReportItem[]; createdAt: string;
}
```

kèm 3 endpoint đã có sẵn trong `inventoryApiService`:
`POST /api/v1/inventory/return-reports` (tạo), `PUT /api/v1/inventory/return-reports/:id/confirm`
(xác nhận), và comment trỏ tới `POST /api/v1/mobile/orders/:id/collected-reports` (Leader Staff ghi
nhận qua mobile, ngoài phạm vi repo web).

**Nhưng UI thật của màn "Thu hồi & hoàn kho"** (`page.tsx` + `[id]/page.tsx`) **không hề gọi tới bộ
này** — tự dựng 1 shape khác (`ReturnSlip`/`ReturnSlipItem` ở `adminInventoryReturnsMock.ts`) với khác
biệt đáng kể:

| | `ReturnSlip` (mock đang chạy UI) | `CollectedEquipmentReport` (hợp đồng đã thiết kế sẵn) |
|---|---|---|
| Tên item | `itemName` (chuỗi tự do, không phải FK) | `itemId` (FK thật tới `items.item_id`) |
| 3 cột đếm | `intact`/`damaged`/`lost` | `goodQuantity`/`damagedQuantity`/`lostQuantity` (cùng ý nghĩa, khác tên) |
| Trạng thái | `PENDING`/`DONE` | `SUBMITTED`/`CONFIRMED` |
| Snapshot tồn kho "trước hoàn kho" (`warehouseBefore.totalStock/damagedStock/lockedStock`) | **Người tạo phiếu tự gõ tay** 3 số này ngay lúc tạo phiếu | **Không có field tương ứng** — đúng hướng, vì số tồn kho "trước" phải đọc từ DB tại **thời điểm xác nhận**, không phải số ai đó gõ tay lúc tạo phiếu (xem mục 4). |
| Loại phiếu | Không phân biệt — chỉ có 1 loại (ngầm định nội bộ) | `reportType: 'INTERNAL' \| 'SUPPLIER'` — đã tính sẵn cho cả nghiệp vụ "trả thiết bị thuê ngoài Supplier" (`transactionId` trỏ `supplier_transactions`), khớp đúng CLAUDE.md mục 1 ("hoàn kho + trả Supplier" là 2 việc cùng nhóm) |

**Đề xuất chốt**: đi theo **`CollectedEquipmentReport`** (hợp đồng đã có sẵn, đúng hướng hơn: item là
FK thật, không tự gõ tay tồn kho "trước"), **không** theo `ReturnSlip`. FE cần đổi 2 trang này sang gọi
`inventoryApiService.createReturnReport`/`confirmReturnReport` thay vì tiếp tục dùng
`adminInventoryReturnsMock.ts` khi nối API thật — việc này ngoài phạm vi "chỉ định nghĩa API" của tài
liệu, nhưng cần ghi lại để không quên. Toàn bộ mục bên dưới ánh xạ UI hiện tại sang đúng field của
`CollectedEquipmentReport`.

## 1. Vẫn thiếu bảng thật đứng sau — 2 lớp chồng nhau

1. **Không có bảng nào lưu `CollectedEquipmentReport`** trong DB thật (đối chiếu danh sách bảng đã xác
   nhận nhiều lần hôm nay) — cần tạo mới (mục 7), đã ghi vào `docs/more-require.md` mục (c).
2. **Không có bảng `inventory`** — đã ghi nhận từ trước ở `docs/tonkhodoanhnghiep_api.md` mục 0 và
   `docs/more-require.md` mục (b), **vẫn đang ở trạng thái chờ Backend tạo**. Bước "Xác nhận hoàn kho"
   (mục 4) cần cộng/trừ số liệu vào đúng bảng này — nếu mục (b) chưa xong, endpoint xác nhận ở tài liệu
   này **không thể chạy đúng nghĩa** (tạo phiếu thì được, nhưng xác nhận sẽ không có gì để cập nhật).

Tức là màn này phụ thuộc **2 bảng mới** phải có trước khi chạy được đầy đủ, không phải 1.

> ⛔ **Toàn bộ endpoint ở tài liệu này CHƯA CẦN BACKEND LÀM NGAY** — mọi endpoint bên dưới đều phụ
> thuộc trực tiếp bảng `collected_equipment_reports`/`collected_equipment_report_items` (mục 7, chưa
> tồn tại), riêng bước xác nhận (mục 4.3) còn phụ thuộc thêm bảng `inventory` (`docs/more-require.md`
> mục (b), cũng chưa xong). Mỗi endpoint dưới đây đều được đánh dấu lại riêng để dễ theo dõi khi Backend
> rảnh tay quay lại — thứ tự làm trước/sau xem `docs/more-require.md` mục (c).

## 2. Bảng chính "Thu hồi & hoàn kho" — ánh xạ từng cột

> ⛔ **Chưa cần làm ngay** — `GET /api/v1/inventory/return-reports` phụ thuộc bảng
> `collected_equipment_reports` (mục 1/7, chưa tồn tại). Mục dưới đây là hợp đồng chốt sẵn, implement
> khi bảng đã có, không cần Backend làm ngay trong đợt này.

| Cột UI | Nguồn (mock `ReturnSlip`) | Theo `CollectedEquipmentReport` thật |
|---|---|---|
| Mã phiếu (`#PN010`) | `slip.id` (tự sinh `PN0xx` tuần tự) | Đề xuất thêm cột `report_code VARCHAR(50) UNIQUE` (vd `PN010`) — theo đúng pattern `<entity>_id` (UUID) + `<entity>_code` (mã nghiệp vụ ngắn) đã xác nhận nhất quán ở mọi bảng khác trong DB này (`items`, `orders`, `customers`...) và đúng bài học rút ra từ phát hiện ở `docs/chitietkhachhang_api.md` mục 0 (đừng lặp lại sai lầm dùng thẳng UUID làm mã hiển thị). `reportId` (UUID) dùng cho path param, `reportCode` dùng hiển thị. |
| Đơn đặt cưới (mã đơn + tên) | `slip.orderCode`/`slip.orderName`/`slip.customerName` (3 field snapshot lưu sẵn trên `ReturnSlip`) | `report.orderId` — **JOIN** `orders.order_code` + `customers.customer_name` qua `orders.customer_id` tại thời điểm đọc, không lưu snapshot (đúng nguyên tắc đã áp dụng nhất quán ở `docs/chitietkhachhang_api.md`/`docs/danhsachdondat_api.md`). |
| Số mặt hàng ("1 loại thiết bị") | `slip.items.length` | `COUNT(report.items)` — số dòng `collected_equipment_report_items`, không phải tổng số lượng. |
| Ngày tạo | `slip.createdAt` | `report.createdAt`. |
| Tạo bởi | `slip.createdBy` (chuỗi tự gõ tay) | `report.reportedBy` — đề xuất đổi thành FK `users.user_id`, JOIN ra `full_name` khi trả về (khác hướng "free text" đã chọn cho `prepared_by` ở `docs/thietbikhohang_api.md` mục 3, vì ở đây người ghi nhận **luôn** là 1 tài khoản Leader Staff nội bộ có đăng nhập hệ thống — không có trường hợp "tổ/đối tác ngoài hệ thống" như `prepared_by`). |
| Ngày hoàn kho thực tế | `slip.actualReturnDate` (chỉ có khi `status='DONE'`) | `report.confirmedAt` — chỉ có giá trị khi `status='CONFIRMED'`. |
| Trạng thái | `RETURN_SLIP_STATUS_META`: `PENDING`→"CHƯA HOÀN" (badge vàng), `DONE`→"ĐÃ HOÀN" (badge xanh) | `report.status`: `SUBMITTED`→"CHƯA HOÀN", `CONFIRMED`→"ĐÃ HOÀN" — đổi tên enum theo `CollectedEquipmentReportStatus` đã có sẵn (mục 0), giữ nguyên nhãn/màu badge hiện tại. |
| Thao tác (icon mắt) | Link `/manager/inventory/returns/:id` | Không đổi, chỉ là điều hướng route nội bộ FE. |

### 2.1. Bộ lọc & tìm kiếm

| Control UI | Đề xuất param `GET /api/v1/inventory/return-reports` |
|---|---|
| Ô tìm kiếm "mã phiếu, mã đơn, khách hàng" | `search` — khớp `report_code` (`LIKE`) hoặc `orders.order_code`/`customers.customer_name` (JOIN). |
| Dropdown "Tất cả trạng thái" (Chưa hoàn/Đã hoàn) | `status` = `SUBMITTED`/`CONFIRMED`. |
| *(ngầm định)* | Đề xuất mặc định `reportType = 'INTERNAL'` cho đúng trang này (loại trừ báo cáo trả Supplier — thuộc `/manager/suppliers/returns`, ngoài phạm vi) — cần thêm param `reportType` (mặc định `INTERNAL` nếu FE không truyền, hoặc luôn cố định phía backend cho route riêng này, tùy Backend chọn thiết kế). |

## 3. Modal "Tạo phiếu" — cần quyết định lại theo đúng CLAUDE.md, giống vấn đề đã gặp ở `docs/thietbikhohang_api.md` mục 4

Modal hiện tại cho Manager **tự gõ tay** toàn bộ: chọn đơn, nhập tên người tạo phiếu (chuỗi tự do,
không xác thực là ai), và với **mỗi thiết bị** phải tự gõ tay 4 số (SL cần hoàn, Tổng SL trong kho, SL
hỏng trong kho, SL khóa trong kho) — 3 số cuối chính là số tồn kho "hiện tại" mà lẽ ra hệ thống phải tự
biết, không phải nhập tay.

CLAUDE.md mục "Vai trò & phân quyền" liệt kê rõ **"xuất/nhận/trả kho nội bộ"** và **"hỏng/mất"** là 2
trong số các loại dữ liệu hiện trường mà **"Leader Staff (mobile) ghi nhận trước, Manager chỉ xác nhận
(confirm) trên web"** — phiếu thu hồi & hoàn kho là giao của cả 2 loại này cùng lúc. Modal "Tạo phiếu"
hiện tại vi phạm nguyên tắc này y hệt vấn đề đã chốt sửa ở `docs/thietbikhohang_api.md` mục 4
(preparedQty/preparedBy trước đây cũng để Manager gõ tay trực tiếp trên web).

**Đề xuất chốt — đi theo hướng (B), nhất quán với quyết định đã áp dụng ở tài liệu kia**:

> ⛔ **Chưa cần làm ngay** — cả 2 endpoint tạo phiếu bên dưới (`POST /inventory/return-reports` và
> `POST /mobile/orders/:id/collected-reports`) đều phụ thuộc bảng `collected_equipment_reports` (mục
> 1/7, chưa tồn tại). Chỉ là hợp đồng chốt sẵn cho khi bảng đã có.

- **Tạo phiếu** (`POST /api/v1/inventory/return-reports` hoặc `POST /api/v1/mobile/orders/:id/
  collected-reports`) do **Leader Staff thực hiện qua mobile** (ngoài phạm vi repo web) — nhập đơn,
  từng `itemId` (chọn từ danh mục thật của đơn đó — `order_items` của order, không gõ tên tự do), và 3
  số đếm (`goodQuantity`/`damagedQuantity`/`lostQuantity`) ngay tại hiện trường lúc kiểm đếm thật.
  `reportedBy` lấy từ `req.user.id` (JWT), không phải ô nhập tay.
- **Web Manager** (`/manager/inventory/returns`) bỏ hẳn modal "Tạo phiếu" tự nhập — đổi thành **chỉ
  xem** danh sách phiếu đã có (`status = SUBMITTED` là các phiếu Leader đã gửi, chờ Manager xử lý) và
  bấm **"Xác nhận hoàn kho"** ở trang chi tiết (mục 4) sau khi rà soát số liệu Leader đã ghi.
- Không cần 3 số "Tổng/Hỏng/Khóa trong kho" nhập tay ở bước tạo nữa — số tồn kho hiện tại đọc trực
  tiếp từ bảng `inventory` **tại thời điểm xác nhận** (mục 4), không lưu snapshot lúc tạo phiếu (tránh
  số liệu cũ/sai nếu có phiếu khác xử lý xen giữa lúc tạo và lúc xác nhận).

**Việc FE cần làm khi nối API thật** (ngoài phạm vi định nghĩa API, ghi lại để không quên): bỏ hẳn
`CreateReturnSlipModal` trên web Manager/Admin, đổi trang danh sách thành thuần đọc + điều hướng sang
chi tiết để xác nhận.

## 4. Trang chi tiết — bảng kiểm đếm + panel "Tổng hợp sau hoàn kho" + nút "Xác nhận hoàn kho"

### 4.1. Bảng kiểm đếm (Nguyên vẹn/Hỏng/Mất)

> ⛔ **Chưa cần làm ngay** — `GET /api/v1/inventory/return-reports/:id` phụ thuộc bảng
> `collected_equipment_reports`/`collected_equipment_report_items` (mục 1/7, chưa tồn tại).

Theo đúng hướng (B) ở mục 3: 3 cột input số hiện đang cho Manager sửa trực tiếp trên web
(`disabled={isDone}` — tức sửa được thoải mái khi `status != DONE`) cần đổi thành **read-only** trên
cả 2 role (Manager/Admin), hiển thị đúng số Leader Staff đã ghi (`goodQuantity`/`damagedQuantity`/
`lostQuantity` từ `GET /api/v1/inventory/return-reports/:id`) — không cho sửa qua web, cùng lý do đã
áp dụng cho `preparedQty`/`preparedBy` ở `docs/thietbikhohang_api.md` mục 4.

### 4.2. Panel "Tổng hợp sau hoàn kho (dự kiến)" — công thức cần sửa lại theo đúng thiết kế `inventory` đã chốt

Mock hiện có 3 công thức hiển thị "dự kiến" dựa trên số `warehouseBefore` **gõ tay lúc tạo phiếu**
(mục 3) — cả 3 đều cần viết lại khi có bảng `inventory` thật:

1. **"Tổng số lượng sau hoàn kho" = Tổng hiện tại − SL mất`** → đúng, giữ nguyên ý nghĩa nhưng đọc
   `inventory.quantity_total` **live tại thời điểm xác nhận** (không phải số gõ tay cũ).
2. **"Số lượng hỏng sau hoàn kho" = Hỏng hiện tại + SL hỏng`** → đúng, đọc `inventory.quantity_damaged`
   live tương tự.
3. **"Số lượng khóa sau hoàn kho" = Khóa hiện tại − Tổng SL cần hoàn`** → **bỏ hẳn công thức này**.
   `docs/tonkhodoanhnghiep_api.md` mục 2/3 đã chốt: "số lượng khóa" **không phải cột tĩnh lưu trong
   `inventory`** — luôn tính động theo ngày từ `schedule_plans` của các đơn `CONFIRMED`/`IN_PROGRESS`/
   `COMPLETED` đang hoạt động. Trừ thủ công 1 số tĩnh ở bước hoàn kho (như mock đang làm) sẽ **tạo ra 1
   nguồn số liệu "khóa" thứ 2 lệch hẳn với công thức động đã chốt** — không cần và không nên làm. Sau
   khi đơn hoàn tất/đóng, công thức động ở tài liệu kia sẽ tự phản ánh đúng (không còn đơn nào khóa
   thiết bị đó vào ngày đang xét), không cần bước hoàn kho này can thiệp.
4. **"Số lượng khả dụng" = Tổng sau − Hỏng sau − Khóa sau`** → giữ nguyên công thức, nhưng "Khóa sau"
   giờ là số tính động (mục 3 tài liệu kia theo `date` đang chọn), không phải kết quả phép trừ ở dòng 3.

**Kết luận**: panel này khi nối API thật chỉ cần gọi lại `GET /api/v1/inventory?itemId=...` (đã định
nghĩa ở `docs/tonkhodoanhnghiep_api.md` mục 2) cho từng `itemId` trong phiếu **sau khi xác nhận thành
công** để lấy số mới nhất, không tự tính lại công thức "khóa" ở tầng FE nữa.

### 4.3. Nút "Xác nhận hoàn kho"

> ⛔ **Chưa cần làm ngay — phụ thuộc CẢ 2 bảng còn thiếu**: `collected_equipment_reports` (mục 1/7) để
> đọc/ghi report, và `inventory` (`docs/more-require.md` mục (b)) để cập nhật tồn kho thật. Endpoint
> này chỉ nên implement **sau cùng**, khi cả 2 bảng đã sẵn sàng — implement sớm hơn (chỉ đổi `status`
> mà không cập nhật `inventory`) sẽ tạo ra dữ liệu "đã xác nhận" giả, sai nghiệp vụ thật.

```
PUT /api/v1/inventory/return-reports/:reportId/confirm
Body: {} (không cần field — số liệu đã có sẵn trong report từ bước Leader ghi nhận, mục 3)
Response: CollectedEquipmentReport đã cập nhật (status='CONFIRMED', confirmedAt, confirmedBy)
```

Backend khi xử lý cần, cho **từng dòng item** trong report (transaction, tất cả-hoặc-không-gì):

```sql
UPDATE inventory
SET quantity_total   = quantity_total - :lostQuantity,
    quantity_damaged = quantity_damaged + :damagedQuantity
WHERE item_id = :itemId;
```

Validate trước khi chạy: `report.status = 'SUBMITTED'` (chưa xác nhận trước đó — nếu không, 409);
`inventory.quantity_total - lostQuantity >= 0` sau phép trừ (không cho âm kho). Ghi `confirmed_by =
<user gọi>` (Manager), `confirmed_at = NOW()`.

**Phụ thuộc cứng vào bảng `inventory`** (mục 1) — nếu bảng đó chưa tồn tại, endpoint này không thể
implement đúng nghĩa, chỉ có thể đổi `status` mà không cập nhật tồn kho thật.

## 5. Liên hệ với đền bù hỏng/mất (`settlements.compensation`) — không tính tiền ở màn này

Comment đầu `types/collectedEquipmentReport.ts` ghi rõ: *"Bồi thường (nếu có) nay xử lý thủ công qua
field `compensation` chung của Settlement, không gắn per-item/per-người."* — khớp đúng UI hiện tại
(bảng kiểm đếm ở màn này **không hiển thị số tiền nào**, chỉ đếm số lượng). Công thức đền bù đã chốt ở
CLAUDE.md mục "Quy tắc nghiệp vụ cốt lõi": *"Đền bù thiết bị hỏng/mất = Giá mua thiết bị × Số lượng
hỏng/mất"* — số lượng hỏng/mất dùng cho công thức này **lấy từ report đã `CONFIRMED` ở màn này**
(`damagedQuantity + lostQuantity` nhân `items.purchase_price`), nhưng việc **tính và nhập số tiền đền
bù cụ thể** diễn ra ở màn Settlement (`settlements.compensation`, ngoài phạm vi tài liệu này) — không
cần thêm field tiền nào vào `collected_equipment_reports`.

**Cần Backend lưu ý khi implement Settlement** (không phải việc của tài liệu này, chỉ nhắc để không bỏ
sót liên kết dữ liệu): Settlement cần đọc lại được report đã `CONFIRMED` của đúng order đó để gợi ý số
tiền đền bù — nên có cách tra `collected_equipment_reports WHERE order_id = ? AND status = 'CONFIRMED'`
từ phía Settlement.

## 6. `reportType = 'SUPPLIER'` — ngoài phạm vi màn này, chỉ ghi nhận liên kết

`CollectedEquipmentReport` đã thiết kế sẵn `reportType: 'SUPPLIER'` + `transactionId` (trỏ
`supplier_transactions`) cho nghiệp vụ "trả thiết bị thuê ngoài cho Supplier" — đúng đối tượng của màn
`/manager/suppliers/returns` (khác route, ngoài phạm vi tài liệu này). Cùng 1 bảng
`collected_equipment_reports` phục vụ cả 2 màn, phân biệt bằng `reportType`. **Chưa xác nhận lại được
schema `supplier_transactions`/`supplier_transaction_items` trong phiên này** do DB timeout (xem đầu
file) — khi viết tài liệu riêng cho `/manager/suppliers/returns`, cần đối chiếu lại 2 bảng đó trước khi
chốt cột `transaction_id`.

## 7. Đề xuất schema mới — 2 bảng `collected_equipment_reports` + `collected_equipment_report_items`

```sql
CREATE TABLE collected_equipment_reports (
  report_id     VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  report_code   VARCHAR(50) NOT NULL UNIQUE,               -- mã hiển thị "PN010" (mục 2)
  order_id      VARCHAR(36) NOT NULL,
  report_type   ENUM('INTERNAL','SUPPLIER') NOT NULL DEFAULT 'INTERNAL',
  transaction_id VARCHAR(36) NULL,                          -- chỉ có khi report_type='SUPPLIER' (mục 6)
  status        ENUM('SUBMITTED','CONFIRMED') NOT NULL DEFAULT 'SUBMITTED',
  reported_by   VARCHAR(36) NOT NULL,                        -- FK users, Leader Staff (mục 2)
  confirmed_by  VARCHAR(36) NULL,                             -- FK users, Manager (mục 4.3)
  confirmed_at  TIMESTAMP NULL,
  notes         TEXT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT collected_equipment_reports_order_id_fkey FOREIGN KEY (order_id)
    REFERENCES orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT collected_equipment_reports_reported_by_fkey FOREIGN KEY (reported_by)
    REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT collected_equipment_reports_confirmed_by_fkey FOREIGN KEY (confirmed_by)
    REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT collected_equipment_reports_transaction_id_fkey FOREIGN KEY (transaction_id)
    REFERENCES supplier_transactions(transaction_id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE collected_equipment_report_items (
  cer_item_id      VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
  report_id        VARCHAR(36) NOT NULL,
  item_id          VARCHAR(36) NOT NULL,
  good_quantity    INT NOT NULL DEFAULT 0,
  damaged_quantity INT NOT NULL DEFAULT 0,
  lost_quantity    INT NOT NULL DEFAULT 0,
  notes            TEXT NULL,
  CONSTRAINT cer_items_report_id_fkey FOREIGN KEY (report_id)
    REFERENCES collected_equipment_reports(report_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT cer_items_item_id_fkey FOREIGN KEY (item_id)
    REFERENCES items(item_id) ON DELETE RESTRICT ON UPDATE CASCADE
);
```

Cột `transaction_id`/FK `supplier_transactions` ở trên đặt theo tên bảng thật đã biết
(`supplier_transactions`, PK giả định `transaction_id` theo đúng pattern `<table_số_ít>_id` dùng nhất
quán toàn DB) — **cần Backend xác nhận lại đúng tên cột PK thật** khi tới lượt implement (mục 6, chưa
verify được trong phiên này).

## 8. Trang mirror `/admin/inventory/returns` — cùng vấn đề Manager-ghi-trực-tiếp, cần chặn quyền

Giống hệt phát hiện đã ghi ở `docs/thietbikhohang_api.md` mục 0/4 cho trang audit Admin khác: bản
Admin của màn này (`/admin/inventory/returns` + `[id]`) hiện **dùng chung 100% code** với Manager, kể
cả modal "Tạo phiếu" và nút "Xác nhận hoàn kho" — vi phạm nguyên tắc "Admin không xử lý vận hành hằng
ngày" (CLAUDE.md mục "Vai trò & phân quyền"). Khi nối API thật, theo đúng hướng (B) đã chốt ở mục 3
(bỏ hẳn tạo phiếu trên web), bản Admin **chỉ nên còn quyền xem** — cả tạo phiếu (đã chuyển hẳn sang
Leader mobile) lẫn "Xác nhận hoàn kho" (chỉ Manager) đều không áp dụng cho Admin; backend nên trả 403
cho `PUT .../confirm` nếu role gọi là `ADMIN`.

## 9. Tổng hợp

### 9.1. Cần Backend tạo mới (bảng + phụ thuộc)

1. **2 bảng mới** `collected_equipment_reports` + `collected_equipment_report_items` (mục 7).
2. **Phụ thuộc bảng `inventory`** (`docs/more-require.md` mục (b), vẫn đang chờ) — bước xác nhận (mục
   4.3) không chạy đúng nghĩa nếu thiếu bảng này.
3. Xác nhận lại tên cột PK thật của `supplier_transactions` trước khi chốt FK `transaction_id` (mục 6).

### 9.2. Endpoint cần implement — ⛔ CHƯA CẦN LÀM NGAY, chờ bảng xong mới bắt đầu (giả định 2 bảng mục 7 + bảng `inventory` đã có)

Thứ tự đề xuất khi Backend quay lại làm (sau khi cả 2 bảng ở mục 9.1 đã tạo xong):

1. `GET /api/v1/inventory/return-reports` — danh sách + filter `search`/`status`/`reportType` (mục 2).
2. `GET /api/v1/inventory/return-reports/:id` — chi tiết kèm `items[]` (mục 4.1).
3. `POST /api/v1/inventory/return-reports` (web, nếu giữ) hoặc `POST /api/v1/mobile/orders/:id/
   collected-reports` (mobile Leader, khuyến nghị — mục 3) — tạo phiếu.
4. `PUT /api/v1/inventory/return-reports/:id/confirm` — làm **sau cùng**, xác nhận + cập nhật
   `inventory` (mục 4.3) — endpoint duy nhất phụ thuộc cả 2 bảng cùng lúc.

### 9.3. Quyết định kiến trúc đã đề xuất (theo đúng CLAUDE.md, nhất quán với `docs/thietbikhohang_api.md`)

1. **Bỏ modal "Tạo phiếu" + input đếm trực tiếp trên web** — chuyển ghi nhận số liệu (Leader Staff,
   mobile), web Manager chỉ xem + xác nhận (mục 3, 4.1).
2. **Bỏ công thức "Số lượng khóa sau hoàn kho" tính thủ công** — dùng công thức động đã chốt ở
   `docs/tonkhodoanhnghiep_api.md` mục 3 (mục 4.2).
3. **Đi theo `CollectedEquipmentReport`** (đã thiết kế sẵn ở FE), không theo `ReturnSlip` (mock đang
   chạy UI) — item là FK thật `itemId`, không phải chuỗi tên tự do (mục 0).
4. **Admin chỉ đọc** — chặn quyền tạo/xác nhận ở tầng backend (mục 8).
