# Kế Hoạch Triển Khai BNWEMS Backend API (Node.js / TypeScript)

Bản kế hoạch này tuân thủ kiến trúc **Layered Feature Modules** (`routes` -> `controller` -> `service` -> `repository` -> `data layer`) và sơ đồ cơ sở dữ liệu **28 bảng** của dự án Binh Nguyen Wedding & Event Management System (BNWEMS). Đặc biệt, kế hoạch được tinh chỉnh để tương thích hoàn toàn với frontend hiện tại (`sep490-web-frontend`), phân rã theo 2 migrations, sử dụng mock data làm seed, và thay thế mock API bằng kết nối thật.

Mục tiêu: Cung cấp checklist cực kỳ chi tiết để **Claude Code Extension** có thể đọc và thực thi từng bước. **Đặc biệt lưu ý các điểm "DỪNG LẠI KIỂM TRA THỦ CÔNG"** để team test UI với frontend đảm bảo không bị lỗi phụ thuộc.
*Nguyên tắc Tối thượng:* **KHÔNG ĐƯỢC PHÉP làm thay đổi giao diện hay chức năng UI của Frontend.** Nếu API backend nào code xong gặp khó khăn trong việc khớp dữ liệu hoặc làm vỡ giao diện, phải LẬP TỨC fallback (giữ nguyên giả lập mock data) cho riêng phần đó để UI không bị lỗi. Những chức năng bị lỗi khớp này sẽ được đẩy xuống code sau cùng khi toàn bộ các phần khác đã chạy thành công.

---

## 1. Phân Chia Module & Kiến Trúc Bổ Sung (Repository Layer)

Hệ thống sử dụng tầng **Repository** để cô lập hoàn toàn logic truy vấn ORM khỏi Business Logic.
Luồng xử lý chuẩn: `Router` (nhận request, validate) -> `Controller` (điều phối mỏng) -> `Service` (nghiệp vụ cốt lõi) -> **`Repository`** (truy vấn Prisma) -> `Database`.

Các module chia theo 2 giai đoạn Migration:

**Migration 1 (Core - 24 bảng):**
1. **`identity/`**: `users`, `customers`, `suppliers`, `business_policies`
2. **`catalog/`**: `item_categories`, `item_types`, `items`
3. **`sales/`**: `quotations`, `quotation_items`, `orders`, `order_items`
4. **`operations/`**: `work_tasks`, `schedule_plans`, `schedule_plan_assignees`, `attendances`, `survey_reports`, `change_requests`, `change_request_items`
5. **`procurement/`**: `supplier_transactions`, `supplier_transaction_items`
6. **`finance/`**: `deposits`, `settlements`
7. **`shared/`**: `evidences`, `notifications`, `reports` (Dashboard)

**Migration 2 (Warehouse Logistics - 4 bảng):**
8. **`warehouse/`**: `inventory`, `inventory_movements`, `collected_equipment_reports`, `collected_equipment_report_items`

---

## 2. Phân Tích Cụm Chức Năng Để Kiểm Thử (Testable Clusters)

Để đảm bảo code xong module nào thì test được UI module đó mà không gặp lỗi thiếu bảng/thiếu dữ liệu tham chiếu chéo, ta chia việc thực thi thành các cụm (Cluster) logic như sau:
- **Cụm 1 (Nền tảng):** Identity, Shared. (Hoạt động độc lập)
- **Cụm 2 (Danh mục):** Catalog. (Cần Cụm 1)
- **Cụm 3 (Kinh doanh):** Sales, Procurement. (Bắt buộc phải có Cụm 1, 2 để tránh lỗi khóa ngoại khi tạo đơn hàng từ Customer và Items)
- **Cụm 4 (Vận hành & Tài chính):** Operations, Finance. (Bắt buộc phải có Cụm 3 để gắn thao tác lên các Order có sẵn)
- **Cụm 5 (Kho vận - Migration 2):** Warehouse. (Dựa trên lịch sử xuất/nhập của Cụm 3 và 4)

---

## 3. Các Bước Cài Đặt và Checklist Code Chi Tiết

### Phase 1: Khởi Tạo Dự Án & Core Infrastructure
- [x] **Task 1.1: Khởi tạo Project & Cài đặt dependencies**
  - Chạy `npm init -y`.
  - Cài đặt: `express`, `cors`, `helmet`, `dotenv`, `zod`, `pino`, `jsonwebtoken`, `bcrypt`, `prisma`, `@prisma/client`.
  - DevDependencies: `typescript`, `@types/node`, `@types/express`, `@types/cors`, `ts-node`, `nodemon`.
  - Chạy `npx prisma init` để khởi tạo thư mục `prisma/` và file `schema.prisma`.
- [x] **Task 1.2: Cấu hình TS & Cấu trúc thư mục**
  - Tạo `tsconfig.json`. Tạo các thư mục `src/config`, `src/middleware`, `src/db`, `src/modules`, `src/utils`, `src/types`.
- [x] **Task 1.3: Utils & Middleware Cốt lõi**
  - Cấu hình biến môi trường (`env.ts` với Zod).
  - Utils: `AppError.ts`, `response.ts`, `asyncHandler.ts`, `logger.ts`.
  - Middleware: `error.ts` (global error handler), `notFound.ts`, `validate.ts`, `auth.ts`.
- [x] **Task 1.4: Cấu hình biến môi trường thủ công (`.env`)**
  - Tạo file `.env` ở thư mục gốc của backend.
  - Dừng lại để người dùng cấu hình biến `DATABASE_URL` trỏ tới kết nối MySQL thật.
  - Dừng lại để người dùng cấu hình các biến Firebase (ví dụ: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` hoặc chuỗi config tương đương) để kết nối Firebase Storage thật phục vụ việc upload ảnh minh chứng.
- [x] **Task 1.5: Gắn Root App & Lắng Nghe**
  - Định nghĩa `routes.ts` gom các router. Khởi tạo `app.ts` và lắng nghe ở `server.ts` (cổng 3001).
  - Cấu hình Frontend (ở `sep490-web-frontend/.env.local`): Cấu hình `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1`.
  - Quản lý linh hoạt biến `NEXT_PUBLIC_MOCK_MODE` hoặc chỉnh `mockAdapter.ts`: những chức năng đã làm xong và khớp thì trỏ tới backend thật, chức năng nào chưa làm hoặc làm bị vỡ UI thì bắt buộc phải giữ nguyên để chạy giả lập mock data.

### Phase 2: Khởi Tạo Database & Seed Data
- [x] **Task 2.1: Đồng bộ dữ liệu Mock từ Frontend sang Backend Seed**
  - Trích xuất dữ liệu từ `sep490-web-frontend/src/mocks/db/*` và `sep490-web-frontend/src/mocks/apiFixtures.ts`.
  - Tạo file `prisma/seed.ts` để nạp các dữ liệu này vào DB backend (Users, Categories, Types, Items, Customers, Orders...).
  - Bổ sung cấu hình chạy seed vào `package.json`: `"prisma": { "seed": "ts-node prisma/seed.ts" }`.
- [x] **Task 2.2: Định nghĩa Prisma Schema (Core)**
  - Ánh xạ 24 bảng lõi từ `001_core.sql` vào `schema.prisma`. Bỏ 4 bảng Kho vận.
  - Chạy `npx prisma migrate dev --name init_core` và `npx prisma db seed`.

### Phase 3: Thực Thi Code Theo Cụm (Migration 1)
*Sau mỗi Task dưới đây, hệ thống phải thông báo dừng lại để mang qua cho thành viên khác test thủ công trên giao diện Frontend.*

- [ ] **Task 3.1: Cụm 1 - Nền tảng (Identity & Shared)**
  - Code đủ 5 file (`.routes`, `.controller`, `.service`, `.repository`, `.validators`) cho Auth, Users, Customers, Policies, Suppliers, Evidences.
  - Viết script test nhanh (dùng `.http` script, Postman collection, hoặc Jest/Supertest) để gọi qua các API vừa viết, đảm bảo server không crash và JSON trả về đúng chuẩn.
  - 🛑 **DỪNG LẠI KIỂM TRA THỦ CÔNG:** Mang qua cho nhóm test UI bằng Frontend (Đăng nhập, lấy profile, xem danh sách, upload ảnh).

- [ ] **Task 3.2: Cụm 2 - Danh mục (Catalog)**
  - Code module Catalog (Categories, Types, Items).
  - Viết script test nhanh (cURL/.http/Jest) để gọi thử các API tạo mới danh mục, xem danh sách thiết bị. Đảm bảo API trả về 200/201.
  - 🛑 **DỪNG LẠI KIỂM TRA THỦ CÔNG:** Test UI quản lý danh mục và thiết bị trên Frontend, xem thiết bị có tải ra trang đúng cấu trúc dữ liệu không.

- [ ] **Task 3.3: Cụm 3 - Kinh doanh (Sales & Procurement)**
  - Code API Quotations, Orders, Supplier Transactions.
  - Nhờ có sẵn data Customer & Items (từ Seed và Cụm 1,2), hệ thống sẽ không bị vỡ lỗi khóa ngoại khi chạy tính năng.
  - Viết script test nhanh tạo thử Báo giá, Đơn hàng qua API. Xác nhận HTTP 201 Created và luồng lưu khóa ngoại đúng.
  - 🛑 **DỪNG LẠI KIỂM TRA THỦ CÔNG:** Test UI flow tạo Báo giá, chốt Đơn hàng, lập Phiếu Thuê/Mua ngoài từ Nhà Cung Cấp.

- [ ] **Task 3.4: Cụm 4 - Vận hành & Tài chính (Operations & Finance & Reports)**
  - Code API Work Tasks, Surveys, Change Requests, Schedule Plans, Attendance, Mobile APIs.
  - Code API Deposits, Settlements. Cắm logic biểu đồ Dashboard.
  - Chạy smoke test các endpoint quan trọng như Check-in, tạo phiếu cọc, và lấy API Dashboard. Đảm bảo dữ liệu tính toán tổng nợ/tồn khớp.
  - 🛑 **DỪNG LẠI KIỂM TRA THỦ CÔNG:** Test UI App Mobile (Attendance check-in, Schedule), test ghi nhận cọc, thanh toán quyết toán, lấy dữ liệu bảng thống kê trên Frontend.

### Phase 4: Migration 2 (Warehouse Logistics)
*Chỉ thực hiện khi các cụm trước đã test thành công để tránh lỗi hệ thống.*
- [ ] **Task 4.1: Định nghĩa Prisma Schema (Warehouse)**
  - Bổ sung 4 bảng Kho vận (`inventory`, `inventory_movements`, `collected_equipment_reports`, `collected_equipment_report_items`) vào `schema.prisma`.
  - Chạy `npx prisma migrate dev --name init_warehouse`.
- [ ] **Task 4.2: Code Cụm 5 - Kho vận**
  - Code module Warehouse (Inventory, báo cáo thu hồi).
  - Chạy script test API xuất/nhập tồn kho tự động. Đảm bảo logic Trừ kho/Cộng kho hoạt động đúng trong Database.
  - 🛑 **DỪNG LẠI KIỂM TRA THỦ CÔNG:** Test UI xem tồn kho, luồng kiểm tra logic trừ kho khi đơn hàng được confirm, luồng nhập lại kho khi thu hồi đồ đạc trên Frontend.

### Phase 5: Tài Liệu Hóa (Documentation)
- [ ] **Task 5.1: Xây dựng file `README.md`**
  - Tạo file `README.md` ở thư mục gốc backend.
  - Mô tả toàn bộ cấu trúc file/thư mục hiện tại của hệ thống.
  - Viết hướng dẫn thực hành dự án rõ ràng bao gồm:
    - Cách cài đặt các dependencies.
    - Cấu hình file `.env` (DB & Firebase).
    - Lệnh chạy Database Migration và nạp dữ liệu Seed.
    - Lệnh chạy server môi trường Dev và lệnh Build/Start trên Production.

---
## Lời Khuyên & Bắt Buộc Đối Với Claude Code
- **Repository Layer:** Lớp Service KHÔNG ĐƯỢC gọi lệnh `prisma.xxx` trực tiếp. Bắt buộc gọi qua các hàm của Repository.
- **Testing Checkpoints:** Tại mỗi bước có cờ 🛑 **DỪNG LẠI KIỂM TRA THỦ CÔNG**, Claude Code phải dừng thực thi, chủ động hỏi người dùng kết quả duyệt UI rồi mới đi tiếp sang Task sau.
- **Bảo Toàn Frontend (Cơ Chế Fallback):** API Endpoint, Method, và Cấu trúc JSON Response bắt buộc phải khớp 100% với định dạng mà `mockAdapter.ts` của frontend đang trả về. Tuyệt đối KHÔNG sửa code frontend để ép nó chạy theo backend. TRONG TRƯỜNG HỢP backend gặp lỗi hoặc không thể khớp đúng JSON shape dẫn tới vỡ UI, **PHẢI GIỮ NGUYÊN kết nối mock data của chức năng đó** để hệ thống frontend chạy bình thường. Quyết định lùi phần API backend bị lỗi đó lại và sẽ giải quyết sau khi toàn bộ các Cụm khác đã code và test thành công trót lọt.
