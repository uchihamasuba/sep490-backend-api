-- CreateTable
CREATE TABLE `users` (
    `user_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `username` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(255) NOT NULL,
    `role` ENUM('ADMIN', 'MANAGER', 'LEADER', 'TECHNICAL') NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(30) NULL,
    `bio` TEXT NULL,
    `avatar_url` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `users_username_key`(`username`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `customer_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `customer_code` VARCHAR(50) NOT NULL,
    `customer_name` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(30) NOT NULL,
    `email` VARCHAR(255) NULL,
    `address` TEXT NULL,
    `notes` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `customers_customer_code_key`(`customer_code`),
    PRIMARY KEY (`customer_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suppliers` (
    `supplier_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `supplier_code` VARCHAR(50) NOT NULL,
    `supplier_name` VARCHAR(255) NOT NULL,
    `service_type` VARCHAR(255) NOT NULL,
    `contact_person` VARCHAR(255) NULL,
    `phone` VARCHAR(30) NULL,
    `email` VARCHAR(255) NULL,
    `address` TEXT NULL,
    `rating` DECIMAL(2, 1) NULL,
    `notes` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `suppliers_supplier_code_key`(`supplier_code`),
    PRIMARY KEY (`supplier_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `business_policies` (
    `policy_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `policy_code` VARCHAR(50) NOT NULL,
    `policy_name` VARCHAR(255) NOT NULL,
    `policy_type` ENUM('DEPOSIT', 'CANCELLATION', 'COMPENSATION', 'FEE') NOT NULL,
    `description` TEXT NULL,
    `policy_value` DECIMAL(14, 2) NOT NULL,
    `unit` VARCHAR(50) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `business_policies_policy_code_key`(`policy_code`),
    PRIMARY KEY (`policy_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_categories` (
    `category_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `category_code` VARCHAR(50) NULL,
    `category_name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,

    UNIQUE INDEX `item_categories_category_code_key`(`category_code`),
    PRIMARY KEY (`category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_types` (
    `type_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `category_id` VARCHAR(36) NOT NULL,
    `type_code` VARCHAR(50) NULL,
    `type_name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `image_url` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    INDEX `idx_item_types_category`(`category_id`),
    PRIMARY KEY (`type_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `items` (
    `item_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `item_code` VARCHAR(50) NOT NULL,
    `item_name` VARCHAR(255) NOT NULL,
    `type_id` VARCHAR(36) NOT NULL,
    `description` TEXT NULL,
    `unit` VARCHAR(50) NOT NULL,
    `rental_price` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `purchase_price` DECIMAL(14, 2) NULL,
    `price_valid_from` DATE NULL,
    `price_valid_to` DATE NULL,
    `image_url` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `items_item_code_key`(`item_code`),
    INDEX `idx_items_type`(`type_id`),
    INDEX `idx_items_status`(`status`),
    PRIMARY KEY (`item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `evidences` (
    `evidence_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `file_url` TEXT NOT NULL,
    `description` TEXT NULL,
    `uploaded_by` VARCHAR(36) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`evidence_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotations` (
    `quotation_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `quotation_code` VARCHAR(50) NOT NULL,
    `customer_id` VARCHAR(36) NOT NULL,
    `version` VARCHAR(30) NOT NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `discount_total` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `notes` TEXT NULL,
    `created_by` VARCHAR(36) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `quotations_quotation_code_key`(`quotation_code`),
    INDEX `idx_quotations_customer`(`customer_id`),
    INDEX `idx_quotations_status`(`status`),
    PRIMARY KEY (`quotation_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quotation_items` (
    `quotation_item_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `quotation_id` VARCHAR(36) NOT NULL,
    `item_id` VARCHAR(36) NOT NULL,
    `item_name` VARCHAR(255) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `price` DECIMAL(14, 2) NOT NULL,
    `discount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `line_total` DECIMAL(14, 2) NOT NULL,

    INDEX `idx_quotation_items_quotation`(`quotation_id`),
    INDEX `idx_quotation_items_item`(`item_id`),
    PRIMARY KEY (`quotation_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `order_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `order_code` VARCHAR(50) NOT NULL,
    `customer_id` VARCHAR(36) NOT NULL,
    `quotation_id` VARCHAR(36) NULL,
    `policy_id` VARCHAR(36) NULL,
    `event_type` VARCHAR(100) NOT NULL,
    `event_name` VARCHAR(255) NULL,
    `event_date` TIMESTAMP(0) NOT NULL,
    `location` TEXT NOT NULL,
    `guest_count` INTEGER NULL,
    `total_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `payment_status` ENUM('UNPAID', 'DEPOSITED', 'PAID') NOT NULL DEFAULT 'UNPAID',
    `order_status` ENUM('NEW', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'NEW',
    `cancel_reason` TEXT NULL,
    `notes` TEXT NULL,
    `created_by` VARCHAR(36) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `orders_order_code_key`(`order_code`),
    INDEX `idx_orders_customer`(`customer_id`),
    INDEX `idx_orders_quotation`(`quotation_id`),
    INDEX `idx_orders_status`(`order_status`),
    INDEX `idx_orders_payment_status`(`payment_status`),
    INDEX `idx_orders_event_date`(`event_date`),
    INDEX `idx_orders_created_by`(`created_by`),
    PRIMARY KEY (`order_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `order_item_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `order_id` VARCHAR(36) NOT NULL,
    `item_id` VARCHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` DECIMAL(14, 2) NOT NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL,
    `source` ENUM('INTERNAL', 'SUPPLIER') NOT NULL DEFAULT 'INTERNAL',
    `prepared_qty` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,

    INDEX `idx_order_items_order`(`order_id`),
    INDEX `idx_order_items_item`(`item_id`),
    PRIMARY KEY (`order_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_tasks` (
    `task_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `task_code` VARCHAR(50) NOT NULL,
    `task_name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `work_tasks_task_code_key`(`task_code`),
    PRIMARY KEY (`task_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedule_plans` (
    `plan_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `plan_code` VARCHAR(50) NOT NULL,
    `order_id` VARCHAR(36) NOT NULL,
    `task_id` VARCHAR(36) NOT NULL,
    `start_time` TIMESTAMP(0) NOT NULL,
    `end_time` TIMESTAMP(0) NULL,
    `location` TEXT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `evidence_id` VARCHAR(36) NULL,
    `notes` TEXT NULL,
    `created_by` VARCHAR(36) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `schedule_plans_plan_code_key`(`plan_code`),
    INDEX `idx_schedule_plans_order`(`order_id`),
    INDEX `idx_schedule_plans_task`(`task_id`),
    INDEX `idx_schedule_plans_status`(`status`),
    INDEX `idx_schedule_plans_start`(`start_time`),
    PRIMARY KEY (`plan_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedule_plan_assignees` (
    `assignee_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `plan_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `role` ENUM('LEAD', 'TECHNICAL') NOT NULL DEFAULT 'TECHNICAL',
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_spa_plan`(`plan_id`),
    INDEX `idx_spa_user`(`user_id`),
    UNIQUE INDEX `schedule_plan_assignees_plan_id_user_id_key`(`plan_id`, `user_id`),
    PRIMARY KEY (`assignee_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendances` (
    `attendance_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `assignee_id` VARCHAR(36) NOT NULL,
    `check_in_at` TIMESTAMP(0) NULL,
    `check_in_evidence_id` VARCHAR(36) NULL,
    `check_out_at` TIMESTAMP(0) NULL,
    `note` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `attendances_assignee_id_key`(`assignee_id`),
    PRIMARY KEY (`attendance_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `survey_reports` (
    `survey_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `report_code` VARCHAR(50) NOT NULL,
    `order_id` VARCHAR(36) NOT NULL,
    `plan_id` VARCHAR(36) NULL,
    `evidence_id` VARCHAR(36) NULL,
    `survey_date` TIMESTAMP(0) NOT NULL,
    `location` TEXT NOT NULL,
    `area` DECIMAL(10, 2) NULL,
    `length` DECIMAL(10, 2) NULL,
    `width` DECIMAL(10, 2) NULL,
    `entrance` TEXT NULL,
    `site_constraints` TEXT NULL,
    `additional_requests` TEXT NULL,
    `proposed_items` TEXT NULL,
    `notes` TEXT NULL,
    `status` ENUM('DRAFT', 'NEEDS_REVIEW', 'SUBMITTED', 'CONFIRMED') NOT NULL DEFAULT 'DRAFT',
    `reported_by` VARCHAR(36) NOT NULL,
    `confirmed_by` VARCHAR(36) NULL,
    `confirmed_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `survey_reports_report_code_key`(`report_code`),
    INDEX `idx_survey_reports_order`(`order_id`),
    INDEX `idx_survey_reports_status`(`status`),
    PRIMARY KEY (`survey_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `change_requests` (
    `change_request_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `order_id` VARCHAR(36) NOT NULL,
    `type` ENUM('add', 'remove', 'replace') NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_change_requests_order`(`order_id`),
    PRIMARY KEY (`change_request_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `change_request_items` (
    `change_request_item_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `change_request_id` VARCHAR(36) NOT NULL,
    `catalog_item_id` VARCHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `action` ENUM('add', 'remove') NOT NULL,

    INDEX `idx_cr_items_request`(`change_request_id`),
    INDEX `idx_cr_items_item`(`catalog_item_id`),
    PRIMARY KEY (`change_request_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_transactions` (
    `transaction_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `transaction_code` VARCHAR(50) NOT NULL,
    `supplier_id` VARCHAR(36) NOT NULL,
    `order_id` VARCHAR(36) NOT NULL,
    `transaction_type` ENUM('RENTAL', 'PURCHASE') NOT NULL,
    `service_title` VARCHAR(255) NOT NULL,
    `estimated_cost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `deposit_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `payment_status` ENUM('UNPAID', 'DEPOSITED', 'PAID') NOT NULL DEFAULT 'UNPAID',
    `status` ENUM('PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `supplier_transactions_transaction_code_key`(`transaction_code`),
    INDEX `idx_sup_txn_supplier`(`supplier_id`),
    INDEX `idx_sup_txn_order`(`order_id`),
    INDEX `idx_sup_txn_status`(`status`),
    PRIMARY KEY (`transaction_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_transaction_items` (
    `st_item_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `transaction_id` VARCHAR(36) NOT NULL,
    `item_id` VARCHAR(36) NULL,
    `item_name` VARCHAR(255) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_cost` DECIMAL(14, 2) NOT NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL,
    `received_quantity` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,

    INDEX `idx_sup_txn_items_txn`(`transaction_id`),
    PRIMARY KEY (`st_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deposits` (
    `deposit_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `deposit_code` VARCHAR(50) NOT NULL,
    `order_id` VARCHAR(36) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `due_date` TIMESTAMP(0) NULL,
    `payment_date` TIMESTAMP(0) NULL,
    `payment_method` VARCHAR(100) NULL,
    `qr_code_url` TEXT NULL,
    `status` ENUM('PENDING', 'SUCCESS', 'OVERDUE', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `evidence_id` VARCHAR(36) NULL,
    `requested_by` VARCHAR(36) NOT NULL,
    `approved_by` VARCHAR(36) NULL,
    `approved_at` TIMESTAMP(0) NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `deposits_deposit_code_key`(`deposit_code`),
    INDEX `idx_deposits_order`(`order_id`),
    INDEX `idx_deposits_status`(`status`),
    PRIMARY KEY (`deposit_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settlements` (
    `settlement_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `order_id` VARCHAR(36) NOT NULL,
    `additional_fee` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `compensation` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `discount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `final_amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `payment_method` VARCHAR(100) NULL,
    `qr_code_url` TEXT NULL,
    `paid_at` TIMESTAMP(0) NULL,
    `evidence_id` VARCHAR(36) NULL,
    `status` ENUM('DRAFT', 'AGREED', 'REQUESTED', 'PAID', 'CONFIRMED') NOT NULL DEFAULT 'DRAFT',
    `requested_by` VARCHAR(36) NULL,
    `requested_at` TIMESTAMP(0) NULL,
    `confirmed_by` VARCHAR(36) NULL,
    `confirmed_at` TIMESTAMP(0) NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_settlements_order`(`order_id`),
    INDEX `idx_settlements_status`(`status`),
    PRIMARY KEY (`settlement_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `notification_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `user_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `content` TEXT NULL,
    `notification_type` ENUM('SYSTEM', 'ORDER', 'TASK', 'SCHEDULE', 'PAYMENT', 'SURVEY', 'INVENTORY', 'SUPPLIER', 'OTHER') NOT NULL DEFAULT 'SYSTEM',
    `ref_type` VARCHAR(100) NULL,
    `ref_id` VARCHAR(36) NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `read_at` TIMESTAMP(0) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_notifications_user`(`user_id`),
    INDEX `idx_notifications_is_read`(`is_read`),
    PRIMARY KEY (`notification_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `item_types` ADD CONSTRAINT `item_types_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `item_categories`(`category_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_type_id_fkey` FOREIGN KEY (`type_id`) REFERENCES `item_types`(`type_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `evidences` ADD CONSTRAINT `evidences_uploaded_by_fkey` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotations` ADD CONSTRAINT `quotations_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation_items` ADD CONSTRAINT `quotation_items_quotation_id_fkey` FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`quotation_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quotation_items` ADD CONSTRAINT `quotation_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`item_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_quotation_id_fkey` FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`quotation_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_policy_id_fkey` FOREIGN KEY (`policy_id`) REFERENCES `business_policies`(`policy_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`item_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_plans` ADD CONSTRAINT `schedule_plans_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_plans` ADD CONSTRAINT `schedule_plans_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `work_tasks`(`task_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_plans` ADD CONSTRAINT `schedule_plans_evidence_id_fkey` FOREIGN KEY (`evidence_id`) REFERENCES `evidences`(`evidence_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_plans` ADD CONSTRAINT `schedule_plans_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_plan_assignees` ADD CONSTRAINT `schedule_plan_assignees_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `schedule_plans`(`plan_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_plan_assignees` ADD CONSTRAINT `schedule_plan_assignees_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_assignee_id_fkey` FOREIGN KEY (`assignee_id`) REFERENCES `schedule_plan_assignees`(`assignee_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_check_in_evidence_id_fkey` FOREIGN KEY (`check_in_evidence_id`) REFERENCES `evidences`(`evidence_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `survey_reports` ADD CONSTRAINT `survey_reports_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `survey_reports` ADD CONSTRAINT `survey_reports_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `schedule_plans`(`plan_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `survey_reports` ADD CONSTRAINT `survey_reports_evidence_id_fkey` FOREIGN KEY (`evidence_id`) REFERENCES `evidences`(`evidence_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `survey_reports` ADD CONSTRAINT `survey_reports_reported_by_fkey` FOREIGN KEY (`reported_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `survey_reports` ADD CONSTRAINT `survey_reports_confirmed_by_fkey` FOREIGN KEY (`confirmed_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `change_requests` ADD CONSTRAINT `change_requests_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `change_request_items` ADD CONSTRAINT `change_request_items_change_request_id_fkey` FOREIGN KEY (`change_request_id`) REFERENCES `change_requests`(`change_request_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `change_request_items` ADD CONSTRAINT `change_request_items_catalog_item_id_fkey` FOREIGN KEY (`catalog_item_id`) REFERENCES `items`(`item_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_transactions` ADD CONSTRAINT `supplier_transactions_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`supplier_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_transactions` ADD CONSTRAINT `supplier_transactions_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_transaction_items` ADD CONSTRAINT `supplier_transaction_items_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `supplier_transactions`(`transaction_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_transaction_items` ADD CONSTRAINT `supplier_transaction_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`item_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deposits` ADD CONSTRAINT `deposits_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deposits` ADD CONSTRAINT `deposits_evidence_id_fkey` FOREIGN KEY (`evidence_id`) REFERENCES `evidences`(`evidence_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deposits` ADD CONSTRAINT `deposits_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deposits` ADD CONSTRAINT `deposits_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_evidence_id_fkey` FOREIGN KEY (`evidence_id`) REFERENCES `evidences`(`evidence_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_confirmed_by_fkey` FOREIGN KEY (`confirmed_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;
