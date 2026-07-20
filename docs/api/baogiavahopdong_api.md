# API cho tab "Báo giá & Hợp đồng" (trang chi tiết đơn đặt)

> Phạm vi tài liệu này: **chỉ** tab `quotation` ("Báo giá & Hợp đồng") của trang chi tiết 1 đơn đặt — khối
> "Hồ sơ báo giá & hợp đồng liên kết" (mã báo giá, phiên bản, badge "Đã duyệt", giá trị giao kèo, dòng
> "Hợp đồng liên kết", 3 nút "Xem báo giá"/"Xem hợp đồng" hoặc "Tạo hợp đồng"/"Hủy liên kết") và khối phụ
> "Liên kết báo giá đã duyệt" (dropdown + nút "Liên kết ngay", chỉ hiện khi đơn chưa có báo giá liên kết)
> — đúng như ảnh mẫu cung cấp. Trang dùng chung layout ở cả `/manager/orders/[id]` và
> `/admin/orders_audit/[id]` (mirror 1:1, chỉ khác tiền tố route — đã đối chiếu, JSX + toàn bộ
> state/handler của tab này giống hệt nhau giữa 2 file).
>
> **Không** bao gồm 5 tab còn lại của cùng trang (đã có tài liệu riêng: "Tổng quan sự kiện" ở
> [`docs/tongquansukien_api.md`](tongquansukien_api.md), "Tiến độ sự kiện" ở
> [`docs/tiendosukien_api.md`](tiendosukien_api.md), "Thiết bị & Kho hàng" ở
> [`docs/thietbikhohang_api.md`](thietbikhohang_api.md), "Lịch trình & Kỹ thuật" ở
> [`docs/lichtrinhkythuat_api.md`](lichtrinhkythuat_api.md)). Cũng **không** bao gồm trang chi tiết báo giá
> (`/manager/quotations/[id]`, đã có [`docs/xemchitietbaogia_api.md`](xemchitietbaogia_api.md)) hay màn
> danh sách "Hợp đồng" (`/admin/contracts`, đã có [`docs/danhsachhopdong_api.md`](danhsachhopdong_api.md))
> mà nút "Xem báo giá"/"Xem hợp đồng" điều hướng tới.
>
> **Phát hiện quan trọng nhất tài liệu này**: tab này đang dùng **nguyên mô hình "Hợp đồng" đã bị bác bỏ**
> — `docs/danhsachhopdong_api.md` mục 1 đã chốt **Hướng A** (bỏ hẳn entity "Hợp đồng" riêng, vì không có
> bảng `contracts` nào trong DB thật) và tại đúng phiên làm việc hôm nay, refactor theo Hướng A đó **đang
> được thực hiện dở dang** ở `src/app/admin/contracts/page.tsx`/`src/mocks/db/orders.ts` (đã xóa
> `src/components/contracts/ContractCreateModal.tsx`, thêm `src/components/orders/CreateOrderPickQuotationModal.tsx`
> — xem `git status`/`git diff` tại thời điểm viết tài liệu này). Tab "Báo giá & Hợp đồng" (đối tượng của
> tài liệu này) là **nơi duy nhất còn sót lại** vẫn gọi `getAdminContracts()` từ
> `src/mocks/adminContractsMock.ts` (module đã bị loại khỏi luồng chính ở `/admin/contracts` nhưng file vẫn
> còn tồn tại) — cần đồng bộ nốt theo cùng hướng đã chốt, xem mục 1 và 5.
>
> Nguồn tham chiếu:
> - FE: `src/app/manager/orders/[id]/page.tsx` (dòng 66-67 import `getAdminQuotationById`/
>   `getAdminContracts`, dòng 279 state `linkQuoteId`, dòng 365-370 `handleLinkQuotation`, dòng 414-418
>   `handleUnlinkQuotation`, dòng 438-440 `linkedQuotation`/`linkedContract`/`linkableQuotations`, dòng
>   1255-1371 JSX tab `quotation`), `src/app/admin/orders_audit/[id]/page.tsx` (bản mirror, cùng nội dung ở
>   dòng 294-301 và 1017-1093), `src/mocks/db/orders.ts` (`AdminOrderRow.quotationId` dòng 126,
>   `getLinkableQuotationsForOrder`/`linkQuotationToOrder`/`unlinkQuotationFromOrder` dòng 421-455),
>   `src/mocks/db/quotations.ts` (`AdminQuotationRow`, `getAdminQuotationById`), `src/mocks/adminContractsMock.ts`
>   (`AdminContract`, `getAdminContracts` — xem cảnh báo ở trên), `src/types/order.ts`, `src/types/quotation.ts`,
>   `src/services/order.service.ts`, `src/services/quotation.service.ts`.
> - DB thật: đối chiếu trực tiếp qua MySQL MCP ngày 2026-07-20 (cùng phiên với các tài liệu tab khác) —
>   `SHOW TABLES` (24 bảng, **không có bảng `contracts`** — xác nhận lại đúng phát hiện đã có ở
>   `docs/danhsachhopdong_api.md`), `SHOW CREATE TABLE orders`, `SHOW CREATE TABLE quotations`; dữ liệu mẫu
>   thật: 1 order (`order_code = "ORD-001"`, `quotation_id` trỏ đúng) ↔ 1 quotation (`quotation_code =
>   "QUO-001"`, `version = "v1"`, `status = "APPROVED"`, `total_amount = 1,600,000` — **khớp chính xác**
>   `orders.total_amount` của đơn đó, xem mục 3 về ý nghĩa 2 field này có thật sự luôn bằng nhau không).
> - `docs/api/` **không tồn tại trong repo hiện tại** — dùng comment đầu `src/types/order.ts`/`quotation.ts`
>   (đối chiếu trực tiếp `prisma/schema.prisma`/`*.route.ts`/`*.service.ts` của backend ngày 2026-07-06) làm
>   căn cứ chính, giống các tài liệu trước.

## 0. Base URL & Auth

- Base path: `/api/v1`, JWT Bearer theo `AuthContext` hiện có.
- Theo CLAUDE.md mục 1, đây là dữ liệu Manager tạo/quản lý (liên kết báo giá vào đơn là 1 bước trong vòng
  đời Order do Manager vận hành) — bản Admin (`/admin/orders_audit/[id]`) nên là **read-only** cho tab này
  (chỉ hiện nút "Xem báo giá", ẩn hẳn "Hủy liên kết"/khối "Liên kết báo giá đã duyệt"), giống khuyến nghị đã
  lặp lại ở các tài liệu tab khác của cùng trang.

## 1. "Hợp đồng" — bỏ hẳn; "Liên kết/Hủy liên kết" — giữ lại, kèm điều kiện nghiệp vụ mới, chưa có API thật

### 1.1. "Hợp đồng liên kết" — đã bác bỏ ở `docs/danhsachhopdong_api.md`, không lặp lại phân tích

Dòng "Hợp đồng liên kết: `HD2507-001`" + nút "Xem hợp đồng"/"Tạo hợp đồng" (trỏ `/admin/contracts/:id`)
dùng `getAdminContracts().find((c) => c.quotationId === row.quotationId)` — **chính là** vấn đề đã phân
tích đầy đủ ở `docs/danhsachhopdong_api.md` mục 1: không có bảng `contracts` thật, dữ liệu "Hợp đồng" chỉ
là 1 mock store độc lập (`adminContractsMock.ts`) tự sinh lại thông tin đã có ở Quotation/Order, và **xung
đột trực tiếp** với luồng Order thật (`orders.quotation_id` đã là đúng cơ chế "báo giá đã duyệt → hồ sơ vận
hành chính thức"). Theo Hướng A đã chọn (khuyến nghị mạnh, đang được thực thi ở `/admin/contracts`): áp
dụng y hệt ở đây — **xóa hẳn** dòng "Hợp đồng liên kết" và 2 nút "Xem hợp đồng"/"Tạo hợp đồng" khỏi tab
này, vì khi `order.quotationId` đã khác `null`, bản thân **đơn đang xem chính là "hợp đồng"** — không có gì
khác để "xem" hay "tạo" thêm.

### 1.2. "Liên kết"/"Hủy liên kết" — ghi vào 1 field chỉ set được 1 lần lúc tạo đơn, **đã chốt giữ, kèm điều kiện nghiệp vụ mới**

Đối chiếu `src/types/order.ts` và `src/services/order.service.ts` (đã tài liệu hóa đầy đủ ở
`docs/danhsachhopdong_api.md` mục 3.2, nhắc lại ở đây vì trực tiếp ảnh hưởng tab này):

- `quotationId` **chỉ xuất hiện ở `CreateOrderPayload`** (`POST /api/v1/orders`, field optional) — set 1
  lần duy nhất lúc tạo đơn.
- `orderApiService` chỉ có đúng **5 method**: `getOrders`, `getOrder`, `createOrder`, `updateOrderStatus`
  (`PUT /orders/:id/status`), `updateOrderItems` (`PUT /orders/:id/items`). **Không có** `PUT`/`PATCH
  /orders/:id` (update chung) hay bất kỳ endpoint nào cho phép sửa `quotation_id` của 1 đơn **đã tồn tại**.
- Cột `orders.quotation_id` (`SHOW CREATE TABLE orders` xác nhận) là FK nullable, `ON DELETE SET NULL`
  — nghĩa là hệ thống chỉ tự **gỡ** liên kết khi quotation bị xóa (hành động của Backend/DB), chưa có sẵn cơ
  chế để **client** tự ý gỡ/đổi liên kết qua API.

**Kết luận (2026-07-20, đã trao đổi với Product): ĐÃ CHỐT giữ tính năng, kèm 1 điều kiện nghiệp vụ mới** —
`handleLinkQuotation`/`linkQuotationToOrder` (gán `quotationId` cho 1 đơn đã tồn tại, `orders.ts` dòng
426-447) và `handleUnlinkQuotation`/`unlinkQuotationFromOrder` (gán lại `undefined`, dòng 450-451) hiện
**không có API thật tương ứng** (mục kỹ thuật ở trên vẫn đúng — cần Backend bổ sung endpoint mới, mục 2),
nhưng Product đã xác nhận **giữ** tính năng vì đúng nhu cầu thật (Manager chọn nhầm báo giá lúc tạo đơn, cần
sửa lại mà không muốn hủy hẳn đơn), kèm điều kiện: **"Manager chỉ được hủy liên kết báo giá nếu có trên 1
báo giá"**.

**Diễn giải điều kiện trên (cần Backend xác nhận lại cách hiểu vì `orders.quotation_id` là FK đơn — 1 đơn
chỉ trỏ tới đúng 1 quotation tại 1 thời điểm, không có khái niệm "đơn có nhiều hơn 1 báo giá" theo đúng
nghĩa đen của schema hiện tại)**: cách hiểu hợp lý nhất là đếm theo **khách hàng của đơn**, không phải theo
đơn — nút "Hủy liên kết" chỉ **hiện/kích hoạt** khi khách hàng (`order.customerId`) có **nhiều hơn 1 báo
giá trạng thái `APPROVED`** (đếm bằng `GET /api/v1/customers/:customerId/quotations` đã có sẵn, lọc
`status === 'APPROVED'`, đếm `length > 1` — báo giá đang liên kết với đơn hiện tại tính là 1 trong số đó).
Lý do nghiệp vụ: tránh Manager hủy liên kết rồi đơn "mồ côi" hoàn toàn không còn báo giá nào khác của cùng
khách hàng để liên kết lại — chỉ cho phép hủy khi còn ít nhất 1 báo giá đã duyệt khác làm phương án thay
thế. **Cách hiểu này là suy luận của tài liệu, chưa phải câu trả lời nguyên văn từ Product** — cần xác nhận
lại đúng ý trước khi Backend code (mục 5.2).

## 2. Endpoint thật cần cho tab này — 3 endpoint (2 đã có sẵn, 1 đề xuất mới — nghiệp vụ đã chốt, shape endpoint chưa chốt)

| # | Endpoint | Dùng cho | Ghi chú |
|---|---|---|---|
| 1 | `GET /api/v1/orders/:orderId` | Lấy `quotationId`/`customerId` của đơn (để biết đơn có báo giá liên kết hay không, và biết khách hàng nào để đếm báo giá ở #4) | **Đã có sẵn** (`orderApiService.getOrder`) — tab "Tổng quan sự kiện" đã gọi endpoint này khi mở trang (`docs/tongquansukien_api.md` mục 2), tái dùng lại response đã fetch, **không gọi lại riêng** cho tab này. |
| 2 | `GET /api/v1/quotations/:quotationId` | Toàn bộ nội dung card khi `order.quotationId` khác `null` (mã, phiên bản, tổng tiền, trạng thái) | **Đã có sẵn** (`quotationApiService.getQuotation`), dùng `quotationId` lấy từ bước 1. |
| 3 | `GET /api/v1/customers/:customerId/quotations` | Đếm số báo giá `APPROVED` của khách hàng — điều kiện bật/tắt nút "Hủy liên kết" (mục 1.2: chỉ cho phép khi > 1) | **Đã có sẵn** (`quotationApiService.getCustomerQuotations`) — không cần endpoint đếm riêng, FE tự lọc `status === 'APPROVED'` rồi đếm `length` từ response. |
| 4 | `PATCH /api/v1/orders/:orderId/quotation` `{ "quotationId": string \| null }` | Nút "Hủy liên kết" (gửi `null`) và khối "Liên kết báo giá đã duyệt" (gửi `quotationId` đã chọn) | **Đề xuất mới — nghiệp vụ đã chốt giữ (mục 1.2), nhưng shape endpoint CHƯA CHỐT**. Hiện **chưa có** trong `order.service.ts`. Chỉ là gợi ý shape ban đầu (đặt tên/method minh họa theo đúng convention các endpoint khác của Order), cần Backend xác nhận trước khi implement — xem mục 1.2 và mục 5.2. Ràng buộc tối thiểu nếu triển khai: (a) chỉ nhận `quotationId` của báo giá `status = APPROVED` và chưa được đơn nào khác trỏ tới (cùng điều kiện lọc `getLinkableQuotationsForOrder` phía FE hiện đang tự làm); (b) khi gửi `null` (hủy liên kết), Backend nên tự kiểm tra lại điều kiện "> 1 báo giá `APPROVED` của khách hàng" ở phía server (không chỉ tin điều kiện disable nút ở FE) để tránh bị bypass qua gọi API trực tiếp. |

Endpoint #4 là suy đoán minh họa, không phải đặc tả đã chốt — Backend có thể chọn shape khác (vd gộp vào
`PUT /orders/:id` update chung thay vì 1 sub-resource riêng); phần này cần chốt lại cùng Backend trước khi
code. Không cần endpoint `GET /api/v1/orders?quotationId=` (lọc báo giá "chưa liên kết" — dùng
`getLinkableQuotationsForOrder` hiện có phía FE, xem mục 4) hay bất kỳ endpoint "hợp đồng" nào khác.

## 3. Ánh xạ field hiển thị (đã bỏ phần "Hợp đồng liên kết" theo mục 1.1, giữ phần "Liên kết/Hủy liên kết" kèm điều kiện mới theo mục 1.2)

| Trường UI | Nguồn mock hiện tại | Nguồn thật | Ghi chú |
|---|---|---|---|
| Mã báo giá (`BG001`) | `linkedQuotation.code` | `quotation.quotationCode` | Đổi định dạng hiển thị — dữ liệu mẫu thật là `"QUO-001"`, không phải prefix `BG` (cùng vấn đề định dạng mã đã nêu ở `docs/danhsachbaogia_api.md`). |
| Phiên bản (`v{version}`) | `linkedQuotation.version` (kiểu `number`, mock sinh `1 + index % 3`) | `quotation.version` (kiểu **chuỗi tự do**, `varchar(30)`, mẫu thật `"v1"`) | **Không tự thêm tiền tố `v` phía trước** như UI hiện tại (`Phiên bản v{version}` sẽ ra `"Phiên bản vv1"` nếu backend đã trả sẵn `"v1"`) — hiển thị thẳng `quotation.version`, chỉ thêm nhãn "Phiên bản " phía trước. |
| Badge "Đã duyệt" | Hardcode cứng `<Badge variant="success">Đã duyệt</Badge>`, không đọc field nào | `quotation.status` (`DRAFT`/`APPROVED`/`REJECTED`) | Đổi thành đọc động theo `status` thay vì hardcode — dù theo nghiệp vụ tạo Order (`docs/danhsachhopdong_api.md` mục 3.2) đơn chỉ nên được tạo từ báo giá `APPROVED`, đây là **ràng buộc nghiệp vụ ở tầng tạo đơn**, không phải ràng buộc cứng ở DB (không có `CHECK` constraint nào ép `quotations.status` phải giữ `APPROVED` mãi mãi sau khi đơn đã trỏ tới nó) — an toàn hơn nếu badge tự đọc `status` thật thay vì giả định luôn là "Đã duyệt". |
| "Giá trị giao kèo" | `linkedQuotation.totalAmount` | `quotation.totalAmount` — **đã chốt** | Xem giải thích ngay dưới bảng. |
| "Hợp đồng liên kết: `HD2507-001`" + nút "Xem hợp đồng"/"Tạo hợp đồng" | `getAdminContracts().find(...)` | **Xóa khỏi UI** | Theo mục 1.1 — không có entity "Hợp đồng" tách biệt. |
| Nút "Xem báo giá" | `Link href="/manager/quotations/{quotationId}"` | Giữ nguyên | Trang đích đã có tài liệu ở `docs/xemchitietbaogia_api.md`, không đổi gì ở đây. |
| Nút "Hủy liên kết" | `handleUnlinkQuotation` → `unlinkQuotationFromOrder`, luôn hiện khi có `linkedQuotation` | **Giữ nguyên, ĐÃ CHỐT — nhưng thêm điều kiện kích hoạt mới** | Theo mục 1.2 — Product đã chốt giữ tính năng, kèm điều kiện "chỉ hủy liên kết được nếu có trên 1 báo giá" (diễn giải: khách hàng của đơn có > 1 báo giá `APPROVED`, đếm qua endpoint #3 mục 2). Nút cần đổi từ "luôn hiện" sang **disable + tooltip giải thích** (vd "Khách hàng chỉ có 1 báo giá đã duyệt, không thể hủy liên kết") khi điều kiện không thỏa. Khi bấm (điều kiện thỏa), gọi endpoint đề xuất #4 ở mục 2 — hiện chưa có, tạm thời vẫn dùng hành vi mock `unlinkQuotationFromOrder` cho tới khi Backend xác nhận. |
| Số báo giá `APPROVED` của khách hàng (dữ liệu ngầm, chưa có UI hiển thị) | Không có ở mock | `GET /customers/:customerId/quotations`, lọc `status === 'APPROVED'`, đếm `length` | **Field mới cần thêm** — chỉ dùng để tính điều kiện enable/disable nút "Hủy liên kết" (mục 1.2), không nhất thiết phải hiển thị số này trực tiếp trên UI, nhưng nên hiện trong tooltip/thông báo khi nút bị disable để Manager hiểu lý do. |
| Khối "Liên kết báo giá đã duyệt" (khi `!linkedQuotation`) | `linkableQuotations` + `handleLinkQuotation` | **Giữ nguyên, ĐÃ CHỐT** | Không bị ảnh hưởng bởi điều kiện "> 1 báo giá" (điều kiện đó chỉ áp cho **hủy** liên kết của 1 đơn **đang có** báo giá, không áp cho việc **liên kết lần đầu** khi đơn chưa có báo giá nào) — dùng lại endpoint đề xuất #4 ở mục 2 khi có; `linkableQuotations`/`getLinkableQuotationsForOrder` phía FE vẫn giữ nguyên logic lọc hiện có (báo giá `APPROVED` và chưa gắn đơn nào khác). |

**"Giá trị giao kèo" — đã chốt cùng Product (2026-07-20): dùng `quotation.totalAmount`** (giá trị chốt tại
thời điểm duyệt báo giá), **không** dùng `order.totalAmount`. Lý do cần ghi rõ vì đây là 2 cột độc lập hoàn
toàn trong schema thật (không có generated/computed column nào đồng bộ 2 bên) — comment tại `types/order.ts`
dòng 80-81 ghi rõ "Không tự copy items từ Quotation... phải nhập lại thủ công dù đã chọn quotationId", và
CLAUDE.md mục 1 (quy tắc "Thêm/bớt/Thay thiết bị tại hiện trường") mô tả `orders.total_amount` có thể **thay
đổi sau khi đơn đã tạo** (qua Change Request), trong khi `quotations.total_amount` giữ nguyên giá trị đã
chốt lúc duyệt — đúng ý nghĩa "giao kèo ban đầu" mà nhãn UI đang thể hiện. Dữ liệu mẫu thật hiện 2 giá
trị này trùng khớp (`1,600,000` cả 2 bên) chỉ vì đơn `ORD-001` chưa qua Change Request nào — không ảnh hưởng
tới quyết định đã chốt ở trên, chỉ là trùng hợp của dữ liệu mẫu hiện tại.

## 4. Tổng hợp việc cần sửa ở FE khi nối API thật

1. Bỏ import `getAdminContracts` (`@/mocks/adminContractsMock`) khỏi cả 2 file trang chi tiết đơn — đồng bộ
   nốt theo Hướng A đang thực thi dở dang ở `/admin/contracts` (mục đầu tài liệu này). Sau khi tab này
   không còn dùng, rà soát lại xem `src/mocks/adminContractsMock.ts`/`src/app/admin/contracts/[id]` (trang
   chi tiết hợp đồng, nếu còn tồn tại) có còn nơi nào tham chiếu không — nếu không, xóa hẳn file mock đó.
2. Xóa `linkedContract`, dòng "Hợp đồng liên kết", nút "Xem hợp đồng"/"Tạo hợp đồng" (mục 1.1, 3) — phần
   này **đã chốt** bỏ hẳn (Hướng A).
3. **Giữ nguyên** `linkQuoteId`, `linkableQuotations`/`getLinkableQuotationsForOrder`, nút "Hủy liên kết",
   và khối "Liên kết báo giá đã duyệt" — **đã chốt giữ** (mục 1.2, 3, 5.2), nhưng cần thêm 2 việc mới:
   - Thêm state đếm số báo giá `APPROVED` của khách hàng (gọi `quotationApiService.getCustomerQuotations`,
     endpoint #3 mục 2) để tính điều kiện enable/disable nút "Hủy liên kết" (> 1 mới cho hủy).
   - Đổi `disabled`/tooltip của nút "Hủy liên kết" theo điều kiện trên; khi Backend xác nhận endpoint đề
     xuất #4 (mục 2), đổi `handleUnlinkQuotation`/`handleLinkQuotation` từ gọi thẳng
     `unlinkQuotationFromOrder`/`linkQuotationToOrder` (mock) sang gọi `PATCH /orders/:id/quotation` thật
     (Backend cũng nên tự kiểm tra lại điều kiện "> 1 báo giá" ở server, không chỉ tin điều kiện disable ở
     FE — mục 2 điểm (b)).
4. Card báo giá: khi `order.quotationId` khác `null` → gọi `GET /api/v1/quotations/:quotationId` hiển thị
   mã/phiên bản/"Giá trị giao kèo" (= `quotation.totalAmount`, đã chốt mục 3)/badge trạng thái động; khi
   `null` → hiện khối rỗng + khối "Liên kết báo giá đã duyệt" như mục 3 (thay vì xóa hẳn, theo mục 1.2).
5. Gọi API qua đúng lớp `services/*.service.ts` đã có (`orderApiService.getOrder`,
   `quotationApiService.getQuotation`) theo CLAUDE.md mục 4, không tạo lời gọi `axios`/`fetch` mới trong
   component. Khi endpoint #3 (mục 2) được Backend xác nhận, bổ sung method mới vào `orderApiService`
   (vd `updateOrderQuotation`) thay vì gọi `axios`/`fetch` trực tiếp trong component.

## 5. Đã chốt / còn cần Backend xác nhận

### 5.1. Đã chốt (2026-07-20)

1. **"Giá trị giao kèo" đọc `quotation.totalAmount`** (giá trị chốt tại thời điểm duyệt báo giá), **không**
   dùng `order.totalAmount` (giá trị sống, có thể đổi theo Change Request) — xem giải thích đầy đủ ở mục 3.
   Backend/FE có thể code thẳng theo quyết định này, không cần chờ xác nhận thêm cho riêng field này.
2. **Giữ tính năng "Hủy liên kết"/"Liên kết báo giá"** (không xóa khỏi UI như đề xuất ở bản nháp trước) —
   Product xác nhận đây là nhu cầu nghiệp vụ thật. Kèm điều kiện: **"Manager chỉ được hủy liên kết báo giá
   nếu có trên 1 báo giá"** — tài liệu này diễn giải là **khách hàng của đơn có > 1 báo giá `APPROVED`**
   (mục 1.2, do `orders.quotation_id` là FK đơn, không có khái niệm "1 đơn có nhiều báo giá" theo đúng nghĩa
   đen schema hiện tại). **Cách diễn giải này cần Backend xác nhận lại đúng ý Product** trước khi code điều
   kiện enable/disable nút — xem mục 5.2 điểm 1.

### 5.2. Còn cần Backend xác nhận — CHƯA CHỐT (chỉ còn chi tiết triển khai, không còn là câu hỏi "giữ hay bỏ")

1. **Xác nhận lại cách diễn giải điều kiện "trên 1 báo giá"** ở mục 5.1 điểm 2 có đúng ý Product không —
   nếu không phải "khách hàng có > 1 báo giá APPROVED", cần Product mô tả lại chính xác điều kiện (vd có thể
   là so với lịch sử các báo giá **đã từng** liên kết với chính đơn này qua thời gian, nếu sau này có thiết
   kế audit log riêng — hiện chưa có cơ chế lưu lịch sử đổi `quotation_id` nào cả).
2. **Shape endpoint ghi** (`PATCH /api/v1/orders/:orderId/quotation`, mục 2 #4) — chỉ là gợi ý minh họa,
   Backend có thể chọn cách khác (vd gộp vào `PUT /orders/:id`, hoặc tách 2 endpoint riêng cho "liên kết" và
   "hủy liên kết" thay vì 1 endpoint dùng chung nhận `quotationId: string | null`).
3. **Có cần ghi log lịch sử đổi `quotation_id`** (phục vụ audit — vì đây là 1 field vốn được thiết kế bất
   biến sau khi tạo đơn, mục 1.2) hay chỉ cần ghi đè trực tiếp không lưu vết? Không tự chọn hướng này vì ảnh
   hưởng thiết kế schema (có thể cần thêm bảng lịch sử mới), cần Backend/Product quyết định.
