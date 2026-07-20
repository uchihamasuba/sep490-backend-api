# API cho tab "Lịch timeline" (`/manager/schedule/plans`, tab `timeline`)

> Phạm vi tài liệu này: **chỉ riêng tab "Lịch timeline"** trong trang "Kế hoạch và phân công" (đúng theo
> ảnh chụp màn hình người dùng cung cấp — bảng timeline 10 ngày, mỗi hàng 1 đơn hàng, thanh ngang màu
> theo trạng thái, click thanh mở drawer chi tiết). Đây là 1 trong 3 tab của trang; 2 tab còn lại ("Lịch
> điều phối", "Danh sách kế hoạch") đã có tài liệu riêng và **đầy đủ hơn** ở
> [`docs/kehoachvaphancong_api.md`](kehoachvaphancong_api.md) — tài liệu đó cũng đã phân tích chung 1 lần
> cho cả 3 tab (kể cả tab này, ở mục 4) cùng nền tảng DB dùng chung (mục 1-2, 6-7, 9). Tài liệu **này**
> trích xuất và trình bày lại phần liên quan tới riêng tab Lịch timeline thành 1 file độc lập, dễ đưa cho
> Backend đọc nhanh mà không cần đọc hết 300 dòng của tài liệu tổng — **không phân tích lại từ đầu**, chỉ
> dẫn chiếu ngược khi cần chi tiết sâu hơn.
>
> Nguồn tham chiếu:
> - FE: `src/app/manager/schedule/plans/page.tsx` dòng 492-589 (khối `activeTab === 'timeline'`), cùng các
>   hàm dùng chung phía trên: `planDateRange()` (dòng 62-67), `timelineAnchor`/`timelineDays`/
>   `timelineRows` (dòng 126-139), `formatTimelineOrderId()` (dòng 42-44), `dateDiffInDays()` (dòng 69-71).
>   Click thanh mở `src/components/planning/PlanDetailDrawer.tsx` (toàn bộ) — dùng lại state
>   `selectedPlanDetail` đã set sẵn ở trang cha, không gọi thêm API nào khi mở drawer.
> - Type: `src/types/schedulePlan.ts` (`SchedulePlan`, `ScheduleStatus`, `GetSchedulePlansQuery`).
> - Mock (nguồn dữ liệu UI hiện tại): `src/mocks/db/schedulePlans.ts` (`SchedulePlan`/`PlanActivity`/
>   `PlanWorkTask`/`PlanStaffMember`/`getPlanStatusInfo`).
> - DB thật: đối chiếu qua MySQL MCP ngày 2026-07-20 — `SHOW CREATE TABLE schedule_plans /
>   schedule_plan_assignees / orders / work_tasks / users`; dữ liệu mẫu thật hiện có đúng 1 order
>   (`ORD-001`, `order_status = CONFIRMED`), 1 `schedule_plans` (`PLN-001`, `task_id → "Lắp đặt thiết
>   bị"`, `status = IN_PROGRESS`, `start_time = 2026-08-14 07:00`, `end_time = 2026-08-14 11:00`), 2
>   `schedule_plan_assignees` (1 `LEAD`, 1 `TECHNICAL`).
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

> **Đã chốt với người dùng (2026-07-20) — điểm khác biệt quan trọng nhất so với
> [`docs/kehoachvaphancong_api.md`](kehoachvaphancong_api.md) mục 4**: khoảng ngày của 1 thanh timeline
> **không** tính bằng `MIN(start_time)`/`MAX(end_time)` của mọi dòng `schedule_plans` cùng đơn (cách tài
> liệu kia đang mô tả) — mà tính bằng **`rangeStart = orders.event_date`** (ngày diễn ra sự kiện chính,
> ví dụ ngày cưới) **và `rangeEnd = MAX(schedule_plans.end_time)`** (ngày kết thúc — mốc muộn nhất trong
> các dòng công việc của đơn, ví dụ ngày hoàn tất thu hồi/dọn dẹp). Hệ quả: các dòng công việc diễn ra
> **trước** `event_date` (ví dụ khảo sát hiện trường làm trước ngày cưới nhiều ngày) **không** kéo dài mép
> trái của thanh và **không** được tính khi xét 1 đơn có rơi vào cửa sổ [dateFrom, dateTo] đang xem hay
> không — chỉ khoảng `[event_date, rangeEnd]` mới quyết định việc đó. Toàn bộ mục 2-3 dưới đây áp dụng
> đúng quyết định này, khác với cách nhìn ở tài liệu kia.

## 2. Endpoint đọc dữ liệu — 1 endpoint duy nhất cần cho tab này

```
GET /api/v1/schedule-plans?dateFrom={YYYY-MM-DD}&dateTo={YYYY-MM-DD}
```

### 2.1 Vì sao không dùng nguyên `GetSchedulePlansQuery` hiện tại

`types/schedulePlan.ts` hiện chỉ có `date?: string` (đúng **1 ngày**), không có `dateFrom`/`dateTo`. Tab
này cần lấy dữ liệu cho **cả cửa sổ 10 ngày** trong 1 lần gọi (không lặp gọi 10 lần theo từng ngày, và khi
bấm "Kỳ trước/Kỳ sau" cũng chỉ nên gọi lại đúng 1 lần cho cửa sổ mới) — cần bổ sung 2 param mới:

| Param | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `dateFrom` | `YYYY-MM-DD` | Có | = `timelineDays[0]` |
| `dateTo` | `YYYY-MM-DD` | Có | = `timelineDays.at(-1)` |
| `orderId` | `string` | Không | **Bỏ trống** để lấy toàn bộ đơn trong khoảng ngày — khác cách dùng hiện tại (tài liệu `docs/lichtrinhkythuat_api.md` luôn truyền `orderId` vì ở trang chi tiết 1 đơn) |
| `page`, `limit` | — | Không dùng | Tab timeline không phân trang, cần lấy hết dòng khớp điều kiện trong 1 lần |

**Điều kiện lọc theo Backend cần cài đặt — lọc ở tầng ĐƠN HÀNG, không phải tầng dòng
`schedule_plans`**: với mỗi `order_id`, tính `rangeEnd = MAX(schedule_plans.end_time)` trong số các dòng
của đơn đó, rồi xét đơn có rơi vào cửa sổ hay không bằng khoảng `[orders.event_date, rangeEnd]` (không
phải khoảng riêng của từng dòng):

```sql
-- 1) Xác định các order_id có [event_date, rangeEnd] giao [dateFrom, dateTo]
SELECT sp.order_id
FROM schedule_plans sp
JOIN orders o ON o.order_id = sp.order_id
GROUP BY sp.order_id, o.event_date
HAVING DATE(o.event_date) <= :dateTo
   AND GREATEST(DATE(o.event_date), MAX(DATE(sp.end_time))) >= :dateFrom

-- 2) Trả về TOÀN BỘ dòng schedule_plans của các order_id ở bước 1 (không lọc riêng từng dòng
--    theo dateFrom/dateTo) — kể cả dòng có start_time/end_time nằm ngoài cửa sổ đang xem (ví dụ khảo
--    sát làm trước event_date rất lâu), để FE có đủ dữ liệu tính rangeEnd chính xác và hiển thị đầy đủ
--    trong drawer chi tiết khi click vào thanh.
```

`GREATEST(...)` để phòng trường hợp hiếm: mọi dòng `schedule_plans` của đơn đều kết thúc **trước**
`event_date` (dữ liệu nhập lộn/đơn hủy giữa chừng) — khi đó `rangeEnd` không được nhỏ hơn `event_date`,
tránh vẽ thanh có chiều dài âm.

### 2.2 Field bắt buộc phải join sẵn vào từng dòng response

Vì tab này hiển thị **nhiều đơn cùng lúc**, không có trang chi tiết đơn bao quanh để lấy thêm thông tin,
response mỗi dòng `schedule_plans` bắt buộc phải kèm theo (join sẵn phía Backend, tránh FE gọi N+1 lần
`GET /orders/:id`):

| Field trả về | Nguồn JOIN | Dùng để hiển thị |
|---|---|---|
| `planId`, `planCode`, `orderId`, `taskId`, `startTime`, `endTime`, `location`, `status`, `notes` | `schedule_plans` (đã có sẵn trong type) | Cột giờ/trạng thái/vị trí thanh |
| `orderCode` | `orders.order_code` | Nhãn trên thanh (`ĐĐ-0011`, format lại từ `order_code` — xem mục 3) |
| `eventName` | `orders.event_name` | Tooltip khi hover thanh (`title="{eventName} — nhấp để xem chi tiết"`) |
| `eventDate` | `orders.event_date` | **Mép trái thanh (`rangeStart`)** — xem mục 3, field mới bắt buộc phải có so với `docs/kehoachvaphancong_api.md` |
| `taskName` | `work_tasks.task_name` | Hiển thị trong drawer chi tiết khi click |
| `assignees` | `schedule_plan_assignees` JOIN `users` — mảng `{ userId, fullName, role }[]` | Đếm nhân sự / hiển thị trong drawer |

Đề xuất response mẫu cho 1 dòng:

```jsonc
{
  "planId": "8496fed7-9d53-47fe-b1f6-e04c3d83b015",
  "planCode": "PLN-001",
  "orderId": "c1cae042-93c9-4e0a-9ce3-673424e8adc9",
  "orderCode": "ORD-001",
  "eventName": "Tech Summit 2026",
  "eventDate": "2026-08-15T02:00:00.000Z",
  "taskId": "588876ec-92ce-4ab8-b150-d9b0fd131027",
  "taskName": "Lắp đặt thiết bị",
  "startTime": "2026-08-14T07:00:00.000Z",
  "endTime": "2026-08-14T11:00:00.000Z",
  "location": "123 Tech St. Hall A",
  "status": "IN_PROGRESS",
  "notes": null,
  "assignees": [
    { "userId": "60aec29a-...", "fullName": "Lê Văn Leader", "role": "LEAD" },
    { "userId": "23f6d0bc-...", "fullName": "Trần Văn Tech", "role": "TECHNICAL" }
  ]
}
```

## 3. Gộp dữ liệu phẳng thành 1 hàng/đơn (bắt buộc xử lý phía FE sau khi nhận response)

DB thật **không có** khái niệm "1 kế hoạch = 1 khoảng ngày cho cả đơn" — mỗi dòng `schedule_plans` là 1
mốc việc riêng (1 order + 1 task_id + 1 khoảng giờ). Muốn vẽ đúng 1 thanh ngang/đơn như ảnh mẫu, FE phải:

1. Group toàn bộ dòng trả về theo `orderId`.
2. Với mỗi nhóm: `rangeStart = DATE(eventDate)` (lấy từ field `eventDate` — giống nhau ở mọi dòng cùng
   đơn, chỉ cần đọc từ dòng bất kỳ trong nhóm), `rangeEnd = MAX(DATE(endTime))` trong các dòng của nhóm
   (dùng `Math.max(rangeStart, rangeEnd)` phía FE để phòng edge case `GREATEST` ở mục 2.1) — **thay hẳn**
   cách tính `planDateRange()` của mock (`MIN`/`MAX` của `activities[].date`) và khác cách tính
   `rangeStart` ở `docs/kehoachvaphancong_api.md` mục 4 (dùng `MIN(start_time)`).
3. Mã hiển thị đầu hàng: dùng thẳng `orderCode` thật (`ORD-001`), **bỏ** hàm `formatTimelineOrderId()`
   hiện đang biến đổi `DD0001 → ĐĐ-0001` (đây là mã tự sinh của mock, không khớp format `order_code` thật
   — cần thống nhất lại với Product/Backend format hiển thị mã đơn trên UI, ví dụ giữ nguyên `ORD-001` hay
   đổi prefix hiển thị riêng ở FE).
4. Trạng thái/màu thanh: suy từ **tập `status`** của mọi dòng trong nhóm (không có cột trạng thái mức
   "đơn" trong DB) — áp dụng đúng thuật toán đã đề xuất ở
   [`docs/kehoachvaphancong_api.md` mục 7](kehoachvaphancong_api.md#7-trạng-thái-tổng-hợp-cho-1-nhóm-kế-hoạch-nhiều-dòng-cùng-đơn--đề-xuất-thuật-toán)
   (6 case: Đã hủy / Chuẩn bị / Đang thực hiện / Hoàn thành / Đã chốt), **chưa được Backend/Product xác
   nhận** — cần chốt trước khi implement màu thanh thật.
5. Cột nhân sự/số việc trong drawer chi tiết: gộp `assignees` của mọi dòng trong nhóm, đếm
   `DISTINCT userId`.

## 4. Click thanh → drawer chi tiết — không cần endpoint riêng

`PlanDetailDrawer` chỉ hiển thị lại đúng dữ liệu của nhóm `orderId` đã có sẵn trong bộ nhớ từ bước gọi
`GET /schedule-plans` ở mục 2 (state `selectedPlanDetail` set trực tiếp từ `plan` trong `timelineRows`,
`page.tsx` dòng 566) — **không** gọi thêm 1 API "GET chi tiết kế hoạch theo ID" nào khác. Field drawer cần
(đối chiếu `PlanDetailDrawer.tsx`):

| Field trong drawer | Nguồn (sau khi group theo mục 3) |
|---|---|
| Mã đơn, tên sự kiện, địa điểm, ghi chú | `orderCode`/`eventName` (từ `orders`), `location`/`notes` (dòng đầu nhóm hoặc dòng đang được click) |
| "Các hoạt động chính" (mỗi hoạt động: loại việc, giờ, địa điểm, ghi chú) | **1 dòng `schedule_plans`/hoạt động** trong nhóm — `taskName`, `startTime`-`endTime`, `location`, `notes` của từng dòng |
| "Nhân sự tham gia" | `assignees` gộp toàn nhóm, hiển thị `fullName` + `role` (`LEAD`/`TECHNICAL`) |
| Badge trạng thái đầu drawer | Trạng thái tổng hợp theo mục 3 điểm 4 |

Mock hiện có thêm "Danh sách công việc & phân công" (`plan.tasks[]`, có `assignee`+`team[]` riêng biệt với
`activities[]`) — theo phát hiện đã chốt ở `docs/kehoachvaphancong_api.md` mục 1, DB thật **không phân
biệt** "hoạt động" và "công việc" thành 2 khái niệm khác nhau, cả hai đều là 1 dòng `schedule_plans` —
drawer thật chỉ cần **1 danh sách duy nhất** (đổi tên mục là "Các hoạt động chính" hay "Công việc" tùy
Product chọn, nhưng dữ liệu nguồn là 1, không tách 2 mảng như mock).

## 5. Tổng hợp nhanh cho Backend

### 5.1 Đã chốt — cứ theo đúng mô tả ở mục 2-3 mà implement, không cần hỏi lại

1. Thêm `dateFrom`/`dateTo` vào `GetSchedulePlansQuery`, cho phép bỏ trống `orderId` để trả nhiều đơn, và
   trả về **toàn bộ dòng `schedule_plans` của mỗi đơn đã lọt điều kiện** (không lọc riêng từng dòng theo
   cửa sổ) — mục 2.1.
2. Điều kiện "đơn có xuất hiện trong cửa sổ hay không" xét theo **`[orders.event_date, MAX(schedule_plans.
   end_time)]`** — **không phải** `MIN(start_time)`/`MAX(end_time)` của riêng `schedule_plans` như
   `docs/kehoachvaphancong_api.md` mục 4 — **đã chốt với người dùng (2026-07-20)**, xem hộp lưu ý cuối
   mục 1 (mục 2.1).
3. `GET /schedule-plans` trả kèm `orderCode`, `eventName`, `eventDate`, `taskName`, `assignees[]` join sẵn
   trong mỗi dòng (mục 2.2) — tránh N+1 request; `eventDate` là field **mới**, bắt buộc phải có để FE tính
   `rangeStart`.

### 5.2 Còn mở — cần Backend/Product xác nhận trước khi FE nối API thật cho tab này

1. Thuật toán suy trạng thái tổng hợp theo nhóm đơn (mục 3 điểm 4, chi tiết ở
   `docs/kehoachvaphancong_api.md` mục 7) — hiện là đề xuất của FE, chưa qua duyệt Product.
2. Format mã đơn hiển thị trên thanh timeline (`order_code` thật, ví dụ `ORD-001`, thay cho mã tự sinh
   `ĐĐ-0011` của mock) — mục 3 điểm 3.
3. Gộp "hoạt động" và "công việc phân công" thành 1 danh sách duy nhất trong drawer (mục 4), thay vì
   2 mảng tách biệt như mock.

Các mục 1-4 kế thừa/áp dụng nguyên các quyết định nền tảng đã có ở
[`docs/kehoachvaphancong_api.md`](kehoachvaphancong_api.md) mục 1 (kế hoạch không phải 1 entity lưu trữ
thật), mục 6 (danh sách đề xuất bổ sung `GetSchedulePlansQuery`), mục 9 (xác nhận/hủy từng dòng qua
`PATCH /schedule-plans/:id/status`) — không lặp lại phân tích ở đây, tham khảo file đó khi cần chi tiết
sâu hơn ngoài phạm vi riêng tab Lịch timeline.
