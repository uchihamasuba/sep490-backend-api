# API modal "Tạo chính sách mới" (`/admin/policies` — nút "+ Tạo chính sách")

> Tài liệu tập trung riêng cho **1 endpoint** (`POST /api/v1/policies`) phục vụ modal "Tạo chính sách
> mới" theo đúng ảnh mẫu người dùng cung cấp (tiêu đề "Tạo chính sách mới", mô tả phụ "Thêm một chính
> sách nghiệp vụ mới (cọc, hoàn cọc, đền bù, phụ phí, tiền công...)", 6 trường `Mã chính sách`/`Loại
> chính sách`/`Tên chính sách`/`Giá trị`/`Đơn vị`/`Mô tả`, nút `Hủy`/`Tạo chính sách`) — tách riêng để
> đưa cho backend làm trước, không cần đọc toàn bộ tài liệu màn danh sách.
>
> Đây là **bản trích + tự-đầy-đủ** của mục 4 trong
> [`docs/admin_chinhsach_api.md`](./admin_chinhsach_api.md) (tài liệu tổng cho cả màn `/admin/policies`,
> gồm cả GET danh sách và PUT sửa/bật-tắt) — 2 file có nội dung trùng nhau ở phần tạo mới, đây không phải
> API riêng biệt mà là cùng 1 endpoint. Nếu backend cần bức tranh đầy đủ cả màn (danh sách, sửa, bật/tắt,
> phân quyền), đọc thêm file đó; nếu chỉ cần build nhanh chức năng tạo mới, file này là đủ.
>
> Được viết dựa trên:
> - Code FE: `src/components/policies/PolicyFormModal.tsx` (form, chế độ `create` — khớp 100% ảnh mẫu),
>   `src/app/admin/policies/page.tsx` (nơi mở modal + gọi API, hàm `handleCreateSubmit`),
>   `src/types/policy.ts` (`CreatePolicyPayload`, `BusinessPolicy`, `PolicyType` — comment đầu file ghi
>   nguồn đối chiếu `D:\bnwems-backend-api prisma/schema.prisma` model `BusinessPolicy`, enum
>   `PolicyType`, `policy.route.ts`, `policy.validator.ts` — **các file backend này nằm ngoài repo hiện
>   tại, không đọc lại được trực tiếp trong phiên làm việc này**, chỉ dùng lại comment ghi chú sẵn làm
>   căn cứ), `src/services/policy.service.ts` (`policyApiService.createPolicy`, đã implement sẵn ở tầng
>   FE), `src/services/mockAdapter.ts` (dòng 710-716, mock đang dùng tạm trong giai đoạn UI-first, CLAUDE.md
>   mục 0).
> - **Không có MCP truy vấn database khả dụng trong phiên làm việc này** — tài liệu này không tự chạy
>   `SHOW CREATE TABLE`/truy vấn schema thật. Dùng lại căn cứ gián tiếp trong repo: comment đầu
>   `src/types/policy.ts` làm nguồn đáng tin cậy nhất cho hình dạng dữ liệu.

## 1. Endpoint

```
POST /api/v1/policies
```

**Permission**: chỉ **Admin** (`master-data:manage`, `src/constants/permissions.ts`) — nút "+ Tạo chính
sách" chỉ hiện khi `usePermission().can('master-data:manage')` (`page.tsx` dòng 166). Endpoint **phải
chặn ở tầng API** (401/403 nếu không đăng nhập hoặc không có quyền), không chỉ ẩn nút ở FE.

## 2. Request body — `CreatePolicyPayload` (`types/policy.ts` dòng 30-37)

| Field | Kiểu | Bắt buộc | Ghi chú |
|---|---|---|---|
| `policyCode` | string | Có | Mã định danh chính sách, vd `HOAN-COC-30`. Nhập tự do ở form (không có gợi ý/autocomplete). Không sửa được sau khi tạo. |
| `policyName` | string | Có | Tên hiển thị, vd "Hoàn cọc khi hủy đơn ≥30 ngày trước sự kiện". Không sửa được sau khi tạo. |
| `policyType` | `PolicyType` (enum, xem mục 3) | Có | Dropdown "Loại chính sách", mặc định chọn sẵn `DEPOSIT` khi mở modal. Không sửa được sau khi tạo. |
| `policyValue` | number | Có | Input số. FE ép `Number(value) || 0` khi gõ — **không tự chặn giá trị âm hoặc bằng 0** trước khi submit, backend phải tự validate. |
| `unit` | string | Có | Chuỗi tự do (vd "%", "km", "VNĐ/buổi", "% giá mua", "Ngày") — **không ràng buộc enum** (theo comment `types/policy.ts` dòng 14, đối chiếu `policy.validator.ts` backend). |
| `description` | string | Không | Textarea 3 dòng, có thể để trống. |

```json
// Request mẫu — khớp đúng dữ liệu placeholder trong ảnh mẫu
{
  "policyCode": "HOAN-COC-30",
  "policyName": "Hoàn cọc khi hủy đơn ≥30 ngày trước sự kiện",
  "policyType": "DEPOSIT",
  "policyValue": 0,
  "unit": "%, km, VNĐ/buổi",
  "description": ""
}
```

**Validate tối thiểu ở FE hiện tại**: `policyCode`/`policyName`/`unit` chỉ có `required` ở HTML input
(chưa có validate JS bổ sung), `policyType` bắt buộc chọn 1 trong 5 giá trị cố định qua dropdown (không
gõ tự do được nên FE luôn gửi giá trị hợp lệ), `policyValue` luôn là number hợp lệ (ép kiểu ở
`onChange`, mặc định `0` nếu input rỗng/không phải số). **Backend không nên tin nguyên trạng dữ liệu từ
FE** — cần tự validate:
- `policyCode`/`policyName`/`unit`: not-blank sau khi trim.
- `policyValue`: là số hợp lệ theo `policyType` (vd không cho âm; cân nhắc chặn `= 0` nếu nghiệp vụ không
  hợp lý, hiện FE không chặn).
- `policyType`: đúng 1 trong 5 giá trị enum ở mục 3 (phòng trường hợp gọi API trực tiếp không qua FE).

## 3. `PolicyType` — 5 giá trị cố định cho dropdown "Loại chính sách"

| Giá trị gửi lên API | Nhãn hiển thị trong dropdown (VI) | Thứ tự trong dropdown |
|---|---|---|
| `DEPOSIT` | Đặt cọc | 1 (mặc định chọn sẵn) |
| `CANCELLATION` | Hủy đơn & hoàn cọc | 2 |
| `COMPENSATION` | Đền bù thiết bị | 3 |
| `FEE` | Phụ phí | 4 |
| `WAGE` | Tiền công nhân sự | 5 |

Đây thuần là **danh mục loại** để FE nhóm/hiển thị badge màu ở bảng danh sách — các con số nghiệp vụ
thật (%, ngưỡng ngày, đơn giá...) nằm ở `policyValue`/`unit` của từng bản ghi, backend không cần tính
toán gì thêm dựa trên `policyType`.

## 4. `policyCode` unique?

Form không có thông báo lỗi trùng mã nào được thiết kế sẵn trên UI, nhưng **nên** validate unique ở
backend — nếu chốt cần unique, trả **409 Conflict** kèm `message` mô tả lỗi, FE đã có sẵn cơ chế đọc
`response.data.message` để hiển thị vào dòng lỗi đỏ cuối form (`errorMessage` trong
`PolicyFormModal.tsx` dòng 173-175, xem khối `bg-red-50` trong form).

## 5. Response

**201 Created** — trả về object `BusinessPolicy` đầy đủ, gồm cả field do backend tự sinh:

```json
{
  "policyId": "pol-9",
  "policyCode": "HOAN-COC-30",
  "policyName": "Hoàn cọc khi hủy đơn ≥30 ngày trước sự kiện",
  "policyType": "DEPOSIT",
  "policyValue": 0,
  "unit": "%, km, VNĐ/buổi",
  "description": "",
  "isActive": true,
  "createdAt": "2026-07-20T00:00:00Z",
  "updatedAt": "2026-07-20T00:00:00Z"
}
```

| Field bổ sung so với request | Ghi chú |
|---|---|
| `policyId` | Backend tự sinh (mock FE hiện dùng `nextId('policy')`). |
| `isActive` | Mặc định `true` khi tạo mới — form tạo mới không có ô chọn trạng thái (chỉ modal "Sửa" mới có checkbox "Đang áp dụng"). |
| `createdAt` / `updatedAt` | Backend tự set, cùng giá trị khi vừa tạo. |

Sau khi tạo thành công, FE đóng modal và load lại trang 1 của danh sách (`page.tsx`, hàm
`handleCreateSubmit`) — không cần response trả kèm `meta` phân trang.

**Lỗi**:
| Status | Khi nào | FE xử lý |
|---|---|---|
| 400 | Thiếu field bắt buộc / `policyValue` không hợp lệ / `policyType` không đúng enum | Hiển thị `message` vào `errorMessage` của modal |
| 401/403 | Không đăng nhập hoặc không có quyền `master-data:manage` | Hiển thị `message` vào `errorMessage` của modal |
| 409 | (Nếu chốt unique `policyCode` — xem mục 4) | Hiển thị `message` vào `errorMessage` của modal |

## 6. Việc cần làm ở FE khi nối API thật (chưa làm, ghi chú lại)

- Bật lại kết nối thật cho `policyApiService.createPolicy` (đang bị chặn qua `mockAdapter.ts` trong giai
  đoạn UI-first, CLAUDE.md mục 0).
- Bổ sung validate not-blank cho `policyCode`/`policyName`/`unit` và validate `policyValue` ở
  `handleCreateSubmit`, hiện chỉ dựa vào `required` ở HTML.
- Xử lý lỗi 409 (nếu Backend chốt `policyCode` phải unique — mục 4) hiển thị vào `errorMessage` của
  `PolicyFormModal`.
