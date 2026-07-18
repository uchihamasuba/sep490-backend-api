�# BNWEMS — Giải thích chi tiết từng bảng

> CSDL **Binh Nguyen Wedding & Event Management System** — 28 bảng, MySQL. Tài liệu này giải thích **mục đích, từng cột, khóa & quan hệ, và ý nghĩa nghiệp vụ** của mỗi bảng, phục vụ báo cáo đồ án. Xem sơ đồ tổng quan ở [`ERD.md`](ERD.md), DDL ở [`migrations/`](migrations/).

**Quy ước chung (áp dụng cho mọi bảng):**
- **Khóa chính** kiểu `varchar(36)`, sinh tự động bằng `(UUID())`.
- **Tiền tệ**: `numeric(14,2)`, đơn vị VNĐ. **Thời gian**: `timestamp` (UTC).
- `created_at` mặc định `CURRENT_TIMESTAMP`; `updated_at` được **trigger** tự cập nhật mỗi lần UPDATE.
- Ký hiệu khóa: **PK** = khóa chính · **FK** = khóa ngoại · **UK** = ràng buộc duy nhất (unique).
- Hệ thống **hạn chế xóa vật lý**: đa số bảng dùng cột `status`/`is_active` để vô hiệu hóa.

**Chia 2 migration:** 24 bảng **LÕI** ở [`migrations/001_core.sql`](migrations/001_core.sql); 4 bảng **KHO VẬN** (đánh dấu 🟩 bên dưới) ở [`migrations/002_warehouse_logistics.sql`](migrations/002_warehouse_logistics.sql), chạy sau `001`. Mọi FK đi từ kho vận → lõi nên phần lõi độc lập, thêm kho vận sau mà không sửa lõi.

**Mục lục theo nhóm:**
1. Identity & Master data: [users](#1-users), [customers](#2-customers), [suppliers](#3-suppliers), [business_policies](#4-business_policies)
2. Catalog & Inventory: [item_categories](#5-item_categories), [item_types](#6-item_types), [items](#7-items), [inventory](#8-inventory), [inventory_movements](#24-inventory_movements)
3. Sales & Orders: [quotations](#10-quotations), [quotation_items](#11-quotation_items), [orders](#12-orders), [order_items](#13-order_items)
4. Operations: [work_tasks](#14-work_tasks), [schedule_plans](#15-schedule_plans), [schedule_plan_assignees](#15b-schedule_plan_assignees), [attendances](#16-attendances), [survey_reports](#17-survey_reports), [change_requests](#18-change_requests), [change_request_items](#19-change_request_items), [collected_equipment_reports](#22-collected_equipment_reports), [collected_equipment_report_items](#23-collected_equipment_report_items)
5. Suppliers/Procurement: [supplier_transactions](#20-supplier_transactions), [supplier_transaction_items](#21-supplier_transaction_items)
6. Finance: [deposits](#25-deposits), [settlements](#26-settlements)
7. Shared: [evidences](#9-evidences), [notifications](#27-notifications)

---

## Nhóm 1 — Identity & Master data

### 1. `users`
**Mục đích:** Lưu tài khoản đăng nhập nội bộ của hệ thống. Đây là actor duy nhất có tài khoản (Khách hàng và Nhà cung cấp không đăng nhập).

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| user_id | varchar(36) | PK | Định danh người dùng |
| username | varchar(100) | UK | Tên đăng nhập, duy nhất |
| password_hash | varchar(255) | | Mật khẩu đã băm (không lưu plaintext) |
| full_name | varchar(255) | | Họ tên hiển thị |
| role | user_role | | Vai trò RBAC: `ADMIN`/`MANAGER`/`LEADER`/`TECHNICAL` |
| status | user_status | | `ACTIVE`/`INACTIVE`/`SUSPENDED` |
| email, phone, bio, avatar_url | varchar/text | | Thông tin hồ sơ (tùy chọn) |
| created_at, updated_at | timestamp | | Thời điểm tạo/cập nhật |

**Quan hệ:** là "người thực hiện" trong hầu hết bảng nghiệp vụ — `orders.created_by`, `quotations.created_by`, `schedule_plans.created_by`, `schedule_plan_assignees.user_id`, `evidences.uploaded_by`, và các cột `reported_by/confirmed_by/requested_by/approved_by`.
**Nghiệp vụ:** `role` là **enum cố định**, không có bảng `roles` riêng (backend không có endpoint quản lý role). Admin & Manager dùng web; Leader & Technical dùng app mobile.

### 2. `customers`
**Mục đích:** Danh bạ khách hàng đặt tiệc/sự kiện. Là dữ liệu được quản lý, **không có tài khoản đăng nhập** (giao tiếp qua điện thoại/Zalo ngoài hệ thống).

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| customer_id | varchar(36) | PK | Định danh khách hàng |
| customer_code | varchar(50) | UK | Mã khách (vd `KH001`) |
| customer_name | varchar(255) | | Tên khách hàng |
| phone | varchar(30) | | Số điện thoại (bắt buộc) |
| email, address, notes | varchar/text | | Thông tin liên hệ, ghi chú |
| status | customer_status | | `ACTIVE`/`INACTIVE` |
| created_at, updated_at | timestamp | | |

**Quan hệ:** 1 khách hàng có nhiều `quotations` và nhiều `orders`.
**Nghiệp vụ:** một khách có thể có nhiều báo giá/đơn qua nhiều lần tổ chức sự kiện.

### 3. `suppliers`
**Mục đích:** Danh sách nhà cung cấp/đối tác thuê ngoài (âm thanh, nhà bạt, hoa, ẩm thực…). Cũng **không có tài khoản đăng nhập**.

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| supplier_id | varchar(36) | PK | Định danh NCC |
| supplier_code | varchar(50) | UK | Mã NCC (vd `SUP01`) |
| supplier_name | varchar(255) | | Tên NCC |
| service_type | varchar(255) | | Lĩnh vực cung cấp |
| contact_person, phone, email, address | varchar/text | | Thông tin liên hệ |
| rating | numeric(2,1) | | Điểm đánh giá 0–5 (CHECK ràng buộc) |
| notes | text | | Ghi chú |
| status | supplier_status | | `ACTIVE`/`INACTIVE` |
| created_at, updated_at | timestamp | | |

**Quan hệ:** 1 NCC có nhiều `supplier_transactions` (đơn thuê/mua).
**Nghiệp vụ:** công nợ NCC **không lưu sẵn** một cột — được suy ra từ các giao dịch chưa thanh toán.

### 4. `business_policies`
**Mục đích:** Cấu hình các chính sách nghiệp vụ có thể thay đổi: tỷ lệ cọc, quy tắc hoàn cọc khi hủy, mức đền bù, phí phát sinh.

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| policy_id | varchar(36) | PK | Định danh chính sách |
| policy_code | varchar(50) | UK | Mã chính sách |
| policy_name | varchar(255) | | Tên chính sách |
| policy_type | policy_type | | `DEPOSIT`/`CANCELLATION`/`COMPENSATION`/`FEE` |
| description | text | | Mô tả |
| policy_value | numeric(14,2) | | Giá trị (ý nghĩa tùy `unit`) |
| unit | varchar(50) | | Đơn vị: `Ngày`/`%`/`VNĐ` |
| is_active | boolean | | Đang áp dụng hay không |
| created_at, updated_at | timestamp | | |

**Quan hệ:** được `orders.policy_id` tham chiếu (tùy chọn) để gắn chính sách áp dụng cho đơn.
**Nghiệp vụ:** vd hủy đơn ≥30 ngày hoàn 100%, 7–30 ngày hoàn 50%, <7 ngày không hoàn → mã hóa bằng các dòng chính sách kiểu `CANCELLATION`.

---

## Nhóm 2 — Catalog & Inventory (Danh mục 3 tầng)

### 5. `item_categories`
**Mục đích:** Tầng 1 của danh mục — nhóm thiết bị lớn (vd "Bàn ghế", "Âm thanh", "Backdrop").

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| category_id | varchar(36) | PK | Định danh nhóm |
| category_code | varchar(50) | UK | Mã nhóm (tùy chọn) |
| category_name | varchar(255) | | Tên nhóm |
| description | text | | Mô tả |

**Quan hệ:** 1 category có nhiều `item_types`.

### 6. `item_types`
**Mục đích:** Tầng 2 — loại thiết bị cụ thể trong một nhóm (vd "Ghế Chavari", "Loa full").

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| type_id | varchar(36) | PK | Định danh loại |
| category_id | varchar(36) | FK → item_categories | Thuộc nhóm nào |
| type_code | varchar(50) | | Mã loại (tùy chọn) |
| type_name | varchar(255) | | Tên loại |
| description, image_url | text | | Mô tả, ảnh |
| is_active | boolean | | Còn sử dụng hay không |

**Quan hệ:** thuộc 1 `item_categories`; có nhiều `items`.

### 7. `items`
**Mục đích:** Tầng 3 — **thiết bị/sản phẩm cụ thể** được cho thuê/bán. Đây là đơn vị hàng hóa tham chiếu bởi báo giá, đơn hàng, kho, thu hồi…

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| item_id | varchar(36) | PK | Định danh thiết bị |
| item_code | varchar(50) | UK | Mã thiết bị (vd `TB001`) |
| item_name | varchar(255) | | Tên thiết bị |
| type_id | varchar(36) | FK → item_types | Thuộc loại nào |
| description | text | | Mô tả (fallback cho nội dung báo giá) |
| unit | varchar(50) | | Đơn vị tính (Cái/Bộ/m²…) |
| rental_price | numeric(14,2) | | Giá cho thuê |
| purchase_price | numeric(14,2) | | Giá mua — **dùng tính bồi thường hỏng/mất** |
| price_valid_from/to | date | | Khoảng hiệu lực giá |
| image_url | text | | Ảnh |
| status | item_status | | `ACTIVE`/`INACTIVE`/`MAINTENANCE` |
| created_at, updated_at | timestamp | | |

**Quan hệ:** thuộc 1 `item_types`; có 1 dòng `inventory` (1-1); được tham chiếu bởi `quotation_items`, `order_items`, `change_request_items`, `collected_equipment_report_items`, `supplier_transaction_items`, `inventory_movements`.
**Nghiệp vụ:** đền bù hỏng/mất tính theo `purchase_price × số lượng` (không theo giá thuê).

### 8. `inventory`
> 🟩 **Module KHO VẬN — migration `002_warehouse_logistics.sql`**

**Mục đích:** Trạng thái tồn kho hiện tại của **mỗi thiết bị** — quan hệ **1-1** với `items`. Tính theo loại + số lượng, không theo từng serial.

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| inventory_id | varchar(36) | PK | Định danh dòng tồn kho |
| item_id | varchar(36) | FK → items, UK | Thiết bị (duy nhất → đảm bảo 1-1) |
| quantity_total | integer | | Tổng số lượng sở hữu |
| quantity_damaged | integer | | Số lượng đang hỏng |
| quantity_reserved | integer | | Số lượng đã giữ chỗ (khóa cho đơn) |
| quantity_available | integer | | Số lượng còn khả dụng |
| updated_at | timestamp | | |

**Quan hệ:** 1-1 với `items` (ràng buộc UNIQUE trên `item_id`).
**Nghiệp vụ:** khi xác nhận cọc, hệ thống **khóa tồn kho theo ngày** — tăng `quantity_reserved`. Các cột số lượng đều có CHECK `>= 0`.

### 24. `inventory_movements`
> 🟩 **Module KHO VẬN — migration `002_warehouse_logistics.sql`**

*(thứ tự tạo bảng là cuối cùng trong 002 vì tham chiếu `orders` (lõi) và `collected_equipment_reports`)*
**Mục đích:** Sổ nhật ký **mọi biến động kho** (xuất/nhập/điều chỉnh) — audit trail cho tồn kho.

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| movement_id | varchar(36) | PK | Định danh biến động |
| item_id | varchar(36) | FK → items | Thiết bị biến động |
| order_id | varchar(36) | FK → orders (null) | Gắn đơn nào (nếu do đơn) |
| report_id | varchar(36) | FK → collected_equipment_reports (null) | Gắn biên bản thu hồi nào (khi nhập lại) |
| movement_type | movement_type | | `OUTBOUND` (xuất) / `INBOUND` (nhập) / `ADJUSTMENT` (điều chỉnh) |
| quantity | integer | | Số lượng biến động |
| performed_by | varchar(36) | FK → users | Người thực hiện |
| notes | text | | Ghi chú |
| created_at | timestamp | | |

**Nghiệp vụ:** xuất kho khi thi công (`OUTBOUND`), nhập lại khi thu hồi (`INBOUND`), điều chỉnh thủ công (`ADJUSTMENT`).

---

## Nhóm 3 — Sales & Orders

### 10. `quotations`
**Mục đích:** Báo giá gửi khách. Sau refactor backend, **báo giá thuộc về Khách hàng** (không thuộc đơn), có đánh version.

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| quotation_id | varchar(36) | PK | Định danh báo giá |
| quotation_code | varchar(50) | UK | Mã báo giá |
| customer_id | varchar(36) | FK → customers | Báo giá cho khách nào |
| version | varchar(30) | | Nhãn phiên bản (vd `v1.0`) — chuỗi tự do |
| subtotal | numeric(14,2) | | Tổng trước giảm |
| discount_total | numeric(14,2) | | Tổng giảm giá |
| total_amount | numeric(14,2) | | Thành tiền |
| status | quotation_status | | `DRAFT`/`APPROVED`/`REJECTED` |
| notes | text | | Ghi chú |
| created_by | varchar(36) | FK → users | Người lập |
| created_at, updated_at | timestamp | | |

**Quan hệ:** thuộc 1 `customers`; có nhiều `quotation_items`; được `orders.quotation_id` tham chiếu (tùy chọn).
**Nghiệp vụ:** chỉ xóa được khi còn `DRAFT`; sau khi `APPROVED`/gắn đơn thì chỉ cập nhật trạng thái.

### 11. `quotation_items`
**Mục đích:** Các dòng hạng mục của một báo giá.

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| quotation_item_id | varchar(36) | PK | Định danh dòng |
| quotation_id | varchar(36) | FK → quotations | Thuộc báo giá nào |
| item_id | varchar(36) | FK → items | Thiết bị/hạng mục |
| item_name | varchar(255) | | **Snapshot** tên lúc tạo (lưu vết dù item đổi tên sau) |
| quantity | integer | | Số lượng |
| price | numeric(14,2) | | Đơn giá |
| discount | numeric(14,2) | | Giảm giá dòng |
| line_total | numeric(14,2) | | **Generated**: `quantity*price - discount` |

**Nghiệp vụ:** `line_total` là **cột sinh (GENERATED STORED)** — DB tự tính, không nhập tay.

### 12. `orders`
**Mục đích:** **Đơn đặt sự kiện — thực thể trung tâm** của toàn hệ thống. Mọi hoạt động vận hành (khảo sát, điều phối, xuất kho, thanh toán, quyết toán) đều xoay quanh đơn.

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| order_id | varchar(36) | PK | Định danh đơn |
| order_code | varchar(50) | UK | Mã đơn (vd `DD001`) |
| customer_id | varchar(36) | FK → customers | Khách hàng |
| quotation_id | varchar(36) | FK → quotations (null) | Báo giá liên kết (chỉ lưu vết, **không copy** hạng mục) |
| policy_id | varchar(36) | FK → business_policies (null) | Chính sách áp dụng |
| event_type | varchar(100) | | Loại sự kiện (cưới/hội nghị/gala…) |
| event_name | varchar(255) | | Tên sự kiện |
| event_date | timestamp | | Ngày tổ chức |
| location | text | | Địa điểm |
| guest_count | integer | | Số khách dự |
| total_amount | numeric(14,2) | | Tổng giá trị đơn |
| payment_status | order_payment_status | | `UNPAID`/`DEPOSITED`/`PAID` |
| order_status | order_status | | `NEW`/`CONFIRMED`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED` |
| cancel_reason | text | | Lý do hủy (nếu có) |
| notes | text | | Ghi chú |
| created_by | varchar(36) | FK → users | Người tạo (Manager) |
| created_at, updated_at | timestamp | | |

**Quan hệ:** trung tâm — có nhiều `order_items`, `schedule_plans`, `survey_reports`, `change_requests`, `supplier_transactions`, `collected_equipment_reports`, `deposits`, `settlements`, `inventory_movements`.
**Nghiệp vụ:** `order_status` (tiến độ vận hành) và `payment_status` (tiến độ tiền) là **hai trục tách biệt**.

### 13. `order_items`
**Mục đích:** Các dòng thiết bị của một đơn — **danh sách độc lập**, không tự copy từ báo giá.

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| order_item_id | varchar(36) | PK | Định danh dòng |
| order_id | varchar(36) | FK → orders | Thuộc đơn nào |
| item_id | varchar(36) | FK → items | Thiết bị |
| quantity | integer | | Số lượng đặt |
| unit_price | numeric(14,2) | | Đơn giá |
| subtotal | numeric(14,2) | | **Generated**: `quantity*unit_price` |
| source | order_item_source | | `INTERNAL` (kho nội bộ) / `SUPPLIER` (thuê ngoài) |
| prepared_qty | integer | | Số lượng đã chuẩn bị/xuất kho |
| notes | text | | Ghi chú |

**Nghiệp vụ:** `source` xác định thiết bị lấy từ kho hay thuê NCC; `prepared_qty` theo dõi tiến độ pick-list.

---

## Nhóm 4 — Operations (Điều phối & Hiện trường)

### 14. `work_tasks`
**Mục đích:** **Danh mục loại công việc tĩnh** (Khảo sát, Lắp đặt, Vận chuyển, Thu hồi…). Không gắn đơn — chỉ là bảng tra cứu.

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| task_id | varchar(36) | PK | Định danh loại việc |
| task_code | varchar(50) | UK | Mã loại việc |
| task_name | varchar(255) | | Tên loại việc |
| description | text | | Mô tả |
| is_active | boolean | | Còn dùng hay không |

**Quan hệ:** được `schedule_plans.task_id` tham chiếu.

### 15. `schedule_plans`
**Mục đích:** **Kế hoạch điều phối** — một **đầu mục công việc**. Quy tắc: **1 plan = 1 đơn + 1 loại việc + 1 khung giờ**. Người tham gia (nhiều người, có vai trò) nằm ở bảng nối `schedule_plan_assignees`.

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| plan_id | varchar(36) | PK | Định danh kế hoạch |
| plan_code | varchar(50) | UK | Mã kế hoạch |
| order_id | varchar(36) | FK → orders | Cho đơn nào |
| task_id | varchar(36) | FK → work_tasks | Loại việc gì |
| start_time | timestamp | | Thời gian bắt đầu |
| end_time | timestamp | | Thời gian kết thúc |
| location | text | | Địa điểm |
| status | schedule_status | | `PENDING`/`CONFIRMED`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED` |
| evidence_id | varchar(36) | FK → evidences (null) | Ảnh minh chứng hoàn thành |
| notes | text | | Ghi chú |
| created_by | varchar(36) | FK → users | Người lập (Manager) |
| created_at, updated_at | timestamp | | |

**Quan hệ:** thuộc 1 `orders` + 1 `work_tasks`; có **nhiều người** qua `schedule_plan_assignees`; có thể gắn `survey_reports`.

### 15b. `schedule_plan_assignees`
**Mục đích:** **Bảng nối nhiều–nhiều giữa `schedule_plans` và `users`** — hiện thực hoá "một đầu mục công việc có nhiều người tham gia, đánh dấu ai là giám sát (LEAD) ai là kỹ thuật (TECHNICAL)".

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| assignee_id | varchar(36) | PK | Định danh dòng phân công |
| plan_id | varchar(36) | FK → schedule_plans | Thuộc đầu mục công việc nào |
| user_id | varchar(36) | FK → users | Người được phân công |
| role | plan_member_role | | `LEAD` (giám sát) / `TECHNICAL` (kỹ thuật) |
| notes | text | | Ghi chú |
| created_at | timestamp | | |

**Ràng buộc:** `UNIQUE(plan_id, user_id)` (mỗi người tối đa 1 dòng/plan) + **partial-unique** đảm bảo **tối đa 1 LEAD cho mỗi plan**.
**Nghiệp vụ:** **vai trò gán theo từng plan**, không cố định theo tài khoản — một người có thể là `LEAD` ở plan này và `TECHNICAL` ở plan khác (khớp app mobile `isLeaderForCurrentUser`). Nối 1 `schedule_plans` với nhiều `users`; mỗi dòng có 1 `attendances` (1-1).

### 16. `attendances`
**Mục đích:** **Chấm công** theo từng phân công — mỗi người trong một plan có 1 bản ghi check-in/check-out.

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| attendance_id | varchar(36) | PK | Định danh bản ghi |
| assignee_id | varchar(36) | FK · UK → schedule_plan_assignees | Chấm cho dòng phân công nào (1-1) |
| check_in_at | timestamp | | Giờ vào |
| check_in_evidence_id | varchar(36) | FK → evidences (null) | Ảnh check-in |
| check_out_at | timestamp | | Giờ ra |
| note | text | | Ghi chú |
| created_at, updated_at | timestamp | | |

**Ràng buộc:** `UNIQUE(assignee_id)` — chấm công **1-1** với một dòng `schedule_plan_assignees`.
**Nghiệp vụ:** chỉ người đã được phân công vào plan (có dòng trong `schedule_plan_assignees`) mới check-in được. *(Phần tính lương từ chấm công nằm ngoài phạm vi đồ án này.)*

### 17. `survey_reports`
**Mục đích:** **Báo cáo khảo sát hiện trường** (kích thước mặt bằng, lối vào, ràng buộc, đề xuất). Leader ghi trên mobile → Manager xác nhận trên web.

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| survey_id | varchar(36) | PK | Định danh báo cáo |
| report_code | varchar(50) | UK | Mã báo cáo |
| order_id | varchar(36) | FK → orders | Khảo sát cho đơn nào |
| plan_id | varchar(36) | FK → schedule_plans (null) | Gắn kế hoạch khảo sát |
| evidence_id | varchar(36) | FK → evidences (null) | Ảnh hiện trường |
| survey_date | timestamp | | Ngày khảo sát |
| location | text | | Địa điểm |
| area, length, width | numeric(10,2) | | Diện tích, dài, rộng |
| entrance | text | | Mô tả lối vào |
| site_constraints | text | | Ràng buộc mặt bằng |
| additional_requests | text | | Yêu cầu thêm của khách |
| proposed_items | text | | Hạng mục đề xuất |
| notes | text | | Ghi chú |
| status | survey_status | | `DRAFT`/`NEEDS_REVIEW`/`SUBMITTED`/`CONFIRMED` |
| reported_by | varchar(36) | FK → users | Người khảo sát (Leader) |
| confirmed_by | varchar(36) | FK → users (null) | Người xác nhận (Manager) |
| confirmed_at | timestamp | | Thời điểm xác nhận |
| created_at, updated_at | timestamp | | |

**Nghiệp vụ:** cặp `reported_by`/`confirmed_by` thể hiện mô hình "hiện trường ghi → Manager duyệt".

### 18. `change_requests`
**Mục đích:** **Yêu cầu thay đổi thiết bị tại hiện trường** (thêm/bớt/đổi) trong lúc thi công.

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| change_request_id | varchar(36) | PK | Định danh yêu cầu |
| order_id | varchar(36) | FK → orders | Của đơn nào |
| type | change_request_type | | `add`/`remove`/`replace` |
| status | change_request_status | | `pending`/`approved`/`rejected` |
| created_at | timestamp | | |

**Quan hệ:** có nhiều `change_request_items`.
**Nghiệp vụ:** khi Manager `approved`, hệ thống tính lại tiền và cộng vào quyết toán cuối (bớt = trừ 100% giá; đổi = cũ − giá cũ + giá mới).

### 19. `change_request_items`
**Mục đích:** Chi tiết từng thiết bị trong một yêu cầu thay đổi.

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| change_request_item_id | varchar(36) | PK | Định danh dòng |
| change_request_id | varchar(36) | FK → change_requests | Thuộc yêu cầu nào |
| catalog_item_id | varchar(36) | FK → items | Thiết bị liên quan |
| quantity | integer | | Số lượng |
| action | change_request_item_action | | `add` (thêm) / `remove` (bớt) |

**Nghiệp vụ:** với `type='replace'`, danh sách gồm cả dòng `remove` (thiết bị cũ) và `add` (thiết bị mới).

### 22. `collected_equipment_reports`
> 🟩 **Module KHO VẬN — migration `002_warehouse_logistics.sql`**

**Mục đích:** **Biên bản thu hồi thiết bị** sau sự kiện, kèm kiểm đếm. Áp dụng cho cả kho nội bộ (`INTERNAL`) và trả đồ NCC (`SUPPLIER`).

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| report_id | varchar(36) | PK | Định danh biên bản |
| order_id | varchar(36) | FK → orders | Thu hồi của đơn nào |
| report_type | collected_report_type | | `INTERNAL`/`SUPPLIER` |
| transaction_id | varchar(36) | FK → supplier_transactions (null) | Nếu là trả đồ NCC thì gắn giao dịch |
| status | collected_report_status | | `SUBMITTED`/`CONFIRMED` |
| reported_by | varchar(36) | FK → users | Người lập (Leader) |
| confirmed_by | varchar(36) | FK → users (null) | Người xác nhận (Manager) |
| confirmed_at | timestamp | | |
| notes | text | | Ghi chú |
| created_at | timestamp | | |

**Quan hệ:** có nhiều `collected_equipment_report_items`; có thể sinh `inventory_movements` (nhập lại kho).

### 23. `collected_equipment_report_items`
> 🟩 **Module KHO VẬN — migration `002_warehouse_logistics.sql`**

**Mục đích:** Chi tiết kiểm đếm từng thiết bị khi thu hồi: tốt / hỏng / mất.

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| cer_item_id | varchar(36) | PK | Định danh dòng |
| report_id | varchar(36) | FK → collected_equipment_reports | Thuộc biên bản nào |
| item_id | varchar(36) | FK → items | Thiết bị |
| good_quantity | integer | | Số lượng còn tốt |
| damaged_quantity | integer | | Số lượng hỏng |
| lost_quantity | integer | | Số lượng mất |
| notes | text | | Ghi chú |

**Nghiệp vụ:** số hỏng/mất × `items.purchase_price` → tiền đền bù, gộp vào `settlements.compensation`.

---

## Nhóm 5 — Suppliers / Procurement

### 20. `supplier_transactions`
**Mục đích:** **Giao dịch thuê/mua thiết bị với NCC** cho một đơn cụ thể.

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| transaction_id | varchar(36) | PK | Định danh giao dịch |
| transaction_code | varchar(50) | UK | Mã giao dịch |
| supplier_id | varchar(36) | FK → suppliers | Với NCC nào |
| order_id | varchar(36) | FK → orders | Phục vụ đơn nào |
| transaction_type | supplier_transaction_type | | `RENTAL` (thuê) / `PURCHASE` (mua) |
| service_title | varchar(255) | | Mô tả bộ thiết bị/dịch vụ |
| estimated_cost | numeric(14,2) | | Chi phí dự kiến |
| deposit_amount | numeric(14,2) | | Số tiền đặt cọc cho NCC |
| payment_status | supplier_transaction_pay_status | | `UNPAID`/`DEPOSITED`/`PAID` |
| status | supplier_transaction_status | | `PENDING`/`APPROVED`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED` |
| created_at, updated_at | timestamp | | |

**Quan hệ:** thuộc 1 `suppliers` + 1 `orders`; có nhiều `supplier_transaction_items`; có thể được `collected_equipment_reports` tham chiếu (khi trả đồ).
**Nghiệp vụ:** `status` (vận hành) tách biệt `payment_status` (thanh toán).

### 21. `supplier_transaction_items`
**Mục đích:** Chi tiết thiết bị trong một giao dịch NCC.

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| st_item_id | varchar(36) | PK | Định danh dòng |
| transaction_id | varchar(36) | FK → supplier_transactions | Thuộc giao dịch nào |
| item_id | varchar(36) | FK → items (null) | Ánh xạ thiết bị nội bộ (nếu có) |
| item_name | varchar(255) | | Tên thiết bị (có thể ngoài danh mục) |
| quantity | integer | | Số lượng |
| unit_cost | numeric(14,2) | | Đơn giá NCC |
| subtotal | numeric(14,2) | | **Generated**: `quantity*unit_cost` |
| received_quantity | integer | | Số lượng đã nhận |
| notes | text | | Ghi chú |

**Nghiệp vụ:** `item_id` cho phép null vì NCC có thể cung cấp thiết bị chưa có trong danh mục nội bộ.

---

## Nhóm 6 — Finance

### 25. `deposits`
**Mục đích:** Ghi nhận **tiền cọc** của đơn (bảng phẳng, không có cổng thanh toán online). Leader có thể ghi tại hiện trường → Manager duyệt.

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| deposit_id | varchar(36) | PK | Định danh cọc |
| deposit_code | varchar(50) | UK | Mã phiếu cọc |
| order_id | varchar(36) | FK → orders | Cọc cho đơn nào |
| amount | numeric(14,2) | | Số tiền cọc |
| due_date | timestamp | | Hạn nộp cọc |
| payment_date | timestamp | | Ngày thực nộp |
| payment_method | varchar(100) | | Hình thức (tiền mặt/chuyển khoản) |
| qr_code_url | text | | Link QR (nếu có) |
| status | deposit_status | | `PENDING`/`SUCCESS`/`OVERDUE`/`CANCELLED` |
| evidence_id | varchar(36) | FK → evidences (null) | Chứng từ chuyển khoản |
| requested_by | varchar(36) | FK → users | Người tạo yêu cầu cọc |
| approved_by | varchar(36) | FK → users (null) | Người duyệt (Manager) |
| approved_at | timestamp | | |
| notes | text | | Ghi chú |
| created_at, updated_at | timestamp | | |

**Nghiệp vụ:** khi `status=SUCCESS` → cập nhật `orders.payment_status=DEPOSITED` và khóa tồn kho.

### 26. `settlements`
**Mục đích:** **Quyết toán cuối kỳ** của đơn — tổng hợp phụ phí, đền bù, giảm giá để ra số tiền phải thu nốt.

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| settlement_id | varchar(36) | PK | Định danh quyết toán |
| order_id | varchar(36) | FK → orders | Quyết toán cho đơn nào |
| additional_fee | numeric(14,2) | | Phụ phí phát sinh |
| compensation | numeric(14,2) | | Tiền đền bù hỏng/mất |
| discount | numeric(14,2) | | Giảm trừ |
| final_amount | numeric(14,2) | | Số phải thu nốt — **server tự tính** = total + fee + compensation − cọc(SUCCESS) − discount |
| payment_method | varchar(100) | | Hình thức thanh toán |
| qr_code_url | text | | Link QR |
| paid_at | timestamp | | Thời điểm thanh toán |
| evidence_id | varchar(36) | FK → evidences (null) | Chứng từ |
| status | settlement_status | | `DRAFT`/`AGREED`/`REQUESTED`/`PAID`/`CONFIRMED` |
| requested_by | varchar(36) | FK → users (null) | Người yêu cầu (Leader) |
| requested_at | timestamp | | |
| confirmed_by | varchar(36) | FK → users (null) | Người xác nhận (Manager) |
| confirmed_at | timestamp | | |
| notes | text | | Ghi chú |
| created_at, updated_at | timestamp | | |

**Nghiệp vụ:** khi `status=CONFIRMED`/`PAID` → cập nhật `orders.payment_status=PAID`; sau đó Manager đóng đơn.

---

## Nhóm 7 — Shared (dùng chung)

### 9. `evidences`
**Mục đích:** Kho **tệp minh chứng** (ảnh) dùng chung — được nhiều bảng tham chiếu qua `evidence_id`.

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| evidence_id | varchar(36) | PK | Định danh tệp |
| file_url | text | | Đường dẫn file (Firebase Storage) |
| description | text | | Mô tả |
| uploaded_by | varchar(36) | FK → users | Người tải lên |
| created_at | timestamp | | |

**Quan hệ:** được `schedule_plans`, `attendances`, `survey_reports`, `deposits`, `settlements` tham chiếu (tùy chọn).
**Nghiệp vụ:** thiết kế tách riêng để tái sử dụng cho mọi loại ảnh minh chứng, thay vì mỗi bảng tự lưu file.

### 27. `notifications`
**Mục đích:** **Thông báo** gửi tới người dùng. Mỗi dòng là 1 thông báo cho 1 người nhận (đã gộp trạng thái đã đọc vào cùng bảng).

| Cột | Kiểu | Khóa | Mô tả |
|---|---|---|---|
| notification_id | varchar(36) | PK | Định danh thông báo |
| user_id | varchar(36) | FK → users | Người nhận |
| title | varchar(255) | | Tiêu đề |
| content | text | | Nội dung |
| notification_type | notification_type | | `SYSTEM`/`ORDER`/`TASK`/`SCHEDULE`/`PAYMENT`/`SURVEY`/`INVENTORY`/`SUPPLIER`/`OTHER` |
| ref_type | varchar(100) | | Loại đối tượng liên quan (polymorphic, **không FK**) |
| ref_id | varchar(36) | | ID đối tượng liên quan |
| is_read | boolean | | Đã đọc hay chưa |
| read_at | timestamp | | Thời điểm đọc |
| created_at | timestamp | | |

**Nghiệp vụ:** `(ref_type, ref_id)` là liên kết **đa hình** — trỏ tới nhiều loại thực thể (đơn, kế hoạch, thanh toán…) nên không dùng khóa ngoại cứng.

---

## Phụ lục — Bảng tổng hợp 28 thực thể

> **Migration**: `001` = lõi · `002` = kho vận (🟩).

| # | Bảng | Migration | Nhóm | PK | Số FK | Vai trò |
|---|---|---|---|---|---|---|
| 1 | users | 001 | Identity | user_id | 0 | Tài khoản nội bộ (RBAC) |
| 2 | customers | 001 | Identity | customer_id | 0 | Khách hàng |
| 3 | suppliers | 001 | Identity | supplier_id | 0 | Nhà cung cấp |
| 4 | business_policies | 001 | Identity | policy_id | 0 | Chính sách nghiệp vụ |
| 5 | item_categories | 001 | Catalog | category_id | 0 | Nhóm thiết bị (tầng 1) |
| 6 | item_types | 001 | Catalog | type_id | 1 | Loại thiết bị (tầng 2) |
| 7 | items | 001 | Catalog | item_id | 1 | Thiết bị cụ thể (tầng 3) |
| 8 | inventory | **002** 🟩 | Kho vận | inventory_id | 1 | Tồn kho (1-1 với item) |
| 9 | evidences | 001 | Shared | evidence_id | 1 | Tệp minh chứng |
| 10 | quotations | 001 | Sales | quotation_id | 2 | Báo giá |
| 11 | quotation_items | 001 | Sales | quotation_item_id | 2 | Hạng mục báo giá |
| 12 | orders | 001 | Sales | order_id | 4 | **Đơn đặt (trung tâm)** |
| 13 | order_items | 001 | Sales | order_item_id | 2 | Hạng mục đơn |
| 14 | work_tasks | 001 | Operations | task_id | 0 | Danh mục loại việc |
| 15 | schedule_plans | 001 | Operations | plan_id | 4 | Kế hoạch điều phối (đầu mục việc) |
| 16 | schedule_plan_assignees | 001 | Operations | assignee_id | 2 | **Bảng nối người ↔ việc (role)** |
| 17 | attendances | 001 | Operations | attendance_id | 2 | Chấm công |
| 18 | survey_reports | 001 | Operations | survey_id | 5 | Báo cáo khảo sát |
| 19 | change_requests | 001 | Operations | change_request_id | 1 | Yêu cầu thay đổi |
| 20 | change_request_items | 001 | Operations | change_request_item_id | 2 | Chi tiết thay đổi |
| 21 | supplier_transactions | 001 | Procurement | transaction_id | 2 | Giao dịch NCC |
| 22 | supplier_transaction_items | 001 | Procurement | st_item_id | 2 | Chi tiết giao dịch NCC |
| 23 | collected_equipment_reports | **002** 🟩 | Kho vận | report_id | 4 | Biên bản thu hồi |
| 24 | collected_equipment_report_items | **002** 🟩 | Kho vận | cer_item_id | 2 | Chi tiết kiểm đếm |
| 25 | inventory_movements | **002** 🟩 | Kho vận | movement_id | 4 | Sổ biến động kho |
| 26 | deposits | 001 | Finance | deposit_id | 4 | Cọc |
| 27 | settlements | 001 | Finance | settlement_id | 4 | Quyết toán |
| 28 | notifications | 001 | Shared | notification_id | 1 | Thông báo |

