# API màn "Quản lý danh mục thiết bị" (`/admin/catalog/categories`)

> Tài liệu tổng hợp API mà màn **Quản lý danh mục thiết bị** (ảnh mẫu người dùng cung cấp — tiêu đề
> "Quản lý danh mục thiết bị", ô tìm "Tìm theo tên danh mục...", bảng `MÃ DANH MỤC`/`TÊN DANH MỤC`/
> `THAO TÁC` với icon Xem/Sửa, nút "+ Tạo danh mục") trên web frontend cần backend cung cấp.
>
> Đây chính là trang được link "Quản lý danh mục" ở góc phải header trang **Sản phẩm & thiết bị**
> (`/admin/catalog`) trỏ tới — đã được [`docs/admin_danhmucthietbi_api.md`](admin_danhmucthietbi_api.md)
> mục 5 nêu là "ngoài phạm vi tài liệu đó, có đủ endpoint CRUD trong `catalogApiService` mục
> Categories/Types". Tài liệu này đặc tả riêng cho đúng màn danh mục đó.
>
> Được viết dựa trên:
> - Code FE: `src/app/admin/catalog/categories/page.tsx` (trang chính — khớp 100% ảnh mẫu: tiêu đề, mô
>   tả phụ, ô search, nút refresh, bảng, nút "Tạo danh mục"), `src/app/admin/catalog/categories/[id]/page.tsx`
>   (trang chi tiết 1 danh mục, mở từ icon "Xem" — xem mục 6 phụ lục),
>   `src/components/catalog/CategoryFormModal.tsx` (modal Tạo/Sửa dùng chung 2 chế độ),
>   `src/types/catalog.ts` (`ItemCategory`/`CreateItemCategoryPayload`/`UpdateItemCategoryPayload`/
>   `UpdateItemCategoryStatusPayload`), `src/services/catalog.service.ts` (`catalogApiService` — các
>   method Categories **đã implement sẵn ở tầng FE**, chỉ cần backend hoàn thiện), `src/mocks/db/catalog.ts`
>   + `src/services/mockAdapter.ts` (mock đang dùng tạm trong giai đoạn UI-first, CLAUDE.md mục 0),
>   `src/hooks/usePagination.ts`, `src/hooks/useDebounce.ts`.
> - **Không có MCP truy vấn database khả dụng trong phiên làm việc này** — tài liệu này không tự chạy
>   `SHOW CREATE TABLE`. Dùng lại căn cứ gián tiếp trong repo: comment đầu `src/types/catalog.ts` (đối
>   chiếu `prisma/schema.prisma` backend ngày 2026-07-06, và 1 schema mới hơn phát hiện thêm ngày
>   2026-07-07 có tên bảng `equipment_categories` 4 tầng — file `docs/database.md` được comment đó
>   dẫn chiếu **hiện không tồn tại trong repo**, không đọc lại được; `docs/more-require.md` hiện cũng
>   **chỉ có mục (a)**, không có mục (h)/(ii)/(jj) mà 2 tài liệu `docs/admin_danhmucthietbi_api.md` và
>   `docs/admin_taothietbimoi_api.md` có dẫn chiếu tới — 2 nguồn này đã lệch pha với repo hiện tại, chỉ
>   dùng comment trực tiếp trong `types/catalog.ts` làm căn cứ đáng tin cậy nhất).

## 0. Base URL & Auth

- Base path: `/api/v1/catalog` — đã có sẵn `catalogApiService`, không cần base path mới.
- **Quyền**: theo `usePermission()` — `canManage = can('master-data:manage')` (`src/constants/permissions.ts`
  dòng 6: permission này chỉ cấp cho **Admin**), khớp CLAUDE.md mục "Vai trò & phân quyền" (Admin quản
  lý master data). Nút "+ Tạo danh mục" và icon Sửa chỉ hiện khi `canManage` (`page.tsx` dòng 110/133) —
  icon "Xem" (mở trang chi tiết) hiện với **mọi role** truy cập được trang, không kiểm tra `canManage`.
  Endpoint ghi (POST/PUT — mục 3, 4) **phải chặn ở tầng API** (403 nếu role không có
  `master-data:manage`), không chỉ ẩn nút ở FE.

## 1. Field bảng chính → mapping `ItemCategory` (`types/catalog.ts` dòng 21-26)

| Cột UI | Field FE (`ItemCategory`) | Ghi chú |
|---|---|---|
| Mã danh mục | `categoryId` | Hiển thị trực tiếp (vd `cat-1`, `cat-2`...) — xem mục 5.1 về cách sinh mã. |
| Tên danh mục | `categoryName` (kèm `description` hiển thị dòng phụ nhỏ màu xám nếu có) | Bắt buộc, không rỗng (validate ở `CategoryFormModal`). |
| Thao tác (Xem/Sửa) | — | "Xem" điều hướng sang `/admin/catalog/categories/:id` (trang chi tiết riêng, gọi thêm API khác — xem mục 6 phụ lục), **không phải** modal. "Sửa" mở lại `CategoryFormModal` ở chế độ `edit`, chỉ hiện khi `canManage`. **Không có nút Xóa** trên màn này (khác với màn "Sản phẩm & thiết bị" — xem mục 5.2 lý do). |

`ItemCategory` có field `categoryCode` (optional, comment "equipment_categories.category_code (schema
mới 2026-07-07, chưa có ở backend hiện tại)") — **không có input tương ứng** trên `CategoryFormModal`
và **không hiển thị** trên bảng chính hay trang chi tiết, nên màn này chưa cần backend trả field đó.

## 2. `GET /api/v1/catalog/categories` — Danh sách (đã có `catalogApiService.getCategories`)

**Query params** (`GetItemCategoriesQuery`, `catalog.service.ts` dòng 29-33 — đã khớp đúng nhu cầu UI,
không cần thêm gì):

| Param | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `search` | string | Không | Tìm theo `categoryName` — khớp placeholder "Tìm theo tên danh mục..." và logic mock (`mockAdapter.ts` dòng 451-452: `LIKE` không phân biệt hoa/thường). Màn này **không có filter theo trạng thái hay field nào khác** ngoài search. |
| `page` | number | Không (default 1) | |
| `limit` | number | Không (default 10) | FE cố định 10 qua `usePagination(10)`. |

**Response 200** (theo đúng shape `ItemCategory[]` + pagination meta chuẩn dùng `totalCount`, khớp
`page.tsx` dòng 49: `res.meta.totalCount`):

```json
{
  "data": [
    { "categoryId": "cat-1", "categoryName": "Bàn ghế", "description": null },
    { "categoryId": "cat-2", "categoryName": "Khăn bàn & Áo ghế", "description": null }
  ],
  "meta": { "page": 1, "limit": 10, "totalCount": 11 }
}
```

**Permission**: Admin, Manager — đọc (đọc danh mục cần cho các màn khác tra cứu, ví dụ filter "Nhóm
sản phẩm" ở `/admin/catalog`, dropdown chọn danh mục khi tạo loại thiết bị...).

---

## 3. Tạo danh mục — đã có `catalogApiService.createCategory`

### `POST /api/v1/catalog/categories`

Dùng cho modal "Tạo danh mục thiết bị" (nút "+ Tạo danh mục").

```json
// Request (CreateItemCategoryPayload, types/catalog.ts dòng 28-31 — khớp đúng 2 trường trên form)
{
  "categoryName": "string, required, not blank",
  "description": "string, optional"
}
```

**Validate tối thiểu (khớp FE `CategoryFormModal`)**: `categoryName` bắt buộc, không rỗng — input có
`required` ở HTML nhưng **FE chưa chặn ở submit handler** (`page.tsx` `handleCreateSubmit` gọi thẳng
API, không tự validate rỗng trước) — backend phải tự validate not-blank, không tin FE.

Không thấy yêu cầu `categoryName` phải unique trên UI (không có thông báo lỗi trùng tên nào được thiết
kế), nhưng **nên** validate unique ở backend để tránh trùng lặp danh mục do nhập nhầm — nếu chốt cần
unique, trả **409 Conflict** kèm message rõ ràng để FE hiển thị vào `errorMessage` của modal (cơ chế lấy
lỗi từ `response.data.message` đã có sẵn ở `getErrorMessage()` cuối `page.tsx`).

**Response 201**: object `ItemCategory` với `categoryId` do backend sinh (xem mục 5.1 — cách sinh mã
**chưa chốt**, cần Product/Backend quyết định).

**Permission**: Admin.

## 4. Sửa danh mục — đã có `catalogApiService.updateCategory`

### `PUT /api/v1/catalog/categories/:id`

Dùng cho modal "Chỉnh sửa danh mục" (icon Sửa trên bảng, hoặc nút "Sửa danh mục" ở trang chi tiết).

```json
// Request (UpdateItemCategoryPayload = CreateItemCategoryPayload, types/catalog.ts dòng 33)
{
  "categoryName": "string, required, not blank",
  "description": "string, optional"
}
```

Cùng validate như mục 3 (not-blank `categoryName`). `categoryId` không nằm trong body, không cho đổi
qua form này (không có input tương ứng).

**Response 200**: object `ItemCategory` đã cập nhật.

**Permission**: Admin.

---

## 5. Vấn đề cần chốt với Backend/Product

### 5.1. Cách sinh `categoryId` — **chưa chốt, cần quyết định**

Dữ liệu mock hiện có (`src/mocks/db/catalog.ts` dòng 44-47) dùng mã tuần tự dạng `cat-1`, `cat-2`... `cat-11`
(khớp đúng ảnh mẫu `cat-1`...`cat-5`). Nhưng khi tạo mới qua mock adapter (`mockAdapter.ts` dòng 458,
hàm `nextId('cat')`), mã sinh ra lại có dạng khác hẳn: `mock-cat-<timestamp36>-<seq>` (vd
`mock-cat-lz3k9f2-7`) — **không cùng format** với 11 danh mục gốc `cat-N`. Đây chỉ là hạn chế tạm thời
của lớp mock (không phải hành vi backend thật), nhưng cần Backend/Product **chốt trước** 1 trong 2
hướng khi implement thật, để tránh lặp lại đúng kiểu lệch pha đã từng xảy ra với `itemId`/`itemCode` ở
`docs/admin_danhmucthietbi_api.md` mục 6.1:

- **Hướng A** — `categoryId` do backend tự sinh tuần tự dạng `cat-N` (tăng dần theo số danh mục hiện
  có), giữ đúng format 11 danh mục mock gốc.
- **Hướng B** — `categoryId` là UUID/mã kỹ thuật nội bộ, không cần đẹp/tuần tự (vì cột "Mã danh mục" chỉ
  mang tính tham chiếu nội bộ, không phải mã nghiệp vụ khách hàng nhìn thấy như `itemCode`/`customerId`).

Khuyến nghị chọn **Hướng A** để nhất quán với dữ liệu demo hiện có và dễ đọc khi debug, nhưng quyết định
cuối cùng cần Backend xác nhận theo khả năng đáp ứng của DB schema thật.

### 5.2. Không có chức năng Xóa danh mục trên UI — cần xác nhận có đúng chủ ý

Khác với màn "Sản phẩm & thiết bị" (`/admin/catalog`, có nút Xóa dùng `PATCH .../status` để đổi
`INACTIVE` — xem `docs/admin_danhmucthietbi_api.md` mục 4), màn danh mục này **không có nút Xóa/Ngừng
hoạt động nào** trên bảng chính lẫn trang chi tiết, dù `types/catalog.ts` đã khai báo sẵn
`UpdateItemCategoryStatusPayload` và `catalogApiService.updateCategoryStatus()`
(`PATCH /catalog/categories/:id/status`) — comment ngay tại type (dòng 35-36) ghi rõ: **"backend hiện là
NO-OP STUB (không có cột `isActive` trên `ItemCategory`), chỉ trả `{success:true}` chứ không đổi gì
thật"**. Tức là:

- Endpoint `PATCH /catalog/categories/:id/status` đã tồn tại ở tầng FE service nhưng **không được gọi ở
  bất kỳ đâu trong UI hiện tại** (không có nút nào trigger nó) — có thể là code thừa từ thiết kế trước,
  hoặc dự định cho tính năng ẩn/hiện danh mục sau này chưa làm UI.
- **Cần Backend/Product xác nhận**: (1) có cần thêm chức năng ẩn/xóa danh mục không (nếu có, phải xử lý
  ràng buộc dữ liệu — danh mục đang được `item_types`/`items` tham chiếu thì không nên xóa cứng, tương tự
  rule "Xóa draft" ở CLAUDE.md mục 1); (2) nếu không cần, nên **bỏ hẳn** `updateCategoryStatus`/
  `UpdateItemCategoryStatusPayload` khỏi code để tránh code chết gây hiểu nhầm có tính năng chưa thực
  sự có.

---

## 6. Phụ lục: trang chi tiết danh mục (`/admin/catalog/categories/:id`)

Icon "Xem" trên bảng chính điều hướng sang trang chi tiết 1 danh mục (`[id]/page.tsx`) — **ngoài phạm
vi chính của tài liệu này** (khác trang, chỉ ghi chú lại vì được truy cập trực tiếp từ màn đang xét).
Trang này **không cần thêm endpoint mới** — dùng lại 4 endpoint đã có sẵn, gọi song song
(`Promise.all`, dòng 61-66):

| Endpoint | Dùng để |
|---|---|
| `GET /catalog/categories/:id` | Thông tin cơ bản danh mục (mã, tên, mô tả). |
| `GET /catalog/types?categoryId=:id&limit=200` | Danh sách loại thiết bị (`ItemType`) thuộc danh mục — dùng để lọc `items` bên dưới. |
| `GET /catalog/items?limit=500` | Toàn bộ item, FE tự lọc theo `typeId` thuộc danh mục (client-side — không gửi `categoryId` trực tiếp cho `items`, xem `docs/admin_danhmucthietbi_api.md` mục 6.2 về hướng lọc theo `categoryId` cho màn khác). |
| `GET /inventory?limit=500` | Tồn kho từng item (`quantityTotal`/`quantityAvailable`/`quantityDamaged`) để tính 3 KPI "Tổng số/Có sẵn/Đang sửa chữa" và cột "Tổng số lượng"/"Có sẵn" trong bảng "Danh sách thiết bị". |

Cách lọc client-side hiện tại (tải toàn bộ `items`/`inventory` với `limit=500` rồi tự lọc theo
`categoryId` ở FE) chỉ hợp lý ở quy mô dữ liệu demo — nếu số lượng item/tồn kho thật lớn hơn nhiều,
nên cân nhắc bổ sung param `categoryId` trực tiếp cho `GET /catalog/items` (backend join qua
`item_types` để lọc theo tầng cha) thay vì kéo hết dữ liệu về lọc tay, nhưng đây là tối ưu hiệu năng
chưa cấp thiết, không thuộc phạm vi chốt của tài liệu này.

## 7. Việc cần làm ở FE khi nối API thật (chưa làm, ghi chú lại)

- Trang list/chi tiết hiện đã gọi thẳng `catalogApiService` (không dùng mock cứng như `MOCK_ITEMS` ở
  `/admin/catalog`) — chỉ cần bật lại kết nối thật cho `catalogApiService` (đang bị chặn qua
  `mockAdapter.ts` trong giai đoạn UI-first).
- Bổ sung validate not-blank `categoryName` ở submit handler (`handleCreateSubmit`/`handleEditSubmit`),
  hiện chỉ dựa vào `required` ở HTML.
- Xử lý lỗi 409 (nếu Backend chốt `categoryName` phải unique — mục 5.1) hiển thị vào `errorMessage` của
  `CategoryFormModal`.
- Xác nhận với Product về mục 5.2 (chức năng Xóa/ẩn danh mục) trước khi quyết định giữ hay bỏ
  `updateCategoryStatus` khỏi `catalog.service.ts`.
