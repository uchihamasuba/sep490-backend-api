# API cần bổ sung ở Backend

Danh sách các endpoint/cấu hình backend chưa có, phát hiện trong quá trình nối API thật — ghi theo yêu
cầu người dùng để backend team tự triển khai sau, không phải việc frontend tự làm.

## 1. Cấu hình tài khoản ngân hàng công ty (dùng cho mã VietQR nhận cọc/quyết toán)

- **Màn liên quan**: "Cổng thanh toán VietQR" ở trang chi tiết đặt cọc
  (`/manager/payments/deposits/[id]`, `/admin/orders_audit/payments/[id]`) — xem
  [`docs/datcoc_api.md`](datcoc_api.md).
- **Hiện trạng (2026-07-21)**: mã QR đã đổi từ hoa văn giả sang **VietQR thật** qua "Quick Link" công
  khai của `img.vietqr.io` (không cần đăng ký/API key, xem
  https://www.vietqr.io/danh-sach-api/quick-link) — quét được thật bằng app ngân hàng, đúng tài khoản/
  số tiền/nội dung. Đã xác nhận qua `curl`: `img.vietqr.io/image/970436-0828937456-qr_only.png?...` trả
  về `200 image/png` thật.
- **Vấn đề**: tài khoản ngân hàng dùng để sinh mã (`bankBin`/`accountNumber`/`accountName`) đang
  **hardcode ở FE** (`src/constants/company-bank.ts`, người dùng cung cấp trực tiếp qua chat, không có
  trong DB). Bảng `deposits` chỉ có cột `qr_code_url` để **lưu kết quả** (hiện luôn `null` ở dữ liệu
  test thật — xác nhận qua curl trước đó), **không có bảng/cấu hình nào lưu tài khoản ngân hàng nhận
  tiền của công ty**.
- **Rủi ro nếu giữ nguyên hardcode ở FE**: đổi tài khoản ngân hàng sau này phải sửa code + deploy lại
  FE thay vì đổi cấu hình; không tách được theo chi nhánh/khu vực nếu sau này cần nhiều tài khoản nhận
  tiền khác nhau; không có nơi nào để Admin tự cập nhật qua UI.
- **Đề xuất**:
  1. Thêm bảng cấu hình hệ thống (vd `system_settings` hoặc tái dùng `business_policies` nếu shape phù
     hợp) lưu `bankBin`/`bankName`/`accountNumber`/`accountName` — 1 dòng cấu hình chung cho toàn hệ
     thống là đủ ở quy mô hiện tại (không cần theo từng Order/chi nhánh).
  2. Thêm `GET /api/v1/settings/bank-account` (Manager + Admin đều đọc được) trả về object trên, FE gọi
     1 lần khi mở trang chi tiết đặt cọc/quyết toán thay vì hardcode.
  3. (Tùy chọn, không bắt buộc ngay) Khi tạo hồ sơ cọc (`POST /orders/:id/deposits`), backend có thể tự
     sinh sẵn `qr_code_url` bằng chính công thức Quick Link ở trên (hoặc qua VietQR API chính thức nếu
     công ty đăng ký tài khoản Pro sau này) và lưu vào cột `qr_code_url` sẵn có — FE khi đó chỉ cần
     `<img src={deposit.qrCodeUrl}>` thay vì tự build URL mỗi lần render.
- **Chưa cần làm ngay**: FE đang hoạt động đúng với cách hardcode tạm thời, không chặn demo. Chỉ cần
  làm khi Product/Backend rảnh tay hoặc khi có nhu cầu đổi tài khoản/nhiều tài khoản.
