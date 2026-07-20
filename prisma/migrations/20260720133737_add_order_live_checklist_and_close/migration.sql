-- AlterTable
-- Mốc 4 "Live Show" + Mốc 6 "Đóng đơn hàng" (docs/api/tiendosukien_api.md mục 5/7, đã chốt hướng A).
ALTER TABLE `orders`
    ADD COLUMN `live_show_checklist` JSON NULL,
    ADD COLUMN `closed_at` TIMESTAMP(0) NULL,
    ADD COLUMN `closed_by` VARCHAR(36) NULL;

-- CreateIndex
CREATE INDEX `idx_orders_closed_by` ON `orders`(`closed_by`);

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_closed_by_fkey` FOREIGN KEY (`closed_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;
