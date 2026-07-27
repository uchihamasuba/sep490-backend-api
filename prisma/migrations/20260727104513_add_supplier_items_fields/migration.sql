-- AlterTable
ALTER TABLE `supplier_items` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `min_quantity` INTEGER NULL,
    ADD COLUMN `supplied_price` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `supplier_item_code` VARCHAR(50) NULL;
