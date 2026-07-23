/*
  Warnings:

  - You are about to drop the column `components` on the `items` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `items` DROP COLUMN `components`;

-- CreateTable
CREATE TABLE `item_components` (
    `id` VARCHAR(36) NOT NULL DEFAULT (uuid()),
    `parent_id` VARCHAR(36) NOT NULL,
    `child_id` VARCHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,

    INDEX `idx_item_components_parent`(`parent_id`),
    INDEX `idx_item_components_child`(`child_id`),
    UNIQUE INDEX `item_components_parent_id_child_id_key`(`parent_id`, `child_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `item_components` ADD CONSTRAINT `item_components_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `items`(`item_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_components` ADD CONSTRAINT `item_components_child_id_fkey` FOREIGN KEY (`child_id`) REFERENCES `items`(`item_id`) ON DELETE CASCADE ON UPDATE CASCADE;
