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
    user_id: buffer.toString('utf-8', 8, 60).replace(/\0/g, "").trim(), //4배수 단위로 할당 -> 52bytes
    status_code: buffer.readInt32LE(60),
  };
}


// MCI -> OMS : 종목 시세 응답 전문 파싱
function parseMarketPrices(buffer) {

  const marketData = [];
  let offset = 8; // 헤더(8바이트) 이후 데이터 시작

  for (let i = 0; i < 4; i++) {

    let stock = {}; // 종목 데이터를 담을 객체 생성

    // 종목 코드 (7바이트) + 패딩 (1바이트)
    stock.stock_code = buffer.toString("utf-8", offset, offset + 7).replace(/\0/g, "").trim();
    offset += 7;
    offset += 1;

    // 종목명 (51바이트) + 패딩 (1바이트)
    stock.stock_name = buffer.toString("utf-8", offset, offset + 51).replace(/\0/g, "").trim();
    offset += 51;
    offset += 1;

    // 가격 (int, 4바이트)
    stock.price = buffer.readInt32LE(offset);
    offset += 4;

    // 거래량 (long, 8바이트)
    stock.volume = buffer.readBigInt64LE(offset).toString(); // BigInt → 문자열 변환
    offset += 8;

    // 대비 (int, 4바이트)
    stock.change = buffer.readInt32LE(offset);
    offset += 4;

    // 등락률 (11바이트) + 패딩 (1바이트)
    stock.rate_of_change = buffer.toString("utf-8", offset, offset + 11).replace(/\0/g, "").trim();
    offset += 11;
    offset += 1; // 패딩

    // 호가 정보 (12바이트 * 2개 = 24바이트)
    stock.hoga = [
      {
        trading_type: buffer.readInt32LE(offset),
        price: buffer.readInt32LE(offset + 4),
        balance: buffer.readInt32LE(offset + 8),
      },
      {
        trading_type: buffer.readInt32LE(offset + 12),
        price: buffer.readInt32LE(offset + 16),
        balance: buffer.readInt32LE(offset + 20),
      },
    ];
    offset += 24;

    // 고가 (int, 4바이트)
    stock.high_price = buffer.readInt32LE(offset);
    offset += 4;

    // 저가 (int, 4바이트)
    stock.low_price = buffer.readInt32LE(offset);
    offset += 4;

    // 시세 형성 시간 (19바이트) + 패딩 (1바이트)
    stock.market_time = buffer.toString("utf-8", offset, offset + 15).replace(/\0/g, "").trim();
    offset += 15;
    offset += 1;

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
  buffer.writeInt32LE(order.hogaPrice, offset); offset += 4;
  buffer.write(order.original_order, offset, 7, "utf-8"); offset += 1;

  return buffer;
}


// FEP -> OMS : 주문 응답 전문 파싱
function parseOrderResponse(buffer) {
  let offset = 8; // tr_id, length 8bytes 차지

  const transaction_code = buffer.toString("utf-8", offset, offset + 7).replace(/\0/g, "").trim();
  offset += 7;
  offset += 1;
  const user_id = buffer.toString("utf-8", offset, offset + 21).replace(/\0/g, "").replace(/[^\x20-\x7E]/g, "").trim();
  offset += 21;
  offset += 3;
  const time = buffer.toString("utf-8", offset, offset + 15).replace(/\0/g, "").trim();
  offset += 15;
  offset += 1;
  const reject_code = buffer.toString("utf-8", offset, offset + 7).replace(/\0/g, "").replace(/[^\x20-\x7E]/g, "").trim();

  return { transaction_code, user_id, time, reject_code };
}


// OMS -> MCI : 거래 내역 요청
function createHistoryBuffer(user_id) {
  console.log('created history buffer')
  const buffer = Buffer.alloc(58);

  buffer.writeInt32LE(12, 0); // tr_id : 12
  buffer.writeInt32LE(buffer.length, 4); // 전문 길이

  let offset = 8;
  buffer.write(user_id, offset, 50, "utf-8");

  return buffer;
}


// MCI -> OMS : 거래 내역 응답 파싱
function parseHistoryResponse(buffer) {
  const transactions = [];
  let offset = 8; // 헤더(8바이트) 이후 데이터 시작
  const transactionSize = 156; // 거래 데이터 하나의 크기
  const maxTransactions = Math.min(50, Math.floor((buffer.length - 8) / transactionSize)); // 실제 가능한 개수 계산

  for (let i = 0; i < maxTransactions; i++) {
    // 거래 갯수만큼 읽고 중단
    if (offset + transactionSize > buffer.length) {
      console.warn(`경고: 데이터 범위를 초과하여 중단 (offset: ${offset}, buffer length: ${buffer.length})`);
      break;
    }

    let tx = {}; // 거래 내역을 담을 객체 생성

    // 종목 코드 (7바이트) + 패딩 (1바이트)
    tx.stock_code = buffer.toString("utf-8", offset, offset + 7).replace(/\0/g, "").trim();
    offset += 7 + 1;
    // 종목명 (51바이트) + 패딩 (1바이트)
    tx.stock_name = buffer.toString("utf-8", offset, offset + 51).replace(/\0/g, "").trim();
    offset += 51 + 1;
    // 거래 유형 코드 (7바이트) + 패딩 (1바이트)
    tx.tx_code = buffer.toString("utf-8", offset, offset + 7).replace(/\0/g, "").trim();
    offset += 7 + 1;
    // 사용자 ID (51바이트) + 패딩 (1바이트)
    tx.user_id = buffer.toString("utf-8", offset, offset + 51).replace(/\0/g, "").trim();
    offset += 51 + 1;
    // 주문 타입 (1바이트) + 패딩 (3바이트)
    tx.order_type = buffer.toString("utf-8", offset, offset + 1).replace(/\0/g, "").trim();
    offset += 1 + 3;
    // 수량 (int, 4바이트)
    tx.quantity = buffer.readInt32LE(offset);
    offset += 4;
    // 거래 시간 (15바이트) + 패딩 (1바이트)
    tx.datetime = buffer.toString("utf-8", offset, offset + 15).replace(/\0/g, "").trim();
    offset += 15 + 1;
    // 가격 (int, 4바이트)
    tx.price = buffer.readInt32LE(offset);
    offset += 4;
    // 체결 여부 (1바이트) + 패딩 (3바이트)
    tx.status = buffer.toString("utf-8", offset, offset + 1).replace(/\0/g, "").trim();
    offset += 1 + 3;
    // 거부 사유 코드 (5바이트) + 패딩 (3바이트)
    tx.reject_code = buffer.toString("utf-8", offset, offset + 5).replace(/\0/g, "").trim();
    offset += 5 + 3;

    transactions.push(tx);
  }

  return { transactions };
}




module.exports = {
  createLoginBuffer,
  parseLoginResponse,
  parseMarketPrices,
  createOrderBuffer,
  parseOrderResponse,
  createHistoryBuffer,
  parseHistoryResponse
};