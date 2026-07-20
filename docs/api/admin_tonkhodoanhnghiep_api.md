# API màn "Tồn kho doanh nghiệp" (`/admin/inventory/stock-status`)

> Tài liệu tổng hợp API mà màn **Tồn kho doanh nghiệp** (ảnh mẫu người dùng cung cấp — tiêu đề "Tồn
> kho doanh nghiệp", mô tả phụ "Quản lý số lượng tồn kho sản phẩm và thiết bị trong doanh nghiệp", nút
> "Thiết bị đang bảo trì" góc phải, ô tìm "Tìm kiếm theo ID, tên sản phẩm...", dropdown "Nhóm sản phẩm",
> ngày chọn "20/07/2026", nút "Bộ lọc", bảng `ID`/`TÊN SẢN PHẨM & THIẾT BỊ`/`NHÓM SẢN PHẨM`/
> `TỔNG KHẢ DỤNG`/`SỐ LƯỢNG ĐÃ KHÓA`/`SỐ LƯỢNG HỎNG`/`TỔNG SỐ LƯỢNG`) trên web frontend cần backend
> cung cấp.
>
> Được viết dựa trên:
> - Code FE: `src/app/admin/inventory/stock-status/page.tsx` (trang chính — khớp 100% ảnh mẫu),
>   `src/components/catalog/EquipmentDetailModal.tsx` (modal mở khi bấm tên sản phẩm/icon Xem — chi
>   tiết + form "Điều chỉnh tồn kho" + "Nhật ký biến động kho"), `src/mocks/db/catalog.ts`
>   (`AdminEquipment`, `StockLogType`, `adjustAdminEquipmentStock` — nguồn mock đang dùng tạm trong
>   giai đoạn UI-first, CLAUDE.md mục 0), `src/app/admin/inventory/maintenance/page.tsx` (trang liên
>   kết từ nút "Thiết bị đang bảo trì" — **đã dùng API thật**, xem mục 6), `src/types/inventory.ts` +
>   `src/services/inventory.service.ts` (`InventoryRow`/`inventoryApiService` — model tồn kho thật của
>   backend), `src/types/catalog.ts` + `src/services/catalog.service.ts` (`Item`/`ItemCategory`/
>   `catalogApiService`), `src/services/mockAdapter.ts` (cách mock hiện map `AdminEquipment` →
>   `InventoryRow`, dòng 161-172, 442-446).
> - **Không có MCP truy vấn database khả dụng trong phiên làm việc này** — tài liệu này không tự chạy
>   `SHOW CREATE TABLE`. Dùng lại căn cứ gián tiếp trong repo: comment đầu `src/types/inventory.ts`
>   ("Inventory giờ khoá 1-1 theo itemId duy nhất", đối chiếu `prisma/schema.prisma` backend ngày
>   2026-07-06) và comment đầu `src/types/catalog.ts` (schema Category→Type→Item, cộng schema mới hơn
>   `equipment_categories`→`equipment_type_details`→`equipment_type_configs`→`catalog_items` phát hiện
>   thêm ngày 2026-07-07, backend hiện tại **chưa** có model/route cho 2 tầng dưới cùng).
>
> **Lưu ý quan trọng nhất**: trang này ở FE hiện **không gọi bất kỳ service/API nào** — toàn bộ dữ liệu
> lấy trực tiếp từ mock `AdminEquipment` (`src/mocks/db/catalog.ts`) và số liệu "Tổng khả dụng"/"Số
> lượng đã khóa" theo ngày chọn được **mô phỏng bằng công thức seed giả** (`getSimulatedStockForDate()`,
> `page.tsx` dòng 34-64) chứ không phải tồn kho khóa thật theo ngày — vì tính năng "Date-based Inventory
> Lock" theo ngày (CLAUDE.md mục "Vòng đời Order") **chưa được backend implement**. Tài liệu này đặc tả
> API cho đúng nhu cầu hiển thị/thao tác của màn hình, đồng thời nêu rõ ở mục 7 phần nào cần chốt thêm
> trước khi FE nối API thật.

## 0. Base URL & Auth

- Base path: `/api/v1/inventory` (đã có `inventoryApiService`) và `/api/v1/catalog` (đã có
  `catalogApiService`) — không cần base path mới.
- **Quyền — đã chốt (mục 7.1)**: Admin **được phép** điều chỉnh tồn kho trên màn này, nhưng phạm vi ghi
  bị giới hạn đúng 1 field — `quantityTotal` (Tổng số lượng), tương đương hành động "thêm/sửa thiết bị
  trong kho" (master-data-adjacent, không phải vận hành Order hằng ngày, nên không mâu thuẫn với ranh
  giới "Admin không xử lý vận hành hằng ngày" ở CLAUDE.md mục "Vai trò & phân quyền"). 3 field còn lại
  (`quantityAvailable`, `quantityReserved`, `quantityDamaged`) **do hệ thống tự tính toán** từ các luồng
  vận hành khác (xuất kho theo Order, xác nhận thu hồi/hỏng-mất qua `return-reports`...) — **không**
  nhận input tay từ Admin trên màn này, xem mục 4. Theo `usePermission()`: đọc (`GET /inventory`,
  `GET /inventory/movements`) mở cho cả Admin và Manager; ghi (`POST /inventory/adjust`, giới hạn
  `quantityTotal`) yêu cầu permission riêng (vd `inventory:adjust-total`, hiện **chưa có** trong
  `src/constants/permissions.ts` — cần bổ sung).

## 1. Field bảng chính → mapping `InventoryRow` (`types/inventory.ts`) + `Item` (`types/catalog.ts`)

| Cột UI | Field FE hiện dùng (`AdminEquipment`, mock) | Field backend thật tương ứng | Ghi chú |
|---|---|---|---|
| ID | `id` (vd `BG001`) | `Item.itemCode` hoặc `Item.itemId` | Xem mục 7.2 — mock dùng mã gợi nhớ theo danh mục (`BG001`), backend thật `itemCode` có thể khác format, cần đối chiếu `docs/admin_danhmucthietbi_api.md` mục sinh mã. |
| Tên sản phẩm & thiết bị | `name` (link mở modal chi tiết) | `Item.itemName` | |
| Nhóm sản phẩm | `category` (tên hiển thị trực tiếp) | `Item.typeName` hoặc join `ItemCategory.categoryName` qua `typeId` | Dropdown filter "Nhóm sản phẩm" trên UI lọc theo **tên category cấp cao nhất** (11 danh mục, vd "Bàn ghế"), không phải theo `typeId` — nếu 1 category có nhiều type khác nhau, BE cần trả kèm `categoryId`/`categoryName` join sẵn trong response `GET /inventory` (hiện `InventoryRow` **chưa có** field này, chỉ có `itemId`/`itemName`) để FE không phải gọi thêm API tra cứu category theo từng item. |
| Tổng khả dụng | `availableStock` (đã mô phỏng theo ngày, xem cảnh báo ở trên) | `InventoryRow.quantityAvailable` — **field tính toán**, backend tự suy ra (không nhận input tay, mục 0/4) | Backend thật **không có khái niệm theo ngày** — trả đúng tồn kho khả dụng hiện tại (không phải theo ngày chọn trên UI). Đã chốt Hướng B ở mục 7.3: bỏ ý nghĩa "theo ngày", ô ngày trên UI không gửi lên BE. |
| Số lượng đã khóa | `rentedStock` (đang đi tiệc — đã mô phỏng theo ngày) | `InventoryRow.quantityReserved` — **field tính toán**, hệ thống tự cập nhật khi Order xuất kho (không nhận input tay, mục 0/4) | Mock adapter hiện tại (`mockAdapter.ts` dòng 171) đang **hard-code `quantityReserved: 0`**, không đọc từ `rentedStock` — lệch với UI đang hiển thị số > 0. Không còn ý nghĩa theo ngày sau khi chốt Hướng B ở mục 7.3. |
| Số lượng hỏng | `maintenanceStock` | `InventoryRow.quantityDamaged` — **field tính toán**, hệ thống tự cập nhật khi xác nhận `return-reports` (không nhận input tay, mục 0/4) | Đã khớp đúng (`mockAdapter.ts` dòng 161-172 đọc thật từ `maintenanceStock`). |
| Tổng số lượng | `totalStock` | `InventoryRow.quantityTotal` — **field duy nhất Admin được sửa tay trên màn này** (mục 0/4) | |
| Thao tác (Xem/Tùy chọn) | — | — | Cả 2 icon đều mở lại modal chi tiết (`EquipmentDetailModal`) — không có hành động riêng biệt nào khác, xem mục 3. |

## 2. `GET /api/v1/inventory` — Danh sách (đã có `inventoryApiService.getInventory`)

**Query params hiện có** (`GetInventoryQuery`, `types/inventory.ts` dòng 18-22):

| Param | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `itemId` | string | Không | Lọc theo 1 item — **không đủ** cho nhu cầu search theo ID/tên và filter theo nhóm sản phẩm của màn này, cần bổ sung param mới (xem dưới). |
| `page` | number | Không | |
| `limit` | number | Không | Trang "Bảo trì" liên kết đang gọi `limit: 500` để tải hết 1 lần (`maintenance/page.tsx` dòng 31) — trang này khả năng cũng cần tải hết vì Table hiện tại **không phân trang server-side** (không dùng `usePagination`, chỉ filter client-side). |

**Param cần bổ sung để khớp đúng UI** (hiện `GetInventoryQuery` chưa có):

| Param mới | Kiểu | Mô tả |
|---|---|---|
| `search` | string | Tìm theo `itemId`/`itemCode`/`itemName` — khớp placeholder "Tìm kiếm theo ID, tên sản phẩm...". |
| `categoryId` (hoặc `typeId`) | string | Khớp dropdown "Nhóm sản phẩm" — cần backend join `Item.typeId` → `ItemCategory` để lọc được theo category cấp cao nhất (xem mục 1). |
| `onlyDamaged` | boolean | Khớp checkbox "Chỉ hiển thị sản phẩm đang có hàng hỏng / bảo trì" trong khối "Bộ lọc" mở rộng — tương đương `quantityDamaged > 0` (FE có thể tự lọc client-side nếu đã tải hết, nhưng nên hỗ trợ ở BE nếu dữ liệu lớn không tải hết được nữa). |

**`asOfDate` — đã chốt KHÔNG thêm param này** (mục 7.3, Hướng B): tính năng khóa kho theo ngày chưa được
ưu tiên ở giai đoạn kế tiếp, `GET /inventory` luôn trả tồn kho hiện tại bất kể ngày chọn trên UI. Ô chọn
ngày trên UI giữ lại nhưng **không gửi lên BE** — xem mục 8 việc FE cần làm khi nối API thật.

**Response 200** (theo đúng shape `InventoryRow[]` hiện có, bổ sung `categoryId`/`categoryName` theo đề
xuất mục 1):

```json
{
  "data": [
    {
      "inventoryId": "inv-BG001",
      "itemId": "BG001",
      "itemName": "Bàn loại to (Hộp chữ nhật 1.8m x 0.9m)",
      "categoryId": "cat-1",
      "categoryName": "Bàn ghế",
      "quantityTotal": 80,
      "quantityAvailable": 46,
      "quantityReserved": 34,
      "quantityDamaged": 0,
      "updatedAt": "2026-07-20T00:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 500, "totalCount": 71 }
}
```

**Permission**: Admin, Manager — đọc.

---

## 3. Chi tiết 1 thiết bị (mở modal khi bấm tên sản phẩm hoặc icon Xem/Tùy chọn)

`EquipmentDetailModal` hiển thị các field **hoàn toàn không có** trong `Item`/`InventoryRow` hiện tại:
`price` (đơn giá — thật ra đã có `Item.rentalPrice`), `replacementValue` (giá trị đền bù), `dimensions`
(kích thước), `material` (chất liệu), `specs` (mô tả kỹ thuật), `location` (vị trí kho), `unit` (đã có
`Item.unit`).

**Đề xuất**: `GET /api/v1/catalog/items/:id` (đã có `catalogApiService`, dùng chung item detail) trả
kèm các field mở rộng — nhưng theo comment đầu `types/catalog.ts`, các field vật lý này (`dimensions`,
`material`, `specs`, `location`, `replacementValue`) **chưa từng xuất hiện** trong bất kỳ schema Prisma
nào đã phát hiện (kể cả schema mới `catalog_items`/`equipment_type_configs`).

**Đã chốt hướng xử lý (mục 7.4)**:

- `replacementValue` (giá trị đền bù) → **dùng lại `Item.purchasePrice`** (đã khai báo sẵn ở
  `types/catalog.ts` dòng 107), **không** thêm field `replacementValue` riêng — đúng 1 nguồn duy nhất
  cho quy tắc "Đền bù thiết bị hỏng/mất = Giá mua × Số lượng" (CLAUDE.md mục "Quy tắc nghiệp vụ cốt
  lõi"). Backend cần đảm bảo `purchasePrice` luôn được trả (hiện field đã khai báo nhưng "chưa chắc
  backend trả").
- `specs` (mô tả kỹ thuật) → **dùng lại `Item.description`** (fallback `typeDetailDescription` khi
  trống, theo `src/utils/catalogItemContent.ts` đã có sẵn), **không** thêm field `specs` riêng trùng ý
  nghĩa.
- `dimensions`, `material`, `location` (vị trí kho) → **không có field tương đương**, cần Backend bổ
  sung cột thật (vd trên `catalog_items`, hoặc bảng phụ nếu không muốn phình bảng chính) — đặc biệt
  `location` có giá trị vận hành thật (nhân viên kho cần biết vị trí lấy hàng). Trong lúc chờ Backend bổ
  sung, FE tiếp tục dùng mock cho 3 field này và cần đối chiếu CLAUDE.md mục 4 (mock data — hiện đang
  tạm ngưng bắt buộc theo mục 0 của CLAUDE.md ở giai đoạn UI-first, nhưng nên áp dụng lại ngay khi màn
  này bắt đầu nối API thật).

**Response 200 đề xuất** (gộp `Item` + `InventoryRow` cho 1 item, vì modal cần cả giá lẫn tồn kho):

```json
{
  "itemId": "BG001",
  "itemCode": "BG001",
  "itemName": "Bàn loại to (Hộp chữ nhật 1.8m x 0.9m)",
  "typeId": "type-cat-1",
  "typeName": "Bàn ghế",
  "unit": "Cái",
  "rentalPrice": 150000,
  "purchasePrice": 1200000,
  "status": "ACTIVE",
  "description": "Mặt gỗ MDF phủ melamine chống nước, chân sắt gập tiện lợi",
  "inventory": {
    "quantityTotal": 80,
    "quantityAvailable": 46,
    "quantityReserved": 34,
    "quantityDamaged": 0
  },
  "createdAt": "2026-07-11T00:00:00.000Z",
  "updatedAt": "2026-07-11T00:00:00.000Z"
}
```

**Permission**: Admin, Manager — đọc.

---

## 4. `POST /api/v1/inventory/adjust` — Ghi nhận điều chỉnh tồn kho (đã có `inventoryApiService.adjustInventory`)

**Đã chốt phạm vi (mục 7.1 + 7.5)**: trên màn "Tồn kho doanh nghiệp", Admin **chỉ** được sửa
`quantityTotal` (Tổng số lượng) — tương đương "thêm/sửa thiết bị trong kho". `quantityAvailable`/
`quantityReserved`/`quantityDamaged` **do hệ thống tự tính**, không nhận input tay ở đây.

Form "Điều chỉnh tồn kho" trong modal mock hiện có 4 loại (`StockLogType`, `mocks/db/catalog.ts` dòng
70): `nhap_kho` (Nhập kho), `xuat_kho` (Xuất kho đi tiệc), `bao_tri` (Đưa đi bảo trì), `dieu_chinh`
(Điều chỉnh kiểm kê). Theo phạm vi vừa chốt, **chỉ 2/4 loại còn thuộc màn hình này**:

| Loại | Còn giữ trên màn Admin? | Lý do |
|---|---|---|
| `nhap_kho` (Nhập kho) | **Giữ** | Tăng `quantityTotal` (và `quantityAvailable` đi kèm) — đúng nghĩa "thêm số lượng thiết bị". |
| `dieu_chinh` (Điều chỉnh kiểm kê) | **Giữ** | Tăng/giảm `quantityTotal` (và `quantityAvailable` đi kèm) khi kiểm kê phát hiện lệch số — cùng công thức với `nhap_kho`, chỉ khác validate UI (cho phép số âm). |
| `xuat_kho` (Xuất kho đi tiệc) | **Bỏ khỏi màn này** | Đổi `quantityReserved` (field hệ thống tự tính, mục 0) — thuộc luồng xuất kho theo Order thật (Pick-list xuất kho, CLAUDE.md mục "Điều phối nhân sự & phương tiện"), không phải hành động Admin nhập tay trên màn tồn kho. |
| `bao_tri` (Đưa đi bảo trì) | **Bỏ khỏi màn này** | Đổi `quantityDamaged` (field hệ thống tự tính, mục 0) — thuộc luồng xác nhận thu hồi/hỏng-mất (`inventoryApiService.confirmReturnReport`, `PUT /inventory/return-reports/:id/confirm` **đã có sẵn**), do Leader Staff ghi nhận + Manager xác nhận, không phải Admin nhập tay ở đây. |

Vì cả 2 loại còn lại (`nhap_kho`, `dieu_chinh`) dùng **chung 1 công thức** (`quantityAvailable += qty`,
`quantityTotal += qty`, chỉ khác ràng buộc dấu ở validate UI), payload hiện có của
`AdjustInventoryPayload` (`types/inventory.ts` dòng 25-29) **đã đủ dùng**, không cần thêm field
`adjustmentType`:

```json
{
  "itemId": "string, required",
  "quantityChange": "number, required — dương khi Nhập kho; dương/âm khi Điều chỉnh kiểm kê",
  "notes": "string, optional — FE gửi kèm nhãn loại (vd 'Nhập kho: <lý do>' / 'Điều chỉnh kiểm kê: <lý do>') để phân biệt trên Nhật ký biến động (mục 5)"
}
```

Backend áp dụng: `quantityAvailable += quantityChange`, `quantityTotal += quantityChange` (khớp đúng
case `nhap_kho`/`dieu_chinh` trong mock `adjustAdminEquipmentStock`). Cần validate `quantityTotal` sau
khi cộng không được nhỏ hơn `quantityReserved + quantityDamaged` hiện tại (không thể giảm tổng xuống
dưới phần đã bị khóa/hỏng).

**Response 200**: `InventoryRow` đã cập nhật (giống response mục 3, phần `inventory`).

**Permission**: Admin, Manager — ghi (giới hạn `quantityTotal`, theo permission `inventory:adjust-total`
đề xuất ở mục 0).

---

## 5. `GET /api/v1/inventory/movements` — Nhật ký biến động kho (đã có `inventoryApiService.getMovements`)

Danh sách "Nhật ký biến động kho" trong modal chi tiết (`EquipmentDetailModal` — hiển thị `time`,
`type`, `quantity`, `reason`, `reference` từ `StockLog`) map sang `InventoryMovement`
(`types/inventory.ts` dòng 34-46):

| Field UI (`StockLog`) | Field backend (`InventoryMovement`) | Ghi chú |
|---|---|---|
| `time` | `createdAt` | |
| `type` (4 giá trị `StockLogType`) | `movementType` (3 giá trị `MovementType`: `OUTBOUND`/`INBOUND`/`ADJUSTMENT`) | **Không còn lệch sau khi chốt mục 4**: `nhap_kho`/`dieu_chinh` (2 loại Admin còn thao tác trên màn này) map thẳng `INBOUND`/`ADJUSTMENT`. `xuat_kho` map `OUTBOUND` — sinh ra từ luồng Order/Pick-list xuất kho thật, không phải từ endpoint mục 4. `bao_tri` (đưa đi bảo trì) không còn là hành động trên màn hình này (mục 4) — log tương ứng nên sinh ra từ luồng `confirmReturnReport` (đã có sẵn), không cần bổ sung `MAINTENANCE` vào `MovementType` cho phạm vi tài liệu này; nếu Backend muốn phân biệt rõ "hỏng do thu hồi" trong log, có thể coi đó là 1 dạng `ADJUSTMENT` kèm `reportId`. |
| `quantity` | `quantity` | |
| `reason` | `notes` | |
| `reference` (vd `HD2507-003`, `PN-2607-01`) | `orderId` hoặc `reportId` | `InventoryMovement` đã có sẵn 2 field tham chiếu polymorphic-ish này — khớp đúng pattern `entity_type/entity_id` nêu ở CLAUDE.md mục "Pattern dữ liệu cần tái sử dụng", nhưng `reference` trên UI mock đôi khi là text tự do không phải ID thật (vd "Điều chỉnh thủ công", "Kiểm tra định kỳ") — cần xác nhận backend có field `notes`/free-text riêng cho case không gắn Order/report nào không, hay bắt buộc phải có 1 trong 2 FK. |

**Query params đã có** (`GetInventoryMovementsQuery`): `itemId`, `movementType`, `page`, `limit` — đủ
dùng cho modal (lọc theo `itemId` đang xem).

**Permission**: Admin, Manager — đọc.

---

## 6. Nút "Thiết bị đang bảo trì" — đã dùng API thật, không cần thêm gì

Khác với trang chính, `/admin/inventory/maintenance` (trang đích của nút góc phải) **đã gọi thẳng**
`inventoryApiService.getInventory({ limit: 500 })` và tự lọc `quantityDamaged > 0` ở client — không
phải mock cứng. Không nằm trong phạm vi cần đặc tả thêm của tài liệu này, chỉ ghi chú lại vì được liên
kết trực tiếp từ màn đang xét. Nếu mục 2 bổ sung param `onlyDamaged`, nên cân nhắc cho cả trang này dùng
lại thay vì tải 500 dòng rồi lọc tay.

---

## 7. Quyết định đã chốt (trao đổi với Product 2026-07-20)

Các mục dưới đây trước là câu hỏi mở, nay đã có quyết định — nội dung tương ứng ở mục 0/1/2/3/4/5 phía
trên đã cập nhật theo, phần này giữ lại làm nhật ký quyết định (audit trail) để backend/tester tra cứu
lại lý do.

### 7.1. Admin có được phép điều chỉnh tồn kho trực tiếp không? — **Đã chốt: có, giới hạn `quantityTotal`**

**Quyết định**: Admin được phép điều chỉnh tồn kho trực tiếp, tương đương hành động "thêm/sửa thiết bị
trong kho" — nhưng **chỉ được sửa Tổng số lượng** (`quantityTotal`). 3 field còn lại
(`quantityAvailable`/`quantityReserved`/`quantityDamaged`) do hệ thống tự tính toán, **không** nhận input
tay từ Admin. Quyết định này giải quyết luôn mâu thuẫn nêu ra trước đó với ranh giới "Admin không xử lý
vận hành hằng ngày" (CLAUDE.md mục "Vai trò & phân quyền") — vì hành động còn lại đúng nghĩa là sửa
master data (số lượng sở hữu), không phải vận hành Order. Áp dụng cụ thể ở mục 0, 1, 4.

### 7.2. Format `itemId`/`itemCode` cho thiết bị — **Đã chốt (kế thừa quyết định có sẵn)**

Áp dụng nguyên quyết định **Hướng 2** đã chốt ở `docs/admin_danhmucthietbi_api.md` mục 6.1: `itemCode`
do Admin nhập tay khi tạo thiết bị **chính là** `itemId`/PK luôn (không sinh mã riêng ở backend), backend
validate unique (409 Conflict nếu trùng). Màn "Tồn kho doanh nghiệp" chỉ **đọc** cột "ID" theo đúng giá
trị `itemId` này (vd `BG001`, `KB001`...), không có logic sinh mã riêng nào khác cho màn hình này.

### 7.3. Date-based Inventory Lock (ô chọn ngày) — **Đã chốt: Hướng B, bỏ bớt phạm vi**

**Quyết định**: chọn **Hướng B** — `GET /inventory` luôn trả tồn kho hiện tại, **không** nhận `asOfDate`.
Ô chọn ngày vẫn giữ trên UI (đúng ảnh mẫu) nhưng chỉ mang tính hiển thị/chuẩn bị cho tính năng báo cáo
kỳ trong tương lai, **không gửi giá trị lên backend** ở giai đoạn kế tiếp. Tính năng khóa kho thật theo
từng ngày sự kiện (bảng `inventory_daily_locks`, tham số `asOfDate`) chỉ triển khai sau khi luồng
Order/xác nhận cọc thật đã có (ngoài phạm vi màn hình này), tránh làm 2 lần. Áp dụng cụ thể ở mục 1, 2.

### 7.4. Các field vật lý thiết bị (`location`, `dimensions`, `material`, `specs`, `replacementValue`) — **Đã chốt hướng gộp field, còn 3 field cần Backend bổ sung cột**

**Quyết định**:
- `replacementValue` → dùng lại `Item.purchasePrice` (đã có sẵn), không thêm field riêng.
- `specs` → dùng lại `Item.description`/`typeDetailDescription`, không thêm field riêng.
- `location`, `dimensions`, `material` → chưa có cột tương ứng trong bất kỳ schema đã phát hiện —
  **Backend cần bổ sung cột thật** (ưu tiên `location` vì có giá trị vận hành rõ nhất: nhân viên kho cần
  biết vị trí lấy hàng). Cho tới khi bổ sung xong, FE tiếp tục hiển thị mock cho 3 field này. Áp dụng cụ
  thể ở mục 3.

### 7.5. Chuẩn hóa `POST /inventory/adjust` cho đủ loại điều chỉnh — **Đã chốt: thu hẹp còn 2 loại, không cần đổi payload**

Hệ quả trực tiếp của quyết định 7.1 (Admin chỉ sửa `quantityTotal`): trong 4 loại điều chỉnh mock cũ,
chỉ `nhap_kho` và `dieu_chinh` còn thuộc phạm vi màn hình này (cùng công thức cộng/trừ `quantityTotal` +
`quantityAvailable`) — `xuat_kho`/`bao_tri` thuộc luồng khác (Order xuất kho, xác nhận thu hồi/hỏng-mất
qua `return-reports`). Vì vậy **không cần** mở rộng `AdjustInventoryPayload` hay tách endpoint mới —
payload `{ itemId, quantityChange, notes }` hiện có đã đủ dùng. Áp dụng cụ thể ở mục 4, 5.

---

## 8. Việc cần làm ở FE khi nối API thật (chưa làm, ghi chú lại)

- Thay toàn bộ nguồn dữ liệu từ `src/mocks/db/catalog.ts` sang gọi `inventoryApiService.getInventory` +
  `catalogApiService` thật, bỏ hàm `getSimulatedStockForDate()` — theo Hướng B đã chốt (mục 7.3), **không**
  gửi ngày chọn lên backend, `GET /inventory` luôn trả tồn kho hiện tại; ô chọn ngày trên UI giữ nguyên
  vị trí nhưng không còn ảnh hưởng số liệu hiển thị.
- Thêm `search`/`categoryId`/`onlyDamaged` vào `GetInventoryQuery` sau khi Backend bổ sung (mục 2).
- Sửa `EquipmentDetailModal` để gọi `GET /catalog/items/:id` lấy chi tiết thay vì đọc thẳng object
  `AdminEquipment` đã có sẵn trong state, và gọi `inventoryApiService.getMovements({ itemId })` cho
  phần "Nhật ký biến động kho" thay vì đọc `equipment.logs`. Map `replacementValue` → `purchasePrice`,
  `specs` → `description` (mục 7.4) khi đổ dữ liệu vào modal.
- **Bớt 2 lựa chọn khỏi dropdown "Loại điều chỉnh"** trong form "Điều chỉnh tồn kho": bỏ "Xuất kho (đi
  tiệc)" và "Đưa đi bảo trì" (không còn thuộc phạm vi Admin thao tác tay trên màn này, mục 7.5) — chỉ
  giữ "Nhập kho" và "Điều chỉnh kiểm kê", đổi nhãn nếu cần cho rõ là đang sửa Tổng số lượng. Nối 2 lựa
  chọn còn lại với `inventoryApiService.adjustInventory` (payload không đổi, mục 4); xử lý riêng 403 nếu
  role gọi API không có permission `inventory:adjust-total` (mục 0).
- Cân nhắc thêm `usePagination` nếu Backend không cho tải hết `limit=500` một lần khi dữ liệu tồn kho
  thật lớn hơn nhiều so với 71 item mock hiện tại.
