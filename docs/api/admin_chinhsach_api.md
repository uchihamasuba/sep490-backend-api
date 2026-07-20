# API màn "Chính sách nghiệp vụ" (`/admin/policies`)

> Tài liệu tổng hợp API mà màn **Chính sách nghiệp vụ** (ảnh mẫu người dùng cung cấp — tiêu đề "Chính
> sách nghiệp vụ", mô tả phụ "Quản lý các chính sách đặt cọc, hoàn cọc, đền bù thiết bị, phụ phí và
> tiền công nhân sự áp dụng toàn hệ thống", ô tìm "Tìm theo mã hoặc tên chính sá[ch]...", filter "Tất cả
> loại chính sách"/"Tất cả trạng thái", nút refresh, bảng `MÃ CHÍNH SÁCH`/`TÊN CHÍNH SÁCH`/`LOẠI`/
> `GIÁ TRỊ`/`TRẠNG THÁI`/`THAO TÁC` với icon Sửa (bút chì) + Bật/tắt (nguồn điện), nút "+ Tạo chính
> sách") trên web frontend cần backend cung cấp.
>
> Được viết dựa trên:
> - Code FE: `src/app/admin/policies/page.tsx` (trang chính — khớp 100% ảnh mẫu), `src/components/policies/PolicyFormModal.tsx`
>   (modal Tạo/Sửa dùng chung 2 chế độ), `src/types/policy.ts` (`BusinessPolicy`/`PolicyType`/
>   `GetPoliciesQuery`/`CreatePolicyPayload`/`UpdatePolicyPayload` — comment đầu file ghi nguồn đối
>   chiếu `D:\bnwems-backend-api prisma/schema.prisma` model `BusinessPolicy`, enum `PolicyType`,
>   `policy.route.ts`, `policy.validator.ts` — **các file backend này nằm ngoài repo hiện tại, không đọc
>   lại được trực tiếp trong phiên làm việc này**, chỉ dùng lại comment ghi chú sẵn làm căn cứ),
>   `src/services/policy.service.ts` (`policyApiService` — 3 method GET/POST/PUT đã implement sẵn ở
>   tầng FE), `src/mocks/apiFixtures.ts` (`MOCK_POLICIES`, dòng 110-124) + `src/services/mockAdapter.ts`
>   (dòng 694-714, mock đang dùng tạm trong giai đoạn UI-first, CLAUDE.md mục 0), `src/constants/permissions.ts`,
>   `src/components/layout/ProtectedRoute.tsx`.
> - **Không có MCP truy vấn database khả dụng trong phiên làm việc này** — tài liệu này không tự chạy
>   `SHOW CREATE TABLE`/truy vấn schema thật. Dùng lại căn cứ gián tiếp trong repo: comment đầu
>   `src/types/policy.ts` (đối chiếu `prisma/schema.prisma` backend, model `BusinessPolicy`) làm nguồn
>   đáng tin cậy nhất cho hình dạng dữ liệu; phần field/behavior còn lại suy từ code FE hiện có.

## 0. Base URL & Auth

- Base path: `/api/v1/policies` — đã có sẵn `policyApiService`, không cần base path mới.
- **Trang `/admin/policies` chỉ Admin truy cập được** (route nằm dưới path segment `admin/`, layout bọc
  `ProtectedRoute requiredRole="Admin"` theo pattern chung — sai role bị redirect ngay, xem
  `ProtectedRoute.tsx`).
- **Ghi (POST/PUT)**: gate qua `usePermission()` — `canManage = can('master-data:manage')`
  (`src/constants/permissions.ts` dòng 6: permission này chỉ cấp cho **Admin**) — khớp CLAUDE.md mục
  "Vai trò & phân quyền" (Admin quản lý master data, gồm cả "chính sách cọc/hoàn cọc/phí phát sinh, quy
  tắc tiền công"). Nút "+ Tạo chính sách" và 2 icon thao tác (Sửa/Bật-tắt) chỉ hiện khi `canManage`
  (`page.tsx` dòng 45, 166, 198). Endpoint ghi **phải chặn ở tầng API** (403 nếu role không có
  `master-data:manage`), không chỉ ẩn nút ở FE.
- **Đọc (GET)**: cần mở cho **cả Admin và Manager**, không chỉ Admin — dù trang danh sách này chỉ Admin
  vào được, dữ liệu chính sách (đặc biệt `DEPOSIT`/`CANCELLATION`) lại được **đọc trực tiếp ở màn chi
  tiết báo giá của cả 2 role** (`src/app/admin/quotations/[id]/page.tsx` và
  `src/app/manager/quotations/[id]/page.tsx`, hiển thị block "Điều khoản chung", đã gọi qua
  `policyApiService.getPolicies({ isActive: true })` rồi tự lọc `policyType in [DEPOSIT, CANCELLATION]`
  ở client — xem mục 6.2) và ở modal hủy đơn `CancelOrderModal.tsx` (đọc riêng `CANCELLATION` — xem mục
  6.3), nên **Manager cần được cấp quyền GET `/policies` ở tầng API thật**, không chỉ Admin.

## 1. Field bảng chính → mapping `BusinessPolicy` (`types/policy.ts` dòng 7-18)

| Cột UI | Field FE (`BusinessPolicy`) | Ghi chú |
|---|---|---|
| Mã chính sách | `policyCode` | Hiển thị dạng mono, vd `HOAN-COC-30`. Không sửa được sau khi tạo (xem mục 5). |
| Tên chính sách | `policyName` (kèm `description` hiển thị dòng phụ nhỏ màu xám nếu có) | Không sửa được sau khi tạo. |
| Loại | `policyType` (enum, xem mục 3) | Badge màu theo loại — xem `POLICY_TYPE_META` trong `page.tsx` dòng 24-30. Không sửa được sau khi tạo. |
| Giá trị | `policyValue` + `unit` | Hiển thị `policyValue.toLocaleString('vi-VN')` nối chuỗi với `unit`. `unit` là **chuỗi tự do** (vd "%", "Ngày", "km", "VNĐ/buổi", "% giá mua") — backend **không ràng buộc enum** cho field này (theo comment `types/policy.ts` dòng 14, đối chiếu `policy.validator.ts` backend). |
| Trạng thái | `isActive` | Badge xanh lá "Đang áp dụng" / xám "Ngừng áp dụng". |
| Thao tác | — | Icon bút chì (Sửa) mở lại `PolicyFormModal` ở chế độ `edit`; icon nguồn điện (Power) gọi `PUT` đổi `isActive` ngược lại giá trị hiện tại (bật/tắt nhanh, không qua modal). Cả 2 chỉ hiện khi `canManage`. **Không có nút Xóa** — xem mục 6.1. |

## 2. `PolicyType` (enum, `types/policy.ts` dòng 5)

5 giá trị cố định, khớp `POLICY_TYPE_META`/`POLICY_TYPE_OPTIONS` ở FE:

| Giá trị | Nhãn hiển thị (VI) | Badge màu | Ví dụ trong `MOCK_POLICIES` |
|---|---|---|---|
| `DEPOSIT` | Đặt cọc | info (xanh dương) | `COC-TIEU-CHUAN` — tỉ lệ cọc tiêu chuẩn 50% |
| `CANCELLATION` | Hủy đơn & hoàn cọc | warning (vàng/cam) | `HOAN-COC-30`/`HOAN-COC-7-30`/`HOAN-COC-DUOI-7` — khớp đúng rule hoàn cọc ở CLAUDE.md mục 1 |
| `COMPENSATION` | Đền bù thiết bị | error (đỏ) | `DEN-BU-HONG-MAT` — 100% giá mua |
| `FEE` | Phụ phí | neutral (xám) | `PHI-VC-PHATSINH` — ngưỡng 2km miễn phí vận chuyển |
| `WAGE` | Tiền công nhân sự | success (xanh lá) | `CONG-LEADER`/`CONG-TECHNICAL` — đơn giá theo buổi |

**Lưu ý quan trọng cho backend**: giá trị enum này thuần là **danh mục loại chính sách** để FE
nhóm/hiển thị badge — bản thân các con số nghiệp vụ thật (%, ngưỡng ngày, đơn giá...) đến từ
`policyValue`/`unit` của từng bản ghi, **không** tính toán cứng trong code FE (khác với các hằng số
"Quy tắc nghiệp vụ cốt lõi" đang hard-code rải rác ở CLAUDE.md mục 1 — về lâu dài nên là 1 nguồn duy
nhất, đọc từ bảng chính sách này qua API, nhưng việc thay các chỗ hard-code đó bằng dữ liệu từ API
**ngoài phạm vi tài liệu này**, chỉ ghi chú lại ở mục 6.3).

## 3. `GET /api/v1/policies` — Danh sách (đã có `policyApiService.getPolicies`)

**Query params** (`GetPoliciesQuery`, `types/policy.ts` — 5 param, tất cả optional):

| Param | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `policyType` | `PolicyType` | Không | Lọc theo loại — khớp dropdown "Tất cả loại chính sách". |
| `isActive` | boolean | Không | Lọc theo trạng thái — khớp dropdown "Tất cả trạng thái" (FE gửi `true`/`false` dạng string qua query, xem mock `mockAdapter.ts`: `params.isActive === 'true' || params.isActive === true`). |
| `search` | string | Không | Tìm theo `policyCode`/`policyName` — khớp placeholder "Tìm theo mã hoặc tên chính sách...", server-side (mục 6.4). |
| `page` | number | Không | Trang hiện tại — mặc định 10 dòng/trang qua `usePagination(10)` ở `page.tsx`. |
| `limit` | number | Không | Số dòng/trang. |

**`page`/`limit` là optional và có ý nghĩa "trả toàn bộ" khi không gửi**: `/admin/policies/page.tsx`
luôn gửi cả `page`/`limit` (phân trang thật ở client theo `usePagination`), nhưng
`CancelOrderModal.tsx` và 2 trang chi tiết báo giá (mục 6.2/6.3) **cố tình không gửi** `page`/`limit` vì
cần lấy *toàn bộ* danh sách chính sách active để tự lọc/tính toán — backend khi không nhận được
`page`/`limit` nên trả **toàn bộ** danh sách đã lọc theo `policyType`/`isActive`/`search`, không tự áp
`limit` mặc định nhỏ (xem thêm mục 6.4).

**Response 200** (theo đúng shape `BusinessPolicy[]`, kèm `meta` phân trang chuẩn dùng `totalCount` —
giống pattern `docs/admin_quanlydanhmucthietbi_api.md` mục 2 — khi có gửi `page`/`limit`):

```json
{
  "data": [
    {
      "policyId": "pol-1",
      "policyCode": "HOAN-COC-30",
      "policyName": "Hoàn cọc khi hủy đơn ≥30 ngày trước sự kiện",
      "policyType": "CANCELLATION",
      "description": "Khách báo hủy trước ≥30 ngày so với ngày lắp đặt: hoàn 100% tiền cọc.",
      "policyValue": 100,
      "unit": "%",
      "isActive": true,
      "createdAt": "2026-07-15T09:00:00Z",
      "updatedAt": "2026-07-15T09:00:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "totalCount": 8 }
}
```

**Permission**: Admin, Manager (đọc — xem mục 0 lý do Manager cần đọc qua màn chi tiết báo giá).

## 4. `POST /api/v1/policies` — Tạo chính sách (đã có `policyApiService.createPolicy`)

Dùng cho modal "Tạo chính sách mới" (nút "+ Tạo chính sách").

```json
// Request (CreatePolicyPayload, types/policy.ts dòng 26-33)
{
  "policyCode": "string, required",
  "policyName": "string, required",
  "policyType": "DEPOSIT | CANCELLATION | COMPENSATION | FEE | WAGE, required",
  "policyValue": "number, required",
  "unit": "string, required — chuỗi tự do, không ràng buộc enum",
  "description": "string, optional"
}
```

**Validate tối thiểu (khớp FE `PolicyFormModal`)**: `policyCode`/`policyName`/`unit` có `required` ở
HTML input, `policyType` bắt buộc chọn 1 trong 5 giá trị (mặc định `DEPOSIT`), `policyValue` là số (FE
ép `Number(...) || 0` khi nhập, không tự chặn giá trị âm hay bằng 0 trước khi submit) — **backend nên tự
validate not-blank cho `policyCode`/`policyName`/`unit` và validate `policyValue` hợp lý theo `policyType`
(vd không cho âm), không tin nguyên trạng dữ liệu từ FE**.

**`policyCode` unique**: không thấy thông báo lỗi trùng mã nào được thiết kế trên UI, nhưng **nên**
validate unique ở backend (tương tự khuyến nghị ở `docs/admin_quanlydanhmucthietbi_api.md` mục 5.1 cho
`categoryName`) — nếu chốt cần unique, trả **409 Conflict** kèm `message` để FE hiển thị vào
`errorMessage` của modal (`getErrorMessage()` cuối `page.tsx` đã có sẵn cơ chế đọc `response.data.message`).

**Response 201**: object `BusinessPolicy` với `policyId` do backend sinh, `isActive` mặc định `true`,
`createdAt`/`updatedAt` do backend set.

**Permission**: Admin (`master-data:manage`).

## 5. `PUT /api/v1/policies/:id` — Sửa / Bật-tắt chính sách (đã có `policyApiService.updatePolicy`)

Dùng cho modal "Chỉnh sửa chính sách" (icon bút chì) **và** cho thao tác bật/tắt nhanh (icon nguồn điện
— gọi cùng endpoint này, chỉ gửi field `isActive`).

```json
// Request (UpdatePolicyPayload, types/policy.ts dòng 36-41 — tất cả field optional, gửi field nào sửa field đó)
{
  "policyValue": "number, optional",
  "unit": "string, optional",
  "isActive": "boolean, optional",
  "description": "string, optional"
}
```

**Không sửa được `policyCode`/`policyName`/`policyType` sau khi tạo** — `PolicyFormModal` disable 3
input này khi `mode === 'edit'` (dòng 108/115/124), kèm ghi chú ngay trên form: *"Mã, loại và tên chính
sách không thể sửa sau khi tạo — chỉ có thể đổi giá trị, đơn vị, mô tả và trạng thái."* Backend **nên từ
chối** (400) nếu request PUT vô tình gửi kèm 3 field này khác giá trị hiện tại, thay vì âm thầm bỏ qua.

**Thao tác bật/tắt nhanh** (`handleToggleActive`, `page.tsx` dòng 124-127): gọi `PUT` chỉ với
`{ "isActive": !policy.isActive }`, không kèm field nào khác, không có bước xác nhận (confirm dialog)
trước khi gọi — xem mục 6.1 về việc đây là **thay thế cho chức năng Xóa**.

**Response 200**: object `BusinessPolicy` đã cập nhật.

**Permission**: Admin (`master-data:manage`).

---

## 6. Vấn đề cần chốt với Backend/Product

### 6.1. Không có endpoint DELETE — **đã chốt**: chỉ bật/tắt qua `isActive`

Khác với `docs/admin_quanlydanhmucthietbi_api.md` (nơi "không có nút Xóa" là điểm chưa rõ chủ ý), màn
này **rõ ràng thiết kế theo hướng không xóa cứng chính sách** — nút duy nhất để "gỡ" 1 chính sách khỏi
áp dụng là icon nguồn điện đổi `isActive: false` (đổi label nút thành "Kích hoạt lại" khi đã tắt). Hợp
lý về nghiệp vụ vì chính sách có thể đã được tham chiếu trong báo giá/order cũ (tương tự rule "Xóa
draft" ở CLAUDE.md mục 1 — dữ liệu đã gắn vào nghiệp vụ thật thì không nên xóa cứng).

**Đã chốt (2026-07-20)**: không cần thêm `DELETE /api/v1/policies/:id` — Backend chỉ cần implement
`PUT` hỗ trợ đổi `isActive` như mục 5 đã đặc tả.

### 6.2. Trang chi tiết báo giá (Admin + Manager) đang đọc thẳng `MOCK_POLICIES` — **đã sửa ở FE**

`src/app/admin/quotations/[id]/page.tsx` và `src/app/manager/quotations/[id]/page.tsx` trước đây import
trực tiếp `MOCK_POLICIES` từ `src/mocks/apiFixtures.ts` để hiển thị block "Điều khoản chung", **vi phạm**
quy tắc CLAUDE.md mục 4 ("Mọi gọi API phải đi qua lớp `services/*.service.ts`").

**Đã sửa (2026-07-20)**: cả 2 trang giờ gọi `policyApiService.getPolicies({ isActive: true })` trong
`useEffect` (load 1 lần khi mount), rồi tự lọc `policyType in [DEPOSIT, CANCELLATION]` ở client để hiển
thị "Chính sách chung" — không còn import `MOCK_POLICIES` trực tiếp. Hệ quả **cần Backend xác nhận**:
**Manager cũng cần quyền GET `/policies`** (đã ghi ở mục 0), dù không vào được trang `/admin/policies`,
vì màn chi tiết báo giá bên Manager giờ gọi thật endpoint này.

### 6.3. Các con số nghiệp vụ cốt lõi hard-code trên FE — **đã sửa 1 chỗ, còn 1 chỗ cần Backend quyết định thêm**

CLAUDE.md mục 1 liệt kê các quy tắc nghiệp vụ cốt lõi (mốc hoàn cọc 30/7 ngày, tỉ lệ 100%/50%/0%, đền bù
100% giá mua, ngưỡng phụ phí vận chuyển 2km, đơn giá công theo buổi...) — đã rà soát toàn bộ FE, tìm
được 2 nơi hard-code trùng với dữ liệu `MOCK_POLICIES`:

- **`src/components/orders/CancelOrderModal.tsx` — đã sửa (2026-07-20)**: trước đây hard-code tỉ lệ hoàn
  cọc `100`/`50`/`0` ngay trong code. Giờ modal gọi `policyApiService.getPolicies({ policyType:
  'CANCELLATION', isActive: true })` khi mở, sắp xếp 3 chính sách theo `policyValue` giảm dần rồi dùng
  trực tiếp `policyValue`/`policyName` của từng bản ghi để tính % hoàn cọc và hiển thị nhãn — sửa policy
  ở `/admin/policies` sẽ phản ánh ngay ở modal này. Mốc **số ngày** (30/7) vẫn giữ là hằng số cố định
  trong code FE vì `BusinessPolicy` **chưa có field ngưỡng ngày cấu trúc** (số ngày hiện chỉ nằm trong
  text tự do của `policyName`/`description`) — có fallback về đúng 3 mốc mặc định nếu API trả về ít hơn 3
  chính sách CANCELLATION đang active (vd Admin lỡ tắt bớt 1 chính sách).
- **`src/mocks/db/changeRequests.ts` (`FIELD_TRANSPORT_FEE = 150_000`, ngưỡng `distanceKm > 2`) — CHƯA
  sửa, cần Backend/Product quyết định trước**: khớp policy `PHI-VC-PHATSINH` (`policyValue: 2, unit:
  'km'`) nhưng phát sinh vấn đề khác với `CancelOrderModal.tsx` — **`BusinessPolicy` hiện chỉ mô hình
  hóa được NGƯỠNG (2km), không có field nào lưu SỐ TIỀN phụ phí (150.000đ) thực tế**. Tức là dù đọc
  `policyValue` của `PHI-VC-PHATSINH` cũng chỉ lấy lại được số `2`, không thay thế được hằng số
  `FIELD_TRANSPORT_FEE`. Thêm vào đó, hàm chứa logic này (`computeChangeRequestDelta`) là hàm thuần
  đồng bộ được gọi ở nhiều nơi tính tổng tiền Change Request — đổi sang đọc API bất đồng bộ sẽ lan ra
  nhiều màn hình hơn, rủi ro cao hơn hẳn so với 1 modal đơn lẻ như trên. **Cần Backend/Product chốt
  trước**: có nên thêm 1 field số tiền (vd `policyValue2`/bảng chính sách riêng cho phụ phí có ngưỡng +
  đơn giá) hay giữ nguyên 150.000đ là hằng số cấu hình riêng ngoài `BusinessPolicy` — việc sửa
  `changeRequests.ts` phụ thuộc quyết định này nên **ngoài phạm vi xử lý của lượt sửa này**.

### 6.4. `GET /policies` không phân trang/search server-side — **đã bổ sung**

**Đã sửa (2026-07-20)**: bổ sung `search`/`page`/`limit` vào `GetPoliciesQuery` (`types/policy.ts`) và
mock adapter (`mockAdapter.ts` — lọc theo `policyCode`/`policyName` rồi phân trang, dùng lại helper
`paginate()` đã dùng cho các danh sách khác). `src/app/admin/policies/page.tsx` đã đổi sang gửi
`search`/`page`/`limit` lên API và đọc `res.meta.totalCount` để phân trang (giống hệt pattern
`admin/catalog/categories/page.tsx`) thay vì tải toàn bộ rồi tự `slice` ở client như trước.

**Ghi chú tương thích ngược cho Backend**: 3 param này **optional** — nếu request không gửi `page`/
`limit` (trường hợp `CancelOrderModal.tsx`/2 trang chi tiết báo giá ở mục 6.2/6.3, vốn cần lấy *toàn bộ*
danh sách chính sách active để tự lọc/tính toán, không phân trang), backend nên trả **toàn bộ** danh
sách đã lọc theo `policyType`/`isActive`/`search` trong 1 lần, không tự ép `limit` mặc định nhỏ.

## 7. Việc cần làm ở FE khi nối API thật (chưa làm, ghi chú lại)

- Trang `/admin/policies`, 2 trang chi tiết báo giá (mục 6.2) và `CancelOrderModal.tsx` (mục 6.3) hiện đã
  gọi thẳng `policyApiService` (không còn dùng mock cứng `MOCK_POLICIES` import trực tiếp) — chỉ cần bật
  lại kết nối thật cho `policyApiService` (đang bị chặn qua `mockAdapter.ts` trong giai đoạn UI-first).
- Bổ sung validate not-blank cho `policyCode`/`policyName`/`unit` và validate `policyValue` ở submit
  handler (`handleCreateSubmit`), hiện chỉ dựa vào `required` ở HTML.
- Xử lý lỗi 409 (nếu Backend chốt `policyCode` phải unique — mục 4) hiển thị vào `errorMessage` của
  `PolicyFormModal`.
- Thêm confirm dialog trước khi bật/tắt chính sách (`handleToggleActive` hiện gọi API ngay không hỏi lại)
  — cải thiện UX, không phải yêu cầu backend.
- Sau khi Backend/Product chốt hướng ở mục 6.3 (phụ phí vận chuyển >2km), cập nhật
  `src/mocks/db/changeRequests.ts` (`FIELD_TRANSPORT_FEE`) tương ứng.
