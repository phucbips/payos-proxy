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
    // --- 1. Xác thực User ---
    const authorization = req.headers.authorization;
    const token = authorization?.split('Bearer ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Token xác thực bị thiếu' });
    }
    
    const decodedToken = await auth.verifyIdToken(token);

    // --- 2. Lấy dữ liệu từ body ---
    const { cart, paymentMethod, amount } = req.body;
    if (!cart || (!cart.subjects?.length && !cart.courses?.length)) {
      return res.status(400).json({ success: false, message: 'Giỏ hàng không hợp lệ' });
    }

    // --- 3. Tạo đơn hàng mới ---
    const orderData = {
      userId: decodedToken.uid,
      userName: decodedToken.email || decodedToken.uid,
      cart: cart,
      paymentMethod: paymentMethod || 'unknown',
      amount: amount || 0,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(), // ⚡ SỬA LỖI: Dùng server time
      updatedAt: admin.firestore.FieldValue.serverTimestamp()  // ⚡ SỬA LỖI: Dùng server time
    };

    // Thêm đơn hàng vào database
    const orderRef = await db.collection('orders').add(orderData);
    const orderId = orderRef.id;

    // --- 4. Trả về kết quả ---
    res.status(200).json({ 
      success: true, 
      orderId: orderId,
      message: 'Tạo đơn hàng thành công. Vui lòng chờ admin xử lý.' 
    });

  } catch (error) {
    console.error('Lỗi khi tạo đơn hàng:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
}