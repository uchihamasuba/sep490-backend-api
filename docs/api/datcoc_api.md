# API cho màn "Đặt cọc" (`/manager/payments/deposits`, `/admin/orders_audit/payments` + trang chi tiết `[id]`)

> Phạm vi tài liệu này: **chỉ** màn "Đặt cọc" (ảnh mẫu người dùng cung cấp — bảng danh sách theo dõi
> trạng thái cọc của từng đơn đặt, kèm báo giá đã duyệt đang chờ tạo đơn) và trang chi tiết 1 hồ sơ cọc
> đi kèm. Có **2 route giống nhau cho 2 role** (Manager + Admin, cùng đọc/ghi 1 dữ liệu, khác nhau ở
> quyền — xem mục 7): `/manager/payments/deposits`, `/manager/payments/deposits/[id]` và
> `/admin/orders_audit/payments`, `/admin/orders_audit/payments/[id]`. **Không** bao gồm màn "Thanh
> toán" (quyết toán cuối kỳ — `/manager/payments/settlements`, `/admin/orders_audit/settlements`) dù
> dùng chung 1 file mock nguồn (`src/mocks/db/payments.ts`) — đã tách route riêng theo yêu cầu người
> dùng, chưa có tài liệu API riêng cho phần Settlement, chỉ tham chiếu chéo khi cần giải thích 1 field.
>
> Nguồn tham chiếu:
> - FE: `src/app/manager/payments/deposits/page.tsx` + `/[id]/page.tsx`,
>   `src/app/admin/orders_audit/payments/page.tsx` + `/[id]/page.tsx` (4 file, 2 cặp gần như giống hệt
>   nhau), `src/mocks/db/payments.ts` (nguồn dữ liệu Deposit/Settlement DUY NHẤT cả 2 role đang đọc
>   thẳng), `src/types/payment.ts`, `src/services/payment.service.ts`, `src/services/mockAdapter.ts`
>   (route `POST /orders/:id/deposits`, `PUT /deposits/:id`), `src/types/order.ts`, `src/types/quotation.ts`,
>   `src/components/orders/RecordDepositModal.tsx` (component mồ côi, không trang nào import — cùng loại
>   với các component mồ côi đã ghi nhận ở tài liệu trước).
> - DB thật (MySQL MCP, `SHOW CREATE TABLE` chạy thành công — khác các tài liệu trước bị
>   `Connection closed`/`ETIMEDOUT`): bảng `deposits`, `orders`, `quotations`, `evidences`, `customers`,
>   `users`, `settlements` — cột khớp gần như 1:1 với comment đã tự ghi trong `types/payment.ts`/
>   `types/order.ts` (2 file này đã tự đánh dấu đúng, không lỗi thời như `types/supplier.ts`).
> - **Backend thật (`localhost:3001`, `.env.local` đang đặt `NEXT_PUBLIC_MOCK_MODE=false`) — đã gọi
>   trực tiếp qua `curl` trong phiên này** (đăng nhập `manager`/`123456` lấy JWT thật), khác hẳn kết quả
>   ở `docs/supplier_api.md`: **toàn bộ endpoint Deposit đang dùng đã tồn tại và hoạt động đúng** —
>   không có route 404 nào. Đã tạo dữ liệu test thật trên DB đang chạy (`DEP-002`, `DEP-003`, `DEP-004`
>   trên 2 đơn `ORD-001`/`ORD-002`) để xác nhận hành vi — **nếu đây là DB dùng chung cho demo/staging,
>   cần dọn lại 3 bản ghi test này** (không phải seed chính thức).
> - `docs/api/` **không tồn tại trong repo** (giống mọi tài liệu API trước đã viết).

## 0. Base URL & Auth

- Base path: `/api/v1`. Auth: `POST /api/v1/auth/login` trả JWT, gắn `Authorization: Bearer <token>`.
- Route tồn tại ở **cả** `/manager/payments/deposits` và `/admin/orders_audit/payments`, cả 2 đều có nút
  "Xác nhận đã nhận cọc"/sửa số tiền cọc ở trang chi tiết — **mâu thuẫn trực tiếp với CLAUDE.md mục 1**
  ("Admin không trực tiếp ghi nhận cọc/thanh toán... Manager chịu trách nhiệm ghi nhận cọc"). Xem phân
  tích riêng ở mục 7 — cần Product xác nhận trước khi nối API thật cho phía Admin.

## 1. Đối chiếu tổng quan

### 1.1. Cả 4 trang đọc thẳng mock, không qua `service` layer — vi phạm CLAUDE.md mục 4, giống mọi tài liệu trước

`manager/payments/deposits/page.tsx`, `admin/orders_audit/payments/page.tsx` và 2 trang `[id]` tương ứng
đều gọi thẳng `getOrderPaymentViews()`/`getQuotationsAwaitingDeposit()`/`getOrderPaymentViewById()`/
`confirmDeposit()`/`updateDepositAmount()` từ `@/mocks/db` — **không** gọi `paymentApiService` nào
(`getOrderDeposits`/`createOrderDeposit`/`updateDepositStatus` đã khai báo sẵn ở `payment.service.ts`
nhưng mồ côi, không nơi nào import). Khác `docs/supplier_api.md`, ở đây các endpoint thật **đã tồn tại
và đúng hành vi** (mục 2) — việc chưa nối chỉ còn là công sức viết lại 4 trang, không bị chặn bởi thiếu
API như module Supplier.

### 1.2. Gap lớn nhất: không có endpoint gộp toàn hệ thống — chỉ có theo từng đơn

Toàn bộ API Deposit thật đều xoay quanh **1 đơn cụ thể** (`/orders/:orderId/deposits`,
`/deposits/:depositId`) — xác nhận bằng curl:

```
GET /api/v1/deposits            → 404 {"code":"NOT_FOUND","message":"Route not found: GET /api/v1/deposits"}
```

Trong khi bảng danh sách "Đặt cọc" hiện tại hiển thị **1 dòng cho mỗi đơn** (toàn hệ thống, có lọc theo
trạng thái cọc/phương thức, có tìm kiếm) — muốn dựng đúng bảng này bằng API thật, cách duy nhất hiện có
là: `GET /orders` (lấy danh sách đơn) rồi **gọi thêm `GET /orders/:id/deposits` cho từng đơn** (N+1,
chậm nếu nhiều đơn — bảng ảnh mẫu đã có 7+ dòng, thực tế có thể tới hàng trăm đơn). Đây là vấn đề kiến
trúc quan trọng nhất của tài liệu này, tương tự gap `debtBalance` ở `docs/supplier_api.md` mục 3.1,
nhưng nghiêm trọng hơn vì N+1 gọi API thật (không phải chỉ thiếu 1 field tính sẵn).

**Khuyến nghị Backend**: bổ sung `GET /api/v1/deposits` (phân trang, join `orders`+`customers`, lọc
`status`/`search`/`page`/`limit` — cùng pattern `GET /api/v1/quotations` đã có), trả kèm các field ở
bảng mục 3 để FE không phải N+1. Nếu không muốn thêm bảng/route mới, phương án 2 là thêm
`?include=deposit` vào `GET /orders` để trả kèm hồ sơ cọc mới nhất ngay trong response danh sách đơn
(giống cách `GET /orders/:id` đã join `customerName`/`customerPhone`/`createdBy` sẵn).

## 2. Endpoint đã xác nhận tồn tại & đúng hành vi (curl trực tiếp backend thật, 2026-07-20)

| Endpoint | Kết quả curl thật |
|---|---|
| `GET /api/v1/orders/:orderId/deposits` | `200`, trả `{success, data: Deposit[]}` — mảng rỗng nếu đơn chưa có hồ sơ cọc nào. |
| `POST /api/v1/orders/:orderId/deposits` `{amount, paymentMethod?, notes?}` | `200`, trả full object `Deposit` (không phải chỉ `{depositId, depositCode}` như comment cũ trong `payment.service.ts`/`mockAdapter.ts` — **comment 2 file này cần sửa lại theo response thật**). `depositCode` tự sinh tuần tự (`DEP-001`, `DEP-002`...), client không tự đặt. |
| `PUT /api/v1/deposits/:depositId` `{status: 'SUCCESS', notes?}` | `200`. Backend **tự set** `approvedBy` (user hiện tại), `approvedAt`, `paymentDate` (nếu chưa có) — khớp đúng comment trong `types/payment.ts` dòng 36-37. **Đồng thời tự cập nhật `orders.payment_status` từ `UNPAID`→`DEPOSITED`** (đã xác nhận qua `GET /orders/:id` trước/sau) — FE không cần tự gọi thêm API nào để đồng bộ 2 nơi, khác cách mock hiện tại tự làm ở `confirmDeposit()` (`db/payments.ts` dòng 220-222). |
| `PUT /api/v1/deposits/:depositId` khi deposit đã `SUCCESS` | `400 BAD_REQUEST` `"Khoản cọc đang ở trạng thái SUCCESS (đã kết thúc), không thể cập nhật thêm"` — khóa cứng ở backend, đúng ý CLAUDE.md ("mọi biên bản cần Manager xác nhận" là hành động 1 chiều). FE cần disable nút/ẩn form sau khi `status !== 'PENDING'`, không chỉ dựa vào việc tự chặn ở UI như hiện tại. |
| `GET /api/v1/quotations?status=approved` | `200`. **Enum `status` trên query/response là chữ thường** (`draft`/`approved`/`rejected`) — khác cột DB gốc (`SHOW CREATE TABLE quotations` ra `enum('DRAFT','APPROVED','REJECTED')` in hoa) và khác `types/quotation.ts` dòng 7 (`QuotationStatus` cũ khai hoa) — dùng đúng `QuotationListStatus`/`UpdateQuotationStatusPayload` (đã sửa, chữ thường) đang có sẵn trong file, **không dùng** `QuotationStatus` cũ cho phần list/filter. |
| `GET /api/v1/quotations?status=APPROVED` (chữ hoa) | `400 VALIDATION_ERROR` — xác nhận chắc chắn phải gửi chữ thường. |

## 3. Bảng chính — ánh xạ từng cột (định hướng khi có endpoint gộp ở mục 1.2, hoặc khi ghép N+1 tạm thời)

| Cột UI | Nguồn (mock, `OrderPaymentView`) | Theo API thật |
|---|---|---|
| Mã đơn đặt/báo giá + tên sự kiện | `orderCode` (= `orderId` mock, thật ra là field riêng) + `eventTitle` (tự bịa `Lễ cưới ${customerName}`) | `Order.orderCode` khớp; **không có field `eventTitle`/tên sự kiện riêng** — DB có cột thật `event_name` (`Order.eventName`, optional, ví dụ thật "Tech Summit 2026") nhưng **không phải cột dành cho tiệc cưới** — 2 đơn test thật hiện có (`ORD-001` event Conference, `ORD-002` `eventName: null`) đều không có tên sự kiện đẹp như mock. Khi nối thật: dùng `eventName` nếu có, fallback hiển thị `eventType` (ví dụ "Tiệc cưới") khi `eventName` null — không tự bịa "Lễ cưới {tên khách}" như mock vì `eventType` thật là text tự do, không chắc luôn là "cưới hỏi". |
| Tên khách hàng + SĐT | `customerName`/`customerPhone` (2 field phẳng trên view) | `Order.customerName`/`customerPhone` — **đã join sẵn** trên `GET /orders`/`GET /orders/:id` (xác nhận qua curl, khớp comment dòng 21 `types/order.ts`), không cần gọi riêng `GET /customers/:id`. |
| Tổng giá trị | `totalValue` (= `AdminOrderRow.totalPrice`) | `Order.totalAmount` — khớp tên khác, đổi field khi map. |
| Tiền đặt cọc (+ nhãn "Dự kiến, chưa tạo đơn" nếu là dòng báo giá) | `depositAmount` (mock: field cứng trên `AdminOrderRow`, không phải từ hồ sơ `Deposit` thật) | **Không có field "số tiền cọc dự kiến" trên `Order`** — số 30% hiện tại mock tự tính cứng lúc seed. Nếu đơn **đã có** hồ sơ `Deposit` thật thì dùng `Deposit.amount`; nếu đơn **chưa có** hồ sơ cọc nào (`GET /orders/:id/deposits` trả `[]`, đúng trạng thái mặc định của đơn mới tạo — xác nhận qua `ORD-002` trước khi POST test) thì **không có số nào để hiển thị** — khác mock (luôn có `depositAmount` ước tính 30% kể cả khi chưa yêu cầu cọc). Cần Product quyết định: hiển thị "Chưa có yêu cầu cọc" (chính xác nhưng khác hẳn UI ảnh mẫu luôn có số), hay FE tự tính ước tính 30% chỉ để hiển thị tham khảo (phải gắn rõ chữ *in nghiêng* theo CLAUDE.md mục 4 vì không phải số thật từ backend). |
| Trạng thái cọc (badge) | `depositStatus`: chỉ 2 giá trị `RECEIVED`/`PENDING` | `Deposit.status`: **4 giá trị thật** `PENDING`/`SUCCESS`/`OVERDUE`/`CANCELLED` (xem mục 6) — badge/label hiện tại thiếu hẳn 2 trạng thái `OVERDUE`/`CANCELLED`, cần thiết kế thêm màu (gợi ý theo mục 3 CLAUDE.md: `OVERDUE`→đỏ "Quá hạn", `CANCELLED`→xám "Đã hủy"). |
| Phương thức | `paymentMethod: 'bank_transfer' \| 'cash' \| null` | `Deposit.paymentMethod: string \| null` — khớp giá trị đã test (`'bank_transfer'` gửi lên, backend lưu/trả nguyên văn), nhưng field khai `varchar(100)` tự do trên DB, không phải cột enum — nên vẫn nên validate ở FE theo đúng `PAYMENT_METHOD_OPTIONS` hiện có để tránh gửi giá trị rác. |
| Loại dòng (Đơn đặt/Báo giá) | `kind: 'order' \| 'quotation'` — chỉ để phân biệt UI, không phải field backend | Suy ra ở FE (mục 5), không có field tương ứng trên backend. |
| Xử lý (Xem chi tiết) | Link tới `deposits/[id]` (dòng đơn) hoặc `quotations/[id]` (dòng báo giá) | Không đổi — chỉ đổi nguồn `id` dùng để điều hướng. |

## 4. Trang chi tiết (`deposits/[id]`) — ánh xạ field & thao tác

`[id]` trên URL hiện tại là `orderId` (không phải `depositId`) — trang tự gọi
`getOrderPaymentViewById(orderId)` rồi tự tạo hồ sơ cọc nếu chưa có (`getOrCreateDepositForOrder`, chỉ
có ở mock). **Giữ nguyên quy ước `[id]` = `orderId`** khi nối thật (khớp cách điều hướng
`detailHref: /manager/payments/deposits/${o.orderId}` ở trang danh sách) — trang chi tiết tự gọi
`GET /orders/:orderId` (banner tổng quan) + `GET /orders/:orderId/deposits` (lấy hồ sơ cọc, thường chỉ
có 1 bản ghi hiện hành — nhưng API trả **mảng**, cần quyết định lấy bản ghi nào nếu có nhiều hơn 1, xem
mục 4.6) — **không tự tạo hồ sơ cọc "hộ" nếu chưa có** như mock (`getOrCreateDepositForOrder`) vì không
có endpoint tương đương ở backend; nếu mảng rỗng, trang phải hiển thị trạng thái "Chưa có yêu cầu cọc"
kèm nút tạo mới (gọi `POST /orders/:orderId/deposits`) thay vì tự sinh ngầm.

### 4.1. Banner tổng quan đơn hàng — khớp tốt

`eventTitle`/`eventDate`/`venue`/`customerName`/`customerPhone`/`totalValue` map trực tiếp từ
`Order.eventName ?? eventType`/`eventDate`/`location`/`customerName`/`customerPhone`/`totalAmount` — đã
xác nhận `GET /orders/:id` trả đủ các field này. `managerName` (mock: `AdminOrderRow.coordinatorName`,
field tự bịa) → thật ra không có khái niệm "điều phối viên" riêng trên `Order`, field gần nhất là
`Order.createdBy` (object `{userId, fullName, role}` — đã join sẵn, xác nhận qua curl) — đổi nhãn UI
thành "Người tạo đơn" nếu dùng field này, hoặc bỏ hẳn dòng này nếu Product không coi 2 khái niệm là một
(xem `docs/more-require.md` mục (n) — `coordinatorName` đã bị bỏ khỏi form tạo đơn vì không có cột thật
trên `orders`, cùng phát hiện, không phải gap mới).

### 4.2. "Hồ sơ yêu cầu tạm ứng cọc" — 3 field không có cách set qua API thật

| Field UI | Vấn đề |
|---|---|
| **Hạn thanh toán** (`depositDueDate`, hiển thị `formatDate`) | `Deposit.dueDate` **có tồn tại trên schema** (`SHOW CREATE TABLE deposits`: `due_date timestamp`, 1 bản ghi seed cũ `DEP-001` có giá trị `2026-08-05`) nhưng **`CreateOrderDepositPayload` (`POST /orders/:id/deposits`) không có field `dueDate`** — đã test thật: tạo `DEP-002`/`DEP-003`/`DEP-004` chỉ gửi `amount`/`paymentMethod`/`notes`, cả 3 đều trả `dueDate: null`. Nghĩa là **hiện không có cách nào set hạn thanh toán qua API** — cần Backend bổ sung `dueDate` vào payload tạo (và có thể cả payload update, nếu muốn sửa hạn sau khi tạo). |
| **Sửa số tiền cọc** (nút bút chì, chỉ hiện khi `PENDING`) | `PUT /deposits/:id` chỉ nhận `status`/`notes` theo `UpdateDepositStatusPayload` — đã test gửi kèm `amount` cùng `status` hợp lệ: **field `amount` bị bỏ qua hoàn toàn**, số tiền gốc giữ nguyên. Không có endpoint nào khác để sửa số tiền cọc sau khi tạo. Nếu tính năng này vẫn cần giữ, phải yêu cầu Backend mở thêm field `amount` (optional) trong validator `PUT /deposits/:id`, hoặc đổi hướng: xóa hồ sơ cọc sai rồi tạo lại (nhưng hiện **không có `DELETE /deposits/:id`** — chưa kiểm tra, khả năng cao cũng chưa có, cần Backend xác nhận). |
| **Nội dung chuyển khoản** (`getDepositTransferContent`) | Hoàn toàn tự sinh ở FE (`${depositCode} CHUYEN KHOAN DAT COC ${orderCode}`), không có field tương ứng trên `Deposit` — giữ nguyên cách tự sinh này khi nối thật (không phải gap, chỉ cần đảm bảo `depositCode`/`orderCode` dùng đúng field thật). |

### 4.3. Chứng từ thanh toán (upload/thay thế/xóa) — có API upload chung, nhưng chưa rõ cách gắn vào Deposit

`Deposit.evidenceId` tồn tại trên schema và đã có sẵn `evidenceApiService.uploadEvidence()` (multipart,
`POST /api/v1/evidence/upload` — theo comment sẵn trong `types/evidence.ts`, `referenceType`/
`referenceId` được nhận nhưng **không có cột lưu, bị bỏ qua** ở phía Evidence) — nhưng đã test trực
tiếp: **`PUT /deposits/:id` không nhận field `evidenceId`** (bị bỏ qua giống `amount`, mục 4.2). Tức là
quy trình 2 bước "upload file → gắn `evidenceId` vào deposit" hiện **đứt ở bước 2**, chưa có endpoint nào
hoàn tất việc gắn. Cần Backend xác nhận 1 trong 2 hướng: (a) mở thêm `evidenceId` trong validator
`PUT /deposits/:id`, hoặc (b) endpoint `POST /orders/:id/deposits` lúc tạo nhận luôn `evidenceId` nếu
chứng từ có sẵn trước khi ghi nhận cọc (ít khớp UX hiện tại hơn, vì UI cho tải chứng từ **sau** khi đã
có hồ sơ cọc). Nút "Thay thế"/"Xóa chứng từ" trên UI hiện tại (`admin/orders_audit/payments/[id]`,
`manager/payments/deposits/[id]`) đều **chưa có `onClick`** (chỉ là nút trang trí) — chưa phát sinh thêm
gap mới ngoài việc thiếu endpoint gắn `evidenceId`.

### 4.4. Cổng thanh toán VietQR — thuần trang trí, không có API thật đứng sau

`FakeVietQrCode` tự sinh hoa văn giả từ hash chuỗi `transferContent`, không gọi API nào — khớp đúng
comment đầu file dòng 24-26 ("mã QR chỉ là hoa văn trang trí, không phải mã thật"). `Deposit.qrCodeUrl`
**có tồn tại trên schema** (đúng như `types/payment.ts` dòng 18) nhưng luôn `null` ở mọi bản ghi test
thật — xác nhận **chưa có tích hợp cổng thanh toán online nào** (khớp đúng comment đầu `types/payment.ts`
dòng 1-4: mô hình VNPAY_QR cũ đã bị xóa hẳn, hiện chỉ còn ghi nhận cọc thủ công). Nếu giữ khối UI này khi
nối thật, cần đổi hẳn thông điệp — không nên ngụ ý "quét mã để thanh toán" khi không có gateway thật;
gợi ý: chỉ hiển thị nội dung chuyển khoản dạng text để khách tự chuyển khoản thủ công, bỏ hẳn khối mã QR
giả hoặc chú thích rõ "minh họa, chưa hỗ trợ quét thanh toán trực tiếp".

### 4.5. "Ghi chú đối soát của kế toán" (`accountantNote`) — không có field tương ứng

`Deposit.notes` là field gần nhất (text tự do, đã test lưu được — ví dụ `DEP-002` lưu đúng
`"Test deposit qua curl khao sat API"` khi tạo) nhưng **là 1 field duy nhất, dùng chung cho cả ghi chú
lúc tạo và lúc xác nhận**, không tách riêng "ghi chú kế toán" như mock. Phát hiện thêm qua test thật:
**field `notes` chỉ được lưu khi `status: 'SUCCESS'`** — khi test `PUT` với `status: 'CANCELLED'` kèm
`notes`, giá trị **không được lưu** (`notes` vẫn `null` sau khi cập nhật, đã test lặp lại 2 lần trên 2
bản ghi khác nhau để loại trừ sai sót ngẫu nhiên). Đây là **bug/thiếu sót thật ở backend** cần báo lại:
validator/service của nhánh `CANCELLED`/`OVERDUE` đang không ghi `notes` xuống DB, chỉ nhánh `SUCCESS`
mới ghi đúng.

### 4.6. Trường hợp 1 đơn có nhiều hồ sơ cọc (`GET /orders/:id/deposits` trả mảng) — mock không xử lý

Mock hiện tại giả định **mỗi đơn chỉ có tối đa 1 hồ sơ cọc** (`getDepositByOrderId` dùng `.find()`, lấy
bản đầu tiên khớp). Nhưng API thật cho phép **nhiều bản ghi cọc trên cùng 1 đơn** (ví dụ đã test: đơn
`ORD-001` sau khi test có 2 bản ghi `DEP-001` (seed cũ) + `DEP-003`/`DEP-004` cùng tồn tại — không có
ràng buộc UNIQUE nào theo `order_id` ngoài khóa chính `deposit_id`). Trang chi tiết hiện tại chỉ được
thiết kế cho 1 hồ sơ — cần Product xác nhận nghiệp vụ có cho tạo nhiều yêu cầu cọc/đơn (ví dụ cọc lần
2 nếu lần 1 bị hủy) hay đây là lỗi cho phép tạo trùng cần Backend chặn bằng constraint; nếu giữ khả năng
nhiều bản ghi, UI trang chi tiết cần đổi từ "1 hồ sơ" sang danh sách lịch sử các lần yêu cầu cọc.

## 5. Dòng "Báo giá đã duyệt nhưng chưa tạo đơn" — cách suy ra đúng theo API thật (đã test khớp)

Logic mock (`getQuotationsAwaitingDeposit`: lấy báo giá `status === 'approved'` **và** không có đơn nào
tham chiếu `quotationId` tới nó) **áp dụng được nguyên vẹn với API thật**, đã test xác nhận:

1. `GET /quotations?status=approved` → trả đúng báo giá đã duyệt (chú ý enum chữ thường, mục 2).
2. `GET /orders` (toàn bộ, hoặc lọc theo field cần) → mỗi đơn có field `quotationId` (chỉ có ở
   `GET /orders/:id`, **không có** trong response `GET /orders` danh sách — đã xác nhận qua curl, danh
   sách rút gọn không trả `quotationId`) — nếu muốn lọc phía FE như mock hiện tại, phải gọi
   `GET /orders/:id` cho từng đơn để lấy `quotationId`, hoặc **yêu cầu Backend thêm `quotationId` vào
   response `GET /orders` danh sách** (ít tốn công hơn nhiều so với N+1) — đã test thật: `ORD-001` có
   `quotationId` khớp đúng `QUO-001` (báo giá `approved` duy nhất trong DB lúc test), `ORD-002` có
   `quotationId: null`.
3. `estimatedDepositAmount` (30% `totalAmount`, mock tự tính) — không có field tương ứng trên
   `Quotation` thật, giữ nguyên cách tự tính ở FE nhưng **phải hiển thị in nghiêng** theo CLAUDE.md mục 4
   (số ước tính, không phải giá trị thật từ backend) vì báo giá chưa có yêu cầu cọc thật để tham chiếu.

**Kết luận mục này**: không cần API mới riêng cho phần báo giá — chỉ cần Backend thêm `quotationId` vào
`GET /orders` (danh sách) để tránh N+1, cùng lợi ích với gap mục 1.2.

## 6. Enum `Deposit.status` thật khác mock — cần thiết kế lại nhãn/màu badge

| Giá trị thật (DB + API) | Mock hiện có? | Nhãn/màu đề xuất (theo mục 3 CLAUDE.md) |
|---|---|---|
| `PENDING` | Có (`PENDING`, "Chờ thanh toán", vàng) | Giữ nguyên. |
| `SUCCESS` | Có nhưng tên khác (mock đặt `RECEIVED`, "Đã nhận cọc", xanh lá) | Đổi tên biến thành `SUCCESS` khi nối thật, giữ nhãn/màu. |
| `OVERDUE` | **Không có** | Đề xuất "Quá hạn thanh toán", đỏ (`red-500`) — CLAUDE.md mục 3: đỏ = quá hạn/hủy/lỗi. |
| `CANCELLED` | **Không có** | Đề xuất "Đã hủy yêu cầu cọc", xám (`slate-400`) — CLAUDE.md mục 3: xám = nháp/không hoạt động. |

Chưa xác nhận được **ai/khi nào** đơn chuyển sang `OVERDUE` (tự động theo `dueDate` quá hạn, hay
Manager tự chuyển tay?) — không có endpoint/cronjob nào lộ ra qua API để trả lời câu hỏi này, cần
Backend xác nhận cơ chế trước khi FE quyết định có cần thêm hành động "Đánh dấu quá hạn" trên UI hay chỉ
hiển thị thụ động.

## 7. Vấn đề phân quyền: Admin đang có đủ quyền xác nhận/sửa cọc giống Manager — sai theo CLAUDE.md mục 1

`admin/orders_audit/payments/[id]/page.tsx` hiện có **y hệt** nút "Xác nhận đã nhận cọc" (dòng 312-317)
và form sửa số tiền cọc như bản Manager — gọi thẳng cùng hàm mock `confirmDeposit()`/
`updateDepositAmount()`. CLAUDE.md mục 1 quy định rõ: "Admin... không trực tiếp ghi nhận cọc/thanh toán"
— Admin chỉ nên **xem/audit**. Đây không phải lỗi kỹ thuật (2 endpoint `POST /orders/:id/deposits`,
`PUT /deposits/:id` không phân biệt role gọi ở tầng API — cần Backend xác nhận có chặn theo `role` ở
middleware hay không, hiện tại token `MANAGER` gọi được, chưa thử token `ADMIN`), mà là **quyết định
sản phẩm cần chốt trước khi nối API thật**: xóa hẳn 2 hành động này khỏi trang Admin (chỉ giữ xem), hay
giữ nguyên và coi đây là ngoại lệ đã được Product chấp nhận. Nếu Backend có chặn role ở middleware, giữ
nguyên UI hiện tại khi nối thật sẽ khiến Admin bấm nút nhưng luôn nhận lỗi 403 — cần xác nhận trước khi
quyết định ẩn/giữ nút.

## 8. Tổng hợp endpoint cần cho màn này

| Endpoint | Trạng thái |
|---|---|
| `GET /api/v1/orders/:orderId/deposits` | **Đã có, đã test đúng** (mục 2). Dùng cho trang chi tiết. |
| `POST /api/v1/orders/:orderId/deposits` `{amount, paymentMethod?, notes?}` | **Đã có, đã test đúng** — nhưng thiếu `dueDate` trong payload (mục 4.2). |
| `PUT /api/v1/deposits/:depositId` `{status: 'SUCCESS'\|'OVERDUE'\|'CANCELLED', notes?}` | **Đã có, đã test đúng** cho `SUCCESS` — nhưng bug không lưu `notes` khi `CANCELLED`/chưa test `OVERDUE` (mục 4.5); thiếu field `amount`/`evidenceId` (mục 4.2, 4.3). |
| `GET /api/v1/quotations?status=approved` | **Đã có, đã test đúng** — nhớ dùng enum chữ thường (mục 2). |
| `GET /api/v1/orders` | **Đã có** nhưng **thiếu `quotationId`** trong response danh sách (chỉ có ở chi tiết) — cần bổ sung để tránh N+1 (mục 5). |
| `GET /api/v1/deposits` (gộp toàn hệ thống, phân trang, lọc `status`/`search`) | **Chưa có (404) — cần Backend bổ sung mới**, đây là gap chặn chính để dựng đúng bảng danh sách (mục 1.2). |
| Cơ chế gắn `evidenceId` vào `Deposit` sau khi upload | **Chưa có endpoint nào hoàn tất** (mục 4.3). |
| Cơ chế sửa `amount`/`dueDate` của 1 hồ sơ cọc còn `PENDING` | **Chưa có** (mục 4.2). |
| `DELETE /api/v1/deposits/:depositId` | **Chưa kiểm tra, chưa xác nhận có tồn tại hay không** — cần thử nếu Product muốn giữ luồng "xóa và tạo lại" thay vì cho sửa. |

## 9. Tổng hợp việc cần sửa ở FE khi nối API thật

- Đổi 4 trang (2 role × danh sách/chi tiết) sang gọi qua `paymentApiService` (bổ sung thêm
  `getOrderPaymentViews`-tương-đương khi có endpoint gộp ở mục 1.2/8) thay vì đọc thẳng `@/mocks/db`
  (mục 1.1).
- Chờ Backend bổ sung `GET /api/v1/deposits` (hoặc `quotationId`/deposit-lồng-sẵn trong `GET /orders`)
  trước khi viết lại trang danh sách — tạm thời có thể chấp nhận N+1 nếu số đơn còn ít trong giai đoạn
  demo, nhưng phải gắn `TODO` rõ ràng để thay bằng endpoint gộp khi có (mục 1.2).
- Cập nhật comment sai trong `payment.service.ts`/`mockAdapter.ts` — response `POST /orders/:id/deposits`
  thật trả full object `Deposit`, không phải chỉ `{depositId, depositCode}` (mục 2).
- Bổ sung 2 giá trị `OVERDUE`/`CANCELLED` vào `DEPOSIT_STATUS_META`, đổi `RECEIVED`→`SUCCESS` khi map
  sang enum thật (mục 6).
- Quyết định hướng xử lý cho 3 field không set được qua API (`dueDate`, sửa `amount`, gắn `evidenceId`)
  trước khi giữ nguyên các UI tương ứng — hoặc ẩn tạm các UI này, hoặc yêu cầu Backend mở thêm field
  (mục 4.2, 4.3).
- Đổi/bỏ khối "Cổng thanh toán VietQR" theo hướng minh họa rõ ràng, không ngụ ý có gateway thật (mục
  4.4).
- Báo Backend bug `notes` không lưu khi `status` khác `SUCCESS` (mục 4.5) — cần fix trước khi FE dựa vào
  field này để hiển thị ghi chú hủy/quá hạn.
- Xử lý trường hợp `GET /orders/:orderId/deposits` trả nhiều hơn 1 bản ghi — quyết định cùng Product
  trước khi chốt UI trang chi tiết là "1 hồ sơ" hay "danh sách lịch sử" (mục 4.6).
- Chốt cùng Product về phạm vi quyền Admin trên trang audit (mục 7) trước khi nối nút xác nhận/sửa cọc
  cho phía `/admin/orders_audit/payments/[id]`.
