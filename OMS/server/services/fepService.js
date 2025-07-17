const net = require("net"); //MCI 서버와 TCP 소켓 통신
const {
  createOrderBuffer,
  parseOrderResponse,
} = require("../utils/protocolService");

let fepSocket;
const pendingOrders = new Map(); // 주문 요청-응답 매칭을 위한 Map

// FEP 서버와 TCP 연결(주문)
function initializeFepSockets(server) {
  // 1. FEP 주소 및 포트
  const fepHost = "127.0.0.1";
  const fepPort = 8081;

  // 2. FEP 서버 소켓 초기화 및 연결
  fepSocket = new net.Socket();
  fepSocket.connect(fepPort, fepHost, () => {
    console.log(`Connected to FEP server at ${fepHost}:${fepPort}`);
  });

  // 3. FEP 서버로부터 데이터 수신
  fepSocket.on("data", (data) => {
    const tr_id = data.readInt32LE(0); // tr_id 추출
    console.log(`Received data from FEP with tr_id: ${tr_id}`);
    if (tr_id === 10) {
      handleOrderResponse(data);
    } else if (tr_id === 0) {
      console.log("FEP와 KRX 연결 끊김");
    } else {
      console.warn(`Unexpected tr_id: ${tr_id}`);
    }
  });

  // 4. 에러 처리
  fepSocket.on("error", (err) => {
    console.error("FEP socket error:", err.message);
  });

  // 5. 재연결
  // fepSocket.on('close', () => {
  //   console.warn('FEP socket closed. Reconnecting in 3 seconds...');
  //   setTimeout(connectFepSocket, 3000); // 3초 후 재연결 시도
  // });
}

// 주문 요청 처리
function sendOrderRequest(orderData) {
  console.log("sendOrderRequest 보냄", orderData);
  tr_code = orderData.transaction_code;
  return new Promise((resolve, reject) => {
    // 주문 요청 전문 생성
    const buffer = createOrderBuffer(orderData);

    pendingOrders.set(tr_code, (response) => {
      // reject_code에 따른 예외처리
      const reject_code = response.reject_code;

      if (response && response.reject_code === "0000") {
        resolve({ success: true, message: "주문 요청에 성공했습니다." });
      } else if (response && response.reject_code === "E101") {
        resolve({
          success: false,
          message: `주문 요청에 실패했습니다.(${reject_code}: 중복된 거래코드)`,
        });
      } else if (response && response.reject_code === "E102") {
        resolve({
          success: false,
          message: `주문 요청에 실패했습니다.(${reject_code}: 유효하지 않는 주문 가격)`,
        });
      } else if (response && response.reject_code === "E103") {
        resolve({
          success: false,
          message: `주문 요청에 실패했습니다.(${reject_code}: 유효하지 않은 주문 수량)`,
        });
      } else if (response && response.reject_code === "E003") {
        resolve({
          success: false,
          message: `주문 요청에 실패했습니다.(${reject_code}: 상한가/하한가 오류)`,
        });
      } else if (response && response.reject_code?.startsWith("E")) {
        resolve({
          success: false,
          message: `${reject_code}: 주문 요청에 실패했습니다.(기타 사유)`,
        });
      } else {
        reject(new Error("주문 요청에 실패했습니다.(No Response)"));
      }
    });
    fepSocket.write(buffer); // FEP 서버로 주문 요청 전송
    console.log("fep소켓으로 주문 요청 갔음");
  });
}

// 주문 응답 처리
function handleOrderResponse(data) {
  const response = parseOrderResponse(data);
  console.log("response", response);
  const tr_code = response.transaction_code;

  console.log("pendingOrders:", pendingOrders);
  if (pendingOrders.has(tr_code)) {
    const callback = pendingOrders.get(tr_code);
    callback(response); // 응답 처리
    pendingOrders.delete(tr_code);
  } else {
    console.warn("No matching order found for this response.");
  }
}

module.exports = {
  initializeFepSockets,
  sendOrderRequest,
};
