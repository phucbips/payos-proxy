// Import thư viện PayOS
const PayOS = require("@payos/node");

// Khởi tạo PayOS. Các key này sẽ được lấy từ Biến môi trường Vercel
// process.env.PAYOS_CLIENT_ID
// process.env.PAYOS_API_KEY
// process.env.PAYOS_CHECKSUM_KEY
const payOS = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

// Đây là function chính sẽ chạy trên Vercel
export default async function handler(req, res) {
  // --- Cấu hình CORS ---
  // Cho phép trình duyệt từ frontend Firebase của bạn gọi API này
  // !!! QUAN TRỌNG: Thay đổi 'https://thpt-chi-linh.web.app' thành tên miền Firebase chính xác của bạn
  res.setHeader("Access-Control-Allow-Origin", "https://thpt-chi-linh.web.app"); 
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Xử lý request 'OPTIONS' (preflight) của trình duyệt
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  // ---------------------

  // Chỉ cho phép phương thức POST
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // Lấy dữ liệu (amount, description...) gửi lên từ frontend
    const { orderCode, amount, description, cancelUrl, returnUrl } = req.body;

    // Kiểm tra dữ liệu đầu vào cơ bản
    if (!orderCode || !amount || !description || !cancelUrl || !returnUrl) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc." });
    }

    const paymentData = {
      orderCode: Number(orderCode), // Đảm bảo orderCode là số
      amount: Number(amount),
      description: String(description),
      cancelUrl: String(cancelUrl),
      returnUrl: String(returnUrl),
    };

    // Gọi API PayOS để tạo link thanh toán
    const paymentLink = await payOS.createPaymentLink(paymentData);

    // Trả link thanh toán về cho frontend Firebase
    return res.status(200).json(paymentLink);

  } catch (error) {
    console.error("Lỗi khi tạo link PayOS:", error);
    return res.status(500).json({ error: "Có lỗi xảy ra phía máy chủ proxy.", details: error.message });
  }
}