-- DropForeignKey
ALTER TABLE `supplier_transactions` DROP FOREIGN KEY `supplier_transactions_order_id_fkey`;

-- AlterTable
ALTER TABLE `supplier_transactions` MODIFY `order_id` VARCHAR(36) NULL;

-- AddForeignKey
ALTER TABLE `supplier_transactions` ADD CONSTRAINT `supplier_transactions_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`order_id`) ON DELETE SET NULL ON UPDATE CASCADE;
