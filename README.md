# BNWEMS - Backend API

Đây là hệ thống Backend API (RESTful) dành cho dự án Quản lý Sự kiện (BNWEMS). Dự án sử dụng **Node.js**, **Express**, **TypeScript** và **Prisma ORM** kết nối với **MySQL**.
Hệ thống được thiết kế chặt chẽ theo **kiến trúc 5 layer** (Routes -> Controller -> Service -> Validators -> Repository) để đảm bảo dễ bảo trì và mở rộng.

---

## 🚀 1. Yêu cầu hệ thống (Prerequisites)
Để chạy dự án, bạn cần cài đặt:
- **Node.js**: Phiên bản 18.x trở lên.
- **npm** hoặc **yarn** hoặc **pnpm**.
- **MySQL**: (Có thể dùng cloud như Aiven hoặc cài local).

## 🛠️ 2. Hướng dẫn cài đặt và chạy dự án (Local Setup)

### Bước 1: Cài đặt thư viện
Mở terminal tại thư mục gốc của backend (`sep490-backend-api`) và chạy:
```bash
npm install
```

### Bước 2: Cấu hình biến môi trường
1. Copy file `.env.example` thành file `.env`.
   ```bash
   cp .env.example .env
   ```
2. Mở file `.env` và điền/sửa các thông tin cần thiết:
   - `DATABASE_URL`: Đường dẫn kết nối tới MySQL. (Ví dụ: `mysql://root:password@localhost:3306/bnwems`)
   - `PORT`: Mặc định là `3001` để không trùng với frontend (`3000`).
   - `JWT_SECRET`: Khóa bí mật dùng để tạo token (Bắt buộc phải có để tính năng Đăng nhập hoạt động).

### Bước 3: Đồng bộ Database Schema (Prisma)
Chạy lệnh sau để đẩy các bảng trong `schema.prisma` lên Database thật:
```bash
npx prisma db push
```
*(Sau lệnh này, Prisma Client cũng sẽ tự động được generate lại).*

### Bước 4: Chạy Seed Data (Dữ liệu mẫu)
Dự án đã chuẩn bị sẵn file `prisma/seed.ts` chứa dữ liệu liên kết E2E hoàn chỉnh.
⚠️ **LƯU Ý:** Lệnh này sẽ **XÓA SẠCH** dữ liệu cũ và tạo lại toàn bộ để tránh lỗi khóa ngoại. KHÔNG chạy lệnh này trên DB Production.
```bash
npm run seed
```

### Bước 5: Chạy Server (Development)
Chạy lệnh sau để khởi động server (có hot-reload bằng `nodemon`):
```bash
npm run dev
```
Nếu màn hình báo `Server is running on port 3001`, tức là bạn đã khởi động thành công!

---

## 🧪 3. Hướng dẫn chạy Unit / Integration Test
Dự án sử dụng **Jest** và **Supertest** để kiểm thử các luồng logic và phân quyền (Roles). Các file test được đặt trong thư mục `__tests__` của từng module.

Để chạy toàn bộ test, dùng lệnh:
```bash
npm test
```
*(Nếu trong test báo lỗi liên quan đến Database, hãy đảm bảo bạn đã chạy `npm run seed` thành công trước đó).*

---

## 📂 4. Cấu trúc thư mục (Kiến trúc 5 Layer)
Mã nguồn chính nằm trong `src/modules/`. Mỗi tính năng (domain) sẽ có 5 file cơ bản:
1. `*.repository.ts`: Tương tác trực tiếp với Database (gọi Prisma).
2. `*.validators.ts`: Chứa các Zod Schema để xác thực (validate) input từ req.body/req.query.
3. `*.service.ts`: Xử lý nghiệp vụ (Business Logic). Tầng này không gọi thẳng Prisma mà qua repository.
4. `*.controller.ts`: Tiếp nhận HTTP Request, gọi tầng service và trả về JSON. Bọc bằng `asyncHandler`.
5. `*.routes.ts`: Định nghĩa endpoint API, phân quyền (Role) thông qua middleware.

### Các Module chính hiện có:
- **Identity**: Quản lý Xác thực (Login, User Profile).
- **Sales**: Quản lý Khách hàng, Báo giá, Đơn đặt hàng.
- **Operations**: Quản lý Kế hoạch, Phân công, Khảo sát, Tiến độ sự kiện.
- **Inventory**: Quản lý Kho vận, Thiết bị.

---

## ⚠️ 5. Khắc phục sự cố thường gặp (Troubleshooting)

- **Lỗi `EADDRINUSE: address already in use :::3001`**:
  Do cổng 3001 đang bị chiếm bởi một tiến trình node ẩn. Hãy mở PowerShell chạy lệnh:
  `Stop-Process -Name "node" -Force` để tắt tiến trình đó.
- **Lỗi `PrismaClientKnownRequestError` khi thao tác DB**:
  Hãy kiểm tra xem bạn đã cấu hình đúng `DATABASE_URL` chưa, hoặc hãy chạy lại `npx prisma db push`.
- **Lỗi `DB_ERROR` hoặc 401/403 lúc test API**:
  Chắc chắn rằng bạn truyền đúng `Authorization: Bearer <token>` vào Headers. Để lấy token, hãy login bằng các user có trong Seed data (admin/manager/leader/tech - pass: `123456`).
