# API cho modal "Tạo thiết bị mới" (`/admin/catalog`)

> Phạm vi tài liệu này: **chỉ** modal "Tạo thiết bị mới" (ảnh mẫu người dùng cung cấp — 6 trường Mã
> thiết bị/Tên thiết bị/Nhóm sản phẩm/Đơn vị tính/Mô tả/Đơn giá thuê) mở từ nút "+ Tạo sản phẩm" trên
> trang **Sản phẩm & thiết bị** (`/admin/catalog`). Đây là tài liệu rút gọn, tập trung riêng cho 1
> luồng tạo mới — phần phân tích đầy đủ cả trang (bảng danh sách, filter, sửa, xóa/đổi trạng thái,
> modal chi tiết) đã có sẵn ở [`docs/admin_danhmucthietbi_api.md`](admin_danhmucthietbi_api.md), đặc
> biệt mục 3.1 (đúng endpoint tạo mới) và mục 6/7 (các quyết định đã chốt với Product ngày
> **2026-07-20**) — tài liệu này tham chiếu lại thay vì lặp lại toàn bộ, chỉ trình bày đủ để đưa thẳng
> cho backend implement riêng phần tạo mới.

Nguồn tham chiếu:
- FE: `src/components/catalog/CatalogItemFormModal.tsx` (form — khớp đúng 6 trường trong ảnh mẫu,
  không phải `EquipmentFormModal.tsx` là form khác nhiều trường hơn dùng ở chỗ khác), `src/app/admin/catalog/page.tsx`
  (`handleCreateSubmit`, nút "+ Tạo sản phẩm" dòng 242-246), `src/types/catalog.ts`
  (`CreateItemPayload`, `Item`), `src/services/catalog.service.ts` (`catalogApiService.createItem` —
  **đã implement sẵn ở tầng FE**, chỉ đang bị chặn gọi thật vì trang còn dùng mock, xem mục 4).
- **Không có MCP truy vấn database khả dụng trong phiên làm việc này** — tài liệu này không tự chạy
  lại `SHOW CREATE TABLE`. Dùng lại 2 nguồn gián tiếp đáng tin cậy đã có sẵn trong repo: comment đầu
  `src/types/catalog.ts` (đối chiếu `prisma/schema.prisma` backend ngày 2026-07-06) và
  [`docs/thietbikhohang_api.md`](thietbikhohang_api.md) (đối chiếu trực tiếp qua MySQL MCP ngày
  **2026-07-20** — `SHOW CREATE TABLE items/item_types/item_categories/...`, xác nhận kiến trúc thật
  3 tầng `item_categories → item_types → items`, không có bảng `equipment`/`inventory` riêng).

## 0. Base URL & Auth

- Base path: `/api/v1/catalog`, JWT Bearer theo `AuthContext` hiện có — không cần base path mới.
- **Permission**: chỉ **Admin** thấy nút "+ Tạo sản phẩm" (`canManage = can('master-data:manage')`,
  `page.tsx` dòng 241) — khớp CLAUDE.md mục "Vai trò & phân quyền" (Admin quản lý master data).
  Backend **phải chặn ở tầng API** (403 nếu role không có `master-data:manage`), không chỉ ẩn nút ở
  FE.

## 1. Field trên form → mapping request

| Trường trên UI | Field FE (`CatalogItemFormValues`) | Bắt buộc | Ghi chú |
|---|---|---|---|
| Mã thiết bị | `itemCode` | Có | Nhập tay, **dùng luôn làm `itemId`/PK** (đã chốt Hướng 2 ở `docs/admin_danhmucthietbi_api.md` mục 6.1) — không sinh mã riêng ở backend. Input có `required` nhưng FE **chưa chặn rỗng ở submit handler** (`CatalogItemFormModal.tsx` dòng 100-107) — backend phải tự validate not-blank. |
| Tên thiết bị | `itemName` | Có | Text tự do, cùng lỗ hổng validate như trên (`required` chỉ ở HTML, chưa chặn ở submit) — backend validate not-blank. |
| Nhóm sản phẩm | `typeId` | Có | Dropdown lấy từ `GET /api/v1/catalog/types` (đã có sẵn, không cần thêm) — FE validate rỗng ở submit (`CatalogItemFormModal.tsx` dòng 78-81, báo lỗi "Vui lòng chọn loại thiết bị"). |
| Đơn vị tính | `unit` | Có | Text tự do (vd "Cái", "Bộ", "Tấm"), giá trị mặc định gợi ý "Cái". Cùng lỗ hổng validate not-blank như `itemCode`/`itemName`. |
| Mô tả | `description` | Không | Text tự do, có thể để trống. |
| Đơn giá thuê | `rentalPrice` | Có | Number, FE validate `> 0` ở submit (`CatalogItemFormModal.tsx` dòng 74-77, báo lỗi "Đơn giá thuê phải lớn hơn 0") — backend cần validate lại phía server, không chỉ tin FE. |

## 2. `POST /api/v1/catalog/items`

Request (`CreateItemPayload`, `types/catalog.ts` dòng 121-131 — chỉ dùng 5/8 field khai báo, 3 field
còn lại `priceValidFrom`/`imageUrl`/`status` không có input tương ứng trên modal này nên không gửi):

```json
{
  "itemCode": "BG004",
  "itemName": "Bàn tròn 10 người",
  "typeId": "type-cat-1",
  "unit": "Cái",
  "description": "",
  "rentalPrice": 180000
}
```

**Validate tối thiểu ở backend** (khớp FE nhưng phải tự làm lại, không tin client):
- `itemCode`, `itemName`, `unit`: bắt buộc, not-blank.
- `itemCode`: phải **unique** — trả **409 Conflict** nếu trùng mã đã tồn tại (vì `itemCode` dùng trực
  tiếp làm `itemId`/PK, không có tầng sinh mã riêng để tự tránh trùng như UUID).
- `typeId`: bắt buộc, phải tồn tại trong `item_types` (400 nếu không tìm thấy).
- `rentalPrice`: bắt buộc, number `> 0`.

**Response 201** — trả object `Item` đầy đủ (`types/catalog.ts` dòng 99-119):

```json
{
  "itemId": "BG004",
  "itemCode": "BG004",
  "itemName": "Bàn tròn 10 người",
  "typeId": "type-cat-1",
  "typeName": "Bàn ghế",
  "description": "",
  "unit": "Cái",
  "rentalPrice": 180000,
  "status": "ACTIVE",
  "inventory": { "quantityTotal": 0, "quantityAvailable": 0 },
  "createdAt": "2026-07-20T00:00:00.000Z",
  "updatedAt": "2026-07-20T00:00:00.000Z"
}
```

- `itemId === itemCode` (giá trị user vừa nhập, không có mã nào khác được backend sinh thêm).
- `status` mặc định `"ACTIVE"` — modal này không có trường chọn trạng thái.
- `inventory` mặc định `{ quantityTotal: 0, quantityAvailable: 0 }` — sản phẩm mới tạo chưa có tồn
  kho, nhập kho là luồng riêng khác, ngoài phạm vi modal này.

**Response lỗi**:
- `409 Conflict` — `itemCode` đã tồn tại.
- `400 Bad Request` — thiếu field bắt buộc, `rentalPrice <= 0`, hoặc `typeId` không tồn tại.

**Permission**: chỉ Admin (`master-data:manage`) — 403 nếu role khác gọi.

## 3. Endpoint phụ thuộc (đã có sẵn, chỉ tham chiếu)

Dropdown "Nhóm sản phẩm" trên form cần danh sách type — dùng luôn `GET /api/v1/catalog/types` đã có
sẵn trong `catalogApiService.getTypes()`, không cần thêm endpoint mới cho modal này.

## 4. Trạng thái hiện tại ở FE (chưa nối API thật)

`page.tsx` (dòng 40-43) đang dùng mock cố định (`MOCK_ITEMS`/`MOCK_TYPES`) thay vì gọi
`catalogApiService.createItem` thật — submit modal chỉ cập nhật state cục bộ (`handleCreateSubmit`,
dòng 106-125), sinh `itemId` tạm bằng `nextMockItemId()` (`SP004`, `SP005`...) thay vì dùng thẳng
`itemCode` user nhập. Khi backend triển khai xong endpoint ở mục 2, FE cần đổi lại theo checklist đã
ghi ở `docs/admin_danhmucthietbi_api.md` mục 8 (bỏ `nextMockItemId()`, gọi `catalogApiService.createItem`
thật, xử lý lỗi 409 hiển thị vào `errorMessage` của `CatalogItemFormModal`).
