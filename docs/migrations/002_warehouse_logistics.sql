-- ============================================================================
--  BNWEMS — Migration 002: KHO VẬN (Warehouse & Logistics) — 4 bảng
--  Binh Nguyen Wedding & Event Management System
--
--  Module "Vận hành kho": tồn kho + biến động kho (xuất/nhập) + thu hồi & hoàn
--  kho (biên bản thu hồi + kiểm đếm hỏng/mất).
--
--  ⚠️ PHỤ THUỘC migration 001_core.sql — phải chạy 001 TRƯỚC.
--     Các bảng dưới đây tham chiếu tới: items, orders, supplier_transactions,
--     users (đều thuộc 001). Không có chiều ngược lại (001 không tham chiếu 002),
--     nên có thể phát triển/triển khai module này tách biệt, thêm vào sau.
--
--  Thứ tự chạy:  mysql -u root -p bnwems < migrations/001_core.sql   ->   mysql -u root -p bnwems < migrations/002_warehouse_logistics.sql
--  Đã kiểm thử trên MySQL 8.0+ (chạy nối tiếp 001 -> 002).
-- ============================================================================

-- ============================================================================
--  2. TỒN KHO (1-1 theo item, tính theo loại + số lượng)
-- ============================================================================
CREATE TABLE inventory (
    inventory_id       VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    item_id            VARCHAR(36) NOT NULL UNIQUE,
    quantity_total     INTEGER NOT NULL DEFAULT 0 CHECK (quantity_total     >= 0),
    quantity_damaged   INTEGER NOT NULL DEFAULT 0 CHECK (quantity_damaged   >= 0),
    quantity_reserved  INTEGER NOT NULL DEFAULT 0 CHECK (quantity_reserved  >= 0),
    quantity_available INTEGER NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
    updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE
);

-- ============================================================================
--  3. THU HỒI & HOÀN KHO (biên bản thu hồi + chi tiết kiểm đếm hỏng/mất)
-- ============================================================================
CREATE TABLE collected_equipment_reports (
    report_id      VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_id       VARCHAR(36) NOT NULL,
    report_type    ENUM('INTERNAL', 'SUPPLIER') NOT NULL,
    transaction_id VARCHAR(36), -- khi trả đồ NCC
    status         ENUM('SUBMITTED', 'CONFIRMED') NOT NULL DEFAULT 'SUBMITTED',
    reported_by    VARCHAR(36) NOT NULL,
    confirmed_by   VARCHAR(36),
    confirmed_at   TIMESTAMP NULL,
    notes          TEXT,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES supplier_transactions(transaction_id) ON DELETE SET NULL,
    FOREIGN KEY (reported_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (confirmed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE collected_equipment_report_items (
    cer_item_id      VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    report_id        VARCHAR(36) NOT NULL,
    item_id          VARCHAR(36) NOT NULL,
    good_quantity    INTEGER NOT NULL DEFAULT 0 CHECK (good_quantity    >= 0),
    damaged_quantity INTEGER NOT NULL DEFAULT 0 CHECK (damaged_quantity >= 0),
    lost_quantity    INTEGER NOT NULL DEFAULT 0 CHECK (lost_quantity    >= 0),
    notes            TEXT,
    FOREIGN KEY (report_id) REFERENCES collected_equipment_reports(report_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE RESTRICT
);

-- ============================================================================
--  4. SỔ BIẾN ĐỘNG KHO (xuất/nhập/điều chỉnh) — đặt cuối để tham chiếu đủ bảng
-- ============================================================================
CREATE TABLE inventory_movements (
    movement_id   VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    item_id       VARCHAR(36) NOT NULL,
    order_id      VARCHAR(36),
    report_id     VARCHAR(36),
    movement_type ENUM('OUTBOUND', 'INBOUND', 'ADJUSTMENT') NOT NULL,
    quantity      INTEGER NOT NULL,
    performed_by  VARCHAR(36) NOT NULL,
    notes         TEXT,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE RESTRICT,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE SET NULL,
    FOREIGN KEY (report_id) REFERENCES collected_equipment_reports(report_id) ON DELETE SET NULL,
    FOREIGN KEY (performed_by) REFERENCES users(user_id) ON DELETE RESTRICT
);

-- ============================================================================
--  6. INDEXES
-- ============================================================================
CREATE INDEX idx_cer_order        ON collected_equipment_reports(order_id);
CREATE INDEX idx_cer_transaction  ON collected_equipment_reports(transaction_id);
CREATE INDEX idx_cer_items_report ON collected_equipment_report_items(report_id);
CREATE INDEX idx_cer_items_item   ON collected_equipment_report_items(item_id);

CREATE INDEX idx_inv_mov_item     ON inventory_movements(item_id);
CREATE INDEX idx_inv_mov_order    ON inventory_movements(order_id);
CREATE INDEX idx_inv_mov_report   ON inventory_movements(report_id);
