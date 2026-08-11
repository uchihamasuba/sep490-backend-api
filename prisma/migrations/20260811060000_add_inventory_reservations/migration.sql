-- CreateTable
CREATE TABLE `inventory_reservations` (
    `reservation_id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `item_id` VARCHAR(36) NOT NULL,
    `order_id` VARCHAR(36) NULL,
    `quotation_id` VARCHAR(36) NULL,
    `quantity` INTEGER NOT NULL,
    `start_at` TIMESTAMP(0) NOT NULL,
    `end_at` TIMESTAMP(0) NOT NULL,
    `status` ENUM('HELD', 'CONFIRMED', 'RELEASED', 'CONSUMED') NOT NULL DEFAULT 'CONFIRMED',
    `created_by` VARCHAR(36) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_resv_item_window`(`item_id`, `status`, `start_at`, `end_at`),
    INDEX `idx_resv_order`(`order_id`),
    PRIMARY KEY (`reservation_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `inventory_reservations` ADD CONSTRAINT `inventory_reservations_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`item_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_reservations` ADD CONSTRAINT `inventory_reservations_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_reservations` ADD CONSTRAINT `inventory_reservations_quotation_id_fkey` FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`quotation_id`) ON DELETE SET NULL ON UPDATE CASCADE;

