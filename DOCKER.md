# Chạy Backend + Database bằng Docker

Bộ này dựng nhanh **MySQL 8 + API** để test, không cần cài Node/MySQL trên máy. Sửa code trong `src/` là app **tự reload**.

## Yêu cầu
- Docker Desktop (đã bật). Kiểm tra: `docker --version` và `docker compose version`.

## Chạy lần đầu (kèm dữ liệu mẫu)

Trong thư mục `BE/`:

```bash
RUN_SEED=true docker compose up --build
```

- `--build`: build image API lần đầu.
- `RUN_SEED=true`: nạp dữ liệu mẫu (tài khoản `admin` / `manager` / `staff1..staff10`, mật khẩu `123456`).
- Xong khi log hiện: `Server running on port 3001`.

> ⚠️ `RUN_SEED=true` **xóa sạch** dữ liệu rồi tạo lại. Các lần sau chỉ cần `docker compose up` (không kèm seed) để giữ dữ liệu.

## Các lần sau

```bash
docker compose up
```

Chạy nền: `docker compose up -d`.

## Địa chỉ sau khi chạy
- API: `http://localhost:3001` (thử: `http://localhost:3001/api/v1/auth/login`)
- MySQL: `localhost:3307` (user `bnwems` / pass `bnwems` / db `bnwems`) — cắm DBeaver/TablePlus vào đây.

## Kiểm tra nhanh (login lấy token)

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}'
```

## Lệnh hay dùng

```bash
docker compose logs -f api        # xem log API
docker compose exec api sh        # vào shell container API
docker compose exec api npm run seed   # seed lại thủ công (xóa & tạo lại dữ liệu)
docker compose exec api npm test       # chạy test trong container
docker compose down               # dừng & xóa container (GIỮ dữ liệu DB)
docker compose down -v            # dừng & XÓA luôn dữ liệu DB (reset sạch)
```

## Secret tùy chọn (Firebase / SMTP / bank)
Firebase (upload ảnh minh chứng + push) và SMTP (mời/nhắc qua email) là **tùy chọn** — thiếu vẫn boot, chỉ các tính năng đó trả lỗi khi gọi.

Ở chế độ dev mặc định (bind-mount `.:/app`), nếu `BE/.env` đã có sẵn thì app **tự đọc** các biến `FIREBASE_*` / `SMTP_*` / `COMPANY_BANK_*` từ đó — **không cần làm gì thêm**. Compose chỉ ghi đè `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGIN` nên `DATABASE_URL` luôn trỏ đúng service `db` (không bị `.env` localhost làm hỏng).

> - dotenv **không ghi đè** biến đã tồn tại → giá trị do compose cấp luôn thắng biến trùng tên trong `.env`.
> - Nếu chạy KHÔNG bind-mount (kiểu prod): bỏ comment `env_file: - .env` trong service `api` để nạp secret.
> - ⚠️ Compose tự đọc `./.env` để nội suy biến — mọi dòng có ký tự đặc biệt (`<`, `>`, khoảng trắng) phải **bọc trong ngoặc kép**, ví dụ `SMTP_FROM="Tên <mail@x.com>"`, nếu không `docker compose` sẽ báo lỗi parse.

## Đổi cấu hình (tùy chọn)
Đặt biến trước lệnh hoặc trong file `.env` cạnh compose:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `DB_HOST_PORT` | `3307` | Cổng host map tới MySQL |
| `MYSQL_DATABASE` / `MYSQL_USER` / `MYSQL_PASSWORD` | `bnwems` | Thông tin DB |
| `JWT_SECRET` | secret dev | Khóa ký JWT (đổi khi thật) |
| `CORS_ORIGIN` | `http://localhost:3000` | Origin FE được phép |
| `RUN_SEED` | `false` | `true` = seed lúc khởi động |

## Xử lý sự cố
- **Cổng 3001 hoặc 3307 bận** → đổi cổng host: `DB_HOST_PORT=3308 docker compose up`, hoặc sửa `ports` service `api`.
- **Sửa code không reload** → đã bật `CHOKIDAR_USEPOLLING`; nếu vẫn kẹt, `docker compose restart api`.
- **Đổi schema Prisma** → app tự chạy `prisma db push` lúc khởi động; nếu cần ép: `docker compose exec api npx prisma db push`.
- **Reset toàn bộ** → `docker compose down -v` rồi `RUN_SEED=true docker compose up --build`.
