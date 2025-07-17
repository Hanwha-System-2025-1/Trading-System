// OMS -> MCI : 로그인 요청 전문 생성
function createLoginBuffer(user_id, user_pw) {
  const HDR_SIZE = 8; // 헤더 크기: tr_id(4 bytes) + length(4 bytes)
  const USER_ID_SIZE = 50; // user_id 크기
  const USER_PW_SIZE = 50; // user_pw 크기
  const TOTAL_SIZE = HDR_SIZE + USER_ID_SIZE + USER_PW_SIZE; // 전체 크기

  // 1. 버퍼 생성
  const buffer = Buffer.alloc(TOTAL_SIZE);

  // 2. 헤더 설정
  const tr_id = 1; // 로그인 트랜잭션 ID
  const length = TOTAL_SIZE; // 전체 전문 길이
  // 트랜잭션 ID (4바이트, Little Endian)
  buffer.writeInt32LE(tr_id, 0); // 0번째 위치에 4바이트로 기록
  // 전문 길이 (4바이트, Little Endian)
  buffer.writeInt32LE(length, 4); // 4번째 위치에 4바이트로 기록


  // 3. user_id 설정 (50바이트 고정)
  const userIdBuffer = Buffer.from(user_id, "utf-8");
  userIdBuffer.copy(
    buffer, 
    HDR_SIZE, 
    0, 
    Math.min(userIdBuffer.length, USER_ID_SIZE)
  );

  // 4. user_pw 설정 (50바이트 고정)
  const userPwBuffer = Buffer.from(user_pw, "utf-8");
  userPwBuffer.copy(
    buffer,
    HDR_SIZE + USER_ID_SIZE,
    0,
    Math.min(userPwBuffer.length, USER_PW_SIZE)
  );
  
  console.log('create buffer')
  return buffer;
}


// MCI -> OMS : 로그인 Response 전문 파싱
function parseLoginResponse(buffer) {
  return {
    tr_id: buffer.readInt32LE(0),
    length: buffer.readInt32LE(4),
    user_id: buffer.toString('utf-8', 8, 58),
    status_code: buffer.readInt32LE(58),
  };
}


// MCI -> OMS : 종목 시세 Response 전문 파싱
function parseStockResponse(buffer) {
  return {
    tr_id: buffer.readInt32LE(0),
    length: buffer.readInt32LE(4),
    status_code: buffer.readInt32LE(8),
  };
}
  
module.exports = { createLoginBuffer, parseLoginResponse, parseStockResponse };