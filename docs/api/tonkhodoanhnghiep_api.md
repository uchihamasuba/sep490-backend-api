# API cho màn "Tồn kho doanh nghiệp"

> Phạm vi tài liệu này: 2 trang **mirror** `/manager/inventory/stock-check` (Manager) và
> `/admin/inventory/stock-status` (Admin) — 2 file gần như y hệt nhau (chỉ khác tên hàm/tiêu đề
> class), gồm bảng chính "Danh sách tồn kho doanh nghiệp" + modal chi tiết thiết bị
> (`EquipmentDetailModal`: khối "Tồn kho hiện tại", form "Điều chỉnh tồn kho", "Nhật ký biến động
> kho"). Đây là ảnh mẫu người dùng cung cấp cho tài liệu này.
>
> **Không** bao gồm:
> - Trang "Thiết bị đang bảo trì" (`/admin/inventory/maintenance`, mở từ nút góc phải màn này) — trang
>   riêng, **đã code sẵn gọi API thật** `inventoryApiService.getInventory()` (không phải mock), nêu lại
>   ở mục 0/6 vì cùng phụ thuộc bảng `inventory` chưa tồn tại trong DB.
> - "Xuất kho" (`/admin/inventory/outbound`), "Pick-list xuất kho", "Thu hồi & hoàn kho" — các trang
>   khác trong cùng nhóm menu "Tồn kho" ở sidebar nhưng là luồng nghiệp vụ riêng (xuất kho theo đơn,
>   thu hồi sau sự kiện), cần tài liệu API riêng khi tới lượt.
> - Tab "Thiết bị & Kho hàng" của trang chi tiết 1 đơn đặt — đã có tài liệu riêng
>   [`docs/thietbikhohang_api.md`](thietbikhohang_api.md).
>
> **Nguyên tắc áp dụng cho tài liệu này**: những chỗ cần **sửa/thêm schema DB** (bảng mới, cột mới)
> được ghi lại ở [`docs/more-require.md`](more-require.md) mục (b) — chưa coi là việc backend cần làm
> ngay trong phạm vi tài liệu này. Tài liệu này chỉ định nghĩa **hợp đồng API** (request/response,
> endpoint, công thức tính) với **giả định schema ở mục (b) đã tồn tại** — khi Backend hoàn tất mục (b),
> implement thẳng theo mô tả dưới đây, không cần đổi lại tài liệu.
>
> Nguồn tham chiếu:
> - FE: `src/app/manager/inventory/stock-check/page.tsx`, `src/app/admin/inventory/stock-status/page.tsx`
>   (2 file mirror), `src/components/catalog/EquipmentDetailModal.tsx`, `src/mocks/db/catalog.ts`
>   (nguồn mock `AdminEquipment`/`StockLog`/`adjustAdminEquipmentStock`/`STOCK_LOG_TYPE_META`),
>   `src/app/admin/inventory/maintenance/page.tsx` (đã gọi API thật, không phải mock),
>   `src/types/catalog.ts`, `src/types/inventory.ts`, `src/services/inventory.service.ts`.
> - DB thật: đối chiếu trực tiếp qua MySQL MCP ngày 2026-07-20 — `SHOW TABLES` (25 bảng kể cả
>   `_prisma_migrations`, **không có** `inventory`/`inventory_movements`); `SHOW CREATE TABLE
>   items/item_types/item_categories/order_items/orders/change_request_items/supplier_transactions/
>   supplier_transaction_items/evidences/schedule_plans/work_tasks`; `_prisma_migrations` chỉ có đúng 1
>   migration đã chạy (`20260718230757_init_core`, hoàn tất 2026-07-19); dữ liệu mẫu: bảng `items` hiện
>   chỉ có đúng 2 dòng thật (`ITM-SPK-01` "Loa JBL 1000W", `ITM-LGT-01` "Đèn Beam 230") — cùng 2 item đã
>   ghi nhận ở `docs/thietbikhohang_api.md`.
> - `docs/api/` không tồn tại trong repo hiện tại — dùng comment đầu `types/catalog.ts`/
>   `types/inventory.ts` (đối chiếu `prisma/schema.prisma`/`*.route.ts`/`*.service.ts` backend ngày
>   2026-07-06/2026-07-07) làm căn cứ chính, theo đúng cách các tài liệu API trước đã làm.

## 0. Phát hiện quan trọng nhất — chưa có bảng `inventory` nào trong DB thật

Toàn bộ 4 cột số liệu chính của bảng ("Tổng khả dụng", "Số lượng đã khóa", "Số lượng hỏng", "Tổng số
lượng") và toàn bộ khối "Tồn kho hiện tại" trong modal chi tiết **không có cột nào trong DB thật đứng
sau**. Bảng `items` (schema xem mục 1) chỉ chứa dữ liệu catalog (tên, giá, đơn vị, mô tả, trạng thái
`ACTIVE`/`INACTIVE`/`MAINTENANCE`) — **không có bất kỳ cột số lượng nào** (`quantityTotal`/
`quantityAvailable`/`quantityDamaged`...).

`src/types/inventory.ts` + `src/services/inventory.service.ts` **đã có sẵn code** cho đúng model cần
thiết (`GET /api/v1/inventory`, `POST /api/v1/inventory/adjust`, `GET /api/v1/inventory/movements`,
`POST /api/v1/inventory/return-reports`, `PUT /api/v1/inventory/return-reports/:id/confirm`) — nhưng
bảng `inventory` đứng sau **chưa hề được tạo trong DB** (chỉ 1 migration `init_core` đã chạy). Trang
"Thiết bị đang bảo trì" (`admin/inventory/maintenance/page.tsx`) cũng đã gọi sẵn
`inventoryApiService.getInventory()` chờ model này.

**Việc tạo bảng/cột mới đã được chuyển sang [`docs/more-require.md`](more-require.md) mục (b)** —
chưa phải việc backend cần làm ngay trong tài liệu này. Các mục dưới đây định nghĩa API/công thức với
giả định schema đó đã sẵn sàng; khi backend hoàn tất mục (b), 2 trang (màn này + "Thiết bị đang bảo
trì") chạy được ngay theo đúng mô tả dưới đây.

## 1. Dữ liệu catalog đã có sẵn (không cần thay đổi DB)

| Cột UI | Nguồn thật | Ghi chú |
|---|---|---|
| ID | `items.item_code` | Đã có, unique. |
| Tên sản phẩm & thiết bị | `items.item_name` | Đã có. |
| Nhóm sản phẩm | `items.type_id → item_types.category_id → item_categories.category_name` | Cần join 2 cấp — `GET /api/v1/catalog/items` (hoặc endpoint mới ở mục 2) nên trả kèm `categoryName` đã join sẵn, giống cách `Item.typeName` đang được join hiện nay (`types/catalog.ts` dòng 112). Lưu ý: schema thật là **Category → Type → Item** (3 tầng), khác với mock `AdminEquipment.category` đang gán thẳng 1-1 "1 nhóm sản phẩm = 1 loại thiết bị" (comment `mocks/db/catalog.ts` dòng 49-50) — khi nối thật, "Nhóm sản phẩm" trên UI này nên hiểu là **category** (tầng trên cùng, vd "Bàn ghế"), không phải `typeName`. |
| Đơn giá (modal) | `items.rental_price` | Đã có. |
| Giá trị đền bù (modal) | `items.purchase_price` | **Không cần cột mới** — đúng công thức đền bù đã chốt ở CLAUDE.md ("Đền bù thiết bị hỏng/mất = Giá mua thiết bị × Số lượng hỏng/mất"), tức "giá trị đền bù" = giá mua, cột đã tồn tại sẵn. Khi nối API thật, đổi field FE từ `replacementValue` riêng sang đọc thẳng `purchase_price`. |
| Mô tả kỹ thuật (modal) | `items.description` | Đã có. |
| Trạng thái bảo trì (badge trang "Thiết bị đang bảo trì") | `items.status = 'MAINTENANCE'` | Enum đã có sẵn trên `items.status`, nhưng đây là trạng thái **của cả item** (ngừng cho thuê để sửa), khác khái niệm "số lượng hỏng" (1 phần trong tổng số lượng vẫn hỏng trong khi các đơn vị còn lại vẫn `ACTIVE`) — 2 khái niệm không dùng chung 1 cột. |

## 2. Bảng chính "Danh sách tồn kho doanh nghiệp" — cột cần bảng `inventory` (chờ more-require.md mục b)

| Cột UI | Nguồn (khi bảng `inventory` đã có) | Ghi chú |
|---|---|---|
| Tổng khả dụng | Tính: `quantity_total - quantity_damaged - quantityLocked(date)` | Không lưu trực tiếp — suy ra từ 3 số khác lúc trả response, tránh lệch số khi 1 trong 3 nguồn thay đổi mà quên đồng bộ. |
| Số lượng đã khóa | Tính theo ngày, **không lưu** — công thức mục 3 | Số **phụ thuộc ngày chọn trên UI** (UC 2.13 "Date-based Inventory Lock") — không phải cột tĩnh. |
| Số lượng hỏng | `inventory.quantity_damaged` | Không phụ thuộc ngày — khớp hành vi mock hiện tại (`maintenanceStock` giữ nguyên bất kể ngày chọn, chỉ `rentedStock`/`availableStock` đổi theo ngày). |
| Tổng số lượng | `inventory.quantity_total` | Không phụ thuộc ngày, cùng lý do trên. |

### Bộ lọc & tìm kiếm trên bảng

| Control UI | Đề xuất param `GET /api/v1/inventory` |
|---|---|
| Ô tìm kiếm theo ID/tên | `search` (mới — `GetInventoryQuery` hiện chỉ có `itemId`/`page`/`limit`, không có tìm theo text) |
| Dropdown "Nhóm sản phẩm" | `categoryId` (mới) — options lấy từ `GET /api/v1/catalog/categories` đã có sẵn |
| Ô chọn ngày | `date` (mới, `YYYY-MM-DD`) — dùng cho công thức mục 3; nếu bỏ trống, trả `quantityLocked = null`/ẩn cột thay vì mặc định hôm nay (tránh ngầm định sai) |
| Checkbox "Chỉ hiển thị sản phẩm đang có hàng hỏng/bảo trì" | `onlyDamaged=true` (mới — lọc `quantity_damaged > 0`) |

Nên để Backend join + lọc luôn ở endpoint này (trả thẳng `itemCode`/`itemName`/`categoryName` kèm số
liệu tồn kho trong 1 lần gọi) thay vì FE tự gọi 2 API (catalog + inventory) rồi join tay ở client —
tránh vấn đề phân trang lệch giữa 2 nguồn khi danh mục có nhiều item (catalog thật hiện đã có 71 item
mock, dự kiến dữ liệu thật cũng tương đương).

## 3. Công thức "Số lượng đã khóa" theo ngày — đã chốt mở rộng theo khoảng ngày `schedule_plans`

**Đã chốt**: không chỉ khóa đúng ngày `orders.event_date` (quá đơn giản, bỏ sót ngày vận chuyển/thi
công/thu hồi quanh sự kiện) mà khóa theo **toàn bộ khoảng ngày đơn đó có kế hoạch vận hành** — dùng
`schedule_plans.start_time`/`end_time` đã có sẵn (không cần thêm cột/bảng mới, thuần là đổi công thức
query):

```sql
SELECT oi.item_id, SUM(oi.quantity) AS quantity_locked
FROM order_items oi
JOIN orders o ON o.order_id = oi.order_id
WHERE o.order_status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED')
  AND EXISTS (
    SELECT 1 FROM schedule_plans sp
    WHERE sp.order_id = o.order_id
      AND sp.status <> 'CANCELLED'
      AND :date BETWEEN DATE(sp.start_time) AND DATE(COALESCE(sp.end_time, sp.start_time))
  )
GROUP BY oi.item_id;
```

Cách này tự động bao trọn mọi giai đoạn (khảo sát/chuẩn bị/vận chuyển/thi công/thu hồi/hoàn kho) của
đơn mà **không cần phân loại "loại giai đoạn"** theo tên Task — `work_tasks` hiện chỉ có
`task_name`/`description` dạng free-text, không có cột enum phân loại giai đoạn, nên so khớp theo tên
task sẽ không đáng tin cậy; dùng trực tiếp khoảng `[start_time, end_time]` của **mọi** `schedule_plans`
thuộc đơn đó là đủ và không phụ thuộc cách đặt tên task.

Lý do chọn 3 trạng thái đơn `CONFIRMED`/`IN_PROGRESS`/`COMPLETED`: theo CLAUDE.md mục "Vòng đời Order",
kho chỉ thật sự bị khóa **sau khi xác nhận cọc** (đơn chuyển sang `CONFIRMED` trở đi) — đơn còn `NEW`
(chưa khảo sát/báo giá xong, chưa cọc) chưa nên tính vào số "đã khóa"; `CANCELLED` loại trừ. Dùng đúng
enum thật của `orders.order_status` (`NEW`/`CONFIRMED`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED`) — **không
phải** 7 giá trị lowercase hiện khai ở `src/types/order.ts` phía FE (đã lệch với DB thật, xem CLAUDE.md
mục "Vòng đời Order" — vấn đề đó nằm ngoài phạm vi tài liệu này).

## 4. Modal chi tiết thiết bị (`EquipmentDetailModal`)

| Trường UI | Nguồn | Ghi chú |
|---|---|---|
| Kích thước, Chất liệu | `items.dimensions`, `items.material` | **Cần 2 cột mới** — xem `docs/more-require.md` mục (b), chưa có ở DB. |
| Vị trí kho | `inventory.location` | **Cần bảng `inventory` mới** — xem `docs/more-require.md` mục (b). |
| Tồn kho hiện tại (Tổng số/Khả dụng/Đang đi tiệc/Bảo trì) | `inventory.quantity_total` / tính khả dụng / tính đã khóa / `inventory.quantity_damaged` | **Đã chốt (mục 4.1)**: modal dùng lại đúng số của dòng bảng đang mở (theo `date` đang lọc), không đọc số tĩnh riêng. |

(Đơn giá/Giá trị đền bù/Mô tả kỹ thuật đã có sẵn — xem mục 1, không lặp lại ở đây.)

### 4.1 Đã chốt — modal đồng bộ theo đúng ngày đang lọc ở bảng ngoài (hướng A)

Mock hiện tại có 1 lỗi logic: bảng chính tính "Đang đi tiệc"/"Khả dụng" theo `selectedDate` (hàm
`getSimulatedStockForDate`), nhưng modal `EquipmentDetailModal` khi mở lại đọc thẳng
`equipment.rentedStock`/`equipment.availableStock` gốc trong store — **không nhận `selectedDate`** —
nên 2 nơi hiển thị 2 con số khác nhau cho cùng 1 thiết bị, cùng 1 lần thao tác liên tiếp (chọn ngày ở
bảng → bấm "Xem chi tiết" ngay dòng đó → số đổi khác). Với dữ liệu thật đây sẽ là số nghiệp vụ thật,
dễ khiến Manager hiểu nhầm là dữ liệu bị lỗi/không đồng bộ.

**Đã chốt: đi hướng (A)** — modal đồng bộ đúng ngày đang chọn ở bảng ngoài, không phải hướng (B) (modal
cố định hiển thị số "hôm nay" bất kể ngày lọc). Lý do: mục đích chính người dùng bấm "Xem chi tiết" là
xem thêm chi tiết của **đúng con số vừa thấy** ở dòng đó, không phải xem 1 khái niệm khác.

**Không cần thêm endpoint/cột DB mới cho quyết định này** — `GET /api/v1/inventory?date=...` ở mục 2
đã tính sẵn `quantityAvailable`/`quantityLocked` theo đúng `date` cho mỗi dòng. Việc cần làm hoàn toàn
ở phía FE khi nối API thật: truyền `selectedDate` và số liệu đã fetch của đúng dòng đang mở (gồm cả
`quantityTotal`/`quantityDamaged` không đổi theo ngày) làm prop cho `EquipmentDetailModal` thay vì để
modal tự đọc lại từ store gốc — không cần gọi thêm 1 API riêng khi mở modal.

## 5. Form "Điều chỉnh tồn kho" + "Nhật ký biến động kho"

### 5.1 Vấn đề: 4 loại điều chỉnh trên UI không khớp 3 giá trị `MovementType` hiện có

Mock có 4 loại (`STOCK_LOG_TYPE_META`): `nhap_kho`, `xuat_kho` (đi tiệc), `bao_tri`, `dieu_chinh`.
`types/inventory.ts` hiện chỉ có `MovementType = 'OUTBOUND' | 'INBOUND' | 'ADJUSTMENT'` (3 giá trị) và
`AdjustInventoryPayload` chỉ có `{ itemId, quantityChange, notes }` — không có field phân biệt "loại"
tác động vào **bucket nào** (`quantity_total` hay `quantity_damaged`), trong khi 4 loại trên mock thực
ra tác động vào 2 bucket khác nhau:

- `nhap_kho` (nhập kho) → `quantity_total += qty`
- `bao_tri` (đưa đi bảo trì) → `quantity_damaged += qty` (không đổi `quantity_total`)
- `dieu_chinh` (điều chỉnh kiểm kê) → `quantity_total += qty` (qty có thể âm, dùng khi kiểm kê phát
  hiện lệch số)
- `xuat_kho` (xuất kho đi tiệc) → **đề xuất bỏ khỏi form điều chỉnh thủ công.** Theo mục 3, "số lượng
  đã khóa" giờ được **tính tự động** từ `orders`/`schedule_plans` đã xác nhận, không còn là số nhập tay
  được — để Manager tự bấm "xuất kho đi tiệc" tăng thủ công một số tách biệt với `orders` thật sẽ tạo
  ra 2 nguồn sự thật lệch nhau cho cùng 1 khái niệm. Việc xuất kho thật (đánh dấu đã lấy hàng theo
  picklist) thuộc phạm vi trang "Pick-list xuất kho" (ngoài phạm vi tài liệu này, xem đầu file).

**Đề xuất**: mở rộng `AdjustInventoryPayload` thêm field `movementType`, và đổi `MovementType` thành
`'INBOUND' | 'ADJUSTMENT' | 'DAMAGE'` (thêm `DAMAGE` — cần Backend thêm giá trị enum này khi tạo bảng
`inventory`, xem `docs/more-require.md` mục (b); bỏ `OUTBOUND` **khỏi phạm vi form của màn này** —
nếu `OUTBOUND` đang được trang "Xuất kho" dùng cho mục đích khác, giữ nguyên giá trị đó trong enum
chung, chỉ đơn giản là form ở màn này không cho chọn `OUTBOUND` nữa).

```
POST /api/v1/inventory/adjust
Body: { itemId: string, movementType: 'INBOUND' | 'ADJUSTMENT' | 'DAMAGE', quantityChange: number, notes?: string }
Response: InventoryRow đã cập nhật (hoặc 204)
```

Backend cần validate: `quantity_total` không âm sau khi cộng; `quantity_damaged` không âm và không
vượt `quantity_total` sau khi cộng; `movementType = 'DAMAGE'` ghi vào `quantity_damaged`, 2 loại còn
lại ghi vào `quantity_total`.

### 5.2 Nhật ký biến động kho — dùng `GET /api/v1/inventory/movements` đã có, không cần cột mới

`InventoryMovement` hiện đã có `movementId`/`itemId`/`orderId`/`reportId`/`movementType`/`quantity`/
`performedBy`/`performedByName`/`notes`/`createdAt` — đủ cho cột "Thời gian"/"Loại"/"Số lượng"/
"Lý do" (map `notes`) trên UI. Riêng cột **"Tham chiếu"** (`reference`, vd `"PN-2607-01"`,
`"HD2507-003"`) trên mock **không có cột riêng tương ứng** — đề xuất **không** thêm cột mới, để FE tự
suy ra nhãn hiển thị từ `orderId`/`reportId` đã có sẵn trên `InventoryMovement` (vd tra `order_code`
khi có `orderId`); các dòng điều chỉnh thủ công thuần túy (không gắn `orderId`/`reportId`) thì không
hiển thị tham chiếu, không cần bịa mã tự sinh như mock hiện tại (`"Điều chỉnh thủ công"`).

## 6. Phụ thuộc — trang "Thiết bị đang bảo trì" (`/admin/inventory/maintenance`)

Không thuộc phạm vi chỉnh sửa của tài liệu này nhưng **dùng chung đúng bảng `inventory` ở mục 0/2** —
đã code sẵn gọi `inventoryApiService.getInventory({ limit: 500 })` rồi lọc `quantityDamaged > 0` ở
client (`maintenance/page.tsx` dòng 30-46). Khi Backend hoàn tất `docs/more-require.md` mục (b) +
endpoint mở rộng ở mục 2, trang này chạy được ngay mà không cần sửa code — chỉ nhắc lại để Backend biết
đây là 1 lý do nữa khiến bảng `inventory` cần ưu tiên sớm (đang chặn 2 trang, không phải 1).

## 7. Tổng hợp

### 7.1 API cần Backend implement (giả định schema ở `docs/more-require.md` mục (b) đã có)

1. **`GET /api/v1/inventory`**: mở rộng trả kèm `itemCode`/`itemName`/`categoryName` (join
   `items → item_types → item_categories`), thêm param `search`/`categoryId`/`date`/`onlyDamaged`;
   khi có `date`, tính thêm `quantityLocked` theo công thức mục 3 và trả kèm `quantityAvailable =
   quantity_total - quantity_damaged - quantityLocked`.
2. **`POST /api/v1/inventory/adjust`**: thêm field `movementType` (`INBOUND`/`ADJUSTMENT`/`DAMAGE`),
   validate không âm/không vượt tổng (mục 5.1); bỏ lựa chọn "xuất kho đi tiệc" khỏi nghiệp vụ điều
   chỉnh thủ công của màn này.
3. **`GET /api/v1/inventory/movements`**: giữ nguyên shape hiện có, không cần cột `reference` mới —
   FE tự suy ra nhãn tham chiếu từ `orderId`/`reportId` (mục 5.2).
4. Cung cấp danh sách category cho dropdown lọc qua `GET /api/v1/catalog/categories` (endpoint đã có
   sẵn, không cần thay đổi).
5. Đọc thẳng `items.purchase_price` làm "Giá trị đền bù" — không thêm cột riêng (mục 1).

### 7.2 Việc DB cần sửa trước — xem `docs/more-require.md` mục (b), không lặp lại chi tiết ở đây

- Tạo bảng `inventory` (`quantity_total`, `quantity_damaged`, `location`).
- Thêm 2 cột `items.dimensions`, `items.material`.
- Mở rộng `MovementType` thêm giá trị `DAMAGE`.

### 7.3 Đã chốt (không còn mục nào chờ Product quyết định thêm)

1. Công thức khóa kho theo ngày (mục 3): **mở rộng theo khoảng ngày `schedule_plans`** của đơn (không
   chỉ đúng ngày `event_date`) — không cần đổi schema, thuần đổi công thức query.
2. Modal chi tiết thiết bị (mục 4.1): **đồng bộ theo đúng ngày đang lọc ở bảng ngoài** (hướng A), dùng
   lại số liệu đã fetch của dòng bảng, không gọi API riêng.
