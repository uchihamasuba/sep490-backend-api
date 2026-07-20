# Yêu cầu bổ sung cho Backend

Danh sách các chỗ dữ liệu/endpoint backend hiện chưa đáp ứng đủ nhu cầu UI, phát hiện trong quá trình dựng
giao diện — nối tiếp theo thứ tự (a), (b), (c)... Mỗi mục ghi rõ màn hình liên quan, vấn đề, và đề xuất xử
lý (nếu có).

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
