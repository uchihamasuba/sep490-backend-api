-- CreateTable
CREATE TABLE `supplier_items` (
    `supplier_id` VARCHAR(36) NOT NULL,
    `item_id` VARCHAR(36) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_supplier_items_supplier`(`supplier_id`),
    INDEX `idx_supplier_items_item`(`item_id`),
    PRIMARY KEY (`supplier_id`, `item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `supplier_items` ADD CONSTRAINT `supplier_items_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`supplier_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_items` ADD CONSTRAINT `supplier_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`item_id`) ON DELETE CASCADE ON UPDATE CASCADE;
