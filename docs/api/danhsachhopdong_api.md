# API cho màn "Hợp đồng" (`/admin/contracts`)

> Phạm vi tài liệu này: **chỉ** màn danh sách hợp đồng (`/admin/contracts`, 4 thẻ KPI + tabs trạng thái +
> bảng chính + bộ lọc) và modal "Khởi tạo hợp đồng mới" (`ContractCreateModal`) theo đúng 2 ảnh mẫu người
> dùng cung cấp. **Không** bao gồm trang chi tiết hợp đồng (`/admin/contracts/[id]`, có breakdown hạng
> mục/lịch thanh toán/timeline riêng — cần tài liệu khác nếu triển khai), hay modal "Sinh hợp đồng & đơn
> đặt" mở từ trang chi tiết báo giá (`CreateOrderFromQuotationModal` — đã nhắc sơ ở
> [`docs/xemchitietbaogia_api.md`](xemchitietbaogia_api.md) là ngoài phạm vi, nhưng tài liệu này **phải**
> đối chiếu trực tiếp với nó vì đây chính là chỗ phát sinh vấn đề kiến trúc lớn nhất — xem mục 1).
>
> Nguồn tham chiếu:
> - FE: `src/app/admin/contracts/page.tsx`, `src/components/contracts/ContractCreateModal.tsx`,
>   `src/mocks/adminContractsMock.ts` (toàn bộ state "Hợp đồng"), `src/components/quotations/CreateOrderFromQuotationModal.tsx`
>   (luồng song song "Tạo đơn đặt" từ trang báo giá), `src/mocks/db/orders.ts`, `src/mocks/db/employees.ts`,
>   `src/types/order.ts`, `src/services/order.service.ts`.
> - DB thật: đối chiếu trực tiếp qua MySQL MCP ngày 2026-07-20 — `SHOW TABLES` (toàn bộ 24 bảng),
>   `SHOW CREATE TABLE orders`, `order_items`, `deposits`, `quotations`, `customers`, `users`; dữ liệu mẫu
>   thật hiện có 1 order (`ORD-001`, trỏ `quotation_id` = `QUO-001`), 2 order items, 1 deposit.
> - `docs/api/` (thư mục tài liệu API tổng hợp mà CLAUDE.md nhắc tới) **không tồn tại trong repo hiện
>   tại** — tài liệu hóa endpoint Order thật nằm trực tiếp trong comment đầu `src/types/order.ts` (đối
>   chiếu trực tiếp `prisma/schema.prisma`/`order.route.ts`/`order.validator.ts`/`order.service.ts` của
>   backend ngày 2026-07-06) — dùng nguồn này làm căn cứ thay vì file doc rời không có.
>
> **Chưa chốt với Product/Backend — đây là tài liệu có phát hiện kiến trúc NGHIÊM TRỌNG NHẤT trong 4 tài
> liệu API đã viết cho tới nay**: khái niệm "Hợp đồng" như ảnh mẫu mô tả **không tồn tại dưới bất kỳ hình
> thức nào trong schema thật** — không chỉ thiếu 1-2 cột như các tài liệu trước, mà **thiếu hẳn cả bảng**,
> và tệ hơn, **FE hiện có 2 luồng mock song song, không liên kết nhau, cùng tự nhận là "bước tiếp theo sau
> khi báo giá được duyệt"**. Không thể giao việc cho backend code cho tới khi Product chọn 1 trong 2 hướng
> ở mục 1.

## 0. Base URL & Auth

- Base path: `/api/v1`.
- Trang chỉ có ở `/admin/contracts` (không có bản mirror `/manager/contracts`) — khớp CLAUDE.md: chỉ
  Admin cần xem/audit hợp đồng, việc tạo đơn thật (nếu hướng đi cuối cùng là gộp vào Order) thuộc quyền
  Manager, cần rà soát lại phân quyền theo hướng Product chọn ở mục 1.

## 1. Vấn đề kiến trúc nghiêm trọng nhất — "Hợp đồng" không có bảng thật, và xung đột với luồng Order đã có

### 1.1. Không có bảng `contracts` trong DB thật

Đối chiếu `SHOW TABLES` toàn bộ database thật (24 bảng: `attendances`, `business_policies`,
`change_request_items`, `change_requests`, `customers`, `deposits`, `evidences`, `item_categories`,
`item_types`, `items`, `notifications`, `order_items`, `orders`, `quotation_items`, `quotations`,
`schedule_plan_assignees`, `schedule_plans`, `settlements`, `supplier_transaction_items`,
`supplier_transactions`, `suppliers`, `survey_reports`, `users`, `work_tasks`) — **không có bảng nào tên
`contracts` hay tương đương**. CLAUDE.md mục "Vòng đời Order" (state machine nghiệp vụ chính thức của dự
án) cũng **không có bước "Hợp đồng"** nào trong chuỗi `Request → Survey → ... → Quotation cuối + yêu cầu
cọc → xác nhận cọc ... → đóng order` — bước tiếp theo ngay sau "Quotation cuối" là **xác nhận cọc + khóa
inventory**, tức là đi thẳng vào vòng đời **Order**, không qua khâu "Hợp đồng" trung gian nào.

Khớp với việc `orders` thật đã có sẵn `quotation_id` (nullable FK trỏ tới `quotations`) — đây **chính là**
cơ chế "chuyển đổi báo giá đã duyệt thành hồ sơ vận hành chính thức" mà màn "Hợp đồng" đang cố mô phỏng
lại bằng 1 entity mock hoàn toàn riêng biệt.

### 1.2. Toàn bộ dữ liệu "Hợp đồng" hiện tại là 1 mock store độc lập, tự sinh lại thông tin đã có ở Quotation

`src/mocks/adminContractsMock.ts` tự định nghĩa `AdminContract` với **~25 field riêng** (id, quotationId,
customerName/Phone/Email/Company/Address, eventName, guestCount, weddingDate, packageType, venue,
eventNotes, createdAt, signedDate, validUntil, coordinatorName, status, subTotal, discount, deposit,
vatRate, grandTotal, items[], installments[], timeline[]) — lưu trong 1 module-scope array riêng
(`let store: AdminContract[]`, không qua `createMockStore`/localStorage như các mock khác trong dự án,
nghĩa là **mất trắng khi F5 trang**, khác hành vi mọi mock khác đã có trong repo). Phần lớn field
(customerName/Phone/Email/Company/Address/eventName/guestCount/weddingDate/packageType/venue) chỉ là
**copy lại nguyên xi** từ `getAdminQuotationById()`/`getAdminQuotationDetail()` — không có giá trị thông
tin mới nào so với Quotation đã duyệt, ngoại trừ 6 field thật sự mới: `coordinatorName`, `vatRate`,
`deposit` (cố định `30_000_000`, không tính theo `business_policies`), `discount` (cố định
`10_000_000`/`0` tùy `index % 4`, không nhập tay được), `installments[]` (lịch 3 đợt cố định hard-code
ngày `2026-08-01`/`2026-08-10`), và `status` (`draft`/`sent`/`signed`/`completed` — vòng đời "ký kết văn
bản", khác hẳn `order_status` thật của Order là vòng đời "thi công sự kiện").

### 1.3. Xung đột trực tiếp với `CreateOrderFromQuotationModal` — 2 luồng mock không hề biết tới nhau

Trang chi tiết báo giá (`manager/quotations/[id]/page.tsx`, đã tài liệu hóa ở
[`docs/xemchitietbaogia_api.md`](xemchitietbaogia_api.md)) có nút **"Sinh hợp đồng & đơn đặt"** — tên nút
gợi ý đây chính là hành động tương đương màn "Hợp đồng" này, nhưng khi bấm vào lại mở
`CreateOrderFromQuotationModal`, một wizard 5 bước **hoàn toàn khác**, ghi thẳng vào
`mocks/db/orders.ts` (`addAdminOrder()` — mock Order thật, **có** `createMockStore`/localStorage, **có**
liên kết `customerId` FK thật) chứ không đụng gì tới `adminContractsMock.ts`. Hai luồng này:

- Dùng 2 store hoàn toàn tách biệt (`adminContractsMock.ts` vs `db/orders.ts`) — tạo "hợp đồng" ở màn này
  **không** làm xuất hiện Order tương ứng, và ngược lại tạo Order từ nút "Sinh hợp đồng & đơn đặt" **không**
  làm xuất hiện Hợp đồng tương ứng ở màn `/admin/contracts`.
- Chỉ được "liên kết" ở bảng danh sách hợp đồng theo kiểu **trùng khớp tình cờ** qua
  `orders.find(o => o.quotationId === contract.quotationId)` (mục "Đơn đặt liên kết"/"Trạng thái Đơn"/
  "Thanh toán" ở cột bảng) — không phải join qua khóa ngoại thật, chỉ đúng nếu cả 2 luồng tình cờ được
  tạo từ cùng 1 `quotationId` (dữ liệu mẫu hiện làm đúng vậy, nhưng không có ràng buộc nào đảm bảo khi
  dùng thật — 1 báo giá có thể vừa có "Hợp đồng" (luồng A) vừa có Order riêng không liên quan (luồng B) do
  người dùng chọn nhầm luồng).
- Cùng đọc `quotation.assignee`/`COORDINATOR_POOL` cho "người phụ trách" nhưng field tên khác nhau
  (`coordinatorName` ở Contract, cũng `coordinatorName` ở Order — trùng tên nhưng 2 nguồn dữ liệu độc
  lập, có thể lệch giá trị giữa 2 nơi cho cùng 1 báo giá nếu người dùng tạo cả 2).

**Đây là dấu hiệu rõ ràng rằng 2 màn hình đang cùng giải quyết 1 bài toán nghiệp vụ ("báo giá đã duyệt →
hồ sơ chính thức để vận hành") theo 2 cách khác nhau, chưa được Product thống nhất** — không phải lỗi kỹ
thuật đơn thuần có thể tự vá ở tầng API.

### 1.4. `coordinatorName` ("Nhân sự phụ trách ký duyệt") không có căn cứ trong RBAC thật

`COORDINATOR_POOL` lấy tên từ `db/employees.ts` — 1 danh sách **"Employee" (nhân sự vận hành sự kiện)
hoàn toàn tách biệt khỏi bảng `users` (RBAC đăng nhập)**, đã tự ghi chú ngay trong file nguồn: "Employee
... KHÁC RBAC User đăng nhập". Đối chiếu `SHOW TABLES` — **không có bảng `employees` nào trong DB thật**,
chỉ có `users` (role `ADMIN`/`MANAGER`/`LEADER`/`TECHNICAL`, không có khái niệm "Điều phối viên"/"Kỹ
thuật"/"Bếp trưởng"/"MC"/"Trang trí" như `EmployeeRole` mock). Theo CLAUDE.md, **không có bước "ký duyệt
hợp đồng" nào bởi 1 nhân sự riêng** trong quy trình nghiệp vụ đã tài liệu hóa — Manager là người trực tiếp
tạo/xác nhận toàn bộ vòng đời Order. Trường "Nhân sự phụ trách ký duyệt" trên modal khởi tạo hợp đồng
**không khớp với bất kỳ vai trò nào đã định nghĩa** — cần Product xác nhận đây có phải khái niệm nghiệp vụ
thật (và nếu có, gán vào `users.user_id` nào, role gì) hay chỉ là dữ liệu trang trí kế thừa từ bản UI mẫu.

### 1.5. Đề xuất hướng xử lý — cần Product xác nhận trước khi backend code bất kỳ dòng nào

- **Hướng A (khuyến nghị mạnh)**: **Bỏ hẳn khái niệm "Hợp đồng" như 1 entity riêng.** Đổi màn
  `/admin/contracts` thành 1 **view lọc của Order** (chỉ hiển thị Order có `quotation_id IS NOT NULL`,
  tức "đơn được sinh từ báo giá đã duyệt") — tái dùng thẳng `GET /api/v1/orders`/`POST /api/v1/orders`
  **đã có sẵn** (`order.service.ts`, xem mục 3). Modal "Khởi tạo hợp đồng mới" ở đây và
  `CreateOrderFromQuotationModal` ở trang báo giá **gộp thành 1 luồng duy nhất** (khuyến nghị giữ wizard 5
  bước đã có, vì đã map khá sát `CreateOrderPayload` thật — xem mục 3.2). Các field không có căn cứ dữ
  liệu thật (`vatRate`, `installments[]` lịch thanh toán riêng, `coordinatorName` ký duyệt, `status`
  draft/sent/signed/completed) **bỏ khỏi UI** cho tới khi Product xác nhận là nhu cầu nghiệp vụ thật cần
  bảng riêng (Hướng B).
- **Hướng B (chỉ chọn nếu Product xác nhận "Hợp đồng" là khái niệm pháp lý thật sự khác Order)**: Nếu
  doanh nghiệp thật sự cần 1 văn bản hợp đồng riêng (có quy trình ký kết draft→sent→signed độc lập với
  tiến độ thi công, có VAT, có lịch thanh toán nhiều đợt khác cơ chế `deposits`/`settlements` hiện có) —
  cần thêm bảng mới, ví dụ minh họa (**CHƯA CHỐT**, cần Product/Backend thiết kế kỹ hơn, đặc biệt quan hệ
  1-1 hay 1-n với `orders`, và cách `installments`/`deposits` không giẫm chân nhau):
  ```sql
  CREATE TABLE contracts (
    contract_id varchar(36) PRIMARY KEY,
    contract_code varchar(50) UNIQUE NOT NULL, -- "HD2507-001"
    quotation_id varchar(36) NOT NULL REFERENCES quotations(quotation_id),
    order_id varchar(36) DEFAULT NULL REFERENCES orders(order_id), -- gán sau khi Order được tạo
    vat_rate decimal(5,2) NOT NULL DEFAULT 0,
    status ENUM('DRAFT','SENT','SIGNED','COMPLETED') NOT NULL DEFAULT 'DRAFT',
    signed_by varchar(36) DEFAULT NULL REFERENCES users(user_id), -- thay coordinatorName tự do
    signed_date timestamp NULL,
    created_by varchar(36) NOT NULL REFERENCES users(user_id),
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE contract_installments (
    installment_id varchar(36) PRIMARY KEY,
    contract_id varchar(36) NOT NULL REFERENCES contracts(contract_id),
    name varchar(255) NOT NULL,
    amount decimal(14,2) NOT NULL,
    due_date date NOT NULL,
    status ENUM('PENDING','UPCOMING','PAID') NOT NULL DEFAULT 'PENDING'
  );
  ```
  Đây là khối lượng công việc lớn (2 bảng mới, quy trình duyệt ký riêng, làm rõ ranh giới với
  `deposits`/`settlements` đã có), **không đề xuất tự chọn** vì là quyết định phạm vi nghiệp vụ, không
  phải chi tiết kỹ thuật.

Tài liệu từ mục 2 trở xuống trình bày ánh xạ dữ liệu **giả định Hướng A** (khuyến nghị) vì đây là hướng
duy nhất khả thi ngay với schema hiện tại — nếu Product chọn Hướng B, cần viết lại toàn bộ mục 3.

## 2. Ánh xạ dữ liệu FE ↔ Order thật (giả định Hướng A)

### 2.1. 4 thẻ KPI

| Thẻ UI | Nguồn (mock) | Theo Hướng A |
|---|---|---|
| Tổng số hợp đồng | `contracts.length` | Đếm `orders WHERE quotation_id IS NOT NULL`. |
| Đã thành đơn đặt | Đếm hợp đồng có `linkedOrder` tồn tại và `status !== 'CANCELLED'` | Không còn ý nghĩa riêng — nếu "Hợp đồng" = Order, mọi dòng trong bảng **đã là** Order thật, cần đổi nhãn thẻ (vd đổi thành "Đơn đang hoạt động" = đếm `order_status != 'CANCELLED'`) hoặc bỏ thẻ này. |
| Chưa tạo đơn | Đếm hợp đồng **không có** `linkedOrder` | Không còn ý nghĩa — theo Hướng A, "Hợp đồng" tồn tại nghĩa là Order đã tồn tại (được tạo cùng lúc), không có trạng thái "hợp đồng chưa thành đơn". Đây chính là hệ quả trực tiếp của việc gộp 2 khái niệm — cần Product xác nhận có chấp nhận bỏ khái niệm "hợp đồng nháp chưa sinh đơn" hay không (xem mục 2.2 về tab "Nháp"). |
| Tổng giá trị | `SUM(grandTotal)` (đã gồm VAT giả định 8%) | `SUM(orders.total_amount)` — **không có VAT** trên `orders` thật, cần Product xác nhận có cần tính VAT vào `total_amount` hay bỏ hẳn khái niệm VAT (mục 1.2). |

### 2.2. Tabs trạng thái (Nháp/Đã gửi/Đã ký/Đã thanh lý) — không có tương đương trực tiếp trên Order

`orders.order_status` thật chỉ có `NEW`/`CONFIRMED`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED` — mô tả **tiến
độ thi công sự kiện**, không mô tả trạng thái ký kết văn bản. Theo Hướng A (bỏ hẳn workflow ký kết riêng),
**4 tab này cần đổi hẳn** sang lọc theo `order_status` thật (khớp cách trang `/admin/orders_audit` đã làm,
ngoài phạm vi tài liệu này) — không có cách map 1-1 nào giữa `draft/sent/signed/completed` và
`NEW/CONFIRMED/IN_PROGRESS/COMPLETED/CANCELLED` (5 giá trị thật không phải tập con/superset của 4 giá trị
mock). Đây là thay đổi UI đáng kể, cần Product duyệt lại toàn bộ bố cục tabs, không chỉ đổi tên nhãn.

### 2.3. Bảng chính

| Cột UI | Nguồn (mock) | Theo Hướng A — cột/join `orders` thật |
|---|---|---|
| Mã hợp đồng (`HD2507-001`) | `contract.id` (tự sinh chuỗi `HD` + tháng + số thứ tự, tách biệt hoàn toàn `order.orderId`) | `orders.order_code` — **đổi hẳn định dạng hiển thị**, không còn prefix `HD` riêng (dữ liệu mẫu thật: `ORD-001`, xem mục 3.3 về format mã). |
| Khách hàng (tên + SĐT) | `contract.customerName/Phone` (copy tại thời điểm tạo, không tự cập nhật nếu khách đổi SĐT) | JOIN `customers.customer_name/phone` qua `orders.customer_id` — **luôn là dữ liệu mới nhất** của khách hàng (khác cơ chế snapshot của contract mock), cần Product xác nhận chấp nhận được (khớp cách các bảng Order/Quotation khác trong hệ thống đã làm — không snapshot thông tin khách hàng). |
| Gói & Ngày tổ chức | `contract.packageType` (chuỗi tự do từ `PACKAGE_OPTIONS`, 5 gói cưới cố định), `contract.weddingDate` | `orders.event_type`/`orders.event_name` (dữ liệu mẫu thật hiện là `"Conference"`/`"Tech Summit 2026"` — **không phải khái niệm "gói dịch vụ cưới"** như mock, mà là loại sự kiện tự do) + `orders.event_date`. Cần Product xác nhận `event_type` có nên ràng buộc theo 1 danh sách gói cố định (giống `PACKAGE_OPTIONS` mock) hay giữ tự do như hiện tại. |
| Giá trị | `contract.grandTotal` (đã cộng VAT 8%, trừ discount) | `orders.total_amount` — không có VAT/discount tách riêng trên `orders` thật (mục 2.1). |
| Đơn đặt liên kết / Trạng thái Đơn / Thanh toán | Join tình cờ qua `quotationId` (mục 1.3) sang `mocks/db/orders.ts` | **Không còn cần 3 cột này** theo Hướng A — vì mỗi dòng trong bảng **chính là** 1 Order, không có khái niệm "liên kết" tới 1 Order khác nữa. Xóa 3 cột, thay bằng cột `orderStatus`/`paymentStatus` trực tiếp của chính dòng đó (`orders.order_status`, `orders.payment_status` — đã có UI mẫu tương đương ở `admin/orders_audit`). |
| Trạng thái HĐ | `CONTRACT_STATUS_META[contract.status]` | Xóa theo Hướng A (đã gộp vào `orderStatus` ở trên, mục 2.2). |
| Hành động (Xem/Xóa) | `router` sang `/admin/contracts/[id]`, `deleteAdminContract()` | Đổi route sang trang chi tiết Order thật (`admin/orders_audit/[id]` hoặc tương đương). **Xóa Order**: CLAUDE.md không liệt kê nghiệp vụ "xóa Order" (chỉ có hủy đơn qua đổi `order_status` sang `CANCELLED` kèm `cancel_reason` — đã có `PUT /api/v1/orders/:id/status`) — nút "Xóa hợp đồng" cứng hiện tại **không có API tương đương an toàn**, cần đổi thành nút "Hủy đơn" gọi `updateOrderStatus` thay vì xóa cứng bản ghi. |

### 2.4. Bộ lọc (Đơn hàng/Thanh toán/khoảng ngày)

`ORDER_STATUS_FILTER_OPTIONS`/`PAYMENT_STATUS_FILTER_OPTIONS` đã khớp khá sát enum thật
(`NEW`/`CONFIRMED`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED` và `UNPAID`/`DEPOSITED`/`PAID`) — theo Hướng A,
2 filter này áp dụng trực tiếp lên chính bảng (không phải lọc theo Order "liên kết" nữa), map thẳng vào
`orderStatus`/`paymentStatus` query param đã có ở `GetOrdersQuery` (`order.service.ts`). Riêng giá trị đặc
biệt `NotCreated`/`None` ("Chưa tạo đơn"/"Chưa có đơn hàng") **không còn ý nghĩa** vì mọi dòng đều là Order
thật (mục 2.1/2.3).

## 3. Modal "Khởi tạo hợp đồng mới" — ánh xạ sang `POST /api/v1/orders` đã có sẵn

### 3.1. Trường trên UI

| Trường UI | Nguồn (mock) | Theo Hướng A |
|---|---|---|
| Mã hợp đồng * (readonly, tự sinh) | `nextAdminContractId()` (đếm max hiện có +1, prefix `HD` + tháng hiện tại) | **Bỏ khỏi form** — theo `CreateOrderPayload` thật (`types/order.ts`), `POST /api/v1/orders` **không nhận `orderCode` từ client**, backend tự sinh (`CreateOrderResult` chỉ trả về `{orderId, orderCode}` sau khi tạo) — không cần (và không nên) hiển thị mã dự đoán trước trên form, tương tự đã chốt cho `quotationCode` ở `docs/taobaogiamoi_api.md` mục 2. |
| Chọn báo giá liên kết * (dropdown báo giá `APPROVED` và **chưa có hợp đồng**) | `getAvailableQuotationsForContract()` — lọc `status === 'approved' && !linkedIds.has(quotationId)` | Giữ nguyên ý tưởng lọc nhưng đổi điều kiện "chưa có hợp đồng" thành **"chưa có Order nào trỏ `quotation_id` này"** (`orders WHERE quotation_id = :id` rỗng) — cần thêm 1 trong 2: (a) endpoint mới `GET /api/v1/quotations?status=APPROVED&hasOrder=false`, hoặc (b) FE tự lọc ở client bằng cách gọi `GET /api/v1/quotations?status=APPROVED` (đã có, mục 4.1 `docs/danhsachbaogia_api.md`) rồi loại các báo giá đã có `linkedOrderId` (đã đề xuất trả field này ở `docs/xemchitietbaogia_api.md` mục 5.1) — khuyến nghị (b), ít việc backend hơn, chấp nhận được vì số báo giá `APPROVED` tại 1 thời điểm không lớn. |
| Nhân sự phụ trách ký duyệt (dropdown `COORDINATOR_POOL`) | `db/employees.ts`, không phải `users` thật | Theo mục 1.4 — **cần Product xác nhận trước**: nếu giữ, đổi sang dropdown chọn `users.user_id` thật (lọc role phù hợp, có thể là `MANAGER`) thay vì tên tự do từ pool "Employee" không tồn tại trong DB; nếu không có căn cứ nghiệp vụ thật, bỏ hẳn trường này khỏi form tạo Order. |

### 3.2. Endpoint đề xuất — dùng thẳng `POST /api/v1/orders` đã có

**Không cần endpoint mới** cho hành động "khởi tạo" — đã có sẵn `POST /api/v1/orders`
(`orderApiService.createOrder`, xem `src/types/order.ts` dòng 80-101). Khác biệt quan trọng cần FE xử lý
khi nối API thật:

- `CreateOrderPayload` **yêu cầu** `customerId`, `eventType`, `eventDate`, `location`, `items[]` (tối
  thiểu 1 dòng, mỗi dòng `itemId`/`quantity`/`unitPrice`/`source?`) — **không tự copy `items` từ
  Quotation phía backend** (đã ghi rõ trong comment `types/order.ts`: "Không tự copy items từ Quotation —
  items là danh sách độc lập của Order, phải nhập lại thủ công dù đã chọn quotationId"). Modal hiện tại
  (`ContractCreateModal`) **chỉ có 3 trường** (mã HĐ, báo giá, người phụ trách) — thiếu hẳn bước nhập
  `eventType`/`eventDate`/`location`/`items[]` bắt buộc. **`CreateOrderFromQuotationModal`** (wizard 5
  bước ở trang báo giá) đã có đủ các bước này (Bước 3: sự kiện, Bước 4: hạng mục) — theo Hướng A, khuyến
  nghị **dùng lại nguyên wizard đó** cho màn Hợp đồng thay vì modal 3 trường hiện tại, không viết 1 modal
  rút gọn thiếu field bắt buộc.
- `quotationId`: optional trên `CreateOrderPayload` thật nhưng theo đúng luồng nghiệp vụ màn này (luôn đi
  từ 1 báo giá đã duyệt), FE luôn gửi kèm.
- Response chỉ trả `{orderId, orderCode}` — sau khi tạo, FE cần tự `GET /api/v1/orders/:orderId` (hoặc
  điều hướng thẳng sang trang chi tiết Order) nếu cần hiển thị lại đầy đủ, không trông đợi response tạo
  mới trả full object.

**Permission**: theo `CreateOrderFromQuotationModal` hiện đặt ở trang Quotation của Manager — hành động
tạo Order nên là quyền **Manager**, không phải Admin (đúng CLAUDE.md: Admin không xử lý vận hành hằng
ngày). Nếu giữ màn `/admin/contracts`, cần xác nhận lại với Product: có nên chuyển hẳn màn "Khởi tạo hợp
đồng" (theo Hướng A thực chất là "Tạo đơn từ báo giá") sang khu vực `/manager/...` thay vì `/admin/...`?

### 3.3. Định dạng mã — cùng vấn đề đã nêu ở các tài liệu trước

Mock hiển thị `HD2507-001` (prefix `HD` + `YYMM` + số thứ tự) cho "hợp đồng" và `ORD-001` cho Order thật
(dữ liệu mẫu DB) — 2 định dạng hoàn toàn khác nhau, thêm 1 lý do nữa để không tự đoán mã ở form tạo mới
(mục 3.1), giống vấn đề đã nêu ở `docs/taokhachhang_api.md`/`docs/danhsachbaogia_api.md`.

## 4. Tổng hợp việc cần sửa ở FE khi nối API thật

- **Chờ Product chốt Hướng A/B ở mục 1.5 trước khi code bất kỳ phần nào** — đây là điều kiện tiên quyết,
  khác các tài liệu trước (nơi tài liệu tự chọn được 1 hướng khả thi ngay).
- Nếu chốt Hướng A: gộp `/admin/contracts` + modal khởi tạo thành 1 view lọc của Order, xóa hẳn
  `mocks/adminContractsMock.ts` (`AdminContract`, `ContractStatus`, `installments[]`, `vatRate`...),
  `ContractCreateModal.tsx`; dùng lại `CreateOrderFromQuotationModal` (hoặc rút gọn 1 phiên bản mở từ màn
  này với các bước tương tự) thay vì viết modal 3 trường thiếu field bắt buộc; đổi 4 tab trạng thái + 4
  KPI + cột bảng theo `orderStatus`/`paymentStatus` thật (mục 2.1-2.3); hợp nhất luôn với luồng "Sinh hợp
  đồng & đơn đặt" ở trang chi tiết báo giá để không còn 2 điểm vào cho cùng 1 hành động.
- Nếu chốt Hướng B: viết lại toàn bộ tài liệu này theo schema `contracts`/`contract_installments` mới,
  làm rõ quan hệ với `orders`/`deposits`/`settlements` đã có để tránh chồng chéo 2 khái niệm "lịch thanh
  toán" (installments của Contract vs `deposits`/`settlements` của Order).
- Dù chọn hướng nào: rà soát lại trường "Nhân sự phụ trách ký duyệt" (mục 1.4/3.1) với Product trước, vì
  đây là field duy nhất trong toàn bộ màn hình không có căn cứ nghiệp vụ rõ ràng trong tài liệu hiện có.
