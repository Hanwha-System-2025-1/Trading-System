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
  
  console.log('create login buffer')
  return buffer;
}


// MCI -> OMS : 로그인 응답 전문 파싱
function parseLoginResponse(buffer) {
  return {
    tr_id: buffer.readInt32LE(0),
    length: buffer.readInt32LE(4),
    user_id: buffer.toString('utf-8', 8, 60), //4배수 단위로 할당 -> 52bytes
    status_code: buffer.readInt32LE(60),
  };
}


// MCI -> OMS : 종목 시세 응답 전문 파싱 (수정 필요)
function parseMarketPrices(buffer) {
  const marketData = [];
  let offset = 8; // 헤더(8바이트) 이후 데이터 시작

  for (let i = 0; i < 4; i++) {
    let stock = {}; // 종목 데이터를 담을 객체 생성

    let info = buffer.toString("utf-8");

    console.log(info);

    marketData.push(stock);
  }
  return { marketData };
}




// OMS -> FEP : 주문 요청 전문 생성
function createOrderBuffer(order) {
  console.log('create order buffer')
  const buffer = Buffer.alloc(136); // 전체 버퍼 크기 계산
  
  buffer.writeInt32LE(9, 0); // tr_id : 9(주문 요청)
  buffer.writeInt32LE(buffer.length, 4); // 전문 길이

  let offset = 8;
  buffer.write(order.stock_code, offset, 7, "utf-8"); offset += 7; offset += 1;
  buffer.write(order.stock_name, offset, 51, "utf-8"); offset += 51; offset += 1;
  buffer.write(order.transaction_code, offset, 7, "utf-8"); offset += 7; offset += 1;
  buffer.write(order.user_id, offset, 21, "utf-8"); offset += 21; offset += 3;
  buffer.write(order.order_type, offset, 1, "utf-8"); offset += 1; offset += 3;
  buffer.writeInt32LE(order.quantity, offset); offset += 4;
  buffer.write(order.order_time, offset, 15, "utf-8"); offset += 15; offset += 1;
  buffer.writeInt32LE(order.price, offset); offset += 4;
  buffer.write(order.original_order, offset, 7, "utf-8"); offset += 1;

  return buffer;
}


// FEP -> OMS : 주문 응답 전문 파싱
function parseOrderResponse(buffer) {
  let offset = 8; // tr_id, length 8bytes 차지

  const transaction_code = buffer.toString("utf-8", offset, offset + 6).trim();
  offset += 6;
  const user_id = buffer.toString("utf-8", offset, offset + 20).trim();
  offset += 20;
  const time = buffer.toString("utf-8", offset, offset + 14).trim();
  offset += 14;
  const reject_code = buffer.toString("utf-8", offset, offset + 4).trim();

  return { transaction_code, user_id, time, reject_code };
}


module.exports = {
  createLoginBuffer,
  parseLoginResponse,
  parseMarketPrices,
  createOrderBuffer,
  parseOrderResponse
};