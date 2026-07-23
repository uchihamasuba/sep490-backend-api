# API cho màn "Pick-list xuất kho"

> Phạm vi tài liệu này: trang độc lập `/manager/inventory/picklists` (Manager) — **không có mirror
> Admin** (`admin/inventory/picklists` chưa tồn tại, xem comment đầu file
> `src/app/manager/inventory/picklists/page.tsx` dòng 15-19: "route đó bên Admin vẫn là placeholder
> 'đang phát triển'"). Gồm 3 thẻ KPI ("Tổng phiếu chuẩn bị"/"Sẵn sàng xuất kho"/"Đã xuất kho"), thanh
> tìm kiếm + dropdown lọc trạng thái xuất kho, và bảng chính (Mã phiếu / Đơn đặt cưới / Ngày thi công /
> Điều phối viên / Trạng thái xuất kho / Thao tác). Đây là ảnh mẫu người dùng cung cấp cho tài liệu này.
>
> Trang này đã được 2 tài liệu liên quan nhắc tới trước như 1 gap chưa xử lý — không lặp lại phân tích
> đã có ở đó, chỉ tham chiếu:
> - [`docs/tonkhodoanhnghiep_api.md`](tonkhodoanhnghiep_api.md) (đầu file): liệt kê "Pick-list xuất
>   kho" là 1 trong các trang cùng nhóm menu "Tồn kho" chưa có tài liệu riêng.
> - [`docs/thietbikhohang_api.md`](thietbikhohang_api.md) mục 6: đã chốt tab "Thiết bị & Kho hàng" của
>   trang chi tiết đơn (`preparedQty`/`preparedBy` từng dòng, endpoint `PATCH
>   .../items/:orderItemId` cho Leader Staff và `PUT .../items/confirm-prepared` cho Manager) là
>   **nguồn dữ liệu chuẩn bị kho** mà trang này tái sử dụng — field `pickedUpAt` (đánh dấu "đã xuất
>   kho" cho **cả đơn**) là khái niệm **chỉ xuất hiện ở trang này**, chưa có cột thật tương ứng, chính
>   là nội dung chính tài liệu này cần định nghĩa.
> - [`docs/danhsachdondat_api.md`](danhsachdondat_api.md) mục 4.1: đã phân tích field `coordinatorName`
>   ("Điều phối viên") không có căn cứ trực tiếp trên `orders`, cần join qua
>   `schedule_plan_assignees`. Cột "Điều phối viên" ở bảng trang này gặp đúng vấn đề tương tự —
>   **đã chốt chung 1 hướng xử lý cho cả 2 tài liệu** ở mục 3.4 dưới đây (2026-07-20), không quyết định
>   riêng lẻ từng màn.
>
> Nguồn tham chiếu:
> - FE: `src/app/manager/inventory/picklists/page.tsx` (toàn bộ trang), `src/mocks/db/orders.ts` (dòng
>   361-415: `OrderPicklist`, `OrderPicklistSummary`, `getOrCreateOrderPicklist`,
>   `getAdminOrderPicklists`, `markAdminOrderPickedUp`; dòng 129-131: comment `pickedUpAt` trên
>   `AdminOrderRow`), `src/mocks/db/employees.ts` (`COORDINATOR_POOL`), `src/types/order.ts`,
>   `src/services/order.service.ts`.
> - DB thật: đối chiếu trực tiếp qua MySQL MCP ngày 2026-07-20 (cùng phiên với
>   `docs/thietbikhohang_api.md`/`docs/tonkhodoanhnghiep_api.md`) — `SHOW TABLES` (25 bảng, không có
>   `inventory`/`picklists`/`employees`); `SHOW CREATE TABLE
>   orders/order_items/items/customers/schedule_plans/schedule_plan_assignees/work_tasks/users`; dữ
>   liệu mẫu thật hiện chỉ có **1** đơn (`ORD-001`, `order_status = CONFIRMED`), **2** `order_items`
>   (cả 2 `prepared_qty = 0`), **1** `schedule_plans` (task "Lắp đặt thiết bị", `status =
>   IN_PROGRESS`), **2** `schedule_plan_assignees` (1 `LEAD`, 1 `TECHNICAL`); `work_tasks` chỉ có 2
>   dòng active (`TSK-SETUP` "Lắp đặt thiết bị", `TSK-TEARDOWN` "Tháo dỡ thiết bị") — **không có** loại
>   task nào tên "Xuất kho"/"Vận chuyển" riêng.
> - `docs/api/` **không tồn tại trong repo hiện tại** — dùng comment đầu `types/order.ts` (đối chiếu
>   trực tiếp `prisma/schema.prisma`/`*.route.ts`/`*.service.ts` backend) làm căn cứ chính, giống các
>   tài liệu trước.

## 1. 3 thẻ KPI

| Thẻ UI | Nguồn (mock) | Theo dữ liệu thật |
|---|---|---|
| Tổng phiếu chuẩn bị | `summaries.length` (mọi đơn `CONFIRMED`/`IN_PROGRESS`) | `COUNT(*) FROM orders WHERE order_status IN ('CONFIRMED','IN_PROGRESS')` |
| Sẵn sàng xuất kho | `totalItemsCount > 0 && preparedItemsCount >= totalItemsCount && !pickedUpAt` | Xem mục 3.2 — đề xuất đổi điều kiện sang `items_confirmed_at IS NOT NULL AND picked_up_at IS NULL` thay vì tự cộng lại `prepared_qty` ở client. |
| Đã xuất kho | `Boolean(pickedUpAt)` | `COUNT(*) WHERE picked_up_at IS NOT NULL` (cột mới, mục 4). |

Đề xuất trả cả 3 số này trong `meta` của response `GET /api/v1/orders/picklists` (mục 5), tính trên
**toàn bộ tập đã lọc theo trạng thái đơn** (không phải chỉ trang hiện tại sau phân trang) — cùng cách
đã khuyến nghị cho KPI ở `docs/danhsachdondat_api.md` mục 2 (hướng b, thêm 1 lần tính kèm response
thay vì nhiều round-trip riêng).

## 2. Bộ lọc & tìm kiếm

| Control UI | Nguồn (mock) | Đề xuất param `GET /api/v1/orders/picklists` |
|---|---|---|
| Ô tìm kiếm "mã phiếu, mã đơn, khách hàng" | So khớp `picklist.code`/`row.orderId`/`row.customerName` (client) | `search` — khớp `orders.order_code` (`LIKE`) hoặc `customers.customer_name` (`LIKE`, JOIN qua `customer_id`). **Lưu ý**: "mã phiếu" không phải cột thật (mục 3.1) — mã phiếu luôn có dạng `PKL-{orderCode}`, nên tìm theo mã phiếu thực chất là tìm theo `orderCode` chứa chuỗi con; FE có thể gửi thẳng chuỗi người dùng gõ (kể cả khi họ gõ nguyên `"PKL-ORD-001"`) miễn backend so khớp dạng `LIKE '%:search%'` trên `order_code` chứ không phải so khớp tuyệt đối. |
| Dropdown "Tất cả trạng thái xuất kho" | `ExportFilter`: `''` / `PENDING` / `EXPORTED`, lọc theo `Boolean(row.pickedUpAt)` | `exportStatus` = `PENDING` (`picked_up_at IS NULL`) / `EXPORTED` (`picked_up_at IS NOT NULL`) — cột mới, mục 4. |
| *(ngầm định, không có control riêng)* | Chỉ lấy đơn `status === 'CONFIRMED' \|\| status === 'IN_PROGRESS'` | `orderStatus IN ('CONFIRMED','IN_PROGRESS')` — cố định phía backend cho endpoint này (không phải param FE truyền vào), đúng ngữ nghĩa "đơn đã xác nhận/đang thi công mới cần chuẩn bị xuất kho" (CLAUDE.md mục 1: kho chỉ thật sự bị khóa sau khi xác nhận cọc). |
| *(phân trang)* | Không thấy UI phân trang trong ảnh mẫu, nhưng `Table` dùng chung toàn site đã hỗ trợ | `page`/`limit`, theo đúng convention `GetOrdersQuery` hiện có (`order.service.ts`). |

## 3. Bảng chính — ánh xạ từng cột

### 3.1. Mã phiếu — không cần bảng mới, sinh nhãn phía client

Giống kết luận đã chốt ở `docs/thietbikhohang_api.md` mục 5 cho modal Picklist của **1** đơn: mã phiếu
chỉ là nhãn hiển thị/in, không phải chứng từ cần tra cứu lại nhiều lần hay audit — **không đề xuất
bảng `picklists` mới**, không cần endpoint riêng.

Khác 1 điểm so với mock hiện tại: mock sinh `PKL-{orderId}-{seq}` với `seq` là bộ đếm toàn cục tăng
dần theo thứ tự **mở trang lần đầu** (không có ý nghĩa nghiệp vụ, chỉ để tránh trùng khi `orderId` có
thể lặp giữa nhiều lần tạo — nhưng `orders.order_code` thật đã là `UNIQUE`). Với dữ liệu thật, **bỏ
hẳn hậu tố `-01`/`-02`**, dùng thẳng `PKL-{orderCode}` (ví dụ `PKL-ORD-001`) — đã đủ duy nhất, không
cần bộ đếm.

### 3.2. Đơn đặt cưới — mã đơn + tên khách hàng

| Phần hiển thị | Nguồn thật |
|---|---|
| Mã đơn (link) | `orders.order_code`, link sang `/manager/orders/:orderId` (trang chi tiết đã có, xem `docs/thietbikhohang_api.md`/`docs/tongquansukien_api.md`) |
| Tên khách hàng (phụ, dưới mã đơn) | `customers.customer_name` — **JOIN** qua `orders.customer_id`, không lưu snapshot riêng, đúng kết luận đã chốt ở `docs/danhsachdondat_api.md` mục 4 (bỏ 2 field `customerName`/`customerPhone` snapshot trên `AdminOrderRow` khi nối API thật). |

### 3.3. Ngày thi công

`orders.event_date` — đúng quy ước "Ngày tổ chức"/`weddingDate` đã dùng nhất quán ở
`docs/danhsachdondat_api.md` mục 4 cho các màn danh sách Order khác (không dùng
`schedule_plans.start_time` của task "Lắp đặt thiết bị" dù về mặt vận hành, thời điểm cần xuất kho
thực tế gần với ngày lắp đặt hơn ngày sự kiện — giữ nhất quán 1 nguồn ngày duy nhất cho mọi màn hiển
thị Order thay vì mỗi màn tự chọn nguồn khác nhau; nếu Product muốn đổi sang mốc lắp đặt cụ thể hơn,
cần quyết định lại đồng loạt cho cả các màn danh sách Order khác, ngoài phạm vi riêng tài liệu này).

Lưu ý: `event_date` là `timestamp` (có giờ, dữ liệu mẫu `"2026-08-15T02:00:00.000Z"`), không phải chỉ
`DATE` — dùng `formatDate` hiện có (CLAUDE.md mục 4) để hiển thị đúng phần ngày.

### 3.4. Điều phối viên — đã chốt (2026-07-20), áp dụng chung với `docs/danhsachdondat_api.md` mục 4.1

Không lặp lại toàn bộ phân tích — tóm tắt: `COORDINATOR_POOL` (mock) là 1 pool tên tĩnh không tham
chiếu bản ghi thật; **`orders` không có cột nào lưu "người điều phối"**; khái niệm gần nhất là
`schedule_plan_assignees.role = 'LEAD'` join qua `schedule_plans.order_id → orders.order_id`
(1 đơn có thể có **nhiều** `schedule_plans`, mỗi dòng có thể có **LEAD** khác nhau — không phải "1
điều phối viên duy nhất/đơn" như mock giả định).

**Đã chốt — đi theo hướng (a)**: join lấy người `role = 'LEAD'` của dòng `schedule_plans` **sớm nhất
theo `start_time`** thuộc đơn đó (dữ liệu mẫu thật hiện chỉ có 1 `schedule_plans`/đơn — task "Lắp đặt
thiết bị" — nên trong thực tế gần như luôn là LEAD của hoạt động lắp đặt) làm "điều phối viên đại
diện" hiển thị trên bảng. Chấp nhận đây là số liệu xấp xỉ (không phải khái niệm chính xác 1-1 khi 1
đơn có nhiều hoạt động với LEAD khác nhau), đổi lại giữ nguyên đúng UI hiện có, không cần sửa lại cột
này trên bảng.

Đề xuất SQL cho phần join này (dùng trong `GET /api/v1/orders/picklists`, mục 5.1):

```sql
SELECT u.full_name AS coordinator_name
FROM schedule_plans sp
JOIN schedule_plan_assignees spa ON spa.plan_id = sp.plan_id AND spa.role = 'LEAD'
JOIN users u ON u.user_id = spa.user_id
WHERE sp.order_id = :orderId
ORDER BY sp.start_time ASC
LIMIT 1;
```

Nếu đơn chưa có `schedule_plans`/`LEAD` nào (chưa lập kế hoạch), trả `coordinatorName = null` — FE
hiển thị "Chưa phân công" thay vì để trống.

**Áp dụng thống nhất**: `docs/danhsachdondat_api.md` mục 4.1 cần cập nhật cùng quyết định này (đã đề
cập lại ở mục 7.2 dưới đây).

### 3.5. Trạng thái xuất kho

| Trạng thái UI | Điều kiện |
|---|---|
| "Chưa xuất kho" (badge xám) | `picked_up_at IS NULL` |
| "Đã xuất {ngày}" (badge xanh lá) | `picked_up_at IS NOT NULL` → hiển thị `formatDate(picked_up_at)` |

### 3.6. Thao tác

| Nút | Hành vi |
|---|---|
| "Xem chi tiết" | Link sang `/manager/orders/:orderId` (tab "Thiết bị & Kho hàng" — đã có tài liệu ở `docs/thietbikhohang_api.md`), không gọi API riêng ở trang này. |
| "Đã xuất kho" | Chỉ hiển thị khi `picked_up_at IS NULL`; chỉ **bấm được** khi đủ điều kiện sẵn sàng (mục 3.2/6) — gọi endpoint mục 5.2. |

## 4. Cột mới cần thêm trên `orders` — theo dõi "đã xuất kho"

Đối chiếu `SHOW CREATE TABLE orders`: không có cột nào tương ứng `pickedUpAt`. Đề xuất thêm, cùng
pattern đã dùng cho "Đóng đơn hàng" (`docs/tiendosukien_api.md` mục 7) và "Xác nhận đã chuẩn bị xong"
(`docs/thietbikhohang_api.md` mục 2b) — cột nullable + endpoint xác nhận riêng, không thêm giá trị enum
mới vào `order_status`:

```sql
ALTER TABLE orders
  ADD COLUMN picked_up_at TIMESTAMP NULL,
  ADD COLUMN picked_up_by VARCHAR(36) NULL,
  ADD CONSTRAINT orders_picked_up_by_fkey FOREIGN KEY (picked_up_by) REFERENCES users(user_id)
    ON DELETE SET NULL ON UPDATE CASCADE;
```

Đây là 1 thay đổi schema nhỏ (2 cột nullable trên bảng đã tồn tại, không phải bảng mới) — theo đúng
mức độ đã áp dụng ở `docs/thietbikhohang_api.md` (không escalate lên `docs/more-require.md`, mục đó
dành cho các gap chặn cả màn hình như bảng `inventory` chưa tồn tại — xem mục (b) file đó).

## 5. Endpoint

### 5.1. `GET /api/v1/orders/picklists` — danh sách + KPI (mới)

```
GET /api/v1/orders/picklists?page=1&limit=20&search=&exportStatus=
```

Response đề xuất:

```jsonc
{
  "data": [
    {
      "orderId": "c1cae042-...",
      "orderCode": "ORD-001",
      "customerName": "Nguyễn Văn A",
      "eventDate": "2026-08-15T02:00:00.000Z",
      "coordinatorName": "Vũ Hoàng Long", // xem mục 3.4 — LEAD của schedule_plans sớm nhất, null nếu chưa phân công
      "totalItemsCount": 4,               // SUM(order_items.quantity) theo order_id
      "preparedItemsCount": 0,            // SUM(order_items.prepared_qty) theo order_id
      "itemsConfirmedAt": null,           // orders.items_confirmed_at (docs/thietbikhohang_api.md mục 2b)
      "pickedUpAt": null,                 // orders.picked_up_at (mục 4)
      "pickedUpByName": null
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalCount": 32,
    "readyCount": 5,      // itemsConfirmedAt IS NOT NULL AND pickedUpAt IS NULL, toàn tập đã lọc
    "exportedCount": 3    // pickedUpAt IS NOT NULL, toàn tập đã lọc
  }
}
```

Lý do dùng 1 endpoint mới thay vì tái dùng `GET /api/v1/orders` hiện có: endpoint đó **không** trả kèm
`orderItems` (chỉ `GET /orders/:id` mới include, theo `types/order.ts` dòng 21-49) — nếu mở rộng
`GET /orders` để luôn tính `SUM(order_items...)` cho mọi lần gọi (kể cả trang danh sách Order thường,
không cần số liệu này) sẽ tốn join không cần thiết ở nơi khác đang dùng chung endpoint đó. Tách endpoint
riêng cho đúng nhu cầu trang này, cùng tinh thần đề xuất "thêm endpoint mới cho nhu cầu tổng hợp riêng"
đã áp dụng ở `docs/danhsachdondat_api.md` mục 2 (`GET /orders/stats`).

### 5.2. `PUT /api/v1/orders/:orderId/picklist/picked-up` — đánh dấu đã xuất kho (mới)

```
PUT /api/v1/orders/:orderId/picklist/picked-up
Body: {} (không cần field)
Response: 204, hoặc order summary đã cập nhật { pickedUpAt, pickedUpByName }
```

Caller: **Manager** (trang này không có mirror Admin — xem đầu file). Ràng buộc backend cần validate
trước khi set `picked_up_at = NOW()`, `picked_up_by = <user gọi>`:

1. `orders.order_status IN ('CONFIRMED', 'IN_PROGRESS')` — nếu không, 409.
2. `orders.picked_up_at IS NULL` — nếu đã xuất kho rồi, 409 (tránh ghi đè `picked_up_by`/`picked_up_at`
   của lần xuất kho trước).
3. `orders.items_confirmed_at IS NOT NULL` — xem mục 6, đây là thay đổi so với hành vi mock hiện tại.

## 6. Điều kiện "sẵn sàng xuất kho" — đề xuất đổi từ tự cộng `prepared_qty` sang dựa vào cột xác nhận đã có

Mock hiện tại (`isAllPrepared` ở `page.tsx` dòng 92, và `readyCount` ở dòng 45) tự tính điều kiện "sẵn
sàng" bằng cách **cộng lại** `preparedQty`/`quantity` của mọi `order_items` ngay tại client. Cách này có
2 vấn đề khi lên dữ liệu thật:

- `docs/thietbikhohang_api.md` mục 2b đã chốt **Manager phải bấm xác nhận riêng** ("Xác nhận đã chuẩn
  bị xong", set `orders.items_confirmed_at`) sau khi Leader Staff báo đủ 100% qua mobile — tức đã có
  sẵn 1 cột phản ánh đúng "Manager đã duyệt", đáng tin hơn việc tự cộng số nguyên trên `order_items` mà
  không biết Manager đã xem qua hay chưa.
- Nếu chỉ dựa vào tổng số (`SUM(prepared_qty) >= SUM(quantity)`), nút "Đã xuất kho" có thể bấm được
  ngay khi Leader Staff vừa cập nhật xong dòng cuối cùng qua mobile, bỏ qua bước duyệt của Manager —
  không đúng nguyên tắc CLAUDE.md mục "Vai trò & phân quyền" ("Leader Staff ghi nhận trước, Manager chỉ
  xác nhận") cho toàn bộ nhóm dữ liệu hiện trường liên quan tới kho.

**Đề xuất (đã áp dụng ở mục 1/5)**: đổi điều kiện "sẵn sàng xuất kho" (cả badge KPI lẫn điều kiện bật
nút "Đã xuất kho") thành `orders.items_confirmed_at IS NOT NULL AND orders.picked_up_at IS NULL` — tái
dùng đúng cột đã chốt ở tài liệu kia, không cần tính lại tổng `order_items` ở tầng này. Khi nút bị
disable do chưa đủ điều kiện, tooltip nên đổi nội dung tương ứng: "Cần Manager xác nhận đã chuẩn bị
xong ở tab 'Thiết bị & Kho hàng' trước khi xuất kho" (khác tooltip mock hiện tại "Cần chuẩn bị đủ 100%
thiết bị trước khi xuất kho" — không sai nhưng chưa phản ánh đúng bước cần làm là bấm nút xác nhận, không
chỉ là tự động đủ số).

## 7. Tổng hợp

### 7.1. API cần Backend implement

1. **`GET /api/v1/orders/picklists`** (mục 5.1) — endpoint mới, trả `data[]` (join `orders` +
   `customers.customer_name` + `SUM(order_items.quantity/prepared_qty)` + tuỳ quyết định mục 3.4) và
   `meta` gồm `totalCount`/`readyCount`/`exportedCount`; filter cố định `orderStatus IN ('CONFIRMED',
   'IN_PROGRESS')`, hỗ trợ `search`/`exportStatus`/`page`/`limit` (mục 2).
2. **`PUT /api/v1/orders/:orderId/picklist/picked-up`** (mục 5.2) — set `picked_up_at`/`picked_up_by`,
   validate theo mục 5.2/6 (bắt buộc `items_confirmed_at` đã có trước).
3. **2 cột mới `orders.picked_up_at`/`orders.picked_up_by`** (mục 4).
4. Không cần bảng `picklists` mới — mã phiếu sinh phía client (mục 3.1).

### 7.2. Đã chốt hết (2026-07-20) — không còn mục nào chờ Product quyết định thêm

1. **Cột "Điều phối viên"** (mục 3.4): đi theo hướng (a) — join `schedule_plan_assignees` lấy `LEAD`
   của `schedule_plans` sớm nhất theo `start_time`. `docs/danhsachdondat_api.md` mục 4.1 đã được cập
   nhật cùng quyết định này (2026-07-20) — 2 tài liệu nhất quán, không còn lệch nhau.
2. Toàn bộ tài liệu (mục 1-6) đã chốt, Backend có thể implement ngay không cần chờ thêm.

## 8. Cập nhật 2026-07-21 — `picked_up_at` giờ còn được ghi bởi luồng "Xuất thiết bị từ báo giá"

Ngoài endpoint `PUT /orders/:orderId/picklist/picked-up` của màn này (mục 5.2, giữ nguyên không đổi),
cột `orders.picked_up_at`/`picked_up_by` giờ còn được set bởi **`POST /api/v1/orders/:orderId/
export-equipment`** — luồng bấm "Xuất thiết bị" từ trang chi tiết báo giá, spec đầy đủ (phiên bản v2:
đồng bộ đơn theo báo giá + xuất bù/thu hồi chênh lệch, **chạy lặp lại được**) ở
[`docs/xuatthietbi_tubaogia_api.md`](xuatthietbi_tubaogia_api.md) mục 4. Ảnh hưởng tới màn Pick-list:

1. **Ngữ nghĩa `picked_up_at` đổi từ "thời điểm xuất kho (1 lần duy nhất)" thành "lần xuất/đồng bộ
   gần nhất"** — endpoint export-equipment v2 được phép ghi đè giá trị cũ mỗi lần chạy có phát sinh
   movement. Badge "Đã xuất {ngày}" (mục 3.5) và KPI `exportedCount` (mục 1) không cần đổi công thức,
   chỉ cần hiểu ngày hiển thị là lần gần nhất.
2. Đơn có thể ở trạng thái "Đã xuất kho" trên bảng này **mà chưa từng đi qua nút "Đã xuất kho" của
   màn Pick-list** (xuất thẳng từ báo giá khi đơn còn `NEW`, không cần `prepared_qty` đủ) — đây là
   hành vi chủ đích, 2 luồng dùng chung 1 cờ để 2 màn không lệch số liệu.
3. Điều kiện chặt của `picklist/picked-up` (mục 5.2: đúng trạng thái, chuẩn bị đủ, chưa xuất) giữ
   nguyên cho màn này — riêng nó vẫn 409 khi `picked_up_at` đã có, vì bấm từ Pick-list không có ngữ
   nghĩa "đồng bộ lại theo báo giá" như luồng kia.
