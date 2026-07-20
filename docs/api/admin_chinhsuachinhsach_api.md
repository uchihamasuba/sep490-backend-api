# API modal "Chỉnh sửa chính sách" (`/admin/policies` — icon bút chì Sửa)

> Tài liệu tập trung riêng cho **1 endpoint** (`PUT /api/v1/policies/:id`) phục vụ modal "Chỉnh sửa
> chính sách" theo đúng ảnh mẫu người dùng cung cấp (tiêu đề "Chỉnh sửa chính sách", mô tả phụ "Cập nhật
> giá trị/trạng thái của chính sách "Hoàn cọc khi hủy đơn ≥30 ngày trước sự kiện"", 2 trường đầu (`Mã
> chính sách`, `Loại chính sách`) và `Tên chính sách` hiển thị nhưng **disabled**, ghi chú xám nghiêng
> "Mã, loại và tên chính sách không thể sửa sau khi tạo — chỉ có thể đổi giá trị, đơn vị, mô tả và trạng
> thái.", 2 trường `Giá trị`/`Đơn vị` sửa được, `Mô tả` sửa được, checkbox "Đang áp dụng", nút
> `Hủy`/`Lưu thay đổi`) — tách riêng để đưa cho backend làm trước, không cần đọc toàn bộ tài liệu màn
> danh sách.
>
> Đây là **bản trích + tự-đầy-đủ** của mục 5 trong
> [`docs/admin_chinhsach_api.md`](./admin_chinhsach_api.md) (tài liệu tổng cho cả màn `/admin/policies`,
> gồm cả GET danh sách và POST tạo mới) — 2 file có nội dung trùng nhau ở phần sửa, đây không phải API
> riêng biệt mà là cùng 1 endpoint (cùng file cũng dùng cho thao tác bật/tắt nhanh icon nguồn điện, xem
> mục 6). Nếu backend cần bức tranh đầy đủ cả màn (danh sách, tạo mới, phân quyền), đọc thêm file đó và
> [`docs/admin_taochinhsachmoi_api.md`](./admin_taochinhsachmoi_api.md) (modal tạo mới, endpoint khác);
> nếu chỉ cần build nhanh chức năng sửa, file này là đủ.
>
> Được viết dựa trên:
> - Code FE: `src/components/policies/PolicyFormModal.tsx` (form, chế độ `edit` — khớp 100% ảnh mẫu, dòng
>   104-171), `src/app/admin/policies/page.tsx` (nơi mở modal + gọi API, hàm `handleEditSubmit` dòng
>   107-124 và `handleToggleActive` dòng 126-129), `src/types/policy.ts` (`UpdatePolicyPayload`,
>   `BusinessPolicy`, `PolicyType` — comment đầu file ghi nguồn đối chiếu
>   `D:\bnwems-backend-api prisma/schema.prisma` model `BusinessPolicy`, enum `PolicyType`,
>   `policy.route.ts`, `policy.validator.ts` — **các file backend này nằm ngoài repo hiện tại, không đọc
>   lại được trực tiếp trong phiên làm việc này**, chỉ dùng lại comment ghi chú sẵn làm căn cứ),
>   `src/services/policy.service.ts` (`policyApiService.updatePolicy`, đã implement sẵn ở tầng FE),
>   `src/services/mockAdapter.ts` (dòng 716-723, mock đang dùng tạm trong giai đoạn UI-first, CLAUDE.md
>   mục 0).
> - **Không có MCP truy vấn database khả dụng trong phiên làm việc này** — tài liệu này không tự chạy
>   `SHOW CREATE TABLE`/truy vấn schema thật. Dùng lại căn cứ gián tiếp trong repo: comment đầu
>   `src/types/policy.ts` làm nguồn đáng tin cậy nhất cho hình dạng dữ liệu.

## 1. Endpoint

```
PUT /api/v1/policies/:id
```

`:id` là `policyId` của bản ghi `BusinessPolicy` đang sửa (lấy từ dòng được bấm icon bút chì trong bảng
danh sách).

**Permission**: chỉ **Admin** (`master-data:manage`, `src/constants/permissions.ts`) — icon bút chì chỉ
hiện khi `usePermission().can('master-data:manage')` (`page.tsx` dòng 166, 198). Endpoint **phải chặn ở
tầng API** (401/403 nếu không đăng nhập hoặc không có quyền), không chỉ ẩn nút ở FE.

## 2. Request body — `UpdatePolicyPayload` (`types/policy.ts` dòng 40-45)

Tất cả field đều **optional** — client gửi field nào thì sửa field đó, không gửi thì giữ nguyên giá trị
cũ. Riêng modal "Chỉnh sửa chính sách" (khác thao tác bật/tắt nhanh ở mục 6) luôn gửi đủ cả 4 field vì
form load sẵn giá trị hiện tại của bản ghi:

| Field | Kiểu | Modal Sửa có gửi? | Ghi chú |
|---|---|---|---|
| `policyValue` | number | Có | Input số, load sẵn giá trị cũ. FE ép `Number(value) \|\| 0` khi gõ — **không tự chặn giá trị âm hoặc bằng 0** trước khi submit, backend phải tự validate. |
| `unit` | string | Có | Chuỗi tự do (vd "%", "km", "VNĐ/buổi", "% giá mua", "Ngày") — **không ràng buộc enum** (theo comment `types/policy.ts` dòng 14, đối chiếu `policy.validator.ts` backend). Load sẵn giá trị cũ. |
| `description` | string | Có (có thể rỗng) | Textarea 3 dòng, load sẵn giá trị cũ, FE gửi `undefined` nếu để trống (`values.description \|\| undefined` ở `page.tsx` dòng 114) — backend nên hiểu "không gửi field / gửi rỗng" là **xóa mô tả**, không phải "giữ nguyên". |
| `isActive` | boolean | Có | Checkbox "Đang áp dụng", load sẵn giá trị cũ (`true`/`false`). |

**Không có trong payload của modal Sửa** — `policyCode`/`policyName`/`policyType` **không được gửi lên**
dù `UpdatePolicyPayload` không khai báo các field này (type không cho phép về mặt TypeScript). 3 input
tương ứng trên form bị `disabled` khi `mode === 'edit'` (`PolicyFormModal.tsx` dòng 108, 115, 124), kèm
ghi chú ngay trên form đúng như trong ảnh mẫu: *"Mã, loại và tên chính sách không thể sửa sau khi tạo —
chỉ có thể đổi giá trị, đơn vị, mô tả và trạng thái."* — **backend nên từ chối (400)** nếu một request PUT
nào đó (gọi trực tiếp, không qua FE) vô tình gửi kèm 3 field này khác giá trị hiện tại của bản ghi, thay
vì âm thầm bỏ qua.

```json
// Request mẫu — khớp đúng dữ liệu trong ảnh mẫu (sửa chính sách HOAN-COC-30)
{
  "policyValue": 100,
  "unit": "%",
  "description": "Khách báo hủy trước ≥30 ngày so với ngày lắp đặt: hoàn 100% tiền cọc.",
  "isActive": true
}
```

**Validate tối thiểu ở FE hiện tại**: `unit` chỉ có `required` ở HTML input (chưa có validate JS bổ
sung), `policyValue` luôn là number hợp lệ (ép kiểu ở `onChange`, mặc định `0` nếu input rỗng/không phải
số), `description`/`isActive` không có ràng buộc. **Backend không nên tin nguyên trạng dữ liệu từ FE** —
cần tự validate:
- `unit`: not-blank sau khi trim (nếu field có trong request).
- `policyValue`: là số hợp lệ theo `policyType` hiện tại của bản ghi (vd không cho âm; cân nhắc chặn `= 0`
  nếu nghiệp vụ không hợp lý, hiện FE không chặn).
- `policyCode`/`policyName`/`policyType`: từ chối request nếu có mặt trong body và khác giá trị hiện tại
  (xem đoạn trên).

## 3. Response

**200 OK** — trả về object `BusinessPolicy` đầy đủ sau khi cập nhật:

```json
{
  "policyId": "pol-1",
  "policyCode": "HOAN-COC-30",
  "policyName": "Hoàn cọc khi hủy đơn ≥30 ngày trước sự kiện",
  "policyType": "CANCELLATION",
  "policyValue": 100,
  "unit": "%",
  "description": "Khách báo hủy trước ≥30 ngày so với ngày lắp đặt: hoàn 100% tiền cọc.",
  "isActive": true,
  "createdAt": "2026-07-15T09:00:00Z",
  "updatedAt": "2026-07-20T00:00:00Z"
}
```

| Field | Ghi chú |
|---|---|
| `policyCode` / `policyName` / `policyType` | Giữ nguyên giá trị cũ, không đổi. |
| `updatedAt` | Backend tự set lại thời điểm cập nhật. |
| Các field khác | Phản ánh đúng giá trị mới gửi lên ở mục 2. |

Sau khi sửa thành công, FE đóng modal và load lại danh sách ở trang hiện tại (`page.tsx`, hàm
`handleEditSubmit` → `refetchPolicies()`) — không cần response trả kèm `meta` phân trang.

**Lỗi**:

| Status | Khi nào | FE xử lý |
|---|---|---|
| 400 | `policyValue` không hợp lệ (âm/không phải số) / request cố gửi kèm `policyCode`/`policyName`/`policyType` khác giá trị hiện tại | Hiển thị `message` vào `errorMessage` của modal (`getErrorMessage()`, `page.tsx` dòng 278-284) |
| 401/403 | Không đăng nhập hoặc không có quyền `master-data:manage` | Hiển thị `message` vào `errorMessage` của modal |
| 404 | `policyId` không tồn tại | Hiển thị `message` vào `errorMessage` của modal |

## 4. Response khi bị đóng/hủy giữa chừng

Không áp dụng — modal chỉ gọi API khi bấm "Lưu thay đổi" (submit form), bấm "Hủy" hoặc nút X chỉ đóng
modal ở client, không gọi API.

## 5. Ràng buộc dữ liệu tham chiếu

`BusinessPolicy` được đọc lại ở nhiều nơi khác ngoài trang `/admin/policies` (màn chi tiết báo giá của cả
Admin/Manager, modal hủy đơn `CancelOrderModal.tsx` — xem `docs/admin_chinhsach_api.md` mục 0 và 6.2/6.3)
— **sửa `policyValue`/`unit`/`isActive` qua endpoint này có hiệu lực ngay lập tức ở các màn đó** (không có
cơ chế versioning/audit trail riêng cho lịch sử thay đổi chính sách ở FE hiện tại). Nếu backend cần giữ
lịch sử thay đổi giá trị chính sách để audit, đó là quyết định cần chốt riêng — ngoài phạm vi tài liệu
này.

## 6. Cùng endpoint, dùng lại cho thao tác bật/tắt nhanh

Icon nguồn điện (Power) ở cột "Thao tác" trong bảng danh sách gọi **cùng endpoint `PUT
/api/v1/policies/:id`** này nhưng **không qua modal**, chỉ gửi 1 field duy nhất, không có bước xác nhận
trước khi gọi:

```json
{ "isActive": false }
```

(`handleToggleActive`, `page.tsx` dòng 126-129). Backend xử lý giống hệt case sửa qua modal ở mục 2-3, chỉ
khác là request thực tế chỉ có 1 field trong body.

## 7. Việc cần làm ở FE khi nối API thật (chưa làm, ghi chú lại)

- Bật lại kết nối thật cho `policyApiService.updatePolicy` (đang bị chặn qua `mockAdapter.ts` trong giai
  đoạn UI-first, CLAUDE.md mục 0).
- Bổ sung validate not-blank cho `unit` và validate `policyValue` ở `handleEditSubmit`, hiện chỉ dựa vào
  `required` ở HTML.
- Thêm confirm dialog trước khi bật/tắt chính sách qua icon nguồn điện (mục 6) — cải thiện UX, không phải
  yêu cầu backend.
