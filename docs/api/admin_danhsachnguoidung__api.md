# API Nhân viên (Employees) — Admin Portal

> Tài liệu tổng hợp các API mà màn **Nhân viên** (`/admin/settings/users`) trên web frontend cần
> backend cung cấp.
>
> Được viết dựa trên:
> - Code FE hiện tại: `src/app/admin/settings/users/page.tsx`, `src/components/employees/EmployeeFormModal.tsx`,
>   `src/mocks/db/employees.ts` (nguồn mock đang dùng tạm trong giai đoạn UI-first).
> - **Chưa đối chiếu được với DB thật**: không có MCP truy vấn database khả dụng trong phiên làm việc
>   này, và repo backend (`D:\bnwems-backend-api` — đường dẫn tham chiếu trong `src/types/user.ts`) không
>   tồn tại trên máy hiện tại để đọc `prisma/schema.prisma`. Toàn bộ đề xuất field/bảng bên dưới là suy ra
>   từ nhu cầu UI — **backend cần xác nhận lại tên bảng/cột thật** trước khi implement (khác với
>   `docs/khach_hang_api.md`, vốn đã đối chiếu trực tiếp qua MySQL MCP).
> - **Đã chốt với Product ngày 2026-07-20** — xem mục 3. Các phần dưới đây đã cập nhật theo quyết định đó.
>
> ⚠️ **Đã chốt — đổi tên miền nghiệp vụ & route**: route FE hiện tại là `/admin/settings/users` nhưng màn
> hình này **KHÔNG** dùng `userApiService`/`GET /api/v1/users` đã có sẵn (xem `src/services/user.service.ts`,
> `src/types/user.ts`) — đó là API cho **tài khoản đăng nhập RBAC** (`AdminUser`: username, role
> `ADMIN/MANAGER/LEADER/TECHNICAL`, không có phone/vai-trò-chuyên-môn). Màn này quản lý một thực thể
> **hoàn toàn khác**: **"Nhân viên/Nhân sự vận hành sự kiện"** (`AdminEmployee`) — không đăng nhập hệ
> thống, không có username/password/role RBAC, chỉ là hồ sơ nhân sự để phân công phụ trách sự kiện. Đã
> chốt: dùng base path **`/api/v1/employees`** (không phải `/api/v1/users`), và đổi route FE từ
> `/admin/settings/users` sang **`/admin/settings/employees`** cho khỏi nhầm lẫn khi đọc code. **FE
> hiện chưa đổi route trong code** (tài liệu này chỉ ghi nhận quyết định) — cần 1 task riêng để di chuyển
> `src/app/admin/settings/users/` → `src/app/admin/settings/employees/` và cập nhật link liên quan
> (`Sidebar.tsx`...) khi bắt tay nối API thật.

## 0. Base URL & Auth

- Base path (đã chốt): **`/api/v1/employees`**.
- **Quyền (đã chốt)**: **Admin** đọc + ghi đầy đủ (tạo/sửa/vô hiệu hóa — theo CLAUDE.md mục 1: Admin quản
  lý master data/nhân sự). **Manager chỉ có quyền đọc (GET)** — xem danh sách/chi tiết để biết nhân sự nào
  đang sẵn sàng khi phân công Schedule Plan/Work Task, nhưng không được tạo/sửa/vô hiệu hóa hồ sơ nhân sự.
  Leader Staff và Technical Staff (mobile, ngoài phạm vi repo này) cũng chỉ có quyền đọc, cùng mức với
  Manager — endpoint GET cần cho phép cả 3 role này, endpoint ghi (POST/PUT/PATCH status) chỉ Admin.

## 1. Field FE (`AdminEmployee`) — đề xuất mapping DB

| Trường FE | Kiểu | Đề xuất cột DB | Ghi chú |
|---|---|---|---|
| `id` | string (`NV001`) | `employee_id` (PK, varchar) | **Đã chốt (theo khuyến nghị, cùng tiền lệ `customerId` ở `docs/khach_hang_api.md` mục 3.1)**: backend là nguồn sinh mã duy nhất, dùng thẳng mã nghiệp vụ dạng `NV###` (tuần tự, tăng dần) làm giá trị PK thật — **không** đổi sang UUID/auto-increment số rồi map riêng, để giữ mã dễ đọc/dễ trao đổi ngoài hệ thống (gọi điện, ghi chú tay...) giống `customerId`. FE hiện tự đoán mã tiếp theo ở client (`nextAdminEmployeeId()`) chỉ để hiển thị placeholder trước khi submit — **không** dùng làm giá trị thật gửi lên, tránh đụng mã khi nhiều người tạo đồng thời. |
| `name` | string | `full_name` | Bắt buộc (validate FE: không rỗng). |
| `phone` | string | `phone` | Bắt buộc (validate FE: không rỗng). FE **chưa validate định dạng số điện thoại** — nên bổ sung ở backend. Cần xác nhận: có bắt buộc unique không? |
| `email` | string (optional) | `email` (nullable) | FE coi `''` là rỗng; nên chuẩn hoá `null ↔ ''` giống pattern đã áp dụng ở `khach_hang_api.md`. Không bắt buộc, không validate định dạng ở FE hiện tại. |
| `role` | string, tham chiếu danh mục | `role_id` (FK → bảng `employee_roles`, xem mục 1.1) | **Đã chốt (2 quyết định)**: (1) Vai trò chuyên môn này **độc lập hoàn toàn** với 4 role RBAC (Admin/Manager/Leader Staff/Technical Staff) — không mapping, không ràng buộc lẫn nhau, vì role RBAC là quyền đăng nhập còn vai trò chuyên môn chỉ là phân loại nhân sự vận hành không đăng nhập (nhiều giá trị như "Bếp trưởng"/"MC/MC Lead"/"Trang trí" không có role RBAC nào tương ứng). (2) Lưu dạng **danh mục (catalog) mở rộng được** — Admin tự thêm/sửa/xóa vai trò qua màn Master data, không hardcode ENUM cố định như FE hiện tại (`EMPLOYEE_ROLES`). Xem mục 1.1 để biết endpoint quản lý danh mục này. |
| `status` | enum: `'active' \| 'inactive'` | `status` (đề xuất `ENUM('ACTIVE','INACTIVE')`, map lowercase khi trả FE — theo đúng pattern `khach_hang_api.md`) | **Đã chốt ý nghĩa**: đây là **trạng thái làm việc tĩnh** (nhân sự đang hoạt động / đã ngừng hoạt động tại công ty), **không phải** trạng thái trực ca theo thời gian thực — do Admin set thủ công (qua tạo/sửa hồ sơ hoặc endpoint vô hiệu hóa ở mục 2.5), không suy ra từ chấm công. **Follow-up UI (chưa làm, ghi chú lại)**: nhãn hiện tại "Đang trực"/"Ngoại tuyến" ở FE dễ gây hiểu lầm là trạng thái real-time — nên đổi nhãn hiển thị thành "Đang hoạt động"/"Ngừng hoạt động" cho khớp đúng ý nghĩa tĩnh này khi nối API thật. |
| `avatarColor` | string (class Tailwind, vd `bg-blue-600`) | *(không cần lưu DB)* | Thuần trang trí UI — FE tự chọn random khi tạo mới, hoặc tính từ hash tên. **Đề xuất: không cần backend trả field này**, FE tự suy ra từ `id`/`name` để đồng nhất giữa các lần load. |
| `assignedBookings` | number | *(không có cột — tính từ)* `COUNT(...)` | **Đã chốt hướng xử lý**: hiện tại đây là số ngẫu nhiên khi seed mock (`i % 8`), **không** có liên kết FK thật — các bảng phân công nhân sự khác (Schedule Plan, Work Task, người khảo sát, `COORDINATOR_POOL`/`ASSIGNEE_POOL`/`LEADER_STAFF_POOL` theo ghi chú đầu `src/mocks/db/employees.ts`) hiện chỉ lưu **tên chuỗi tự do**, không phải `employee_id` thật. **Đã chốt: cần đổi các bảng phân công đó sang tham chiếu `employee_id` thật** (FK) thay vì lưu tên chuỗi, để `assignedBookings` tính được đúng bằng `COUNT(DISTINCT order_id)` theo `employee_id`. Đây là thay đổi schema tương đối lớn, ảnh hưởng nhiều bảng khác ngoài phạm vi `employees` — **cần thêm 1 mục riêng ở `docs/more-require.md`** (theo đúng tiền lệ mục (a) đã có) liệt kê từng bảng/service cần sửa trước khi implement `assignedBookings` đúng nghĩa; tài liệu này chưa liệt kê chi tiết từng bảng đó. |
| — | — | `created_at`, `updated_at` | Nên có dù FE hiện chưa hiển thị — hữu ích cho audit theo CLAUDE.md (Admin có trách nhiệm audit toàn bộ dữ liệu). |

### 1.1. Danh mục vai trò chuyên môn (`employee_roles`)

Theo quyết định "danh mục mở rộng được" ở trên, cần thêm 1 nhóm endpoint quản lý danh mục riêng (tương tự
các màn Master data khác — dịch vụ, thiết bị... theo CLAUDE.md mục 1):

- `GET /api/v1/employee-roles` — danh sách vai trò hiện có (dùng để render tab lọc + dropdown chọn vai trò
  trong `EmployeeFormModal`). Seed sẵn 6 giá trị hiện tại của FE: Quản lý, Điều phối viên, Kỹ thuật, Bếp
  trưởng, MC/MC Lead, Trang trí.
- `POST /api/v1/employee-roles` — Admin thêm vai trò mới (`{ name: string }`).
- `PUT /api/v1/employee-roles/:id` — Admin sửa tên vai trò.
- `DELETE /api/v1/employee-roles/:id` — chỉ cho xóa khi **không còn nhân sự nào** đang gán vai trò đó
  (`COUNT(employees WHERE role_id = ?) = 0`), tương tự tinh thần rule xóa draft ở CLAUDE.md mục 1 — nếu vi
  phạm trả **409 Conflict**.
- Mỗi vai trò trong danh mục có thể cần thêm `badgeColor`/`badgeVariant` (`success`/`warning`/`error`/
  `info`/`neutral`) để giữ đúng hệ màu badge nhất quán như FE hiện tại (`EMPLOYEE_ROLE_BADGE`) — cần Backend
  xác nhận có lưu field này trong `employee_roles` hay để FE tự gán màu theo thứ tự/hash tên vai trò.
- **Permission**: Admin (đọc/ghi); Manager/Leader Staff/Technical Staff (chỉ đọc, để hiển thị nhãn/màu).

## 2. Danh sách endpoint

### 2.1. `GET /api/v1/employees` — Danh sách nhân viên (màn list)

Dùng cho bảng chính ở `page.tsx`: tab lọc theo vai trò (Tất cả + các vai trò trong danh mục), ô tìm kiếm,
phân trang.

**Query params**

| Param | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `roleId` | string (FK `employee_roles.id`) | Không | Lọc theo vai trò chuyên môn. Không truyền = tất cả. |
| `search` | string | Không | Tìm theo `name`, `id`, `phone`, `email`, tên vai trò (khớp logic FE hiện tại — `LIKE` không phân biệt hoa/thường). |
| `page` | number | Không (default 1) | Trang hiện tại. |
| `limit` | number | Không (default 10) | FE đang cố định 10. |

**Response 200**

```json
{
  "data": [
    {
      "id": "NV001",
      "name": "Vũ Hoàng Long",
      "phone": "0920000000",
      "email": "long.vh@bnwems.vn",
      "role": { "id": "ROLE01", "name": "Quản lý" },
      "status": "inactive",
      "assignedBookings": 0
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "totalItems": 22,
    "totalPages": 3,
    "counts": {
      "all": 22,
      "ROLE01": 4,
      "ROLE02": 4,
      "ROLE03": 4,
      "ROLE04": 4,
      "ROLE05": 3,
      "ROLE06": 3
    }
  }
}
```

`meta.counts` (key theo `roleId`) dùng để hiển thị số đếm trên từng tab vai trò mà không cần FE gọi nhiều
lần (giống pattern `docs/khach_hang_api.md` mục 2.1). `avatarColor` **không** cần trả về — xem ghi chú
mục 1.

**Permission**: Admin, Manager, Leader Staff, Technical Staff — đọc. Chỉ Admin có quyền ghi (mục 2.2–2.5).

---

### 2.2. `POST /api/v1/employees` — Thêm nhân sự mới

Dùng cho modal "Thêm nhân sự" (`EmployeeFormModal`).

**Request body**

```json
{
  "name": "string, required",
  "phone": "string, required",
  "email": "string, optional",
  "roleId": "string, required — FK employee_roles.id",
  "status": "active | inactive, default active"
}
```

**Response 201**: object `AdminEmployee` như mục 2.1 (kèm `id` do backend sinh dạng `NV###` — xem mục 1;
`assignedBookings` mặc định `0`).

**Validate tối thiểu**: `name`, `phone`, `roleId` không rỗng, `roleId` phải tồn tại trong `employee_roles`
(trùng validate hiện có ở FE — FE hiện **chưa** validate `role` bắt buộc dù UI luôn có giá trị mặc định).
Nên bổ sung validate định dạng số điện thoại và định dạng email (nếu có nhập) ở backend.

**Permission**: Admin.

---

### 2.3. `GET /api/v1/employees/:id` — Chi tiết nhân sự cơ bản

Trả về đúng object `AdminEmployee` (mục 2.1) — dùng khi mở modal "Chỉnh sửa nhân sự" để prefill form.

**Permission**: Admin, Manager, Leader Staff, Technical Staff — đọc.

---

### 2.4. `PUT /api/v1/employees/:id` — Cập nhật nhân sự

Body giống 2.2 (không có `id`/`assignedBookings` — trường sau là aggregate, không cho sửa tay). Response:
object đã cập nhật. Có thể dùng endpoint này để đổi `status` luôn (không cần endpoint riêng), nhưng xem
mục 2.5 để biết luồng "vô hiệu hóa" chuẩn từ nút thao tác trên bảng.

**Permission**: Admin.

---

### 2.5. Vô hiệu hóa nhân sự (thay cho xóa cứng) — **đã chốt: không xóa, chỉ vô hiệu hóa**

**Đã chốt**: **không có endpoint xóa cứng (`DELETE`)** cho nhân sự — chỉ cho phép **vô hiệu hóa**
(`status → inactive`), để giữ lại lịch sử phân công cũ đã tham chiếu tới nhân sự này (đặc biệt sau khi mục
`assignedBookings` được nối vào FK thật theo mục 1). Đề xuất endpoint riêng, theo đúng pattern đã có sẵn ở
`userApiService.updateUserStatus` (`PATCH /api/v1/users/:id/status`):

```
PATCH /api/v1/employees/:id/status
Body: { "status": "active" | "inactive" }
```

- Không cần điều kiện chặn theo `assignedBookings` — vô hiệu hóa không xóa dữ liệu, chỉ đánh dấu ngừng
  hoạt động nên an toàn ngay cả khi nhân sự đang có sự kiện phụ trách (dữ liệu phân công cũ vẫn giữ
  nguyên).
- **Follow-up FE (chưa làm, ghi chú lại)**: nút "Xóa nhân sự" hiện tại ở `page.tsx` (icon `Trash2`, modal
  xác nhận "Xóa nhân sự"/`deleteAdminEmployee`) cần đổi thành nút "Vô hiệu hóa nhân sự" gọi
  `PATCH .../status` thay vì xóa bản ghi, khi nối API thật.

**Permission**: Admin.

## 3. Quyết định đã chốt (Product — 2026-07-20)

1. **Tên miền nghiệp vụ & route**: dùng `/api/v1/employees` (không phải `/api/v1/users`, tránh đụng API
   RBAC đã có); đổi route FE từ `/admin/settings/users` sang `/admin/settings/employees` khi nối API thật
   (FE code chưa đổi, chỉ mới ghi nhận quyết định).
2. **Vai trò chuyên môn (`role`)**: độc lập hoàn toàn với 4 role RBAC (Admin/Manager/Leader Staff/Technical
   Staff) — không mapping. Lưu dạng danh mục (catalog) `employee_roles` cho Admin tự thêm/sửa/xóa, không
   hardcode ENUM cố định (xem mục 1.1).
3. **Ý nghĩa `status`**: trạng thái làm việc tĩnh (đang hoạt động/ngừng hoạt động), không phải trạng thái
   trực ca real-time — set thủ công bởi Admin.
4. **`assignedBookings`**: cần đổi các bảng phân công nhân sự khác (Schedule Plan, Work Task, người khảo
   sát...) sang tham chiếu `employee_id` thật thay vì lưu tên chuỗi tự do — ghi thành 1 mục riêng ở
   `docs/more-require.md` trước khi implement trường này đúng nghĩa (chưa thực hiện, nằm ngoài phạm vi
   sửa lần này).
5. **Mã `id` (`NV###`)**: backend sinh và lưu trực tiếp làm PK dạng mã nghiệp vụ `NV###`, không đổi sang
   UUID — theo đúng tiền lệ `customerId` ở `docs/khach_hang_api.md`.
6. **Rule xóa**: không có xóa cứng — chỉ vô hiệu hóa qua `PATCH /api/v1/employees/:id/status` (mục 2.5).
7. **Quyền đọc**: Admin đọc + ghi đầy đủ; Manager, Leader Staff, Technical Staff chỉ đọc (không tạo/sửa/vô
   hiệu hóa).

> Bước tiếp theo:
> - Backend xác nhận lại tên bảng/cột thật (tài liệu này chưa đối chiếu được DB do thiếu MCP truy vấn —
>   xem cảnh báo ở đầu file) trước khi implement.
> - Thêm 1 mục mới ở `docs/more-require.md` cho quyết định 4 (danh sách cụ thể các bảng/service cần đổi
>   sang tham chiếu `employee_id`) trước khi FE bắt đầu code `employee.service.ts` dựa vào trường
>   `assignedBookings`.
> - Khi nối API thật: di chuyển route FE sang `/admin/settings/employees`, đổi nút "Xóa nhân sự" thành "Vô
>   hiệu hóa nhân sự", đổi nhãn trạng thái "Đang trực"/"Ngoại tuyến" thành "Đang hoạt động"/"Ngừng hoạt
>   động".
