/*
  Warnings:

  - You are about to drop the column `supplied_price` on the `supplier_items` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `supplier_items` DROP COLUMN `supplied_price`,
    ADD COLUMN `purchase_price` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `rental_price` DECIMAL(14, 2) NOT NULL DEFAULT 0;
