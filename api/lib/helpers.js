import { db } from './firebaseAdmin.js';
import admin from 'firebase-admin'; // Cần cho FieldPath

// Hàm này lấy TẤT CẢ quiz ID từ 1 giỏ hàng (cart)
export const getQuizIdsFromCart = async (cart) => {
  const allQuizIds = new Set();
  const { subjects = [], courses = [] } = cart;

  // 1. Lấy quiz từ Môn học (Subjects)
  if (subjects.length > 0) {
    const subjectsSnapshot = await db.collection('subjects')
      .where(admin.firestore.FieldPath.documentId(), 'in', subjects)
      .get();
      
    subjectsSnapshot.forEach(doc => {
      const quizIds = doc.data().quizIds || [];
      quizIds.forEach(id => allQuizIds.add(id));
    });
  }

  // 2. Lấy quiz từ Khóa học (Courses)
  if (courses.length > 0) {
    const coursesSnapshot = await db.collection('courses')
      .where(admin.firestore.FieldPath.documentId(), 'in', courses)
      .get();
      
    coursesSnapshot.forEach(doc => {
      const quizIds = doc.data().quizIds || [];
      quizIds.forEach(id => allQuizIds.add(id));
    });
  }
  
  return Array.from(allQuizIds);
};