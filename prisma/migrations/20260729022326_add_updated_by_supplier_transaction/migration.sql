-- AlterTable
ALTER TABLE `supplier_transactions` ADD COLUMN `updated_by` VARCHAR(36) NULL;

-- AddForeignKey
ALTER TABLE `supplier_transactions` ADD CONSTRAINT `supplier_transactions_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;
