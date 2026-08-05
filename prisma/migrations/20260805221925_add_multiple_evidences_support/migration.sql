/*
  Warnings:

  - You are about to drop the column `evidence_id` on the `deposits` table. All the data in the column will be lost.
  - You are about to drop the column `evidence_id` on the `schedule_plans` table. All the data in the column will be lost.
  - You are about to drop the column `evidence_id` on the `settlements` table. All the data in the column will be lost.
  - You are about to drop the column `evidence_id` on the `survey_reports` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `deposits` DROP FOREIGN KEY `deposits_evidence_id_fkey`;

-- DropForeignKey
ALTER TABLE `schedule_plans` DROP FOREIGN KEY `schedule_plans_evidence_id_fkey`;

-- DropForeignKey
ALTER TABLE `settlements` DROP FOREIGN KEY `settlements_evidence_id_fkey`;

-- DropForeignKey
ALTER TABLE `survey_reports` DROP FOREIGN KEY `survey_reports_evidence_id_fkey`;

-- DropIndex
DROP INDEX `deposits_evidence_id_fkey` ON `deposits`;

-- DropIndex
DROP INDEX `schedule_plans_evidence_id_fkey` ON `schedule_plans`;

-- DropIndex
DROP INDEX `settlements_evidence_id_fkey` ON `settlements`;

-- DropIndex
DROP INDEX `survey_reports_evidence_id_fkey` ON `survey_reports`;

-- AlterTable
ALTER TABLE `deposits` DROP COLUMN `evidence_id`;

-- AlterTable
ALTER TABLE `schedule_plans` DROP COLUMN `evidence_id`;

-- AlterTable
ALTER TABLE `settlements` DROP COLUMN `evidence_id`;

-- AlterTable
ALTER TABLE `survey_reports` DROP COLUMN `evidence_id`;

-- CreateTable
CREATE TABLE `schedule_plan_evidences` (
    `plan_id` VARCHAR(36) NOT NULL,
    `evidence_id` VARCHAR(36) NOT NULL,

    PRIMARY KEY (`plan_id`, `evidence_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `survey_report_evidences` (
    `survey_id` VARCHAR(36) NOT NULL,
    `evidence_id` VARCHAR(36) NOT NULL,

    PRIMARY KEY (`survey_id`, `evidence_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deposit_evidences` (
    `deposit_id` VARCHAR(36) NOT NULL,
    `evidence_id` VARCHAR(36) NOT NULL,

    PRIMARY KEY (`deposit_id`, `evidence_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settlement_evidences` (
    `settlement_id` VARCHAR(36) NOT NULL,
    `evidence_id` VARCHAR(36) NOT NULL,

    PRIMARY KEY (`settlement_id`, `evidence_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `schedule_plan_evidences` ADD CONSTRAINT `schedule_plan_evidences_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `schedule_plans`(`plan_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_plan_evidences` ADD CONSTRAINT `schedule_plan_evidences_evidence_id_fkey` FOREIGN KEY (`evidence_id`) REFERENCES `evidences`(`evidence_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `survey_report_evidences` ADD CONSTRAINT `survey_report_evidences_survey_id_fkey` FOREIGN KEY (`survey_id`) REFERENCES `survey_reports`(`survey_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `survey_report_evidences` ADD CONSTRAINT `survey_report_evidences_evidence_id_fkey` FOREIGN KEY (`evidence_id`) REFERENCES `evidences`(`evidence_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deposit_evidences` ADD CONSTRAINT `deposit_evidences_deposit_id_fkey` FOREIGN KEY (`deposit_id`) REFERENCES `deposits`(`deposit_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deposit_evidences` ADD CONSTRAINT `deposit_evidences_evidence_id_fkey` FOREIGN KEY (`evidence_id`) REFERENCES `evidences`(`evidence_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlement_evidences` ADD CONSTRAINT `settlement_evidences_settlement_id_fkey` FOREIGN KEY (`settlement_id`) REFERENCES `settlements`(`settlement_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlement_evidences` ADD CONSTRAINT `settlement_evidences_evidence_id_fkey` FOREIGN KEY (`evidence_id`) REFERENCES `evidences`(`evidence_id`) ON DELETE CASCADE ON UPDATE CASCADE;
