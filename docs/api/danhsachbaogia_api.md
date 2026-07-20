# API cho màn "Danh sách báo giá" (`/manager/quotations`, `/admin/quotations`)

> Phạm vi tài liệu này: **chỉ** màn danh sách báo giá (bảng chính + 5 thẻ KPI + bộ lọc/tìm kiếm/phân
> trang) theo ảnh mẫu người dùng cung cấp. **Không** bao gồm trang chi tiết báo giá (`[id]/page.tsx`),
> modal "Tạo báo giá mới" (`CreateQuotationWizardModal`), hay luồng Khảo sát (`/manager/survey`) — các
> phần đó cần tài liệu riêng.
>
> Nguồn tham chiếu:
> - FE: `src/app/manager/quotations/page.tsx` (mirror 1:1 với `src/app/admin/quotations/page.tsx`),
>   `src/mocks/db/quotations.ts`, `src/types/quotation.ts`, `src/services/quotation.service.ts`.
> - DB thật: đối chiếu trực tiếp qua MySQL MCP ngày 2026-07-20 — `SHOW CREATE TABLE quotations`,
>   `quotation_items`, `orders`, `survey_reports`, `customers`, `items`; dữ liệu mẫu hiện có (**chỉ 1
>   dòng thật** trong `quotations`, mã `QUO-001`, status `APPROVED` — không đủ để suy luận phân bố dữ
>   liệu, chỉ dùng để xác nhận đúng schema).
> - Quy ước envelope/phân trang lấy theo [`docs/khach_hang_api.md`](khach_hang_api.md) mục 2.1 (đã áp
>   dụng cho màn Khách hàng) để đồng nhất toàn site.
>
> **Chưa chốt với Product/Backend** — khác với `docs/taokhachhang_api.md`/`docs/khach_hang_api.md` (đã
> có buổi chốt riêng), tài liệu này viết trực tiếp từ đối chiếu FE + DB, có **1 vấn đề kiến trúc lớn**
> (mục 3) cần Product/Backend xác nhận trước khi code — không tự suy diễn thêm.

## 0. Base URL & Auth

- Base path đề xuất: `/api/v1/quotations` (REST, JWT Bearer token theo `AuthContext` hiện có ở FE).
- Endpoint danh sách dùng cho cả `/admin/quotations` (Admin, chỉ xem/audit) và `/manager/quotations`
  (Manager, vận hành) — 2 trang dùng chung 1 component/mock, khác nhau ở chrome (sidebar/header) và ở
  quyền thao tác (Admin không tạo/sửa báo giá — xem CLAUDE.md mục "Vai trò & phân quyền").

## 1. Vấn đề kiến trúc quan trọng nhất — endpoint danh sách hiện KHÔNG tồn tại

`src/services/quotation.service.ts` hiện tại **chỉ có** `GET /api/v1/customers/{customerId}/quotations`
(danh sách báo giá **của 1 khách hàng cụ thể**) — không có endpoint nào liệt kê báo giá **xuyên suốt
mọi khách hàng** kèm tìm kiếm/lọc trạng thái/phân trang/KPI tổng hợp như màn hình này cần. Đây là
endpoint **mới hoàn toàn**, không phải chỉnh sửa cái có sẵn.

Đề xuất: `GET /api/v1/quotations` (không có `:customerId` trong path) — xem chi tiết mục 2.1.

## 2. Bảng ánh xạ dữ liệu FE ↔ cột DB thật

| Trường FE (`AdminQuotationRow`) | Cột DB (`quotations`) | Ghi chú |
|---|---|---|
| `quotationId` | `quotation_id` (PK, UUID) | Dùng làm route param cho link "Xem chi tiết" (`/manager/quotations/:quotationId`) — khớp `GET /api/v1/quotations/{id}` đã có sẵn trong `quotation.service.ts`. |
| `code` | `quotation_code` (UNIQUE) | Khớp trực tiếp, định dạng thật hiện có: `QUO-001` (không phải `BG001` như mock — xem mục 3.3). |
| `customerId` | `customer_id` (FK → `customers`) | Có trong DB, FE đã có field này (Task 15) nhưng **không hiển thị** ở bảng, chỉ dùng nội bộ. |
| `customerName`, `customerPhone` | JOIN `customers.customer_name`, `customers.phone` | `quotations` không tự chứa tên/SĐT khách — backend phải JOIN. |
| `version` | `version` (varchar 30, vd `"v1"`, `"v1.0"`) | **Khác kiểu dữ liệu với mock**: mock dùng `number` (1, 2, 3) và tự thêm tiền tố `v` khi hiển thị (`v{row.version}`); DB lưu **chuỗi tự do**, không auto-increment, không ràng buộc định dạng. FE cần đổi `version` sang `string` và hiển thị nguyên văn (bỏ `v{...}`, vì DB đã có thể chứa sẵn `v1`/`v1.0`/bất kỳ chuỗi nào backend cho phép nhập). |
| `subtotal` | `subtotal` (decimal 14,2) | Khớp. |
| `discount` | `discount_total` (decimal 14,2) | Khớp. |
| `totalAmount` | `total_amount` (decimal 14,2) | Khớp — không cần FE tự tính `subtotal - discount`, backend đã lưu sẵn `total_amount`. |
| `status` | `status` (`ENUM('DRAFT','APPROVED','REJECTED')`) | **Lệch quan trọng — xem mục 3.1**: DB chỉ có 3 giá trị, FE có thêm `'surveying'` ("Đang khảo sát") không tồn tại trong enum thật. |
| `createdAt` | `created_at` | Khớp. |
| — | `updated_at`, `notes`, `created_by` (FK `users`) | DB có nhưng màn danh sách hiện KHÔNG hiển thị cột nào trong số này — không cần trả trong response list (giữ payload gọn), chỉ cần ở trang chi tiết. |
| `servicePackage`, `guestCount`, `tablePrice`, `assignee`, `validUntil`, `items[]` | *(không có trong `quotations`)* | **Không hiển thị ở màn danh sách này** (chỉ dùng ở trang chi tiết/modal tạo mới, ngoài phạm vi tài liệu này) — xem mục 3.2 về nguồn dữ liệu thật của các trường này nếu cần viết tiếp doc cho trang chi tiết. |

## 3. Các điểm cần Product/Backend xác nhận trước khi code

### 3.1. Trạng thái "Đang khảo sát" (`surveying`) — không có chỗ đứng trong schema hiện tại

Bộ lọc trạng thái trên UI có 4 giá trị: **Đang khảo sát / Bản nháp / Đã duyệt / Từ chối**. Nhưng:

- `quotations.status` thật chỉ có 3 giá trị: `DRAFT`, `APPROVED`, `REJECTED` — **không có `SURVEYING`**.
- Đối chiếu với luồng nghiệp vụ ở CLAUDE.md (`Request → Survey → ... → Quotation cuối`) và schema thật:
  khảo sát (`survey_reports`) gắn với **`order_id`** (bảng `orders`), không gắn với `quotation_id`.
  Bản thân `quotations` **không có cột `order_id`** — chiều liên kết ngược lại: `orders.quotation_id`
  (nullable) trỏ tới 1 quotation *sau khi* báo giá đã có. Nói cách khác: **khảo sát diễn ra trước khi
  báo giá tồn tại**, nên về mặt dữ liệu, một báo giá "đang khảo sát" thực ra là **chưa có bản ghi
  `quotations` nào cả** — nó là một Order đang ở giai đoạn khảo sát, chưa tới bước tạo báo giá.
- Dự án cũng đã có màn hình Khảo sát riêng (`/manager/survey`, `src/app/manager/survey/page.tsx`) —
  khớp với việc khảo sát là một module/thực thể độc lập, không phải 1 trạng thái con của Quotation.

**Đề xuất (cần Product xác nhận, chọn 1 hướng):**

- **Hướng A (khuyến nghị)**: bỏ hẳn "Đang khảo sát" khỏi bộ lọc trạng thái và khỏi 5 thẻ KPI của màn
  Danh sách báo giá — màn này chỉ nên hiển thị báo giá **đã thực sự được tạo** (`DRAFT`/`APPROVED`/
  `REJECTED`). Các yêu cầu đang ở giai đoạn khảo sát (chưa có báo giá) nên hiển thị ở màn `/manager/survey`
  (hoặc màn "Yêu cầu"/"Đơn hàng mới" nếu có) thay vì lẫn vào đây.
- **Hướng B**: nếu Product muốn giữ nguyên UI hiện tại (gộp chung khảo sát + báo giá trong 1 bảng), cần
  backend đổi thiết kế: hoặc (b1) thêm `SURVEYING` vào enum `quotations.status` và tạo 1 bản ghi
  `quotations` "rỗng"/placeholder ngay khi bắt đầu khảo sát (lệch với ý nghĩa hiện tại của bảng
  `quotations` là "báo giá đã có hạng mục/giá"), hoặc (b2) API danh sách này trả về **UNION** giữa
  `orders` đang khảo sát (chưa có `quotation_id`) và `quotations` thật — phức tạp hơn nhiều và làm mờ
  ranh giới 2 entity.

Tài liệu này giả định **Hướng A** khi viết endpoint ở mục 4 (bỏ `surveying` khỏi enum status query
param và khỏi response) — nhưng đây là quyết định cần chốt trước, chưa phải mặc định.

### 3.2. `guestCount`/`tablePrice`/`servicePackage`/`assignee`/`validUntil` không thuộc về Quotation

Các trường này **không xuất hiện ở màn danh sách** (đã kiểm tra lại ảnh mẫu — bảng chỉ có 9 cột như mục
2), nhưng ghi chú lại ở đây vì cùng nguồn mock `quotations.ts` và sẽ cần khi viết doc cho trang chi
tiết/modal tạo mới: `guest_count` thật ra thuộc bảng `orders`, không thuộc `quotations`; `assignee`
(người phụ trách khảo sát) thuộc `survey_reports.reported_by`/`confirmed_by`; `servicePackage`/
`validUntil`/`tablePrice` không có cột tương ứng ở bất kỳ bảng nào hiện có — cần Product xác nhận có
thật sự cần lưu hay chỉ là dữ liệu trình bày tự tính từ `quotation_items`.

### 3.3. Định dạng mã báo giá

Mock hiển thị `BG001`, `BG002`... (`nextAdminQuotationCode()`, prefix `BG` + zero-pad 3 số). DB thật
hiện có 1 dòng duy nhất mã `QUO-001` (prefix `QUO-`, không rõ có zero-pad cố định hay không vì chỉ có 1
mẫu). Giống vấn đề đã nêu ở `docs/taokhachhang_api.md` mục 3 cho khách hàng — cần Product/Backend xác
nhận `quotation_code` sinh theo format nào, và **không** để FE tự đoán mã tiếp theo dùng làm giá trị
thật khi tạo mới (chỉ dùng cho placeholder hiển thị, nếu cần).

## 4. Endpoint đề xuất

### 4.1. `GET /api/v1/quotations` — Danh sách báo giá (bảng chính + bộ lọc)

**Query params**

| Param | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `search` | string | Không | Tìm theo `quotation_code` hoặc `customers.customer_name` (khớp logic FE hiện tại: `code.includes(term) \|\| customerName.includes(term)`, không phân biệt hoa/thường). |
| `status` | `draft \| approved \| rejected` | Không | Lọc theo trạng thái (lowercase để khớp convention FE, map từ `ENUM('DRAFT','APPROVED','REJECTED')` — xem mục 3.1 về việc bỏ `surveying`). Không truyền = tất cả. |
| `customerId` | string (UUID) | Không | Lọc theo 1 khách hàng cụ thể. **Khuyến nghị dùng `customerId` thay vì `customerName`** — FE mock hiện lọc theo chuỗi tên (`customerFilter` so khớp `row.customerName`), sai nếu 2 khách hàng trùng tên; cần sửa FE sang lọc theo `customerId` khi nối API thật. |
| `page` | number | Không (default 1) | Trang hiện tại. |
| `limit` | number | Không (default 10) | Số dòng/trang — FE đang cố định 10. |

**Response 200**

```json
{
  "data": [
    {
      "quotationId": "7ccd5226-ed69-4ae3-ae16-06e5b4184843",
      "code": "QUO-001",
      "customerId": "4c700a21-5440-41f7-b66e-acedd12a0e76",
      "customerName": "Nguyễn Minh Trí",
      "customerPhone": "0910000000",
      "version": "v1",
      "subtotal": 1600000,
      "discount": 0,
      "totalAmount": 1600000,
      "status": "approved",
      "createdAt": "2026-07-19T09:47:37.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "totalItems": 124,
    "totalPages": 13,
    "counts": {
      "all": 124,
      "draft": 32,
      "approved": 58,
      "rejected": 14,
      "approvedValue": 13617613000
    }
  }
}
```

- `meta.counts` **không bị ảnh hưởng bởi `search`/`status`/`customerId` đang lọc** — dùng đúng cho 5 thẻ
  KPI ở đầu trang (Tổng báo giá / Dự thảo nháp / Đã phê duyệt / Bị từ chối / Giá trị đã phê duyệt), vốn
  luôn hiển thị số liệu toàn bộ tập dữ liệu bất kể bộ lọc bảng bên dưới đang áp dụng gì (đúng theo hành
  vi FE hiện tại — `kpiItems` tính từ `rows` gốc, không phải `filteredRows`). Theo đúng convention đã
  dùng ở `docs/khach_hang_api.md` mục 2.1 (`meta.counts`).
- `counts.approvedValue` = `SUM(total_amount) WHERE status = 'APPROVED'` — tính ở backend, không phải
  FE tự cộng dồn từ danh sách đã phân trang (list chỉ trả 10 dòng/trang, không đủ để FE tự tính tổng).
- `status` trả lowercase (`draft`/`approved`/`rejected`), map từ `ENUM('DRAFT','APPROVED','REJECTED')`
  — cùng convention đã chốt cho `customers.status` ở `docs/khach_hang_api.md`.

**Permission**: Manager (đọc), Admin (đọc — audit, khớp CLAUDE.md "Admin... xem & audit toàn bộ dữ liệu
sau vận hành").

---

### 4.2. Bộ lọc "Tất cả khách hàng" — không đề xuất endpoint riêng

FE mock hiện tự suy ra danh sách khách hàng cho dropdown lọc bằng cách gom `customerName` duy nhất từ
toàn bộ 124 báo giá đang có ở client (`Array.from(new Set(rows.map(r => r.customerName)))`). Cách này
không scale khi dữ liệu thật lớn (phải tải hết mọi báo giá về client chỉ để liệt kê tên khách) và sai
nếu trùng tên (mục 4.1). Khuyến nghị: đổi dropdown này thành **ô tìm kiếm khách hàng** (autocomplete) gọi
lại `GET /api/v1/customers?search=...` đã có sẵn ở `docs/khach_hang_api.md` mục 2.1, chọn 1 khách hàng cụ
thể → set `customerId` vào query param 4.1 — không cần thêm endpoint mới, nhưng **cần sửa lại UI** filter
(đổi từ `<select>` liệt kê hết sang combobox tìm kiếm) khi nối API thật.

## 5. Tổng hợp việc cần sửa ở FE khi nối API thật

- Đổi `services/quotation.service.ts`: thêm hàm gọi `GET /api/v1/quotations` (mục 4.1) — hàm hiện có
  (`getCustomerQuotations`) chỉ phục vụ danh sách báo giá trong trang chi tiết khách hàng, không phải
  màn này.
- Đổi kiểu `version` trong `AdminQuotationRow`/`Quotation` từ `number` sang `string`, bỏ tiền tố `v`
  thủ công khi hiển thị (mục 2).
- Bỏ trạng thái `surveying` khỏi `AdminQuotationStatus`/`QUOTATION_STATUS_META` và khỏi bộ lọc trạng
  thái trên UI (chờ chốt Hướng A/B ở mục 3.1 trước khi sửa).
- Đổi bộ lọc khách hàng từ liệt kê `customerName` sang combobox tìm kiếm theo `customerId` (mục 4.2).
- Gỡ dòng chữ in nghiêng "Đang hiển thị dữ liệu minh họa..." (`page.tsx` dòng 145) sau khi nối API thật,
  theo đúng rule "gỡ in nghiêng ngay khi đã nối API xong" ở CLAUDE.md mục 4.
