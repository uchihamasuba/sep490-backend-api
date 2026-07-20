# API cho màn "Chi tiết báo giá" (`/manager/quotations/[id]`, `/admin/quotations/[id]`)

> Phạm vi tài liệu này: **chỉ** 2 "trang" nội dung chuyển bằng chấm phân trang ở giữa màn chi tiết báo
> giá — theo đúng 2 ảnh mẫu người dùng cung cấp:
> - **Trang 1/2 — Bản đề xuất báo giá chính thức**: khối "Phân công khảo sát báo giá" + letterhead +
>   đơn vị thụ hưởng/ghi chú điều khoản + bảng hạng mục báo giá + tổng kết.
> - **Trang 2/2 — Picklist chi tiết vật tư chuẩn bị kho**: bóc tách từng hạng mục báo giá thành vật tư
>   cấu thành cụ thể + khối tồn kho + khối "Tổng hợp lệnh xuất kho dự kiến".
>
> **Không** bao gồm: sửa hạng mục inline (`isEditingItems`, đã có endpoint nền `PUT /api/v1/quotations/:id`
> ở [`docs/taobaogiamoi_api.md`](taobaogiamoi_api.md), chỉ khác payload đến từ form sửa thay vì modal tạo
> mới), modal "Sinh hợp đồng & đơn đặt" (`CreateOrderFromQuotationModal`), khối "Đối chiếu khảo sát"
> (`SurveyComparisonPanel`, chỉ xuất hiện khi trạng thái `surveying` — trạng thái này **không tồn tại**
> trong DB thật, xem [`docs/danhsachbaogia_api.md`](danhsachbaogia_api.md) mục 3.1), màn danh sách báo giá
> (đã có tài liệu riêng), hay modal tạo báo giá mới (đã có tài liệu riêng). Các nút "Sao chép ảnh"/"In báo
> giá"/"In phiếu picklist" là hành động thuần client (`html-to-image`, `window.print()`), không gọi API.
>
> Nguồn tham chiếu:
> - FE: `src/app/manager/quotations/[id]/page.tsx` (mirror 1:1 `src/app/admin/quotations/[id]/page.tsx`),
>   `src/components/quotations/QuotationPicklistView.tsx`, `src/components/quotations/InventoryAvailabilityPanel.tsx`,
>   `src/mocks/db/quotations.ts` (`getQuotationItemPicklist`, `getMockInStock`, `AdminQuotationRow`,
>   `AdminQuotationDetail`), `src/types/quotation.ts`, `src/services/quotation.service.ts`.
> - DB thật: đối chiếu trực tiếp qua MySQL MCP ngày 2026-07-20 — `SHOW CREATE TABLE quotations`,
>   `quotation_items`, `items`, `item_types`, `item_categories`, `customers`, `orders`, `survey_reports`,
>   `schedule_plans`, `schedule_plan_assignees`, `work_tasks`, `business_policies`, `users`; dữ liệu mẫu
>   hiện có: 1 báo giá thật (`QUO-001`, `APPROVED`, 2 dòng hạng mục — `Loa JBL 1000W`/`Đèn Beam 230`), 1
>   order thật (`ORD-001`, trỏ ngược `quotation_id` = QUO-001), 1 survey report thật (`SUR-001`, gắn
>   `order_id` = ORD-001, **không có `quotation_id`**), 1 schedule plan thật (`PLN-001`, gắn `order_id`,
>   **không có `quotation_id`**), 2 category (Âm thanh/Ánh sáng) — quá ít để suy luận phân bố, chỉ đủ xác
>   nhận đúng schema & quan hệ khóa ngoại.
> - Kế thừa toàn bộ quy ước/vấn đề đã chốt ở `docs/danhsachbaogia_api.md` (enum `status` thật, kiểu
>   `version`) và `docs/taobaogiamoi_api.md` (payload `POST/PUT .../quotations`) — không lặp lại chi tiết,
>   chỉ dẫn chiếu khi liên quan trực tiếp tới màn chi tiết.
>
> **Chưa chốt với Product/Backend** — tài liệu này có **2 vấn đề kiến trúc nghiêm trọng** (mục 3 và mục 4)
> khiến phần lớn Trang 2 (Picklist) và khối "Phân công khảo sát báo giá" **không thể** implement đúng như
> ảnh mẫu với schema hiện tại — cần Product/Backend quyết định hướng trước khi giao việc cho backend code.

## 0. Base URL & Auth

- Base path: `/api/v1` (REST, JWT Bearer theo `AuthContext`).
- Dùng chung cho `/admin/quotations/:id` (Admin, chỉ xem/audit — ẩn mọi nút hành động ghi: sửa hạng mục,
  phê duyệt/từ chối, xóa, phân công khảo sát, sinh hợp đồng) và `/manager/quotations/:id` (Manager, đầy đủ
  quyền thao tác).

## 1. Trang 1/2 — Bản đề xuất báo giá chính thức

### 1.1. Header, breadcrumb, nút hành động

| Trường/nút trên UI | Nguồn dữ liệu | API thật |
|---|---|---|
| `Báo giá BG001` + badge trạng thái | `row.code`, `row.status` | `GET /api/v1/quotations/:id` (mục 5.1) — `quotationCode`, `status`. |
| `Phiên bản: v1 \| Tạo bởi: Lê Minh Dũng (Kinh doanh)` | `row.version`, `row.assignee` (chuỗi tên tự sinh, không phải user thật) | `version` khớp cột `quotations.version` thật (chuỗi tự do, xem mục 5.1). **"Tạo bởi"**: `quotations.created_by` (FK `users.user_id`, NOT NULL) — join lấy `users.full_name`. **Chữ "(Kinh doanh)" không có căn cứ thật**: `users.role` thật chỉ có `ADMIN\|MANAGER\|LEADER\|TECHNICAL` (không có "Kinh doanh"/Sales) — theo CLAUDE.md chỉ Manager tạo báo giá, nên người tạo luôn có `role = 'MANAGER'`; **đề xuất đổi nhãn hiển thị từ "(Kinh doanh)" sang "(Quản lý)"** hoặc bỏ hẳn phần role trong ngoặc, không tự bịa nhãn phòng ban không tồn tại trong hệ thống. |
| Nút "Sao chép ảnh" / "In báo giá" | — | Không gọi API — client-side thuần (`html-to-image`, `window.print()`). |
| Nút "Xóa" (khi `canDelete`) | `row.status === 'draft' \|\| 'surveying'` | `DELETE /api/v1/quotations/:id` (đã có, `quotationApiService.deleteQuotation` — chỉ xóa được khi `status !== 'APPROVED'`, khớp enum thật 3 giá trị, bỏ điều kiện `surveying`). |
| Nút "Phê duyệt báo giá" / "Từ chối" (khi `canApproveReject`) | `updateAdminQuotation(id, { status: 'approved'/'rejected' })` | `PATCH /api/v1/quotations/:id/status` (đã có, `UpdateQuotationStatusPayload`, xem `src/types/quotation.ts`). |
| Nút "Lập/Đổi lịch phân công khảo sát báo giá" | Điều hướng sang `/manager/schedule/plans?quotationId=...` hoặc mở modal `isSurveyModalOpen` | Xem mục 2 — **vấn đề kiến trúc lớn**, chưa có endpoint thật tương ứng. |
| Nút "Sinh hợp đồng & đơn đặt" (khi `status === 'approved'`) | Mở `CreateOrderFromQuotationModal` | Ngoài phạm vi tài liệu này — luồng tạo Order riêng, cần tài liệu khác. |

### 1.2. Letterhead + Đơn vị thụ hưởng + Ghi chú điều khoản

| Trường trên UI | Nguồn dữ liệu (mock) | Cột DB thật | Ghi chú |
|---|---|---|---|
| "Số: BG001", "Ngày lập: ...", "Cập nhật cuối: ..." | `row.code`, `row.createdAt`, `row.updatedAt` | `quotation_code`, `created_at`, `updated_at` | Khớp trực tiếp. |
| Tên/SĐT/email/địa chỉ khách hàng | `row.customerName`, `row.customerPhone`, `detail.customerEmail`, `detail.customerAddress` | JOIN `customers.customer_name/phone/email/address` qua `quotations.customer_id` | Khớp trực tiếp — `customers.email`/`address` nullable thật (không bắt buộc có). |
| "Ghi chú điều khoản" | `row.notes` | `quotations.notes` (text, nullable) | Khớp. Placeholder "Không có yêu cầu ghi chú gì thêm..." khi rỗng — xử lý ở FE, không cần backend trả chuỗi mặc định. |
| "Chính sách chung" — hoàn cọc/hủy đơn theo % | `MOCK_POLICIES` lọc `policyType === 'DEPOSIT' \|\| 'CANCELLATION'` | `business_policies` (đã xác nhận đúng schema thật — `policy_type ENUM('DEPOSIT','CANCELLATION','COMPENSATION','FEE')`, dữ liệu mẫu thật: `DEP-50` 50% deposit, `CAN-10` 10% cancellation fee) | **Đã có bảng thật** — cần thêm `GET /api/v1/policies?type=DEPOSIT,CANCELLATION&isActive=true` (hoặc dùng lại endpoint policies chung nếu đã có ở module Master data, ngoài phạm vi tài liệu này) thay vì hard-code chính sách 3 mốc %/ngày trong CLAUDE.md — **dữ liệu policy thật hiện chỉ có 1 mốc %/loại** (`50%`/`10%` cố định), không phải bảng nhiều mốc theo số ngày như mô tả nghiệp vụ ở CLAUDE.md mục 1 (`≥30 ngày → 100%`, `7-30 ngày → 50%`, `<7 ngày → 0%`) — **lệch dữ liệu seed vs quy tắc nghiệp vụ đã tài liệu hóa, cần Product xác nhận lại cấu trúc `policy_value` có hỗ trợ nhiều bậc theo khoảng ngày hay chỉ 1 giá trị %/loại chính sách**. |
| "Báo giá có hiệu lực đến hết ngày ..." | `row.validUntil` | **Không có cột tương ứng** trong `quotations` thật | Đã nêu ở `docs/danhsachbaogia_api.md` mục 3.2 — nhắc lại vì đây là nơi hiển thị trực tiếp trên bản in báo giá thật gửi khách hàng (không chỉ nội bộ). Cần Product xác nhận có cần thêm cột `valid_until` vào `quotations` hay bỏ hẳn dòng này khỏi bản in. |

### 1.3. Bảng "Hạng mục báo giá"

| Cột UI | Nguồn (mock) | Cột/join DB thật | Ghi chú |
|---|---|---|---|
| STT | index | — | Tính ở FE. |
| Tên hạng mục | `item.name` | `quotation_items.item_name` (snapshot tại thời điểm lập báo giá) | Khớp — đã chốt là snapshot, không tự query lại tên mới nhất từ `items` (mục 3.1 doc trước). |
| Phân loại | `item.category` — 1 trong 4 giá trị cố định `ITEM_CATEGORY_OPTIONS` (`Dịch vụ...`, `Trang trí...`, `Thiết bị...`, `Khác`) | **Không có cột tương ứng trên `quotation_items`** | **Lệch kiến trúc**: `quotation_items` không snapshot category — chỉ có thể suy ra qua join `item_id → items.type_id → item_types.category_id → item_categories.category_name`, nhưng `item_categories` thật là danh mục **chi tiết** (dữ liệu mẫu: `"Âm thanh"`, `"Ánh sáng"` — sẽ còn nhiều category chi tiết khác khi nhập đủ catalog), **không phải** 4 nhóm gộp lớn (`Dịch vụ`/`Trang trí`/`Thiết bị`/`Khác`) mà UI đang hiển thị. Cần Product chốt 1 trong 2 hướng: **(a)** đổi UI hiển thị đúng `category_name` chi tiết thật (bỏ khái niệm 4 nhóm gộp), hoặc **(b)** giữ 4 nhóm gộp trên UI nhưng cần thêm 1 tầng mapping `category_id → nhóm gộp` (bảng cấu hình mới hoặc cột `group` trên `item_categories`) do Product định nghĩa — **không tự suy diễn cách gộp ở FE**. |
| ĐVT | `item.unit` | `items.unit` (qua `item_id`, **không snapshot trên `quotation_items`**) | **Khác với `itemName`/`price`**: ĐVT **không được snapshot** trong `quotation_items` thật (bảng chỉ có `item_id/item_name/quantity/price/discount/line_total`, không có cột `unit`) — nghĩa là nếu sau này đổi đơn vị tính của `items.unit`, các báo giá cũ sẽ hiển thị ĐVT mới thay vì ĐVT lúc lập (khác nguyên tắc "ảnh chụp tại thời điểm lập" đã áp dụng cho tên/giá). Cần Product xác nhận có chấp nhận được không, hay cần thêm cột `unit` vào `quotation_items` để snapshot luôn (khuyến nghị, để nhất quán với `item_name`). |
| SL / Đơn giá / Chiết khấu / Thành tiền | `item.quantity/unitPrice/discount`, `lineTotal` tính tại FE | `quotity`, `price`, `discount`, `line_total` (generated/lưu sẵn) | Khớp trực tiếp — `discount` trên `quotation_items` **là tổng giảm của cả dòng** (đã chốt ở `docs/taobaogiamoi_api.md` mục 3.4), FE hiển thị lại nguyên giá trị backend trả, không tự nhân `quantity` lần nữa khi đọc. |

### 1.4. Tổng kết

`Tổng tiền dịch vụ` / `Khấu trừ giảm giá` / `Thành tiền` = `quotations.subtotal` / `discount_total` /
`total_amount` — khớp trực tiếp, không cần FE tự cộng dồn từ `items[]`.

## 2. Khối "Phân công khảo sát báo giá" — vấn đề kiến trúc lớn nhất của Trang 1

Khối này hiển thị **1 người phụ trách khảo sát + ngày giờ + ghi chú + badge "Đã phân công"/"Đã lập kế
hoạch"** gắn trực tiếp với **báo giá**. Đối chiếu schema thật:

- `quotations` **không có cột nào** liên kết tới khảo sát hay tới `orders`.
- Chiều liên kết thật duy nhất là **ngược lại**: `orders.quotation_id` (nullable) trỏ tới 1 quotation.
- `survey_reports.order_id` là **NOT NULL** (khảo sát luôn thuộc về 1 Order có sẵn, không thể tồn tại
  độc lập hay gắn thẳng vào Quotation).
- `schedule_plans.order_id` cũng là **NOT NULL** (kế hoạch — bao gồm kế hoạch khảo sát — luôn thuộc về 1
  Order có sẵn).
- Dữ liệu mẫu thật xác nhận đúng chiều này: `QUO-001` (quotation) ← `ORD-001.quotation_id` (order trỏ
  ngược lại) ← `SUR-001.order_id` (survey report thuộc order đó, `plan_id` của survey report này = NULL)
  và `PLN-001.order_id` (schedule plan cũng thuộc order đó, không có bản ghi nào trỏ thẳng tới quotation).

Nói cách khác: **muốn hiển thị đúng khối này, backend phải truy ngược qua Order** (`orders` WHERE
`quotation_id = :quotationId` → lấy `order_id` → tra `survey_reports`/`schedule_plans` theo `order_id`
đó), **không có đường đi trực tiếp** từ Quotation tới khảo sát. Điều này chỉ khả thi khi **Order đã tồn
tại và đã có `quotation_id` trỏ ngược** — tức là chỉ đúng với báo giá đã `APPROVED` và đã được dùng để tạo
Order (giống ảnh mẫu: `BG001` trạng thái "Đã duyệt"). Với báo giá `DRAFT` (chưa có Order nào tham chiếu
tới), **không có cách nào tra ra khảo sát/kế hoạch qua Quotation** bằng schema hiện tại — mâu thuẫn trực
tiếp với nút "Lập kế hoạch khảo sát báo giá" mà UI hiển thị ngay cả khi báo giá còn là bản nháp.

**Đây là hệ quả trực tiếp của vấn đề đã nêu ở `docs/danhsachbaogia_api.md` mục 3.1** (khảo sát diễn ra
*trước khi* báo giá tồn tại về mặt dữ liệu) — tài liệu đó đề xuất Hướng A (bỏ trạng thái "Đang khảo sát"
khỏi Quotation, coi khảo sát là giai đoạn của Order/Request độc lập). Áp dụng nhất quán Hướng A cho màn
chi tiết này thì kéo theo: **khối "Phân công khảo sát báo giá" ở trang chi tiết Quotation về bản chất
không thuộc về đây** — nó nên hiển thị ở trang chi tiết Order (nơi đã có `survey_reports`/`schedule_plans`
liên kết trực tiếp và hợp lệ), Quotation detail chỉ nên **link sang** trang Order/Survey tương ứng (nếu
đã có) thay vì tự vẽ lại toàn bộ thông tin phân công tại đây.

**Đề xuất (cần Product xác nhận trước khi backend code)**:
- **Hướng A (khuyến nghị, nhất quán với hướng đã chọn ở doc danh sách)**: bỏ khối "Phân công khảo sát báo
  giá" khỏi trang chi tiết Quotation. Thay bằng 1 dòng liên kết nhỏ "Xem khảo sát hiện trường" trỏ sang
  trang Order/Survey **chỉ khi** `orders` có bản ghi với `quotation_id` = báo giá này (dùng
  `GET /api/v1/quotations/:id` mở rộng trả kèm `linkedOrderId` — xem mục 5.1).
- **Hướng B (không khuyến nghị)**: thêm cột `quotation_id` (nullable) trực tiếp vào `survey_reports` và/hoặc
  `schedule_plans` để cho phép gắn khảo sát/kế hoạch thẳng vào Quotation trước khi có Order — phá vỡ ý
  nghĩa hiện tại của 2 bảng này (luôn thuộc về Order thi công thật) và tạo 2 nguồn sự thật song song cho
  cùng 1 khái niệm "khảo sát", dễ gây double-tracking khi Order được tạo sau đó từ chính Quotation này.

## 3. Trang 2/2 — Picklist chi tiết vật tư chuẩn bị kho — vấn đề kiến trúc nghiêm trọng nhất tài liệu

### 3.1. Bóc tách hạng mục thành "vật tư cấu thành" (`getQuotationItemPicklist`)

Với mỗi hạng mục báo giá (vd "Hệ thống Loa Line Array RCF cao cấp"), Trang 2 hiển thị **một bảng con liệt
kê 3-6 vật tư/thiết bị cấu thành cụ thể** (vd "Củ loa Line Array RCF...", "Loa Subwoofer...", "Khung giàn
treo loa...", "Bàn điều khiển Mixer...", "Tủ rack thiết bị...", "Dây cáp tín hiệu..."), mỗi dòng có SL
cần/ĐVT/tồn kho/nguồn/ghi chú kỹ thuật riêng.

Toàn bộ nội dung này hiện là **hard-code theo từ khóa tên hạng mục** (`getQuotationItemPicklist` —
`if (name.includes('loa'))`, `if (name.includes('beam'))`...) trong `src/mocks/db/quotations.ts`, **không
đọc từ bất kỳ bảng dữ liệu nào**. Đối chiếu `SHOW TABLES` toàn bộ database thật (24 bảng) — **không tồn
tại bảng nào biểu diễn quan hệ "1 item cấu thành từ nhiều item/vật tư con"** (không có `bill_of_materials`,
`item_components`, `item_kits` hay tương tự). `items` là bảng phẳng (item_code/item_name/type_id/unit/giá),
không có self-reference hay bảng trung gian nào cho phép 1 `item_id` "gồm" nhiều `item_id` khác.

**Đây không phải thiếu 1 endpoint — là thiếu hẳn 1 khái niệm dữ liệu (BOM — Bill of Materials) chưa được
model hóa trong schema.** Không thể viết endpoint thật cho phần này nếu không có bảng mới, ví dụ:

```sql
-- Đề xuất minh họa, CHƯA CHỐT — cần Product xác nhận có thật sự cần khái niệm này
CREATE TABLE item_components (
  component_id varchar(36) PRIMARY KEY,
  parent_item_id varchar(36) NOT NULL REFERENCES items(item_id), -- hạng mục báo giá (vd "Hệ thống loa...")
  child_item_id varchar(36) NOT NULL REFERENCES items(item_id),  -- vật tư cấu thành (vd "Củ loa RCF")
  quantity_per_unit int NOT NULL, -- số lượng vật tư con cần cho 1 đơn vị hạng mục cha
  is_external tinyint(1) NOT NULL DEFAULT 0, -- Internal (kho BN) hay External (thuê ngoài) — hiện đang suy từ tên, không phải thuộc tính thật của item
  notes text
);
```

**Đề xuất (cần Product/Backend xác nhận)**:
- **Hướng A (khuyến nghị nếu Picklist là tính năng thật sự cần)**: model hóa BOM như trên, `items` cần
  phân biệt rõ "item bán/báo giá cho khách" (vd combo "Hệ thống Loa Line Array") và "item vật tư/thiết bị
  vật lý trong kho" (vd "Củ loa RCF", "Dây cáp Sommer") — 2 loại `items` khác nhau nhưng cùng nằm 1 bảng
  phẳng hiện tại, cần thêm cách phân loại (cột `item_kind ENUM('SELLABLE','COMPONENT')` hoặc tương tự).
  Việc nhập liệu BOM cho hàng trăm item thiết bị sự kiện là khối lượng công việc lớn, cần Product cân nhắc
  độ ưu tiên trước khi backend đầu tư model + endpoint.
- **Hướng B (tối giản, ít việc nhất)**: bỏ hẳn khái niệm "bóc tách vật tư cấu thành" khỏi Trang 2 — Picklist
  chỉ hiển thị **thẳng danh sách `quotation_items` gốc** (đã có sẵn từ `GET /api/v1/quotations/:id`) kèm
  cột tồn kho (vẫn cần giải quyết mục 3.2), không giả lập thêm 1 tầng "vật tư con" không có căn cứ dữ liệu
  thật. Đây là phiên bản Picklist đơn giản hơn ảnh mẫu nhưng **có thể code thật ngay** với schema hiện tại.
- **Hướng C**: giữ nguyên hiển thị bóc tách nhưng chuyển hẳn thành **nội dung tĩnh soạn tay bởi
  Admin/Manager cho từng loại hạng mục phổ biến** (không phải tính tự động từ tồn kho thật) — tương tự
  cách 1 số hệ thống dùng "checklist mẫu" gắn theo `type_id`, không đòi hỏi model BOM đầy đủ số lượng/tồn
  kho chính xác, chỉ là gợi ý chuẩn bị. Cần thêm bảng đơn giản hơn Hướng A (chỉ tên gợi ý theo `type_id`,
  không cần số lượng/tồn kho join thật).

Tài liệu này **không tự chọn hướng** vì đây là quyết định về phạm vi tính năng (Product), không phải chi
tiết kỹ thuật thuần túy như các mục đã tự chốt ở 2 tài liệu trước.

### 3.2/3.3. Cột "Tồn kho" và khối "Kiểm tra & dự báo khả dụng tồn kho thiết bị" — không có bảng tồn kho thật

Cả cột "Tồn kho" trong bảng bóc tách (mục 3.1) lẫn khối `InventoryAvailabilityPanel` ở cuối Trang 2 (bảng
"Nhu cầu thực tế / Tồn kho khả dụng / Nguồn cung / Trạng thái khả dụng") đều đọc từ `getMockInStock(name)`
— **một hàm suy đoán số tồn kho từ từ khóa trong tên item** (vd tên chứa "loa" → trả cứng `4`), hoàn toàn
không phải số liệu thật.

Đối chiếu `SHOW TABLES` — **không có bất kỳ bảng nào theo dõi số lượng tồn kho** (không có `inventory`,
`warehouse_stock`, `stock_levels` hay tương tự). `items` chỉ có `rental_price`/`purchase_price`/`status`
(`ACTIVE`/`INACTIVE`/`MAINTENANCE` — trạng thái của **loại thiết bị**, không phải số lượng còn trong kho).
CLAUDE.md mục "Vòng đời Order" mô tả nghiệp vụ **Date-based Inventory Lock** (tồn kho theo ngày, khóa theo
loại + số lượng) và liệt kê các trạng thái tồn kho chi tiết (`Available`/`Reserved`/`Checked-out`/...) —
đây rõ ràng là 1 module nghiệp vụ cốt lõi **đã được đặc tả nhưng chưa được implement ở tầng schema**, không
chỉ riêng cho màn hình này (ảnh hưởng toàn bộ hệ thống: Picklist, xuất kho, điều phối, hoàn kho).

**Đây là điều kiện tiên quyết lớn hơn phạm vi 1 màn hình** — không thể tự đề xuất 1 endpoint vá tạm cho
riêng Trang 2 vì tồn kho phải là 1 nguồn sự thật dùng chung xuyên suốt nhiều module (Picklist, Điều phối,
Nghiệm thu, Hoàn kho — đều cần cùng 1 con số tồn kho nhất quán, không thể mỗi màn tự tính 1 kiểu). Đề xuất
ghi nhận vào `docs/more-require.md` như 1 hạng mục backlog lớn ("Module Tồn kho theo ngày — Date-based
Inventory Lock") thay vì cố định nghĩa API tồn kho chỉ để phục vụ riêng Picklist báo giá.

**Cho tới khi module Tồn kho được thiết kế**: Trang 2 (nếu vẫn cần lên môi trường thật sớm) chỉ nên hiển
thị **danh sách `quotation_items` thật** (mục 3.1 Hướng B) **không kèm cột tồn kho** (ẩn hẳn cột "Tồn kho
khả dụng"/"Trạng thái khả dụng", hoặc hiển thị placeholder "Chưa có dữ liệu tồn kho" thay vì số giả) — an
toàn hơn hiển thị số tồn kho sai lệch cho nhân viên kho dùng làm căn cứ chuẩn bị hàng thật.

### 3.4. Khối "Tổng hợp lệnh xuất kho dự kiến"

`internalCount`/`externalCount` (số dòng hàng nội bộ/thuê ngoài) tính từ kết quả bóc tách ở mục 3.1 — phụ
thuộc hoàn toàn vào việc chốt hướng ở mục 3.1. Riêng "Tải trọng hậu cần: Trung bình (Phù hợp xe 2.5T)" là
**chuỗi hard-code cố định**, không tính toán gì — cần Product xác nhận có thật sự cần tính tải trọng
logistics tự động (dựa trên khối lượng/kích thước thiết bị — dữ liệu này cũng chưa có cột nào trên `items`)
hay chỉ là placeholder trang trí, có thể bỏ hẳn nếu không có giá trị nghiệp vụ thật.

Nút "Yêu cầu soạn kho" hiện chỉ `alert()` — nếu Product muốn đây là hành động thật (tạo yêu cầu xuất kho
gửi cho nhân viên kho), cần thiết kế thêm 1 endpoint tạo "phiếu yêu cầu soạn hàng" gắn `quotationId`, đợi
sau khi có module Tồn kho (mục 3.2/3.3) — chưa đề xuất chi tiết ở đây.

## 4. Vấn đề kế thừa từ tài liệu trước — nhắc lại vì ảnh hưởng trực tiếp màn này

- Enum `status` thật chỉ có `DRAFT`/`APPROVED`/`REJECTED`, không có `SURVEYING` — trang chi tiết hiện có
  nhiều nhánh UI dựa vào `status === 'surveying'` (khối đối chiếu khảo sát, nút "Xem đối chiếu khảo sát",
  timeline 4 bước) cần thiết kế lại theo Hướng A/B đã nêu ở `docs/danhsachbaogia_api.md` mục 3.1 trước khi
  nối API cho toàn bộ trang chi tiết, không chỉ khối phân công khảo sát ở mục 2.
- `version` là `string` tự do (vd `"v1"`), không phải `number` — trang chi tiết đang hiển thị `v{row.version}`
  (tự thêm tiền tố `v`), cần đổi sang hiển thị nguyên văn giống đã nêu ở tài liệu danh sách.

## 5. Endpoint đề xuất

### 5.1. `GET /api/v1/quotations/:id` — mở rộng response cho trang chi tiết

Endpoint **đã có sẵn** (`quotationApiService.getQuotation`) nhưng theo `docs/api/08-quotations.md`/
`types/quotation.ts` hiện chỉ trả `Quotation` + `items[]` (không kèm thông tin khách hàng, người tạo,
order liên kết) — trang chi tiết cần nhiều hơn thế. Đề xuất mở rộng response:

```json
{
  "success": true,
  "code": "OK",
  "message": "",
  "data": {
    "quotationId": "7ccd5226-ed69-4ae3-ae16-06e5b4184843",
    "quotationCode": "QUO-001",
    "customerId": "4c700a21-5440-41f7-b66e-acedd12a0e76",
    "customerName": "Nguyễn Minh Trí",
    "customerPhone": "0910000000",
    "customerEmail": "tri.nm@gmail.com",
    "customerAddress": "123 Nguyễn Huệ, P. Bến Nghé, Q.1, TP. Hồ Chí Minh",
    "version": "v1",
    "subtotal": 1600000,
    "discountTotal": 0,
    "totalAmount": 1600000,
    "status": "APPROVED",
    "notes": null,
    "createdBy": { "userId": "afcad54a-...", "fullName": "Lê Minh Dũng", "role": "MANAGER" },
    "createdAt": "2026-07-19T09:47:37.000Z",
    "updatedAt": "2026-07-19T09:47:37.000Z",
    "linkedOrderId": "c1cae042-93c9-4e0a-9ce3-673424e8adc9",
    "items": [
      {
        "quotationItemId": "8c3cc951-8391-11f1-9279-56d18f15e6bb",
        "itemId": "88dc60e1-89fa-497b-8bd5-b9c2ece4986e",
        "itemName": "Loa JBL 1000W",
        "categoryName": "Âm thanh",
        "unit": "Cái",
        "quantity": 2,
        "price": 500000,
        "discount": 0,
        "lineTotal": 1000000
      }
    ]
  }
}
```

- `customerEmail`/`customerAddress`: JOIN `customers` qua `customer_id` (mục 1.2).
- `createdBy`: JOIN `users` qua `created_by` — trả object thay vì chỉ tên chuỗi, để FE tự quyết định hiển
  thị nhãn role phù hợp (mục 1.1) thay vì hard-code "(Kinh doanh)".
- `linkedOrderId`: `orders.order_id` WHERE `orders.quotation_id = :id` (`NULL` nếu chưa có Order nào tham
  chiếu) — phục vụ Hướng A ở mục 2 (link "Xem khảo sát hiện trường" khi có, ẩn khi không).
- `items[].categoryName`: JOIN `items → item_types → item_categories`, trả **tên category chi tiết thật**
  (vd `"Âm thanh"`) — thay cho `category` tự do hiện tại (mục 1.3), chờ Product chốt hướng (a)/(b) đã nêu.
- `items[].unit`: JOIN `items.unit` — như đã nêu ở mục 1.3, đây **không phải snapshot**, sẽ đổi theo giá
  trị mới nhất của `items.unit` nếu backend không thêm cột `unit` snapshot vào `quotation_items`.

**Permission**: Manager + Admin (đọc, đúng CLAUDE.md).

### 5.2. Khảo sát/kế hoạch gắn với báo giá — CHƯA đề xuất endpoint cụ thể

Phụ thuộc hoàn toàn vào hướng chốt ở mục 2. Nếu chốt Hướng A: không cần endpoint mới cho riêng khối này —
chỉ cần `linkedOrderId` ở mục 5.1, còn chi tiết khảo sát/kế hoạch load ở trang Order
(`GET /api/v1/orders/:id` hoặc `GET /api/v1/orders/:id/survey`, ngoài phạm vi tài liệu này).

### 5.3. Picklist (Trang 2) — CHƯA đề xuất endpoint cụ thể

Phụ thuộc hoàn toàn vào hướng chốt ở mục 3.1 (BOM) và 3.2/3.3 (module Tồn kho). Nếu Product chọn Hướng B ở
mục 3.1 (bản Picklist tối giản, không bóc tách vật tư con) làm bước đệm trước khi có BOM/Tồn kho thật, thì
Trang 2 **không cần endpoint riêng** — dùng lại nguyên `items[]` từ `GET /api/v1/quotations/:id` (mục 5.1),
chỉ khác cách trình bày ở FE (nhóm theo `quotationItemId` thay vì bóc tách vật tư con), tạm ẩn mọi cột liên
quan tồn kho.

## 6. Tổng hợp việc cần sửa ở FE khi nối API thật

- `page.tsx` (cả 2 khu vực): đổi `getAdminQuotationDetail(id)` sang gọi `quotationApiService.getQuotation(id)`
  với response mở rộng ở mục 5.1; bỏ hard-code `(Kinh doanh)`, dùng `createdBy.role` trả về.
- Bỏ hẳn hoặc thiết kế lại khối "Phân công khảo sát báo giá" theo hướng Product chọn ở mục 2 — không giữ
  nguyên logic hiện tại (`getAdminSchedulePlanByQuotationId`/`row.surveyAssignment`) vì không có cột DB
  thật tương ứng.
- Trang 2 (`QuotationPicklistView`, `InventoryAvailabilityPanel`): gỡ `getQuotationItemPicklist`/
  `getMockInStock` (hoàn toàn hard-code theo từ khóa tên) — chờ quyết định hướng ở mục 3 trước khi viết
  lại; không tự nối "API tưởng tượng" nào cho phần bóc tách BOM/tồn kho khi backend chưa có bảng tương ứng.
  Trong lúc chờ quyết định, có thể tạm giữ nguyên trạng mock hiện tại nhưng **hiển thị in nghiêng toàn bộ
  cột tồn kho + bảng bóc tách vật tư con** theo đúng rule CLAUDE.md mục 4 (mock rõ ràng khi biết backend
  chưa hỗ trợ) và ghi bổ sung vào `docs/more-require.md`.
- Đổi cột "Phân loại" trong bảng hạng mục báo giá (Trang 1) sang dùng `items[].categoryName` thật khi
  Product chốt hướng (a)/(b) ở mục 1.3.
