# API cho màn "Khảo sát hiện trường" (danh sách + chi tiết + tạo báo cáo)

> Phạm vi tài liệu này: màn hình **danh sách báo cáo khảo sát hiện trường** — 4 thẻ KPI (Tổng số báo
> cáo/Chờ xác nhận/Đã xác nhận/Bản nháp-khác), thanh tìm kiếm + tab lọc trạng thái, bảng danh sách (mã
> báo cáo, mã đơn đặt, khách hàng/sự kiện, ngày khảo sát, địa điểm, người phụ trách, trạng thái, nút
> "Xem chi tiết") — cùng 2 drawer trượt từ phải gắn liền: **chi tiết báo cáo** (`SurveyDetailDrawer`,
> đúng như ảnh mẫu: thông tin đơn đặt, thông tin đo đạc, ghi nhận hiện trường, 2 bảng "Đồ đạc/thiết bị
> đề xuất thuê" + "Danh sách thiết bị báo giá nháp", ảnh minh chứng, nút "Xác nhận báo cáo khảo sát")
> và **tạo báo cáo mới** (`SurveyCreateDrawer` — **đã chốt bỏ khỏi web**, xem mục 0). Trang tồn tại ở 2
> route mirror 1:1 (chỉ khác tiền tố): `/admin/reports/survey` và `/manager/survey`.
>
> **Không** bao gồm: khối "Phân công khảo sát báo giá" ở tab "Tổng quan sự kiện" của trang chi tiết 1
> đơn đặt (đã có tài liệu riêng, xem [`docs/tongquansukien_api.md`](tongquansukien_api.md) mục 5) hay
> khối "Kết quả khảo sát" (`SurveyResultCard`) hiển thị tóm tắt trong cùng trang đó — 2 khối kia đọc
> cùng bảng `survey_reports` nhưng khác UI/luồng, ngoài phạm vi ở đây. Cũng không bao gồm khối "Đối
> chiếu khảo sát thực tế" (`SurveyComparisonPanel`) ở trang chi tiết báo giá — nêu lại ở mục 7 vì cùng
> phụ thuộc field `quoteItems`/`quotationId` đang phân tích ở đây, nhưng bản thân panel đó ngoài phạm vi.
>
> Nguồn tham chiếu:
>
> - FE: `src/app/admin/reports/survey/page.tsx` + `src/app/manager/survey/page.tsx` (2 bản mirror,
>   layout/state giống hệt nhau), `src/components/survey-reports/{SurveyDetailDrawer,SurveyCreateDrawer}.tsx`,
>   `src/mocks/db/surveyReports.ts` (toàn bộ — model mock `AdminSurveyReport`/`SurveyMeasurement`/
>   `SurveyRentalItem`/`SurveyQuoteItem`, **không dùng làm căn cứ nghiệp vụ thật**, chỉ để biết UI đang
>   hiển thị field gì), `src/mocks/db/schedulePlans.ts` (`getSurveyScheduledTargets`, dòng 367-380),
>   `src/mocks/db/employees.ts` (`SURVEY_ASSIGNEE_OPTIONS`), `src/types/survey.ts` (model **thật**,
>   comment đầu file đã ghi rõ "docs/api/10-survey-assignment.md ĐÃ LỖI THỜI... nguồn thật:
>   `prisma/schema.prisma` model SurveyReport, `operations.route.ts`"), `src/services/survey.service.ts`,
>   `src/types/schedulePlan.ts`/`workTask.ts`/`evidence.ts`, `src/services/{schedulePlan,workTask,evidence,user}.service.ts`,
>   `src/components/orders/SurveyResultCard.tsx` (đối chiếu nhanh, xác nhận model thật đang được dùng ở
>   nơi khác trong repo).
> - DB thật: đối chiếu trực tiếp qua MySQL MCP ngày 2026-07-20 — `SHOW CREATE TABLE survey_reports/
>   orders/customers/evidences/schedule_plans/work_tasks/quotations/users`; dữ liệu mẫu thật: **1 dòng**
>   `survey_reports` duy nhất trong DB (`SUR-001`, `order_id` → `ORD-001` "Tech Summit 2026",
>   `status = CONFIRMED`, `plan_id = NULL`, phần lớn cột đo đạc/mô tả đều `NULL` — chưa có dữ liệu mẫu
>   thật nào minh họa đầy đủ các field).
> - `docs/api/` **không tồn tại trong repo hiện tại** — dùng comment đầu `types/survey.ts` (đối chiếu
>   trực tiếp `prisma/schema.prisma` của backend) làm căn cứ chính, giống các tài liệu trước
>   (`docs/lichtrinhkythuat_api.md`, `docs/tongquansukien_api.md`...).
> - **Cập nhật 2026-07-20**: toàn bộ điểm còn để mở ở bản nháp đầu tiên của tài liệu này đã được chốt
>   hướng (mục 0, 2, 3) — nội dung dưới đây phản ánh đúng hướng đã chốt, không còn liệt kê dạng "cần
>   Backend/Product xác nhận" cho các điểm đó nữa.

## 0. Ranh giới vai trò — đã chốt: bỏ nút "Tạo báo cáo khảo sát" khỏi web

**Nút "+ Tạo báo cáo khảo sát" (và `SurveyCreateDrawer`) mâu thuẫn với ranh giới vai trò đã ghi ở
CLAUDE.md mục 1 và với chính thiết kế bảng `survey_reports` thật — đã chốt bỏ khỏi cả 2 trang web.**

CLAUDE.md mục 1 liệt kê "khảo sát" nằm trong nhóm **"phần lớn dữ liệu hiện trường... do Leader Staff
(mobile) ghi nhận trước, Manager chỉ xác nhận (confirm) trên web"** — cùng nhóm với biên bản bàn giao,
hỏng/mất, settlement. Điều này khớp chính xác với thiết kế bảng thật:

- `survey_reports.reported_by` (`NOT NULL`) — người **thực hiện khảo sát tại hiện trường**, submit số
  đo đạc/ảnh/đề xuất thiết bị. Theo đúng vòng đời Order (CLAUDE.md mục 1), đây là việc của **Leader
  Staff qua mobile** (ngoài phạm vi repo web).
- `survey_reports.confirmed_by`/`confirmed_at` — Manager **xác nhận lại** sau khi đã có báo cáo, đúng 1
  hành động ghi duy nhất Manager cần làm trên web (mục 4 dưới).

2 cột tách biệt `reported_by` ≠ `confirmed_by` chứng minh model được thiết kế cho luồng "người hiện
trường nộp báo cáo trước → Manager xác nhận sau", **không phải** "Manager tự nhập số liệu khảo sát rồi
tự xác nhận chính báo cáo mình vừa tạo" như `SurveyCreateDrawer` cho phép trước đây (tạo xong, trạng
thái vào thẳng `PENDING_CONFIRM`, rồi cùng Manager đó có thể bấm "Xác nhận" ngay — không có ràng buộc
chặn 1 người vừa report vừa confirm).

**Đã chốt** (nhất quán với hướng đã chốt ở `docs/lichtrinhkythuat_api.md` mục 0, cùng ngày 2026-07-20):
bỏ hẳn nút "+ Tạo báo cáo khảo sát" khỏi cả 2 trang web `/admin/reports/survey` và `/manager/survey`.
`POST /api/v1/survey-reports` (mục 5) **giữ nguyên như đã có sẵn**, chỉ đổi phía gọi sang **mobile
Leader Staff**. Web Manager/Admin từ nay chỉ còn đúng 2 việc trên màn này:

1. **Xem danh sách + xem chi tiết** (mục 1-3) — read-only.
2. **Xác nhận báo cáo** (mục 4) — hành động ghi duy nhất còn lại trên web.

Khi Frontend build lại màn này theo tài liệu, cần gỡ bỏ nút "+ Tạo báo cáo khảo sát" ở header (cả 2
trang) và ngừng import/mount `SurveyCreateDrawer` — bảng mapping payload ở mục 5 vẫn giữ lại trong tài
liệu này để **bàn giao cho mobile team** tham khảo khi họ implement màn tương đương phía Leader Staff.

## 1. Danh sách báo cáo khảo sát — thiếu hẳn endpoint list toàn cục

| Field UI | Nguồn thật | Ghi chú |
|---|---|---|
| Mã báo cáo (`BCKS-2026-0001`) | `survey_reports.report_code` | Khớp trực tiếp (mock đặt tiền tố khác `BCKS-` thay vì `SUR-` thật — chỉ là chuỗi tùy ý, không ảnh hưởng logic). |
| Mã đơn đặt | `survey_reports.order_id` → `orders.order_code` | Cần Backend join `orderCode` vào response (giống các danh sách khác trong repo đã yêu cầu join tương tự). |
| Khách hàng | `orders.customer_id` → `customers.customer_name` | 2 lượt join (`survey_reports → orders → customers`) — cần Backend join sẵn `customerName`, không bắt FE gọi round-trip 2 lần cho mỗi dòng. |
| Sự kiện | `orders.event_name` | Khớp trực tiếp (đã có cột, chỉ cần join qua `orderId`). |
| Ngày khảo sát | `survey_reports.survey_date` | Khớp trực tiếp. |
| Địa điểm | `survey_reports.location` | Khớp trực tiếp (cột `text`, đã tồn tại thật, khác nhiều field khác trong bảng này còn thiếu). |
| Người phụ trách | `survey_reports.reported_by` | **Không tự có tên** — comment đầu `types/survey.ts` đã ghi rõ "`GET /survey-reports/:id` có include evidence nhưng KHÔNG join reporter/confirmer". Cần Backend join `reportedByName` (và `confirmedByName` cho chi tiết) — xem mục 7. |
| Trạng thái | `survey_reports.status` | Enum thật lệch hẳn so với mock — xem mục 2. |

**Vấn đề lớn nhất**: `survey.service.ts` hiện **chỉ có** `getOrderSurveyReports(orderId)` — bắt buộc
truyền `orderId`, tức là chỉ đọc được báo cáo khảo sát của **1 đơn cụ thể**. Màn hình này cần liệt kê
**toàn bộ báo cáo khảo sát của mọi đơn hàng** (kèm search theo mã báo cáo/mã đơn/khách hàng/địa điểm,
lọc theo trạng thái, phân trang) — chưa có endpoint nào phục vụ được nhu cầu này.

**Đã chốt cần Backend bổ sung** `GET /api/v1/survey-reports` (danh sách toàn cục, không bắt buộc
`orderId`), tối thiểu hỗ trợ query:

| Param | Dùng cho |
|---|---|
| `search` | Khớp mã báo cáo/mã đơn/tên khách hàng/địa điểm (thanh tìm kiếm) |
| `status` | Lọc theo tab trạng thái (mục 2) |
| `page`, `limit` | Phân trang (bảng đang dùng `Pagination` component, `limit = 10`) |

Response mỗi dòng cần đủ field đã liệt kê ở bảng trên (join sẵn `orderCode`, `customerName`, `eventName`,
`reportedByName`) — tránh N+1 round-trip cho từng dòng khi Frontend render bảng.

## 2. Trạng thái (`status`) — đã chốt ánh xạ đúng enum thật

Mock `SurveyReportStatus = 'DRAFT' | 'PENDING_CONFIRM' | 'CONFIRMED'` (3 giá trị, dùng cho cả 4 thẻ KPI
và tab lọc). DB thật: `survey_reports.status ENUM('DRAFT','NEEDS_REVIEW','SUBMITTED','CONFIRMED')` (4
giá trị, khớp đúng `SurveyStatus` đã khai ở `types/survey.ts`).

**Đã chốt** (xác nhận nghiệp vụ trực tiếp): `PENDING_CONFIRM` (mock, "Chờ xác nhận") ánh xạ **đúng**
thành `NEEDS_REVIEW` (thật) — **không phải** `SUBMITTED` như suy đoán ban đầu ở bản nháp trước của tài
liệu này. `NEEDS_REVIEW` là trạng thái khi khảo sát viên (Leader Staff) **đã nộp báo cáo và cần Manager
xem/xử lý** — đúng đúng khái niệm "chờ xác nhận" hiện có trên UI. Cần đổi toàn bộ tham chiếu
`PENDING_CONFIRM` (tab lọc, thẻ KPI "Chờ xác nhận", điều kiện hiện nút "Xác nhận báo cáo khảo sát" ở
`SurveyDetailDrawer` dòng 224 và mục 4) thành `NEEDS_REVIEW`.

Giá trị `SUBMITTED` còn lại trong enum thật **chưa có vai trò rõ ràng riêng ở màn hình này** — khả năng
là bước trung gian ngắn (báo cáo vừa nộp, hệ thống lập tức chuyển sang `NEEDS_REVIEW` để vào hàng đợi
Manager) hoặc phục vụ 1 luồng khác chưa xuất hiện trên UI hiện tại. Không chặn việc build UI: tab "Chờ
xác nhận" lọc đúng `status = NEEDS_REVIEW`; nếu thực tế có báo cáo ở trạng thái `SUBMITTED`, tạm gộp
hiển thị chung nhóm "Chờ xác nhận" (cùng màu badge) cho tới khi Backend làm rõ thêm sự khác biệt giữa 2
giá trị này (không cần chặn tiến độ chờ câu trả lời).

Bảng màu badge viết lại theo đúng 4 giá trị: `DRAFT` = xám (Nháp), `NEEDS_REVIEW` = vàng/cam (Chờ xác
nhận, thay `PENDING_CONFIRM`), `CONFIRMED` = xanh lá (Đã xác nhận), `SUBMITTED` = tạm dùng chung màu
vàng/cam với `NEEDS_REVIEW` (theo hướng gộp ở trên) cho tới khi có làm rõ nghiệp vụ riêng.

4 thẻ KPI đầu trang đếm lại theo đúng giá trị thật: "Chờ xác nhận" đếm `NEEDS_REVIEW` (gộp cả
`SUBMITTED` nếu phát sinh), "Đã xác nhận" đếm `CONFIRMED`, "Bản nháp/Khác" đếm `DRAFT`.

## 3. Chi tiết báo cáo (`SurveyDetailDrawer`) — nhiều field không có cột thật tương ứng

**Đã chốt hướng xử lý chung cho cả mục 3**: field/khối nào lấy được từ `survey_reports` thật thì lấy
đúng qua `services/*.service.ts` như bình thường; field/khối nào không có cột/bảng tương ứng thì tiếp
tục hiển thị dữ liệu mock hợp lý nhưng bọc **in nghiêng** (`italic`) để phân biệt rõ với dữ liệu thật,
đồng thời liệt kê vào [`docs/more-require.md`](more-require.md) (xem mục 3.6 — file này **hiện chưa tồn
tại trong repo**, cần tạo/khôi phục trước khi nối tiếp thêm mục mới) để Backend biết cần bổ sung gì —
không chặn tiến độ dựng UI chờ Backend đổi schema trước. Đây là áp dụng lại đúng nguyên tắc đã ghi ở
CLAUDE.md mục 4 (bullet cuối), cho riêng màn này theo yêu cầu cụ thể, dù mục 0 CLAUDE.md đang tạm ngưng
áp dụng mặc định ở giai đoạn UI-first.

### 3.1 Khối "Thông tin đo đạc" — chỉ khớp 3/4 field, đã chốt cách xử lý 1 field còn lại

Mock hiển thị 4 dòng đo đạc tự do (key-value): diện tích sân khấu (dạng chuỗi "8m x 4m x 0.6m"), chiều
cao trần, công suất điện, lối vận chuyển. DB thật chỉ có 3 cột số + 1 cột text:

| Field UI (mock) | Cột DB gần nhất | Khớp? |
|---|---|---|
| Diện tích sân khấu chính (dạng "RxSxC") | `area`/`length`/`width` (3 cột `decimal(10,2)` riêng biệt) | **Không khớp form hiển thị** — DB lưu 3 số tách rời (diện tích, dài, rộng), không có "chiều cao" trong bộ 3 này; UI cần đổi cách hiển thị thành 3 ô riêng (Diện tích/Dài/Rộng) thay vì 1 chuỗi gộp. |
| Chiều cao trần (Clearance) | **Không có cột** | Gap thật — không có nơi nào lưu chiều cao trần/tĩnh không trong `survey_reports`. |
| Công suất nguồn điện khả dụng | **Không có cột** | Gap thật — không có cột điện năng. |
| Lối vận chuyển đồ | `entrance` (text) | Khớp gần đúng về ngữ nghĩa ("lối vào") — dùng được nhưng tên cột nghiêng về "lối ra vào" nói chung hơn là riêng "lối vận chuyển thiết bị". |

**Đã chốt**: dùng đúng 3 field có thật (`area`/`length`/`width` hiển thị tách 3 ô riêng, `entrance` cho
"Lối vận chuyển đồ"); 2 field không có cột (chiều cao trần, công suất điện) tiếp tục hiển thị **in
nghiêng** bằng dữ liệu mock hợp lý — ghi yêu cầu bổ sung 2 cột này vào `docs/more-require.md` (mục 3.6).

### 3.2 Khối "Ghi nhận hiện trường" — đã chốt dùng `site_constraints` làm "Mô tả tổng quan"

Mock `content` (mô tả tổng quan hiện trạng mặt bằng) hiển thị nổi bật nhất khối này — DB thật **không
có cột generic "description/content"**. Cột gần nghĩa nhất là `site_constraints` ("ràng buộc mặt bằng").

**Đã chốt** (áp dụng đúng nguyên tắc "chỉ lấy dữ liệu đủ" ở đầu mục 3): dùng `site_constraints` làm "Mô
tả tổng quan" luôn, đổi nhãn hiển thị nếu cần cho khớp đúng ngữ nghĩa cột thật ("Ràng buộc/hiện trạng
mặt bằng") — **không** yêu cầu Backend thêm cột `description`/`overview` mới, vì đã có dữ liệu thật đủ
dùng (không phải trường hợp thiếu dữ liệu, không cần in nghiêng/ghi `more-require.md`).

`notes` (Lưu ý thi công quan trọng) khớp trực tiếp `survey_reports.notes` — không có vấn đề.

### 3.3 Bảng "Đồ đạc/thiết bị đề xuất thuê" — đã chốt hiển thị dạng văn bản thay vì bảng

Mock `rentalItems: { name, quantity, notes }[]` hiển thị dạng bảng nhiều dòng có SL riêng từng thiết bị.
DB thật chỉ có `proposed_items` — **1 cột `text` duy nhất**, không phải bảng con có cấu trúc. Nghĩa là
Backend hiện lưu đề xuất thiết bị dạng 1 đoạn văn bản tự do (Leader Staff gõ tay khi nộp báo cáo qua
mobile), không tách được tên/số lượng/ghi chú riêng lẻ để hiển thị dạng bảng như ảnh mẫu.

**Đã chốt**: giữ nguyên `proposed_items` dạng text **thật** (không phải mock — cột này đã tồn tại thật,
chỉ khác hình dạng dữ liệu so với ảnh mẫu, không phải trường hợp thiếu dữ liệu), đổi UI khối "Đồ đạc/
thiết bị đề xuất thuê" từ bảng nhiều dòng thành **1 đoạn văn bản** hiển thị nguyên trạng nội dung
`proposedItems`. Không cần bảng con mới, không cần in nghiêng, không cần ghi vào `docs/more-require.md`
cho khối này.

### 3.4 Bảng "Danh sách thiết bị báo giá nháp" (`quoteItems`) — hoàn toàn không có trong DB

Đây là **gap lớn nhất** của khối chi tiết: `quoteItems: { name, quantity, unit, price, category }[]` —
kèm tổng giá trị nháp — **không có bất kỳ cột hay bảng nào** trong `survey_reports` hay bảng liên quan
lưu được dữ liệu này. Đối chiếu với khối "Đối chiếu khảo sát thực tế & đề xuất báo giá"
(`SurveyComparisonPanel`, dùng ở trang chi tiết báo giá — ngoài phạm vi tài liệu này) cũng phụ thuộc
trực tiếp `report.quoteItems` — nghĩa là gap này ảnh hưởng cả 2 màn hình.

**Đã chốt** (áp dụng nguyên tắc "chỉ lấy dữ liệu đủ" — khối này là trường hợp duy nhất trong mục 3
**không có bất kỳ phần nào** lấy được từ API thật, khác 3.1/3.3 chỉ thiếu 1 phần): tiếp tục hiển thị
toàn bộ khối bằng dữ liệu mock **in nghiêng**, ghi yêu cầu vào `docs/more-require.md` (mục 3.6) để
Backend/Product làm rõ đây có phải nghiệp vụ thật (khảo sát viên tự đề xuất giá nháp tại hiện trường)
cần bảng lưu riêng hay không, hay chỉ là dữ liệu trang trí nên bỏ hẳn về sau.

### 3.5 Ảnh minh chứng — đã chốt: chỉ lấy đúng 1 ảnh thật, phần dư là mock có chú thích

Mock `images: string[]` hiển thị lưới nhiều ảnh (2 ảnh/báo cáo trong dữ liệu mẫu, bấm phóng to từng
ảnh). DB thật `survey_reports.evidence_id` là **cột đơn** (FK 1-1 tới `evidences.evidence_id`), và bản
thân bảng `evidences` cũng chỉ lưu **1 `file_url`/dòng** — không có bảng đính kèm nhiều file
(`evidence_attachments (entity_type, entity_id)` polymorphic như mô tả ở CLAUDE.md mục "Pattern dữ liệu
cần tái sử dụng" **không tồn tại trong DB thật hiện tại** — đã xác nhận qua `SHOW TABLES LIKE
'%evidence%'` chỉ trả về đúng 1 bảng `evidences` dạng phẳng). Đây là **giới hạn giống hệt** đã ghi ở
`docs/lichtrinhkythuat_api.md` mục 7 cho `schedule_plans.evidence_id`.

**Đã chốt**: chỉ lấy đúng **1 ảnh thật** qua `GET /api/v1/evidence/:id` (dùng `evidence_id` của báo
cáo). Nếu muốn giữ đúng lưới nhiều ảnh như ảnh mẫu trong lúc chờ Backend, các ảnh vượt quá 1 ảnh thật là
dữ liệu mock — vì ảnh không "in nghiêng" theo nghĩa đen được, hiển thị kèm 1 dòng chú thích nhỏ dạng
"(ảnh minh họa — dữ liệu mẫu)" bên dưới các ảnh mock đó để phân biệt với ảnh thật. Ghi yêu cầu hỗ trợ đa
ảnh minh chứng cho khảo sát vào `docs/more-require.md` (mục 3.6).

### 3.6 Tổng hợp mục cần ghi vào `docs/more-require.md`

Theo hướng đã chốt ở các mục 3.1/3.4/3.5, các mục sau cần được ghi nhận vào `docs/more-require.md`
(nối tiếp format `(a)(b)(c)...` đã quy ước ở CLAUDE.md mục 4) để Backend biết cần làm gì:

1. Bổ sung 2 cột nullable mới cho `survey_reports`: chiều cao trần (Clearance) và công suất nguồn điện
   khả dụng — hiện không có cột nào lưu 2 giá trị đo đạc này (mục 3.1).
2. Làm rõ nghiệp vụ "thiết bị báo giá nháp" (`quoteItems`) khảo sát viên đề xuất tại hiện trường — nếu
   là nghiệp vụ thật, cần bảng con mới lưu danh sách (tên/SL/đơn vị/đơn giá/nhóm); ảnh hưởng cả màn này
   lẫn khối "Đối chiếu khảo sát thực tế" ở trang chi tiết báo giá (mục 3.4).
3. Hỗ trợ đa ảnh minh chứng cho 1 báo cáo khảo sát — hiện `survey_reports.evidence_id` chỉ lưu được 1
   ảnh; 1 buổi khảo sát hiện trường thường cần chụp nhiều góc (mục 3.5).

**Lưu ý quan trọng**: `docs/more-require.md` được nhiều file khác trong repo tham chiếu tới (vd
`CLAUDE.md` mục "Enum `OrderStatus`" trỏ tới "mục (h)") nhưng **file này hiện không tồn tại** trong
checkout hiện tại của repo (`docs/more-require.md` không có trên đĩa dù được tham chiếu ở 20+ nơi khác).
Cần tạo/khôi phục file này (có thể đã bị xóa nhầm hoặc chưa từng được commit) trước khi có thể nối tiếp
đúng 3 mục trên theo đúng format `(a)(b)(c)...` đã quy ước — nêu vấn đề này ở đây để người phụ trách tài
liệu biết xử lý trước, tài liệu này không tự tạo lại nội dung các mục `(a)` đến `(g)` đã được các file
khác tham chiếu vì không có căn cứ để suy luận đúng nội dung gốc.

## 4. Xác nhận báo cáo khảo sát — đã có sẵn endpoint

| # | Endpoint | Dùng cho | Ghi chú |
|---|---|---|---|
| 1 | `PUT /api/v1/survey-reports/:id/confirm` `{ "status": "CONFIRMED" }` | Nút "Đồng ý phê duyệt" ở modal xác nhận + nút "Xác nhận báo cáo khảo sát" trong `SurveyDetailDrawer` | **Đã có sẵn** (`surveyApiService.confirmSurveyReport`, payload `ConfirmSurveyReportPayload = { status: SurveyStatus }`). Chỉ hiện nút khi `status === 'NEEDS_REVIEW'` (đổi từ `'PENDING_CONFIRM'` theo mục 2 — **không phải** `'SUBMITTED'`). |

Không cần endpoint mới cho hành động này — chỉ cần đổi điều kiện hiện nút theo đúng enum thật.

## 5. Tạo báo cáo khảo sát (`SurveyCreateDrawer`) — chỉ còn giá trị tham khảo cho mobile

Theo quyết định đã chốt ở mục 0, `SurveyCreateDrawer` **bỏ khỏi web**. `POST /api/v1/survey-reports`
**đã có sẵn** (`surveyApiService.createSurveyReport`, `CreateSurveyReportPayload`) và vẫn giữ nguyên —
bảng dưới map field form hiện tại sang payload thật, giữ lại **chỉ để bàn giao cho mobile team** khi họ
implement màn tạo báo cáo phía Leader Staff:

| Field form (`SurveyCreateDrawer`) | Field payload thật | Ghi chú |
|---|---|---|
| Mã đơn đặt & báo giá (`orderId`) | `orderId` | Khớp trực tiếp — nhưng nguồn danh sách chọn cần đổi, xem mục 6. |
| Ngày thực hiện khảo sát (`surveyDate`) | `surveyDate` (ISO datetime) | Khớp, đổi từ `YYYY-MM-DD` sang ISO đầy đủ. |
| Ngày diễn ra sự kiện (`eventDate`) | **Không có trong payload** | `eventDate` là thuộc tính của `orders.event_date`, không lưu lặp lại ở `survey_reports` — bỏ field này khỏi payload gửi lên (chỉ dùng hiển thị tham khảo, đọc từ `orders`). |
| Nhân viên thực hiện khảo sát (`assignee`, chọn tên từ `SURVEY_ASSIGNEE_OPTIONS`) | **Không có trong payload** | `reportedBy` lấy từ **user đang đăng nhập** (JWT), không phải field chọn tay trong form — mock đang cho chọn tự do từ danh sách tên cứng (`FIELD_OPS_STAFF`, không gắn `userId` thật) là sai mô hình. Bỏ hẳn dropdown này — người nộp báo cáo luôn là chính Leader Staff đang đăng nhập trên mobile. |
| Nội dung khảo sát tổng quan (`content`) | `siteConstraints` | Theo hướng đã chốt ở mục 3.2. |
| Lưu ý thi công quan trọng (`notes`) | `notes` | Khớp trực tiếp. |
| 4 ô đo đạc (`measurement1..4`) | `area`/`length`/`width`/`entrance` | Chỉ 3/4 khớp được, xem mục 3.1 — đổi form thành đúng field số (`area`, `length`, `width` dạng number input) + `entrance` (text), bỏ 2 field không có cột (chiều cao trần, công suất điện) khỏi payload cho tới khi Backend bổ sung cột theo mục 3.6. |
| Bảng thiết bị đề xuất thuê (`rentalItems[]`) | `proposedItems` (string) | Theo hướng đã chốt ở mục 3.3: đổi từ bảng nhiều dòng thành 1 textarea tự do, gửi thẳng thành 1 chuỗi `proposedItems`. |
| Bảng thiết bị báo giá nháp (`quoteItems[]`) | **Không có trong payload** | Theo mục 3.4 — bỏ hẳn khối này khỏi payload/form tạo cho tới khi Backend xác nhận có bảng lưu tương ứng hay không. |
| Ảnh minh chứng | `evidenceId` (1 ảnh, upload trước qua `POST /evidence/upload` rồi gắn `evidenceId` vào payload tạo) | Form hiện tại (`SurveyCreateDrawer`) **chưa có** ô upload ảnh nào — cần bổ sung ở bản mobile, chỉ hỗ trợ 1 ảnh do giới hạn cột đơn (mục 3.5). |
| `planId` (không có ở form) | `planId` (optional) | Payload thật hỗ trợ gắn báo cáo vào 1 `schedule_plans` cụ thể (buổi khảo sát đã lên lịch) — form hiện tại bỏ qua field này hoàn toàn. Nên gắn khi tạo từ 1 buổi khảo sát đã có lịch (mục 6) để giữ liên kết kế hoạch ↔ kết quả. |

`report_code` (mã báo cáo, mock tự sinh phía client qua `nextAdminSurveyReportId()`) — payload thật
**không có field này**, để Backend tự sinh (giống cách `order_code`/`plan_code` các domain khác đều do
Backend cấp) — bỏ hẳn hàm sinh mã phía client khi nối API thật.

## 6. Chọn "đơn đặt cần khảo sát" — phụ thuộc quyết định đã chốt ở tài liệu khác

Form hiện lấy danh sách đơn qua `getSurveyScheduledTargets()` (mock) — lọc các `SchedulePlan` có 1
`activity.type === 'Khảo sát'` (khái niệm mock, không phải model thật). Đây **chính là** vấn đề đã phân
tích kỹ ở `docs/tongquansukien_api.md` mục 5 và được chốt hướng (A) ở `docs/lichtrinhkythuat_api.md`
mục 5/10: cần Backend **seed thêm `work_tasks` row "Khảo sát hiện trường"**, sau đó danh sách "đơn cần
khảo sát" suy ra từ `GET /api/v1/schedule-plans` lọc `taskName === 'Khảo sát hiện trường'` và `status`
chưa `COMPLETED` — dùng lại đúng endpoint đã có, **không cần endpoint mới**, chỉ cần:

1. Backend seed dòng `work_tasks` còn thiếu (đã chốt ở 2 tài liệu trước, nhắc lại ở đây vì màn này là
   nơi thứ 3 phụ thuộc cùng 1 việc seed dữ liệu đó).
2. `GetSchedulePlansQuery` (`types/schedulePlan.ts`) hiện **không có filter theo `taskId`/`taskName`** —
   chỉ có `orderId`, `assignedTo`, `status`, `date`. Vì màn này cần lọc **xuyên suốt mọi đơn** (không
   biết trước `orderId`), cần Backend bổ sung filter `taskId` (hoặc `taskName`) vào endpoint đã có, nếu
   không Frontend phải tải toàn bộ `schedule_plans` rồi tự lọc phía client — không khả thi khi dữ liệu
   lớn.

Mục này giữ nguyên giá trị tham khảo dù `SurveyCreateDrawer` đã bỏ khỏi web (mục 0) — logic chọn "đơn
cần khảo sát" vẫn cần thiết cho màn tương đương phía mobile Leader Staff.

## 7. Tên khảo sát viên/người xác nhận không tự có trong response

Nhắc lại đúng phát hiện đã ghi ở `docs/tongquansukien_api.md` mục 5 điểm 1 và comment đầu `types/survey.ts`:
`GET /survey-reports` (list, mục 1) và `GET /survey-reports/:id` (chi tiết) chỉ trả `reportedBy`/
`confirmedBy` dạng ID thô, không join `full_name`. Màn hình này cần hiển thị tên ở **3 chỗ**: cột "Người
phụ trách" (bảng danh sách), dòng "Khảo sát viên: ..." (chân drawer chi tiết), và ngầm định trong nút
"Xác nhận" (ai vừa confirm). Cần Backend join sẵn `reportedByName`/`confirmedByName` vào cả 2 response
(list + detail) — tránh Frontend phải gọi thêm `GET /users/:id` cho từng dòng.

## 8. Tổng hợp — trạng thái quyết định

| # | Việc | Trạng thái |
|---|---|---|
| 1 | Bỏ nút "+ Tạo báo cáo khảo sát" khỏi web, giữ `POST /survey-reports` cho mobile Leader Staff | **Đã chốt** (mục 0) |
| 2 | Bổ sung `GET /api/v1/survey-reports` (danh sách toàn cục, `search`/`status`/`page`/`limit`, join sẵn `orderCode`/`customerName`/`eventName`/`reportedByName`) | **Đã chốt cần làm** — Backend triển khai (mục 1) |
| 3 | Enum `SurveyReportStatus` phía FE đổi khớp 4 giá trị thật; `PENDING_CONFIRM` (mock) = `NEEDS_REVIEW` (thật) | **Đã chốt** (mục 2) — `SUBMITTED` tạm gộp hiển thị chung nhóm "Chờ xác nhận" tới khi có làm rõ thêm |
| 4 | 2 field đo đạc thiếu (chiều cao trần, công suất điện): hiển thị in nghiêng bằng mock, ghi `docs/more-require.md` | **Đã chốt hướng xử lý UI** — còn vướng: `docs/more-require.md` chưa tồn tại trong repo, cần tạo trước (mục 3.6) |
| 5 | "Mô tả tổng quan" dùng `site_constraints`, không thêm cột mới | **Đã chốt** (mục 3.2) |
| 6 | "Đồ đạc/thiết bị đề xuất thuê" hiển thị dạng văn bản (`proposedItems` thật), không cần bảng con mới | **Đã chốt** (mục 3.3) |
| 7 | "Thiết bị báo giá nháp" (`quoteItems`) — mock in nghiêng toàn khối, ghi `docs/more-require.md`, chờ Backend/Product xác nhận có cần bảng lưu thật hay không | **Đã chốt hướng xử lý UI**, nghiệp vụ gốc còn mở (mục 3.4) |
| 8 | Đa ảnh minh chứng — chỉ 1 ảnh thật, phần dư là mock có chú thích, ghi `docs/more-require.md` | **Đã chốt hướng xử lý UI**, nghiệp vụ gốc còn mở (mục 3.5) |
| 9 | Bổ sung filter `taskId`/`taskName` vào `GET /api/v1/schedule-plans` | **Đã chốt cần làm** — Backend triển khai (mục 6) |
| 10 | Join `reportedByName`/`confirmedByName` vào response list + detail | **Đã chốt cần làm** — Backend triển khai (mục 7) |
| 11 | Seed thêm `work_tasks` row "Khảo sát hiện trường" | **Đã chốt cần làm** — Backend triển khai, nhắc lại từ 2 tài liệu trước (mục 6) |
| 12 | Tạo/khôi phục file `docs/more-require.md` (hiện không tồn tại trong repo dù được 20+ file tham chiếu) | **Còn mở — cần xử lý trước khi ghi tiếp mục (a)(b)(c)...** (mục 3.6) |
