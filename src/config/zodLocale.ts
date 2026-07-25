import { z } from 'zod';
import { vi } from 'zod/locales';

// Việt hóa toàn bộ message mặc định của Zod (invalid_type, too_small không có message tùy chỉnh,
// unrecognized_keys từ .strict(), invalid_enum_value...) — trước đây các message này rơi vào default
// tiếng Anh của Zod dù đã dịch hết message tùy chỉnh (min/refine...) trong từng validator. Import file
// này 1 lần duy nhất ở app.ts, TRƯỚC khi router (và do đó mọi schema) được dùng để parse request.
z.config(vi());
