# API cho modal "Tạo báo giá mới" (`CreateQuotationWizardModal`)

> Phạm vi tài liệu này: **chỉ** modal 3 bước "Tạo báo giá mới" (Bước 1: Chọn khách hàng → Bước 2: Danh
> sách hạng mục → Bước 3: Tổng kết & Lưu) mở từ `/manager/quotations` và `/admin/quotations`. **Không**
> bao gồm trang chi tiết báo giá (`[id]/page.tsx`), màn danh sách báo giá (đã có
> [`docs/danhsachbaogia_api.md`](danhsachbaogia_api.md)) hay luồng Khảo sát (`/manager/survey`).
>
> Nguồn tham chiếu:
> - FE: `src/components/quotations/CreateQuotationWizardModal.tsx` (component chính),
>   `src/components/customers/CustomerFormModal.tsx` (modal con "Thêm nhanh khách hàng mới" — đã có
>   tài liệu riêng ở [`docs/taokhachhang_api.md`](taokhachhang_api.md), không nhắc lại ở đây),
>   `src/components/ui/SearchableSelect.tsx`, `src/mocks/db/quotations.ts`, `src/mocks/db/catalog.ts`,
>   `src/types/quotation.ts`, `src/types/catalog.ts`, `src/services/quotation.service.ts`,
>   `src/services/catalog.service.ts`.
> - DB thật: đối chiếu trực tiếp qua MySQL MCP ngày 2026-07-20 — `SHOW CREATE TABLE quotations`,
>   `quotation_items`, `items`, `item_types`, `item_categories`, `customers`; dữ liệu mẫu hiện có: 1
>   báo giá thật (`QUO-001`, 2 dòng hạng mục), 2 khách hàng thật, **chỉ 2 item thật** trong `items`
>   (`Loa JBL 1000W` / danh mục Âm thanh - Loa, `Đèn Beam 230` / danh mục Ánh sáng - Đèn chiếu) — quá ít
>   so với ~71 item với ~15 danh mục mà mock `catalog.ts` đang hiển thị trên modal (Bàn ghế, Khăn bàn &
>   Áo ghế, Ấm chén & Cốc, Quạt, Khung nhà rạp, Cổng hoa & Hoa giả...). Đây **không phải vấn đề API**,
>   chỉ là dữ liệu seed catalog thật chưa được nhập đủ — cần Product/kho nhập liệu trước khi màn hình
>   này dùng được thật, không phải việc backend phải sửa endpoint.
>
> **Đã chốt hướng xử lý cho toàn bộ mục 3 ngày 2026-07-20** (xem tóm tắt ở mục 5) — khác thời điểm viết
> nháp đầu tiên (chỉ liệt kê phương án chờ Product/Backend chọn), tài liệu này đã chọn xong 1 hướng cho
> từng điểm lệch, đặc biệt điểm 3.1 (dòng nhập tay không có `itemId`, mâu thuẫn thẳng với ràng buộc NOT
> NULL của schema thật) — **chọn Hướng A: bỏ hẳn nút "Thêm dòng nhập tay" khỏi UI**.

## 0. Base URL & Auth

- Base path: `/api/v1` (REST, JWT Bearer theo `AuthContext` hiện có ở FE).
- Toàn bộ endpoint dưới đây chỉ dành cho **Manager** (đúng CLAUDE.md — Admin không tạo báo giá, chỉ
  xem/audit; nút "Tạo báo giá mới" cần ẩn/khóa ở `admin/quotations/page.tsx` nếu hiện đang cho phép mở).

## 1. Ánh xạ dữ liệu theo từng bước

### Bước 1 — Chọn khách hàng

| Trường/thao tác trên UI | Nguồn dữ liệu hiện tại (mock) | API thật cần dùng |
|---|---|---|
| Dropdown "Lựa chọn khách hàng có sẵn" (`SearchableSelect`, tìm theo tên/mã/SĐT) | `getAdminCustomers()` — nạp **toàn bộ** khách hàng vào client 1 lần, lọc thuần JS trong `SearchableSelect` (component không tự gọi API, chỉ lọc mảng `options` được truyền sẵn) | `GET /api/v1/customers` (đã có, xem `docs/khach_hang_api.md` mục 2.1) — xem mục 4 về việc cần đổi sang tìm kiếm bất đồng bộ thay vì tải hết. |
| Nút "Thêm nhanh khách hàng mới" → mở `CustomerFormModal` | `addAdminCustomer()` (mock) | `POST /api/v1/customers` — dùng **nguyên trạng** endpoint đã chốt ở `docs/taokhachhang_api.md` (không tạo endpoint riêng cho modal này). Khách hàng tạo xong tự động được chọn làm khách hàng của báo giá đang soạn. |
| Khối "Khách hàng được chọn" (tên, SĐT, hòm thư) | Đọc trực tiếp từ object khách hàng đã chọn ở bước trên | Không cần gọi thêm API — dữ liệu đã có sẵn từ 1 trong 2 nguồn trên. |

### Bước 2 — Danh sách hạng mục

| Trường/thao tác trên UI | Nguồn dữ liệu hiện tại (mock) | API thật cần dùng |
|---|---|---|
| "Chọn nhanh từ danh mục kho thiết bị có sẵn" — ô tìm kiếm + accordion nhóm theo danh mục, mỗi nhóm là các nút "+ Tên item (giá)" | `MOCT_ITEMS` = toàn bộ `MOCK_ITEMS` (từ `catalog.ts`) lọc `status === 'ACTIVE'`, nhóm theo `item.typeName` | `GET /api/v1/catalog/items?status=ACTIVE` (đã có ở `catalog.service.ts`) để lấy danh sách item + `typeName`/`categoryName` join sẵn, dùng nhóm client-side y hệt logic hiện tại. **Vấn đề cần chốt: endpoint có `page`/`limit`** (xem `GetItemsQuery`) — mục 3.3. |
| Gõ trực tiếp vào ô tìm tên trong bảng (`ItemNameSearchInput`) → gợi ý 6 item khớp tên, chọn 1 để tự điền `category`/`unit`/`unitPrice` | Lọc trong cùng mảng `CATALOG_ITEMS` đã tải sẵn ở trên (không gọi API riêng) | Dùng chung dữ liệu đã tải từ `GET /api/v1/catalog/items?status=ACTIVE` ở trên, không cần endpoint riêng — **nhưng chỉ hoạt động đúng nếu đã tải được TOÀN BỘ item** (liên quan mục 3.3). |
| ~~Nút "+ Thêm dòng nhập tay"~~ — **đã chốt bỏ khỏi UI (Hướng A, mục 3.1)** vì không có chỗ lưu tương ứng trong schema thật | `emptyDraftItem()` — dòng hoàn toàn tự do, không có `itemId` | Không cần API — mọi hạng mục bắt buộc chọn từ `GET /api/v1/catalog/items` (xem 2 dòng phía trên). Item chưa có trong catalog phải tạo trước qua `POST /api/v1/catalog/items` ở màn Catalog, ngoài phạm vi modal này. |
| Bảng hạng mục: Tên hạng mục*, Phân loại, ĐVT, SL, Đơn giá (đ), Giảm giá/item, Thành tiền, nút xóa | State cục bộ `items: DraftLineItem[]`, `lineTotal = (unitPrice - discount) * quantity` | Map sang `SaveQuotationPayload.items[]` khi lưu ở Bước 3 — mỗi dòng bắt buộc có `itemId` thật (mục 3.1, đã chốt Hướng A) và `discount` gửi lên là tổng giảm của cả dòng, không phải per-unit (mục 3.4, đã chốt). |
| Dòng tổng: Tạm tính / Giảm giá / Thực tế | Tính lại client-side từ `items` | Không cần API — nhưng **backend phải tính lại y hệt** khi nhận `POST` (không tin số FE tự tính) vì `quotations.subtotal`/`discount_total`/`total_amount` là cột lưu thật, không phải cột generated. |

### Bước 3 — Tổng kết & Lưu

| Trường/thao tác trên UI | Nguồn dữ liệu hiện tại (mock) | API thật cần dùng |
|---|---|---|
| Họ tên khách / SĐT / Địa chỉ liên lạc | Từ khách hàng đã chọn ở Bước 1 | Không gọi thêm API. |
| Tổng dịch vụ / Khấu trừ giảm giá / Tổng cộng thanh toán | `subtotal`/`totalDiscount`/`grandTotal` tính ở client | Hiển thị lại đúng số đã tính ở Bước 2 — sau khi `POST` thành công nên dùng lại `subtotal`/`discountTotal`/`totalAmount` **backend trả về** thay vì số FE tự tính, để tránh lệch làm tròn. |
| Nút "Lưu" | `addAdminQuotation({...})` — ghi 1 bản ghi đầy đủ vào mock store kèm nhiều field không có trong DB thật (xem mục 3.2) | `POST /api/v1/customers/{customerId}/quotations` — xem mục 2. |

## 2. Endpoint chính đề xuất — `POST /api/v1/customers/{customerId}/quotations`

Endpoint này **đã có sẵn** trong `quotation.service.ts`/`docs/api/08-quotations.md` (không phải endpoint
mới) — tài liệu này chỉ làm rõ payload thật cần gửi khi submit từ modal, đối chiếu với `SHOW CREATE
TABLE quotations`/`quotation_items` thật.

**Path param**: `customerId` = khách hàng chọn/tạo ở Bước 1.

**Request body** (theo đúng cột NOT NULL của `quotation_items` thật — xem mục 3.1 về phần chưa khớp
được với UI hiện tại):

```json
{
  "version": "v1",
  "notes": "string, optional",
  "items": [
    { "itemId": "88dc60e1-89fa-497b-8bd5-b9c2ece4986e", "quantity": 2, "price": 500000, "discount": 0 }
  ]
}
```

- `items` tối thiểu 1 dòng (khớp validate hiện tại của FE: nút "Tiếp tục" ở Bước 2 disable khi
  `items.length === 0`).
- `itemId`: **bắt buộc, phải là UUID có thật trong bảng `items`** — `quotation_items.item_id` là cột
  `NOT NULL` + FK `RESTRICT` tới `items.item_id`, không cho phép lưu tên tự do không gắn item nào (đã
  chốt Hướng A ở mục 3.1 — modal không còn cho nhập tay không có `itemId`).
- `price`: đơn giá **tại thời điểm báo giá** (FE cho phép sửa tay sau khi chọn từ catalog, ví dụ khách
  thương lượng giá khác giá niêm yết `rentalPrice`) — backend lưu nguyên giá trị FE gửi lên, **không**
  tự động lấy lại `items.rental_price` mới nhất để ghi đè (đúng tinh thần "báo giá là ảnh chụp tại thời
  điểm lập", khớp comment `itemName` cũng được snapshot lại trong `quotation_items` thay vì chỉ lưu FK).
- `discount`: **đã chốt là tổng tiền giảm của cả dòng** (không phải per-unit) — FE tự nhân
  `discount × quantity` trước khi gửi, xem mục 3.4.
- `version`: **đã chốt gửi cứng `"v1"`** từ modal này (modal không có ô nhập trường này), xem mục 3.5.

**Response 201** (map theo `Quotation`/`QuotationDetail` trong `types/quotation.ts`, đối chiếu cột DB
thật):

```json
{
  "success": true,
  "code": "QUOTATION_CREATED",
  "message": "Tạo báo giá thành công",
  "data": {
    "quotationId": "7ccd5226-ed69-4ae3-ae16-06e5b4184843",
    "quotationCode": "QUO-002",
    "customerId": "4c700a21-5440-41f7-b66e-acedd12a0e76",
    "version": "v1",
    "subtotal": 1000000,
    "discountTotal": 0,
    "totalAmount": 1000000,
    "status": "DRAFT",
    "notes": "",
    "createdBy": "afcad54a-2448-4c26-aa66-4c8ed50d3c0a",
    "createdAt": "2026-07-20T00:00:00Z",
    "updatedAt": "2026-07-20T00:00:00Z",
    "items": [
      {
        "quotationItemId": "8c3cc951-8391-11f1-9279-56d18f15e6bb",
        "quotationId": "7ccd5226-ed69-4ae3-ae16-06e5b4184843",
        "itemId": "88dc60e1-89fa-497b-8bd5-b9c2ece4986e",
        "itemName": "Loa JBL 1000W",
        "quantity": 2,
        "price": 500000,
        "discount": 0,
        "lineTotal": 1000000
      }
    ]
  }
}
```

- `quotationCode`: sinh ở backend tại thời điểm `INSERT` (prefix `QUO-`, xem dữ liệu thật `QUO-001`) —
  modal hiện **không hiển thị mã dự kiến** trước khi lưu (khác modal Thêm khách hàng có dòng "Mã khách
  hàng dự kiến") nên **không cần** thêm endpoint kiểu `next-code` cho màn này.
- `status` trả `"DRAFT"` (khớp `DEFAULT 'DRAFT'` của cột `status` — quotation vừa tạo qua modal này luôn
  là bản nháp, đúng hành vi mock hiện tại `status: 'draft'`).
- `subtotal`/`discountTotal`/`totalAmount`/`lineTotal`: backend tự tính lại từ `items[]`, không tin số
  FE gửi kèm (FE hiện tại **không gửi** các số tổng này lên, chỉ gửi mảng `items` thô — đúng hướng, giữ
  nguyên khi nối API thật).

**Response lỗi**

| HTTP | Trường hợp | Ghi chú |
|---|---|---|
| 400 | `items` rỗng, `itemId` không tồn tại/không phải UUID hợp lệ, `quantity <= 0`, thiếu `version` | `{ "success": false, "code": "VALIDATION_ERROR", "message": "...", "errors": { "items[0].itemId": "..." } }` |
| 404 | `customerId` không tồn tại | Xảy ra nếu khách hàng bị xóa giữa lúc mở modal và lúc bấm Lưu (hiếm nhưng cần xử lý) |
| 403 | Người gọi không phải Manager | Theo chuẩn lỗi chung hệ thống |

## 3. Các điểm kiến trúc — đã chốt hướng xử lý (2026-07-20)

### 3.1. "Thêm dòng nhập tay" không có `itemId` — mâu thuẫn trực tiếp với schema thật (quan trọng nhất) — ĐÃ CHỐT: Hướng A

Bước 2 cho phép người dùng bấm "+ Thêm dòng nhập tay" và gõ hoàn toàn tự do tên/phân loại/ĐVT/đơn giá
mà **không bắt buộc chọn từ catalog** — dòng này không có `itemId` nào cả. Nhưng:

```sql
"item_id" varchar(36) ... NOT NULL,
CONSTRAINT "quotation_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items" ("item_id")
```

`quotation_items.item_id` là **NOT NULL + FK bắt buộc** tới bảng `items` — không có chỗ lưu một dòng
báo giá "tên tự do, không gắn item nào" trong schema hiện tại. Đây là lệch kiến trúc thật sự, không chỉ
là thiếu field hiển thị như các vấn đề đã gặp ở 2 tài liệu trước.

**Đã chốt: Hướng A** — bỏ hẳn nút "Thêm dòng nhập tay" khỏi UI, bắt buộc mọi hạng mục báo giá phải chọn
từ catalog (`items` đã có sẵn). Nếu thiết bị/dịch vụ cần báo giá **chưa có trong catalog**, luồng đúng là
vào trước `/admin` (hoặc `/manager`, tùy phân quyền catalog hiện có) tạo Item mới qua
`POST /api/v1/catalog/items` **trước**, rồi quay lại modal báo giá chọn item đó — tức là catalog phải
luôn đi trước báo giá, không cho phép báo giá tự phát sinh item ngoài luồng. Đây là hướng ít việc backend
nhất, không cần đổi schema, không có nguy cơ làm "rác" catalog thật bằng item đặt tên tùy tiện, và không
phá vỡ logic tính tồn kho/Picklist ở các màn khác (vốn dựa hoàn toàn vào `item_id` để tra cứu thiết bị).

Hai hướng còn lại đã cân nhắc nhưng **không chọn**, ghi lại để tránh đề xuất lại sau này:

- **Hướng B (không chọn)**: giữ nút "Thêm dòng nhập tay" nhưng khi submit, modal tự động gọi `POST
  /api/v1/catalog/items` để tạo Item mới ngay tại chỗ (dùng tên/ĐVT/đơn giá người dùng vừa gõ) trước khi
  gọi `POST .../quotations`, lấy `itemId` vừa tạo để gắn vào dòng báo giá — phức tạp hơn (phải sinh
  `itemCode` tự động, chọn `typeId` mặc định/bắt người dùng chọn danh mục cho item mới), và có nguy cơ
  làm "rác" catalog thật bằng các item đặt tên tùy tiện, khó tái sử dụng lần sau.
- **Hướng C (không chọn)**: đổi schema — nới `quotation_items.item_id` thành nullable, thêm cột
  `custom_item_name` cho dòng không gắn catalog — thay đổi migration, ảnh hưởng logic tính tồn
  kho/picklist ở các màn khác vốn dựa vào `item_id` để tra cứu thiết bị (Picklist xuất kho theo
  CLAUDE.md phải biết chính xác thiết bị nào, số lượng bao nhiêu — dòng "tự do" không thể xuất kho được).

**Việc backend cần làm**: không cần sửa gì thêm ở `quotation_items` — schema hiện tại (`item_id NOT
NULL` + FK) đã đúng ý đồ Hướng A, chỉ cần validate chặt `itemId` phải tồn tại trong `items` khi nhận
`POST .../quotations` (đã ghi ở mục 2).

### 3.2. `servicePackage`/`guestCount`/`tablePrice`/`assignee`/`validUntil` — modal đang set nhưng KHÔNG có cột tương ứng trong `quotations` thật — ĐÃ CHỐT

`handleSave()` hiện tại gọi `addAdminQuotation({...})` với các field: `servicePackage` (tự sinh chuỗi
`"Báo giá dịch vụ sự kiện - {tên khách}"`), `guestCount: 0`, `tablePrice: 0`, `assignee: 'Lê Minh Dũng'`
(hardcode cứng, không phải người đang đăng nhập), `validUntil` (= ngày tạo + 30 ngày). Đối chiếu `SHOW
CREATE TABLE quotations` thật — **không có cột nào trong 5 field này** (đã nêu tổng quát ở
`docs/danhsachbaogia_api.md` mục 3.2, tài liệu này xác nhận lại cụ thể vì đây là nơi phát sinh dữ liệu).

**Đã chốt: bỏ hẳn 5 field này khỏi payload gửi lên** — không gửi lên backend (backend cũng không có chỗ
nhận). Nếu về sau Product cần khái niệm "hạn báo giá"/"số khách dự kiến"/"người phụ trách" ở tầng
Quotation (không phải Order), phải bổ sung cột mới vào bảng `quotations` trước — ngoài phạm vi sửa đổi
của modal này, không chặn việc nối API cho phần còn lại.

### 3.3. `GET /api/v1/catalog/items` có phân trang — không phù hợp để "tải hết rồi nhóm theo danh mục" — ĐÃ CHỐT

`GetItemsQuery` (`catalog.service.ts`) có `page`/`limit`, ngụ ý endpoint thật trả phân trang theo mặc
định giống các danh sách khác trong hệ thống (vd 10-20 item/trang). Nhưng UI Bước 2 cần **toàn bộ** item
đang `ACTIVE` để nhóm theo `typeName` và hiện accordion nhiều danh mục cùng lúc (giống ảnh mẫu: Bàn ghế,
Khăn bàn & Áo ghế, Ấm chén & Cốc, Quạt...) — không phải danh sách phân trang cuộn từng trang.

**Đã chốt**: `GET /api/v1/catalog/items?status=ACTIVE` khi **không truyền `page`/`limit`** trả **toàn
bộ** item active (không phân trang), tương tự cách nhiều hệ thống dùng "limit mặc định lớn cho tra cứu
nội bộ ít dữ liệu" — catalog thiết bị sự kiện thực tế thường chỉ vài trăm dòng, không cần phân trang
thật sự cho use-case "chọn nhanh". Backend cần đảm bảo endpoint này không áp `limit` mặc định thấp khi
`page`/`limit` bị bỏ trống trong query string.

Phương án lazy-load theo từng danh mục (gọi riêng `GET /api/v1/catalog/items?typeId=...&status=ACTIVE`
mỗi khi mở 1 accordion) đã cân nhắc nhưng **không chọn** vì đổi UX từ "tải 1 lần, tìm mượt" sang "tải khi
mở nhóm, có độ trễ nhỏ mỗi lần bấm" — không cần thiết khi quy mô catalog thực tế còn nhỏ.

### 3.4. Ngữ nghĩa cột `discount` trên `quotation_items` — per-unit hay tổng dòng? — ĐÃ CHỐT

UI ghi rõ nhãn cột là **"Giảm giá/item"** và tính `lineTotal = (unitPrice - discount) * quantity` — tức
FE đang hiểu `discount` là **số tiền giảm trên mỗi đơn vị**, nhân lại với số lượng ra tổng giảm của
dòng. Nhưng cột thật `quotation_items.discount` (decimal 14,2) không có comment/tên nào xác nhận rõ đây
là per-unit hay tổng dòng — đối chiếu công thức `line_total` với dữ liệu mẫu thật (`price=500000,
quantity=2, discount=0.00, line_total=1000000.00`) không đủ để phân biệt 2 cách hiểu vì `discount` mẫu
đang bằng 0.

**Đã chốt**: giữ nguyên UX hiện tại trên UI (nhập giảm giá theo từng đơn vị, dễ hiểu hơn với nhân viên
kinh doanh khi đàm phán giá từng thiết bị), nhưng khi map sang payload gửi backend, **FE nhân sẵn
`discount × quantity` trước khi gửi** — tức field `discount` gửi lên `POST .../quotations` là **tổng
tiền giảm của cả dòng**, và backend tính `line_total = price × quantity − discount`. Backend implement
service tạo báo giá phải dùng đúng công thức này (không nhân thêm `quantity` lần nữa ở tầng service, vì
FE đã nhân sẵn), tránh lệch số giữa FE hiển thị và số backend lưu.

### 3.5. Trường `version` — bắt buộc ở backend nhưng modal không có ô nhập — ĐÃ CHỐT

`SaveQuotationPayload.version` ghi rõ "bắt buộc khi tạo mới" và DB có cột `version varchar(30) NOT
NULL`, dữ liệu thật hiện có giá trị tự do `"v1"` — nhưng modal `CreateQuotationWizardModal` **không có
bất kỳ ô nhập nào cho phiên bản báo giá**, mock tự gán cứng `version: 1` (kiểu số, sai kiểu dữ liệu so
với `varchar` thật — cùng vấn đề kiểu dữ liệu `version` đã nêu ở `docs/danhsachbaogia_api.md` mục 2).

**Đã chốt**: vì đây luôn là lần tạo báo giá **đầu tiên** cho 1 khách hàng qua modal này (chưa có UI "tạo
phiên bản mới từ báo giá cũ" ở đâu trong phạm vi đã khảo sát), **FE luôn gửi cứng `version: "v1"`** khi
tạo mới từ modal này, không thêm ô nhập trên UI. Việc tạo phiên bản kế tiếp (`v2`, `v3`...) thuộc về 1
luồng khác (sửa/nhân bản báo giá ở trang chi tiết, ngoài phạm vi modal tạo mới), không phải người dùng
tự gõ chuỗi version tùy ý ngay lúc tạo mới.

## 4. Tổng hợp việc cần sửa ở FE khi nối API thật

- Đổi Bước 1: thay `getAdminCustomers()` tải hết bằng gọi bất đồng bộ `GET /api/v1/customers?search=...`
  (debounce theo input gõ trong `SearchableSelect`, hoặc đổi hẳn component tìm kiếm nếu `SearchableSelect`
  hiện tại không hỗ trợ tải động) — tránh tải toàn bộ bảng khách hàng về client mỗi lần mở modal.
- Đổi Bước 2: **bỏ hẳn nút "+ Thêm dòng nhập tay"** khỏi UI (Hướng A đã chốt, mục 3.1) — chỉ còn 2 cách
  thêm hạng mục: bấm chọn nhanh từ danh mục catalog, hoặc gõ tìm tên trong ô `ItemNameSearchInput` rồi
  chọn 1 gợi ý (cả 2 đều luôn gắn `itemId` thật). Tải catalog 1 lần từ `GET /api/v1/catalog/items?status=ACTIVE`
  không truyền `page`/`limit` (mục 3.3), không cần lazy-load theo từng accordion.
- Đổi `handleSave()`: bỏ 5 field không có cột thật (mục 3.2), gửi `version: "v1"` cứng (mục 3.5), nhân
  `discount × quantity` trước khi gửi lên backend theo công thức đã chốt (mục 3.4), gọi
  `quotationApiService` (cần thêm hàm `createQuotation` dùng đúng path `customers/{customerId}/quotations`
  — hàm này **đã có sẵn** trong `quotation.service.ts`, chỉ cần wire vào modal) thay vì
  `addAdminQuotation()` mock.
- Sau khi lưu thành công: dùng lại `subtotal`/`discountTotal`/`totalAmount` backend trả về để hiển thị
  (nếu modal cần echo lại số liệu, ví dụ toast thông báo) thay vì số FE tự cộng dồn.
- Gỡ toàn bộ import từ `@/mocks/db/quotations` (`addAdminQuotation`, `nextAdminQuotationCode`,
  `AdminQuotationLineItem`) và `@/mocks/db/customers` (`getAdminCustomers`, `addAdminCustomer`,
  `nextAdminCustomerId`) khỏi `CreateQuotationWizardModal.tsx` sau khi nối API thật.

## 5. Tóm tắt các quyết định đã chốt (2026-07-20)

| Mục | Vấn đề | Quyết định |
|---|---|---|
| 3.1 | Dòng nhập tay không có `itemId` | **Hướng A** — bỏ nút "Thêm dòng nhập tay", mọi hạng mục bắt buộc chọn từ catalog thật. |
| 3.2 | 5 field `servicePackage`/`guestCount`/`tablePrice`/`assignee`/`validUntil` không có cột thật | Bỏ hẳn khỏi payload gửi backend. |
| 3.3 | `GET /api/v1/catalog/items` phân trang, không phù hợp tải-hết-để-nhóm | Không truyền `page`/`limit` → trả toàn bộ item active, không phân trang. |
| 3.4 | Ngữ nghĩa `discount` per-unit hay tổng dòng | FE nhân `discount × quantity` trước khi gửi — field gửi lên là **tổng giảm của cả dòng**. |
| 3.5 | `version` bắt buộc nhưng modal không có ô nhập | FE luôn gửi cứng `"v1"` khi tạo mới từ modal này. |
