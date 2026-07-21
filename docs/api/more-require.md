# Yêu cầu bổ sung cho Backend

Danh sách các chỗ dữ liệu/endpoint backend hiện chưa đáp ứng đủ nhu cầu UI, phát hiện trong quá trình dựng
giao diện — nối tiếp theo thứ tự (a), (b), (c)... Mỗi mục ghi rõ màn hình liên quan, vấn đề, và đề xuất xử
lý (nếu có).

> **⚠️ Lưu ý quan trọng (2026-07-20)**: các mục (a)-(l) viết trước thời điểm này dựa trên đối chiếu với
> `D:\bnwems-backend-api` — phát hiện ra đây **KHÔNG PHẢI** backend đang thực sự chạy ở `localhost:3001`.
> Backend thật (đã xác nhận qua tiến trình đang chạy + người dùng xác nhận) là **`D:\sep490-backend-api`**
> — kiến trúc module khác hẳn (`src/modules/{identity,sales,operations,inventory}`), route surface nhỏ
> hơn nhiều: chỉ có `/auth`, `/customers`, `/customers/:id/quotations`, `/quotations`, `/orders`,
> `/schedule-plans`, `/work-tasks`, `/survey-reports`, `/events`, `/inventory` — **không có** `/catalog`,
> `/suppliers`, `/policies`, `/evidence`, `/attendance`, `/wages`, `/dashboard`, `/reports` dưới bất kỳ
> hình thức nào. Đã sửa lại 2 mục (d)/(k) sau khi phát hiện (2 endpoint đó thật ra **đã có sẵn**). Các
> mục còn lại **chưa được rà soát lại** — coi là cần xác minh lại qua `curl` trực tiếp backend thật hoặc
> đọc `D:\sep490-backend-api\src\modules\**\*.routes.ts` trước khi tin, đừng dùng làm căn cứ cuối cùng.
> `D:\sep490-backend-api\docs\api\*.md` có sẵn các file **trùng tên** với `docs/*.md` ở repo này (khả
> năng cao là bản đã đồng bộ/chốt với code thật) — nên ưu tiên đối chiếu 2 bộ file này với nhau khi cần
> viết thêm mục mới, thay vì chỉ dựa vào `docs/*.md` ở repo frontend.

## (a) Lập lịch khảo sát hiện trường khi báo giá chưa có Order thật

- **Màn liên quan**: "Kế hoạch và phân công" (`/manager/schedule/plans`, mirror
  `/admin/coordination/planning`) — luồng lập kế hoạch khảo sát sớm mở từ trang chi tiết báo giá
  (`?quotationId=...`), xem chi tiết ở [`docs/kehoachvaphancong_api.md`](kehoachvaphancong_api.md) mục 8.1
  và mục 12.
- **Vấn đề**: `schedule_plans.order_id` là FK `NOT NULL` trỏ thẳng `orders.order_id`, không có cột nào
  tham chiếu tới `quotations.quotation_id`. Trong khi đó vòng đời nghiệp vụ là **Request → Survey →
  Quotation → mới có Order** (CLAUDE.md mục 1) — tại thời điểm cần lên lịch khảo sát hiện trường, báo giá
  còn đang ở trạng thái `DRAFT`/chưa duyệt và **chưa có `order_id` thật**, nên không thể tạo được dòng
  `schedule_plans` nào cho buổi khảo sát đó với schema hiện tại.
- **Đã chốt hướng (A) — đổi schema** (2026-07-20, xem lựa chọn ở
  `docs/kehoachvaphancong_api.md` mục 8.1): thêm cột `schedule_plans.quotation_id` (nullable, FK →
  `quotations.quotation_id`), đồng thời nới `schedule_plans.order_id` thành nullable, ràng buộc **đúng 1
  trong 2 cột (`order_id` hoặc `quotation_id`) có giá trị** ở tầng ứng dụng (CHECK constraint hoặc validate
  ở service layer, vì MySQL không hỗ trợ tốt CHECK phức tạp trên nhiều cột NULL/NOT NULL).
  - Không chọn hướng (B) — tạo `orders` sớm hơn (trước khi có Quotation duyệt) — vì sẽ đảo ngược thứ tự
    Request→Survey→Quotation→Order hiện mô tả ở CLAUDE.md mục 1, ảnh hưởng toàn bộ state machine
    `OrderStatus` (vốn đã có nhiều bất đồng bộ khác cần dọn trước, xem `docs/danhsachdondat_api.md`).
- **Cần Backend làm thêm sau khi đổi schema**:
  1. `POST /api/v1/schedule-plans` nhận `orderId` **hoặc** `quotationId` (hiện chỉ có `orderId` bắt buộc
     trong `CreateSchedulePlanPayload`).
  2. `GET /api/v1/schedule-plans` trả kèm `quotationId` (khi dòng đó chưa gắn Order thật) bên cạnh
     `orderId` hiện có.
  3. Khi báo giá được duyệt và sinh Order thật, cần 1 bước gán lại `order_id` cho các dòng
     `schedule_plans` đã tạo trước đó bằng `quotation_id` (không rõ có endpoint nào xử lý việc "chuyển"
     này chưa — cần Backend xác nhận).
- **Trạng thái**: FE **chưa code** luồng này (kể cả bằng mock) cho tới khi Backend xác nhận đã đổi schema
  xong, tránh phải sửa lại 2 lần khi model đổi.

## (b) Chưa có bảng `inventory` nào trong DB thật — chặn màn "Tồn kho doanh nghiệp" + "Thiết bị đang bảo trì"

- **Màn liên quan**: "Tồn kho doanh nghiệp" (`/manager/inventory/stock-check`, mirror
  `/admin/inventory/stock-status`) + modal chi tiết thiết bị (`EquipmentDetailModal`) + trang "Thiết bị
  đang bảo trì" (`/admin/inventory/maintenance`, đã code sẵn gọi API chờ bảng này) — xem chi tiết ở
  [`docs/tonkhodoanhnghiep_api.md`](tonkhodoanhnghiep_api.md).
- **Vấn đề**: đối chiếu MySQL MCP ngày 2026-07-20, bảng `items` chỉ có dữ liệu catalog (tên/giá/mô
  tả/đơn vị/trạng thái `ACTIVE`/`INACTIVE`/`MAINTENANCE`), **không có bất kỳ cột số lượng tồn kho nào**
  (tổng/khả dụng/hỏng). `src/types/inventory.ts` + `src/services/inventory.service.ts` đã viết sẵn code
  gọi `GET/POST /api/v1/inventory...` chờ 1 model `Inventory`, nhưng bảng đó **chưa hề được tạo** trong
  DB (chỉ 1 migration `init_core` đã chạy). Ngoài ra `items` cũng thiếu 2 trường "Kích thước"/"Chất
  liệu" mà UI cần hiển thị, chưa tồn tại ở bất kỳ đâu (kể cả các trang catalog CRUD thật).
- **Đã chốt hướng (A) — tạo bảng `inventory` mới, quan hệ 1-1 với `items`** (khớp đúng hướng code FE/
  service đã viết sẵn, không có hướng nào khác hợp lý hơn):
  ```sql
  CREATE TABLE inventory (
    inventory_id     VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
    item_id          VARCHAR(36) NOT NULL UNIQUE,
    quantity_total   INT NOT NULL DEFAULT 0,
    quantity_damaged INT NOT NULL DEFAULT 0,
    location         VARCHAR(255) NULL,
    updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT inventory_item_id_fkey FOREIGN KEY (item_id) REFERENCES items(item_id)
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_inventory_damaged_lte_total CHECK (quantity_damaged <= quantity_total)
  );
  ```
  Có chủ đích **không** lưu "đã khóa"/"khả dụng" như cột tĩnh — 2 số này phụ thuộc ngày chọn trên UI
  (Date-based Inventory Lock, UC 2.13), tính trực tiếp bằng query lúc đọc (công thức đã chốt ở
  `docs/tonkhodoanhnghiep_api.md` mục 3 — khóa theo khoảng ngày `schedule_plans` của đơn, không cần
  bảng lock riêng). Seed 1 dòng `inventory` cho mỗi dòng `items` hiện có (hiện chỉ 2 dòng thật), mặc
  định 0 chờ vận hành nhập số liệu thật qua nghiệp vụ nhập/kiểm kê kho.
- **2 cột mới trên `items`**: `dimensions VARCHAR(100) NULL`, `material VARCHAR(255) NULL`.
- **Mở rộng `MovementType`** (`types/inventory.ts`) thêm giá trị `DAMAGE` (bên cạnh `INBOUND`/
  `ADJUSTMENT` hiện có) để phân biệt điều chỉnh vào `quantity_total` hay `quantity_damaged` — xem
  `AdjustInventoryPayload` mở rộng ở `docs/tonkhodoanhnghiep_api.md` mục 5.1.
- **Trạng thái**: FE giữ nguyên mock cho tới khi Backend tạo xong bảng `inventory` + 2 cột trên trên
  `items`. Khi xong, toàn bộ endpoint đã định nghĩa sẵn ở `docs/tonkhodoanhnghiep_api.md` (mục 2/4/5)
  implement được ngay theo đúng mô tả, không cần quay lại đổi tài liệu đó.

## (c) Chưa có bảng `collected_equipment_reports` nào trong DB thật — chặn màn "Thu hồi & hoàn kho"

- **Màn liên quan**: "Thu hồi & hoàn kho" (`/manager/inventory/returns`, mirror
  `/admin/inventory/returns`) — xem chi tiết ở [`docs/thuhoi_hoankho_api.md`](thuhoi_hoankho_api.md).
- **Vấn đề**: FE **đã có sẵn 1 hợp đồng type/service được thiết kế đúng cho nghiệp vụ này**
  (`src/types/collectedEquipmentReport.ts`, `inventoryApiService.createReturnReport`/
  `confirmReturnReport`) nhưng chưa UI nào gọi tới — UI thật đang tự dựng mock riêng
  (`adminInventoryReturnsMock.ts`, shape `ReturnSlip` khác hẳn, item là chuỗi tên tự do thay vì FK
  thật). Đối chiếu MySQL MCP (nhiều lần trong ngày 2026-07-20, xem `docs/thuhoi_hoankho_api.md`): không
  có bảng `collected_equipment_reports`/`collected_equipment_report_items` nào trong 25 bảng thật.
  Ngoài ra bước "Xác nhận hoàn kho" của màn này còn phụ thuộc thêm bảng `inventory` ở mục (b) — 2 lớp
  thiếu bảng chồng nhau.
- **Đã chốt hướng (A) — tạo 2 bảng mới, đi theo đúng shape `CollectedEquipmentReport` đã có sẵn ở FE**
  (không theo `ReturnSlip` mock — mock có nhược điểm item là tên tự do, không FK):
  ```sql
  CREATE TABLE collected_equipment_reports (
    report_id      VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
    report_code    VARCHAR(50) NOT NULL UNIQUE,
    order_id       VARCHAR(36) NOT NULL,
    report_type    ENUM('INTERNAL','SUPPLIER') NOT NULL DEFAULT 'INTERNAL',
    transaction_id VARCHAR(36) NULL,
    status         ENUM('SUBMITTED','CONFIRMED') NOT NULL DEFAULT 'SUBMITTED',
    reported_by    VARCHAR(36) NOT NULL,
    confirmed_by   VARCHAR(36) NULL,
    confirmed_at   TIMESTAMP NULL,
    notes          TEXT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT collected_equipment_reports_order_id_fkey FOREIGN KEY (order_id)
      REFERENCES orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT collected_equipment_reports_reported_by_fkey FOREIGN KEY (reported_by)
      REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT collected_equipment_reports_confirmed_by_fkey FOREIGN KEY (confirmed_by)
      REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT collected_equipment_reports_transaction_id_fkey FOREIGN KEY (transaction_id)
      REFERENCES supplier_transactions(transaction_id) ON DELETE SET NULL ON UPDATE CASCADE
  );

  CREATE TABLE collected_equipment_report_items (
    cer_item_id      VARCHAR(36) PRIMARY KEY DEFAULT (uuid()),
    report_id        VARCHAR(36) NOT NULL,
    item_id          VARCHAR(36) NOT NULL,
    good_quantity    INT NOT NULL DEFAULT 0,
    damaged_quantity INT NOT NULL DEFAULT 0,
    lost_quantity    INT NOT NULL DEFAULT 0,
    notes            TEXT NULL,
    CONSTRAINT cer_items_report_id_fkey FOREIGN KEY (report_id)
      REFERENCES collected_equipment_reports(report_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT cer_items_item_id_fkey FOREIGN KEY (item_id)
      REFERENCES items(item_id) ON DELETE RESTRICT ON UPDATE CASCADE
  );
  ```
  **Chưa xác nhận được** tên cột PK thật của `supplier_transactions` trong phiên viết tài liệu này (MCP
  bị timeout kết nối DB) — Backend cần tự đối chiếu lại trước khi tạo FK `transaction_id`.
- **Không lưu tiền đền bù ở bảng này** — theo comment gốc `types/collectedEquipmentReport.ts`, đền bù
  hỏng/mất xử lý riêng qua `settlements.compensation` (đã có sẵn cột), không gắn per-item ở đây (xem
  `docs/thuhoi_hoankho_api.md` mục 5).
- **Trạng thái**: FE giữ nguyên mock (`adminInventoryReturnsMock.ts`) cho tới khi Backend tạo xong 2
  bảng trên (và bảng `inventory` ở mục (b), cần cho bước xác nhận). Khi xong, FE cần đổi UI sang gọi
  `inventoryApiService.createReturnReport`/`confirmReturnReport` theo đúng shape
  `CollectedEquipmentReport` thay vì tiếp tục dùng mock `ReturnSlip` — xem `docs/thuhoi_hoankho_api.md`
  mục 0/3 cho toàn bộ thay đổi UI cần làm (bỏ modal "Tạo phiếu" trên web, chuyển ghi nhận số liệu sang
  Leader Staff mobile theo đúng CLAUDE.md).
- **⛔ Toàn bộ 4 endpoint đã định nghĩa ở `docs/thuhoi_hoankho_api.md` đều CHƯA CẦN LÀM NGAY** — chỉ là
  hợp đồng chốt sẵn để Backend làm khi rảnh tay, theo đúng thứ tự: (1) tạo bảng `inventory` ở mục (b)
  nếu chưa xong, (2) tạo 2 bảng ở mục này, (3) `GET .../return-reports` (danh sách), (4)
  `GET .../return-reports/:id` (chi tiết), (5) `POST .../return-reports` (tạo phiếu), (6)
  `PUT .../return-reports/:id/confirm` (xác nhận — làm **sau cùng**, vì là endpoint duy nhất đụng tới
  cả 2 bảng mới cùng lúc, xem `docs/thuhoi_hoankho_api.md` mục 4.3/9.2).

## (d) ~~Thiếu `GET /api/v1/quotations`~~ — ĐÃ CÓ SẴN trên backend thật, không cần Backend làm gì thêm (xác nhận 2026-07-20)

- **Màn liên quan**: "Danh sách báo giá" (`/manager/quotations`, `/admin/quotations`) — xem
  [`docs/danhsachbaogia_api.md`](danhsachbaogia_api.md) mục 1/4.1.
- **⚠️ Sửa lại nhận định ban đầu (2026-07-20)**: mục này lúc đầu viết dựa trên `docs/danhsachbaogia_api.md`
  (soạn từ việc đối chiếu `D:\bnwems-backend-api` — backend **KHÔNG PHẢI** backend đang thực sự chạy).
  Backend thật đang chạy trên `:3001` là **`D:\sep490-backend-api`** (xác nhận qua tiến trình đang lắng
  nghe cổng, `quotation.routes.ts` của repo này) — repo này **đã có sẵn** `quotationRouter.get('/', ...)`
  mounted tại `/api/v1/quotations`. Test thật bằng `curl` (2026-07-20) xác nhận hoạt động đúng, response
  khớp gần như y hệt shape đã đoán trong doc:
  ```json
  { "data": [{ "quotationId": "uuid", "code": "QUO-002", "customerId": "uuid",
      "customerName": "Event Pro", "customerPhone": "0922222222", "version": "v1",
      "subtotal": 3000000, "discount": 0, "totalAmount": 3000000, "status": "draft",
      "createdAt": "2026-07-20T05:53:04.000Z" }],
    "meta": { "page": 1, "limit": 10, "totalItems": 2, "totalPages": 1,
      "counts": { "all": 2, "draft": 1, "approved": 1, "rejected": 0, "approvedValue": 1600000 } } }
  ```
  `meta.counts` giữ nguyên bất kể filter — đúng như cần cho 5 thẻ KPI. **Không cần Backend làm gì thêm**
  — FE chỉ cần thêm hàm `getQuotations()` vào `quotation.service.ts` gọi `GET /quotations` và wire vào
  `manager/quotations/page.tsx`/`admin/quotations/page.tsx` thay cho mock.
- **Vấn đề phụ vẫn còn cần Product xác nhận (không phải thiếu API, mà thiếu quyết định nghiệp vụ)**: bộ
  lọc trạng thái trên UI có thêm giá trị `"Đang khảo sát"` (`surveying`) không tồn tại trong enum DB thật
  (response thật chỉ trả `draft`/`approved`/`rejected`, khớp đúng cảnh báo ban đầu của doc mục 3.1) —
  vẫn cần Product chọn Hướng A (bỏ `surveying` khỏi màn này) hay Hướng B trước khi FE sửa UI.
- **Bài học quy trình**: mọi mục còn lại trong file này (viết trước 2026-07-20, giờ này) cần được đối
  chiếu lại với route thật của `D:\sep490-backend-api` trước khi coi là "đã xác nhận" — xem ghi chú
  tổng quát cuối file.

## (e) ~~Thiếu `GET /api/v1/orders/stats`~~ — ĐÃ CÓ SẴN, không cần làm gì thêm (xác nhận 2026-07-20)

- **Màn liên quan**: "Danh sách đơn đặt" (`/admin/orders_audit`, `/manager/orders`) — xem
  [`docs/danhsachdondat_api.md`](danhsachdondat_api.md) mục 2.
- **Cập nhật (2026-07-20, đối chiếu trực tiếp backend thật đang chạy)**: mục này ban đầu đề xuất thêm
  endpoint `GET /orders/stats` vì tưởng phải gọi `GET /orders?orderStatus=X&limit=1` **5 lần** để lấy đủ
  6 thẻ KPI. Test thật (`curl`) cho thấy **response của `GET /orders` (endpoint đã có, không lọc gì) đã
  trả sẵn `meta.counts`**:
  ```json
  { "data": [...], "meta": { "page": 1, "limit": 10, "totalItems": 1, "totalPages": 1,
    "counts": { "all": 1, "new": 0, "confirmed": 1, "inProgress": 0, "completed": 0, "cancelled": 0 } } }
  ```
  `counts` giữ nguyên không đổi dù có truyền `orderStatus`/`paymentStatus`/`search` hay không (đã test cả
  3 trường hợp) — đúng hành vi cần cho 6 thẻ KPI (luôn hiển thị số liệu toàn bộ tập dữ liệu). **Không cần
  Backend làm gì thêm** — FE chỉ cần đọc `meta.counts` từ response `GET /orders` sẵn có. Đã áp dụng ở
  `manager/orders/page.tsx`/`admin/orders_audit/page.tsx` (xem `DEMO_CHECKLIST.md` mục 4).
- **Lưu ý cho object `counts`**: field dùng **camelCase/lowercase** (`all`/`new`/`confirmed`/
  `inProgress`/`completed`/`cancelled`), khác hẳn dạng UPPERCASE của `OrderStatus` enum
  (`NEW`/`CONFIRMED`/...) — cần map thủ công khi dùng, không thể `counts[orderStatus]` trực tiếp.

## (f) `work_tasks` chưa có dòng "Khảo sát hiện trường" — chặn khối phân công khảo sát ở tab "Tổng quan sự kiện" + "Tiến độ sự kiện"

- **Màn liên quan**: tab "Tổng quan sự kiện" (khối "Phân công khảo sát") và tab "Tiến độ sự kiện" (Mốc 1)
  trong chi tiết đơn — xem [`docs/tongquansukien_api.md`](tongquansukien_api.md) mục 5,
  [`docs/tiendosukien_api.md`](tiendosukien_api.md) mục 3.2/9.1.
- **Vấn đề**: đối chiếu MySQL MCP ngày 2026-07-20, bảng `work_tasks` (danh mục tĩnh, **không có route
  tạo/sửa/xóa phía FE** — comment `types/workTask.ts`) hiện **chỉ seed đúng 2 dòng**: `TSK-SETUP` ("Lắp
  đặt thiết bị") và `TSK-TEARDOWN` ("Tháo dỡ thiết bị") — **không có dòng nào cho "Khảo sát"** (hay "Vận
  chuyển", cùng gốc vấn đề với tab "Lịch trình & Kỹ thuật"). Vì `schedule_plans.task_id` là `NOT NULL`
  FK trỏ `work_tasks`, FE không thể tạo lịch phân công khảo sát cho tới khi có dòng này.
- **Đã chốt hướng (A)** (2026-07-20, áp dụng chung cho cả 2 tab vì cùng phụ thuộc 1 nguồn dữ liệu
  `surveyAssignment`): **Backend seed thêm 1-2 dòng tĩnh vào `work_tasks`**: `"Khảo sát hiện trường"`
  (bắt buộc) và `"Vận chuyển"` (nếu tab Lịch trình & Kỹ thuật cũng cần) — không tạo bảng/cột mới, chỉ
  cần `INSERT` 1-2 dòng. Không chọn Hướng B (bỏ hẳn khối phân công khảo sát khỏi tab Tổng quan, chuyển
  toàn bộ sang màn Khảo sát riêng) vì sẽ phải thiết kế lại điều hướng, chi phí cao hơn.
- **API cần thêm/sửa sau khi seed xong**:
  1. `POST /api/v1/schedule-plans` (đã có) dùng `taskId` = ID dòng "Khảo sát hiện trường" mới — không
     cần đổi payload.
  2. **Endpoint mới** để gán người phụ trách vào `schedule_plan_assignees` (`plan_id`, `user_id`,
     `role ENUM('LEAD','TECHNICAL')`) — **chưa có** ở `schedulePlanApiService`, cần Backend bổ sung
     (vd `POST /api/v1/schedule-plans/:id/assignees`, path cụ thể cần Backend đề xuất).
  3. `GET /api/v1/schedule-plans?orderId=:id` (đã có) cần **join thêm tên người phụ trách** trong
     response — hiện `SchedulePlan.assigneeName` (`types/schedulePlan.ts` dòng 26) giả định model
     "1 plan - 1 người" nhưng bảng thật `schedule_plan_assignees` là **nhiều người/nhiều vai trò**
     (many-to-many có `role`) — type `SchedulePlan` ở FE cần Backend làm rõ lại shape trước khi code
     (đổi `assigneeName: string` thành `assignees: {userId, fullName, role}[]`).
- **Trạng thái**: FE chưa code khối này ở cả 2 tab cho tới khi Backend seed xong `work_tasks` + xác nhận
  lại shape `SchedulePlan.assignees`.
  **Rà lại 2026-07-20 (khi nối tab "Tổng quan sự kiện")**: `GET /api/v1/work-tasks` test lại bằng `curl`
  — **vẫn chỉ đúng 2 dòng** `TSK-SETUP`/`TSK-TEARDOWN`, chưa seed "Khảo sát hiện trường" — gap này còn
  nguyên, chưa đổi. Tin tốt cho điểm 3 ở trên: `GET /schedule-plans?orderId=` test lại bằng `curl` xác
  nhận **đã trả đúng `assignees: {userId, fullName, role, phone, checkInAt, checkOutAt}[]`** (nhiều
  người/vai trò, đúng model thật) — không còn `assigneeName` đơn như lo ngại ban đầu, sẵn sàng dùng khi
  tới lượt migrate tab "Lịch trình & Kỹ thuật"/"Tiến độ sự kiện". Khối "Phân công khảo sát báo giá" ở
  tab "Tổng quan sự kiện" (`src/app/{manager/orders,admin/orders_audit}/[id]/page.tsx`) đã đổi sang
  hiện placeholder rõ ràng thay vì dữ liệu mock, trỏ lại đúng mục này — sẽ code thật ngay khi Backend
  seed xong.

## (g) Tiến độ sự kiện Mốc 4 (checklist trước giờ diễn) + Mốc 6 (đóng đơn) — 2 cột mới + 2 endpoint mới trên `orders`

- **Màn liên quan**: tab "Tiến độ sự kiện" (Mốc 3 trong chi tiết đơn) — xem
  [`docs/tiendosukien_api.md`](tiendosukien_api.md) mục 5 (Mốc 4) và mục 7 (Mốc 6).
- **Mốc 4 — checklist trước giờ diễn** (`PATCH /api/v1/orders/:orderId/live-checklist`):
  - **Đã chốt hướng (A)**: thêm 1 cột JSON trên `orders`, không tạo bảng audit riêng (từ chối phương án
    có `checked_by`/`checked_at` vì đây chỉ là checklist nhanh trước giờ diễn, không cần audit trail).
  - **DB cần sửa**: `ALTER TABLE orders ADD COLUMN live_show_checklist JSON NULL;` — lưu thẳng
    `{ backdrop: boolean, soundTest: boolean, powerBackup: boolean, operatorReady: boolean }`.
  - **Request**: `{ key, checked }` (từng mục) hoặc cả object — doc chưa chốt cách nào, cần Backend chọn.
  - **Output**: trả lại `liveChecklist` mới nhất (shape JSON như trên).
- **Mốc 6 — đóng đơn** (`PUT /api/v1/orders/:orderId/close`):
  - **Đã chốt hướng (A)**: thêm 2 cột trên `orders`, **không** thêm giá trị `CLOSED` vào enum
    `order_status` (vì nhiều chỗ code đã switch cứng theo 5 giá trị hiện có, đổi enum ảnh hưởng rộng).
  - **DB cần sửa**:
    ```sql
    ALTER TABLE orders
      ADD COLUMN closed_at TIMESTAMP NULL,
      ADD COLUMN closed_by VARCHAR(36) NULL,
      ADD CONSTRAINT orders_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE;
    ```
  - **Điều kiện hợp lệ**: chỉ cho đóng khi `order_status = 'COMPLETED' AND payment_status = 'PAID' AND
    closed_at IS NULL`.
  - **Request**: không có body, hoặc `{ notes? }` (doc chưa chốt).
  - **Ảnh hưởng khác**: các endpoint ghi khác trên đơn (`PUT /orders/:id/status`, `PUT /orders/:id/items`,
    các API ghi `schedule_plans` của đơn đó) **phải trả 403** một khi `closed_at IS NOT NULL`.
- **Trạng thái**: cả 2 hướng đã chốt, Backend có thể triển khai theo đúng schema trên; FE chưa code chờ
  Backend xác nhận đã thêm cột.

## (h) `actualStartTime`/`actualEndTime` cho `schedule_plans` — chưa chốt hướng, chặn hiển thị "giờ bắt đầu/hoàn thành thực tế" ở Mốc 3

- **Màn liên quan**: tab "Tiến độ sự kiện" (Mốc 3, mỗi công việc kỹ thuật hiển thị giờ bắt đầu/hoàn
  thành thực tế theo Leader Staff cập nhật) — xem [`docs/tiendosukien_api.md`](tiendosukien_api.md) mục 4,
  mục 9.2. Liên quan trực tiếp tới yêu cầu đã ghi ở `DEMO_CHECKLIST.md` mục 2b ("Ở mốc 3 có cập nhật
  trạng thái làm việc — bắt đầu lúc mấy giờ, hoàn thành lúc mấy giờ").
- **Vấn đề**: bảng `schedule_plans` thật đã có `start_time`/`end_time` nhưng đó là **giờ dự kiến (kế
  hoạch)**, không phải giờ thực tế Leader Staff ghi nhận khi thi công. Doc tự nhận **chưa có đủ căn cứ để
  đề xuất 1 hướng** — cần Backend cho biết `start_time`/`end_time` hiện tại đang được những màn
  hình/luồng nào khác dùng (đặc biệt phía mobile Leader Staff) trước khi quyết định.
- **2 hướng đang cân nhắc (chưa chốt)**:
  1. Thêm cột riêng `schedule_plans.actual_start_time TIMESTAMP NULL`,
     `schedule_plans.actual_end_time TIMESTAMP NULL` — giữ nguyên `start_time`/`end_time` là kế hoạch.
  2. Ghi đè trực tiếp lên `start_time`/`end_time` hiện có khi Leader Staff cập nhật — rủi ro nếu chỗ
     khác đang đọc 2 cột này như "giờ kế hoạch".
- **Trạng thái**: **chưa code**, cần Backend trả lời câu hỏi trên trước khi Product/FE chọn hướng.

## (i) Thiết bị & kho hàng — 2 cột mới + 2 endpoint mới để Leader Staff cập nhật tiến độ chuẩn bị, Manager xác nhận

- **Màn liên quan**: tab "Thiết bị & kho hàng" (trong chi tiết đơn) — xem
  [`docs/thietbikhohang_api.md`](thietbikhohang_api.md) mục 2a/2b/3/7.
- **Đã chốt hết (2026-07-20)** — Backend có thể triển khai toàn bộ theo đúng mô tả dưới đây.
- **`PATCH /api/v1/orders/:orderId/items/:orderItemId`** (Leader Staff cập nhật số lượng đã chuẩn bị +
  người chuẩn bị):
  - **DB cần sửa**: cột `order_items.prepared_qty` **đã có sẵn**, không cần đổi. Cần thêm mới:
    `ALTER TABLE order_items ADD COLUMN prepared_by VARCHAR(255) NULL;` — dùng **free-text**, **không**
    FK `users.user_id` vì giá trị có thể là tên Supplier/đội ngoài, không có tài khoản user.
  - **Request**: `{ preparedQty?: number, preparedBy?: string }`.
  - **Output**: `OrderItem` đã cập nhật (hoặc 204).
  - **Backend cần validate**: `0 ≤ preparedQty ≤ quantity` ở server (không chỉ tin FE); người gọi phải
    có role `LEADER` và đang được gán (`schedule_plan_assignees`) cho đơn đó.
- **`PUT /api/v1/orders/:orderId/items/confirm-prepared`** (Manager xác nhận đã chuẩn bị xong 100%):
  - **DB cần sửa**:
    ```sql
    ALTER TABLE orders
      ADD COLUMN items_confirmed_at TIMESTAMP NULL,
      ADD COLUMN items_confirmed_by VARCHAR(36) NULL,
      ADD CONSTRAINT orders_items_confirmed_by_fkey FOREIGN KEY (items_confirmed_by)
        REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE;
    ```
  - **Điều kiện**: chỉ cho xác nhận khi `preparedQty = quantity` ở **mọi** dòng `order_items` của đơn đó.
  - **Request**: `{ notes?: string }`. **Output**: `Order` đã cập nhật (hoặc 204).
- **Lưu ý**: `actualStartTime`/`actualEndTime` **không** thuộc phạm vi 2 endpoint này — xem mục (h) ở trên
  (thuộc `schedule_plans`, Mốc 3, chưa chốt).
- **Trạng thái**: đã chốt schema, FE chờ Backend làm xong 2 cột + 2 endpoint trên.

## (j) Pick-list xuất kho — 2 cột mới trên `orders` + 2 endpoint mới, thuộc domain `orders` (không phải `inventory`)

- **Màn liên quan**: "Pick-list xuất kho" (`/admin/inventory/outbound`) — xem
  [`docs/picklistxuatkho_api.md`](picklistxuatkho_api.md) mục 4, 5.1, 5.2.
- **Đã chốt hết (2026-07-20)** — không còn mục nào chờ Product quyết định thêm.
- **`GET /api/v1/orders/picklists?page=&limit=&search=&exportStatus=`** — danh sách + KPI cho màn
  pick-list (endpoint mới, **không đề xuất tạo bảng `picklists` riêng** — dùng lại `orders`/`order_items`
  cộng 2 cột mới ở endpoint dưới).
  - **Output** (ví dụ mẫu từ doc):
    ```jsonc
    {
      "data": [{
        "orderId": "uuid", "orderCode": "ORD-001", "customerName": "Nguyễn Văn A",
        "eventDate": "2026-08-15T02:00:00.000Z", "coordinatorName": "Vũ Hoàng Long",
        "totalItemsCount": 4, "preparedItemsCount": 0,
        "itemsConfirmedAt": null, "pickedUpAt": null, "pickedUpByName": null
      }],
      "meta": { "page": 1, "limit": 20, "totalCount": 32, "readyCount": 5, "exportedCount": 3 }
    }
    ```
  - `coordinatorName` join theo "LEAD của `schedule_plans` sớm nhất" (SQL cụ thể ở doc mục 3.4).
- **`PUT /api/v1/orders/:orderId/picklist/picked-up`** — đánh dấu đã lấy hàng khỏi kho:
  - **DB cần sửa**:
    ```sql
    ALTER TABLE orders
      ADD COLUMN picked_up_at TIMESTAMP NULL,
      ADD COLUMN picked_up_by VARCHAR(36) NULL,
      ADD CONSTRAINT orders_picked_up_by_fkey FOREIGN KEY (picked_up_by) REFERENCES users(user_id)
        ON DELETE SET NULL ON UPDATE CASCADE;
    ```
  - **Request**: body rỗng `{}`. **Output**: 204, hoặc order summary đã cập nhật
    `{ pickedUpAt, pickedUpByName }`.
  - **Backend cần validate trước khi set**: (1) `order_status IN ('CONFIRMED','IN_PROGRESS')` else 409;
    (2) `picked_up_at IS NULL` else 409 (chưa lấy 2 lần); (3) `items_confirmed_at IS NOT NULL` (bắt buộc
    đã qua bước Manager xác nhận chuẩn bị ở mục (i) trước, không chỉ dựa vào tổng `prepared_qty`).
- **Trạng thái**: đã chốt schema, FE chờ Backend làm xong 2 cột + 2 endpoint trên.

## (k) ~~Thiếu `GET /api/v1/survey-reports`~~ — ĐÃ CÓ SẴN trên backend thật, không cần Backend làm gì thêm (xác nhận 2026-07-20)

- **Màn liên quan**: "Khảo sát hiện trường" (`/manager/survey`, `/admin/reports/survey`) — xem
  [`docs/khaosathientruong_api.md`](khaosathientruong_api.md) mục 1, 8.
- **⚠️ Sửa lại nhận định ban đầu (2026-07-20)** — cùng nguyên nhân với mục (d): viết dựa trên backend sai
  (`D:\bnwems-backend-api`). Backend thật (`D:\sep490-backend-api\src\modules\operations\survey.routes.ts`)
  **đã có sẵn** `router.get('/', ...)` mounted tại `/api/v1/survey-reports` — danh sách xuyên mọi đơn,
  không cần `orderId`. Test thật bằng `curl` xác nhận hoạt động đúng, đã JOIN sẵn đúng như doc mong muốn:
  ```json
  { "data": [{ "surveyId": "uuid", "reportCode": "SUR-001", "orderId": "uuid", "orderCode": "ORD-001",
      "customerName": "Tech Corp", "eventName": "Tech Summit 2026", "surveyDate": "2026-08-01T10:00:00.000Z",
      "location": "123 Tech St. Hall A", "status": "CONFIRMED", "reportedByName": "Team Leader" }],
    "meta": { "page": 1, "limit": 10, "totalItems": 1, "totalPages": 1,
      "counts": { "all": 1, "draft": 0, "needsReview": 0, "submitted": 0, "confirmed": 1 } } }
  ```
  **Không cần Backend làm gì thêm** — FE chỉ cần thêm hàm gọi `GET /survey-reports` (không có `orderId`)
  vào `survey.service.ts` và wire vào màn danh sách khảo sát thay cho mock.
  Lưu ý `meta.counts` dùng key khác `AdminQuotationStatus`/`OrderStatus` — 5 khóa riêng
  (`all`/`draft`/`needsReview`/`submitted`/`confirmed`), cần đối chiếu lại với `SurveyReportStatus` FE
  hiện có (`types/survey.ts`) trước khi map, không giả định trùng.

## (l) `GET /api/v1/schedule-plans` cần mở rộng `dateFrom`/`dateTo` + trường join — dùng cho "Lịch timeline" và "Kế hoạch và phân công"

- **Màn liên quan**: "Lịch timeline" (`/manager/schedule`, xem
  [`docs/lichtimeline_api.md`](lichtimeline_api.md) mục 2, 2.1, 2.2, 5.1) và "Kế hoạch và phân công"
  (`/admin/coordination/planning`, xem [`docs/kehoachvaphancong_api.md`](kehoachvaphancong_api.md)
  mục 6, 11.2).
- **Vấn đề**: `GetSchedulePlansQuery` hiện chỉ có `date` (1 ngày đơn lẻ) — 2 màn trên cần lọc theo
  **khoảng ngày** (`dateFrom`/`dateTo`) và cần nhiều trường join sẵn trong response mà hiện chưa có.
- **DB cần sửa**: **không cần ALTER/CREATE** — `schedule_plans.start_time`/`end_time` và
  `orders.event_date` đã đủ cột để tính khoảng ngày; doc chỉ gợi ý cân nhắc thêm index trên `start_time`
  nếu dữ liệu lớn (đã có vẻ có sẵn theo tên `idx_schedule_plans_start`, chưa xác nhận chắc chắn).
- **⚠️ 2 doc đang mâu thuẫn nhau, cần Backend/Product thống nhất trước khi code**:
  - `docs/lichtimeline_api.md` (mục 5.1) tự nhận **"đã chốt với người dùng (2026-07-20)"**: khoảng ngày
    tính theo `[orders.event_date, MAX(schedule_plans.end_time)]`.
  - `docs/kehoachvaphancong_api.md` (mục 11.2) liệt kê **cùng đề xuất `dateFrom`/`dateTo` này là "chưa
    chốt, cần Backend/Product xác nhận"**, và dùng công thức khác:
    `MIN(schedule_plans.start_time)`/`MAX(schedule_plans.end_time)` (không có `orders.event_date`).
  - Cần chốt 1 công thức duy nhất trước khi Backend implement, tránh 2 tab cho ra khoảng ngày khác nhau.
- **Query params đề xuất**: `dateFrom` (`YYYY-MM-DD`, bắt buộc), `dateTo` (`YYYY-MM-DD`, bắt buộc),
  `orderId` (tùy chọn — cần Backend xác nhận query builder cho phép bỏ trống để trả mọi đơn).
- **Output mỗi dòng cần thêm** (join): `orderCode`, `eventName`, `eventDate`, `taskName`,
  `assignees: {userId, fullName, role}[]` (theo `lichtimeline_api.md`; `kehoachvaphancong_api.md` xin
  thêm `customerName`, `orderLocation`, và `phone` trong từng assignee). Ví dụ mẫu (từ
  `lichtimeline_api.md` mục 2.2):
  ```jsonc
  {
    "planId": "uuid", "planCode": "PLN-001", "orderId": "uuid", "orderCode": "ORD-001",
    "eventName": "Tech Summit 2026", "eventDate": "2026-08-15T02:00:00.000Z",
    "taskId": "uuid", "taskName": "Lắp đặt thiết bị",
    "startTime": "2026-08-14T07:00:00.000Z", "endTime": "2026-08-14T11:00:00.000Z",
    "location": "123 Tech St. Hall A", "status": "IN_PROGRESS", "notes": null,
    "assignees": [{ "userId": "uuid", "fullName": "Lê Văn Leader", "role": "LEAD" }]
  }
  ```
- **2 endpoint batch đề xuất thêm (chưa chốt, chỉ là tiện ích FE, không bắt buộc)**:
  `POST /api/v1/schedule-plans/batch` (tạo nhiều dòng cùng `order_id` trong 1 transaction) và
  `PATCH /api/v1/schedule-plans/batch/status` (hủy nhiều dòng cùng lúc) — mục đích tránh lưu dở dang khi
  tạo/hủy nhiều dòng kế hoạch cùng lúc. Doc tự nói rõ: **Backend có thể từ chối**, FE chấp nhận tự lặp
  gọi tuần tự (kém an toàn hơn khi lỗi giữa chừng) nếu Backend không muốn làm endpoint batch riêng.
- **Trạng thái**: chờ Backend/Product thống nhất công thức khoảng ngày, sau đó implement phần mở rộng
  `GET /schedule-plans`; 2 endpoint batch để tùy Backend quyết định có làm hay không.

## (m) `PATCH /api/v1/orders/:orderId/quotation` — liên kết/hủy liên kết báo giá với đơn (tab "Báo giá & hợp đồng")

- **Màn liên quan**: tab "Báo giá & hợp đồng" (trong chi tiết đơn) — xem
  [`docs/baogiavahopdong_api.md`](baogiavahopdong_api.md) mục 1.2, 2, 5.2.
- **Vấn đề**: nghiệp vụ **đã chốt giữ** (cho phép đổi báo giá gắn với 1 đơn), nhưng **shape endpoint
  chưa chốt** — hiện chưa có endpoint nào cho việc này ở `order.service.ts` (5 hàm hiện có:
  `getOrders`/`getOrder`/`createOrder`/`updateOrderStatus`/`updateOrderItems`, không có hàm nào sửa
  `quotation_id`).
- **DB cần sửa**: **không cần** — `orders.quotation_id` đã là FK nullable với `ON DELETE SET NULL`
  (xác nhận qua `SHOW CREATE TABLE orders`). Vấn đề hiện tại là hệ thống chỉ tự **gỡ** liên kết khi
  quotation bị xóa (hành vi của DB), chưa có cơ chế để **client** chủ động gỡ/đổi liên kết qua API.
- **API đề xuất** (doc nói rõ đây chỉ là gợi ý minh họa, Backend có thể chọn cách khác — vd gộp vào
  `PUT /orders/:id`, hoặc tách riêng 2 endpoint "liên kết"/"hủy liên kết"):
  `PATCH /api/v1/orders/:orderId/quotation` — **Request**: `{ "quotationId": string | null }` (gửi id để
  liên kết, gửi `null` để hủy liên kết). **Output**: chưa có ví dụ, cần Backend tự định nghĩa.
- **Ràng buộc nghiệp vụ Backend nên enforce ở server** (không chỉ tin điều kiện disable nút ở FE):
  1. Chỉ nhận `quotationId` của báo giá có `status = APPROVED` và **chưa** bị đơn nào khác trỏ tới.
  2. Khi gửi `null` (hủy liên kết), Backend nên tự kiểm tra lại điều kiện "khách hàng này còn >1 báo giá
     `APPROVED`" ở server — cách hiểu chính xác điều kiện này (đếm theo khách hàng hay theo đơn) **chưa
     chốt**, cần Product mô tả lại chính xác (doc mục 5.2.1).
  3. Có cần lưu lịch sử audit mỗi lần đổi `quotation_id` hay ghi đè trực tiếp — **chưa quyết** (doc mục
     5.2.3).
- **Trạng thái**: nghiệp vụ đã chốt giữ tính năng, nhưng shape endpoint + 2 câu hỏi trên cần Backend/
  Product trả lời trước khi code.

## (n) Module Nhà cung cấp chưa được mount trên backend đang chạy + trường `debtBalance` chưa chốt hướng tính

- **Màn liên quan**: "Nhà cung cấp" (`/admin/suppliers`, `/manager/suppliers`) — xem
  [`docs/supplier_api.md`](supplier_api.md) mục 3.1, 6.
- **Phát hiện qua test thật (không phải suy đoán)**: doc tự test bằng curl vào backend thật đang chạy
  (`localhost:3001`) — `GET/POST /api/v1/suppliers`, `PUT /api/v1/suppliers/:id`,
  `GET /api/v1/supplier-transactions` đều trả **404 "Route not found"**, trong khi route đã biết chắc
  tồn tại như `/orders`/`/customers` trả **401 UNAUTHORIZED** (thiếu token) khi gọi không kèm token. Vì
  router bắt path **trước** khi tới middleware auth, 404 (thay vì 401) nghĩa là **toàn bộ route Supplier
  chưa được đăng ký/mount trên server đang chạy** — không phải vấn đề quyền hay cấu hình FE. FE
  (`supplier.service.ts`: `getSuppliers`/`createSupplier`/`updateSupplier`,
  `procurement.service.ts`: `getTransactions`) đã viết đúng path chờ sẵn.
- **Cần Backend xác nhận**: module Supplier có đang phát triển ở nhánh khác chưa merge, hay server thật
  đang chạy build cũ hơn, hay chưa bắt đầu code — để biết ETA trước khi FE lên kế hoạch nối.
- **`debtBalance` (số công nợ, trường nổi bật nhất trên UI danh sách NCC) — chưa chốt hướng tính**:
  - Type `Supplier` (`types/supplier.ts`) hiện **không có field `debtBalance`/`totalDebt`** nào; UI mock
    hiện tại chỉ gán 1 số tĩnh lúc seed, không tính lại từ `transactions[]`.
  - **Khuyến nghị của doc**: **không** lưu `debtBalance` như 1 cột riêng trên `suppliers` (dễ lệch dữ
    liệu) — tính động mỗi lần trả response, theo công thức (nếu tính theo giao dịch):
    `value + compensationAmount - supplierDeduction - paidAmount`.
  - **Câu hỏi còn mở, cần Backend/Product quyết định**: (a) `GET /suppliers` (danh sách) có nên trả kèm
    `debtBalance` đã tổng hợp sẵn (denormalized view, tính lại mỗi lần ghi) hay để FE tự gọi thêm
    `GET /supplier-transactions?supplierId=X` rồi cộng dồn ở client (doc **không khuyến nghị** cách này
    cho màn danh sách nhiều dòng, chỉ chấp nhận được cho màn chi tiết 1 đối tác).
  - **DB cần sửa**: chưa có SQL cụ thể — phụ thuộc quyết định (a) ở trên (nếu chọn denormalize thì cần
    thêm cột; nếu tính động thì không cần đổi schema).
- **Gap phụ khác trên `suppliers` (mục 4.1/5, chưa chốt)**: `catalogItems[]` ("Danh mục hạng mục & giá
  thiết bị cung cấp") **không có entity/endpoint tương ứng nào** trong DB thật — nếu Product xác nhận
  cần giữ tính năng này, phải tạo bảng mới kiểu `supplier_catalog_items(supplier_id, item_name, price,
  unit)` (chỉ là ví dụ minh họa, chưa phải SQL chính thức, cần Backend thiết kế lại). Enum trạng thái
  giao dịch NCC cũng đang lệch giữa mock (`NEW/RECEIVED/CANCELLED`) và type thật
  (`PENDING/APPROVED/IN_PROGRESS/COMPLETED/CANCELLED`) — cần chạy lại `SHOW CREATE TABLE
  supplier_transactions` để chốt (lần viết doc này bị lỗi kết nối MySQL MCP, chưa xác nhận được; tương
  tự chưa xác nhận được `SHOW CREATE TABLE suppliers`).
- **Trạng thái**: chờ Backend xác nhận trạng thái module Supplier trên server thật; FE giữ nguyên mock
  cho tới khi có ETA rõ ràng.

## (o) Mở rộng `GET /api/v1/inventory` (tìm kiếm/lọc) + `POST /api/v1/inventory/adjust` (loại biến động) — phụ thuộc mục (b) đã tạo xong bảng `inventory`

- **Màn liên quan**: "Tồn kho doanh nghiệp" (`/admin/inventory/stock-status`,
  `/manager/inventory/stock-check`) — xem [`docs/tonkhodoanhnghiep_api.md`](tonkhodoanhnghiep_api.md)
  mục 4.1, 5.1, 9. **Điều kiện tiên quyết**: chỉ làm được sau khi bảng `inventory` ở mục (b) đã tồn tại.
- **`GET /api/v1/inventory` cần mở rộng thêm param** (so với `GetInventoryQuery` hiện chỉ có
  `itemId`/`page`/`limit`):
  - `search` (mới) — tìm theo ID/tên thiết bị.
  - `categoryId` (mới) — lọc theo nhóm sản phẩm (options lấy từ `GET /api/v1/catalog/categories` đã có).
  - `date` (mới, `YYYY-MM-DD`) — dùng tính `quantityLocked` theo khoảng ngày `schedule_plans` của đơn
    (công thức đã chốt, **không cần thêm cột/bảng mới**, thuần đổi công thức query); nếu bỏ trống, trả
    `quantityLocked = null`/ẩn cột thay vì mặc định hôm nay.
  - `onlyDamaged=true` (mới) — lọc `quantity_damaged > 0`.
  - Response nên **JOIN sẵn** `itemCode`/`itemName`/`categoryName` (qua `items → item_types →
    item_categories`), và khi có `date`, trả kèm `quantityAvailable = quantity_total - quantity_damaged
    - quantityLocked`.
  - **DB cần sửa**: không cần cột/bảng mới — thuần mở rộng query + JOIN trên schema đã có ở mục (b).
- **`POST /api/v1/inventory/adjust` cần thêm field `movementType`**:
  - Đổi `MovementType` (`types/inventory.ts`) từ `'INBOUND' | 'ADJUSTMENT'` thành
    `'INBOUND' | 'ADJUSTMENT' | 'DAMAGE'` (giá trị `DAMAGE` này cần được thêm khi Backend tạo bảng
    `inventory` ở mục (b) — nhắc lại ở đây để không bỏ sót).
  - **Request**: `{ itemId: string, movementType: 'INBOUND'|'ADJUSTMENT'|'DAMAGE', quantityChange:
    number, notes?: string }`. **Output**: `InventoryRow` đã cập nhật (hoặc 204).
  - **Backend cần validate**: `quantity_total` không âm sau khi cộng; `quantity_damaged` không âm và
    không vượt `quantity_total`; `movementType = 'DAMAGE'` ghi vào `quantity_damaged`, 2 loại còn lại
    ghi vào `quantity_total`.
  - Bỏ lựa chọn "xuất kho đi tiệc" (`OUTBOUND`) khỏi form điều chỉnh thủ công của màn này — thuộc phạm
    vi trang "Pick-list xuất kho" (mục (j) ở trên).
- **`GET /api/v1/inventory/movements` giữ nguyên, không cần cột mới** — đã đủ field cho UI hiện có; chỉ
  cột "Tham chiếu" (`reference`, vd `"PN-2607-01"`) cần Backend xác nhận nguồn map từ đâu.
- **Trạng thái**: chờ mục (b) xong trước, sau đó implement 2 phần mở rộng trên theo đúng mô tả (đã chốt,
  không cần hỏi lại Product).

## (p) Modal "Tạo báo giá mới" — `POST /customers/:customerId/quotations` bị lỗi thật (bug, không phải thiếu API) + module `/catalog/*` chưa mount + không có API giá thiết bị

- **Màn liên quan**: modal `CreateQuotationWizardModal` (mở từ `/manager/quotations`, `/admin/quotations`)
  — xem [`docs/taobaogiamoi_api.md`](taobaogiamoi_api.md) (toàn bộ mục 3 đã chốt hướng xử lý, chỉ 2 phát
  hiện dưới đây là MỚI, phát sinh khi test lại bằng `curl` vào backend thật ngày 2026-07-20 — muộn hơn
  thời điểm viết doc gốc).

### (p.1) Bug thật: `GET`/`POST /api/v1/customers/:customerId/quotations` luôn trả lỗi validate sai, dù route có tồn tại

Test trực tiếp bằng `curl` vào backend thật (`localhost:3001`, có JWT hợp lệ, `customerId` là UUID có
thật đã xác nhận tồn tại qua `GET /customers/:id` thành công):

```text
GET /api/v1/customers/6d36f94d-.../quotations
→ 400 { "code": "VALIDATION_ERROR", "details": [{ "path": "customerId",
        "message": "Invalid input: expected string, received undefined" }] }

POST /api/v1/customers/6d36f94d-.../quotations  (đã thử cả 2 cách: customerId chỉ ở path, VÀ
                                                   customerId lặp lại thêm trong body — cùng lỗi)
→ 400 { "code": "VALIDATION_ERROR", "details": [{ "path": "customerId",
        "message": "Invalid input: expected string, received undefined" }] }
```

Đối chứng cùng lúc để loại trừ nguyên nhân "path param nói chung không hoạt động":
`GET /api/v1/customers/:id` (không lồng) và `GET /api/v1/customers/:id/orders` (lồng, cùng dạng route)
**đều hoạt động đúng**, trả dữ liệu thật bình thường với đúng `customerId` đó. Vậy lỗi **chỉ xảy ra
riêng ở route `.../quotations`** — route rõ ràng có được đăng ký (trả lỗi validate 400 có cấu trúc,
không phải 404 "Route not found" như các route chưa mount ở mục (n)), nhưng validator của route này
đang đọc `customerId` từ một nguồn không đúng (có thể do thiếu `mergeParams: true` khi mount
sub-router theo `customerId`, hoặc validator dùng `req.body.customerId`/`req.query.customerId` trong
khi route thật chỉ truyền qua `req.params.customerId`) — **cần Backend tự kiểm tra middleware validate
của route này**, FE không có cách nào workaround vì không kiểm soát được validator phía server.

**Ảnh hưởng**: nút "Lưu" ở Bước 3 của modal Tạo báo giá mới **không thể lưu thành công** với backend
thật ở trạng thái hiện tại — `quotationApiService.createQuotation()` đã gọi đúng endpoint theo đúng
tài liệu, lỗi hoàn toàn ở phía server. FE đã wire đúng (`src/components/quotations/
CreateQuotationWizardModal.tsx`, gọi `quotationApiService.createQuotation(customerId, payload)`) và
hiển thị lỗi rõ ràng cho người dùng thay vì giả vờ thành công — không sửa gì thêm ở FE cho tới khi
Backend xác nhận đã fix.

**Không có endpoint thay thế**: đã thử `POST /api/v1/quotations` (dạng phẳng, `customerId` trong body)
— route này **404 Route not found**, không tồn tại dưới bất kỳ hình thức nào. `GET /api/v1/quotations
?customerId=X` (dạng phẳng, dùng cho màn danh sách ở mục 4.1 doc gốc) **hoạt động đúng** — chỉ riêng
nhánh `POST` mới không có bản thay thế nào khác ngoài route đang lỗi.

### (p.2) Toàn bộ module `/catalog/*` chưa mount + không có API trả đơn giá thiết bị — Bước 2 của modal đang dùng giá FIX CỨNG

Doc gốc (viết trước khi test lại) đề xuất dùng `GET /api/v1/catalog/items?status=ACTIVE` để tải danh
mục thiết bị cho Bước 2 — test thật bằng `curl` xác nhận **toàn bộ `/catalog/items`, `/catalog/types`,
`/catalog/categories` đều 404 Route not found**, module Catalog hoàn toàn chưa được implement trên
backend thật (tương tự phát hiện ở mục (n) cho module Supplier). Endpoint thật duy nhất trả được danh
sách thiết bị là `GET /api/v1/inventory` (đã hoạt động, xác nhận trả `itemId`/`itemName`/`itemCode`/
`unit`/`categoryName`/`typeName`/số lượng tồn — nhưng **không có bất kỳ field giá nào**
(`rentalPrice`/`unitPrice`/`price`)).

Vì báo giá bắt buộc phải có `price` cho mỗi dòng hạng mục, và không có API nào trả giá thiết bị,
FE hiện đang **fix cứng đơn giá gợi ý** theo `itemCode` (`src/components/quotations/
CreateQuotationWizardModal.tsx`, hằng số `FALLBACK_UNIT_PRICE`, có `DEFAULT_FALLBACK_PRICE` cho item
lạ) — **hiển thị in nghiêng trên UI** kèm dòng chú thích "Đơn giá gợi ý... là dữ liệu fix cứng" ngay
dưới tiêu đề Bước 2, người dùng vẫn sửa tay được trước khi lưu (đúng tinh thần "giá tại thời điểm báo
giá" đã chốt ở doc gốc mục 2).

**Cần Backend làm 1 trong 2 hướng** (chưa chốt, cần Backend/Product chọn):

- **Hướng A (khuyến nghị — ít việc hơn)**: thêm cột giá vào response `GET /api/v1/inventory` — mở rộng
  JOIN hiện có sang `items` để trả kèm 1 field giá (ví dụ `unitPrice DECIMAL(14,2)` — cần Backend xác
  nhận bảng `items` đã có cột giá nào chưa, nếu chưa thì `ALTER TABLE items ADD COLUMN unit_price
  DECIMAL(14,2) NOT NULL DEFAULT 0`). Input: không đổi (`GET /inventory` giữ nguyên params). Output:
  thêm 1 field `unitPrice: number` vào mỗi dòng response hiện có.
- **Hướng B**: implement thật module `/catalog/items` như doc gốc đề xuất (đầy đủ CRUD, có cột giá) —
  nhiều việc hơn Hướng A nhưng khớp đúng kiến trúc `catalog.service.ts`/`types/catalog.ts` đã viết sẵn
  ở FE từ trước (dùng cho các trang quản trị danh mục khác, ví dụ `/admin/catalog/*` — ngoài phạm vi
  tài liệu này, cần rà riêng khi tới lượt các trang đó).

**Trạng thái**: chờ Backend chọn hướng + implement; FE giữ nguyên giá fix cứng in nghiêng cho tới khi
có 1 trong 2 API trên. Mục (p.1) độc lập với mục này — cần Backend fix cả 2 để modal hoạt động đầy đủ
với backend thật (p.1 chặn việc LƯU, p.2 chỉ ảnh hưởng độ chính xác giá gợi ý ban đầu).

**Cập nhật 2026-07-21 — ĐÃ XONG (Hướng A)**: xác nhận lại bằng `curl` thật (đăng nhập `manager`, gọi
`GET /api/v1/inventory?limit=200`) — Backend đã bổ sung đúng Hướng A, response giờ trả kèm
`rentalPrice`/`purchasePrice` thật cho từng dòng (vd `ITM-SPK-01` "Loa JBL 1000W" → `rentalPrice:
500000`), không cần đợi module `/catalog/*` (Hướng B) nữa. Đã cập nhật `InventoryRow`
(`src/types/inventory.ts`) thêm 2 field này, và sửa `CreateQuotationWizardModal.tsx` dùng thẳng
`catalogItem.rentalPrice` thay cho `FALLBACK_UNIT_PRICE`/`fixedPriceFor` — gỡ luôn phần in nghiêng
"dữ liệu fix cứng" ở Bước 2 vì giá giờ là dữ liệu thật. Mục (p.1) (lỗi `POST .../quotations`) vẫn còn
tồn đọng riêng, chưa xử lý ở lần sửa này.

## (q) Trang chi tiết báo giá — tin tốt: `GET /quotations/:id` đã trả đủ dữ liệu mở rộng thật; 3 gap còn lại đã xử lý bằng bỏ/fix cứng, không chặn nối API phần còn lại

- **Màn liên quan**: `/manager/quotations/:id`, `/admin/quotations/:id` — xem
  [`docs/xemchitietbaogia_api.md`](xemchitietbaogia_api.md).
- **Tin tốt xác nhận qua `curl` (2026-07-20)**: khác với giả định "chưa chốt" của doc gốc,
  `GET /api/v1/quotations/:id` **đã trả sẵn đúng 100%** shape mở rộng mà doc mục 5.1 đề xuất
  (`customerEmail`/`customerAddress` JOIN, `createdBy` object có `role`, `linkedOrderId`,
  `items[].categoryName`/`unit` JOIN thật) — không cần Backend làm gì thêm cho Trang 1. Đã nối thật,
  bỏ hard-code nhãn "(Kinh doanh)" (dùng `createdBy.role` map sang tiếng Việt), bỏ dòng
  "hiệu lực đến ngày `validUntil`" (cột không tồn tại), items hiển thị đúng `categoryName`/`unit` JOIN
  thật thay vì suy đoán.
- **`PATCH /quotations/:id/status` sai kiểu trong `types/quotation.ts` cũ — đã tự sửa, không cần Backend
  làm gì**: type cũ khai `status: QuotationStatus` (uppercase, có cả `'DRAFT'`) nhưng test thật xác nhận
  backend chỉ nhận **lowercase**, chỉ 2 giá trị `'approved'|'rejected'` (không cho PATCH ngược về draft).
  Đã sửa `UpdateQuotationStatusPayload` + 1 call site sai (`CreateQuotationModal.tsx` từng gửi
  `{status:'APPROVED'}` — sẽ luôn bị backend từ chối, đã sửa thành `'approved'`).
- **3 gap còn lại — đã tự quyết định hướng xử lý ở tầng FE (không chặn phần còn lại), nhưng vẫn cần
  Backend/Product quyết định lâu dài**:
  1. **`GET /policies` (chính sách hoàn cọc/hủy đơn hiển thị ở "Chính sách chung") 404** — chưa tồn tại
     trên backend thật. Đã fix cứng dòng "hiệu lực 30 ngày" + giữ đọc `MOCK_POLICIES` (mock in-memory)
     cho phần chính sách %, **đánh dấu in nghiêng toàn bộ khối** trên UI. **API cần bổ sung**:
     `GET /api/v1/policies?type=DEPOSIT,CANCELLATION&isActive=true` — **Output đề xuất**:
     `{ data: [{ policyId, policyName, policyType, policyValue, unit, description, isActive }] }`.
     Không cần sửa DB (đã xác nhận bảng `business_policies` tồn tại thật ở
     `docs/xemchitietbaogia_api.md` mục 1.2) — chỉ cần route mới.
  2. **Khối "Phân công khảo sát báo giá" — đã BỎ HẲN khỏi UI** (Hướng A đã chốt ở doc mục 2, không có
     cột DB nào liên kết khảo sát trực tiếp vào Quotation) — thay bằng link "Xem đơn đặt liên kết" khi
     `linkedOrderId` có giá trị. Không cần API mới cho quyết định này.
  3. **Trang 2 "Picklist chi tiết vật tư" — đã BỎ HẲN phần bóc tách BOM + cột tồn kho giả** (Hướng B đã
     chốt ở doc mục 3.1/3.2/3.3 — không có bảng nào trong DB thật biểu diễn "1 item gồm nhiều item con"
     hay theo dõi số lượng tồn kho), Trang 2 giờ chỉ hiện thẳng `items[]` thật từ mục 5.1. Nếu Product
     sau này thật sự cần lại 2 tính năng này, cần 2 việc DB riêng (module BOM + module Tồn kho theo
     ngày — module Tồn kho đã có khung sơ bộ ở mục (b)/(o), module BOM **hoàn toàn chưa có đề xuất nào**,
     cần bảng mới kiểu `item_components(parent_item_id, child_item_id, quantity_per_unit)` — xem ví dụ
     SQL minh họa ở `docs/xemchitietbaogia_api.md` mục 3.1, chưa chốt, chỉ là gợi ý).
- ~~Nút "Tạo đơn đặt từ báo giá" (`CreateOrderFromQuotationModal`) — tạm khóa khỏi 2 trang chi tiết
  này~~ **— ĐÃ XONG 2026-07-21**: viết lại hẳn `CreateOrderFromQuotationModal.tsx` nhận đúng
  `QuotationDetailApi` thật (không còn `AdminQuotationRow` mock) — giữ cùng bố cục/validate với
  `CreateOrderModal.tsx` đã hoạt động thật (mục (s)), chỉ khác là prefill sẵn khách hàng + hạng mục từ
  `quotation.items` (`unitPrice = lineTotal/quantity`, tức giá thật sau chiết khấu đã chốt ở báo giá).
  Gọi `orderApiService.createOrder({..., quotationId: quotation.quotationId})` — đã xác nhận qua `curl`
  thật (tạo `ORD-003` từ `QUO-002`) rằng gửi kèm `quotationId` ngay lúc `POST /orders` tự động liên kết
  Order ↔ Quotation (`GET /quotations/:id` sau đó trả đúng `linkedOrderId`), không cần gọi thêm
  `PATCH /orders/:id/quotation` (mục (m)/(y)) cho trường hợp tạo mới. Nút "Sinh đơn đặt từ báo giá" đã
  hiện lại ở `/admin/quotations/:id` và `/manager/quotations/:id` khi `status === 'approved'` và chưa có
  `linkedOrderId`, sau khi tạo thành công điều hướng thẳng sang trang chi tiết đơn vừa tạo.
  **Chưa đụng tới**: nút "Tạo đơn từ báo giá" (disabled) ở `/admin/contracts` — dùng
  `CreateOrderPickQuotationModal` (luồng chọn báo giá trước rồi mới tạo đơn), vẫn còn shape cũ, ngoài
  phạm vi lần sửa này.
- **Trạng thái**: Trang 1 đã nối đầy đủ, hoạt động thật 100% với backend thật (đã test `curl` +
  `GET`/`PATCH status`/`DELETE`/`POST orders` kèm `quotationId`). 2 gap còn lại (chính sách fix cứng,
  N+1 picklist) đã có hướng xử lý tạm ở FE, không chặn — chỉ cần Backend làm khi rảnh tay theo đúng mô
  tả trên.

## (r) Màn "Hợp đồng" (`/admin/contracts`) — đã áp dụng Hướng A (bỏ entity Hợp đồng riêng, dùng view lọc Order); 1 gap hiệu năng N+1 cần Backend bổ sung field khi rảnh tay

- **Màn liên quan**: `/admin/contracts` (chỉ trang danh sách — xem
  [`docs/danhsachhopdong_api.md`](danhsachhopdong_api.md) mục 1.5 "Hướng A khuyến nghị"). Trang chi tiết
  `/admin/contracts/[id]` và modal `ContractEditModal` **ngoài phạm vi** — vẫn đọc
  `src/mocks/adminContractsMock.ts` như cũ, chưa đụng tới.
- **Đã áp dụng Hướng A đúng như doc khuyến nghị**: bỏ hẳn khái niệm "Hợp đồng" là 1 entity riêng (DB
  thật không có bảng `contracts`) — `src/app/admin/contracts/page.tsx` giờ là 1 **view lọc của Order**
  (chỉ hiển thị `Order` có `quotationId` — tức đơn được sinh từ 1 báo giá đã duyệt), gọi thẳng
  `orderApiService.getOrders()`/`getOrder()`/`updateOrderStatus()` đã có sẵn — không có entity/endpoint
  riêng nào cho "Hợp đồng". Đã xóa `ContractCreateModal.tsx` (modal 3 trường thiếu field bắt buộc theo
  `CreateOrderPayload` thật, đúng phân tích doc mục 3.2) — nút "Tạo đơn từ báo giá" tạm khóa (cùng lý do
  đã ghi ở mục (q): `CreateOrderFromQuotationModal` chưa tương thích shape API thật).
- **Gap phát hiện khi nối thật (ngoài phạm vi phân tích ban đầu của doc gốc)**: `GET /api/v1/orders`
  (danh sách) **không trả field `quotationId`** — xác nhận qua `curl` thật (2026-07-20): response danh
  sách chỉ có `orderId/orderCode/customerId/customerName/customerPhone/eventType/eventName/eventDate/
  location/guestCount/totalAmount/paymentStatus/orderStatus/createdAt`, không có `quotationId`. Chỉ
  `GET /api/v1/orders/:id` (chi tiết) mới trả `quotationId` (đã xác nhận đơn mẫu thật `ORD-001` có
  `quotationId` khi gọi chi tiết). Vì màn này cần lọc chính xác "đơn có `quotationId`", FE phải gọi
  danh sách rồi gọi tiếp **chi tiết từng đơn** (N+1) để biết đơn nào có `quotationId` — chấp nhận được
  tạm thời vì tổng số đơn hiện rất nhỏ (nghiệp vụ tổ chức sự kiện, không phải khối lượng thương mại điện
  tử), nhưng sẽ chậm khi số đơn tăng lên.
  **Cần Backend bổ sung** (không cần sửa DB, chỉ cần mở rộng response): thêm field `quotationId?: string`
  vào từng phần tử của response `GET /api/v1/orders` (danh sách), giống hệt field đã có sẵn ở
  `GET /api/v1/orders/:id`. **Input**: không đổi (giữ nguyên toàn bộ query param hiện có). **Output**:
  thêm 1 field `quotationId: string | null` vào mỗi object trong `data[]`. Sau khi có field này, FE sẽ
  bỏ hẳn bước gọi chi tiết N+1, lọc thẳng trên response danh sách.
- **4 KPI + tabs trạng thái + cột bảng — đã đổi đúng theo mục 2.1-2.3 của doc**: KPI "Tổng số đơn từ báo
  giá"/"Đang triển khai"/"Đã hoàn thành"/"Tổng giá trị" tính từ chính `Order` (không còn VAT/discount
  giả — cột `orders.total_amount` không có 2 field này, đúng phát hiện mục 2.1). 6 tab trạng thái đổi
  hẳn sang `orderStatus` thật (`NEW/CONFIRMED/IN_PROGRESS/COMPLETED/CANCELLED`), bỏ 4 tab ký kết văn bản
  cũ (`draft/sent/signed/completed`) vì không có cột thật tương đương (mục 2.2). Cột bảng bỏ 3 cột "Đơn
  đặt liên kết/Trạng thái Đơn/Thanh toán" (join tình cờ qua mock cũ) — mỗi dòng giờ **chính là** 1 Order
  nên không cần cột "liên kết" nữa, hiển thị trực tiếp `orderStatus`/`paymentStatus` của chính dòng đó
  (mục 2.3). Nút "Xóa hợp đồng" đổi thành "Hủy đơn" (`updateOrderStatus(id, {orderStatus:'CANCELLED'})`)
  thay vì xóa cứng bản ghi — đúng khuyến nghị mục 2.3 (không có `DELETE` an toàn cho Order theo CLAUDE.md).
- **Trạng thái**: Đã test bằng Playwright với backend thật đang chạy (đăng nhập `admin`/`123456`) — mở
  `/admin/contracts` hiển thị đúng đơn thật `ORD-001` (Tech Corp, Tech Summit 2026, 1.600.000₫, "Đã xác
  nhận"/"Chưa thanh toán"), 4 KPI tính đúng (1/1/0/1.600.000₫), tab "Đã xác nhận (1)" lọc đúng. 0 lỗi
  console. `npx tsc --noEmit` sạch (đã sửa 1 lỗi type nhỏ — `o.eventName` optional, thêm `?? ''`).
  Gap N+1 ở trên không chặn demo, chỉ cần Backend bổ sung khi rảnh tay.

## (s) Modal "Tạo đơn đặt lịch tiệc mới" — đã mở lại nút, module `/catalog/*` hóa ra ĐÃ hoạt động (khác ghi nhận cũ ở mục (n)/(p.2)); phát hiện thêm bug thật: giới hạn `limit` không đồng nhất giữa các route

- **Màn liên quan**: `/manager/orders`, `/admin/orders_audit` (nút "Khởi tạo đơn đặt hàng") — xem
  [`docs/taodondatlichtiecmoi_api.md`](taodondatlichtiecmoi_api.md) mục 3.
- **Tin tốt — cập nhật lại phát hiện cũ ở mục (n)/(p.2)**: 2 mục đó (viết cùng ngày 2026-07-20, nhưng
  sớm hơn trong ngày) ghi nhận `/catalog/*` **404 toàn bộ** ("chưa mount trên backend"). Test lại bằng
  `curl` (muộn hơn cùng ngày, sau khi backend được cập nhật) xác nhận **`GET /api/v1/catalog/items` giờ
  hoạt động đầy đủ**, trả kèm `rentalPrice`/`purchasePrice` thật (ví dụ `ITM-SPK-01` "Loa JBL 1000W" —
  `rentalPrice: 500000`) — đúng dữ liệu cần cho bước chọn hạng mục khi tạo đơn, **không cần fix cứng giá
  nữa** cho tính năng này. Component `CreateOrderModal.tsx` (đã viết sẵn từ trước, dùng đúng
  `catalogApiService.getItems()` + `orderApiService.createOrder()`, nhưng mồ côi — không trang nào
  import) giờ wire được thẳng vào nút "Khởi tạo đơn đặt hàng" ở 2 trang trên, không cần viết lại logic.
  **Chưa xóa mục (n)/(p.2) cũ** vì (n) còn nói về module Supplier (vẫn 404, chưa đổi) và (p.2) còn liên
  quan tới đơn giá fix cứng ở modal Tạo báo giá (`CreateQuotationWizardModal`, `FALLBACK_UNIT_PRICE`) —
  **đây là việc riêng, chưa gỡ trong lần sửa này** (ngoài phạm vi task "Tạo đơn đặt lịch tiệc mới"), cần
  1 lần sửa riêng sau để gỡ hard-code giá ở modal báo giá và dùng thẳng `rentalPrice` thật.
- **Bug thật phát hiện + đã sửa (không phải thiếu API, mà là giới hạn `limit` không đồng nhất giữa các
  route)**: `GET /api/v1/customers?limit=200` và `GET /api/v1/orders?limit=200` đều trả `400
  VALIDATION_ERROR` ("limit: Too big: expected number to be <=100"), trong khi `GET /api/v1/catalog/items`
  và `GET /api/v1/inventory` lại chấp nhận `limit=200` bình thường (không giới hạn, hoặc giới hạn cao
  hơn). Nhiều nơi trong FE đang gọi `getCustomers({limit:200})`/`getOrders({limit:200})` — khi backend từ
  chối, `.catch()` âm thầm trả về mảng rỗng, khiến dropdown chọn khách hàng/đơn hàng **trống hoàn toàn**
  mà không có lỗi hiển thị nào (rất khó phát hiện nếu không test tay). Đã tự sửa ở FE (đổi tất cả
  `limit: 200` → `limit: 100` cho 2 route này): `src/app/manager/orders/page.tsx`,
  `src/app/admin/orders_audit/page.tsx`, `src/components/quotations/CreateQuotationWizardModal.tsx`
  (chỉ sửa lời gọi `getCustomers`, giữ nguyên `getInventory({limit:200})` vì route đó không giới hạn),
  `src/components/schedule/CreateTaskModal.tsx` (sửa cả `getOrders` và `getCustomers`).
  **Đề xuất Backend** (không bắt buộc, chỉ để nhất quán API): hoặc nâng giới hạn `/customers`/`/orders`
  lên khớp `/catalog/items`/`/inventory` (khuyến nghị, ít việc FE hơn về sau), hoặc tài liệu hóa rõ giới
  hạn `limit` tối đa của mỗi route trong OpenAPI spec để FE không phải dò bằng `curl`. **Input/Output**:
  không đổi, chỉ là thay đổi giá trị cho phép của query param `limit` đã có sẵn.
- **Field đã bỏ khỏi form so với mock cũ** (đúng khuyến nghị doc mục 2 — không có cột thật trên `orders`):
  `weddingEndDate` ("Ngày kết thúc"), `depositAmount`, `paymentStatus`, `coordinatorName` ("Điều phối
  viên"), checkbox "Đã khảo sát hiện trường trước khi tạo đơn", dòng subtitle "Mã đơn đặt dự kiến". Gói
  dịch vụ/loại sự kiện dùng chung 1 field `eventType` (danh sách gợi ý `EVENT_TYPES`, cột thật là text tự
  do — đúng phát hiện của doc).
- **Trạng thái**: Đã test bằng Playwright với backend thật đang chạy (đăng nhập `manager`/`123456`) —
  mở `/manager/orders`, bấm "Khởi tạo đơn đặt hàng", chọn khách hàng thật ("Tech Corp"), chọn loại sự
  kiện, ngày tổ chức, số khách, địa điểm, thêm 1 hạng mục thật từ catalog (giá tự điền `rentalPrice`
  thật), bấm "Tạo đơn hàng" — tạo thành công, danh sách tự tải lại và hiện đơn mới. `npx tsc --noEmit`
  sạch. Đã áp dụng y hệt cho `/admin/orders_audit`.

## (t) Màn "Khảo sát hiện trường" — đã nối API thật đầy đủ (danh sách toàn cục + chi tiết + xác nhận); 3 gap còn lại xử lý bằng in nghiêng, theo đúng hướng đã chốt ở doc

- **Màn liên quan**: `/manager/survey`, `/admin/reports/survey` — xem
  [`docs/khaosathientruong_api.md`](khaosathientruong_api.md) (toàn bộ quyết định đã chốt ở mục 0/2/3,
  xem bảng tổng hợp mục 8 — tài liệu này chỉ xác nhận lại bằng `curl`/Playwright thật, không cần quyết
  định kiến trúc mới).
- **Tin tốt xác nhận qua `curl` (2026-07-20)**: khác với ghi nhận cũ ở comment đầu `types/survey.ts`
  ("KHÔNG join reporter/confirmer"), `GET /api/v1/survey-reports` (danh sách toàn cục — **trước đây
  hoàn toàn chưa có, chỉ có bản theo 1 đơn**) và `GET /api/v1/survey-reports/:id` giờ **đã join sẵn**
  `orderCode`/`customerName`/`eventName`/`reportedByName`/`confirmedByName` + `meta.counts` đúng 4 giá
  trị enum thật (`all`/`draft`/`needsReview`/`submitted`/`confirmed`) — khớp 100% yêu cầu doc mục 1/7,
  không cần Backend làm gì thêm cho phần join. Đã nối thật: `src/types/survey.ts` (thêm
  `SurveyReportListItem`/`GetSurveyReportsQuery`/`SurveyReportListMeta`, thêm field
  `orderCode`/`customerName`/`eventName`/`reportedByName`/`confirmedByName` vào `SurveyReport`),
  `src/services/survey.service.ts` (thêm `getSurveyReports()`), viết lại toàn bộ
  `src/app/{manager/survey,admin/reports/survey}/page.tsx` (gọi `surveyApiService.getSurveyReports()`
  server-side search/status/phân trang, KPI đọc thẳng `meta.counts`) và
  `src/components/survey-reports/SurveyDetailDrawer.tsx` (nhận `SurveyReport` thật thay vì mock
  `AdminSurveyReport`).
- **Đã bỏ nút "+ Tạo báo cáo khảo sát" + `SurveyCreateDrawer`** khỏi cả 2 trang (đúng chốt ở doc mục 0
  — đây là hành động Leader Staff qua mobile, không phải Manager trên web). `SurveyCreateDrawer.tsx`
  giữ nguyên trên đĩa (không xóa) — chỉ còn giá trị tham khảo bàn giao mobile team như doc đã ghi, hiện
  mồ côi (không trang nào import), cùng loại với `SurveyPersonnelTab`/`RecordDepositModal` đã ghi nhận
  ở các Task trước.
- **Enum đổi đúng theo mục 2**: `PENDING_CONFIRM` (mock) → `NEEDS_REVIEW` (thật); `SUBMITTED` tạm gộp
  badge/KPI "Chờ xác nhận" cùng `NEEDS_REVIEW` cho tới khi Backend làm rõ sự khác biệt (đúng khuyến
  nghị mục 2, không cần API mới).
- **3 gap còn lại — đã áp dụng đúng nguyên tắc "chỉ lấy dữ liệu đủ" của doc mục 3, fix cứng in nghiêng
  phần thiếu, không chặn phần còn lại**:
  1. **2 cột đo đạc chưa có** (mục 3.1): "Chiều cao trần" và "Công suất nguồn điện khả dụng" —
     `survey_reports` không có cột nào lưu 2 giá trị này. Đã hiển thị **in nghiêng** bằng dữ liệu fix
     cứng (`MOCK_CEILING_HEIGHT`/`MOCK_POWER_CAPACITY` trong `SurveyDetailDrawer.tsx`) kèm chú thích rõ.
     **API/DB cần bổ sung**: `ALTER TABLE survey_reports ADD COLUMN ceiling_height DECIMAL(5,2) NULL,
     ADD COLUMN power_capacity VARCHAR(100) NULL` — **Output**: thêm 2 field
     `ceilingHeight?: number`/`powerCapacity?: string` vào response `GET /survey-reports/:id` (và có
     thể cả list nếu cần hiển thị ở bảng). **Input**: thêm 2 field tương ứng (optional) vào
     `CreateSurveyReportPayload` (`POST /survey-reports`, phía mobile Leader Staff điền khi nộp báo cáo).
  2. ~~"Danh sách thiết bị báo giá nháp" (`quoteItems`) hoàn toàn không có trong DB~~ — **ĐÃ GIẢI QUYẾT
     (2026-07-21), không cần bảng mới.** Nhận định cũ sai: gap này không nằm ở `survey_reports` (bảng đó
     đúng là không có cột nào lưu thiết bị), mà dữ liệu thật ra đã có sẵn ở **báo giá (quotation) liên
     kết với đơn của báo cáo khảo sát đó** — `report.orderId` → `GET /orders/:orderId` (trả
     `quotationId`) → `GET /quotations/:quotationId` (đã trả đủ `items[]` thật: `itemName`/
     `categoryName`/`unit`/`quantity`/`price`/`lineTotal`, xác nhận qua `curl`). Đã sửa
     `SurveyDetailDrawer.tsx` gọi 2 API này tuần tự khi mở drawer, đổi bảng từ `MOCK_QUOTE_ITEMS` sang
     `linkedQuotation.items` thật, bỏ nhãn "(dữ liệu minh họa)"; có 3 trạng thái hiển thị: đang tải /
     đơn chưa liên kết báo giá nào / lỗi tải. Cùng cách xử lý áp dụng được cho khối "Đối chiếu khảo sát
     thực tế" ở trang chi tiết báo giá đã ghi nhận ở mục (q) — có thể tái dùng khi tới lượt màn đó (hiện
     màn đó đã bỏ hẳn tính năng theo Hướng B, chưa cần làm lại).
  3. **Đa ảnh minh chứng** (mục 3.5) — `survey_reports.evidence_id` chỉ lưu được **1 ảnh**/báo cáo
     (cột đơn, không có bảng đính kèm nhiều file dạng `evidence_attachments` như CLAUDE.md mô tả —
     bảng đó **không tồn tại thật**, đã xác nhận qua `SHOW TABLES`). Đã hiển thị đúng 1 ảnh thật qua
     `GET /evidence/:id` (khi có `evidenceId`) + 1 ảnh minh họa viền nét đứt kèm chú thích rõ, không
     giả vờ có nhiều ảnh thật. **Cần Backend làm** (nếu Product xác nhận cần đa ảnh cho khảo sát —
     nghiệp vụ hợp lý vì 1 buổi khảo sát thường cần chụp nhiều góc): bảng mới
     `evidence_attachments(attachment_id PK, entity_type ENUM(...,'SURVEY_REPORT'), entity_id, evidence_id, created_at)`
     theo đúng pattern polymorphic CLAUDE.md đã đề xuất (hiện chưa implement) — **Output**
     `GET /survey-reports/:id` đổi `evidenceId`/`evidence` đơn thành `evidenceIds: string[]`/
     `evidences: Evidence[]`, **Input** `POST /survey-reports` nhận `evidenceIds?: string[]` thay cho
     `evidenceId?: string`.
- **Trạng thái**: Đã test bằng Playwright với backend thật đang chạy (đăng nhập `manager`/`123456`) —
  `/manager/survey` hiện đúng 1 báo cáo thật `SUR-001` (Tech Corp, Tech Summit 2026, trạng thái "Đã xác
  nhận"), 4 KPI đúng (1/0/1/0); mở "Xem chi tiết" hiện đúng dữ liệu thật (địa điểm, khảo sát viên "Team
  Leader", người xác nhận "Project Manager") + 2 khối in nghiêng đúng vị trí. `npx tsc --noEmit` sạch.
  Đã áp dụng y hệt cho `/admin/reports/survey`. Chưa test được nút "Xác nhận báo cáo khảo sát" bằng
  thao tác thật (báo cáo mẫu duy nhất trong DB đã ở trạng thái `CONFIRMED`, không còn báo cáo nào ở
  `NEEDS_REVIEW`/`SUBMITTED` để bấm thử) — đã xác nhận đúng logic qua code review (điều kiện hiện nút,
  payload gửi `PUT /survey-reports/:id/confirm`).

## (u) Màn "Tồn kho doanh nghiệp" — bảng `inventory` thật ra ĐÃ được tạo (khác ghi nhận cũ ở mục (b)); đã nối API thật, 3 gap còn lại xử lý bằng bỏ/in nghiêng theo đúng hướng đã chốt ở doc

- **Màn liên quan**: `/manager/inventory/stock-check`, `/admin/inventory/stock-status` + modal chi
  tiết thiết bị + trang "Thiết bị đang bảo trì" (`/admin/inventory/maintenance`) — xem
  [`docs/tonkhodoanhnghiep_api.md`](tonkhodoanhnghiep_api.md) (viết với giả định bảng `inventory`
  **chưa tồn tại**, xem mục (b) — nay cần cập nhật lại phần "giả định" đó).
- **Tin tốt xác nhận qua `curl` (2026-07-20)**: khác hẳn ghi nhận ở mục (b) ("chưa có bảng `inventory`
  nào trong DB thật"), `GET /api/v1/inventory` và `GET /api/v1/inventory/movements` **đã hoạt động đầy
  đủ với dữ liệu thật** — trả sẵn `itemCode`/`itemName`/`categoryName`/`typeName` (join `items →
  item_types → item_categories`) + 4 số liệu `quantityTotal`/`quantityDamaged`/`quantityReserved`/
  `quantityAvailable`. `GET /api/v1/catalog/items/:id` cũng trả kèm `rentalPrice`/`purchasePrice`/
  `description` thật (không cần fix cứng giá cho modal chi tiết). Đã nối thật toàn bộ: viết lại
  `src/types/inventory.ts` (sửa field theo response thật — bỏ `inventoryId` không tồn tại,
  `performedBy` là object `{userId, fullName}` không phải string, `AdjustInventoryPayload` dùng
  `deltaTotal`/`deltaDamaged` không phải `movementType`/`quantityChange` như doc gốc đề xuất), viết lại
  `src/app/{manager/inventory/stock-check,admin/inventory/stock-status}/page.tsx` (gọi
  `inventoryApiService.getInventory()` thật), tạo **component mới** `src/components/catalog/
  InventoryDetailModal.tsx` (**không** sửa `EquipmentDetailModal.tsx` cũ — component đó vẫn đang dùng
  chung ở `/admin/catalog/packages`, 1 trang CRUD danh mục hoàn toàn khác, thuần mock, đổi chung sẽ phá
  vỡ trang đó). Đã sửa `src/app/admin/inventory/maintenance/page.tsx` (bỏ tham chiếu `row.inventoryId`
  không còn tồn tại trên type, dùng `itemId` làm khóa).
- **3 gap phát hiện khi test thật (khác giả định ban đầu của doc, doc viết trước khi có bảng
  `inventory` thật nên chưa biết các gap này) — đã xử lý bằng bỏ khỏi UI hoặc fix cứng in nghiêng,
  không chặn phần còn lại**:
  1. **`date` không ảnh hưởng `quantityReserved`** — công thức "khóa kho theo khoảng ngày
     `schedule_plans`" đã chốt ở doc mục 3 **chưa được implement**; backend nhận param `date` nhưng bỏ
     qua, `quantityReserved` luôn là 1 con số cố định (không phụ thuộc ngày). Đã **bỏ hẳn ô chọn ngày**
     khỏi UI (giữ sẽ gây hiểu nhầm là số liệu date-based thật) — đổi nhãn cột thành "Số lượng đã khóa"
     đơn giản (không kèm ngày). **Cần Backend implement đúng công thức SQL đã chốt ở doc mục 3** (dùng
     `schedule_plans.start_time`/`end_time`) nếu muốn tính năng lọc theo ngày hoạt động thật — **Input**
     giữ nguyên param `date` đã có, **Output** thêm field `quantityReserved` tính động theo `date` thay
     vì tĩnh như hiện tại.
  2. **`categoryId`/`onlyDamaged` bị backend bỏ qua** (nhận param nhưng không lọc, xác nhận qua `curl`:
     `onlyDamaged=true` vẫn trả cả item không hỏng). Đã chuyển 2 filter này sang lọc **phía client**
     (dữ liệu hiện chỉ 3 item, chấp nhận được) — dropdown "Nhóm sản phẩm" derive từ `categoryName` của
     chính danh sách đã tải (không cần `GET /catalog/categories`, endpoint đó cũng đang 404 — xem mục
     (n)/(p.2) cho phát hiện tương tự ở Supplier/Catalog). **Cần Backend implement lọc thật ở server**
     khi số lượng item tăng lên (client-side không scale) — **Input**: giữ nguyên 2 param đã có,
     **Output**: áp dụng đúng điều kiện lọc trước khi trả `data[]`/`meta`.
  3. **`POST /inventory/adjust` không hỗ trợ ghi nhận riêng "hàng hỏng" mà không đổi tổng số lượng** —
     xác nhận qua `curl`: `deltaTotal` bắt buộc và phải khác 0 (validate chặn `deltaTotal: 0` dù có
     `deltaDamaged` khác 0), nghĩa là không thể mô tả nghiệp vụ "kiểm kê phát hiện 1 đơn vị đã hỏng
     trong số hiện có, không nhập/xuất thêm gì" bằng endpoint này. Form "Điều chỉnh tồn kho" đã đổi
     thành 2 loại có nghĩa thật (Nhập kho thêm / Điều chỉnh kiểm kê ±), bỏ hẳn lựa chọn "Ghi nhận hỏng"
     độc lập, kèm chú thích rõ giới hạn này. **Cần Backend nới validate**: cho phép `deltaTotal: 0` khi
     `deltaDamaged !== 0` (chỉ cấm trường hợp cả 2 đều 0/thiếu) — **Input**: đổi rule validate của
     `deltaTotal` từ "bắt buộc khác 0" thành "ít nhất 1 trong 2 field `deltaTotal`/`deltaDamaged` khác
     0", **Output**: không đổi.
  4. **2 cột `items.dimensions`/`items.material` + cột `inventory.location` vẫn chưa có** (đúng ghi
     nhận cũ ở mục (b), phần này KHÔNG phải tin mới) — hiển thị in nghiêng bằng dữ liệu fix cứng trong
     `InventoryDetailModal.tsx`, giữ nguyên đề xuất DB ở mục (b).
  5. **`GET /api/v1/catalog/items/:id` (chi tiết theo id) trả 404** — xác nhận qua `curl` (route
     không tồn tại, khác `GET /catalog/items` danh sách hoạt động đúng). Đã sửa FE gọi danh sách
     (`limit: 100`) rồi tự lọc theo `itemId` phía client thay vì gọi endpoint chi tiết không tồn tại
     (dữ liệu hiện rất nhỏ, chấp nhận được). **Cần Backend bổ sung** route `GET /api/v1/catalog/items/:id`
     nếu muốn FE gọi trực tiếp theo id khi danh mục lớn hơn — **Input**: `:id` (path param, UUID),
     **Output**: 1 object `Item` giống 1 phần tử trong response danh sách hiện có.
- **Trạng thái**: Đã test bằng Playwright với backend thật đang chạy (đăng nhập `manager`/`123456`) —
  `/manager/inventory/stock-check` hiện đúng 3 thiết bị thật (Loa JBL 1000W/Đèn Beam 230/Bàn tiệc
  tròn) với số liệu tồn kho thật; mở modal chi tiết hiện đúng giá/mô tả thật + nhật ký biến động thật
  (join tên người thực hiện); thử "Nhập kho thêm" 1 thiết bị — số Tổng số lượng tăng đúng, nhật ký ghi
  thêm dòng mới. `npx tsc --noEmit` sạch. Đã áp dụng y hệt cho `/admin/inventory/stock-status`.

## (v) Tab "Tiến độ sự kiện" (chi tiết đơn) — đã nối API thật cả 6 mốc; 3 điểm sai lệch shape thật vs comment cũ trong `types/order.ts` đã tự sửa

- **Màn liên quan**: `/manager/orders/[id]` (tab "Tiến độ sự kiện") — xem
  [`docs/tiendosukien_api.md`](tiendosukien_api.md) (mọi quyết định đã chốt ở mục 9.1, không còn mục
  nào chờ Product ngoại trừ 9.2 điểm 1 — giờ thực tế `schedule_plans`, xem dưới).
- **3 điểm shape thật khác comment cũ trong `types/order.ts` — đã tự sửa qua `curl` (2026-07-20), không
  phải gap cần Backend làm gì thêm**:
  1. `GET /orders/:id` trả field tên **`items`**, không phải `orderItems` như comment cũ giả định.
     Response cũng **không kèm** `orderWarnings`/`deposits`/`settlements` lồng sẵn — đã đổi 3 field này
     thành optional trên `OrderDetail`, gọi riêng qua `paymentApiService.getOrderDeposits()`/
     `settlementApiService.getOrderSettlement()` (2 endpoint này hoạt động đúng, xác nhận qua `curl`).
  2. `orders.created_by` (`Order.createdBy`) đã **join sẵn thành object** `{userId, fullName, role}` —
     khác hẳn comment cũ ("ID thô, cần Backend join thêm `createdByName`" — doc mục 2/9.1 điểm 3). Tin
     tốt: dùng thẳng `order.createdBy.fullName` làm "Điều phối viên" ở Mốc 1, không cần round-trip
     `GET /users/:id` như doc lo ngại.
  3. `PATCH /orders/:orderId/live-checklist` và `PUT /orders/:orderId/close` (2 endpoint doc mục 9.1
     điểm 1/2 đề xuất Backend làm) **đã được implement đầy đủ**, xác nhận qua `curl`: PATCH trả lại
     object checklist đầy đủ mới nhất (không có GET riêng — FE khởi tạo state ban đầu luôn là tất cả
     `false`, không có cách đọc lại state cũ nếu rời trang); PUT close đúng chặn 400 khi
     `orderStatus != COMPLETED` hoặc `paymentStatus != PAID` hoặc đã đóng rồi.
- **Việc còn lại đã ghi ở mục (f) (chưa đổi)**: Khảo sát hiện trường ở Mốc 2 vẫn placeholder — backend
  chưa seed `work_tasks` "Khảo sát hiện trường".
- **Gap còn mở, chưa tự chốt được (đúng doc mục 9.2 điểm 1)**: giờ bắt đầu/kết thúc **thực tế** của
  `schedule_plans` (khác giờ kế hoạch) — Mốc 3 hiện chỉ hiển thị read-only `startTime` kế hoạch từ
  `GET /schedule-plans?orderId=`, không có cột `actualStartTime`/`actualEndTime` nào để đọc thêm; hành
  động sửa/xóa/bắt đầu thuộc tab "Lịch trình & Kỹ thuật" (chưa tới lượt), không code ở đây.
  **Tin tốt phụ**: `GET /schedule-plans?orderId=` đã trả đúng `assignees[]` nhiều người/vai trò/SĐT thật
  (không phải `assigneeName` đơn như type cũ khai) — đã sửa `types/schedulePlan.ts` thêm field
  `assignees`, dùng hiển thị "Team Leader (Trưởng nhóm)"/"Technician (Kỹ thuật viên)" ở Mốc 3.
- **"N nhóm thiết bị" ở Mốc 1 (doc mục 8)**: vẫn chưa join category vào `orderItems` — đã đổi label
  UI sang "N hạng mục thiết bị" (đếm `order.items.length`) thay vì giả vờ đếm theo category, tránh số
  liệu sai. Giữ nguyên đề xuất Backend join `item.category` ở mục 8 nếu muốn khôi phục đúng ý nghĩa cũ.
- **Component tái sử dụng**: `src/components/orders/RecordSettlementModal.tsx` (mồ côi từ trước, đã
  viết sẵn đúng `settlementApiService.recordSettlement()`) giờ wire vào Mốc 5 — không cần viết lại.
- File đã sửa: `src/types/order.ts` (sửa `OrderDetail`, thêm `LiveShowChecklist`/
  `UpdateLiveChecklistPayload`/`CloseOrderPayload`, sửa `createdBy`), `src/services/order.service.ts`
  (thêm `updateLiveChecklist`/`closeOrder`), `src/types/schedulePlan.ts` (thêm `assignees`/`orderCode`/
  `customerName`/`eventName`), `src/services/mockAdapter.ts` (sửa `createdBy` mock khớp object mới),
  viết lại tab "lifecycle" ở `src/app/manager/orders/[id]/page.tsx` (đã mirror sang
  `src/app/admin/orders_audit/[id]/page.tsx`, chưa rà lại riêng theo phân quyền Admin read-only —
  ngoài phạm vi lần này, người dùng chỉ yêu cầu làm Manager).
- **Trạng thái**: Đã test bằng Playwright với backend thật đang chạy (đăng nhập `manager`/`123456`,
  đơn thật `ORD-001`) — mở tab "Tiến độ sự kiện" hiện đúng cả 6 mốc với dữ liệu thật (giá trị đơn,
  điều phối viên, cọc 800.000₫, lịch trình "Lắp đặt thiết bị" + 2 người phụ trách thật, checklist Live
  Show, quyết toán 800.000₫ DRAFT); bấm "Xác nhận đã nhận cọc" → gọi đúng
  `PUT /deposits/:id {status:'SUCCESS'}` thật, Mốc 2 chuyển "Hoàn thành", header đổi badge "Đã cọc",
  "Tiến độ chung" tăng từ 1/5 lên 2/5 — trạng thái lưu thật trong DB (còn nguyên sau khi tải lại trang).
  `npx tsc --noEmit` sạch, 0 lỗi console. Chưa test thao tác thật luồng Mốc 5 (lập/xác nhận quyết toán)
  và Mốc 6 (đóng đơn) trong phiên này — đã xác nhận đúng logic/endpoint qua `curl` riêng lẻ trước khi
  code, nhưng chưa bấm thật qua UI end-to-end.

## (w) Tab "Thiết bị & Kho hàng" (chi tiết đơn, chỉ Manager) — đã nối API thật bảng chính + Picklist; endpoint "confirm-prepared" không hoạt động đúng như tài liệu

- **Màn liên quan**: `/manager/orders/[id]` tab "Thiết bị & Kho hàng" — xem
  [`docs/thietbikhohang_api.md`](thietbikhohang_api.md) (mọi quyết định đã chốt ở mục 7.1). **Chỉ làm
  phía Manager theo yêu cầu người dùng** — chưa rà lại bản Admin (đúng ra phải read-only ở tầng backend
  theo mục 0/7.1 điểm 7, chưa xác nhận).
- **2 điểm shape thật khác comment cũ trong `types/order.ts` — đã tự sửa qua `curl` (2026-07-20)**:
  1. `OrderItem.itemName`/`unit` là field **top-level** trên mỗi phần tử, không phải lồng trong
     `item.itemName` như khai báo cũ — đã sửa type.
  2. **`preparedBy` hoàn toàn không xuất hiện trong response** `GET /orders/:id` dù
     `PATCH /orders/:orderId/items/:orderItemId` **có nhận** field này (xác nhận qua `curl`: PATCH
     `{preparedQty:1}` cập nhật thành công, đọc lại `GET /orders/:id` thấy `preparedQty` đổi nhưng
     không có field `preparedBy` nào trong response để đọc lại tên người phụ trách đã ghi, nếu có). Web
     hiện hiển thị "Chưa cập nhật" cho cột này. **Cần Backend bổ sung**: thêm field `preparedBy` vào
     response `GET /orders/:id` → `items[]` (đã có cột `order_items.prepared_by` theo doc mục 3, chỉ
     thiếu SELECT ra). **Input**: không đổi. **Output**: thêm `preparedBy?: string` vào mỗi phần tử
     `items[]`.
- **Tin tốt xác nhận qua `curl`**: `PATCH /api/v1/orders/:orderId/items/:orderItemId` (mục 2a doc,
  dành cho Leader Staff mobile) **đã hoạt động đúng** — test `{preparedQty:1}` cập nhật thành công,
  verify lại `GET /orders/:id` thấy `preparedQty` đổi từ 0 → 1. Không gọi endpoint này từ web (đúng
  quyết định Hướng B đã chốt — web chỉ đọc, Leader Staff mobile mới ghi).
- **Bug/gap thật phát hiện**: `PUT /api/v1/orders/:orderId/items/confirm-prepared` (mục 2b doc, dành
  cho Manager xác nhận cấp đơn) **không hoạt động như tài liệu mô tả** — test bằng `curl` với body
  `{}`/`{notes:...}` đều trả lỗi `VALIDATION_ERROR` yêu cầu field `items` dạng mảng (khớp payload của
  `PUT /orders/:id/items` — endpoint thay TOÀN BỘ danh sách item — không khớp payload `{notes?}` mà
  doc mục 2b đề xuất). Nhiều khả năng route `confirm-prepared` **chưa được implement riêng**, request
  đang bị 1 route khác (`PUT /orders/:orderId/items`) bắt nhầm. Đã khóa nút "Xác nhận đã chuẩn bị xong"
  trên UI (disabled + tooltip trỏ tới mục này) thay vì gọi 1 API không hoạt động đúng. **Cần Backend**:
  implement đúng route `PUT /api/v1/orders/:orderId/items/confirm-prepared` theo mô tả doc mục 2b
  (`{notes?: string}` → xác nhận khi mọi dòng `preparedQty = quantity`, ghi `items_confirmed_at`/
  `items_confirmed_by`), tách biệt khỏi route `PUT /orders/:orderId/items` hiện có.
- **Tin tốt khác**: bảng `inventory` (đã xác nhận tồn tại thật ở mục (u)) cho phép hiện lại cột "Tồn
  kho khả dụng" ở modal Picklist mà doc gốc dự tính phải ẩn (viết trước khi phát hiện bảng này tồn tại)
  — đã bật cột này, đọc qua `inventoryApiService.getInventory({itemId})` cho từng hạng mục.
- File đã sửa: `src/types/order.ts` (sửa `OrderItem`), viết lại tab "items" +
  modal Picklist ở `src/app/manager/orders/[id]/page.tsx` (chỉ phía Manager, chưa mirror sang Admin).
- **Trạng thái**: Đã test bằng Playwright với backend thật đang chạy (đơn `ORD-001`) — tab hiện đúng 2
  hạng mục thật (Loa JBL 1000W 1/2 đã bàn giao — khớp đúng lần PATCH thử qua `curl` trước đó; Đèn Beam
  230 0/2), giá tiền/tổng cộng đúng; mở "Xem phiếu chuẩn bị" hiện đúng tồn kho khả dụng thật (8, 12).
  `npx tsc --noEmit` sạch, 0 lỗi console.

## (x) Tab "Lịch trình & Kỹ thuật" (chi tiết đơn, chỉ Manager) — đã nối API thật đầy đủ, không phát sinh gap mới ngoài các mục đã ghi ở (f)

- **Màn liên quan**: `/manager/orders/[id]` tab "Lịch trình & Kỹ thuật" — xem
  [`docs/lichtrinhkythuat_api.md`](lichtrinhkythuat_api.md) (mọi quyết định đã chốt ở mục 10.1, mục
  10.2 "không còn mục nào" — tài liệu tự nhận là đầy đủ nhất trong các tài liệu API đã viết).
- **Tin tốt xác nhận qua `curl` (2026-07-20)**: `GET /schedule-plans?orderId=` đã trả **đủ mọi field**
  doc yêu cầu — `taskName` join sẵn, `assignees[]` đa phân công thật kèm `role`/`phone` join sẵn (đúng
  hướng đã chốt mục 4 điểm 9, không cần round-trip `GET /users/:id`), và còn tốt hơn dự tính: mỗi
  assignee có luôn `checkInAt`/`checkOutAt` **theo từng người** — thay thế trực tiếp nhu cầu
  "actual_start_time/actual_end_time" mà doc mục 1/10.1 điểm 10 đề xuất thêm cột mới (Backend đã hiện
  thực theo hướng chi tiết hơn: giờ thực tế gắn với **từng người** trong `schedule_plan_assignees`,
  không phải 1 cặp giờ chung cho cả `schedule_plans`) — **không cần Backend làm gì thêm cho điểm này**,
  chỉ cần cập nhật lại `docs/tiendosukien_api.md` mục 9.2 điểm 1 (đã đóng, không còn là câu hỏi mở).
  `PATCH /schedule-plans/:id/status {status:'CONFIRMED'}` đã test đúng validate ("Chỉ có thể xác nhận
  kế hoạch đang ở trạng thái PENDING").
- **Đã nối thật**: danh sách nhiều `schedule_plans` (bỏ hẳn `.find()` lấy 1 plan), badge theo đúng
  `ScheduleStatus` thật (5 giá trị, có `CANCELLED`), người/đội phụ trách hiện đủ tên/vai trò/SĐT/
  check-in-out thật, nút "Xác nhận kế hoạch" (`PENDING → CONFIRMED`), nút "Hủy" (`* → CANCELLED`, điều
  kiện `status ∉ {IN_PROGRESS, COMPLETED, CANCELLED}`), nút "Xem ảnh minh chứng" (`GET /evidence/:id`
  khi `evidenceId` có giá trị, khác `null` mới hiện nút). Nút "Bắt đầu làm việc"/"Tải ảnh thi công" đã
  bỏ hẳn khỏi web (đúng ranh giới vai trò đã chốt — hành động Leader Staff mobile).
- **Chưa xử lý (đúng phạm vi doc, không phải gap mới)**: nút "Sửa" chỉ điều hướng sang
  `/manager/schedule/plans` (chưa truyền `?planId=`, vì trang đó chưa có tài liệu/implement riêng —
  ngoài phạm vi). Danh mục loại việc vẫn thiếu "Khảo sát hiện trường"/"Vận chuyển thiết bị" — đã ghi ở
  mục (f), không lặp lại.
- File đã sửa: viết lại tab "plans" ở `src/app/manager/orders/[id]/page.tsx` (chỉ phía Manager, chưa
  mirror sang Admin theo yêu cầu người dùng).
- **Trạng thái**: Đã test bằng Playwright với backend thật đang chạy (đơn `ORD-001`, plan
  "Lắp đặt thiết bị" đang `IN_PROGRESS`) — thẻ hiện đúng `LICH-001`, ngày/giờ/địa điểm thật, 2 người
  phụ trách thật (Team Leader/Technician) kèm SĐT + check-in thật; nút "Xác nhận kế hoạch"/"Hủy" đúng
  bị ẩn (vì status đã `IN_PROGRESS`, không còn `PENDING`); modal "Xem chi tiết" hiện đúng dữ liệu thật.
  `npx tsc --noEmit` sạch, 0 lỗi console. Chưa test được thao tác thật nút "Xác nhận kế hoạch"/"Hủy"/
  "Xem ảnh minh chứng" (dữ liệu mẫu hiện tại không có plan nào ở `PENDING` hoặc `COMPLETED` có
  `evidenceId` để bấm thử) — đã xác nhận đúng endpoint/payload qua `curl` riêng lẻ trước khi code.

## (y) Tab "Báo giá & Hợp đồng" (chi tiết đơn, chỉ Manager) — tin tốt bất ngờ: endpoint liên kết/hủy liên kết doc đánh dấu "CHƯA CHỐT shape" hóa ra ĐÃ hoạt động thật; workaround cho bug (p.1) vẫn còn

- **Màn liên quan**: `/manager/orders/[id]` tab "Báo giá & Hợp đồng" — xem
  [`docs/baogiavahopdong_api.md`](baogiavahopdong_api.md) (đã chốt Hướng A bỏ "Hợp đồng" ở mục 1.1,
  giữ tính năng liên kết/hủy liên kết ở mục 1.2/5.1, nhưng mục 5.2 điểm 2 ghi rõ "shape endpoint CHƯA
  CHỐT" cho `PATCH /orders/:orderId/quotation`).
- **Tin tốt xác nhận qua `curl` (2026-07-20)**: `PATCH /api/v1/orders/:orderId/quotation`
  `{quotationId: string | null}` — endpoint mà doc mục 2 #4/5.2 điểm 2 đánh dấu "chỉ là gợi ý minh
  họa, chưa chốt, Backend có thể chọn shape khác" — **đã được implement đúng y hệt shape đề xuất**,
  test thật (gửi lại đúng `quotationId` hiện có) trả về `Order` đầy đủ đã cập nhật. Không cần chờ
  Backend xác nhận thêm cho điểm này — đã nối thẳng qua `orderApiService.updateOrderQuotation()`
  (method mới, thêm vào `order.service.ts`).
- **Workaround cho bug đã biết (mục (p.1))**: `GET /customers/:customerId/quotations` (đề xuất ở doc
  mục 2 #3 để đếm số báo giá `APPROVED` của khách hàng — điều kiện enable nút "Hủy liên kết", mục 1.2)
  **vẫn lỗi thật y hệt mục (p.1)** ("customerId: expected string, received undefined"), chưa được
  Backend sửa. Đã dùng **workaround khác**: `GET /api/v1/quotations?customerId=:id` (endpoint phẳng,
  đã nối thật ở "Danh sách báo giá") — `meta.counts.approved` của response này chính là số báo giá
  `APPROVED` của khách hàng đó (đã verify: counts không đổi theo filter `status`, luôn phản ánh tổng
  theo `customerId`), dùng thay cho endpoint bị lỗi, không cần Backend sửa gấp mục (p.1) chỉ để phục
  vụ tab này (dù vẫn nên sửa cho các nơi khác cần dùng endpoint đó).
- **Đã tự quyết cách xác định "báo giá có thể liên kết"** (doc mục 3 dòng cuối, `linkableQuotations`):
  vì `QuotationListItem` (danh sách phẳng) không có field `linkedOrderId`, đã tự làm N+1 nhỏ — lấy
  danh sách báo giá `APPROVED` của khách hàng (thường 1-2 báo giá/khách, chấp nhận được), gọi chi tiết
  từng cái (`GET /quotations/:id`, có `linkedOrderId`) để lọc ra báo giá **chưa** gắn đơn nào.
- **Đã bỏ hẳn khối "Hợp đồng liên kết"** (dòng `HD2507-001` + nút "Xem hợp đồng"/"Tạo hợp đồng") đúng
  Hướng A đã chốt ở `docs/danhsachhopdong_api.md` — khi `order.quotationId` khác `null`, chính đơn
  đang xem là "hợp đồng", không có gì khác để xem/tạo thêm.
- **"Giá trị giao kèo" đọc đúng `quotation.totalAmount`** (chốt lúc duyệt báo giá, `1.600.000₫` khớp
  dữ liệu mẫu), không dùng `order.totalAmount` (có thể đổi sau qua Change Request) — đúng quyết định
  đã chốt ở doc mục 3/5.1.
- File đã sửa: `src/types/order.ts` (thêm `UpdateOrderQuotationPayload`), `src/services/order.service.ts`
  (thêm `updateOrderQuotation`), viết lại tab "quotation" ở `src/app/manager/orders/[id]/page.tsx`
  (chỉ phía Manager, chưa mirror sang Admin — theo yêu cầu người dùng; doc mục 0 cũng khuyến nghị bản
  Admin nên read-only cho tab này, chưa áp dụng).
- **Trạng thái**: Đã test bằng Playwright với backend thật đang chạy (đơn `ORD-001`, báo giá `QUO-001`)
  — tab hiện đúng mã/phiên bản/badge "Đã duyệt"/giá trị giao kèo thật; nút "Hủy liên kết" đúng bị khóa
  kèm tooltip "Khách hàng chỉ có 1 báo giá đã duyệt, không thể hủy liên kết" (khách hàng thật chỉ có 1
  báo giá `APPROVED`). `npx tsc --noEmit` sạch, 0 lỗi console. Chưa test được thao tác thật nút "Liên
  kết ngay"/"Hủy liên kết" khi đủ điều kiện (dữ liệu mẫu hiện tại không có khách hàng nào có > 1 báo
  giá `APPROVED` để bấm thử) — đã xác nhận đúng endpoint qua `curl` riêng lẻ trước khi code.

## (z) Màn "Đặt cọc" (`/manager/payments/deposits`, `/admin/orders_audit/payments` + `[id]`) — đã nối API thật; re-test qua curl 2026-07-21 phát hiện 2 điểm khác doc gốc `docs/datcoc_api.md`

- **Màn liên quan**: xem [`docs/datcoc_api.md`](datcoc_api.md) (viết 2026-07-20, đã cập nhật lại đúng
  trạng thái mới nhất trong lần nối này).
- **2 phát hiện khác doc gốc (backend đã đổi hành vi giữa 2 ngày, hoặc doc gốc ghi chưa đúng)**:
  1. **Tin tốt**: `POST /orders/:id/deposits` giờ **đã nhận và lưu đúng `dueDate`** — doc gốc mục 4.2
     ghi "không có cách set hạn thanh toán qua API" khi test lần đầu, nay test lại đã hoạt động (đã
     thêm `dueDate?: string` vào `CreateOrderDepositPayload`, dùng trong form tạo yêu cầu cọc mới).
  2. **Tin xấu hơn doc gốc**: doc mục 4.5 ghi "`notes` chỉ được lưu khi `status: 'SUCCESS'`" — re-test
     kỹ hơn (tạo hồ sơ mới không có notes, PUT `status:'SUCCESS'` kèm `notes` mới) xác nhận **`notes`
     KHÔNG lưu ở bất kỳ status nào qua `PUT /deposits/:id`**, không riêng gì `CANCELLED`. `amount`/
     `evidenceId` vẫn bị bỏ qua như doc gốc ghi. Tức `PUT` chỉ thật sự ghi được đúng 1 field: `status`.
  3. **Xác nhận role đã bị chặn ở backend** (doc mục 7 để ngỏ câu hỏi "chưa thử token ADMIN"): test qua
     `curl` với token `admin` — cả `POST /orders/:id/deposits` và `PUT /deposits/:id` đều trả `403
     FORBIDDEN`. Vì vậy trang Admin **cố tình bỏ hẳn** mọi nút tạo/xác nhận/hủy (`canManage={false}`),
     không phải thiếu sót — nếu giữ nút như bản mock cũ, Admin bấm sẽ luôn gặp lỗi 403.
- **Kiến trúc đã chọn khi nối**:
  - Không có `GET /api/v1/deposits` gộp toàn hệ thống (vẫn 404) — danh sách dùng N+1 tạm thời: `GET
    /orders` (≤100) + `GET /orders/:id/deposits` cho từng đơn (lấy hồ sơ mới nhất theo `createdAt` để
    hiển thị ở bảng), cùng kỹ thuật N+1 trên `GET /quotations?status=approved` + `GET /quotations/:id`
    (đọc `linkedOrderId`) để suy ra báo giá đã duyệt nhưng chưa tạo đơn — tái dùng đúng pattern đã có ở
    `manager/orders/[id]/page.tsx` (mục y). Gắn `TODO(perf)` rõ ràng trong code, không chặn demo ở quy
    mô hiện tại (7 đơn).
  - `GET /orders/:id/deposits` trả **mảng, có thể nhiều hồ sơ/đơn** (đúng mục 4.6 doc gốc) — trang chi
    tiết hiển thị dạng **lịch sử** (mới nhất lên đầu) thay vì giả định chỉ 1 hồ sơ, mỗi hồ sơ `PENDING`
    có nút Xác nhận/Hủy riêng. Nút "Tạo yêu cầu cọc mới" bị khóa khi đang có hồ sơ `PENDING` (tự chọn,
    Product chưa chốt nghiệp vụ này — tránh tạo trùng nhiều yêu cầu đang chờ cùng lúc).
  - Bỏ hẳn UI "sửa số tiền cọc"/"gắn chứng từ" (không có endpoint thật hoàn tất) — đúng khuyến nghị mục
    4.2/4.3 của doc gốc. **Giữ nguyên khối "Cổng thanh toán VietQR"** (mã QR minh họa, không phải cổng
    thật — đúng hành vi mock cũ, người dùng yêu cầu giữ lại khi review) thay vì bỏ như đề xuất ban đầu ở
    mục 4.4 — giờ gắn theo hồ sơ cọc `PENDING` gần nhất (hoặc hồ sơ mới nhất nếu không còn cái nào
    `PENDING`) do trang giờ hiển thị nhiều hồ sơ/đơn thay vì 1.
  - Bổ sung `OVERDUE: 'error'` vào `getStatusBadgeVariant` (`components/ui/Badge.tsx`, trước đó thiếu),
    thêm `src/constants/deposit-status.ts` (nhãn 4 trạng thái thật + danh sách phương thức thanh toán)
    dùng chung cho cả list/detail, cả 2 role.
- **File đã thêm/sửa**: `src/constants/deposit-status.ts` (mới), `src/components/payments/{DepositListView,DepositDetailView}.tsx`
  (mới — dùng chung cho cả 4 trang, tham số hóa `detailBasePath`/`quotationBasePath`/`canManage`),
  4 trang `manager/payments/deposits/{page,[id]/page}.tsx` + `admin/orders_audit/payments/{page,[id]/page}.tsx`
  viết lại thành wrapper mỏng gọi 2 component trên, `src/types/payment.ts` (thêm `dueDate` vào payload
  tạo + sửa comment theo phát hiện mới), `src/components/ui/Badge.tsx` (thêm `OVERDUE`).
- **Trạng thái**: Đã re-test toàn bộ endpoint dùng qua `curl` với backend thật đang chạy (login
  `manager`/`admin`, tạo hồ sơ cọc thật `DEP-002`/`DEP-003`/`DEP-004` trên `ORD-002`/`ORD-005`/`ORD-006`
  để xác nhận hành vi tạo/xác nhận/khóa 1 chiều/đồng bộ `paymentStatus` — **nếu đây là DB dùng chung
  demo/staging, 3 bản ghi này cần dọn lại**, cùng lý do doc gốc đã nêu). Đã mô phỏng đúng chuỗi gọi
  N+1 mà `DepositListView` sẽ thực hiện (7 đơn + 7 báo giá đã duyệt, toàn bộ đã có đơn liên kết nên
  khối "báo giá chờ tạo đơn" hiện đang rỗng — đúng dữ liệu thật, không phải lỗi). `npx tsc --noEmit`
  sạch. Chưa test bằng trình duyệt thật (không có tool browser trong phiên này).

## (aa) Màn "Kế hoạch và phân công" + "Lịch timeline" + modal "Chi tiết kế hoạch" — đã nối API thật cả 3; hầu hết đề xuất "chưa chốt" ở cả 3 doc hóa ra ĐÃ được Backend làm; 2 gap còn lại (join "người lập", bug PUT)

- **Màn liên quan**: [`docs/kehoachvaphancong_api.md`](kehoachvaphancong_api.md), [`docs/lichtimeline_api.md`](lichtimeline_api.md),
  [`docs/chitietkehoach_api.md`](chitietkehoach_api.md) — cả 3 cùng phân tích 1 trang `/manager/schedule/plans`
  (mirror `/admin/coordination/planning`), viết lại 1 lần.
- **Tin tốt bất ngờ (2026-07-21, test lại bằng `curl`)**: gần như toàn bộ đề xuất "chưa chốt/cần Backend
  xác nhận" ở cả 3 tài liệu đã được triển khai thật:
  1. `GET /schedule-plans` không truyền `orderId` trả về **toàn bộ** đơn (không bắt buộc `orderId`), đã
     join sẵn `orderCode`/`customerName`/`eventName`/`eventDate`/`orderLocation`/`taskName`/`assignees[]`
     (kèm `checkInAt`/`checkOutAt` — vượt cả yêu cầu ban đầu).
  2. `dateFrom`/`dateTo` hoạt động đúng, lọc theo khoảng ngày như đề xuất.
  3. `work_tasks` đã được seed thêm 2 dòng mới: `TSK-SURVEY` ("Khảo sát hiện trường") và `TSK-COLLECT`
     ("Thu hồi thiết bị") — chỉ còn thiếu "Vận chuyển thiết bị" so với 4 loại hoạt động UI cần.
  4. `POST /schedule-plans/:id/assignees` (gán người, đã ghi nhận ở comment `types/schedulePlan.ts`
     trước đó) hoạt động đúng, trả lại full `SchedulePlan` kèm `assignees[]` mới.
- **2 gap còn lại, chưa có API/còn bug**:
  1. **"Người lập" (docs/chitietkehoach_api.md mục 2.2/4.1)**: dù đã chốt hướng dùng `orders.created_by`,
     field này **chưa được join sẵn** vào response `GET /schedule-plans` — trang hiện đa đơn (nhiều đơn
     cùng lúc, không có ngữ cảnh 1 đơn bao quanh) nên gọi thêm `GET /orders/:id` riêng cho từng đơn chỉ để
     lấy 1 field là N+1 không hợp lý. Đề xuất: Backend join thêm `createdByName` (từ `orders.created_by`
     → `users.full_name`) vào response `GET /schedule-plans`, giống cách đã join `orderCode`/`customerName`.
     Hiện hiển thị in nghiêng "chưa có API" ở modal chi tiết.
  2. **Bug thật**: `PUT /schedule-plans/:id` báo lỗi validate (`startTime: expected date, received Date`)
     nếu payload không kèm `startTime`, dù tài liệu describe đây là partial update (chỉ sửa field muốn
     đổi). Test xác nhận: gửi `{"notes": "..."}` → lỗi; gửi kèm `startTime` (dù không đổi giá trị) → OK.
     Workaround FE: luôn gửi kèm `startTime` hiện tại của dòng trong mọi lần gọi `PUT`. Backend nên sửa
     validator cho phép thiếu `startTime` khi không cần đổi.
- **Quyết định kiến trúc áp dụng khi nối**: viết `src/utils/schedulePlanGroups.ts` — nhóm dữ liệu phẳng
  `schedule_plans` thành "1 kế hoạch/1 đơn" (đúng phát hiện cốt lõi mục 1 của `docs/kehoachvaphancong_api.md`),
  dùng chung cho 3 tab (Lịch điều phối/Lịch timeline/Danh sách) + 2 drawer (chi tiết/lập-sửa kế hoạch).
  Gộp "hoạt động" + "công việc" thành 1 danh sách theo quyết định đã chốt ở `docs/chitietkehoach_api.md`
  mục 6.3. Bỏ `PLANNING_STAFF_POOL` (đổi sang chọn user thật role LEADER/TECHNICAL), bỏ tên việc tự do
  (đổi sang `task_id` + `notes`), bỏ luồng "đơn đặt ảo từ báo giá" (chờ Backend thêm cột
  `schedule_plans.quotation_id` — chưa có route nào trỏ vào đây kèm `quotationId` nên đã gỡ hẳn nhánh
  code cũ thay vì để dở dang).
- **File đã sửa**: `src/types/schedulePlan.ts`, `src/utils/schedulePlanGroups.ts` (mới),
  `src/components/planning/{PlanDetailDrawer,PlanFormDrawer}.tsx`,
  `src/app/{manager/schedule/plans,admin/coordination/planning}/page.tsx`,
  `src/app/manager/field-ops/progress/page.tsx` (trang khác dùng chung `PlanDetailDrawer` cũ theo shape
  mock — tách 1 panel xem nhanh cục bộ để không phá vỡ trang đó).
- **Trạng thái**: `npx tsc --noEmit` sạch; `curl` xác nhận toàn bộ luồng CRUD thật hoạt động đúng trên
  `ORD-001` (tạo dòng, gán người, sửa, xác nhận, hủy). Chưa test bằng trình duyệt thật (không có tool
  browser trong phiên này).

## (ab) Màn "Pick-list xuất kho" (`/manager/inventory/picklists`) — 2 endpoint đề xuất ở `docs/picklistxuatkho_api.md` VẪN CHƯA được Backend implement (test lại 2026-07-21)

- **Màn liên quan**: [`docs/picklistxuatkho_api.md`](picklistxuatkho_api.md).
- Khác các màn khác gần đây (kehoachvaphancong, lịch timeline, chi tiết kế hoạch) — nơi phần lớn đề xuất
  hóa ra Backend đã âm thầm triển khai — màn này re-test bằng `curl` xác nhận **chưa có gì mới**:
  1. `GET /api/v1/orders/picklists` → `404 {"code":"NOT_FOUND","message":"Order not found"}` (route
     `/orders/:id` khớp nhầm `"picklists"` thành `:id`, xác nhận route riêng chưa tồn tại).
  2. `GET /api/v1/orders/:id` (đơn thật `ORD-001`) không có field `pickedUpAt`/`pickedUpByName`/
     `itemsConfirmedAt` trong response — 2 cột `orders.picked_up_at`/`picked_up_by` (doc mục 4) và cột
     `items_confirmed_at` (tham chiếu từ `docs/thietbikhohang_api.md` mục 2b, cũng chưa có — xem mục (w))
     đều chưa được thêm vào schema.
- **Đã xử lý theo đúng nguyên tắc "phần nào chưa có API thì in nghiêng + ghi chú"**: trang vẫn hiển thị
  đầy đủ dữ liệu thật hiện có (danh sách đơn CONFIRMED/IN_PROGRESS, số lượng/đã chuẩn bị từng đơn qua
  `GET /orders/:id`, "Điều phối viên" qua `GET /schedule-plans` theo đúng hướng đã chốt ở doc mục 3.4)
  — riêng cột "Trạng thái xuất kho" + nút "Đã xuất kho" hiển thị in nghiêng "Chưa có API" (nút khóa hẳn),
  và KPI "Sẵn sàng xuất kho" đổi tên thành "(ước tính)" vì phải tạm tính `SUM(preparedQty) >=
  SUM(quantity)` phía client thay vì dựa vào cột `items_confirmed_at` như doc khuyến nghị.
- **Cần Backend làm** (nhắc lại nguyên trạng doc mục 7.1, chưa có gì thay đổi):
  1. `GET /api/v1/orders/picklists` (list + KPI, mục 5.1).
  2. `PUT /api/v1/orders/:orderId/picklist/picked-up` (mục 5.2).
  3. 2 cột `orders.picked_up_at`/`orders.picked_up_by` (mục 4).
- File đã sửa: `src/app/manager/inventory/picklists/page.tsx` (viết lại toàn bộ).
- **Trạng thái**: `npx tsc --noEmit` sạch; `curl` xác nhận route `/manager/inventory/picklists` trả về
  HTTP 200. Chưa test bằng trình duyệt thật (không có tool browser trong phiên này).

## (ac) Màn "Thu hồi & hoàn kho" (`/manager/inventory/returns`, `/admin/inventory/returns`) — re-test 2026-07-21 xác nhận VẪN CHƯA nối được, đúng như doc đã tự đánh dấu "⛔ chưa cần làm ngay"

- **Màn liên quan**: [`docs/thuhoi_hoankho_api.md`](thuhoi_hoankho_api.md).
- Khác toàn bộ các màn đã re-test gần đây (phần lớn hóa ra Backend đã âm thầm làm xong) — màn này xác
  nhận lại đúng y hệt trạng thái doc đã ghi ngày 2026-07-20, không có gì mới:
  1. `GET /api/v1/inventory/return-reports` → `404 {"code":"NOT_FOUND","message":"Inventory record not
     found for this item"}` — lỗi này cho thấy route khớp nhầm vào `/inventory/:itemId` (coi
     `"return-reports"` là 1 `itemId`), xác nhận route riêng thật sự không tồn tại.
  2. `POST /api/v1/inventory/return-reports` → `404 {"code":"NOT_FOUND","message":"Route not found: POST
     /api/v1/inventory/return-reports"}` — lỗi rõ ràng, không mơ hồ như trên.
  3. Bảng `inventory` (khác với `collected_equipment_reports`) **đã tồn tại thật** (dùng được ở màn "Tồn
     kho doanh nghiệp", mục (u)) — nhưng 2 bảng `collected_equipment_reports`/`collected_equipment_report_items`
     mà toàn bộ 4 endpoint của màn này phụ thuộc (doc mục 1/7) vẫn chưa được tạo.
- **Quyết định**: không sửa gì ở 2 trang `manager/inventory/returns` + `admin/inventory/returns` (giữ
  nguyên 100% mock `adminInventoryReturnsMock.ts`) — vì không có API thật nào để gọi (khác các màn khác
  nơi luôn có ít nhất 1 phần dữ liệu thật để nối), và chính tài liệu API cũng khuyến nghị "⛔ CHƯA CẦN
  BACKEND LÀM NGAY" cho toàn bộ nội dung. Đổi UI sang gọi API không tồn tại sẽ phá vỡ 1 demo đang chạy
  được mà không thay thế bằng gì thật.
- **Nhắc lại thứ tự ưu tiên khi Backend rảnh tay** (đã có ở doc mục 9.1/9.2, không đổi): (1) tạo 2 bảng
  `collected_equipment_reports`/`collected_equipment_report_items`; (2) `GET /inventory/return-reports`
  (list); (3) `GET /inventory/return-reports/:id` (detail); (4) `POST` (tạo, khuyến nghị chuyển hẳn sang
  mobile Leader Staff — doc mục 3); (5) `PUT .../confirm` (làm sau cùng, phụ thuộc cả bảng `inventory`
  đã có sẵn để cộng/trừ tồn kho thật khi xác nhận).
- **Trạng thái**: không có thay đổi code. Xác nhận lại bằng `curl` với backend thật đang chạy
  (2026-07-21).

## (ad) Màn "Nhà cung cấp" (`/admin/suppliers`, `/manager/suppliers`) — re-test 2026-07-21 xác nhận module Supplier VẪN CHƯA được mount trên backend

- **Màn liên quan**: [`docs/supplier_api.md`](supplier_api.md).
- Test lại toàn bộ endpoint doc gốc đã liệt kê (mục 6.0) + thử thêm vài biến thể tên phòng trường hợp
  Backend đổi path — **tất cả đều 404 `"Route not found"`**, không có gì mới so với lần test
  2026-07-20:
  - `GET/POST /api/v1/suppliers`, `GET /api/v1/suppliers/:id`, `GET /api/v1/supplier-transactions`
    (đúng 4 route doc gốc đã test).
  - Thử thêm: `/api/v1/supplier` (số ít), `/api/v1/procurement`, `/api/v1/procurement/purchase-orders`,
    `/api/v1/purchase-orders`, `/api/v1/supplier-transactions?supplierId=1` — **cũng 404 cả**.
- Đối chứng `GET /api/v1/orders` vẫn trả 401 (route tồn tại, chỉ thiếu token) — xác nhận lại kết luận
  của doc gốc: đây là router chưa mount, không phải lỗi quyền hay lỗi gọi sai tham số.
- **Quyết định**: không sửa 2 trang `admin/suppliers`/`manager/suppliers` — giữ nguyên 100% mock
  (`mocks/db/suppliers.ts`), cùng lý do đã áp dụng ở mục (ac) — không có API thật nào để nối, kể cả
  1 phần nhỏ (khác pick-list/kế hoạch nơi luôn có dữ liệu `orders`/`schedule-plans` thật để tận dụng).
- **Khuyến nghị lặp lại từ doc gốc, ưu tiên cao nhất**: Backend cần xác nhận trước tiên liệu module
  Supplier có đang phát triển ở nhánh/máy khác chưa deploy lên server test này, hay thực sự chưa bắt
  đầu implement — quan trọng hơn việc đối chiếu tên cột/enum chi tiết (doc gốc mục 0).
- **Trạng thái**: không có thay đổi code. Xác nhận lại bằng `curl` với backend thật đang chạy
  (2026-07-21).

## (ae) Chấm công theo `schedule_plan_assignees` (check-in/check-out từng người) — endpoint ghi chưa xác nhận hoạt động, model FE cũ lệch schema thật, chưa chốt nghiệp vụ tự chuyển trạng thái

- **Màn liên quan**: khối "Lịch thi công & đơn vị phụ trách kỹ thuật" (tab "Lịch trình & Kỹ thuật",
  `/manager/orders/[id]`) — xem [`docs/lichtrinhkythuat_api.md`](lichtrinhkythuat_api.md) mục 0/1/6/7 —
  và rộng hơn là nghiệp vụ **Chấm công (Attendance)** ở CLAUDE.md mục 1 (2 lớp xác nhận trước khi tính
  lương: Technical Staff tự check-in → Leader Staff xác nhận điểm danh & hoàn thành việc → Manager xác
  nhận tổng hợp công/lương cuối cùng).
- **Schema thật do người dùng cung cấp (2026-07-21), khác hẳn giả định cũ ở `src/types/attendance.ts`**:

  ```text
  attendances: attendance_id PK, assignee_id (FK → schedule_plan_assignees.assignee_id),
    check_in_at, check_in_evidence_id, check_out_at, note, created_at, updated_at
  schedule_plan_assignees: assignee_id PK, plan_id, user_id, role ENUM('LEAD','TECHNICAL'),
    notes, created_at
  ```

  Tức 1 dòng `attendances` gắn với **1 dòng `schedule_plan_assignees`** (1 người trong 1 plan cụ thể),
  không phải gắn trực tiếp `planId`+`userId` như `src/types/attendance.ts` hiện khai báo
  (`attendanceId, planId, userId, checkInAt, checkInEvidenceId, checkOutAt, note...`). Type FE này viết
  từ nguồn `D:\bnwems-backend-api` — **backend sai**, đã bị cảnh báo lỗi thời ở đầu file này (dòng
  7-19) — cần viết lại theo đúng `assignee_id` làm khóa liên kết.

  - **Tin đã xác nhận qua curl thật (2026-07-20/21)**: chiều **đọc** đã hoạt động đúng — mỗi phần tử
    `assignees[]` trong response `GET /api/v1/schedule-plans` đã có sẵn `checkInAt`/`checkOutAt` theo
    từng người (xem `src/types/schedulePlan.ts:35`, mục (aa) ở trên) — khớp đúng việc join
    `schedule_plan_assignees` ⋈ `attendances` theo `assignee_id`. Không cần Backend làm gì thêm cho
    chiều đọc này.
  - **Chưa xác nhận — chiều ghi**: `POST /attendance/check-in`/`PUT /attendance/:id/check-out` (khai ở
    `src/attendance.service.ts`) test route surface ngày 2026-07-20 (cảnh báo đầu file) cho kết quả
    `/attendance` **404 — chưa mount** trên backend đang chạy, cùng nhóm thiếu với `/suppliers`/
    `/evidence`/`/wages`. Chưa có lần re-test nào sau đó (khác các module khác đã re-test 2026-07-21)
    xác nhận lại route này — **cần Backend xác nhận hiện trạng** (đã mount chưa, có khớp payload đề xuất
    dưới đây không).
- **Payload đề xuất cần Backend xác nhận/implement, viết lại theo đúng `assignee_id`** (thay hẳn
  `planId`+`userId` cũ):

  1. `POST /api/v1/attendance/check-in` — body `{ assigneeId: string, checkInAt: string, checkInEvidenceId?: string }`
     (`assigneeId` = `schedule_plan_assignees.assignee_id` của đúng người + đúng plan đang check-in, **không
     phải** `userId`). Trả lại `Attendance` vừa tạo. Backend nên validate: người gọi (`userId` suy từ
     token) phải trùng `schedule_plan_assignees.user_id` của `assigneeId` gửi lên (không cho check-in hộ),
     và 1 `assigneeId` chỉ tạo được 1 `attendances` (như comment cũ `@@unique` đã ghi, cần xác nhận còn
     giữ đúng ràng buộc này với schema mới).
  2. `PUT /api/v1/attendance/:attendanceId/check-out` — body `{ checkOutAt: string, note?: string }`,
     giữ nguyên như type cũ (không đổi theo `assignee_id` vì đã có `attendanceId` từ bước check-in).
  3. **Endpoint mới, chưa từng đề xuất**: `GET /api/v1/attendance?assigneeId=` hoặc
     `GET /api/v1/schedule-plans/:id/attendance` (Backend chọn 1 trong 2, hoặc dùng luôn `assignees[]` đã
     join sẵn nếu đủ) — dùng cho màn hình tổng hợp công/lương cuối tháng (Manager xác nhận tổng hợp), vì
     `checkInAt`/`checkOutAt` join theo từng plan hiện tại chưa đủ để truy vấn theo khoảng thời gian
     (tháng) xuyên nhiều plan/nhiều đơn cho 1 nhân sự — **chưa có tài liệu/màn hình nào ở FE cho bước
     tổng hợp lương này**, ngoài phạm vi các mục đã ghi ở file này.
- **Đã chốt hướng nghiệp vụ (2026-07-21, xác nhận bởi người dùng)** — thay cho câu hỏi mở trước đây: bạn
  mô tả "khi nhân viên check-in thì `schedule_plans.status` tự chuyển `IN_PROGRESS`, check-out thì tự
  chuyển `COMPLETED`" mâu thuẫn với tài liệu cũ (`docs/lichtrinhkythuat_api.md` mục 0/6, mô tả 2
  transition này là mobile tự gọi `PATCH /schedule-plans/:id/status {status:'IN_PROGRESS'|'COMPLETED'}`,
  tách biệt hoàn toàn khỏi `attendances`) — nay **đã chốt chọn hướng (2)**: `status` **tự suy ra** từ
  `attendances`, không còn là transition Leader tự gọi tay cho 2 giá trị này.

  **Quy tắc chốt cho trường hợp nhiều `assignee` trên cùng 1 plan** (câu hỏi "lấy mốc giờ của ai khi có
  nhiều `TECHNICAL` check-in/out lệch nhau"): **chỉ lấy theo người có `role = 'LEAD'`** trên plan đó, bỏ
  qua giờ check-in/out của các `TECHNICAL` khi suy ra `status` — cụ thể:
  - Nếu plan chỉ có **1 assignee** (bất kể `LEAD` hay `TECHNICAL`) → lấy check-in/out của đúng người đó.
  - Nếu plan có **nhiều assignee** → **chỉ** lấy check-in/out của assignee có `role = 'LEAD'` làm mốc,
    check-in/out của các `TECHNICAL` khác **không ảnh hưởng** tới `status` của plan (vẫn lưu bình thường
    trong `attendances` để phục vụ chấm công/tính lương cá nhân — mục đích khác, không liên quan `status`).

  **Suy ra cụ thể**: `status` (chỉ 2 giá trị `IN_PROGRESS`/`COMPLETED` bị chi phối bởi rule này, `PENDING`/
  `CONFIRMED`/`CANCELLED` vẫn do Manager/Backend set tay như cũ, không đổi):
  - Assignee `LEAD` của plan có `attendances.check_in_at` nhưng chưa `check_out_at` → `status = 'IN_PROGRESS'`.
  - Assignee `LEAD` của plan đã có cả `check_in_at` và `check_out_at` → `status = 'COMPLETED'`.
  - Assignee `LEAD` của plan chưa có `attendances` nào (chưa check-in) → giữ nguyên `status` hiện tại
    (không tự đổi, vẫn `PENDING`/`CONFIRMED` chờ Leader check-in).

  **Việc cần Backend làm theo hướng đã chốt**:
  1. **Bỏ** 2 giá trị `IN_PROGRESS`/`COMPLETED` khỏi input hợp lệ của `PATCH /schedule-plans/:id/status`
     (endpoint này từ giờ chỉ nhận `CONFIRMED`/`CANCELLED` — 2 giá trị Manager set tay trên web, xem mục
     6/8.2 của `docs/lichtrinhkythuat_api.md`) — trả `400` nếu client cố gửi `IN_PROGRESS`/`COMPLETED`.
  2. Trigger đổi `status` **tự động ở tầng service** ngay khi `POST /attendance/check-in` hoặc
     `PUT /attendance/:id/check-out` được gọi **và** `assigneeId` tương ứng có `role = 'LEAD'` — tính lại
     theo đúng 3 case ở trên. Check-in/out của `TECHNICAL` chỉ ghi vào `attendances`, không gọi trigger này.
  3. Cần xác nhận: 1 plan có **đúng 1** assignee `role = 'LEAD'` (ràng buộc ở tầng tạo `schedule_plan_assignees`
     — vd chỉ cho gán tối đa 1 `LEAD`/plan) hay có thể nhiều `LEAD`? Nếu cho phép nhiều `LEAD`, cần chốt
     thêm quy tắc "nhiều LEAD thì lấy ai" (chưa được hỏi/trả lời ở phạm vi này).
  4. Cập nhật lại `docs/lichtrinhkythuat_api.md` mục 0/6 cho khớp hướng mới (đã đánh dấu ở cuối mục
     này, chưa tự sửa file đó — cần rà soát lại toàn bộ mục 0/3/6 của tài liệu đó vì đang mô tả ngược
     lại hướng vừa chốt).
- **Chưa mô hình hóa 2 lớp xác nhận (CLAUDE.md mục 1)**: schema `attendances` hiện tại chỉ có 1 cặp
  `check_in_at`/`check_out_at` cho 1 `assignee_id` — chưa thấy cột nào thể hiện bước "Leader Staff xác
  nhận điểm danh của Technical Staff" (vd `confirmed_by_leader_id`, `leader_confirmed_at`) hay bước
  "Manager xác nhận tổng hợp công/lương cuối cùng" (vd `manager_confirmed_at`, hoặc 1 bảng tổng hợp lương
  riêng theo tháng). Cần Backend xác nhận: 2 lớp xác nhận này có được model ở bảng/API khác chưa công bố,
  hay `attendances` hiện tại **chỉ mới có lớp 1** (tự check-in) và 2 lớp còn lại vẫn cần thiết kế thêm.
- **Ranh giới vai trò (nhắc lại, không đổi)**: theo CLAUDE.md và `docs/lichtrinhkythuat_api.md` mục 0,
  hành động check-in/check-out là của Leader/Technical Staff qua **mobile**, ngoài phạm vi ghi dữ liệu
  của repo web này — web Manager chỉ cần chiều **đọc** (đã có, xem trên) và (khi có) endpoint tổng hợp
  công/lương cuối tháng ở điểm 3.
- **Trạng thái**: FE **chưa code** thêm gì cho luồng ghi (đúng phạm vi, vì thuộc mobile) — chỉ cần
  Backend: (1) xác nhận `/attendance` đã mount và khớp payload theo `assignee_id` ở trên, (2) implement
  đúng hướng tự động hóa `status` theo rule LEAD đã chốt ở trên (bỏ `IN_PROGRESS`/`COMPLETED` khỏi
  `PATCH .../status`, thêm trigger ở `POST check-in`/`PUT check-out`), (3) làm rõ mô hình 2 lớp xác nhận
  chấm công, (4) cân nhắc thêm endpoint tổng hợp chấm công/lương theo khoảng thời gian cho màn "Công &
  lương" (Manager) — màn này hiện chưa có tài liệu API riêng trong `docs/`. Web Manager **không đổi gì**
  ở tab "Lịch trình & Kỹ thuật" hiện tại (vẫn đọc `status` read-only như đang làm) — hướng mới chỉ đổi
  cách Backend/mobile tự tính `status`, không phát sinh việc code mới phía web.
- **Cập nhật thực thi (2026-07-21) — đã code xong điểm (2) ở trên**, phát hiện quan trọng cần sửa lại
  điểm (1): endpoint ghi **không phải** `/attendance/check-in`/`/attendance/:id/check-out` như payload đề
  xuất ban đầu — đọc thẳng code `src/modules/operations/schedule.{routes,service,repository}.ts` cho
  thấy check-in/check-out **đã tồn tại sẵn từ trước** (không phải viết mới) dưới dạng
  `POST /api/v1/schedule-plans/:planId/assignees/:userId/check-in` và
  `.../:userId/check-out` — 2 route này **đã mount thật**, đã gắn `requireRole('LEADER','TECHNICAL')` và
  tự validate `actor.id === userId` (không cho check-in hộ), đúng tinh thần payload đề xuất nhưng khác
  hẳn path/shape (`assigneeId` suy từ `planId`+`userId` trong URL, không phải body). `src/attendance.service.ts`
  nhắc ở trên **không tồn tại trong repo backend này** — nhiều khả năng đó là artefact từ
  `D:\bnwems-backend-api` (backend sai, xem cảnh báo đầu file), route `/attendance` 404 vì **đúng là
  không có module `/attendance` nào** — nhưng không sao, vì nghiệp vụ ghi chấm công đã được phục vụ đủ bởi
  2 route trên `/schedule-plans` sẵn có. Đã sửa:
  1. `updateSchedulePlanStatusBodySchema` (`schedule.validators.ts`) thu hẹp `status` còn đúng
     `CONFIRMED`/`CANCELLED` — gửi `IN_PROGRESS`/`COMPLETED` giờ trả `400 VALIDATION_ERROR`.
  2. Route `PATCH /schedule-plans/:planId/status` (`schedule.routes.ts`) thu hẹp role còn `MANAGER`
     (trước đó cho cả `LEADER`/`TECHNICAL`).
  3. `scheduleService.updateSchedulePlanStatus` bỏ hẳn nhánh field-staff-transition (chỉ còn 2 case
     Manager).
  4. `scheduleService.checkIn`/`checkOut` (`schedule.service.ts`): sau khi ghi `attendances`, nếu
     `assignee.role === 'LEAD'` **và** `plan.status !== 'CANCELLED'`, tự gọi
     `scheduleRepository.updateStatus(planId, 'IN_PROGRESS'|'COMPLETED', undefined, undefined)` — đúng 3
     case đã chốt (check-in LEAD → `IN_PROGRESS`, check-out LEAD → `COMPLETED`, không có attendance thì
     giữ nguyên vì hàm này chỉ chạy sau khi đã ghi attendance). Check-in/out của `TECHNICAL` không gọi
     nhánh này.
  5. Điểm (3) ở trên (tối đa 1 `LEAD`/plan) — **đã chọn hướng "đúng 1 LEAD"**: thêm
     `assertAtMostOneLead()` chặn tạo/`POST /schedule-plans/batch` với ≥2 `LEAD` trong cùng 1 plan (400),
     và chặn `POST /:planId/assignees` thêm `LEAD` thứ 2 vào plan đã có sẵn 1 `LEAD` (409
     `LEAD_ALREADY_ASSIGNED`) — khớp đúng Note gốc `docs/schema.full.dbml` dòng 313 ("tối đa 1 LEAD/plan")
     vốn đã ghi nhưng chưa từng được code enforce.
  - **Còn lại, chưa làm trong lượt này**: điểm (3) mô hình 2 lớp xác nhận chấm công (Leader xác nhận
    Technical, Manager xác nhận tổng hợp lương) và điểm (4) endpoint tổng hợp công/lương theo khoảng thời
    gian — 2 việc này cần thiết kế schema mới (không phải sửa nhỏ), để lại cho lượt sau khi có yêu cầu cụ
    thể hơn cho màn "Công & lương".
  - File đã sửa: `src/modules/operations/schedule.validators.ts`,
    `src/modules/operations/schedule.routes.ts`, `src/modules/operations/schedule.service.ts`,
    `src/modules/operations/schedule.repository.ts` (bỏ `findAssignee` không còn dùng),
    `src/modules/operations/__tests__/schedule.test.ts` (viết lại toàn bộ test liên quan
    check-in/check-out/status cho khớp hành vi mới, thêm test max-1-LEAD).
  - **Trạng thái**: `npx tsc --noEmit` sạch; `npx jest` (toàn bộ suite) — 313/319 pass, 6 fail đều thuộc
    `src/modules/inventory/__tests__/inventory.test.ts` (test chạy với seed data thật, không liên quan gì
    tới thay đổi lượt này — không đụng tới file inventory nào). Chưa test bằng `curl`/trình duyệt thật với
    DB thật (không có kết nối DB trong phiên này).

## (af) `types/schedulePlan.ts` (FE) lệch schema thật sau khi Backend đổi hướng ở mục (ae) — 4 điểm FE cần cập nhật

- **Màn liên quan**: cùng phạm vi mục (ae)/(f) — khối "Lịch thi công & đơn vị phụ trách kỹ thuật"
  (`/manager/orders/[id]`) và trang "Kế hoạch và phân công".
- **Nguồn**: người dùng dán lại nguyên văn `types/schedulePlan.ts` phía FE (2026-07-21) để đối chiếu. File
  này tự ghi "ĐÍNH CHÍNH 2026-07-21" cho phần đa phân công (đúng, khớp code thật) nhưng **chưa cập nhật
  theo thay đổi backend vừa code xong ở mục (ae) cùng ngày** — 4 điểm lệch:
  1. **`UpdateSchedulePlanStatusPayload.status: ScheduleStatus`** (còn khai đủ 5 giá trị) — **sai** kể từ
     mục (ae): `PATCH /schedule-plans/:id/status` giờ chỉ nhận `'CONFIRMED' | 'CANCELLED'`, gửi
     `'IN_PROGRESS'`/`'COMPLETED'` trả `400 VALIDATION_ERROR`. Cần thu hẹp type thành
     `status: 'CONFIRMED' | 'CANCELLED'`.
  2. **Thiếu hẳn type cho 2 endpoint check-in/check-out** — file này không có dòng nào nhắc tới
     `POST /schedule-plans/:planId/assignees/:userId/check-in` / `.../check-out`, dù đây chính là 2
     endpoint mobile Leader/Technical Staff dùng để chấm công (đã có sẵn từ trước, xác nhận lại ở mục
     (ae)). Đề xuất thêm:

     ```ts
     // POST /schedule-plans/:planId/assignees/:userId/check-in
     // POST /schedule-plans/:planId/assignees/:userId/check-out
     // Không có body — userId trong URL phải trùng user đang đăng nhập (403 nếu khác).
     // Trả về full SchedulePlan (assignees[].checkInAt/checkOutAt cập nhật); nếu người check-in/out có
     // role = 'LEAD', status tự chuyển IN_PROGRESS (check-in)/COMPLETED (check-out) — TECHNICAL thì không.
     ```

  3. **`AddScheduleAssigneePayload` (`POST /schedule-plans/:id/assignees`) có thêm mã lỗi 409 mới** —
     ngoài `ALREADY_ASSIGNED` (gán trùng 1 người 2 lần) đã ghi, giờ có thêm `LEAD_ALREADY_ASSIGNED` (gán
     người thứ 2 với `role: 'LEAD'` vào plan đã có sẵn 1 `LEAD` — tối đa 1 LEAD/plan, xem mục (ae) điểm 5).
  4. **`CreateSchedulePlanPayload` thiếu ràng buộc "tối đa 1 LEAD" trong `assignees[]`** — endpoint
     `POST /schedule-plans` (và `POST /schedule-plans/batch`) giờ trả `400` nếu mảng `assignees` gửi lên
     có ≥ 2 phần tử `role: 'LEAD'` cho cùng 1 plan. Type hiện tại không thấy field `assignees` trong
     `CreateSchedulePlanPayload` được dán ở đây (chỉ có `assignedTo` — field chết) — nếu FE thực đã đổi
     sang gửi `assignees[]` ở chỗ khác không dán ra ở đây thì chỉ cần thêm validate phía client cho ràng
     buộc trên; nếu chưa, cần bổ sung field này trước (vì `assignedTo` không còn tác dụng, xem comment gốc
     cùng file).
- **Trạng thái**: đây là gap ở FE type/tài liệu, không phải gap backend — backend đã implement đúng cả 4
  điểm trên (xem mục (ae)). Ghi lại ở đây để FE đối chiếu khi cập nhật `types/schedulePlan.ts` và
  `schedulePlanApiService`, chưa có việc nào cần Backend làm thêm.

## (ag) 4 quyết định tiếp theo cho chấm công (2026-07-21) — 3 điểm đã code, 1 điểm TẠM HOÃN vì phát hiện DB thật lệch migration history

- **Màn liên quan**: cùng phạm vi mục (ae)/(af).
- **4 quyết định người dùng chốt trong lượt này**:
  1. **Giữ nguyên endpoint check-in/check-out dạng `POST /schedule-plans/:planId/assignees/:userId/check-in`/
     `.../check-out`** (không đổi sang `/attendance/check-in` với `assigneeId` trong body như đề xuất cũ ở
     mục (ae)) — lý do: `assigneeId` **không hề có trong response `GET /schedule-plans`** (chỉ có `userId`
     ở từng phần tử `assignees[]`), nên client không có cách nào lấy được `assigneeId` để gửi lên nếu theo
     đường cũ. Route hiện tại tự suy `assigneeId` từ `planId`+`userId` trong URL, đã đúng hướng — **không
     cần đổi gì** (đã khớp sẵn từ khi implement mục (ae)).
  2. **Không thêm cột `check_out_evidence_id`** — giữ nguyên schema `attendances` chỉ có `check_in_evidence_id`
     (ảnh minh chứng chỉ chụp lúc bắt đầu ca, không chụp lúc kết thúc). **Đã code**: thêm
     `checkInBodySchema { checkInEvidenceId?: string }` (`schedule.validators.ts`), route check-in giờ
     validate body này, `scheduleService.checkIn`/`scheduleRepository.checkIn` nhận thêm tham số
     `checkInEvidenceId` và ghi vào đúng cột có sẵn. Route check-out **không đổi** (vẫn không nhận body).
  3. **`schedule_plans.evidence_id` tách biệt hoàn toàn khỏi transition status, nhân viên tự gắn, không
     bắt buộc** — bịt gap đã treo ở `docs/api/lichtrinhkythuat_api.md` mục 7 (đường cũ
     `PATCH .../status { COMPLETED, evidenceId }` không còn dùng được từ mục (ae)). **Đã code**: endpoint
     mới `PATCH /schedule-plans/:planId/evidence` `{ evidenceId: string }` — role `LEADER`/`TECHNICAL`,
     bất kỳ assignee nào của plan (không riêng LEAD, không riêng người check-in/out) đều gọi được, **không
     có điều kiện status nào** (đúng tinh thần "tách biệt hoàn toàn"). Tiện thể phát hiện và vá 1 gap có
     từ trước: `SchedulePlanDTO`/`mapPlan` (`schedule.service.ts`) **chưa từng trả `evidenceId`** trong
     response `GET /schedule-plans` dù cột đã có sẵn trên bảng — giờ đã thêm field `evidenceId` vào DTO.
  4. **Bỏ ràng buộc `@@unique` trên `attendances.assignee_id`** — 1 assignee được phép có nhiều lượt
     check-in/check-out (không chỉ đúng 1 dòng `attendances`/người); khi suy `status`, chỉ lấy dòng **mới
     nhất** của assignee `LEAD`. **TẠM HOÃN, CHƯA CODE** — xem lý do ở mục dưới.
- **⚠️ Phát hiện quan trọng khi chuẩn bị migration cho điểm 4 — DB thật lệch migration history**: chạy
  `npx prisma migrate dev` để tạo migration bỏ unique constraint thì Prisma báo **drift**: bảng `items`
  trên DB thật (Aiven MySQL, `bnwems-db-bnwems-db-g83.l.aivencloud.com`) có cột `components` (JSON,
  nullable) **không nằm trong bất kỳ file migration nào** đã commit trong `prisma/migrations/` — nghĩa là
  có ai đó (nhánh khác/phiên khác) đã `ALTER TABLE` trực tiếp lên DB dùng chung mà chưa commit migration
  tương ứng. `prisma migrate dev` từ chối chạy tiếp và đòi **reset toàn bộ DB** (xóa sạch dữ liệu) để đồng
  bộ lại — **không chấp nhận được** vì đây là DB dùng chung có dữ liệu thật/seed.
  - Đã chuẩn bị sẵn cách an toàn hơn (viết tay 1 migration chỉ chứa đúng `DROP INDEX
    attendances_assignee_id_key` + `CREATE INDEX idx_attendances_assignee`, áp bằng `prisma db execute`
    thay vì `migrate dev`, không đụng gì tới bảng `items`) nhưng **người dùng chọn dừng lại để tự kiểm tra
    nguồn gốc cột `components` trước**, tránh chồng chéo với thay đổi của nhánh/phiên khác đang chạy song
    song. Đã revert lại `prisma/schema.prisma` (bỏ thay đổi `Attendance.assigneeId`/`SchedulePlanAssignee.attendance`)
    về đúng trạng thái cũ (vẫn `@unique`/quan hệ 1-1) để code khớp với DB thật hiện tại, không để
    schema.prisma "nói dối" so với DB đang chạy.
  - **Cần làm trước khi tiếp tục điểm 4**: xác nhận cột `items.components` đến từ đâu (migration chưa
    commit ở nhánh khác? ai đó chạy tay?), sau đó hoặc (a) commit migration còn thiếu cho
    `items.components` trước, hoặc (b) xác nhận cột đó an toàn để bỏ qua/rollback, rồi mới quay lại chạy
    migration cho `attendances` ở điểm 4.
- **Việc còn lại khi điểm 4 được nối tiếp** (chưa code, ghi trước để không quên): `scheduleRepository.checkIn`
  đổi từ `upsert` (1 dòng/assignee) sang `create` (dòng mới mỗi lần); `checkOut` tìm dòng **mở** mới nhất
  (có `checkInAt`, chưa `checkOutAt`) của assignee thay vì dòng duy nhất; `mapAssignee`
  (`schedule.service.ts`) đổi từ đọc `a.attendance` (1-1) sang lấy dòng mới nhất của `a.attendances[]`;
  logic suy `status` ở `checkIn`/`checkOut` không đổi (vẫn dựa vào `assignee.role === 'LEAD'`), chỉ đổi
  nguồn đọc `checkInAt`/`checkOutAt` sang dòng mới nhất.
- **File đã sửa (điểm 1-3)**: `src/modules/operations/schedule.validators.ts` (`checkInBodySchema`,
  `attachEvidenceBodySchema`), `schedule.routes.ts` (route check-in thêm validate body,
  route mới `PATCH /:planId/evidence`), `schedule.controller.ts` (`attachEvidence`, `checkIn` truyền
  `checkInEvidenceId`), `schedule.service.ts` (`SchedulePlanDTO.evidenceId`, `attachEvidence`, `checkIn`
  nhận thêm tham số), `schedule.repository.ts` (`checkIn` ghi `checkInEvidenceId`, `attachEvidence` mới),
  `__tests__/schedule.test.ts` (thêm test cho cả 3 điểm).
- **Trạng thái**: `npx tsc --noEmit` sạch; `npx jest` toàn bộ suite — 318/324 pass, 6 fail vẫn là
  `inventory.test.ts` (không liên quan, đã ghi ở mục (ae)). Điểm 4 (bỏ unique `attendances.assignee_id`)
  **chưa động tới DB thật lẫn code** — giữ nguyên hành vi hiện tại (1 assignee = tối đa 1 lượt check-in/
  check-out) cho tới khi drift `items.components` được làm rõ.
