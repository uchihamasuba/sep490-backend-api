/*
  Warnings:

  - The values [IN_PROGRESS] on the enum `supplier_transactions_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `supplier_transactions` MODIFY `status` ENUM('PENDING', 'APPROVED', 'RECEIVED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';
