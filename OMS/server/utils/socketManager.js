const net = require('net');

let mciSocket, fepSocket;
const pendingResponseQueue = []; // 로그인 요청-응답 매칭을 위한 큐


// MCI, FEP 소켓 연결 관리
function initializeSockets() {
  const mciHost = '127.0.0.1';
  const mciPort = 8080;

  const fepHost = '127.0.0.1';
  const fepPort = 8081;


  // MCI 서버 소켓 초기화 및 연결
  mciSocket = new net.Socket();
  mciSocket.connect(mciPort, mciHost, () => {
    console.log(`Connected to MCI server at ${mciHost}:${mciPort}`);
  });

  // MCI 서버에서 데이터 수신
  mciSocket.on("data", (data) => {
    const tr_id = data.readInt32LE(0); // tr_id 추출
    console.log(`Received data from MCI with tr_id: ${tr_id}`);

    if (tr_id === 4) {
      handleLoginResponse(data);  // 로그인 응답 처리
    } else if (tr_id === 6) {
      handleMarketData(data);  // 시세 데이터 처리
    } else {
      console.warn(`Unexpected tr_id: ${tr_id}`);
    }
  });
  
  // 에러 처리
  mciSocket.on('error', (err) => {
    console.error('MCI socket error:', err.message);
  });

  // 재연결
  // mciSocket.on('close', () => {
  //   console.warn('MCI socket closed. Reconnecting in 3 seconds...');
  //   setTimeout(connectMciSocket, 3000); // 3초 후 재연결 시도
  // });


  // FEP 서버 소켓 초기화 및 연결
  fepSocket = new net.Socket();
  fepSocket.connect(fepPort, fepHost, () => {
    console.log(`Connected to FEP server at ${fepHost}:${fepPort}`);
  });
  // FEP 서버에서 데이터 수신
  fepSocket.on("data", (data) => {
    const tr_id = data.readInt32LE(0); // tr_id 추출
    console.log(`Received data from FEP with tr_id: ${tr_id}`);
    if (tr_id === 10) {
      handleOrderData(data);
    } else {
      console.warn(`Unexpected tr_id: ${tr_id}`);
    }
  });
  // 에러 처리
  fepSocket.on('error', (err) => {
    console.error('FEP socket error:', err.message);
  });
  // 재연결
  // fepSocket.on('close', () => {
  //   console.warn('FEP socket closed. Reconnecting in 3 seconds...');
  //   setTimeout(connectFepSocket, 3000); // 3초 후 재연결 시도
  // });
}


function sendRequest(buffer, callback) {
  // 요청 큐에 추가
  pendingResponseQueue.push(callback);
  mciSocket.write(buffer); // MCI 서버로 로그인 요청 전송
}


function handleLoginResponse(data) {
  if (pendingResponseQueue.length > 0) {
    const callback = pendingResponseQueue.shift(); // 큐의 맨 앞 콜백 가져오기
    callback(data); // 응답 처리
  } else {
    console.warn("No pending login request for this response.");
  }
}


function handleMarketData(data) {
  console.log("Market data received:", data);
}


function handleOrderData(data) {
  console.log("Order data received:", data);
}


module.exports = {
  initializeSockets,
  sendRequest
};
