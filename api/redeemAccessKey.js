import { db, auth } from './lib/firebaseAdmin.js';
import { getQuizIdsFromCart } from './lib/helpers.js';
import admin from 'firebase-admin'; // Cần cho FieldValue

export default async function handler(req, res) {
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
    const { accessKey } = req.body;

    if (!accessKey) {
      return res.status(400).json({ success: false, message: 'Thiếu access key' });
    }

    // --- 3. Kiểm tra key trong database ---
    const keyRef = db.collection('accessKeys').doc(accessKey);
    const keyDoc = await keyRef.get();
    
    if (!keyDoc.exists) {
      throw new Error('Access key không tồn tại');
    }

    const keyData = keyDoc.data();

    // Kiểm tra trạng thái key
    if (keyData.status === 'used') {
      throw new Error('Access key đã được sử dụng');
    }

    // --- 4. Lấy danh sách quiz cần unlock ---
    let quizIdsToUnlock = [];

    if (keyData.unlocksCapability) {
      // Nếu key unlock tính năng
      quizIdsToUnlock = []; // Tùy thuộc vào logic tính năng
    } else if (keyData.cartToUnlock) {
      // Nếu key unlock từ cart
      quizIdsToUnlock = await getQuizIdsFromCart(keyData.cartToUnlock);
    }

    if (quizIdsToUnlock.length === 0) {
      throw new Error('Không có bài tập nào để unlock');
    }

    // --- 5. Cập nhật user và đánh dấu key đã sử dụng ---
    const userRef = db.collection('users').doc(decodedToken.uid);
    
    // Cập nhật danh sách unlocked quizzes của user
    await userRef.update({
      unlockedQuizzes: admin.firestore.FieldValue.arrayUnion(...quizIdsToUnlock),
      lastAccessKeyUsed: accessKey,
      lastKeyUsedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Đánh dấu key đã sử dụng
    await keyRef.update({
      status: 'used',
      usedBy: decodedToken.uid,
      usedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // --- 6. Trả về kết quả ---
    res.status(200).json({ 
      success: true, 
      message: `Đổi key thành công! Đã unlock ${quizIdsToUnlock.length} bài tập.`,
      unlockedQuizzes: quizIdsToUnlock
    });

  } catch (error) {
    console.error('Lỗi khi đổi access key:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
}