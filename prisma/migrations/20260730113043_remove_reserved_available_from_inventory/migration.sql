/*
  Warnings:

  - You are about to drop the column `quantity_available` on the `inventory` table. All the data in the column will be lost.
  - You are about to drop the column `quantity_reserved` on the `inventory` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `inventory` DROP COLUMN `quantity_available`,
    DROP COLUMN `quantity_reserved`;
