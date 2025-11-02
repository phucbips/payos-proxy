import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(
        JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      ),
    });
  } catch (e) {
    console.error("Lỗi khởi tạo Firebase Admin:", e);
  }
}

export const db = admin.firestore();
export const auth = admin.auth();