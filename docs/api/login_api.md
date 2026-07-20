# API Đăng nhập / Xác thực (Auth) — Web Frontend

> Tài liệu mô tả các API mà `src/context/AuthContext.tsx`, `src/services/auth.service.ts` và
> `src/app/auth/login/page.tsx` cần backend cung cấp.
>
> **Trạng thái: ĐÃ CODE & ĐÃ TEST END-TO-END** (không phải đề xuất chờ backend làm) — module
> `identity` được tạo và test bằng curl với DB thật (Aiven) ngày 2026-07-20, tại
> `D:\sep490-backend-api\src\modules\identity\` (`user.repository.ts`, `auth.validators.ts`,
> `auth.service.ts`, `auth.controller.ts`, `auth.routes.ts`), đăng ký vào `src/routes.ts`.
> **Đã đối chiếu lại độc lập trong phiên này (2026-07-20)** — đọc trực tiếp code 4 file trên + so khớp
> field-by-field với DB thật qua MySQL MCP (`SELECT * FROM users`, `SHOW CREATE TABLE users`): khớp
> hoàn toàn, không phát hiện lệch mới. Xem thêm mục 5.
>
> ⚠️ **Có 1 repo backend KHÁC dễ gây nhầm lẫn**: `D:\bnwems-backend-api` (nhánh
> `feature/align-new-api-contracts-and-test`) cũng có route `POST /auth/login`
> (`src/routes/auth.route.ts` → `auth.service.ts` → `prisma.internalUser`), nhưng Prisma schema của
> repo đó map vào bảng `internal_users` (khóa `BigInt`) — bảng này **không tồn tại** trên DB thật (DB
> thật chỉ có bảng `users`, khóa `VARCHAR(36)` UUID, xem mục 1). Migration của repo đó
> (`init`/`add_role_status`/`sync_schema_and_constraints`) cũng không khớp migration thật sự đã chạy
> trên DB (`20260718230757_init_core`). Nếu lỡ start nhầm backend này, `/auth/login` sẽ lỗi ngay ở tầng
> Prisma (bảng không tồn tại) dù FE gọi đúng. **Backend đúng cần chạy là `D:\sep490-backend-api`**
> (migration `20260718230757_init_core` khớp chính xác DB thật).
>
> Viết dựa trên: code FE hiện tại + code backend đã implement ở `D:\sep490-backend-api` (nguồn chính
> xác nhất, không dựa vào `docs/api/01-auth.md` — file đó **không tồn tại** trong repo này, các comment
> trong `src/types/auth.ts` trỏ tới nó và tới `D:\bnwems-backend-api` là tham chiếu tới vị trí backend
> cũ/sai, đã lỗi thời — xem cảnh báo ở trên).

## 0. Base URL & Auth

- Base path: `/api/v1/auth` (khớp `NEXT_PUBLIC_API_BASE_URL` trong `.env.local`).
- Token: JWT ký bằng `env.JWT_SECRET` (dùng chung 1 secret cho toàn backend), payload `{ id: userId, role }`
  với `role` là enum thô trong DB (`ADMIN | MANAGER | LEADER | TECHNICAL`). Hạn token theo
  `env.JWT_EXPIRES_IN` (mặc định `7d`).
- Client gửi kèm `Authorization: Bearer <token>` cho mọi endpoint cần đăng nhập — khớp interceptor có
  sẵn ở `src/services/api.ts` (đọc token từ `localStorage['bnwems_token']`).
- 2 endpoint `login`/`forgot-password` là **public** (không cần token); 3 endpoint còn lại
  (`profile` GET/PUT, `change-password`) **cần** `requireAuth`.

## 1. Bảng ánh xạ vai trò/trạng thái (model `users` DB thật ↔ `AuthUser` FE)

Bảng `users` lưu `role`/`status` dạng enum thô, nhưng `src/types/auth.ts` (đã có sẵn ở FE, không đổi)
mong đợi dạng hiển thị khác — backend tự map ở tầng service (`auth.service.ts`), không có bảng `roles`
riêng nên `roleId` chỉ là slug cố định theo role, không phải FK thật.

| Cột DB (`users.role`) | `AuthUserRole.roleName` (FE) | `roleId` (FE) |
|---|---|---|
| `ADMIN` | `'Admin'` | `role-admin` |
| `MANAGER` | `'Manager'` | `role-manager` |
| `LEADER` | `'LEADER_STAFF'` | `role-leader` |
| `TECHNICAL` | `'TECHNICAL_STAFF'` | `role-technical` |

| Cột DB (`users.status`) | `AuthUserStatus` (FE) |
|---|---|
| `ACTIVE` | `'active'` |
| `INACTIVE` | `'inactive'` |
| `SUSPENDED` | `'locked'` |

**Lưu ý phân quyền web/mobile**: backend **không** chặn role tại `/auth/login` — Leader/Technical Staff
vẫn đăng nhập được (vì họ dùng app mobile riêng, cùng bảng `users`). Việc chặn "vai trò không hỗ trợ
trên web" là logic **phía FE** (`ROLE_DASHBOARD_PATH` trong `src/constants/roles.ts`, dùng ở
`src/app/auth/login/page.tsx`), không phải trách nhiệm của API này.

## 2. Danh sách endpoint

### 2.1. `POST /api/v1/auth/login` — Đăng nhập

**Request body**

```json
{ "username": "manager", "password": "123456" }
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "userId": "afcad54a-2448-4c26-aa66-4c8ed50d3c0a",
      "username": "manager",
      "fullName": "Project Manager",
      "role": { "roleId": "role-manager", "roleName": "Manager" },
      "status": "active"
    }
  }
}
```

**Lỗi**: `401` nếu sai `username`/`password` (không phân biệt sai cái nào, tránh dò tài khoản); `403`
(`"Tài khoản đã bị khóa hoặc vô hiệu hóa"`) nếu `status != ACTIVE`.

**Permission**: Public.

---

### 2.2. `POST /api/v1/auth/forgot-password` — Quên mật khẩu

**Request body**: `{ "username": "manager" }`

**Response 200**: `{ "success": true, "data": null }` — **luôn** trả 200 dù `username` có tồn tại hay
không (tránh lộ thông tin tài khoản còn tồn tại). Hiện tại **chưa có hạ tầng gửi email/SMS thật**, chỉ
ghi log nội bộ khi tìm thấy tài khoản — khớp hành vi `mockAdapter.ts` hiện có ở FE.

**Permission**: Public.

---

### 2.3. `GET /api/v1/auth/profile` — Lấy hồ sơ người dùng hiện tại

Dùng khi `AuthContext.tsx` hydrate lại phiên đăng nhập từ token lưu trong `localStorage` (re-validate
token còn hợp lệ với backend hiện tại, không tin thẳng dữ liệu cũ).

**Response 200**

```json
{
  "success": true,
  "data": {
    "userId": "afcad54a-2448-4c26-aa66-4c8ed50d3c0a",
    "username": "manager",
    "fullName": "Project Manager",
    "role": { "roleId": "role-manager", "roleName": "Manager" },
    "status": "active",
    "email": "manager@bnw.com",
    "phone": "0900000002",
    "createdAt": "2026-07-19T16:47:34.000Z",
    "updatedAt": "2026-07-19T16:47:34.000Z"
  }
}
```

**Permission**: Bất kỳ user đã đăng nhập (Admin/Manager/Leader/Technical).

---

### 2.4. `PUT /api/v1/auth/profile` — Cập nhật hồ sơ cá nhân

**Request body** (mọi field optional, chỉ gửi field muốn đổi):

```json
{ "fullName": "string", "phone": "string", "bio": "string", "avatarUrl": "string" }
```

**Response 200**: object `AuthProfile` đã cập nhật (giống mục 2.3).

**Permission**: Bất kỳ user đã đăng nhập — chỉ tự sửa hồ sơ của chính mình (`req.user.id`), không có
tham số `userId` trên URL.

---

### 2.5. `PUT /api/v1/auth/change-password` — Đổi mật khẩu

**Request body**

```json
{ "oldPassword": "string", "newPassword": "string (>=6 ký tự)", "confirmNewPassword": "string" }
```

**Response 200**: `{ "success": true, "data": null }`.

**Lỗi**: `400` nếu `confirmNewPassword` không khớp `newPassword` (validate ở Zod schema, trả trước khi
chạm DB) hoặc nếu `oldPassword` sai (`"Mật khẩu hiện tại không đúng"`).

**Permission**: Bất kỳ user đã đăng nhập — chỉ đổi mật khẩu của chính mình.

## 3. Đã test thật (curl, DB Aiven, 2026-07-20)

- `POST /auth/login` với `manager`/`123456` → nhận token + user đúng shape ở trên.
- `GET /auth/profile` với token vừa nhận → trả đúng hồ sơ.
- Dùng token đó gọi tiếp toàn bộ 7 endpoint ở `docs/khach_hang_api.md` (list/create/get/update/
  delete/summary/orders khách hàng) → tất cả chạy đúng với DB thật, bao gồm `409 Conflict` khi xóa
  khách hàng đã có đơn hàng.

## 4. Việc còn lại phía FE (chưa làm — chỉ viết doc, KHÔNG sửa code trong lượt này)

- `src/app/auth/login/page.tsx` **hiện vẫn chưa gọi** `authApiService.login()` thật — đang dùng 2 tài
  khoản ảo cố định (`src/mocks/authAccounts.ts`). Comment cũ trong code trỏ tới
  *"docs/more-require.md mục (jj)"* — **mục (jj) không tồn tại trong `docs/more-require.md` hiện tại**
  (file này hiện chỉ có mục (a) và (b), xem `docs/more-require.md`) — tham chiếu đã hỏng, không tra
  cứu lại được lý do gốc. Endpoint thật **đã chạy đúng** (mục 3 + đối chiếu lại mục 5) nên lý do chặn
  cũ (nếu từng đúng) không còn hiệu lực. Việc cần làm khi triển khai: gỡ nhánh `findMockAccount`, gọi
  `authApiService.login()` thật, xoá comment tham chiếu mục (jj) đã hỏng.
- `src/context/AuthContext.tsx` **không cần sửa gì** — đã sẵn code gọi `authApiService.getProfile()`
  để re-validate token khi hydrate, khớp đúng response mục 2.3.
- Trang "Đổi mật khẩu"/"Quên mật khẩu"/"Hồ sơ cá nhân" (nếu có UI tương ứng) có thể nối thẳng vào
  `authApiService.changePassword()` / `forgotPassword()` / `updateProfile()` — cả 3 hàm đã có sẵn ở
  `src/services/auth.service.ts`, chỉ chưa được UI nào gọi tới.
- `authApiService.registerDeviceToken()` (`POST /auth/device-token`) — **backend đúng
  (`D:\sep490-backend-api`) không có route này** (`auth.routes.ts` chỉ đăng ký đúng 5 route: `login`/
  `forgot-password`/`profile` GET+PUT/`change-password`, không có `device-token`). Grep toàn bộ `src/`
  xác nhận hàm này cũng **chưa được gọi ở bất kỳ đâu** trong FE (chỉ khai báo, không dùng) — không phải
  gap cần backend xử lý ngay, giữ nguyên as-is cho tới khi có nhu cầu push notification thật (FCM) mới
  cần backend bổ sung route + Product xác nhận thiết kế.

## 5. Đối chiếu lại độc lập (2026-07-20, phiên này) — không phát hiện lệch mới

Đọc trực tiếp `auth.service.ts`/`auth.controller.ts`/`auth.routes.ts`/`user.repository.ts`/
`auth.validators.ts` ở `D:\sep490-backend-api\src\modules\identity\` + `SHOW CREATE TABLE users` và
`SELECT user_id, username, full_name, role, status FROM users` qua MySQL MCP:

- Model `User` (Prisma) khớp 100% cột thật của bảng `users` (tên cột, kiểu, nullable) — không có cột
  thừa/thiếu.
- 4 tài khoản seed thật tồn tại, đều `status = ACTIVE`: `admin`/`manager`/`leader`/`tech` (khớp đúng 4
  role `ADMIN`/`MANAGER`/`LEADER`/`TECHNICAL`) — dùng được ngay để test thủ công khi nối API thật.
- Zod schema (`auth.validators.ts`) khớp chính xác field-by-field với 4 payload interface phía FE
  (`LoginPayload`, `ForgotPasswordPayload`, `UpdateProfilePayload`, `ChangePasswordPayload` ở
  `src/services/auth.service.ts`) — không cần đổi tên field nào ở 1 trong 2 phía.
- Route list thật (`auth.routes.ts`): `POST /login`, `POST /forgot-password`, `GET /profile`,
  `PUT /profile`, `PUT /change-password` — đúng 5 route, khớp mục 2.1-2.5. **Không có** route thứ 6 cho
  `device-token` (xem mục 4).
