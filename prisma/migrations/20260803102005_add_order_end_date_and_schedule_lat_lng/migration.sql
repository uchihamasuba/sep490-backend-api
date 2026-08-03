-- AlterTable
ALTER TABLE `orders` ADD COLUMN `end_date` TIMESTAMP(0) NULL;

-- AlterTable
ALTER TABLE `schedule_plans` ADD COLUMN `latitude` FLOAT NULL,
    ADD COLUMN `longitude` FLOAT NULL;
