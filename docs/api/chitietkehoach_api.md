# API cho modal "Chi tiết kế hoạch vận hành" (`PlanDetailDrawer`)

> Phạm vi tài liệu này: **chỉ** modal/drawer chi tiết mở khi bấm xem 1 "kế hoạch" (mã `KHOP-2026-xxxx`)
> — mở từ tab "Danh sách kế hoạch" (nút Xem), tab "Lịch timeline" (click thanh ngang) hoặc panel "Lịch
> ngày" của tab "Lịch điều phối", tại `/manager/schedule/plans` (mirror `/admin/coordination/planning`)
> — đúng như ảnh mẫu cung cấp (header "CHI TIẾT KẾ HOẠCH VẬN HÀNH" + badge trạng thái, card thông tin
> đơn/sự kiện, khối "CÁC HOẠT ĐỘNG CHÍNH", khối "DANH SÁCH CÔNG VIỆC & PHÂN CÔNG", khối "NHÂN SỰ THAM
> GIA", nút "Đóng lại"/"Chỉnh sửa kế hoạch").
>
> **Không** bao gồm: 3 tab danh sách/lịch của trang cha, banner "sắp diễn ra", modal xóa kế hoạch, và
> drawer "Lập/Sửa kế hoạch" (`PlanFormDrawer`) — toàn bộ đã có tài liệu ở
> [`docs/kehoachvaphancong_api.md`](kehoachvaphancong_api.md) (tài liệu đó phân tích **cả trang**, bao
> gồm cả drawer chi tiết này ở mức tổng quan tại mục 6). Tài liệu **này** đào sâu riêng modal chi tiết —
> map **từng field UI** hiển thị trong modal sang nguồn dữ liệu thật, kế thừa và **không lặp lại** các
> phát hiện gốc đã chốt ở `docs/kehoachvaphancong_api.md` (mục 1: 1 "kế hoạch" = nhiều dòng `schedule_plans`
> cùng `order_id`) và `docs/lichtrinhkythuat_api.md` (mục 1, 4: map field 1 dòng `schedule_plans`, model đa
> phân công `schedule_plan_assignees`) — chỉ trích dẫn lại khi cần cho bảng field ở mục 2.
>
> Nguồn tham chiếu:
>
> - FE: `src/components/planning/PlanDetailDrawer.tsx` (toàn bộ component), `src/app/manager/schedule/ plans/page.tsx` (dòng 141 `selectedPlanDetail`, dòng 679-684 — modal nhận thẳng 1 object `SchedulePlan`
>   đã có sẵn trong state trang cha, **không** gọi API riêng khi mở modal), `src/mocks/db/schedulePlans.ts`
>   (toàn bộ — `SchedulePlan`/`PlanActivity`/`PlanWorkTask`/`PlanStaffMember`/`getPlanStatusInfo`/
>   `TASK_STATUS_META`), `src/types/schedulePlan.ts`, `src/types/workTask.ts`, `src/types/user.ts`,
>   `src/services/schedulePlan.service.ts`.
> - DB thật: đối chiếu trực tiếp qua MySQL MCP ngày 2026-07-20 (cùng phiên với `docs/kehoachvaphancong_api.md`/
>   `docs/lichtrinhkythuat_api.md`, xác nhận lại lần nữa trong phiên viết tài liệu này —
>   `SHOW CREATE TABLE schedule_plans/schedule_plan_assignees/work_tasks/orders/users/evidences`; dữ liệu
>   mẫu thật **vẫn giống hệt các phiên trước**: 1 order (`ORD-001`, khách `Tech Corp`, `event_name = "Tech Summit 2026"`, `order_status = CONFIRMED`, `created_by → "Project Manager"`), 1 `schedule_plans`
>   (`PLN-001`, `task_id → "Lắp đặt thiết bị"`, `status = IN_PROGRESS`, `evidence_id = NULL`, `notes = NULL`), 2 `schedule_plan_assignees` cho đúng dòng đó (1 `LEAD` = "Team Leader", 1 `TECHNICAL` =
>   "Technician", cả 2 có `phone`), `work_tasks` chỉ 2 dòng (`TSK-SETUP`/`TSK-TEARDOWN`)).
> - `docs/api/` **không tồn tại trong repo hiện tại** — dùng comment đầu từng file `types/*.ts` làm căn cứ
>   chính, giống các tài liệu trước.

## 0. Base URL & Auth

Base path `/api/v1`, JWT Bearer theo `AuthContext` hiện có — giống mọi tài liệu khác trong `docs/`.

## 1. Phát hiện cốt lõi áp dụng cho modal này (kế thừa nguyên trạng)

Modal hiện đọc thẳng 1 object `SchedulePlan` lồng 3 mảng con (`activities[]`, `tasks[]`, `staffList[]`).
Theo phát hiện đã chốt ở `docs/kehoachvaphancong_api.md` mục 1, đơn vị lưu trữ thật là bảng
`schedule_plans` **phẳng** — 1 dòng = 1 `order_id` + 1 `task_id`. Vì vậy modal chi tiết thật sự phải build
từ **tập nhiều dòng `schedule_plans` có cùng `order_id`** (kết quả `GET /schedule-plans?orderId=:id` đã
tài liệu hóa ở `docs/kehoachvaphancong_api.md` mục 6 và `docs/lichtrinhkythuat_api.md` mục 2), **không có**
1 endpoint "GET kế hoạch theo ID" nào trả thẳng cấu trúc lồng như mock — đúng như đã chốt, không phân
tích lại.

**Phát hiện bổ sung riêng của modal này**: mock tách `activities[]` (4 loại cố định: Khảo sát/Vận
chuyển/Lắp đặt/Thu hồi, không có `assignee` hiển thị) và `tasks[]` (việc kỹ thuật tự do, có
`assignee`+`team[]`) thành **2 khối UI riêng biệt**. Nhưng với dữ liệu thật, cả 2 khối đều đọc từ **cùng
một bảng** `schedule_plans` (mỗi dòng đều có `task_id`, `start_time`/`end_time`, `location`, `notes`,
`status`, và đều có thể có `schedule_plan_assignees` riêng) — không có cột nào phân biệt "đây là hoạt
động điều phối" khác với "đây là việc kỹ thuật có phân công". Xem đề xuất gộp 2 khối ở mục 4 điểm 3.

## 2. Map field UI → nguồn dữ liệu

### 2.1 Header


| Field UI                          | Nguồn thật                                                      | Ghi chú                                                                                                                                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Badge trạng thái ("Chuẩn bị") | Suy từ tập`status` các dòng `schedule_plans` cùng `order_id` | Dùng đúng thuật toán đã đề xuất ở`docs/kehoachvaphancong_api.md` mục 7 (chưa được Backend/Product xác nhận) — không đề xuất lại ở đây.                                                         |
| Mã kế hoạch (`KHOP-2026-0001`) | **Không có cột thật**                                         | Tự sinh phía client theo nhóm`order_id`, giống kết luận đã chốt ở `docs/kehoachvaphancong_api.md` mục 5 — đề xuất bỏ hẳn mã `KHOP-*`, dùng thẳng `order_code` làm khóa hiển thị/tiêu đề modal. |

### 2.2 Card thông tin đơn/sự kiện


| Field UI                                           | Nguồn thật                                     | Ghi chú                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Badge mã đơn (`plan.orderId`, ví dụ "DD0011") | `orders.order_code`                              | Dữ liệu mẫu thật hiện là`ORD-001` (khác định dạng `DDxxxx` mock tự bịa) — khớp trực tiếp, chỉ đổi format hiển thị theo đúng `order_code` thật, không cần Backend đổi gì.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| "Người lập: {manager}"                          | **Chưa rõ, cần chốt — xem mục 4 điểm 1** | Mock đọc`order.coordinatorName` (field không tồn tại trên `orders` thật — cùng phát hiện đã ghi ở `docs/kehoachvaphancong_api.md` mục 3). 2 ứng viên thay thế: (a) `orders.created_by` → `users.full_name` (người **tạo đơn**, dữ liệu mẫu thật: "Project Manager"); (b) `schedule_plans.created_by` → `users.full_name` của dòng đại diện trong nhóm (người **lập kế hoạch/lịch**, có thể khác người tạo đơn). Ý nghĩa nhãn "Người lập" (lập **kế hoạch**, không phải lập đơn) nghiêng về hướng (b) — cần Backend/Product xác nhận trước khi chọn. |
| Tên sự kiện (`plan.eventName`)                  | `orders.event_name`                              | Khớp trực tiếp, đã xác nhận cột tồn tại (mẫu thật: "Tech Summit 2026") — tốt hơn mock (tự ghép chuỗi`Lễ cưới ${customerName}`), giống kết luận `docs/kehoachvaphancong_api.md` mục 3.                                                                                                                                                                                                                                                                                                                                                                                                                |
| Ngày (`plan.eventDate`, format `formatDate`)      | `orders.event_date`                              | Khớp trực tiếp. Lưu ý: đây là ngày**sự kiện** (mức đơn), khác ngày của từng hoạt động con hiển thị ở khối 2.3 (mỗi dòng `schedule_plans` có `start_time` riêng, có thể khác ngày sự kiện — vd hoạt động khảo sát diễn ra trước ngày cưới nhiều ngày).                                                                                                                                                                                                                                                                                                                        |
| Địa điểm (`plan.location`)                     | `orders.location`                                | Dùng cho dòng địa điểm chung của card — nhất quán với đề xuất đã chốt ở`docs/kehoachvaphancong_api.md` mục 3 (`orders.location` cho card tổng hợp, `schedule_plans.location` của từng dòng con hiển thị riêng ở khối hoạt động/công việc, mục 2.3-2.4 dưới đây).                                                                                                                                                                                                                                                                                                                       |
| Ghi chú (`plan.notes`, khối chữ nghiêng)       | **Chưa rõ, cần chốt — xem mục 4 điểm 2** | `schedule_plans.notes` là cột **per-row** (mỗi dòng 1 giá trị `notes` riêng), không có cột `notes` ở mức "cả nhóm/cả đơn". Cần quyết định: hiển thị `notes` của dòng nào (vd dòng có `start_time` sớm nhất), hay gộp (nối chuỗi) `notes` không rỗng của mọi dòng trong nhóm.                                                                                                                                                                                                                                                                                                           |

### 2.3 Khối "Các hoạt động chính" (`activities[]`)

Mỗi phần tử `plan.activities` (loại việc, giờ bắt đầu/kết thúc, ghi chú, địa điểm) tương ứng **1 dòng
`schedule_plans`** trong nhóm cùng `order_id` (mục 1):


| Field UI                                                                     | Nguồn thật                                            | Ghi chú                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loại hoạt động (`act.type`: Khảo sát/Vận chuyển/Lắp đặt/Thu hồi) | `schedule_plans.task_id` → join `work_tasks.task_name` | **Thiếu danh mục**: `work_tasks` thật hiện chỉ có 2 dòng (`"Lắp đặt thiết bị"`, `"Tháo dỡ thiết bị"`) — thiếu hẳn "Khảo sát" và "Vận chuyển". Cùng phát hiện đã ghi ở `docs/lichtrinhkythuat_api.md` mục 5 và `docs/kehoachvaphancong_api.md` mục 2 — cần Backend seed thêm tối thiểu 2 dòng `work_tasks` mới, không phân tích lại ở đây. |
| Giờ bắt đầu/kết thúc (`act.startTime`/`act.endTime`)                   | `schedule_plans.start_time`/`end_time`                  | Format lại từ`timestamp` sang `HH:mm` khi hiển thị (khác mock lưu sẵn dạng chuỗi giờ).                                                                                                                                                                                                                                                                                         |
| Ghi chú (`act.notes`)                                                       | `schedule_plans.notes`                                  | Khớp trực tiếp —**cùng cột** dùng cho "Ghi chú" ở card tổng hợp (2.2) và "Yêu cầu công việc" ở khối 2.4 — xác nhận thêm phát hiện mục 1 (không có khái niệm tách biệt "ghi chú hoạt động" vs "yêu cầu việc").                                                                                                                                      |
| Địa điểm (`act.location`)                                                | `schedule_plans.location`                               | Khớp trực tiếp (đủ chứa dạng "Kho trung tâm → {venue}" cho hoạt động vận chuyển).                                                                                                                                                                                                                                                                                          |

Khối này **không hiển thị người phụ trách** trên UI hiện tại — nhưng dữ liệu thật vẫn có
`schedule_plan_assignees` riêng cho từng dòng (kể cả dòng "loại hoạt động"), nên về nguyên tắc modal có
thể bổ sung hiển thị người phụ trách ở đây nếu Product muốn (không phải giới hạn kỹ thuật).

### 2.4 Khối "Danh sách công việc & phân công" (`tasks[]`)

Mỗi phần tử `plan.tasks` (tiêu đề, trạng thái, yêu cầu, người phụ trách, đồng hành) **cũng tương ứng 1
dòng `schedule_plans`** trong cùng nhóm — **cùng bảng** với khối 2.3, không phải 1 bảng khác (mục 1):


| Field UI                                                                         | Nguồn thật                                                                                              | Ghi chú                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tiêu đề việc (`task.title`, tự do — vd "Lắp dựng sân khấu & backdrop") | **Không có cột lưu**                                                                                  | `schedule_plans` không có cột tiêu đề tự do. Theo hướng đã chốt ở `docs/kehoachvaphancong_api.md` mục 2: dùng `task_id` (chọn từ danh mục `work_tasks` đã seed mở rộng) làm "loại việc lớn" hiển thị thay tiêu đề, nội dung cụ thể ghi vào `notes`. |
| Badge trạng thái (`task.status`, `TASK_STATUS_META`)                           | `schedule_plans.status`                                                                                   | Enum thật chỉ có`PENDING`/`CONFIRMED`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED` — **không có** `TODO`/`ASSIGNED`/`BLOCKED` như mock. Viết lại `TASK_STATUS_META` theo đúng `ScheduleStatus` thật, cùng phát hiện đã chốt ở `docs/lichtrinhkythuat_api.md` mục 3.       |
| Yêu cầu (`task.requirements`)                                                  | `schedule_plans.notes`                                                                                    | Cùng cột với "Ghi chú" ở 2.3 — xem lưu ý mục 1.                                                                                                                                                                                                                               |
| Phụ trách (`task.assignee`, 1 tên)                                            | `schedule_plan_assignees` (dòng `role = 'LEAD'` của `plan_id` đó) → join `users.full_name`           | Không phải 1 chuỗi tên đơn như mock — model đa phân công thật, cùng phát hiện đã chốt ở`docs/lichtrinhkythuat_api.md` mục 4 (dữ liệu mẫu thật xác nhận đúng 1 `LEAD`/1 `TECHNICAL` cho 1 dòng `PLN-001`).                                                 |
| Đồng hành (`task.team[]`, nhiều tên)                                        | `schedule_plan_assignees` (các dòng `role = 'TECHNICAL'` của `plan_id` đó) → join `users.full_name` | Có thể nhiều dòng`TECHNICAL`/1 `plan_id` (unique key `(plan_id, user_id)` cho phép nhiều `user_id` khác nhau) — không giới hạn 1 người như mock có thể ngộ nhận.                                                                                                     |

### 2.5 Khối "Nhân sự tham gia" (`staffList[]`)


| Field UI                                                                                  | Nguồn thật                                                                                                                                                                                | Ghi chú                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tên + vai trò (`s.name — s.role`, vd "Vũ Hoàng Long — Trưởng nhóm điều phối") | `UNION DISTINCT` toàn bộ `schedule_plan_assignees.user_id` của **mọi dòng** `schedule_plans` trong nhóm (cùng `order_id`) → join `users.full_name` + `schedule_plan_assignees.role` | Mock dùng`PLANNING_STAFF_POOL` — 5 vai trò hiện trường bespoke tự đặt ("Trưởng nhóm điều phối", "Kỹ thuật âm thanh ánh sáng"...), **không tồn tại trong DB**. Đã chốt hướng ở `docs/kehoachvaphancong_api.md` mục 8.3: bỏ hẳn 5 vai trò bespoke, đổi hiển thị vai trò thành nhãn tiếng Việt map từ `role` thật (`LEAD` → "Trưởng nhóm"/tương đương, `TECHNICAL` → "Kỹ thuật viên") thay vì vai trò tự do gắn theo tên. Vì đây là **nhân sự tham gia toàn bộ kế hoạch** (nhiều dòng), 1 người có thể xuất hiện với vai trò khác nhau ở các dòng khác nhau (vd `LEAD` ở dòng khảo sát nhưng `TECHNICAL` ở dòng lắp đặt) — cần quyết định hiển thị vai trò nào nếu trùng người (đề xuất: vai trò của dòng có `start_time` sớm nhất, nhất quán với cách chọn "chỉ huy" ở `docs/kehoachvaphancong_api.md` mục 3). |

### 2.6 Nút hành động


| Nút                     | Hành vi                                                                                                                                | Ghi chú                                                                                                                                                                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Đóng lại"            | Không gọi API, chỉ đóng UI                                                                                                         | —                                                                                                                                                                                                                                                                                  |
| "Chỉnh sửa kế hoạch" | Mở`PlanFormDrawer` ở chế độ sửa, dùng lại thẳng dữ liệu nhóm đã có sẵn trong modal — **không** gọi thêm API khi mở | Cùng phát hiện đã ghi ở`docs/lichtrinhkythuat_api.md` mục 9 ("Modal Xem chi tiết không có endpoint riêng"), áp dụng y hệt cho modal này. Luồng lưu khi sửa xong đã tài liệu hóa ở `docs/kehoachvaphancong_api.md` mục 8, không phân tích lại ở đây. |

## 3. Endpoint(s) cần cho modal này

Modal **không** có endpoint riêng — dùng lại đúng 1 endpoint đã tài liệu hóa ở
`docs/kehoachvaphancong_api.md` mục 6 và `docs/lichtrinhkythuat_api.md` mục 2:


| # | Endpoint                                                                                                 | Vai trò với modal này                                                                                                                                              |
| - | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | `GET /api/v1/schedule-plans?orderId=:orderId` (đã có sẵn, `schedulePlanApiService.getSchedulePlans`) | Nguồn dữ liệu**duy nhất** — modal chỉ render lại đúng nhóm dòng đã được trang cha load sẵn (danh sách/lịch/timeline), không tự gọi API khi mở. |

**Yêu cầu response phải đủ field** để build được cả 5 khối ở mục 2 mà không cần round-trip thêm (kế thừa
yêu cầu đã chốt ở `docs/lichtrinhkythuat_api.md` mục 4 điểm 3 và `docs/kehoachvaphancong_api.md` mục 6
điểm 3-4, áp dụng lại cho modal này):

1. `taskName` (join `work_tasks.task_name` theo `task_id`).
2. `assignees: { userId, fullName, role, phone }[]` (join `schedule_plan_assignees` → `users`, kèm sẵn
   `phone` — không bắt FE gọi `GET /users/:id` riêng cho từng người).
3. `orderCode`, `customerName`, `eventName`, `orderLocation` — join sẵn từ `orders`/`customers`, bắt buộc
   vì modal không có ngữ cảnh trang chi tiết 1 đơn bao quanh (mở từ trang tổng hợp đa đơn).
4. `createdByName` (join `users.full_name` theo `schedule_plans.created_by`) — cần thêm mới, **chưa có**
   trong yêu cầu response của 2 tài liệu trước, phục vụ riêng field "Người lập" (mục 2.2, còn chờ chốt
   nguồn ở mục 4 điểm 1 dưới đây).

## 4. Vấn đề cần Backend/Product xác nhận (mới, riêng tài liệu này)

1. **"Người lập" (mục 2.2)**: xác nhận nguồn là `orders.created_by` (người tạo đơn) hay
   `schedule_plans.created_by` của 1 dòng đại diện trong nhóm (người lập lịch/kế hoạch) — 2 khái niệm có
   thể là 2 người khác nhau trong thực tế vận hành.
2. **`plan.notes` ở card tổng hợp (mục 2.2)**: `schedule_plans.notes` là cột per-row, không có "notes cấp
   nhóm" — cần chốt hiển thị notes của dòng nào (đề xuất: dòng có `start_time` sớm nhất) hoặc gộp nhiều
   dòng.
3. **Gộp khối "Các hoạt động chính" + "Danh sách công việc & phân công" thành 1 danh sách duy nhất** — vì
   dữ liệu thật không phân biệt 2 khái niệm này (mục 1), đề xuất UI thật hiển thị **1** danh sách các dòng
   `schedule_plans` của đơn, mỗi dòng show đủ: loại việc (`taskName`), giờ, địa điểm, ghi chú, trạng thái,
   `assignees` (nếu có) — thay vì tách cứng 2 khối như mock (4 "hoạt động" cố định + N "việc" biến động).
   Đây là đề xuất, cần Product duyệt trước khi đổi UI thật.
4. **Tiêu đề việc tự do (`task.title`, mục 2.4)** không có cột lưu — áp dụng lại hướng đã chốt ở
   `docs/kehoachvaphancong_api.md` mục 2 (chọn `task_id` từ danh mục + mô tả chi tiết vào `notes`), cần
   xác nhận hướng đó áp dụng luôn cho modal chi tiết này (không có luồng nhập liệu nào khác ở modal, chỉ
   hiển thị lại dữ liệu đã tạo qua `PlanFormDrawer`).
5. **Seed thêm `work_tasks`** ("Khảo sát hiện trường", "Vận chuyển thiết bị") — nhắc lại yêu cầu đã ghi ở
   2 tài liệu trước, xác nhận modal chi tiết này cũng cần danh mục đầy đủ để hiển thị đúng nhãn loại hoạt
   động (mục 2.3), không phải chỉ tab danh sách/lịch trình kỹ thuật.

   **Vì sao đây là vấn đề chặn cứng, không chỉ thiếu tên hiển thị**: `schedule_plans.task_id` là FK
   **NOT NULL** trỏ tới `work_tasks` — không phải free-text, bắt buộc phải chọn từ 1 dòng có sẵn trong
   danh mục. Danh mục thật hiện chỉ có đúng 2 dòng:

   | `task_code` | `task_name` |
   | --- | --- |
   | `TSK-SETUP` | Lắp đặt thiết bị |
   | `TSK-TEARDOWN` | Tháo dỡ thiết bị |

   Đối chiếu với 4 loại hoạt động UI cần hiển thị ở khối "Các hoạt động chính" (mục 2.3):

   | Loại hoạt động (UI) | Khớp `work_tasks`? |
   | --- | --- |
   | Lắp đặt | Có — `TSK-SETUP` |
   | Thu hồi | Tạm khớp — `TSK-TEARDOWN` ("Tháo dỡ thiết bị", chưa chắc cùng nghĩa 100%, xem `docs/lichtrinhkythuat_api.md` mục 5) |
   | Khảo sát | **Không có dòng tương ứng** |
   | Vận chuyển | **Không có dòng tương ứng** |

   Hậu quả cụ thể: nếu Manager lập kế hoạch có hoạt động "Khảo sát mặt bằng" hoặc "Vận chuyển thiết bị ra
   kho", hệ thống **không có `task_id` hợp lệ** để tạo dòng `schedule_plans` đó — bị chặn ngay ở tầng DB
   (vi phạm FK constraint) khi gọi `POST /schedule-plans`, không phải chỉ hiển thị sai nhãn. Modal chi
   tiết này (khối 2.3, join `schedule_plans.task_id → work_tasks.task_name`) cũng không có dữ liệu thật để
   hiển thị đúng cho 2/4 loại hoạt động cho tới khi Backend seed thêm 2 dòng `work_tasks` mới.

## 5. Bảng tổng hợp field → nguồn (tra nhanh cho Backend)


| Khối UI                  | Field                      | Nguồn                                                                                                        |
| ------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Header                    | Badge trạng thái         | Suy từ tập`schedule_plans.status` cùng `order_id` (thuật toán ở `docs/kehoachvaphancong_api.md` mục 7) |
| Header                    | Mã kế hoạch             | Không có cột — tự sinh client, đề xuất dùng`order_code`                                              |
| Card                      | Mã đơn                  | `orders.order_code`                                                                                           |
| Card                      | Người lập               | Chưa chốt — mục 4.1                                                                                       |
| Card                      | Tên sự kiện             | `orders.event_name`                                                                                           |
| Card                      | Ngày                      | `orders.event_date`                                                                                           |
| Card                      | Địa điểm               | `orders.location`                                                                                             |
| Card                      | Ghi chú                   | Chưa chốt — mục 4.2                                                                                       |
| Hoạt động chính       | Loại hoạt động         | `work_tasks.task_name` (qua `schedule_plans.task_id`)                                                         |
| Hoạt động chính       | Giờ bắt đầu/kết thúc | `schedule_plans.start_time`/`end_time`                                                                        |
| Hoạt động chính       | Ghi chú                   | `schedule_plans.notes`                                                                                        |
| Hoạt động chính       | Địa điểm               | `schedule_plans.location`                                                                                     |
| Công việc & phân công | Tiêu đề                 | Không có cột — đề xuất`task_id` + `notes` (mục 4.4)                                                   |
| Công việc & phân công | Trạng thái               | `schedule_plans.status` (enum thật 5 giá trị)                                                              |
| Công việc & phân công | Yêu cầu                  | `schedule_plans.notes`                                                                                        |
| Công việc & phân công | Phụ trách                | `schedule_plan_assignees.role = 'LEAD'` → `users.full_name`                                                  |
| Công việc & phân công | Đồng hành               | `schedule_plan_assignees.role = 'TECHNICAL'` → `users.full_name`                                             |
| Nhân sự tham gia        | Tên + vai trò            | `UNION` toàn bộ `schedule_plan_assignees` của nhóm → `users.full_name` + `role`                          |

## 6. trả lời câu hỏi


1. xác nhận nguồn là \`orders.created\_by\` (người tạo đơn)
2. Lấy notes của 1 dòng đại diện** — ví dụ dòng có `start_time` sớm nhất (dòng Khảo sát) → sẽ hiển thị "Khảo sát mặt bằng, đo đạc..." chứ không phải câu về giờ lắp đặt như ảnh mẫu mong muốn. Đơn giản nhưng có thể chọn sai dòng chứa thông tin quan trọng nhất.
3. **Gộp khối "Các hoạt động chính" + "Danh sách công việc & phân công" thành 1 danh sách duy nhất**
4. xác nhận hướng đó áp dụng luôn cho modal chi tiết này (không có luồng nhập liệu nào khác ở modal, chỉ
   hiển thị lại dữ liệu đã tạo qua `PlanFormDrawer`).
5. Việc này đã được ghi nhận là cần Backend seed thêm  dòng `work_tasks` mới ("Khảo sát hiện trường")- ghi vào more-reqiured.md
