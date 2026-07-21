# API cho tab "Lịch timeline" (`/manager/schedule/plans`, tab `timeline`)

> **Trạng thái: ĐÃ KẾT NỐI BACKEND THẬT (2026-07-21).** Toàn bộ nội dung tài liệu này ban đầu là đề xuất
> (viết 2026-07-20, khi `dateFrom`/`dateTo` và các field join còn chưa tồn tại) — test lại bằng `curl` với
> backend thật ngày 2026-07-21 xác nhận **Backend đã tự triển khai đầy đủ đúng y hệt đề xuất** ở mục 2-3
> dưới đây, không cần chờ gì thêm. FE đã nối thật vào `src/app/manager/schedule/plans/page.tsx` (mirror
> `src/app/admin/coordination/planning/page.tsx`) và `src/utils/schedulePlanGroups.ts` (hàm
> `getGroupTimelineRange` — xử lý đúng mục 3). Các mục "còn mở/chưa chốt" ở bản gốc nay đã có quyết định
> cuối cùng, xem mục 5 đã cập nhật lại. Giữ nguyên phần phân tích gốc bên dưới làm tài liệu tham chiếu.
>
> Phạm vi tài liệu này: **chỉ riêng tab "Lịch timeline"** trong trang "Kế hoạch và phân công" (đúng theo
> ảnh chụp màn hình người dùng cung cấp — bảng timeline 10 ngày, mỗi hàng 1 đơn hàng, thanh ngang màu
> theo trạng thái, click thanh mở drawer chi tiết). Đây là 1 trong 3 tab của trang; 2 tab còn lại ("Lịch
> điều phối", "Danh sách kế hoạch") đã có tài liệu riêng và **đầy đủ hơn** ở
> [`docs/kehoachvaphancong_api.md`](kehoachvaphancong_api.md) (cũng đã kết nối backend thật, cùng đợt) —
> tài liệu đó cũng đã phân tích chung 1 lần cho cả 3 tab (kể cả tab này, ở mục 4) cùng nền tảng DB dùng
> chung (mục 1-2, 6-7, 9). Tài liệu **này** trích xuất và trình bày lại phần liên quan tới riêng tab Lịch
> timeline thành 1 file độc lập — không phân tích lại từ đầu, chỉ dẫn chiếu ngược khi cần chi tiết sâu hơn.
>
> Nguồn tham chiếu:
> - FE (đã nối thật, 2026-07-21; công thức khoảng ngày đổi lại cùng ngày — xem hộp lưu ý cuối mục 1):
>   `src/app/manager/schedule/plans/page.tsx` (mirror `src/app/admin/coordination/planning/page.tsx`) —
>   khối `activeTab === 'timeline'` giờ đọc `groups` (kết quả `groupPlansByOrder()`) thay vì mock `plans[]`
>   cũ; `src/utils/schedulePlanGroups.ts` — `groupPlansByOrder()`, `getGroupMinMaxRange()` (đúng công thức
>   mục 3, dùng chung cho cả tab timeline và tab "Danh sách kế hoạch" — đã xóa hàm riêng
>   `getGroupTimelineRange()` vì 2 tab giờ dùng chung 1 công thức), `getGroupStatusInfo()` (thuật toán mục
>   3 điểm 4/mục 5.1). Click thanh mở `src/components/planning/PlanDetailDrawer.tsx` (viết lại, nhận prop
>   `group: OrderPlanGroup` thay vì `plan: SchedulePlan` mock cũ) — vẫn đúng nguyên tắc không gọi thêm API
>   khi mở drawer (mục 4).
> - Type: `src/types/schedulePlan.ts` (`SchedulePlan` đã bổ sung `eventDate`/`orderLocation`/
>   `dateFrom`/`dateTo` theo đúng đề xuất mục 2.1/2.2 — xem comment "Đính chính 2026-07-21" đầu file).
> - Mock cũ (không còn dùng cho tab này): `src/mocks/db/schedulePlans.ts`.
> - DB thật: đối chiếu qua MySQL MCP ngày 2026-07-20, **test lại bằng `curl` trực tiếp ngày 2026-07-21**
>   (không qua MCP) để xác nhận hành vi API thật — dữ liệu mẫu tại thời điểm test đã có nhiều hơn (nhiều
>   order/`schedule_plans` hơn bản ghi ban đầu `ORD-001`/`PLN-001`), xem ví dụ response thật ở mục 2.2.
> - `docs/api/` không có tài liệu riêng cho `schedule-plans` trong repo hiện tại — dùng comment đầu
>   `types/schedulePlan.ts` + đối chiếu schema DB thật làm căn cứ chính.

## 0. Base URL & Auth

Base path `/api/v1`, JWT Bearer theo `AuthContext` hiện có.

## 1. Tổng quan cách tab này dựng dữ liệu (mock hiện tại)

Tab hiển thị **lưới N=10 ngày × M đơn hàng**, mỗi đơn 1 hàng, vẽ 1 thanh ngang liên tục từ ngày sớm nhất
đến ngày muộn nhất trong các hoạt động của đơn đó, chỉ vẽ những đơn có khoảng ngày **giao (overlap)** với
cửa sổ 10 ngày đang xem:

1. `timelineAnchor` — ngày neo đầu cửa sổ, mặc định = ngày bắt đầu sớm nhất trong toàn bộ `plans` (dòng
   126-130); nút "Kỳ trước"/"Kỳ sau" dịch ±7 ngày, nút "Hôm nay" nhảy về `todayStr`.
2. `timelineDays` = 10 ngày liên tiếp kể từ `timelineAnchor` (hằng số `TIMELINE_DAY_COUNT = 10`).
3. `planDateRange(plan)` = `[min(activities[].date), max(activities[].date)]` — khoảng ngày của **1 đơn**
   (mock gộp nhiều "hoạt động" của cùng đơn thành 1 khoảng).
4. `timelineRows` = lọc `plans` có `range` giao với `[timelineDays[0], timelineDays.at(-1)]`, sort theo
   `range[0]` tăng dần.
5. Mỗi hàng vẽ 1 nút (button) chiếm từ cột `startCol` đến `endCol` (tính bằng `dateDiffInDays`), có màu
   nền/màu chữ theo `getPlanStatusInfo(plan).badgeClass` (badge màu theo trạng thái tổng hợp — xem mục 4),
   chấm tròn nhỏ đầu hàng theo `dotColorClass`.
6. Click vào thanh → mở `PlanDetailDrawer` với đúng `plan` đã có sẵn trong bộ nhớ (không gọi thêm API).

> **ĐỔI QUYẾT ĐỊNH (2026-07-21, theo yêu cầu người dùng) — không còn dùng `event_date` làm mép trái.**
> Quyết định cũ ("đã chốt với người dùng 2026-07-20": `rangeStart = orders.event_date`) đã bị **thay
> thế**. Khoảng ngày của 1 thanh timeline giờ tính giống hệt cột "Ngày thi công" ở tab "Danh sách kế
> hoạch" (`docs/kehoachvaphancong_api.md` mục 4/5) — **`rangeStart = MIN(schedule_plans.start_time)`**
> và **`rangeEnd = MAX(schedule_plans.end_time)`**, tính trên toàn bộ dòng `schedule_plans` cùng
> `order_id`, không phân biệt loại việc (khảo sát/lắp đặt/thu hồi). Hệ quả: các dòng công việc diễn ra
> **trước** `event_date` (ví dụ khảo sát hiện trường làm trước ngày sự kiện nhiều ngày) **giờ kéo dài mép
> trái của thanh** — khác hẳn hành vi cũ (bỏ qua các dòng trước `event_date`). Không còn khác biệt về
> công thức so với `docs/kehoachvaphancong_api.md` mục 4/5 nữa — 2 tài liệu giờ dùng chung 1 công thức,
> chỉ khác mục đích sử dụng (tab timeline vẽ thanh, tab danh sách hiện text). FE đã đổi code (2026-07-21):
> gộp lại dùng chung `getGroupMinMaxRange()` trong `src/utils/schedulePlanGroups.ts` cho cả 2 tab, xóa
> hẳn hàm `getGroupTimelineRange()` (không còn cần thiết vì công thức giờ giống hệt nhau).

## 2. Endpoint đọc dữ liệu — 1 endpoint duy nhất cần cho tab này

```
GET /api/v1/schedule-plans?dateFrom={YYYY-MM-DD}&dateTo={YYYY-MM-DD}
```

> **Xác nhận bằng `curl` thật (2026-07-21): endpoint này hoạt động, nhưng lọc theo công thức CŨ.**
> `dateFrom`/`dateTo` phía backend hiện lọc theo khoảng `[orders.event_date, MAX(schedule_plans.
> end_time)]` (test bằng cách gọi `?dateFrom=2026-08-01&dateTo=2026-08-31` — chỉ trả về đúng đơn có
> `event_date` rơi vào tháng 8) — **đây là công thức đã bị thay thế** (xem hộp lưu ý cuối mục 1). Vì FE
> hiện tại (2026-07-21) **không dùng `dateFrom`/`dateTo` khi gọi** — thay vào đó gọi 1 lần `GET
> /schedule-plans` không tham số để lấy toàn bộ dữ liệu, rồi tự tính cửa sổ 10 ngày + lọc theo công thức
> mới (`MIN(start_time)`/`MAX(end_time)`) hoàn toàn phía client — sự khác biệt này **chưa gây vấn đề gì**
> ở quy mô demo hiện tại. Nhưng nếu sau này đổi sang dùng `dateFrom`/`dateTo` thật để giảm dữ liệu tải về
> (khi số lượng đơn lớn lên), Backend cần sửa lại SQL lọc ở mục 2.1 theo đúng công thức mới trước, nếu
> không kết quả lọc server-side sẽ sai lệch so với những gì FE thật sự cần hiển thị.

### 2.1 Vì sao không dùng nguyên `GetSchedulePlansQuery` hiện tại (bản gốc trước khi nối API thật)

`types/schedulePlan.ts` hiện chỉ có `date?: string` (đúng **1 ngày**), không có `dateFrom`/`dateTo`. Tab
này cần lấy dữ liệu cho **cả cửa sổ 10 ngày** trong 1 lần gọi (không lặp gọi 10 lần theo từng ngày, và khi
bấm "Kỳ trước/Kỳ sau" cũng chỉ nên gọi lại đúng 1 lần cho cửa sổ mới) — cần bổ sung 2 param mới:

| Param | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `dateFrom` | `YYYY-MM-DD` | Có | = `timelineDays[0]` |
| `dateTo` | `YYYY-MM-DD` | Có | = `timelineDays.at(-1)` |
| `orderId` | `string` | Không | **Bỏ trống** để lấy toàn bộ đơn trong khoảng ngày — khác cách dùng hiện tại (tài liệu `docs/lichtrinhkythuat_api.md` luôn truyền `orderId` vì ở trang chi tiết 1 đơn) |
| `page`, `limit` | — | Không dùng | Tab timeline không phân trang, cần lấy hết dòng khớp điều kiện trong 1 lần |

**Điều kiện lọc theo Backend CẦN SỬA LẠI (nếu triển khai `dateFrom`/`dateTo` server-side) — lọc ở tầng
ĐƠN HÀNG, không phải tầng dòng `schedule_plans`**: với mỗi `order_id`, tính `rangeStart =
MIN(schedule_plans.start_time)` và `rangeEnd = MAX(schedule_plans.end_time)` trong số các dòng của đơn
đó, rồi xét đơn có rơi vào cửa sổ hay không bằng khoảng `[rangeStart, rangeEnd]` — **đã đổi so với bản
gốc** (bản gốc dùng `orders.event_date` làm `rangeStart`, xem hộp lưu ý cuối mục 1):

```sql
-- 1) Xác định các order_id có [MIN(start_time), MAX(end_time)] giao [dateFrom, dateTo]
SELECT sp.order_id
FROM schedule_plans sp
GROUP BY sp.order_id
HAVING MIN(DATE(sp.start_time)) <= :dateTo
   AND MAX(DATE(COALESCE(sp.end_time, sp.start_time))) >= :dateFrom

-- 2) Trả về TOÀN BỘ dòng schedule_plans của các order_id ở bước 1 (không lọc riêng từng dòng
--    theo dateFrom/dateTo), để FE có đủ dữ liệu tính lại range chính xác và hiển thị đầy đủ trong
--    drawer chi tiết khi click vào thanh.
```

**Lưu ý quan trọng**: SQL này hiện **chưa được Backend triển khai** — endpoint thật vẫn đang lọc theo
công thức cũ (`event_date`, xem hộp lưu ý đầu mục 2). Vì FE hiện không dùng `dateFrom`/`dateTo` (tự lọc
100% phía client theo dữ liệu đã tải hết), sự sai lệch này **chưa ảnh hưởng gì tới demo hiện tại** — chỉ
cần sửa khi có nhu cầu tối ưu chuyển lọc sang server-side.

### 2.2 Field bắt buộc phải join sẵn vào từng dòng response

Vì tab này hiển thị **nhiều đơn cùng lúc**, không có trang chi tiết đơn bao quanh để lấy thêm thông tin,
response mỗi dòng `schedule_plans` bắt buộc phải kèm theo (join sẵn phía Backend, tránh FE gọi N+1 lần
`GET /orders/:id`):

| Field trả về | Nguồn JOIN | Dùng để hiển thị |
|---|---|---|
| `planId`, `planCode`, `orderId`, `taskId`, `startTime`, `endTime`, `location`, `status`, `notes` | `schedule_plans` (đã có sẵn trong type) | Cột giờ/trạng thái/vị trí thanh |
| `orderCode` | `orders.order_code` | Nhãn trên thanh (dùng thẳng `order_code` thật, xem mục 3 điểm 3 — đã bỏ ý tưởng `formatTimelineOrderId()` "ĐĐ-0011" của mock) |
| `customerName` | `customers.customer_name` | **Field thật có sẵn ngoài đề xuất ban đầu** — không có trong bảng đề xuất gốc, nhưng Backend đã join kèm |
| `eventName` | `orders.event_name` | Tooltip khi hover thanh (`title="{eventName} — nhấp để xem chi tiết"`) |
| `eventDate` | `orders.event_date` | **Mép trái thanh (`rangeStart`)** — đúng như đề xuất, đã có thật |
| `orderLocation` | `orders.location` | **Field thật có sẵn ngoài đề xuất ban đầu** — địa điểm chung của đơn (khác `location` của từng dòng `schedule_plans`, có thể cụ thể hơn, vd "Kho trung tâm → {venue}") |
| `taskName` | `work_tasks.task_name` | Hiển thị trong drawer chi tiết khi click |
| `assignees` | `schedule_plan_assignees` JOIN `users` — mảng `{ userId, fullName, role, phone, checkInAt, checkOutAt }[]` | Đếm nhân sự / hiển thị trong drawer — **vượt cả đề xuất gốc**: có kèm sẵn `phone` và giờ check-in/check-out thật của từng người (không cần đề xuất thêm cột `actual_start_time`/`actual_end_time` như dự tính trước đó) |

Response thật (test bằng `curl` ngày 2026-07-21, `GET /schedule-plans` không tham số, rút gọn 1 dòng):

```jsonc
{
  "success": true,
  "data": [
    {
      "planId": "dda1fdb9-5769-4fe9-ae63-680cf3fcb954",
      "planCode": "PLN-001",
      "orderId": "f20ddb75-d10a-47f7-a920-196bce3f1dff",
      "orderCode": "ORD-001",
      "customerName": "Tech Corp",
      "eventName": "Tech Summit 2026",
      "eventDate": "2026-08-15T09:00:00.000Z",
      "orderLocation": "123 Tech St. Hall A",
      "taskId": "b8d0cb1b-137c-4370-9943-d0ee7650e04c",
      "taskName": "Lắp đặt thiết bị",
      "startTime": "2026-08-14T14:00:00.000Z",
      "endTime": "2026-08-14T18:00:00.000Z",
      "location": "123 Tech St. Hall A",
      "status": "IN_PROGRESS",
      "notes": null,
      "assignees": [
        { "userId": "45e8ba7f-...", "fullName": "Team Leader", "role": "LEAD", "phone": "0900000003", "checkInAt": null, "checkOutAt": null },
        { "userId": "f1054252-...", "fullName": "Technician", "role": "TECHNICAL", "phone": "0900000004", "checkInAt": "2026-08-14T13:50:00.000Z", "checkOutAt": null }
      ]
    }
  ],
  "meta": { "page": null, "limit": null, "totalItems": 10, "totalPages": null }
}
```

Lưu ý `meta.page`/`meta.limit`/`meta.totalPages` luôn `null` khi không truyền `page`/`limit` — endpoint
không tự phân trang trong trường hợp này (đúng nhu cầu mục 2.1, tab này cần lấy hết dữ liệu 1 lần).

## 3. Gộp dữ liệu phẳng thành 1 hàng/đơn (bắt buộc xử lý phía FE sau khi nhận response)

DB thật **không có** khái niệm "1 kế hoạch = 1 khoảng ngày cho cả đơn" — mỗi dòng `schedule_plans` là 1
mốc việc riêng (1 order + 1 task_id + 1 khoảng giờ). Muốn vẽ đúng 1 thanh ngang/đơn như ảnh mẫu, FE phải:

1. Group toàn bộ dòng trả về theo `orderId`.
2. Với mỗi nhóm: `rangeStart = MIN(DATE(startTime))`, `rangeEnd = MAX(DATE(endTime))` (nếu dòng nào không
   có `endTime` thì coi như kết thúc cùng ngày `startTime` của chính dòng đó) trong các dòng của nhóm —
   **đổi lại (2026-07-21)** so với bản gốc từng dùng `eventDate` làm `rangeStart` (xem hộp lưu ý cuối mục
   1). Công thức này giờ **giống hệt** cách tính ở `docs/kehoachvaphancong_api.md` mục 4/5 — FE dùng
   chung 1 hàm `getGroupMinMaxRange()` (`src/utils/schedulePlanGroups.ts`) cho cả 2 tab, không còn hàm
   riêng cho tab timeline nữa.
3. Mã hiển thị đầu hàng: dùng thẳng `orderCode` thật (`ORD-001`), **bỏ** hàm `formatTimelineOrderId()`
   của mock (đã bỏ khi nối API thật, xem mục 5.1).
4. Trạng thái/màu thanh: suy từ **tập `status`** của mọi dòng trong nhóm (không có cột trạng thái mức
   "đơn" trong DB) — áp dụng đúng thuật toán đã đề xuất ở
   [`docs/kehoachvaphancong_api.md` mục 7](kehoachvaphancong_api.md#7-trạng-thái-tổng-hợp-cho-1-nhóm-kế-hoạch-nhiều-dòng-cùng-đơn--đề-xuất-thuật-toán)
   (6 case: Đã hủy / Chuẩn bị / Đang thực hiện / Hoàn thành / Đã chốt) — đã implement (`getGroupStatusInfo()`),
   vẫn là suy đoán của FE, chưa có xác nhận chính thức từ Product nhưng không có phản hồi khác nên giữ
   nguyên.
5. Cột nhân sự/số việc trong drawer chi tiết: gộp `assignees` của mọi dòng trong nhóm, đếm
   `DISTINCT userId` — đã implement (`distinctAssigneeCount()`/`unionAssignees()`).

## 4. Click thanh → drawer chi tiết — không cần endpoint riêng

**Đã implement đúng như đề xuất.** `PlanDetailDrawer` (viết lại 2026-07-21) chỉ hiển thị lại đúng dữ liệu
của nhóm `orderId` đã có sẵn trong bộ nhớ (props `group: OrderPlanGroup`, set trực tiếp từ state `groups`
đã tải ở trang cha qua `groupByOrderId.get(...)`) — **không** gọi thêm 1 API "GET chi tiết kế hoạch theo
ID" nào khác, đúng nguyên tắc đề xuất ban đầu. Field drawer thật (đối chiếu `PlanDetailDrawer.tsx` +
`src/utils/schedulePlanGroups.ts`):

| Field trong drawer | Nguồn (sau khi group theo mục 3) |
|---|---|
| Mã đơn, tên sự kiện, địa điểm | `orderCode`/`eventName`/`orderLocation` (đã join sẵn ở mục 2.2) |
| "Người lập" | *Chưa có API* — `GET /schedule-plans` chưa join `orders.created_by`, hiện hiển thị in nghiêng "chưa có API" (xem `docs/more-require.md`) |
| Ghi chú cấp nhóm | Lấy `notes` của dòng có `startTime` sớm nhất trong nhóm (quyết định đã chốt ở `docs/chitietkehoach_api.md` mục 6.2) |
| "Các hoạt động & công việc" (1 danh sách duy nhất) | **1 dòng `schedule_plans`/hoạt động** trong nhóm — `taskName`, `startTime`-`endTime`, `location`, `notes`, badge trạng thái riêng từng dòng, `assignees` riêng từng dòng — đã gộp thành 1 danh sách theo đúng quyết định mục 5.2 điểm 3 (không còn tách "hoạt động chính" và "công việc & phân công" như mock) |
| "Nhân sự tham gia" | `assignees` gộp toàn nhóm (`unionAssignees()`, ưu tiên vai trò của dòng sớm nhất nếu 1 người trùng ở nhiều dòng), hiển thị `fullName` + nhãn vai trò tiếng Việt (`LEAD`→"Trưởng nhóm", `TECHNICAL`→"Kỹ thuật viên") |
| Badge trạng thái đầu drawer | Trạng thái tổng hợp theo mục 3 điểm 4 (`getGroupStatusInfo()`) |

Mock cũ có "Danh sách công việc & phân công" (`plan.tasks[]`, có `assignee`+`team[]` riêng biệt với
`activities[]`) — theo phát hiện đã chốt ở `docs/kehoachvaphancong_api.md` mục 1, DB thật **không phân
biệt** "hoạt động" và "công việc" thành 2 khái niệm khác nhau, cả hai đều là 1 dòng `schedule_plans` —
drawer thật đã đổi sang **1 danh sách duy nhất** như mô tả ở bảng trên.

## 5. Tổng hợp nhanh cho Backend

### 5.1 Đã kết nối, đang chạy đúng với dữ liệu thật (2026-07-21) — không cần Backend làm gì thêm cho phần đọc dữ liệu

1. `dateFrom`/`dateTo` đã hoạt động trên `GET /schedule-plans` (dù FE hiện chưa dùng tới, xem mục 2), bỏ
   trống `orderId` trả về nhiều đơn — đúng đề xuất mục 2.1.
2. `GET /schedule-plans` trả kèm `orderCode`, `customerName`, `eventName`, `eventDate`, `orderLocation`,
   `taskName`, `assignees[]` (kèm `phone`/`checkInAt`/`checkOutAt`) join sẵn trong mỗi dòng — vượt cả yêu
   cầu tối thiểu ở mục 2.2, tránh N+1 request hoàn toàn.
3. Mã đơn hiển thị trên thanh dùng thẳng `order_code` thật (`ORD-001`) — đã bỏ hẳn
   `formatTimelineOrderId()` kiểu `ĐĐ-0011` của mock.
4. Gộp "hoạt động" và "công việc phân công" thành 1 danh sách duy nhất trong drawer — đã implement theo
   đúng quyết định chốt ở `docs/chitietkehoach_api.md` mục 6.3 (xem mục 4).
5. Thuật toán suy trạng thái tổng hợp theo nhóm đơn (mục 3 điểm 4) — đã áp dụng vào code
   (`getGroupStatusInfo()`), không có phản hồi khác từ Product nên giữ nguyên, có thể điều chỉnh sau nếu
   cần.

### 5.2 ĐỔI quyết định (2026-07-21) — công thức tính khoảng ngày thanh timeline

Quyết định cũ ("đã chốt 2026-07-20": `rangeStart = orders.event_date`) đã bị **thay bằng**
`rangeStart = MIN(schedule_plans.start_time)` theo yêu cầu người dùng — xem hộp lưu ý cuối mục 1 và SQL
đã sửa ở mục 2.1. Ảnh hưởng:

1. **FE đã đổi xong** (2026-07-21) — dùng chung 1 hàm `getGroupMinMaxRange()` cho cả tab "Danh sách kế
   hoạch" và tab "Lịch timeline", xóa hẳn hàm `getGroupTimelineRange()` cũ (không còn 2 công thức khác
   nhau giữa 2 tab nữa).
2. **Backend CHƯA cần sửa gì ngay** — vì FE không dùng `dateFrom`/`dateTo` để lọc server-side (tự lọc hết
   phía client sau khi tải toàn bộ dữ liệu), endpoint thật vẫn đang lọc theo công thức cũ khi có truyền
   `dateFrom`/`dateTo` nhưng điều đó không ảnh hưởng gì tới tab này ở quy mô demo hiện tại. Chỉ cần
   Backend sửa lại SQL mục 2.1 khi nào FE thật sự chuyển sang dùng `dateFrom`/`dateTo` server-side (lúc
   dữ liệu lớn lên, cần tối ưu giảm tải).

### 5.3 Gap còn lại (không thuộc phạm vi tab Lịch timeline, ghi chú để không nhầm là đã xong)

- "Người lập" (field ở drawer chi tiết) vẫn chưa có API join — xem mục 4, đã ghi vào `docs/more-require.md`.
- Luồng "đơn đặt ảo từ báo giá" (lập lịch khảo sát khi báo giá chưa có Order thật) vẫn chưa làm được, chờ
  Backend đổi schema — thuộc phạm vi tab "Lập/Sửa kế hoạch", xem `docs/kehoachvaphancong_api.md` mục 8.1/12.

Các mục trên kế thừa/áp dụng nguyên các quyết định nền tảng đã có ở
[`docs/kehoachvaphancong_api.md`](kehoachvaphancong_api.md) mục 1 (kế hoạch không phải 1 entity lưu trữ
thật), mục 6 (danh sách bổ sung `GetSchedulePlansQuery` — đã có thật), mục 9 (xác nhận/hủy từng dòng qua
`PATCH /schedule-plans/:id/status`) — không lặp lại phân tích ở đây, tham khảo file đó khi cần chi tiết
sâu hơn ngoài phạm vi riêng tab Lịch timeline.
