// Express 서버 초기화

require('dotenv').config() // 환경 변수 설정정
const express = require('express');
// const cors = require('cors');

const { initializeSockets } = require("./utils/socketManager");
const authController = require("./controllers/authController");
// const stockRoutes = require('./routes/stockRoutes');
// const orderRoutes = require('./routes/orderRoutes');

const app = express();
const PORT = 5001;
app.use(express.json()); // JSON 데이터를 읽을 수 있도록 설정

// CORS 설정(React(origin)와와 서버 간 통신 허용)
// app.use(cors({
//   origin: 'http://localhost:5173', // 허용할 클라이언트 주소
//   methods: ['GET', 'POST', 'PUT', 'DELETE'], // 허용할 HTTP 메서드
//   credentials: true, // 쿠키, 인증 정보 허용
// }));

// 라우트 설정
app.post("/api/login", authController.login);

// 서버 및 소켓 초기화
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  initializeSockets(); // 소켓 초기화 및 연결
});
