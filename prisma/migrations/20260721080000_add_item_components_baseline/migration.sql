-- Baseline migration (docs/api/more-require.md mục (ag)) — cột `items.components` đã tồn tại sẵn trên
-- DB dùng chung (Aiven MySQL) trước khi migration này được viết, không qua Prisma Migrate (không có
-- migration nào commit trước đó tạo ra nó — xác nhận qua `_prisma_migrations`/`SHOW CREATE TABLE items`
-- ngày 2026-07-21). File này ghi lại đúng DDL tương ứng để migration history khớp DB thật, đồng thời để
-- các môi trường mới (CI, máy khác) tạo lại đúng cột này khi chạy `prisma migrate deploy` từ đầu.
--
-- AlterTable
ALTER TABLE `items` ADD COLUMN `components` JSON NULL;
