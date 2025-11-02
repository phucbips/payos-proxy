import { db, auth } from './lib/firebaseAdmin.js';
import admin from 'firebase-admin'; // ⚡ SỬA LỖI: Cần import admin

export default async function handler(req, res) {
  // --- ⚡ MỚI: XỬ LÝ CORS ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  // --- KẾT THÚC CORS ---

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Phương thức không được phép' });
  }

  try {
    // --- 1. Xác thực Admin ---
    const authorization = req.headers.authorization;
    const token = authorization?.split('Bearer ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Token xác thực bị thiếu' });
    }
    
    const decodedToken = await auth.verifyIdToken(token);
    if (decodedToken.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Không có quyền Admin' });
    }

    // --- 2. Lấy dữ liệu từ body ---
    const { uid, role } = req.body;

    if (!uid || !role) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin uid hoặc role' });
    }
    
    // --- 3. Cập nhật role cho user ---
    
    // BƯỚC 3A: CẬP NHẬT FIREBASE AUTH (RẤT QUAN TRỌNG)
    await auth.setCustomUserClaims(uid, { role: role });

    // BƯỚC 3B: CẬP NHẬT FIRESTORE
    await db.collection('users').doc(uid).update({
      role: role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() // ⚡ SỬA LỖI: Dùng admin.
    });

    // --- 4. Trả về kết quả ---
    res.status(200).json({ 
      success: true, 
      message: `Cập nhật role thành công cho user ${uid}.` 
    });

  } catch (error) {
    console.error('Lỗi khi cấp role:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
}