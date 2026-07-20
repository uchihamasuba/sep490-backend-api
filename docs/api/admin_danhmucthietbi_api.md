# API màn "Sản phẩm & thiết bị" (`/admin/catalog`)

> Tài liệu tổng hợp API mà màn **Sản phẩm & thiết bị** (breadcrumb "Danh mục kho & tài sản / Sản phẩm
> & thiết bị", ảnh mẫu người dùng cung cấp) trên web frontend cần backend cung cấp.
>
> Được viết dựa trên:
> - Code FE: `src/app/admin/catalog/page.tsx` (trang chính), `src/components/catalog/CatalogItemFormModal.tsx`
>   (modal Tạo/Sửa), `src/components/catalog/CatalogItemDetailModal.tsx` (modal xem chi tiết),
>   `src/types/catalog.ts` (type `Item`/`ItemType`/`ItemCategory`), `src/services/catalog.service.ts`
>   (`catalogApiService` — đã có sẵn, xem mục 5), `src/mocks/db/catalog.ts` (nguồn mock đang dùng tạm
>   trong giai đoạn UI-first, CLAUDE.md mục 0), `src/hooks/usePagination.ts`.
> - **Không có MCP truy vấn database khả dụng trong phiên làm việc này** (giống cảnh báo ở
>   `docs/admin_danhsachnguoidung__api.md`) — tài liệu này **không tự chạy `SHOW CREATE TABLE`**. Tuy
>   nhiên khác với file đó, ở đây **đã có căn cứ gián tiếp đáng tin cậy**: comment đầu
>   `src/types/catalog.ts` (đối chiếu `prisma/schema.prisma`/`*.route.ts`/`*.service.ts` backend ngày
>   2026-07-06) và [`docs/thietbikhohang_api.md`](thietbikhohang_api.md) (đối chiếu trực tiếp qua MySQL
>   MCP ngày **2026-07-20**, `SHOW CREATE TABLE order_items/items/item_types/item_categories/...`)
>   **đều xác nhận cùng một kiến trúc thật 3 tầng `item_categories → item_types → items`** — khớp với
>   `catalogApiService` đã implement sẵn (`/catalog/categories`, `/catalog/types`, `/catalog/items`).
> - **Đã chốt với Product ngày 2026-07-20** — toàn bộ 5 điểm còn để mở ở bản nháp trước đã được chốt,
>   xem mục 7. Các mục 1-6 dưới đây đã cập nhật theo quyết định đó (không còn là "đề xuất").

## 0. Base URL & Auth

- Base path: `/api/v1/catalog` (đã có `catalogApiService`, không cần base path mới).
- **Quyền**: theo `usePermission()` — `canManage = can('master-data:manage')`, permission này chỉ cấp
  cho **Admin** (`src/constants/permissions.ts`), khớp đúng CLAUDE.md mục "Vai trò & phân quyền" (Admin
  quản lý master data). Nút "Tạo sản phẩm" và 2 icon Sửa/Xóa trên mỗi dòng chỉ hiện khi `canManage`.
  **Manager không thấy các nút này trên trang** (`page.tsx` dòng 195/241) — tuy vậy các endpoint GET
  (mục 2) vẫn nên cho Manager đọc, vì Manager cần tra cứu giá/tồn kho khi tạo báo giá (đã dùng chung
  `MOCK_ITEMS`/`getCatalogItemsAsApiItems()` ở trang tạo báo giá). Endpoint ghi (POST/PUT/PATCH — mục 3,
  4) chỉ Admin.

## 1. Field bảng chính → mapping `Item` (`types/catalog.ts`)

| Cột UI | Field FE (`Item`) | Ghi chú |
|---|---|---|
| ID | `itemId` | **Đã chốt (mục 6.1, Hướng 2)**: `itemId` chính là `itemCode` do Admin nhập tay khi tạo (vd `BG001`), không sinh riêng — khớp đúng dữ liệu hiển thị trong ảnh mẫu (`BG001`, `BG002`, `BG003`...). |
| Sản phẩm | `itemName` (bấm vào mở modal chi tiết, không điều hướng trang) | Bắt buộc, không rỗng (validate ở `CatalogItemFormModal`). |
| Nhóm sản phẩm | `typeName` (fallback `'—'` nếu rỗng) | Cột hiển thị tên gọi, nhưng **bộ lọc** cùng tên trên UI lọc theo `categoryId` (tầng cha) — **đã chốt ở mục 6.2**, không phải theo `typeId`. |
| Đơn vị | `unit` | Text tự do (vd "Cái", "Tấm", "Bộ", "m²") — bắt buộc, không rỗng. |
| Giá thuê | `rentalPrice` | Định dạng qua `formatCurrency` (CLAUDE.md mục 4) — không format thủ công. |
| Ngày cập nhật | `updatedAt` (fallback `createdAt` nếu chưa có) | Định dạng qua `formatDate`. |
| Trạng thái | `status` (`ACTIVE`/`INACTIVE`/`MAINTENANCE`) | ⚠️ **Bug FE hiện tại** (không thuộc phạm vi quyết định backend ở mục 7, chỉ ghi chú lại để không hiểu nhầm ý nghĩa dữ liệu): badge ở bảng chính tính trực tiếp `row.status === 'ACTIVE' ? 'success' : 'neutral'` (`page.tsx` dòng 177) — item `MAINTENANCE` bị hiển thị **cùng màu xám** với `INACTIVE`, sai với hệ màu badge đã chốt ở CLAUDE.md mục 3 (`MAINTENANCE` phải là amber/warning, xem `getStatusBadgeVariant` đã làm đúng ở `CatalogItemDetailModal.tsx`). Cần sửa `page.tsx` dùng `getStatusBadgeVariant(row.status)` thay vì so sánh tay — việc của FE (xem mục 8), không phải backend. |
| Thao tác (Xem/Sửa/Xóa) | — | "Xem" mở lại modal chi tiết dùng thẳng dữ liệu dòng đang có trong bảng (**không gọi** `GET /catalog/items/:id` riêng) — endpoint chi tiết trong `catalogApiService` vẫn nên giữ (dùng cho các nơi khác cần fetch 1 item lẻ), chỉ là màn này không cần gọi thêm. "Xóa" — **đã chốt Hướng A ở mục 4**: thực chất gọi `PATCH .../status` (đổi `INACTIVE`), không xóa cứng. |

## 2. `GET /api/v1/catalog/items` — Danh sách (đã có `catalogApiService.getItems`)

**Query params đã chốt** (`GetItemsQuery` hiện có `page`/`limit`/`search`/`typeId`/`status` — cần đổi
`typeId` thành `categoryId` và bổ sung `minPrice`/`maxPrice`, xem mục 7 việc cần làm):

| Param | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `search` | string | Không | Tìm theo `itemName` hoặc `itemId` (khớp logic FE `page.tsx` dòng 80 — `LIKE` không phân biệt hoa/thường trên cả 2 cột). Ô input placeholder ghi "Tìm kiếm theo ID, tên sản phẩm...". |
| `categoryId` | string (FK `item_categories.id`) | Không | **Đã chốt (mục 6.2)**: dropdown "Nhóm sản phẩm" trên UI lọc theo Category (tầng cha, gộp mọi type con thuộc category đó), không phải `typeId` — thay thế param `typeId` hiện khai báo trong `GetItemsQuery`. |
| `status` | `ACTIVE \| INACTIVE` | Không | Dropdown "Trạng thái" — FE hiện chỉ có 2 option này (`STATUS_OPTIONS`), thiếu `MAINTENANCE` dù type `ItemStatus` có 3 giá trị. Giữ nguyên như hiện tại (không nằm trong phạm vi 5 điểm đã chốt ở mục 7) — nếu sau này cần lọc thêm `MAINTENANCE`, bổ sung UI riêng. |
| `minPrice` | number | Không | **Đã chốt bổ sung mới**: bộ lọc nâng cao "Giá thuê" (nút "Bộ lọc"), 3 preset cố định trên UI: `< 50.000đ`, `50.000đ - 300.000đ`, `> 300.000đ`. Backend nhận khoảng `minPrice`/`maxPrice` (không phải 1 enum preset) để linh hoạt hơn nếu sau này đổi mốc — FE tự map 3 preset sang khoảng số khi gọi API. |
| `maxPrice` | number | Không | Đi kèm `minPrice` (xem trên). Preset "Trên 300.000đ" chỉ gửi `minPrice=300001` (không giới hạn trên); preset "Dưới 50.000đ" chỉ gửi `maxPrice=49999`. |
| `page` | number | Không (default 1) | |
| `limit` | number | Không (default 10) | FE cố định 10 qua `usePagination(10)`. |

**Response 200** (theo đúng shape `Item[]` đã khai báo + pagination meta chuẩn — không cần
`meta.counts` vì UI không hiển thị số đếm theo tab):

```json
{
  "data": [
    {
      "itemId": "BG001",
      "itemCode": "BG001",
      "itemName": "Bàn loại to (Hộp chữ nhật 1.8m x 0.9m)",
      "typeId": "type-cat-1",
      "typeName": "Bàn ghế",
      "description": "",
      "unit": "Cái",
      "rentalPrice": 150000,
      "status": "ACTIVE",
      "inventory": { "quantityTotal": 80, "quantityAvailable": 65 },
      "createdAt": "2026-07-11T00:00:00.000Z",
      "updatedAt": "2026-07-11T00:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "totalItems": 71, "totalPages": 8 }
}
```

`inventory` (tồn kho) hiển thị ở modal chi tiết (`quantityAvailable/quantityTotal`) — không hiện trên
bảng chính, nhưng cần trả kèm vì modal chi tiết không gọi API riêng (xem mục 1, dòng "Thao tác").

**Permission**: Admin, Manager — đọc.

---

## 3. Tạo/sửa sản phẩm — đã có `catalogApiService.createItem`/`updateItem`

### 3.1. `POST /api/v1/catalog/items`

Dùng cho modal "Tạo thiết bị mới" (nút "+ Tạo sản phẩm" trên trang list).

```json
// Request (CreateItemPayload hiện có, khớp form)
{
  "itemCode": "string, required — nhập tay, DÙNG LUÔN LÀM itemId/PK (mục 6.1, Hướng 2), khóa không sửa được sau khi tạo",
  "itemName": "string, required, not blank",
  "typeId": "string, required — FK item_types.id",
  "unit": "string, required, not blank",
  "description": "string, optional",
  "rentalPrice": "number, required, > 0"
}
```

**Validate tối thiểu (khớp FE `CatalogItemFormModal` dòng 74-81)**: `rentalPrice > 0`, `typeId` không
rỗng. FE **chưa validate** `itemCode`/`itemName`/`unit` không rỗng dù có `required` trên input (chỉ
chặn ở HTML, không chặn ở submit handler) — nên bổ sung validate các trường này ở backend. **Bắt buộc
thêm**: `itemCode` phải **unique** — trả **409 Conflict** nếu trùng mã đã tồn tại (vì `itemCode` dùng
trực tiếp làm `itemId`/PK theo quyết định Hướng 2 ở mục 6.1, không có tầng sinh mã riêng để tự tránh
trùng như UUID).

**Response 201**: object `Item` (mục 2) với `itemId === itemCode` (giá trị user vừa nhập, không có mã
nào khác được backend sinh thêm), `status` mặc định `ACTIVE`, `inventory` mặc định
`{ quantityTotal: 0, quantityAvailable: 0 }` (khớp mock `handleCreateSubmit`, sản phẩm mới chưa có tồn
kho, cần nhập kho riêng qua luồng khác — ngoài phạm vi màn này).

**Permission**: Admin.

### 3.2. `PUT /api/v1/catalog/items/:id`

Dùng cho modal "Chỉnh sửa thiết bị". Body giống 3.1 trừ `itemCode` (input bị `disabled` khi
`mode === 'edit'`, kèm helpText "Không thể đổi mã sau khi tạo" — **không gửi `itemCode` trong body sửa**,
hoặc nếu gửi thì backend bỏ qua/từ chối nếu khác giá trị hiện có — hợp lý vì đổi `itemCode` tức đổi cả
`itemId`/PK theo quyết định Hướng 2).

**Permission**: Admin.

---

## 4. Xóa sản phẩm — **Đã chốt: Hướng A (không xóa cứng, chỉ đổi trạng thái)**

`page.tsx` (`handleDelete`, dòng 149-152) hiện có nút Xóa với `window.confirm` rồi xóa thẳng khỏi mảng
local, nhưng `catalogApiService` **không có method xóa nào** cho `Item`. **Đã chốt**: không thêm
`DELETE` — tận dụng luồng đổi trạng thái **đã có sẵn**:

```
PATCH /api/v1/catalog/items/:id/status
Body: { "status": "ACTIVE" | "INACTIVE" | "MAINTENANCE" }
```

(`catalogApiService.updateItemStatus`, `UpdateItemStatusPayload` — không cần thêm gì mới ở tầng service).

**Lý do chọn Hướng A thay vì thêm `DELETE` thật**: `Item` là master data thường xuyên bị tham chiếu bởi
`order_items`/`quotation_items`/`supplier_transaction_items`/`change_request_items` (đã thấy tên các
bảng này qua đối chiếu MCP ở `docs/thietbikhohang_api.md`) — xóa cứng rất dễ vỡ dữ liệu lịch sử đơn hàng
cũ, trong khi đổi trạng thái `INACTIVE` vẫn giữ nguyên lịch sử mà vẫn đạt được ý nghĩa "ngừng kinh doanh"
Admin cần, đúng tinh thần đã áp dụng cho Nhân sự ở `docs/admin_danhsachnguoidung__api.md` mục 2.5 và rule
"Xóa draft" ở CLAUDE.md mục 1 (chỉ xóa được khi chưa gắn dữ liệu liên quan).

**Permission**: Admin.

---

## 5. Endpoint danh mục/loại (Category/Type) — đã có sẵn, chỉ tham chiếu

Dropdown "Nhóm sản phẩm" (filter) và Select "Nhóm sản phẩm" (trong form tạo/sửa) cần danh sách category/
type — **đã có sẵn** `catalogApiService.getCategories()` (`GET /catalog/categories`) và
`getTypes()` (`GET /catalog/types`), không cần thêm gì. Link "Quản lý danh mục" trên trang (góc phải
header) trỏ sang `/admin/catalog/categories` — **ngoài phạm vi tài liệu này** (trang quản lý category/
type riêng, đã có đủ endpoint CRUD trong `catalogApiService` mục Categories/Types).

## 6. Diễn giải các quyết định đã chốt

### 6.1. `itemId` vs `itemCode` — **Đã chốt: Hướng 2**

Dữ liệu mock hiện có (`src/mocks/db/catalog.ts`, hàm `toApiItem`) set `itemId = itemCode = row.id`
(cùng 1 giá trị, vd `"BG001"`) — khớp đúng ID hiển thị trong ảnh mẫu, nhưng handler tạo mới cũ ở
`page.tsx` (`handleCreateSubmit`) từng sinh `itemId` riêng bằng `nextMockItemId()` (dạng tuần tự
`SP004`...) độc lập với `itemCode` do user nhập — lệch pattern so với 71 sản phẩm mock gốc.

**Đã chốt: giữ đúng pattern 71 item mock gốc** — `itemCode` do Admin nhập tay khi tạo **chính là**
`itemId`/PK luôn, không sinh mã riêng ở backend — theo đúng tiền lệ `customerId`/`NV###` đã chốt ở
`docs/khach_hang_api.md`/`docs/admin_danhsachnguoidung__api.md`. Backend đảm bảo unique ở tầng
`itemCode`/PK (409 nếu trùng khi tạo mới — mục 3.1); FE bỏ `nextMockItemId()` khỏi luồng submit khi nối
API thật (mục 8).

### 6.2. "Nhóm sản phẩm" — **Đã chốt: lọc theo `categoryId`**

`Item.typeId` (FK `item_types`) là field chính thức cho "loại thiết bị" theo `types/catalog.ts`, nhưng
dropdown filter "Nhóm sản phẩm" trên trang list lại render từ `categories` (`ItemCategory[]`, dùng
`categoryId` làm value) và lọc bằng cách suy `typeIdToCategoryId.get(item.typeId)` — tức đang lọc theo
**Category** (tầng cha), không phải `typeId` trực tiếp. Mock hiện tại "che" được sự lệch pha này vì mỗi
category chỉ có đúng 1 type con (`MOCK_TYPES` sinh 1:1 từ category) — dữ liệu thật (backend, kiến trúc
3 tầng Category→Type→Item) nhiều khả năng có N type/category.

**Đã chốt**: filter "Nhóm sản phẩm" trên UI này lọc theo `categoryId` (tất cả item thuộc mọi type con
của category đó) — khớp đúng nhãn "Nhóm sản phẩm" và hành vi UI hiện tại. `GetItemsQuery.typeId` trong
`catalog.service.ts` cần đổi tên/ngữ nghĩa thành `categoryId` (mục 7 việc cần làm) — không phục vụ lọc
theo `typeId` cho màn hình này (nếu sau này cần lọc chi tiết theo type, làm ở màn khác, không đè lên
filter "Nhóm sản phẩm").

## 7. Quyết định đã chốt (Product — 2026-07-20)

1. **Kiến trúc DB**: xác nhận 3 tầng `item_categories → item_types → items` (theo đối chiếu MCP
   2026-07-20 ở `docs/thietbikhohang_api.md`) — `catalogApiService` hiện tại về cơ bản đã khớp, chỉ cần
   bật lại kết nối thật (đang bị chặn theo `docs/more-require.md` mục (jj)).
2. **Bổ sung `minPrice`/`maxPrice`** vào `GET /catalog/items` (mục 2) cho bộ lọc "Giá thuê" nâng cao.
3. **Xóa sản phẩm**: Hướng A — không thêm `DELETE`, dùng `PATCH /catalog/items/:id/status` có sẵn để đổi
   `INACTIVE` (mục 4).
4. **`itemId` = `itemCode`**: Hướng 2 — `itemCode` do Admin nhập chính là PK, backend validate unique,
   không sinh mã riêng (mục 6.1).
5. **Filter "Nhóm sản phẩm"**: lọc theo `categoryId`, đổi tên param `GetItemsQuery.typeId` →
   `categoryId` (mục 6.2).

> Bước tiếp theo:
> - Backend: đổi `GetItemsQuery.typeId` → `categoryId` trong `src/services/catalog.service.ts`, thêm
>   `minPrice`/`maxPrice`, thêm validate unique `itemCode` (409) ở `POST /catalog/items`, bật lại kết nối
>   thật cho `catalogApiService` (đang bị chặn theo `docs/more-require.md` mục (jj)).
> - FE: xem checklist đầy đủ ở mục 8.

## 8. Việc cần làm ở FE khi nối API thật (chưa làm, ghi chú lại)

- Đổi `page.tsx` từ dùng `MOCK_CATEGORIES`/`MOCK_ITEMS`/`MOCK_TYPES` sang gọi `catalogApiService` thật
  (`getCategories`/`getTypes`/`getItems`), thêm state `isLoading`/lỗi cho `Table` (hiện đang hardcode
  `isLoading={false}`).
- Sửa badge trạng thái ở bảng chính dùng `getStatusBadgeVariant(row.status)` thay vì so sánh tay (mục 1).
- Đổi handler `handleDelete` gọi `catalogApiService.updateItemStatus(id, { status: 'INACTIVE' })` thay
  vì xóa khỏi mảng local, đổi label nút/modal xác nhận từ "Xóa sản phẩm" sang "Ngừng kinh doanh sản phẩm"
  (mục 4).
- Bỏ `nextMockItemId()` khỏi `handleCreateSubmit` — `itemId` gửi lên chính là `itemCode` user nhập, xử
  lý lỗi 409 (trùng mã) trả về từ backend và hiển thị ở `errorMessage` của `CatalogItemFormModal` (mục
  6.1).
- Đổi state/param filter "Nhóm sản phẩm" gọi API với `categoryId` (đã đúng theo cách `page.tsx` đang suy
  ra hiện tại, chỉ cần đổi từ lọc client-side sang gửi lên server — mục 6.2).
- Map 3 preset "Bộ lọc" giá (`priceFilter`) sang `minPrice`/`maxPrice` khi gọi API thay vì lọc
  client-side (mục 2).
