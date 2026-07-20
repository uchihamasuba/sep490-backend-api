-- AlterTable
ALTER TABLE `business_policies` MODIFY `policy_type` ENUM('DEPOSIT', 'CANCELLATION', 'COMPENSATION', 'FEE', 'WAGE') NOT NULL;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `picked_up_at` TIMESTAMP(0) NULL,
    ADD COLUMN `picked_up_by` VARCHAR(36) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `employee_code` VARCHAR(10) NULL,
    ADD COLUMN `job_title` VARCHAR(100) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `users_employee_code_key` ON `users`(`employee_code`);

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_picked_up_by_fkey` FOREIGN KEY (`picked_up_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

