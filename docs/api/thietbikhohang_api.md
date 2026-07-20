# API cho tab "Thiết bị & Kho hàng" (trang chi tiết đơn đặt)

> Phạm vi tài liệu này: **chỉ** tab `items` ("Thiết bị & Kho hàng") của trang chi tiết 1 đơn đặt —
> bảng "Quản lý phân bổ thiết bị & chuẩn bị kho" (đúng ảnh mẫu cung cấp: cột Hạng mục thiết bị/Dịch
> vụ, Nguồn, SL đặt, Đã bàn giao, Người phụ trách, Giá tiền + dòng tổng "Tổng cộng tài chính đơn
> hàng") và modal "Phiếu chuẩn bị (Picklist)" mở từ nút "Xem phiếu chuẩn bị" trên cùng tab — 2 mặt
> màn hình duy nhất thuộc phạm vi "Thiết bị & Kho hàng" trên trang tiến độ sự kiện. Trang dùng chung
> layout ở cả `/manager/orders/[id]` và `/admin/orders_audit/[id]` (mirror 1:1, chỉ khác tiền tố
> route). **Đã chốt (2026-07-20)**: bản Admin phải read-only ở tầng **backend** (403 cho mọi endpoint
> ghi ở mục 2 nếu role gọi là Admin), không chỉ ẩn UI phía FE — khớp đúng nguyên tắc "Admin không xử
> lý vận hành hằng ngày" (CLAUDE.md mục "Vai trò & phân quyền") và câu hỏi đã nêu chung ở
> `docs/tiendosukien_api.md` mục 0. FE hiện tại cả 2 bản đều có input chỉnh sửa được
> (`admin/orders_audit/[id]/page.tsx` dòng 242/874) — cần bỏ input chỉnh sửa ở bản Admin khi nối API
> thật, không chỉ dựa vào backend chặn ngầm.
>
> **Không** bao gồm 6 mốc timeline của tab "Tiến độ sự kiện" (đã có tài liệu riêng ở
> [`docs/tiendosukien_api.md`](tiendosukien_api.md)) hay tab "Tổng quan sự kiện"
> ([`docs/tongquansukien_api.md`](tongquansukien_api.md)). Phát hiện "join thêm `item.category` vào
> `orderItems`" đã chốt ở `docs/tongquansukien_api.md` mục 8/9.1 áp dụng trực tiếp cho bảng chính của
> tab này — tham chiếu lại, không lặp lại toàn bộ phân tích.
>
> Cũng **không** bao gồm trang "Pick-list xuất kho" độc lập (`/manager/inventory/picklists`) — trang
> đó tổng hợp picklist của **mọi** đơn (không phải 1 đơn), tái dùng đúng dữ liệu `items`/`preparedQty`
> của tab này nhưng thêm khái niệm `pickedUpAt` (đánh dấu "đã xuất kho" cho cả đơn) **không xuất hiện
> ở tab đang xét** — nêu lại ở mục 6 dưới đây như 1 phụ thuộc cần biết, nhưng để tài liệu hoá đầy đủ
> cho 1 tài liệu riêng sau nếu cần.
>
> Nguồn tham chiếu:
> - FE: `src/app/manager/orders/[id]/page.tsx` (dòng 88-105 khai báo `AdminOrderLineItem`/
>   `PicklistMaterial`/`PICKLIST_TEMPLATES`, dòng 350-374 handler
>   `handleItemPreparedQtyChange`/`handleItemPreparedByChange`/`handleOpenPicklist`, dòng 1020-1097
>   JSX bảng chính, dòng 1450-1553 JSX modal Picklist), `src/app/admin/orders_audit/[id]/page.tsx`
>   (bản mirror), `src/mocks/db/orders.ts` (`AdminOrderLineItem`, `OrderItemSource`,
>   `ORDER_ITEM_SOURCE_META`, `updateAdminOrderItem`, `getOrCreateOrderPicklist`,
>   `getAdminOrderPicklists`, `markAdminOrderPickedUp`), `src/app/manager/inventory/picklists/page.tsx`,
>   `src/types/order.ts`, `src/types/inventory.ts`, `src/services/order.service.ts`,
>   `src/services/inventory.service.ts`.
> - DB thật: đối chiếu trực tiếp qua MySQL MCP ngày 2026-07-20 (cùng phiên với
>   `docs/tiendosukien_api.md`) — `SHOW CREATE TABLE order_items/items/item_types/item_categories/
>   orders/users/quotation_items/supplier_transactions/supplier_transaction_items/
>   change_request_items`; `SHOW TABLES` (24 bảng — **không có** bảng `inventory`/
>   `inventory_movements` nào); `_prisma_migrations` chỉ có đúng 1 migration đã chạy
>   (`20260718230757_init_core`); dữ liệu mẫu thật: `order_items` của `ORD-001` có đúng 2 dòng, cả 2
>   `source = 'INTERNAL'`, `prepared_qty = 0` — "Loa JBL 1000W" (category "Âm thanh", 2 cái,
>   500.000đ/cái) và "Đèn Beam 230" (category "Ánh sáng", 2 cái, 300.000đ/cái).
> - `docs/api/` **không tồn tại trong repo hiện tại** — dùng comment đầu từng file `types/*.ts` (đối
>   chiếu trực tiếp `prisma/schema.prisma`/`*.route.ts`/`*.service.ts` của backend ngày 2026-07-06) làm
>   căn cứ chính, giống các tài liệu trước.

## 0. Base URL & Auth

- Base path: `/api/v1`, JWT Bearer theo `AuthContext` hiện có.
- **Đã chốt (2026-07-20, xem mục 4)**: 2 hành động ghi của tab này có 2 chủ thể khác nhau, không còn
  gộp chung "chỉ Manager được làm" như các tab khác:
  - Cập nhật `preparedQty`/`preparedBy` từng dòng (mục 2a) — **Leader Staff** gọi qua mobile app
    (ngoài phạm vi repo web này), backend chỉ nên chấp nhận role `LEADER` đã được gán vào
    `schedule_plan_assignees` của đơn tương ứng.
  - Xác nhận "đã chuẩn bị xong" cấp đơn (mục 2b) — **Manager** gọi trên web, theo đúng CLAUDE.md mục 1.
  - Admin (`/admin/orders_audit/[id]`) — read-only, backend trả 403 cho cả 2 endpoint trên nếu role
    gọi là `ADMIN`.

## 1. Bảng chính "Quản lý phân bổ thiết bị & chuẩn bị kho"

| Cột UI | Nguồn thật | Ghi chú |
|---|---|---|
| Hạng mục thiết bị/Dịch vụ (tiêu đề đậm + mô tả phụ) | `GET /api/v1/orders/:id` → `orderItems[].item.category.categoryName` (đậm) + `orderItems[].item.itemName` (phụ) | **Cần đúng quyết định đã chốt ở `docs/tongquansukien_api.md` mục 8/9.1** (hướng B) — mở rộng `OrderItem.item` từ `{ itemName }` thành `{ itemName, category: { categoryId, categoryName } }` (join 4 cấp `order_items → items → item_types → item_categories` phía backend). Dữ liệu mẫu thật đúng đối tượng: category "Âm thanh"/"Ánh sáng", item name "Loa JBL 1000W"/"Đèn Beam 230" — khớp bố cục tiêu đề đậm/mô tả phụ của UI nếu đảo vai trò `category`↔`description` so với mock hiện tại (mock đang lấy `item.category` là tên nhóm tự bịa kiểu "Tiệc bàn"/"Trang trí sảnh", `item.description` là câu mô tả dài — dữ liệu thật không có câu mô tả dài tương ứng, chỉ có `itemName`, nên khi nối thật: dòng đậm = `category.categoryName`, dòng phụ = `itemName`). |
| Nguồn (badge Kho nhà/Thuê ngoài) | `orderItems[].source` (`INTERNAL`/`SUPPLIER`) | Khớp trực tiếp `order_items.source` — **đã có sẵn**, không cần thay đổi backend. Badge label FE (`ORDER_ITEM_SOURCE_META`) map `internal→'Kho nhà'`, `external→'Thuê ngoài'` bằng chữ thường (`'internal'`/`'external'`) — lệch enum thật viết hoa (`'INTERNAL'`/`'SUPPLIER'`, không phải `'EXTERNAL'`) và tên giá trị thứ 2 khác nhau (`external` vs `SUPPLIER`) — cần sửa lại `OrderItemSource`/`ORDER_ITEM_SOURCE_META` phía FE cho khớp enum thật khi nối API. |
| SL đặt | `orderItems[].quantity` | Khớp trực tiếp `order_items.quantity`. |
| Đã bàn giao | `orderItems[].preparedQty` | **Đã chốt (mục 4, hướng B)**: đổi từ input số chỉnh trực tiếp (mock hiện tại) sang **hiển thị read-only** trên web Manager/Admin — giá trị do Leader Staff cập nhật qua mobile (mục 2a). Đọc khớp trực tiếp `order_items.prepared_qty` (**cột đã tồn tại sẵn trong DB thật**, mặc định 0). |
| Người phụ trách | **Chưa có cột thật tương ứng, xem mục 3** | **Đã chốt (mục 4, hướng B)**: cũng đổi sang hiển thị read-only trên web như "Đã bàn giao" — cùng lý do. |
| Giá tiền | `orderItems[].subtotal` | **Không nên tự tính `unitPrice * quantity` ở client** như mock hiện tại (dòng 1085) — `order_items.subtotal` đã là cột lưu sẵn phía backend (decimal, tính đúng tại thời điểm tạo/sửa item), `types/order.ts` đã khai `OrderItem.subtotal?: number` sẵn nhưng FE chưa dùng tới. Đọc thẳng field này, theo đúng nguyên tắc "không tự cộng trừ số liệu tài chính ở FE" đã áp dụng nhất quán ở các tài liệu trước (`docs/tiendosukien_api.md` mục 3.1/6). |
| Tổng cộng tài chính đơn hàng | `GET /api/v1/orders/:id` → `totalAmount` | Khớp trực tiếp `orders.total_amount`, không cần tự cộng lại từ `orderItems`. |

## 2. Endpoint ghi mới — 2 endpoint tách vai trò theo hướng đã chốt ở mục 4

**Chưa có endpoint nào phù hợp trong `order.service.ts` hiện tại.** `PUT /api/v1/orders/:id/items`
(`updateOrderItems`, đã có sẵn) có ngữ nghĩa "thay TOÀN BỘ danh sách item" (xoá hết rồi tạo lại theo
comment dòng 41 `order.service.ts`) — không phù hợp cho cả 2 thao tác dưới đây (sai ngữ nghĩa "cập nhật
tiến độ" vs "sửa lại đơn hàng", và rủi ro ghi đè nhầm dữ liệu dòng khác nếu gửi lại toàn mảng mỗi lần).

### 2a. Leader Staff (mobile, ngoài phạm vi repo web) — cập nhật tiến độ chuẩn bị từng dòng

```
PATCH /api/v1/orders/:orderId/items/:orderItemId
Body: { preparedQty?: number, preparedBy?: string }
Response: OrderItem đã cập nhật (hoặc 204)
```

Theo đúng phong cách `PATCH .../live-checklist` đã chốt ở `docs/tiendosukien_api.md` mục 5 (cập nhật 1
phần dữ liệu nhỏ, tần suất cao, không phải "sửa đơn"). Ràng buộc backend nên áp dụng: `preparedQty`
không âm và không vượt `quantity` của chính dòng đó (UI mock hiện tự kẹp `Math.min(value, max)` phía
client, dòng 351 `orders.ts` — nhưng validate ở FE không đủ, backend vẫn cần chặn lại). Quyền gọi:
`LEADER` đã được gán vào `schedule_plan_assignees` của đơn (theo mục 0) — chi tiết UI mobile ngoài
phạm vi tài liệu này, chỉ định nghĩa hợp đồng API phía backend.

### 2b. Manager (web) — xác nhận đã chuẩn bị xong cấp đơn

Web tab này (sau khi đổi UI theo mục 4) cần **1 nút xác nhận mới, chưa có trong mock hiện tại**
("Xác nhận đã chuẩn bị xong" hoặc tương đương) để Manager xác nhận toàn bộ tiến độ Leader Staff đã ghi
nhận là đúng, trước khi cho phép xuất kho — cùng mô hình "xác nhận cấp trên" đã dùng cho
`settlements`/`deposits` ở các tab khác (`docs/tiendosukien_api.md` mục 3.1/6), không phải xác nhận
từng dòng riêng lẻ vì UI hiện chỉ có 1 nút tổng cho cả picklist.

```
PUT /api/v1/orders/:orderId/items/confirm-prepared
Body: { notes?: string }
Response: Order đã cập nhật (hoặc 204)
```

**Cần thêm 2 cột mới trên `orders`**: `items_confirmed_at TIMESTAMP NULL`, `items_confirmed_by
VARCHAR(36) NULL` (FK `users.user_id`) — cùng pattern đã chốt cho "Đóng đơn hàng"
(`docs/tiendosukien_api.md` mục 7, cột nullable + endpoint riêng thay vì thêm enum mới). Điều kiện hợp
lệ phía backend: chỉ cho xác nhận khi `preparedQty = quantity` ở mọi dòng (100% đã chuẩn bị xong) —
khớp đúng điều kiện `isAllPrepared` đang dùng ở trang "Pick-list xuất kho" (mục 6).

## 3. Cột mới cần thêm — "Người phụ trách" (`preparedBy`)

**Không có cột nào trong `order_items` lưu tên người/đơn vị phụ trách chuẩn bị** — đối chiếu
`SHOW CREATE TABLE order_items` xác nhận chỉ có `source`/`prepared_qty`/`notes` (text ghi chú chung,
không phải tên người phụ trách), không có `prepared_by` hay `prepared_by_user_id`. Theo hướng đã chốt
ở mục 4, cột này giờ được ghi bởi Leader Staff qua endpoint mục 2a, web chỉ đọc — nhưng vẫn cần đúng
1 cột lưu trữ dưới đây bất kể ai ghi.

**Đề xuất hướng (A)** — thêm cột free-text `order_items.prepared_by VARCHAR(255) NULL`, **không**
dùng FK `users.user_id` (khác hẳn pattern FK đang dùng ở `schedule_plans.created_by`/
`schedule_plan_assignees.user_id`). Lý do: dữ liệu mẫu thực tế của trường này trong mock hiện tại là
tên **tổ/đơn vị**, không phải tên 1 tài khoản hệ thống cụ thể — ví dụ `"Kho bếp trung tâm"`,
`"Tổ trang trí"`, `"Đối tác Âm thanh Gold"` (dòng 192/203/214 `mocks/db/orders.ts`). Đặc biệt giá trị
cuối là tên 1 Supplier — mà theo CLAUDE.md mục "Vai trò & phân quyền", **Supplier không có tài khoản
đăng nhập** nên không thể có `user_id` để gán FK. Ép field này thành FK `users` sẽ chặn hẳn trường hợp
"người phụ trách là 1 đối tác/tổ đội ngoài hệ thống tài khoản", vốn là tình huống thật đơn giản cần hỗ
trợ ở đây. Hướng (B) (FK `users.user_id`, chỉ cho phép chọn nhân sự nội bộ) bị loại vì không khớp dữ
liệu mẫu thật và thu hẹp use-case so với UI hiện tại (input text tự do, không phải dropdown chọn nhân
viên).

## 4. Đã chốt — web chỉ hiển thị + xác nhận, Leader Staff (mobile) mới là nơi ghi nhận tiến độ chuẩn bị kho

CLAUDE.md mục "Vai trò & phân quyền" ghi rõ: **"xuất/nhận/trả kho nội bộ"** là 1 trong các loại dữ
liệu hiện trường mà **"Leader Staff (mobile) ghi nhận trước, Manager chỉ xác nhận (confirm) trên
web"**. Mock hiện tại lại để **Manager tự gõ trực tiếp** số lượng đã bàn giao và tên người phụ trách
ngay trên web (`onChange` cập nhật tức thời, không qua bước "duyệt" nào) — sai với nguyên tắc này.

**Đã chốt (2026-07-20) — đi đúng theo CLAUDE.md (hướng B)**: việc chuẩn bị/xuất kho do Leader Staff
ghi nhận qua mobile app (ngoài phạm vi repo web này, dùng endpoint mục 2a). Tab "Thiết bị & Kho hàng"
trên web (cả Manager lẫn Admin) đổi 2 cột "Đã bàn giao"/"Người phụ trách" từ input chỉnh trực tiếp
sang **hiển thị read-only** (xem lại mục 1), kèm thêm 1 nút xác nhận tổng quát "Xác nhận đã chuẩn bị
xong" chỉ Manager bấm được (mục 2b) sau khi Leader Staff đã báo đủ 100% qua mobile. Lý do chọn (B) dù
tốn công sửa UI hơn hướng giữ nguyên input trực tiếp: đây không phải chi tiết trang trí UI như các quyết
định "giữ nguyên luồng cho rẻ" ở tài liệu khác (vd khảo sát hiện trường, `docs/tiendosukien_api.md`
mục 3.2) — nó đụng thẳng ranh giới phân quyền cốt lõi đã ghi rõ trong CLAUDE.md (Admin/Manager không
trực tiếp ghi nhận dữ liệu hiện trường), nên ưu tiên đúng kiến trúc thay vì chi phí ngắn hạn.

**Việc FE cần làm khi nối API thật** (đánh dấu ngoài phạm vi "chỉ định nghĩa API" của tài liệu này
nhưng ghi lại để không quên): đổi 2 ô input ở dòng 1067-1084 (`orders/[id]/page.tsx`) thành text hiển
thị thường, bỏ `handleItemPreparedQtyChange`/`handleItemPreparedByChange`, thêm 1 nút mới gọi endpoint
mục 2b ở vị trí nút "Xem phiếu chuẩn bị" hiện có.

## 5. Modal "Phiếu chuẩn bị (Picklist)" — không có mô hình BOM/tồn kho thật đứng sau

Modal hiện tại (`PICKLIST_TEMPLATES`, dòng 127-180) tách mỗi hạng mục đơn hàng thành nhiều "vật tư cấu
thành" con (ví dụ "Tiệc bàn" → thêm "Thùng đựng chống sốc", "Dây nguồn chuyên dụng"...) kèm cột "Tồn
kho" hiển thị số khả dụng. **Toàn bộ dữ liệu này 100% dựng sẵn phía FE, không có bảng nào trong DB thật
lưu quan hệ "1 hạng mục cấu thành từ nhiều vật tư con"** (không có bảng kiểu `item_materials`/BOM), và
**cũng không có bảng tồn kho nào tồn tại trong DB hiện tại** để lấy số "Tồn kho" thật — `SHOW TABLES`
chỉ có 24 bảng, không có `inventory`/`inventory_movements`.

Đáng chú ý: `src/services/inventory.service.ts` và `src/types/inventory.ts` **đã có sẵn code** gọi
`GET /api/v1/inventory`, `POST /api/v1/inventory/adjust`, `GET /api/v1/inventory/movements` — comment
đầu file `types/inventory.ts` ghi rõ nguồn là model `Inventory`/`InventoryMovement` trong
`prisma/schema.prisma` của backend. Nhưng đối chiếu DB thật (`_prisma_migrations`) thì **chỉ có đúng 1
migration đã chạy** (`20260718230757_init_core`, hoàn tất `2026-07-19`) và bảng `inventory` **chưa hề
được tạo** — nghĩa là 2 khả năng: (a) model `Inventory` đã viết trong `schema.prisma` nhưng migration
tương ứng chưa chạy trên DB này, hoặc (b) FE đã viết service đón đầu cho 1 API chưa tồn tại.

**Đã chốt (2026-07-20)**: không chặn tiến độ tab này chờ xác nhận model `Inventory` — đi thẳng theo
hướng (A) dưới đây ngay, ẩn cột "Tồn kho" cho tới khi bảng `inventory` thật sự sẵn sàng. Việc chạy
migration cho model này (nếu đã có sẵn trong `schema.prisma`) là việc riêng của Backend, không phụ
thuộc gì vào tab "Thiết bị & Kho hàng" — khi bảng đó lên, chỉ cần bật lại cột "Tồn kho" theo đúng mô tả
dưới đây, không cần sửa gì thêm ở phần còn lại của tài liệu này.

**Đề xuất hướng (A)** — bỏ hẳn phần "vật tư cấu thành" (BOM) dựng sẵn, đơn giản hoá Picklist thành
đúng danh sách `orderItems` đã có (cùng dữ liệu với bảng chính ở mục 1: hạng mục, SL đặt, nguồn, đơn
giá), **không** thêm bảng BOM mới. Cột "Tồn kho" chỉ hiển thị khi (và sau khi) bảng `inventory` được
xác nhận tồn tại thật — đọc qua `GET /api/v1/inventory?itemId=:itemId` (hoặc nếu backend join sẵn vào
`GET /orders/:id`, đọc `orderItems[].item.inventory.quantityAvailable`) cho từng `itemId`; nếu bảng
`inventory` chưa migrate xong, ẩn hẳn cột này thay vì hiển thị số tự bịa như hiện tại (số tồn kho sai
lệch trên 1 phiếu in đưa tổ kho sử dụng thật có thể gây nhầm lẫn vận hành thật, mức rủi ro cao hơn hẳn
các trường hợp mock dữ liệu khác trong tài liệu này). Hướng (B) (xây bảng BOM thật + nhập liệu công
thức cấu thành cho từng loại hạng mục) bị loại vì chi phí triển khai (thêm bảng, thêm màn hình quản trị
công thức, thêm nghiệp vụ mới hoàn toàn) không tương xứng — hiện chưa có yêu cầu nghiệp vụ nào khác
trong CLAUDE.md nhắc tới khái niệm "vật tư cấu thành 1 hạng mục", đây thuần là chi tiết trang trí UI
mock tự thêm vào.

**Mã phiếu** (`PKL-DD0001-01`, hiển thị ở tiêu đề modal) và "Tạo lúc {ngày}" — mock sinh tại client
(`getOrCreateOrderPicklist`, Map trong bộ nhớ, mất khi tải lại trang), **không cần persist thật**: đây
chỉ là nhãn hiển thị/in phiếu, không phải chứng từ cần tra cứu lại nhiều lần hay audit — không đề xuất
thêm bảng `picklists` mới. Backend không cần endpoint riêng cho việc này; FE tự sinh nhãn dạng
`PKL-{orderCode}-01` tại thời điểm mở modal.

Nút "In phiếu" chỉ gọi `window.print()` — không cần API.

## 6. Phụ thuộc liên quan (ngoài phạm vi tài liệu này) — trang "Pick-list xuất kho"

`src/app/manager/inventory/picklists/page.tsx` tổng hợp **mọi** đơn `CONFIRMED`/`IN_PROGRESS` thành 1
danh sách, dùng lại đúng `totalItemsCount`/`preparedItemsCount` (tính từ `orderItems` như mục 1) và
thêm field `pickedUpAt` (đơn đã "Đã xuất kho" hay chưa) — **không có cột thật tương ứng**
(`orders` không có `picked_up_at`). Field này **không xuất hiện ở tab "Thiết bị & Kho hàng"** đang xét
trong tài liệu này, chỉ nêu lại để Backend biết còn 1 gap liên quan cần 1 tài liệu API riêng
(`docs/picklistxuatkho_api.md` hay tương đương) khi tới lượt làm màn hình đó — không đề xuất giải pháp
ở đây vì ngoài phạm vi.

## 7. Tổng hợp — đã chốt hết, Backend có thể implement toàn bộ

Cả 3 điểm trước đây cần Product/Backend xác nhận (Manager nhập trực tiếp hay Leader Staff mobile ghi
nhận; số phận model `Inventory`; quyền ghi của bản Admin) **đã được chốt** trong lần rà soát này
(2026-07-20) — không còn mục nào phải chờ quyết định thêm trước khi Backend bắt đầu code.

### 7.1 Đã chốt — Backend implement theo đúng mô tả ở mục tương ứng

1. **Join `item.category` vào `orderItems`** (mục 1): áp dụng đúng hướng (B) đã chốt ở
   `docs/tongquansukien_api.md` mục 8/9.1 — không cần quyết định lại, chỉ nhắc dùng chung cho tab này.
2. **Đọc thẳng `orderItems[].subtotal`** thay vì tự tính `unitPrice * quantity` ở client (mục 1).
3. **Đổi 2 cột "Đã bàn giao"/"Người phụ trách" thành read-only trên web** (mục 1, 4) — dữ liệu do Leader
   Staff ghi qua mobile (mục 2a), Manager/Admin trên web chỉ xem, không còn input chỉnh trực tiếp.
4. **Thêm endpoint `PATCH /api/v1/orders/:orderId/items/:orderItemId`** `{ preparedQty?, preparedBy? }`
   (mục 2a) — caller là Leader Staff (mobile, ngoài phạm vi repo), cần validate
   `0 ≤ preparedQty ≤ quantity` phía backend, không chỉ dựa vào FE.
5. **Thêm endpoint `PUT /api/v1/orders/:orderId/items/confirm-prepared`** `{ notes? }` (mục 2b) — caller
   là Manager (web), chỉ cho phép khi mọi dòng đã `preparedQty = quantity`; kèm 2 cột mới
   `orders.items_confirmed_at`/`orders.items_confirmed_by`.
6. **Thêm cột `order_items.prepared_by VARCHAR(255) NULL`** (free text, không FK `users`) (mục 3).
7. **Admin (`/admin/orders_audit/[id]`) read-only ở tầng backend** (403 cho mục 2a/2b nếu role là
   `ADMIN`) — không chỉ ẩn UI phía FE (đầu file).
8. **Đơn giản hoá Picklist** (mục 5, hướng A): bỏ hẳn BOM/vật tư cấu thành dựng sẵn, dùng thẳng
   `orderItems` đã có; cột "Tồn kho" ẩn cho tới khi bảng `inventory` sẵn sàng (không chặn phần còn lại
   của tab chờ việc này — xem mục 5); mã phiếu sinh phía client, không cần bảng `picklists` mới.
9. Gọi API qua đúng lớp `services/*.service.ts` (`orderApiService`, cần thêm 2 method mới cho endpoint
   ở mục 2a/2b) theo CLAUDE.md mục 4, không tạo lời gọi `axios`/`fetch` mới trong component.

### 7.2 Việc kỹ thuật thuần phía Backend, không phải quyết định — làm khi rảnh, không chặn tab này

1. **(mục 5)** Xác nhận model `Inventory`/`InventoryMovement` trong `prisma/schema.prisma` đã có hay
   chưa, và chạy migration tương ứng nếu chưa — khi xong chỉ cần bật lại cột "Tồn kho" theo mô tả ở
   mục 5, không ảnh hưởng gì tới các phần khác đã chốt ở mục 7.1.
