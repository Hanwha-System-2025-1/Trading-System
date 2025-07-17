const { sendRequest } = require("../utils/socketManager");
const { createLoginBuffer, parseLoginResponse } = require('../utils/protocolService');

let stockSubscribers = []; // 주식 정보를 받을 클라이언트 목록


// 로그인 요청 전송
function sendLoginRequest(username, password) {
  return new Promise((resolve, reject) => {
    // 로그인 요청 전문 생성
    const buffer = createLoginBuffer(username, password);

    // sendRequest : callback함수를 pendingResponseQueue에 추가하고 mci로 요청 전송함
    sendRequest(buffer, (response) => {
      const result = parseLoginResponse(response);

      if (result.status_code === 0) {
        resolve({ success: true, message: "로그인에 성공했습니다." });
      } else if (result.status_code === 1||2) {
        resolve({ success: false, message: "잘못된 아이디나 비밀번호입니다." });
      } else {
        reject(new Error("잘못된 로그인 응답 코드를 받았습니다."));
      }
    });
  });
};


// WebSocket 초기화
function initializeWebSocket(server) {
  const WebSocket = require('ws');
  const wss = new WebSocket.Server({ server }); //웹소켓 서버 인스턴스스

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    stockSubscribers.push(ws); // 클라이언트의 WebSocket 객체를 저장

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      stockSubscribers = stockSubscribers.filter((client) => client !== ws); //연결 끊어진 클라이언트 삭제
    });
  });

  console.log('WebSocket server initialized');
}


// 종목 시세 데이터 브로드캐스트
function broadcastStockData(stockData) {
  stockSubscribers.forEach((ws) => {
    ws.send(JSON.stringify(stockData)); // 주식 정보를 JSON으로 변환하여 전송
  });
}


module.exports = {
  sendLoginRequest,
};