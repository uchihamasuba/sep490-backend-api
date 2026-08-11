#!/bin/sh
# Entrypoint container API: đồng bộ schema lên DB rồi khởi động app.
# - Lặp `prisma db push` cho tới khi MySQL nhận kết nối (phòng hờ, dù compose đã đợi healthcheck).
# - `--accept-data-loss`: tránh prompt tương tác trong container (DB test, chấp nhận đổi cột).
# - Seed chỉ chạy khi RUN_SEED=true (seed XÓA sạch dữ liệu — không tự chạy để tránh mất dữ liệu).
set -e

echo "⏳ Đồng bộ schema vào DB (prisma db push)..."
i=0
until npx prisma db push --skip-generate --accept-data-loss 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "❌ Không kết nối được DB sau 30 lần thử — kiểm tra service 'db' và DATABASE_URL."
    exit 1
  fi
  echo "   DB chưa sẵn sàng (lần $i), thử lại sau 3s..."
  sleep 3
done
echo "✅ Schema đã đồng bộ."

# Đảm bảo Prisma Client khớp schema (rẻ, an toàn khi source được bind-mount).
npx prisma generate >/dev/null 2>&1 || true

if [ "$RUN_SEED" = "true" ]; then
  echo "🌱 RUN_SEED=true → chạy seed (XÓA & tạo lại dữ liệu mẫu)..."
  npm run seed
fi

echo "🚀 Khởi động API: $*"
exec "$@"
