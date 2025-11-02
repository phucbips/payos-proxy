import { db, auth } from './lib/firebaseAdmin.js';
import { getQuizIdsFromCart } from './lib/helpers.js';
import admin from 'firebase-admin'; // Cần cho FieldValue

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
    const uid = decodedToken.uid; // Lấy uid ở đây

    // --- 2. Lấy dữ liệu từ body ---
    // ⚡ SỬA LỖI: Đổi 'accessKey' thành 'key' để khớp với code React
    const { key } = req.body;
    if (!key) {
      return res.status(400).json({ success: false, message: 'Thiếu access key' });
    }

    // --- 3. Kiểm tra key ---
    const keyRef = db.collection('accessKeys').doc(key); // Dùng 'key'
    const keyDoc = await keyRef.get();
    
    if (!keyDoc.exists) throw new Error('Access key không tồn tại');

    const keyData = keyDoc.data();
    if (keyData.status !== 'new') throw new Error('Key đã được sử dụng hoặc đã hết hạn.'); // ⚡ SỬA LỖI: Logic

    // --- 4. Logic Xử lý Key ---
    const userRef = db.collection('users').doc(uid); // Dùng 'uid'
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    let message = '';
    
    // 4A: Xử lý Key Tính năng (ví dụ: cấp quyền Teacher)
    if (keyData.unlocksCapability) {
      let userUpdate = {
        lastAccessKeyUsed: key, // Dùng 'key'
        lastKeyUsedAt: timestamp
      };
      
      if (keyData.unlocksCapability === 'TEACHER_QUIZ_CREATION') {
        userUpdate.canCreateQuizzes = true;
        message = 'Kích hoạt quyền tạo bài tập thành công!';
      } else {
        // Các tính năng khác...
        message = 'Kích hoạt tính năng thành công!';
      }
      
      await userRef.update(userUpdate);
    } 
    // 4B: Xử lý Key Nội dung (mở khóa bài tập)
    else if (keyData.cartToUnlock) {
      const quizIdsToUnlock = await getQuizIdsFromCart(keyData.cartToUnlock);
      if (quizIdsToUnlock.length === 0) {
        // Vẫn cho phép nếu key hợp lệ nhưng không có quiz
        message = 'Key hợp lệ nhưng không có bài tập nào để unlock.';
      } else {
        await userRef.update({
          unlockedQuizzes: admin.firestore.FieldValue.arrayUnion(...quizIdsToUnlock),
          lastAccessKeyUsed: key, // Dùng 'key'
          lastKeyUsedAt: timestamp
        });
        message = `Đổi key thành công! Đã unlock ${quizIdsToUnlock.length} bài tập.`;
      }
    } else {
      throw new Error('Key không hợp lệ, không có nội dung để mở khóa.');
    }

    // --- 5. Đánh dấu key đã sử dụng ---
    await keyRef.update({
      status: 'redeemed', // ⚡ SỬA LỖI: Đổi 'used' thành 'redeemed'
      usedBy: uid,
      usedAt: timestamp
    });

    // --- 6. Trả về kết quả ---
    res.status(200).json({ 
      success: true, 
      message: message
    });

  } catch (error) {
    console.error('Lỗi khi đổi access key:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
}