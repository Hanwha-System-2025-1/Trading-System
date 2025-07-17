
const net = require("net");
const PORT = 5001; // MOCKING 서버 포트


// 로그인 응답 전문 생성 함수
const createLoginResponse = (tr_id, user_id, status_code) => {
  // 고정된 크기의 버퍼 생성 (총 64바이트)
  const buffer = Buffer.alloc(64);
  // tr_id (4바이트, Little Endian)
  buffer.writeInt32LE(tr_id, 0);
  // length (4바이트, 전체 길이) - 현재 버퍼 전체 길이 64바이트
  buffer.writeInt32LE(64, 4);
  // user_id (52바이트, UTF-8 문자열) - 4의 배수로 맞춰야 함
  buffer.write(user_id, 8, 52, 'utf-8');
  // status_code (4바이트, Little Endian)
  buffer.writeInt32LE(status_code, 60);

  return buffer;
};


// ✅ 기본 종목 데이터 (초기 값)
let marketData = [
  { stock_code: "000001", stock_name: "삼성전자", price: 75000, volume: 123456789n, change: 0, rate_of_change: "0.00%" },
  { stock_code: "000002", stock_name: "SK하이닉스", price: 120000, volume: 234567890n, change: 0, rate_of_change: "0.00%" },
  { stock_code: "000003", stock_name: "NAVER", price: 350000, volume: 987654321n, change: 0, rate_of_change: "0.00%" },
  { stock_code: "000004", stock_name: "현대차", price: 200000, volume: 543210987n, change: 0, rate_of_change: "0.00%" }
];

// ✅ 가격 변동 함수 (10초마다 실행)
function updateMarketPrices() {
  marketData.forEach(stock => {
    const priceChange = Math.floor((Math.random() - 0.5) * 1000); // -500 ~ +500 원 변동
    stock.change = priceChange;
    stock.price += priceChange;
    stock.volume += BigInt(Math.floor(Math.random() * 10000)); // 거래량 증가
    stock.rate_of_change = ((priceChange / stock.price) * 100).toFixed(2) + "%";
  });
}

// ✅ OMS 파싱 코드에 맞춘 데이터 패킷 생성 (버퍼 크기 조정)
function createMarketDataPacket() {
  const HEADER_SIZE = 8; // 헤더 크기 (tr_id 4바이트 + length 4바이트)
  const STOCK_SIZE = 144; // 종목 1개당 데이터 크기
  const TOTAL_SIZE = HEADER_SIZE + STOCK_SIZE * marketData.length; // 전체 패킷 크기

  const buffer = Buffer.alloc(TOTAL_SIZE);

  // ✅ 헤더 설정 (tr_id = 6, length = TOTAL_SIZE)
  buffer.writeInt32LE(6, 0); // tr_id (4바이트)
  buffer.writeInt32LE(TOTAL_SIZE, 4); // length (4바이트)

  let offset = HEADER_SIZE;

  marketData.forEach(stock => {
    buffer.write(stock.stock_code.padEnd(7, "\0"), offset); // 종목 코드 (7바이트)
    offset += 7;
    buffer.write("\0", offset++); // 패딩 (1바이트)

    buffer.write(stock.stock_name.padEnd(51, "\0"), offset); // 종목명 (51바이트)
    offset += 51;
    buffer.write("\0", offset++); // 패딩 (1바이트)

    buffer.writeInt32LE(stock.price, offset); // 가격 (4바이트)
    offset += 4;

    buffer.writeBigInt64LE(stock.volume, offset); // 거래량 (8바이트)
    offset += 8;

    buffer.writeInt32LE(stock.change, offset); // 대비 (4바이트)
    offset += 4;

    buffer.write(stock.rate_of_change.padEnd(11, "\0"), offset); // 등락률 (11바이트)
    offset += 11;
    buffer.write("\0", offset++); // 패딩 (1바이트)

    // ✅ 호가 정보 (12바이트 * 2개 = 24바이트)
    buffer.writeInt32LE(1, offset); // 호가 1 (trading_type)
    buffer.writeInt32LE(stock.price, offset + 4); // 호가 1 가격
    buffer.writeInt32LE(100, offset + 8); // 호가 1 잔량
    offset += 12;

    buffer.writeInt32LE(2, offset); // 호가 2 (trading_type)
    buffer.writeInt32LE(stock.price - 50, offset + 4); // 호가 2 가격
    buffer.writeInt32LE(200, offset + 8); // 호가 2 잔량
    offset += 12;

    buffer.writeInt32LE(stock.price + 500, offset); // 고가 (4바이트)
    offset += 4;

    buffer.writeInt32LE(stock.price - 500, offset); // 저가 (4바이트)
    offset += 4;

    const marketTime = new Date().toISOString().replace(/\D/g, "").slice(0, 15); // YYYYMMDDHHMMSS (15자리)
    buffer.write(marketTime.padEnd(19, "\0"), offset); // 시세 형성 시간 (19바이트)
    offset += 15;
    buffer.write("\0", offset++); // 패딩 (1바이트)
  });

  return buffer;
}

// ✅ TCP MOCKING 서버 실행
const server = net.createServer((socket) => {
  console.log("🚀 MCI_MOCKING_SERVER: 클라이언트 연결됨");

  // 10초마다 시세 데이터 전송
  const interval = setInterval(() => {
    updateMarketPrices();
    const marketDataPacket = createMarketDataPacket();
    socket.write(marketDataPacket);
    console.log("📤 종목 시세 데이터 전송!");
  }, 10000);

  socket.on("data", (data) => {
    const tr_id = data.readInt32BE(0);
    // 로그인 요청인 경우
    if (tr_id === 1) {
      const longinResponseBuffer = createLoginResponse(1, 'jina', 200)
      socket.write(longinResponseBuffer);
    }
  })

  socket.on("end", () => {
    console.log("🔌 클라이언트 연결 종료");
    clearInterval(interval);
  });

  socket.on("error", (err) => {
    console.error("❌ 서버 오류 발생:", err.message);
  });
});

// TCP 서버 실행
server.listen(PORT, () => {
  console.log(`✅ MCI MOCKING SERVER 실행 중 (포트 ${PORT})`);
});
