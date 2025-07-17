const net = require("net");

const PORT = 5001; // MOCKING 서버 포트

// 로그인 응답 전문 생성 함수
function createLoginResponse(buffer) {
  // console.log("MCI_MOCKING_SERVER : Parsing login request...");

  // 요청 전문에서 user_id와 user_pw 추출
  const userId = buffer.toString("utf-8", 8, 58).trim(); // user_id 추출
  const userPw = buffer.toString("utf-8", 58, 108).trim(); // user_pw 추출

  // 응답 전문 생성
  const HDR_SIZE = 8; // 헤더 크기
  const USER_ID_SIZE = 50; // user_id 크기
  const STATUS_CODE_SIZE = 4; // status_code 크기
  const TOTAL_SIZE = HDR_SIZE + USER_ID_SIZE + STATUS_CODE_SIZE;

  const responseBuffer = Buffer.alloc(TOTAL_SIZE);

  // 1. Header 설정
  const tr_id = 4;
  const length = TOTAL_SIZE; // 응답 전문 길이
  responseBuffer.writeInt32LE(tr_id, 0); // tr_id 설정
  responseBuffer.writeInt32LE(length, 4); // length 설정

  // 2. Body 설정
  const userIdBuffer = Buffer.from(userId, "utf-8");
  userIdBuffer.copy(responseBuffer, HDR_SIZE, 0, userIdBuffer.length); // user_id 설정

  // status_code 설정 (jina/1234만 성공, 그 외 실패)
  const normalizedUserId = userId.replace(/\0/g, "").trim(); // NULL 문자 제거 후 trim
  const normalizedUserPw = userPw.replace(/\0/g, "").trim();
  const statusCode = normalizedUserPw === "1234" ? 0 : 1;
  // console.log(
  //   `Comparing: userId [${normalizedUserId}] === "jina" && userPw [${normalizedUserPw}] === "1234"`
  // );

  responseBuffer.writeInt32LE(statusCode, HDR_SIZE + USER_ID_SIZE);

  // console.log(
  //   `MCI_MOCKING_SERVER : Response created for user_id: ${userId}, status_code: ${statusCode === 0 ? "SUCCESS" : "FAILURE"}`
  // );
  return responseBuffer;
}

// MOCKING 서버 생성
const server = net.createServer((socket) => {
  // console.log("MCI_MOCKING_SERVER : Client connected.");

  // 클라이언트로부터 요청 수신
  socket.on("data", (data) => {
    // console.log("MCI_MOCKING_SERVER : Received data:", data);

    // 요청 전문 파싱 및 응답 생성
    const tr_id = data.readInt32LE(0); // tr_id 읽기
    if (tr_id === 1) {
      // console.log("MCI_MOCKING_SERVER :  Login request received.");
      const response = createLoginResponse(data); // 로그인 응답 생성
      socket.write(response); // 클라이언트로 응답 전송
    } else {
      // console.log("MCI_MOCKING_SERVER :  Unknown tr_id:", tr_id);
    }
  });

  // 클라이언트 연결 종료
  socket.on("end", () => {
    console.log("MCI_MOCKING_SERVER : Client disconnected.");
  });

  // 에러 처리
  socket.on("error", (err) => {
    console.error("MCI_MOCKING_SERVER : Socket error:", err);
  });
});

// 서버 시작
server.listen(PORT, () => {
  console.log(`MCI MOCKING SERVER is running on port ${PORT}`);
});
