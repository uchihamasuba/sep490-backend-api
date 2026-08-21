-- Tự động kiểm tra và thêm cột isManagerViewed nếu nó chưa tồn tại.
-- Đảm bảo an toàn khi chạy qua docker compose (migrate deploy) nhiều lần trên DB đã có cột.

DROP PROCEDURE IF EXISTS AddIsManagerViewedColumn;

CREATE PROCEDURE AddIsManagerViewedColumn()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'quotations'
        AND COLUMN_NAME = 'isManagerViewed'
    ) THEN
        ALTER TABLE `quotations` ADD COLUMN `isManagerViewed` BOOLEAN NOT NULL DEFAULT false;
    END IF;
END;

CALL AddIsManagerViewedColumn();

DROP PROCEDURE AddIsManagerViewedColumn;
