-- CreateTable
CREATE TABLE `inventory` (
    `inventory_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `item_id` VARCHAR(36) NOT NULL,
    `quantity_total` INTEGER NOT NULL DEFAULT 0,
    `quantity_damaged` INTEGER NOT NULL DEFAULT 0,
    `quantity_reserved` INTEGER NOT NULL DEFAULT 0,
    `quantity_available` INTEGER NOT NULL DEFAULT 0,
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `inventory_item_id_key`(`item_id`),
    PRIMARY KEY (`inventory_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_movements` (
    `movement_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `item_id` VARCHAR(36) NOT NULL,
    `order_id` VARCHAR(36) NULL,
    `report_id` VARCHAR(36) NULL,
    `movement_type` ENUM('OUTBOUND', 'INBOUND', 'ADJUSTMENT') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `performed_by` VARCHAR(36) NOT NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_inv_mov_item`(`item_id`),
    INDEX `idx_inv_mov_order`(`order_id`),
    INDEX `idx_inv_mov_report`(`report_id`),
    PRIMARY KEY (`movement_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collected_equipment_reports` (
    `report_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `order_id` VARCHAR(36) NOT NULL,
    `report_type` ENUM('INTERNAL', 'SUPPLIER') NOT NULL,
    `transaction_id` VARCHAR(36) NULL,
    `status` ENUM('SUBMITTED', 'CONFIRMED') NOT NULL DEFAULT 'SUBMITTED',
    `reported_by` VARCHAR(36) NOT NULL,
    `confirmed_by` VARCHAR(36) NULL,
    `confirmed_at` TIMESTAMP(0) NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_cer_order`(`order_id`),
    INDEX `idx_cer_transaction`(`transaction_id`),
    PRIMARY KEY (`report_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collected_equipment_report_items` (
    `cer_item_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `report_id` VARCHAR(36) NOT NULL,
    `item_id` VARCHAR(36) NOT NULL,
    `good_quantity` INTEGER NOT NULL DEFAULT 0,
    `damaged_quantity` INTEGER NOT NULL DEFAULT 0,
    `lost_quantity` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,

    INDEX `idx_cer_items_report`(`report_id`),
    INDEX `idx_cer_items_item`(`item_id`),
    PRIMARY KEY (`cer_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`item_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`item_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_report_id_fkey` FOREIGN KEY (`report_id`) REFERENCES `collected_equipment_reports`(`report_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_performed_by_fkey` FOREIGN KEY (`performed_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collected_equipment_reports` ADD CONSTRAINT `collected_equipment_reports_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collected_equipment_reports` ADD CONSTRAINT `collected_equipment_reports_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `supplier_transactions`(`transaction_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collected_equipment_reports` ADD CONSTRAINT `collected_equipment_reports_reported_by_fkey` FOREIGN KEY (`reported_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collected_equipment_reports` ADD CONSTRAINT `collected_equipment_reports_confirmed_by_fkey` FOREIGN KEY (`confirmed_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collected_equipment_report_items` ADD CONSTRAINT `collected_equipment_report_items_report_id_fkey` FOREIGN KEY (`report_id`) REFERENCES `collected_equipment_reports`(`report_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collected_equipment_report_items` ADD CONSTRAINT `collected_equipment_report_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`item_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
