# API cho màn "Danh sách Nhà cung cấp đối tác" (`/manager/suppliers`, `/admin/suppliers`)

> **Cập nhật 2026-07-21**: đã ghép FE thật với BE cho đúng màn này. Xác nhận qua curl trực tiếp với
> backend đang chạy (`localhost:3001`): `GET/POST/PUT /api/v1/suppliers` và
> `GET /api/v1/supplier-transactions?supplierId=X` **đều đã hoạt động** (trước đó 404 ở mục 6.0 —
> route đã được mount trong lúc này). Đã xác nhận trực tiếp qua request thật, không chỉ đọc code:
>
> - `debtBalance` **được backend trả sẵn** trong mọi response `Supplier` (denormalized, không cần FE
>   tự tính — mục 3.1 hướng (a) coi như đã chọn, không phải hướng (2) FE tự tổng hợp như khuyến nghị cũ).
> - `PUT /suppliers/:id` chấp nhận **partial body** (vd chỉ `{status}`) — dùng chung cho Sửa và Khóa/Mở khóa.
> - `email` gửi lên bị bỏ qua âm thầm, không lưu, không trả về — đúng như `AddSupplierModal.tsx` đã ghi chú.
> - `GET /supplier-transactions` khớp đúng shape `types/procurement.ts` (`transactionType`
>   RENTAL/PURCHASE, `status` PENDING/APPROVED/IN_PROGRESS/COMPLETED/CANCELLED), có thêm `orderCode` join
>   sẵn (đã bổ sung vào type).
> - `catalogItems[]` (mục 4.1) **vẫn chưa có API** — modal chi tiết mới (`SupplierProfileModal.tsx`) chỉ
>   hiển thị trạng thái rỗng cho mục này, chưa xóa UI.
>
> FE đã đổi sang gọi `supplierApiService`/`procurementApiService` thật cho `/admin/suppliers` +
> `/manager/suppliers` (`SupplierFormModal.tsx` viết lại theo `CreateSupplierPayload`/
> `UpdateSupplierPayload`, `SupplierProfileModal.tsx` thay cho `SupplierDetailModal.tsx` ở 2 trang này).
> `SupplierDetailModal.tsx`/`mocks/db/suppliers.ts` **vẫn giữ nguyên, chưa đổi** — chỉ dùng cho
> `/admin|manager/suppliers/purchase-orders` (ngoài phạm vi tài liệu này, mục 6 header) nên không đụng
> tới trong đợt này. `rating`/`notes` đã có UI thu thập trên form (trước đó chưa có, mục 5).
>
> Phạm vi tài liệu này: **chỉ** màn danh sách nhà cung cấp (ảnh mẫu người dùng cung cấp — thanh tìm
> kiếm + lọc trạng thái, bảng chính 6 cột, nút "Thêm Đối Tác Mới", modal thêm/sửa, modal "Hồ sơ chi
> tiết Đối tác"). **Không** bao gồm các màn liên quan nhưng tách route riêng: `/manager/suppliers/
> purchase-orders` (Đơn thuê/mua), `/manager/suppliers/returns` (Trả thiết bị NCC), `/admin/reports/
> debts` (Công nợ NCC tổng hợp), `/admin/catalog/supplier-services`, `/admin/finance/supplier-payouts`
> — có endpoint riêng, chỉ tham chiếu chéo khi cần giải thích 1 field trên màn này.
>
> Nguồn tham chiếu:
> - FE: `src/app/manager/suppliers/page.tsx` và `src/app/admin/suppliers/page.tsx` (2 file cùng
>   pattern — component `SupplierFormModal` khai báo inline trong mỗi file, `SupplierDetailModal`
>   dùng chung từ `src/components/suppliers/SupplierDetailModal.tsx`), `src/mocks/db/suppliers.ts`
>   (nguồn dữ liệu "Supplier" DUY NHẤT hiện đang được 2 trang này đọc thẳng), `src/types/supplier.ts`,
>   `src/types/procurement.ts`, `src/services/supplier.service.ts`, `src/services/procurement.service.ts`,
>   `src/services/mockAdapter.ts` (route `POST /suppliers`, `GET/POST /supplier-transactions`...),
>   `src/mocks/apiFixtures.ts` (`MOCK_SUPPLIER_TRANSACTIONS`), component orphan
>   `src/components/suppliers/AddSupplierModal.tsx` (xem mục 1.3 — **không được import ở bất kỳ trang
>   nào** nhưng lại là bằng chứng trực tiếp tốt nhất về payload thật, nên vẫn dùng làm căn cứ).
> - DB thật: **không đối chiếu được qua MySQL MCP trong phiên viết tài liệu này** — báo lỗi
>   `Connection closed` ở cả 6 lần thử (`SHOW TABLES`, `SELECT 1`), khác kiểu lỗi `ETIMEDOUT` đã gặp ở
>   `docs/thuhoi_hoankho_api.md`/`docs/tonkhodoanhnghiep_api.md`. Tài liệu `docs/tonkhodoanhnghiep_api.md`
>   (viết cùng ngày 2026-07-20, trước tài liệu này) đã chạy được `SHOW TABLES` và xác nhận bảng
>   `supplier_transactions`/`supplier_transaction_items` **tồn tại thật** trong số 25 bảng — nhưng
>   **chưa có tài liệu nào từng chạy `SHOW CREATE TABLE suppliers`** để xác nhận cột của bảng gốc
>   `suppliers`.
> - **Backend thật (`localhost:3001`, cấu hình ở `.env.local` — `NEXT_PUBLIC_MOCK_MODE=false`) đang
>   chạy sẵn và được gọi thử trực tiếp qua curl trong phiên này** (không qua MCP, gọi HTTP thẳng) —
>   phát hiện quan trọng nhất của toàn tài liệu: **`GET /api/v1/suppliers`, `POST /api/v1/suppliers`,
>   `GET /api/v1/suppliers/:id`, `GET /api/v1/supplier-transactions`, kể cả biến thể tên
>   `/api/v1/supplier` (số ít), `/api/v1/procurement` đều trả `404 {"code":"NOT_FOUND","message":
>   "Route not found: ..."}`**. Để đối chứng, `GET /api/v1/orders`/`GET /api/v1/customers` (route đã
>   xác nhận tồn tại ở các tài liệu trước) trả **`401 UNAUTHORIZED`** (thiếu token) chứ không phải 404
>   — tức là router bắt path **trước** khi tới middleware auth, nên 404 ở `/suppliers` nghĩa là **route
>   này chưa được đăng ký/mount trên server thật, không phải do thiếu quyền**. Kết luận: toàn bộ module
>   Supplier (danh sách, tạo, sửa, giao dịch thuê/mua) **hiện chưa tồn tại trên backend đang chạy**,
>   dù `types/supplier.ts`/`types/procurement.ts`/`AddSupplierModal.tsx` đều có comment dẫn thẳng tên
>   file backend cụ thể (`supplier.validator.ts`, `supplier-transaction.route.ts`) — các file đó có thể
>   tồn tại trong source backend nhưng **chưa được mount vào router chính**, hoặc server đang chạy là
>   build cũ hơn các file đó. Toàn bộ ánh xạ field ở tài liệu này vẫn dựa trên (a) comment đầu
>   `types/supplier.ts`/`types/procurement.ts` (tự đánh dấu **"ĐÃ LỖI THỜI sau đợt backend refactor
>   2026-07-06"**) và (b) comment trong `AddSupplierModal.tsx` dòng 15-17 — coi là "có căn cứ code
>   nhưng chưa xác nhận được là đã triển khai trên server thật". **Khuyến nghị Backend xác nhận trước
>   tiên: module Supplier có đang được phát triển ở nhánh/máy khác chưa deploy lên server test này hay
>   thực sự chưa bắt đầu implement** — đây là câu hỏi ưu tiên cao hơn cả việc đối chiếu tên cột.
> - `docs/api/` **không tồn tại trong repo** (giống mọi tài liệu API trước đã viết).

## 0. Base URL & Auth

- Base path: `/api/v1`.
- Trang tồn tại ở **cả** `/admin/suppliers` và `/manager/suppliers` (2 file gần như giống hệt nhau) —
  cả 2 đều có đủ nút Thêm/Sửa/Khóa. CLAUDE.md mục 1 quy định Admin "không xử lý vận hành hằng ngày" —
  quản lý hồ sơ NCC (thêm/sửa/khóa đối tác) có thể coi là master-data (Admin quản lý) hoặc vận hành
  (Manager làm việc trực tiếp với NCC) tùy cách hiểu; khác các tài liệu trước (Order/Hợp đồng) nơi
  việc Admin có quyền ghi được xác định rõ là sai, ở đây **chưa đủ căn cứ kết luận** — cần Product xác
  nhận Admin có nên giữ quyền Thêm/Sửa/Khóa NCC hay chỉ xem, trước khi code phân quyền qua
  `usePermission`.

## 1. Đối chiếu tổng quan

### 1.1. Trang đọc thẳng mock, không qua `service` layer — vi phạm CLAUDE.md mục 4 giống các tài liệu trước

`manager/suppliers/page.tsx` và `admin/suppliers/page.tsx` gọi thẳng `getAdminSuppliers()` /
`createAdminSupplier()` / `updateAdminSupplier()` / `toggleAdminSupplierStatus()` từ
`@/mocks/db/suppliers` — **không** gọi `supplierApiService` nào (`getSuppliers`/`createSupplier`/
`updateSupplier`). Theo CLAUDE.md mục 0 (giai đoạn UI-first) việc này chấp nhận được tạm thời, nhưng
cần đổi sang gọi qua `supplierApiService` khi nối API thật (mục 7).

### 1.2. `mockAdapter.ts` chỉ có `POST /suppliers` — **không có `GET /suppliers`** dù `supplierApiService.getSuppliers()` đã khai báo gọi route này

Khác các tài liệu trước (nơi mock adapter luôn có đủ cặp GET/POST dù thiếu logic lọc), ở đây
`mockAdapter.ts` dòng 611-615 **chỉ implement `POST /suppliers`** (trả `envelope({supplierId, ...body})`
kèm thông báo "Thêm nhà cung cấp thành công (dữ liệu mô phỏng)"). Không có nhánh `GET /suppliers` hay
`PUT /suppliers/:id` nào trong toàn file. Nếu gọi `supplierApiService.getSuppliers()` hoặc
`.updateSupplier()` ngay bây giờ (qua `mockAdapter`), request sẽ rơi vào nhánh mặc định — cần kiểm tra
`mockAdapter.ts` xử lý route không khớp thế nào (thường trả lỗi 404 mô phỏng) trước khi bất kỳ trang
nào chuyển sang gọi qua `service` thật, đồng thời bổ sung 2 route còn thiếu vào mock adapter song song
với việc yêu cầu Backend triển khai.

### 1.3. `types/supplier.ts` tự khai lỗi thời, nhưng `AddSupplierModal.tsx` (component mồ côi) lại là bằng chứng schema thật mới hơn — mâu thuẫn cần Backend xác nhận

`src/types/supplier.ts` dòng 1: comment tự đánh dấu **"ĐÃ LỖI THỜI sau đợt backend refactor
2026-07-06"** nhưng không nói rõ lỗi thời ở điểm nào. Trong khi đó `src/components/suppliers/
AddSupplierModal.tsx` — **không được import ở bất kỳ page nào trong repo** (kiểm tra
`grep -r "AddSupplierModal"` chỉ khớp chính file này, tức là code chết/chưa nối) — lại gọi đúng qua
`supplierApiService.createSupplier()` (đúng service layer) và có comment dòng 15-17 dẫn thẳng
`D:\bnwems-backend-api src\validators\supplier.validator.ts`:

> "`createSupplierSchema` thật KHÔNG nhận `email` trong body (dù model Supplier có cột `email`) — bỏ
> field này khỏi form để tránh gây hiểu nhầm là lưu được."

Đây là bằng chứng code cụ thể hơn hẳn 2 trang danh sách đang dùng (form inline trong `page.tsx` không
thu `contactPerson` — field `AddSupplierModal.tsx` **có** thu và gửi lên — cũng không có ghi chú nào về
`email`). Tức là: **có 3 phiên bản form tạo NCC khác nhau trong cùng repo** (form inline ở
`manager/suppliers/page.tsx`, form inline ở `admin/suppliers/page.tsx` — 2 bản gần giống hệt nhau, và
`AddSupplierModal.tsx` mồ côi) — không cái nào khớp hoàn toàn payload thật đã biết. Khuyến nghị: dùng
`AddSupplierModal.tsx` làm cơ sở khi viết lại form thật (đã đúng service layer + đúng field
`contactPerson`, đã loại `email`), thay vì 2 form inline hiện tại (mục 5).

## 2. Bộ lọc (tìm kiếm, trạng thái)

| Filter UI | Nguồn (mock, client-side) | Theo API thật |
|---|---|---|
| Ô tìm kiếm "Tìm đối tác theo tên nhà cung cấp hoặc số điện thoại..." | So khớp thủ công `supplierName.toLowerCase().includes(term)` HOẶC `phone.toLowerCase().includes(term)` (`page.tsx` dòng 42-49) | `GetSuppliersQuery.search` — **đã khai báo trên type** nhưng (a) `mockAdapter.ts` không có route `GET /suppliers` nên chưa thể test lọc thật (mục 1.2), (b) cần Backend xác nhận rõ `search` quét đúng 2 cột `supplier_name`/`phone` hay thêm cả `supplier_code`/`address` — tên biến không tự mô tả phạm vi, giống phát hiện tương tự ở tài liệu Đơn đặt hàng. |
| Dropdown "Tất cả trạng thái" (`ACTIVE`/`INACTIVE`) | So khớp `s.status !== statusFilter` | `GetSuppliersQuery.status: SupplierStatus` — đã khai báo, khớp đúng 2 giá trị enum trên `types/supplier.ts`. |
| *(không có)* Phân trang | Bảng hiển thị **toàn bộ** `filtered` — component `Table` dùng chung (`src/components/ui/Table.tsx`) không tự phân trang, `page.tsx` cũng không truyền prop `page`/`pageSize` nào | `GetSuppliersQuery.page`/`.limit` **đã khai báo trên type nhưng UI không dùng** — khi nối API thật cần quyết định: thêm UI phân trang (gọi đúng theo `page`/`limit`), hay tạm thời gọi `limit` lớn (kiểu `?limit=200`) để giữ nguyên UX "hiện hết" như hiện tại. Cần Product xác nhận số lượng NCC dự kiến thực tế để chọn hướng (danh sách nhỏ vài chục dòng thì "hiện hết" chấp nhận được, hàng trăm dòng thì bắt buộc phân trang). |

## 3. Bảng chính — ánh xạ từng cột

| Cột UI | Nguồn (mock, `AdminSupplier`) | Theo `Supplier` (`types/supplier.ts`, chưa xác nhận DB — mục 1.3) |
|---|---|---|
| ID (`SUP002`...) | `supplierCode` — chuỗi tự do gõ tay lúc tạo, không tự sinh | `supplierCode` — khớp tên field, nhưng cần Backend xác nhận: client tự đặt mã (như mock hiện tại) hay backend tự sinh mã tuần tự (giống `orders.order_code` chỉ trả sau khi tạo — xem `docs/danhsachdondat_api.md` mục 4)? `AddSupplierModal.tsx` vẫn cho nhập tay `supplierCode` là bắt buộc, nên tạm coi client tự đặt là đúng thiết kế hiện tại — vẫn nên Backend xác nhận có validate trùng mã không. |
| Tên & SĐT đối tác | `supplierName` + `phone` (2 field phẳng) | `supplierName` khớp; `phone` khớp nhưng type khai `phone?: string` (optional) — mock luôn có giá trị, UI hiển thị icon điện thoại không che trường hợp rỗng, cần xử lý hiển thị khi backend trả `null`. |
| Địa chỉ & phân loại | `address` (text tự do) + `serviceType` (text tự do, không có danh mục cố định — cả seed data lẫn form nhập đều là chuỗi tự do, ví dụ "Âm thanh biểu diễn", "Hoa tươi cắm tiệc") | `address?: string` (optional, khớp cách hiển thị), `serviceType: string` (bắt buộc, khớp). Không có bằng chứng nào cho thấy `serviceType` cần ràng buộc theo 1 danh mục enum cố định — giữ nguyên input tự do khi nối API thật, trừ khi Product muốn chuẩn hóa thành danh mục sau này. |
| Dư nợ công nợ (số đỏ nổi bật nhất màn) | `debtBalance: number` — field lưu **trực tiếp** trên `AdminSupplier`, seed cứng lúc khởi tạo | **Không có field `debtBalance`/`totalDebt`/tương đương nào trên interface `Supplier` (`types/supplier.ts`)** — đây là gap quan trọng nhất của toàn màn hình vì đây chính là con số nổi bật nhất trên UI. Xem phân tích riêng ở mục 3.1 bên dưới — không thể chỉ thêm 1 cột đơn giản, cần quyết định kiến trúc (denormalize vs. tính động). |
| Trạng thái | `status: SupplierStatus` (`ACTIVE`/`INACTIVE`) — badge chấm tròn xanh lá/xám | `status: SupplierStatus` — khớp 1:1. |
| Thao tác (Xem / Sửa / Khóa-Mở khóa) | Xem → mở `SupplierDetailModal` (client, không gọi API); Sửa → mở form pre-fill, gọi `updateAdminSupplier`; Khóa/Mở khóa → `toggleAdminSupplierStatus` (đảo `ACTIVE`⇄`INACTIVE`), có `window.confirm` trước khi đổi | Xem chi tiết: nếu không cần gọi API riêng thì dùng thẳng object đã có trong danh sách (mục 4 — `SupplierDetailModal` cần thêm dữ liệu giao dịch/danh mục không có trên `Supplier` cơ bản, xem mục 4.1); Sửa + Khóa/Mở khóa: cùng đi qua `PUT /suppliers/:id` (`UpdateSupplierPayload.status`) — **không có endpoint khóa/mở khóa riêng** (đã ghi rõ trong comment `supplier.service.ts` dòng 17). Cần Backend xác nhận `PUT` có cho phép gửi **chỉ** `{status}` mà không kèm các field khác hay bắt buộc gửi đủ toàn bộ payload update. |

### 3.1. `debtBalance` — field hiển thị nổi bật nhất nhưng không có căn cứ trực tiếp trên `Supplier` — cần Backend/Product quyết định trước khi code

Đối chiếu toàn bộ dữ liệu liên quan tới "công nợ NCC" hiện có trong repo, có **2 cơ chế tính công nợ
khác nhau, không liên kết với nhau**:

1. **`AdminSupplier.debtBalance`** (dùng ở đúng màn này + `SupplierDetailModal`) — 1 con số tĩnh gán
   sẵn lúc seed dữ liệu, **không** được tính lại từ `transactions[]` của chính đối tác đó khi có thay
   đổi (ví dụ gọi `recordSupplierPayment()` tăng `paidAmount` của 1 giao dịch, hay
   `approveSupplierReturnSlip()` duyệt phiếu trả có `compensationAmount` — cả 2 hành động này đều
   **không** cập nhật lại `debtBalance` của đối tác tương ứng). Nếu giữ nguyên cơ chế này khi nối API
   thật, `debtBalance` sẽ là 1 cột lưu cứng trên bảng `suppliers`, dễ lệch dần so với thực tế nếu có
   sai sót ở nơi cập nhật.
2. **`getSupplierTransactionRemainingDebt(t)`** (`db/suppliers.ts` dòng 77-79, dùng ở
   `/manager|admin/suppliers/purchase-orders`, `/admin/reports/debts`) — công thức tính **theo từng
   giao dịch**: `value + compensationAmount - supplierDeduction - paidAmount`. Muốn ra tổng công nợ
   của 1 đối tác theo đúng công thức này phải `SUM()` qua toàn bộ `transactions` của đối tác đó —
   **khác hẳn cách màn danh sách này đang hiển thị** (đọc thẳng 1 field tĩnh).

**Khuyến nghị**: chọn hướng (2) — tính động bằng tổng hợp từ `supplier_transactions` (hoặc bảng tương
đương) mỗi khi trả về danh sách/chi tiết NCC, **không** lưu `debtBalance` như 1 cột riêng dễ lệch dữ
liệu — nhất quán với cách `unpaidSupplierDebt` đã được tính động ở `mockAdapter.ts` dòng 799 (tổng toàn
hệ thống, cùng ý tưởng công thức `estimatedCost - depositAmount` trên `SupplierTransaction`, dù đây là
1 struct mock khác — xem mục 4.2). Cần Backend xác nhận: (a) có nên thêm 1 endpoint/field tính sẵn
`GET /suppliers` trả kèm `debtBalance` đã tổng hợp (denormalized view, tính lại mỗi lần ghi), hay (b)
FE tự gọi thêm `GET /supplier-transactions?supplierId=X` rồi tự cộng dồn ở client (chậm hơn, N+1 query
nếu áp dụng cho cả danh sách nhiều NCC cùng lúc — **không khuyến nghị cho màn danh sách**, chỉ chấp
nhận được cho màn chi tiết 1 đối tác).

## 4. Modal "Hồ sơ chi tiết Đối tác" (`SupplierDetailModal`)

### 4.1. 2 khối dữ liệu con không nằm trên `Supplier` cơ bản — cần API riêng hoặc field `include` mở rộng

| Khối UI | Nguồn (mock) | Theo API thật |
|---|---|---|
| "Lịch sử giao dịch thuê/mua ngoài" (bảng con: Mã yêu cầu / Nội dung / Ngày thực hiện / Giá trị / Trạng thái) | `AdminSupplier.transactions: SupplierTransactionSummary[]` — mảng lồng sẵn trong chính object Supplier (mock) | Gần khớp nhất với `SupplierTransaction` (`types/procurement.ts`) qua `GET /api/v1/supplier-transactions?supplierId=X` (`procurementApiService.getTransactions({supplierId})`, **đã có sẵn**) — nhưng đây là **1 API riêng, tách khỏi `GET /suppliers/:id`**, không phải mảng lồng sẵn như mock. Field hiển thị cũng lệch tên: `requestCode`→`transactionCode`, `title`→`serviceTitle`, `value`→`estimatedCost`, `status` (`NEW/RECEIVED/CANCELLED`, mock) → `status` (`PENDING/APPROVED/IN_PROGRESS/COMPLETED/CANCELLED`, thật — **enum khác hẳn, không map 1:1 được**, cần Product xác nhận nhãn hiển thị lại theo đúng 5 giá trị thật). |
| "Danh mục hạng mục & giá thiết bị cung cấp" (`catalogItems[]`: mã/tên/giá/đơn vị) | `AdminSupplier.catalogItems: SupplierCatalogItem[]` — mảng lồng sẵn trong mock | **Không tìm thấy entity/endpoint tương ứng nào** trong `types/`/`services/` hiện tại — không có khái niệm "bảng giá catalog theo từng NCC" ở đâu khác trong repo (khác `/admin/catalog/supplier-services` — trang đó là danh mục **dịch vụ** catalog nội bộ, không phải giá NCC báo). Đây là field **hoàn toàn chưa có chỗ chứa ở backend** — cần Product xác nhận có thật sự cần lưu bảng giá riêng theo NCC hay đây chỉ là dữ liệu trang trí cho đẹp mock; nếu cần giữ, phải đề xuất bảng mới (ví dụ `supplier_catalog_items(supplier_id, item_name, price, unit)`) trước khi Backend làm. |

### 4.2. Lưu ý enum `status` giao dịch: mock có 2 bộ giá trị khác nhau cho cùng khái niệm, không bộ nào chắc chắn khớp DB thật

`SupplierTransactionSummary.status` (dùng ở `db/suppliers.ts`, hiển thị trên chính modal này) dùng
`'NEW' | 'RECEIVED' | 'CANCELLED'`, trong khi `SupplierTransaction.status` (dùng ở
`types/procurement.ts`/`procurementApiService`, tức API thật `GET /supplier-transactions`) dùng
`'PENDING' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'` — **2 tập giá trị khác nhau cho
cùng 1 khái niệm "trạng thái giao dịch NCC"**, không có ánh xạ rõ ràng giữa 2 bên (`NEW`→`PENDING`?
`RECEIVED`→`COMPLETED` hay `IN_PROGRESS`?). Vì tài liệu `docs/thuhoi_hoankho_api.md` mục 6 đã ghi nhận
**chưa xác nhận lại được schema `supplier_transactions` thật** (do timeout DB ở phiên đó), và phiên này
cũng không kết nối được DB (đầu file) — **chưa có cách nào chốt bộ enum nào đúng** chỉ bằng đối chiếu
code. Cần chạy `SHOW CREATE TABLE supplier_transactions` ở phiên sau để lấy đúng enum thật trước khi
Backend/FE thống nhất 1 bộ giá trị duy nhất cho toàn bộ các màn liên quan (danh sách này, purchase-orders,
reports/debts).

## 5. Modal "Thêm đối tác mới" / "Chỉnh sửa đối tác" — ánh xạ sang `POST`/`PUT /api/v1/suppliers`

| Trường UI (form inline trong `page.tsx`) | Theo `CreateSupplierPayload`/`UpdateSupplierPayload` thật |
|---|---|
| Mã đối tác * (khóa không sửa được khi edit) | `supplierCode` — khớp, chỉ có ở `CreateSupplierPayload` (không có trong `UpdateSupplierPayload` — đúng, vì form cũng khóa field này khi sửa). |
| Tên nhà cung cấp * | `supplierName` — khớp. |
| Số điện thoại | `phone` — khớp, optional cả 2 payload. |
| Phân loại * | `serviceType` — khớp, bắt buộc ở cả 2. |
| Địa chỉ | `address` — khớp, optional cả 2. |
| *(form inline hiện tại KHÔNG có trường này)* | **`contactPerson`** — có trên cả `Supplier`/`CreateSupplierPayload`/`UpdateSupplierPayload`, và `AddSupplierModal.tsx` (component mồ côi, mục 1.3) đã có sẵn UI thu thập field này ("Người liên hệ") — 2 form inline đang dùng thật ở `manager/suppliers/page.tsx`/`admin/suppliers/page.tsx` **thiếu hẳn trường này**, nên bổ sung khi sửa lại form thay vì bỏ qua. |
| *(không có trên form nào)* | `rating?: number` — khai báo trên type nhưng không có UI nào (form lẫn danh sách lẫn modal chi tiết) thu thập hay hiển thị giá trị này. Cần Product xác nhận có cần thiết kế UI đánh giá NCC hay bỏ hẳn field này khỏi phạm vi trước mắt. |
| *(không có trên form nào)* | `notes?: string` — tương tự `rating`, khai báo trên type nhưng chưa có UI nào dùng. |
| *(không gửi, đúng)* | `email` — `AddSupplierModal.tsx` đã xác nhận `createSupplierSchema` thật **không** nhận field này dù model có cột `email` (mục 1.3) — 2 form inline hiện tại **không có input email** nên đã đúng ở điểm này, chỉ cần đảm bảo không vô tình thêm lại khi viết lại form theo `AddSupplierModal.tsx`. |

Khóa/Mở khóa đối tác: gọi `PUT /api/v1/suppliers/:id` với `{ status: 'ACTIVE' | 'INACTIVE' }` (không có
endpoint riêng — mục 3, cột Thao tác).

## 6. Tổng hợp endpoint cần cho màn này

### 6.0. Xác nhận trực tiếp trên backend thật (`localhost:3001`, curl — 2026-07-20): **cả 4 endpoint dưới đây đều 404, chưa tồn tại**

| Endpoint | Kết quả curl thật |
|---|---|
| `GET /api/v1/suppliers` | `404 {"code":"NOT_FOUND","message":"Route not found: GET /api/v1/suppliers"}` |
| `POST /api/v1/suppliers` | `404 {"code":"NOT_FOUND","message":"Route not found: POST /api/v1/suppliers"}` |
| `GET /api/v1/suppliers/:id` | `404 {"code":"NOT_FOUND","message":"Route not found: GET /api/v1/suppliers/sup-1"}` |
| `GET /api/v1/supplier-transactions` | `404 {"code":"NOT_FOUND","message":"Route not found: GET /api/v1/supplier-transactions"}` |

Đối chứng: `GET /api/v1/orders`/`GET /api/v1/customers` (route đã biết tồn tại) trả **401
UNAUTHORIZED** chứ không phải 404 — router bắt path trước middleware auth, nên 404 ở đây chắc chắn
nghĩa là **route chưa được mount**, không phải do thiếu token. Danh sách endpoint bên dưới vì vậy là
**đề xuất cần Backend implement từ đầu**, không phải "đã có, chỉ cần xác nhận thêm" như các tài liệu
API trước — mức độ ưu tiên/độ chắc chắn khác hẳn.

- `GET /api/v1/suppliers` (`?page&limit&search&status`) — **chưa tồn tại trên server thật (mục 6.0)**,
  `mockAdapter.ts` cũng chưa có route này để FE tự kiểm thử (mục 1.2). Cần làm rõ phạm vi cột mà
  `search` quét qua (mục 2).
- `POST /api/v1/suppliers` — **chưa tồn tại trên server thật (mục 6.0)**, chỉ có mock route tối thiểu;
  payload thật nên theo đúng field đã xác nhận ở `AddSupplierModal.tsx` (mục 5), không theo 2 form
  inline hiện tại (thiếu `contactPerson`).
- `PUT /api/v1/suppliers/:id` — dùng chung cho Sửa **và** Khóa/Mở khóa (`UpdateSupplierPayload.status`)
  — chưa test được vì `GET`/`POST` cùng nhóm đã 404 (mục 6.0); cần Backend xác nhận có cho phép gửi
  partial body (chỉ `{status}`) hay bắt buộc full payload khi endpoint này được implement.
- `GET /api/v1/supplier-transactions?supplierId=X` — dùng cho khối "Lịch sử giao dịch" trong modal chi
  tiết (mục 4.1) — **cũng 404 trên server thật (mục 6.0)** dù đã có khai báo đầy đủ ở
  `procurementApiService.getTransactions`; enum `status` cũng cần đối chiếu lại DB thật trước khi hiển
  thị đúng nhãn (mục 4.2).

Cần Backend/Product xác nhận thêm (chưa có endpoint/field nào tương ứng hiện tại):

- **Công thức trả về `debtBalance`** cho mỗi NCC trong `GET /suppliers` — tính động hay denormalize
  (mục 3.1), đây là quyết định quan trọng nhất của toàn tài liệu vì ảnh hưởng trực tiếp tới độ chính
  xác con số tài chính hiển thị nổi bật nhất trên màn.
- **Bảng giá catalog theo từng NCC** (`catalogItems[]`, mục 4.1) — hiện không có chỗ chứa nào ở
  backend, cần quyết định có giữ tính năng này hay bỏ khỏi modal chi tiết.
- **Thống nhất lại 1 bộ enum `status` giao dịch NCC** dùng chung cho mọi màn (mục 4.2) — cần
  `SHOW CREATE TABLE supplier_transactions` thật để chốt.
- Xác nhận `supplierCode` do client tự đặt hay backend tự sinh (mục 3, cột ID).

## 7. Tổng hợp việc cần sửa ở FE khi nối API thật

- Đổi 2 trang danh sách (`manager/suppliers/page.tsx`, `admin/suppliers/page.tsx`) sang gọi
  `supplierApiService.getSuppliers(params)`/`.createSupplier()`/`.updateSupplier()` qua service layer
  thay vì đọc thẳng `@/mocks/db/suppliers`, chuyển lọc `search`/`status` từ client sang query param
  (mục 1.1, 2).
- Bổ sung route `GET /suppliers` (có lọc `search`/`status`/phân trang) vào `mockAdapter.ts` để test
  được ngay trong giai đoạn mock, song song với yêu cầu Backend triển khai thật (mục 1.2).
- Viết lại form Thêm/Sửa đối tác dựa theo `AddSupplierModal.tsx` (đã đúng service layer, đã có
  `contactPerson`, đã loại `email`) thay vì 2 form inline hiện tại — sau đó xóa `AddSupplierModal.tsx`
  nếu không dùng nữa, hoặc dùng thẳng nó thay cho form inline để tránh trùng lặp code (mục 1.3, 5).
- Quyết định cách lấy `debtBalance` (tính động qua tổng hợp `supplier_transactions` — khuyến nghị —
  hay nhận thẳng từ response `GET /suppliers` nếu Backend làm denormalized view) trước khi nối cột
  "Dư nợ công nợ" (mục 3.1).
- Quyết định số phận `catalogItems[]`, `rating`, `notes` (đều chưa có nơi dùng/chứa rõ ràng ở backend)
  trước khi giữ nguyên trên modal chi tiết/form (mục 4.1, 5).
- Đối chiếu lại enum `status` giao dịch NCC với DB thật, thống nhất 1 bộ giá trị cho `SupplierDetailModal`
  + `purchase-orders` + `reports/debts` (mục 4.2).
- Cân nhắc thêm UI phân trang nếu số NCC thực tế lớn (mục 2).
