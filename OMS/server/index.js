// Express 서버 초기화

require('dotenv').config() // 환경 변수 설정
const express = require('express'); // express 서버 생성
const http = require('http'); //WebSocket을 사용하기 위해 http 서버 필요
// const cors = require('cors');

const { initializeMciSockets,  } = require("./services/mciService");
const { initializeFepSockets,  } = require("./services/fepService");
const authController = require("./controllers/authController");
const orderController = require("./controllers/orderController");
const historyController = require("./controllers/historyController");

const app = express();
const server = http.createServer(app); // Express 서버를 http서버로 래핑
const PORT = 5000;
app.use(express.json()); // JSON 데이터를 읽을 수 있도록 설정

// CORS 설정(React(origin)와와 서버 간 통신 허용)
// app.use(cors({
//   origin: 'http://localhost:5173', // 허용할 클라이언트 주소
//   methods: ['GET', 'POST', 'PUT', 'DELETE'], // 허용할 HTTP 메서드
//   credentials: true, // 쿠키, 인증 정보 허용
// }));

// 라우트 설정
app.post("/api/login", authController.login);
app.post("/api/order", orderController.placeOrder);
app.post("/api/history", historyController.getHistory);

// 서버 및 소켓 초기화
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  initializeMciSockets(server);
  initializeFepSockets(server);
});
