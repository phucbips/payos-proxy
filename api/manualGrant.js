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
    // (uid: người nhận, type: 'subject'/'course', itemId: id của môn/khóa)
    const { uid, type, itemId } = req.body;

    if (!uid || !type || !itemId) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin uid, type, hoặc itemId' });
    }

    // --- 3. Logic chính: Tạo "giỏ hàng ảo" và cấp quyền ---
    let cartToUnlock;
    if (type === 'subject') {
      cartToUnlock = { subjects: [itemId], courses: [] };
    } else if (type === 'course') {
      cartToUnlock = { subjects: [], courses: [itemId] };
    } else {
      throw new Error("Loại vật phẩm không hợp lệ");
    }

    // Lấy các quiz ID từ giỏ hàng ảo
    const quizIdsToUnlock = await getQuizIdsFromCart(cartToUnlock);

    if (quizIdsToUnlock.length === 0) {
      throw new Error("Vật phẩm này không chứa bài tập nào.");
    }

    // Cập nhật tài liệu của người dùng
    const userRef = db.collection('users').doc(uid);
    await userRef.update({
      unlockedQuizzes: admin.firestore.FieldValue.arrayUnion(...quizIdsToUnlock)
    });

    // --- 4. Trả về kết quả ---
    res.status(200).json({ 
      success: true, 
      message: `Cấp quyền thành công ${quizIdsToUnlock.length} bài tập cho user ${uid}.` 
    });

  } catch (error) {
    console.error('Lỗi khi cấp quyền thủ công:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
}