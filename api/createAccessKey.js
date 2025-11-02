import { db, auth } from './lib/firebaseAdmin.js';
import admin from 'firebase-admin'; // Cần cho FieldValue

// Hàm tạo Key ngẫu nhiên
const generateAccessKey = (length = 12) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
    if ((i + 1) % 4 === 0 && i + 1 < length) {
      result += '-'; // Ví dụ: A1B2-C3D4-E5F6
    }
  }
  return result; 
};

export default async function handler(req, res) {
  // --- ⚡ MỚI: XỬ LÝ CORS ---
  res.setHeader('Access-Control-Allow-Origin', '*'); // Cho phép mọi domain
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Xử lý yêu cầu OPTIONS (preflight)
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
    const { status, unlocksCapability, cartToUnlock, orderId } = req.body;
    
    // --- 3. Logic chính: Tạo Key ---
    const newKey = generateAccessKey();
    const keyRef = db.collection('accessKeys').doc(newKey);
    
    const keyData = {
      status: status || 'new',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    if (unlocksCapability) {
      keyData.unlocksCapability = unlocksCapability;
    } else if (cartToUnlock) {
      keyData.cartToUnlock = cartToUnlock;
    } else {
      throw new Error("Phải cung cấp 'unlocksCapability' hoặc 'cartToUnlock'");
    }
    
    if (orderId) {
      keyData.orderId = orderId; // Liên kết với đơn hàng (nếu có)
    }
    
    // Lưu Key mới vào DB
    await keyRef.set(keyData);

    // --- 4. Trả về kết quả ---
    res.status(200).json({ 
      success: true, 
      key: newKey,
      message: `Tạo key ${newKey} thành công.` 
    });

  } catch (error) {
    console.error('Lỗi khi tạo key:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
}