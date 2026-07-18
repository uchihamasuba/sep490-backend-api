-- ============================================================================
--  BNWEMS — Migration 001: CORE (24 bảng)
--  Binh Nguyen Wedding & Event Management System
--
--  Phần LÕI của hệ thống: người dùng, khách/NCC, chính sách, danh mục thiết bị,
--  báo giá, đơn hàng, điều phối/hiện trường, giao dịch NCC, thanh toán, thông báo.
--
--  KHÔNG bao gồm module KHO VẬN (tồn kho, biến động kho, thu hồi/hoàn kho) —
--  phần đó nằm ở migration 002_warehouse_logistics.sql, chạy SAU file này.
--  Mọi khóa ngoại đều đi từ 002 -> 001 (một chiều), nên 001 chạy độc lập được.
--
--  Thứ tự chạy:  mysql -u root -p bnwems < migrations/001_core.sql   ->   mysql -u root -p bnwems < migrations/002_warehouse_logistics.sql
--  (Phần LƯƠNG/WAGE đã loại trừ.) Đã kiểm thử trên MySQL 8.0+.
-- ============================================================================

-- ============================================================================
--  3. IDENTITY & MASTER DATA
-- ============================================================================

CREATE TABLE users (
    user_id       VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    username      VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    role          ENUM('ADMIN', 'MANAGER', 'LEADER', 'TECHNICAL') NOT NULL,
    status        ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    email         VARCHAR(255),
    phone         VARCHAR(30),
    bio           TEXT,
    avatar_url    TEXT,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT='Tài khoản nội bộ; Customer/Supplier KHÔNG có tài khoản.';

CREATE TABLE customers (
    customer_id   VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    customer_code VARCHAR(50)  NOT NULL UNIQUE,
    customer_name VARCHAR(255) NOT NULL,
    phone         VARCHAR(30)  NOT NULL,
    email         VARCHAR(255),
    address       TEXT,
    notes         TEXT,
    status        ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE suppliers (
    supplier_id    VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    supplier_code  VARCHAR(50)  NOT NULL UNIQUE,
    supplier_name  VARCHAR(255) NOT NULL,
    service_type   VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone          VARCHAR(30),
    email          VARCHAR(255),
    address        TEXT,
    rating         DECIMAL(2,1) CHECK (rating IS NULL OR rating BETWEEN 0 AND 5),
    notes          TEXT,
    status         ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE business_policies (
    policy_id    VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    policy_code  VARCHAR(50)  NOT NULL UNIQUE,
    policy_name  VARCHAR(255) NOT NULL,
    policy_type  ENUM('DEPOSIT', 'CANCELLATION', 'COMPENSATION', 'FEE') NOT NULL,
    description  TEXT,
    policy_value DECIMAL(14,2) NOT NULL,
    unit         VARCHAR(50)  NOT NULL,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================================
--  4. CATALOG (Danh mục 3 tầng: Category > Type > Item)
-- ============================================================================

CREATE TABLE item_categories (
    category_id   VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    category_code VARCHAR(50) UNIQUE,
    category_name VARCHAR(255) NOT NULL,
    description   TEXT
);

CREATE TABLE item_types (
    type_id     VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    category_id VARCHAR(36) NOT NULL,
    type_code   VARCHAR(50),
    type_name   VARCHAR(255) NOT NULL,
    description TEXT,
    image_url   TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (category_id) REFERENCES item_categories(category_id) ON DELETE RESTRICT
);

CREATE TABLE items (
    item_id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    item_code        VARCHAR(50)  NOT NULL UNIQUE,
    item_name        VARCHAR(255) NOT NULL,
    type_id          VARCHAR(36) NOT NULL,
    description      TEXT,
    unit             VARCHAR(50)   NOT NULL,
    rental_price     DECIMAL(14,2) NOT NULL DEFAULT 0,
    purchase_price   DECIMAL(14,2),
    price_valid_from DATE,
    price_valid_to   DATE,
    image_url        TEXT,
    status           ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE') NOT NULL DEFAULT 'ACTIVE',
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (type_id) REFERENCES item_types(type_id) ON DELETE RESTRICT
);

-- ============================================================================
--  5. EVIDENCE (ảnh/chứng từ minh chứng dùng chung)
-- ============================================================================
CREATE TABLE evidences (
    evidence_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    file_url    TEXT NOT NULL,
    description TEXT,
    uploaded_by VARCHAR(36) NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(user_id) ON DELETE RESTRICT
);

-- ============================================================================
--  6. SALES PIPELINE (Báo giá thuộc Customer)
-- ============================================================================
CREATE TABLE quotations (
    quotation_id   VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    quotation_code VARCHAR(50)  NOT NULL UNIQUE,
    customer_id    VARCHAR(36) NOT NULL,
    version        VARCHAR(30)  NOT NULL,
    subtotal       DECIMAL(14,2) NOT NULL DEFAULT 0,
    discount_total DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_amount   DECIMAL(14,2) NOT NULL DEFAULT 0,
    status         ENUM('DRAFT', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    notes          TEXT,
    created_by     VARCHAR(36) NOT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE RESTRICT
);

CREATE TABLE quotation_items (
    quotation_item_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    quotation_id      VARCHAR(36) NOT NULL,
    item_id           VARCHAR(36) NOT NULL,
    item_name         VARCHAR(255) NOT NULL,
    quantity          INTEGER NOT NULL CHECK (quantity > 0),
    price             DECIMAL(14,2) NOT NULL,
    discount          DECIMAL(14,2) NOT NULL DEFAULT 0,
    line_total        DECIMAL(14,2) GENERATED ALWAYS AS (quantity * price - discount) STORED,
    FOREIGN KEY (quotation_id) REFERENCES quotations(quotation_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE RESTRICT
);

-- ============================================================================
--  7. ORDERS (vòng đời trung tâm)
-- ============================================================================
CREATE TABLE orders (
    order_id       VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_code     VARCHAR(50)  NOT NULL UNIQUE,
    customer_id    VARCHAR(36) NOT NULL,
    quotation_id   VARCHAR(36),
    policy_id      VARCHAR(36),
    event_type     VARCHAR(100) NOT NULL,
    event_name     VARCHAR(255),
    event_date     TIMESTAMP  NOT NULL,
    location       TEXT         NOT NULL,
    guest_count    INTEGER CHECK (guest_count IS NULL OR guest_count >= 0),
    total_amount   DECIMAL(14,2) NOT NULL DEFAULT 0,
    payment_status ENUM('UNPAID', 'DEPOSITED', 'PAID') NOT NULL DEFAULT 'UNPAID',
    order_status   ENUM('NEW', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'NEW',
    cancel_reason  TEXT,
    notes          TEXT,
    created_by     VARCHAR(36) NOT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE RESTRICT,
    FOREIGN KEY (quotation_id) REFERENCES quotations(quotation_id) ON DELETE SET NULL,
    FOREIGN KEY (policy_id) REFERENCES business_policies(policy_id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE RESTRICT
);

CREATE TABLE order_items (
    order_item_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_id      VARCHAR(36) NOT NULL,
    item_id       VARCHAR(36) NOT NULL,
    quantity      INTEGER NOT NULL CHECK (quantity > 0),
    unit_price    DECIMAL(14,2) NOT NULL,
    subtotal      DECIMAL(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    source        ENUM('INTERNAL', 'SUPPLIER') NOT NULL DEFAULT 'INTERNAL',
    prepared_qty  INTEGER NOT NULL DEFAULT 0 CHECK (prepared_qty >= 0),
    notes         TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE RESTRICT
);

-- ============================================================================
--  8. OPERATIONS (điều phối & hiện trường)
-- ============================================================================
CREATE TABLE work_tasks (
    task_id     VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    task_code   VARCHAR(50)  NOT NULL UNIQUE,
    task_name   VARCHAR(255) NOT NULL,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE schedule_plans (
    plan_id     VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    plan_code   VARCHAR(50)  NOT NULL UNIQUE,
    order_id    VARCHAR(36) NOT NULL,
    task_id     VARCHAR(36) NOT NULL,
    start_time  TIMESTAMP  NOT NULL,
    end_time    TIMESTAMP NULL,
    location    TEXT,
    status      ENUM('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    evidence_id VARCHAR(36),
    notes       TEXT,
    created_by  VARCHAR(36) NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES work_tasks(task_id) ON DELETE RESTRICT,
    FOREIGN KEY (evidence_id) REFERENCES evidences(evidence_id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE RESTRICT
);

CREATE TABLE schedule_plan_assignees (
    assignee_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    plan_id     VARCHAR(36) NOT NULL,
    user_id     VARCHAR(36) NOT NULL,
    role        ENUM('LEAD', 'TECHNICAL') NOT NULL DEFAULT 'TECHNICAL',
    notes       TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (plan_id, user_id),
    FOREIGN KEY (plan_id) REFERENCES schedule_plans(plan_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

CREATE TABLE attendances (
    attendance_id        VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    assignee_id          VARCHAR(36) NOT NULL UNIQUE,
    check_in_at          TIMESTAMP NULL,
    check_in_evidence_id VARCHAR(36),
    check_out_at         TIMESTAMP NULL,
    note                 TEXT,
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (assignee_id) REFERENCES schedule_plan_assignees(assignee_id) ON DELETE CASCADE,
    FOREIGN KEY (check_in_evidence_id) REFERENCES evidences(evidence_id) ON DELETE SET NULL
);

CREATE TABLE survey_reports (
    survey_id           VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    report_code         VARCHAR(50) NOT NULL UNIQUE,
    order_id            VARCHAR(36) NOT NULL,
    plan_id             VARCHAR(36),
    evidence_id         VARCHAR(36),
    survey_date         TIMESTAMP NOT NULL,
    location            TEXT NOT NULL,
    area                DECIMAL(10,2),
    length              DECIMAL(10,2),
    width               DECIMAL(10,2),
    entrance            TEXT,
    site_constraints    TEXT,
    additional_requests TEXT,
    proposed_items      TEXT,
    notes               TEXT,
    status              ENUM('DRAFT', 'NEEDS_REVIEW', 'SUBMITTED', 'CONFIRMED') NOT NULL DEFAULT 'DRAFT',
    reported_by         VARCHAR(36) NOT NULL,
    confirmed_by        VARCHAR(36),
    confirmed_at        TIMESTAMP NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES schedule_plans(plan_id) ON DELETE SET NULL,
    FOREIGN KEY (evidence_id) REFERENCES evidences(evidence_id) ON DELETE SET NULL,
    FOREIGN KEY (reported_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (confirmed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE change_requests (
    change_request_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_id          VARCHAR(36) NOT NULL,
    type              ENUM('add', 'remove', 'replace') NOT NULL,
    status            ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

CREATE TABLE change_request_items (
    change_request_item_id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    change_request_id      VARCHAR(36) NOT NULL,
    catalog_item_id        VARCHAR(36) NOT NULL,
    quantity               INTEGER NOT NULL CHECK (quantity > 0),
    action                 ENUM('add', 'remove') NOT NULL,
    FOREIGN KEY (change_request_id) REFERENCES change_requests(change_request_id) ON DELETE CASCADE,
    FOREIGN KEY (catalog_item_id) REFERENCES items(item_id) ON DELETE RESTRICT
);

-- ============================================================================
--  9. SUPPLIER TRANSACTIONS (thuê/mua thiết bị NCC)
-- ============================================================================
CREATE TABLE supplier_transactions (
    transaction_id   VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    transaction_code VARCHAR(50)  NOT NULL UNIQUE,
    supplier_id      VARCHAR(36) NOT NULL,
    order_id         VARCHAR(36) NOT NULL,
    transaction_type ENUM('RENTAL', 'PURCHASE') NOT NULL,
    service_title    VARCHAR(255) NOT NULL,
    estimated_cost   DECIMAL(14,2) NOT NULL DEFAULT 0,
    deposit_amount   DECIMAL(14,2) NOT NULL DEFAULT 0,
    payment_status   ENUM('UNPAID', 'DEPOSITED', 'PAID') NOT NULL DEFAULT 'UNPAID',
    status           ENUM('PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE RESTRICT,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT
);

CREATE TABLE supplier_transaction_items (
    st_item_id        VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    transaction_id    VARCHAR(36) NOT NULL,
    item_id           VARCHAR(36),
    item_name         VARCHAR(255) NOT NULL,
    quantity          INTEGER NOT NULL CHECK (quantity > 0),
    unit_cost         DECIMAL(14,2) NOT NULL,
    subtotal          DECIMAL(14,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    received_quantity INTEGER NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
    notes             TEXT,
    FOREIGN KEY (transaction_id) REFERENCES supplier_transactions(transaction_id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE SET NULL
);

-- ============================================================================
--  10. PAYMENTS (cọc & quyết toán theo Order)
-- ============================================================================
CREATE TABLE deposits (
    deposit_id     VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    deposit_code   VARCHAR(50)  NOT NULL UNIQUE,
    order_id       VARCHAR(36) NOT NULL,
    amount         DECIMAL(14,2) NOT NULL,
    due_date       TIMESTAMP NULL,
    payment_date   TIMESTAMP NULL,
    payment_method VARCHAR(100),
    qr_code_url    TEXT,
    status         ENUM('PENDING', 'SUCCESS', 'OVERDUE', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    evidence_id    VARCHAR(36),
    requested_by   VARCHAR(36) NOT NULL,
    approved_by    VARCHAR(36),
    approved_at    TIMESTAMP NULL,
    notes          TEXT,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (evidence_id) REFERENCES evidences(evidence_id) ON DELETE SET NULL,
    FOREIGN KEY (requested_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (approved_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE settlements (
    settlement_id  VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_id       VARCHAR(36) NOT NULL,
    additional_fee DECIMAL(14,2) NOT NULL DEFAULT 0,
    compensation   DECIMAL(14,2) NOT NULL DEFAULT 0,
    discount       DECIMAL(14,2) NOT NULL DEFAULT 0,
    final_amount   DECIMAL(14,2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(100),
    qr_code_url    TEXT,
    paid_at        TIMESTAMP NULL,
    evidence_id    VARCHAR(36),
    status         ENUM('DRAFT', 'AGREED', 'REQUESTED', 'PAID', 'CONFIRMED') NOT NULL DEFAULT 'DRAFT',
    requested_by   VARCHAR(36),
    requested_at   TIMESTAMP NULL,
    confirmed_by   VARCHAR(36),
    confirmed_at   TIMESTAMP NULL,
    notes          TEXT,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (evidence_id) REFERENCES evidences(evidence_id) ON DELETE SET NULL,
    FOREIGN KEY (requested_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (confirmed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- ============================================================================
--  11. NOTIFICATIONS
-- ============================================================================
CREATE TABLE notifications (
    notification_id   VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id           VARCHAR(36) NOT NULL,
    title             VARCHAR(255) NOT NULL,
    content           TEXT,
    notification_type ENUM('SYSTEM', 'ORDER', 'TASK', 'SCHEDULE', 'PAYMENT', 'SURVEY', 'INVENTORY', 'SUPPLIER', 'OTHER') NOT NULL DEFAULT 'SYSTEM',
    ref_type          VARCHAR(100),
    ref_id            VARCHAR(36),
    is_read           BOOLEAN NOT NULL DEFAULT FALSE,
    read_at           TIMESTAMP NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ============================================================================
--  13. INDEXES
-- ============================================================================
CREATE INDEX idx_item_types_category          ON item_types(category_id);
CREATE INDEX idx_items_type                   ON items(type_id);
CREATE INDEX idx_items_status                 ON items(status);

CREATE INDEX idx_quotations_customer          ON quotations(customer_id);
CREATE INDEX idx_quotations_status            ON quotations(status);
CREATE INDEX idx_quotation_items_quotation    ON quotation_items(quotation_id);
CREATE INDEX idx_quotation_items_item         ON quotation_items(item_id);

CREATE INDEX idx_orders_customer              ON orders(customer_id);
CREATE INDEX idx_orders_quotation             ON orders(quotation_id);
CREATE INDEX idx_orders_status                ON orders(order_status);
CREATE INDEX idx_orders_payment_status        ON orders(payment_status);
CREATE INDEX idx_orders_event_date            ON orders(event_date);
CREATE INDEX idx_orders_created_by            ON orders(created_by);
CREATE INDEX idx_order_items_order            ON order_items(order_id);
CREATE INDEX idx_order_items_item             ON order_items(item_id);

CREATE INDEX idx_schedule_plans_order         ON schedule_plans(order_id);
CREATE INDEX idx_schedule_plans_task          ON schedule_plans(task_id);
CREATE INDEX idx_schedule_plans_status        ON schedule_plans(status);
CREATE INDEX idx_schedule_plans_start         ON schedule_plans(start_time);
CREATE INDEX idx_spa_plan                     ON schedule_plan_assignees(plan_id);
CREATE INDEX idx_spa_user                     ON schedule_plan_assignees(user_id);

CREATE INDEX idx_survey_reports_order         ON survey_reports(order_id);
CREATE INDEX idx_survey_reports_status        ON survey_reports(status);

CREATE INDEX idx_change_requests_order        ON change_requests(order_id);
CREATE INDEX idx_cr_items_request             ON change_request_items(change_request_id);
CREATE INDEX idx_cr_items_item                ON change_request_items(catalog_item_id);

CREATE INDEX idx_sup_txn_supplier             ON supplier_transactions(supplier_id);
CREATE INDEX idx_sup_txn_order                ON supplier_transactions(order_id);
CREATE INDEX idx_sup_txn_status               ON supplier_transactions(status);
CREATE INDEX idx_sup_txn_items_txn            ON supplier_transaction_items(transaction_id);

CREATE INDEX idx_deposits_order               ON deposits(order_id);
CREATE INDEX idx_deposits_status              ON deposits(status);
CREATE INDEX idx_settlements_order            ON settlements(order_id);
CREATE INDEX idx_settlements_status           ON settlements(status);

CREATE INDEX idx_notifications_user           ON notifications(user_id);
CREATE INDEX idx_notifications_is_read        ON notifications(is_read);
