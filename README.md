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
- **Shared**: Đính kèm minh chứng (Evidence), Danh mục (Catalog), Cấu hình (Settings), **Thông báo & Push Notification** (`notification.*` — xem mục 6).

---

## ⚠️ 5. Khắc phục sự cố thường gặp (Troubleshooting)

- **Lỗi `EADDRINUSE: address already in use :::3001`**:
  Do cổng 3001 đang bị chiếm bởi một tiến trình node ẩn. Hãy mở PowerShell chạy lệnh:
  `Stop-Process -Name "node" -Force` để tắt tiến trình đó.
- **Lỗi `PrismaClientKnownRequestError` khi thao tác DB**:
  Hãy kiểm tra xem bạn đã cấu hình đúng `DATABASE_URL` chưa, hoặc hãy chạy lại `npx prisma db push`.
- **Lỗi `DB_ERROR` hoặc 401/403 lúc test API**:
  Chắc chắn rằng bạn truyền đúng `Authorization: Bearer <token>` vào Headers. Để lấy token, hãy login bằng các user có trong Seed data (admin/manager/leader/tech - pass: `123456`).

---

## 🔔 6. Thiết lập Firebase Push Notification (hướng dẫn cho người mới lần đầu làm)

Tính năng Notification (`src/modules/shared/notification.*`) dùng chung 1 project Firebase với tính năng upload Evidence. Có **2 bộ credentials khác nhau, đừng nhầm lẫn**:

| | Dùng ở đâu | Lấy ở đâu trong Firebase Console |
|---|---|---|
| **Admin SDK credentials** | **Backend** (`.env`) — bắt buộc để server gửi được push | Project settings → tab **Service accounts** |
| **Web app config + VAPID key** | **Frontend** (code JS chạy trên trình duyệt) — để lấy device token thật | Project settings → tab **General** (config) + tab **Cloud Messaging** (VAPID key) |

Nếu 2 project Firebase khác nhau giữa Backend và Frontend, mọi thứ **sẽ chạy nhưng gửi push sẽ lỗi** (`messaging/invalid-registration-token`) — luôn xác nhận cả 2 bên cùng trỏ về 1 project.

---

### 6.1 Backend Dev: lấy Admin SDK credentials (làm 1 lần)

1. Vào [Firebase Console](https://console.firebase.google.com/) → chọn đúng project của dự án (hỏi Lead/Admin nếu chưa có quyền truy cập, đừng tự tạo project mới).
2. Bấm biểu tượng ⚙️ cạnh "Project Overview" (góc trên bên trái) → **Project settings**.
3. Chọn tab **Service accounts** → kéo xuống, bấm nút **Generate new private key** → xác nhận → trình duyệt sẽ tải về 1 file `.json` (ví dụ `bnwems-images-firebase-adminsdk-xxxxx.json`).
4. Mở file `.json` đó bằng Notepad/VSCode, tìm 4 giá trị và dán vào `.env` (copy từ `.env.example` nếu chưa có file `.env`):
   ```bash
   FIREBASE_PROJECT_ID=<giá trị "project_id" trong file json>
   FIREBASE_CLIENT_EMAIL=<giá trị "client_email" trong file json>
   FIREBASE_PRIVATE_KEY=<giá trị "private_key" trong file json — copy y nguyên>
   FIREBASE_STORAGE_BUCKET=<project_id>.appspot.com
   ```
   ⚠️ **Lỗi hay gặp nhất**: `private_key` trong file JSON chứa nhiều `\n` — phải dán **y nguyên trên 1 dòng** trong `.env` (không tự xuống dòng, không xoá `\n`). Code tự unescape lúc chạy (`src/config/firebase.ts`), bạn không cần sửa gì thêm.
5. Lưu `.env`, sau đó chạy `npm run dev` (hoặc restart nếu server đang chạy).

✅ **Dấu hiệu thành công**: terminal hiện `Server running on port 3001` và **không có** dòng log lỗi nào nhắc tới `Firebase`. Nếu thiếu/sai 1 trong 4 biến, server vẫn chạy bình thường (các biến này optional lúc boot) nhưng khi có request gọi tới tính năng push/upload evidence sẽ trả về lỗi `500 Firebase chưa được cấu hình`.

---

### 6.2 Frontend Dev (hoặc AI Agent code Frontend): tích hợp để nhận push

**Bước A — Lấy Web app config + VAPID key** (khác hoàn toàn với Admin SDK ở mục 6.1, đừng dùng nhầm):
1. Firebase Console → ⚙️ **Project settings** → tab **General** → mục "Your apps".
2. Nếu chưa có app Web (biểu tượng `</>`), bấm **Add app → Web**, đặt tên bất kỳ, bấm Register.
3. Copy object `firebaseConfig` hiện ra (dạng `{ apiKey, authDomain, projectId, messagingSenderId, appId }`).
4. Vẫn trong Project settings → tab **Cloud Messaging** → mục "Web configuration" → copy chuỗi ở **Web Push certificate (key pair)** — đây là `VAPID_KEY`.

**Bước B — Cài package Firebase trong project Frontend:**
```bash
npm install firebase
```

**Bước C — Tạo 3 file sau trong project Frontend** (copy-paste, chỉ cần điền `firebaseConfig`/`VAPID_KEY` ở bước A):

`public/firebase-messaging-sw.js` (bắt buộc đặt đúng ở thư mục `public/`, root domain — không được đổi tên file):
```js
importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: '<apiKey>',
  authDomain: '<authDomain>',
  projectId: '<projectId>',
  messagingSenderId: '<messagingSenderId>',
  appId: '<appId>',
});

const messaging = firebase.messaging();

// Notification bắn khi tab đang bị thu nhỏ / không active
messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification?.title ?? 'Thông báo', {
    body: payload.notification?.body ?? '',
  });
});
```

`src/lib/pushNotifications.js`:
```js
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: '<apiKey>',
  authDomain: '<authDomain>',
  projectId: '<projectId>',
  messagingSenderId: '<messagingSenderId>',
  appId: '<appId>',
};
const VAPID_KEY = '<VAPID_KEY>';

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Gọi hàm này 1 lần ngay sau khi user đăng nhập thành công (đã có JWT).
// API_BASE_URL ví dụ: http://localhost:3001/api/v1
export async function registerPushNotifications(jwtToken, API_BASE_URL) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('[push] user từ chối quyền nhận thông báo');
    return null;
  }

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const deviceToken = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  console.log('[push] device token:', deviceToken); // dùng để kiểm tra trực quan ở bước 6.3

  const res = await fetch(`${API_BASE_URL}/notifications/device-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwtToken}` },
    body: JSON.stringify({ deviceToken }),
  });
  if (!res.ok) throw new Error(`Đăng ký device token thất bại: ${res.status}`);
  console.log('[push] đã đăng ký device token với backend thành công');

  // Notification bắn khi tab đang mở/active — tự viết UI thay cho alert() ở dự án thật
  onMessage(messaging, (payload) => {
    console.log('[push] nhận foreground message:', payload);
    alert(`${payload.notification?.title}\n${payload.notification?.body}`);
  });

  return deviceToken;
}
```

**Bước D — Gọi hàm này** ngay sau khi login thành công (ví dụ trong hàm xử lý response của form login):
```js
import { registerPushNotifications } from './lib/pushNotifications';

// sau khi login API trả về { token, user } thành công:
await registerPushNotifications(token, 'http://localhost:3001/api/v1');
```

---

### 6.3 ✅ Checklist trực quan — xác nhận đã kết nối thành công

Làm theo thứ tự, đối chiếu đúng "Bạn sẽ thấy" ở mỗi bước thì mới chuyển bước tiếp theo:

| Bước | Hành động | Bạn sẽ thấy (= thành công) | Nếu không thấy → nguyên nhân |
|---|---|---|---|
| 1 | Mở app Frontend, đăng nhập | Popup xin quyền "Show notifications" của trình duyệt hiện ra | `registerPushNotifications()` chưa được gọi, hoặc site đang chạy `http://` (không phải `localhost`/`https`) |
| 2 | Bấm "Allow" ở popup | Console (F12) in ra `[push] device token: <chuỗi dài ...:APA91b...>` | Bấm "Block" thay vì "Allow" → xoá quyền notification của site trong Site Settings trình duyệt rồi thử lại |
| 3 | Vẫn ở Console | Dòng tiếp theo: `[push] đã đăng ký device token với backend thành công` | Nếu thấy lỗi 401 → JWT hết hạn/sai; lỗi 400 → sai format body; lỗi network/CORS → kiểm tra `CORS_ORIGIN` trong `.env` backend có khớp domain FE đang chạy không |
| 4 | Mở tab **Network** (F12), lọc `device-token` | Request `POST /notifications/device-token` có status **200** | Backend chưa chạy, hoặc sai `API_BASE_URL` |
| 5 | Gọi thử API test-send (xem lệnh curl bên dưới), dùng đúng `userId` của tài khoản vừa đăng nhập | **Trình duyệt hiện popup notification thật** (góc màn hình, kèm tiêu đề/nội dung) — hoặc `alert()` hiện ra nếu tab đang mở | Nếu curl trả về lỗi/500 → token đã lưu vào DB nhưng không hợp lệ (khác project Firebase, hoặc token cũ đã hết hạn) — quay lại Bước A lấy token mới |
| 6 | Gọi `GET /api/v1/notifications` | Thấy thông báo vừa gửi xuất hiện đầu danh sách (`isRead: false`) | Kiểm tra đang dùng đúng JWT của user vừa nhận push |

### 6.4 API Notification (tham chiếu nhanh)
Tất cả đều yêu cầu header `Authorization: Bearer <token>` (login qua `/api/v1/auth/login` trước).

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/v1/notifications/device-token` | Đăng ký/cập nhật FCM device token cho **user đang đăng nhập**. Body: `{ "deviceToken": "..." }`. |
| `GET` | `/api/v1/notifications` | Lấy danh sách thông báo của user đang đăng nhập (mới nhất trước). |
| `PATCH` | `/api/v1/notifications/:id/read` | Đánh dấu 1 thông báo đã đọc. |
| `POST` | `/api/v1/notifications/test-send` | Gửi thử 1 thông báo tới `userId` bất kỳ (tạo bản ghi DB + bắn push nếu user đó có `deviceToken`). Body: `{ "userId": "...", "title": "...", "content": "..." }`. Không giới hạn role — dùng để test tích hợp (Bước 5 ở checklist trên). |

### 6.5 Test nhanh bằng curl (không cần chạy Frontend)

**Chạy ở đâu, khi nào — đọc trước khi bắt đầu:**
- **Cần `npm run dev` đang chạy trước** (mục 2, Bước 5). Các lệnh `curl` bên dưới gọi tới `http://localhost:3001` — nếu server chưa chạy, curl sẽ báo lỗi `Failed to connect to localhost port 3001` / `Connection refused`. Cứ để `npm run dev` chạy nền suốt lúc test, **không tắt**.
- **Dùng 2 cửa sổ terminal riêng biệt**: 1 cửa sổ để chạy `npm run dev` (giữ nguyên, terminal này chỉ hiện log server, không gõ lệnh khác vào đó), 1 cửa sổ **mới** để gõ các lệnh `curl` bên dưới.
- Terminal chạy `curl` **không cần đứng ở thư mục backend** — `curl` chỉ gửi HTTP request qua mạng tới `localhost:3001`, không đọc file trong project, nên mở ở bất kỳ thư mục nào.
- **Dùng Git Bash** cho các lệnh dưới đây (mở bằng "Git Bash Here" hoặc terminal tích hợp VSCode chọn Git Bash). ⚠️ **Không dùng Windows PowerShell mặc định** — xem lý do và cách khắc phục ở khung cảnh báo ngay dưới.

> ⚠️ **Đang dùng PowerShell thay vì Git Bash?** Có 2 vấn đề cần biết:
> 1. Gõ `curl` trong PowerShell thực ra chạy `Invoke-WebRequest` (PowerShell tự alias sẵn), **không hiểu** các cờ `-X`/`-H`/`-d` như curl thật → phải gõ **`curl.exe`** (rõ đuôi `.exe`) để gọi đúng bản curl thật. Nếu chạy nhầm `curl` (không có `.exe`), PowerShell sẽ báo lỗi kiểu `Invoke-WebRequest : Cannot bind parameter 'Headers'...`.
> 2. PowerShell tự ý xoá dấu `"` bên trong chuỗi `-d '...'` trước khi đưa cho curl, làm hỏng JSON. Có 1 cách né: dùng `--%` (stop-parsing) + escape `\"` — **nhưng `--%` cũng chặn luôn việc chèn biến `$jwt`/`$userId`**, chỉ dùng được khi body không có biến (như Lệnh 1). Từ Lệnh 2 trở đi cần chèn JWT/userId lấy được từ lệnh trước, nên **cách đáng tin cậy hơn là ghi JSON ra file tạm rồi trỏ `-d @file`** — cách này đã test thật và chạy đúng.
>
> Toàn bộ 5 lệnh bên dưới, viết sẵn cho PowerShell (copy-paste, chạy tuần tự — sau Lệnh 1 nhớ dán `token`/`userId` vào 2 biến `$jwt`/`$userId` trước khi chạy tiếp):
> ```powershell
> # 1. Đăng nhập lấy JWT (không có biến nên dùng --% được)
> curl.exe --% -X POST http://localhost:3001/api/v1/auth/login -H "Content-Type: application/json" -d "{\"username\":\"tech\",\"password\":\"123456\"}"
>
> # Copy "token" và "user.userId" từ kết quả Lệnh 1 rồi dán vào đây trước khi chạy tiếp:
> $jwt = "<dán token JWT>"
> $userId = "<dán userId>"
>
> # 2. Đăng ký device token (thay <deviceToken> = token thật lấy từ Frontend, mục 6.2 Bước A-D)
> '{"deviceToken":"<deviceToken>"}' | Set-Content "$env:TEMP\device-token-body.json" -Encoding utf8
> curl.exe -s -X POST http://localhost:3001/api/v1/notifications/device-token -H "Authorization: Bearer $jwt" -H "Content-Type: application/json" -d "@$env:TEMP\device-token-body.json"
>
> # 3. Gửi thử thông báo
> ('{"userId":"' + $userId + '","title":"Hello","content":"Test push"}') | Set-Content "$env:TEMP\test-send-body.json" -Encoding utf8
> curl.exe -s -X POST http://localhost:3001/api/v1/notifications/test-send -H "Authorization: Bearer $jwt" -H "Content-Type: application/json" -d "@$env:TEMP\test-send-body.json"
>
> # 4. Xem lại danh sách thông báo (không có body nên không cần file)
> curl.exe -s -X GET http://localhost:3001/api/v1/notifications -H "Authorization: Bearer $jwt"
>
> # 5. Đánh dấu đã đọc (thay <notificationId> = notificationId lấy từ kết quả Lệnh 3 hoặc 4)
> curl.exe -s -X PATCH http://localhost:3001/api/v1/notifications/<notificationId>/read -H "Authorization: Bearer $jwt"
> ```
> Kết quả mong đợi của từng lệnh giống hệt phần Git Bash bên dưới — cứ đối chiếu theo đúng "Lệnh 1"–"Lệnh 5".

Chạy **từng lệnh một, theo đúng thứ tự** — mỗi lệnh đều có ví dụ kết quả mong đợi ngay dưới để bạn đối chiếu. Nếu output không giống mẫu, đọc cột "Nếu sai" trước khi qua lệnh tiếp theo.

**Lệnh 1 — Đăng nhập lấy JWT:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/login -H "Content-Type: application/json" -d '{"username":"tech","password":"123456"}'
```
✅ Kết quả mong đợi (status `200`) — **copy giá trị `token` và `user.userId`, sẽ dùng ở các lệnh sau**:
```json
{"success":true,"data":{"token":"eyJhbGciOiJIUzI1NiIs...","user":{"userId":"ff58ed57-331d-4dfe-9e97-4bea6fdbc710","username":"tech","fullName":"Technician","role":{...},"status":"active"}}}
```
❌ Nếu sai: `{"success":false,...}` với message sai username/password → kiểm tra lại đã chạy `npm run seed` chưa (mục 2, Bước 4).

---

**Lệnh 2 — Đăng ký device token** (thay `<jwt>` = `token` ở Lệnh 1, `<deviceToken>` = token thật lấy từ Frontend ở mục 6.2, Bước A-D):
```bash
curl -X POST http://localhost:3001/api/v1/notifications/device-token -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" -d '{"deviceToken":"<deviceToken>"}'
```
✅ Kết quả mong đợi (status `200`) — trả lại đúng `userId` và `deviceToken` bạn vừa gửi:
```json
{"success":true,"data":{"userId":"ff58ed57-331d-4dfe-9e97-4bea6fdbc710","deviceToken":"<deviceToken>"}}
```
❌ Nếu sai:
- `{"error":{"code":"UNAUTHORIZED",...}}` (status `401`) → `<jwt>` sai/hết hạn, quay lại Lệnh 1 lấy token mới.
- `{"error":{"code":"VALIDATION_ERROR",...}}` (status `400`) → thiếu field `deviceToken` hoặc để trống.

---

**Lệnh 3 — Gửi thử thông báo** (thay `<jwt>` như trên, `<userId>` = `user.userId` ở Lệnh 1):
```bash
curl -X POST http://localhost:3001/api/v1/notifications/test-send -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" -d '{"userId":"<userId>","title":"Hello","content":"Test push"}'
```
✅ Kết quả mong đợi (status `201`) — có `notificationId` mới, `isRead: false`:
```json
{"success":true,"data":{"notificationId":"0ec9d043-...","userId":"ff58ed57-...","title":"Hello","content":"Test push","notificationType":"SYSTEM","isRead":false,"readAt":null,"createdAt":"2026-07-23T17:50:57.000Z"}}
```
👉 **Đây là lúc kiểm tra bằng mắt**: nếu `deviceToken` ở Lệnh 2 là token thật thì **thiết bị đã đăng ký sẽ hiện popup push notification thật** ngay sau khi lệnh curl chạy xong (giống Bước 5 ở checklist 6.3). Có 3 khả năng dựa theo status trả về:
- **`201`, không có popup** → user đó **chưa có `deviceToken`** trong DB (null) — request tự động bỏ qua bước gửi push, không lỗi. Quay lại Lệnh 2 để đăng ký token trước.
- **`500`** (`{"error":{"code":"INTERNAL_ERROR",...}}`) → user **có** `deviceToken` nhưng Firebase từ chối gửi (`messaging/invalid-registration-token`) — bản ghi thông báo **vẫn đã được lưu vào DB** (chỉ bước push bị lỗi), thường do token đó là chuỗi giả (`dummy-device-token-...`), đã hết hạn, hoặc thuộc project Firebase khác với `FIREBASE_PROJECT_ID` ở mục 6.1. Quay lại mục 6.2 Bước A–D lấy token thật mới.
- **`201` + popup hiện ra** → mọi thứ hoạt động đúng, kết nối Frontend ↔ Backend ↔ Firebase thành công.

---

**Lệnh 4 — Xem lại danh sách thông báo** (dùng để xác nhận Lệnh 3 đã lưu đúng vào DB):
```bash
curl http://localhost:3001/api/v1/notifications -H "Authorization: Bearer <jwt>"
```
✅ Kết quả mong đợi (status `200`) — thông báo vừa tạo ở Lệnh 3 nằm **đầu danh sách** (mới nhất trước), `isRead: false`:
```json
{"success":true,"data":[{"notificationId":"0ec9d043-...","title":"Hello","content":"Test push","isRead":false,"readAt":null,...}, ...]}
```

**Lệnh 5 — Đánh dấu đã đọc** (thay `<notificationId>` = giá trị lấy từ Lệnh 3 hoặc 4):
```bash
curl -X PATCH http://localhost:3001/api/v1/notifications/<notificationId>/read -H "Authorization: Bearer <jwt>"
```
✅ Kết quả mong đợi (status `200`) — `isRead` chuyển thành `true`, có `readAt`:
```json
{"success":true,"data":{"notificationId":"0ec9d043-...","isRead":true,"readAt":"2026-07-23T17:51:13.000Z",...}}
```
