import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { AppError } from '../utils/AppError';
import { env } from './env';

let app: App | null = null;

// FIREBASE_* là optional ở env.ts (chỉ tính năng upload evidence phụ thuộc) — lazy-init để không chặn
// boot server khi chưa cấu hình, chỉ báo lỗi rõ ràng đúng lúc gọi upload.
function getFirebaseApp(): App {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0]!;
    return app;
  }

  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY || !env.FIREBASE_STORAGE_BUCKET) {
    throw AppError.internal('Firebase Storage chưa được cấu hình (thiếu FIREBASE_* env vars)');
  }

  app = initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      // .env lưu \n dạng escaped literal — cần unescape trước khi đưa cho SDK.
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    storageBucket: env.FIREBASE_STORAGE_BUCKET,
  });
  return app;
}

export function getEvidenceBucket() {
  return getStorage(getFirebaseApp()).bucket();
}
