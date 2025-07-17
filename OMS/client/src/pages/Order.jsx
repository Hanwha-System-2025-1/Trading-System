import { useState, useContext, useEffect} from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import api from "../utils/api";
import { io } from "socket.io-client";
import { getStockStyle } from "../utils/getStockStyle";

// import StockChart from "./stockChart/StockChart";
import CustomCircularProgress from "../components/CustomCircularProgress";
import NotFound from "../components/NotFound";
import StockOrderCard from "../components/Order/StockOrderCard";
import Title from "../components/Title";

const socket = io("http://localhost:5000"); //백엔드와 웹소켓 연결 생성

// 주문 요청 API 요청 및 응답
async function sendOrder(orderData) {
  try {
    const response = await api.post("/api/order", orderData)
    const { success, message } = response.data; // 응답 데이터를 구조 분해 할당

    // 주문 검증 후 성공 처리
    if (success) {
      // 주문 성공 시 유저 정보 저장
      console.log("주문 요청 성공:", response.data);
      alert('주문 요청 완료')
      }
  } catch (error) {
    console.error("주문 요청 실패:", error.response.data);
    alert('주문 요청 실패')
  }
}

const now = new Date();

function getCurrentTimestamp(now) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // 1월 = 0이므로 +1 필요
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}


/** 주식 상세정보 화면 */
const Order = ({user, onLogout}) => {

  // 유효하지 않은 sotckId 주문 페이지 접근 제한
  const { stockId } = useParams();
  if (!["000660", "005930", "035420", "272210"].includes(stockId)) return <NotFound />;

  // 종목 정보 데이터
  const location = useLocation(); // navigate로 전달된 state 읽기
  const initialStock = location.state || {}; // 초기 값
  const [stock, setStock] = useState(initialStock);

  const {
    stock_code,
    stock_name,
    price,
    volume,
    change,
    rate_of_change,
    hoga = [],
    high_price,
    low_price,
    market_time,
  } = stock || {};

  const [
    { trading_type: buyTradingType, price: buyHogaPrice, balance: buyHogaBalance } = {},
    { trading_type: sellTradingType, price: sellHogaPrice, balance: sellHogaBalance } = {}
  ] = hoga;

  const formatMarketTime = market_time ? `${market_time.substring(8,10)}:${market_time.substring(10,12)}:${market_time.substring(12,14)}` : "Invalid Time";
  const { textColor, icon } = getStockStyle(change); // 대비와 등락률에 따른 스타일 변환
  

  
  // 실시간 종목 정보 업데이트
  useEffect(() => {
    const socket = io("http://localhost:5000");

    socket.on("marketData", (data) => {
      const updatedStock = data.marketData.find(s => s.stock_code === stockId);
      console.log('updatedStock', updatedStock);
      if (updatedStock) {
        setStock(updatedStock);
      }
    });

    return () => {
      socket.off("marketData");
      socket.disconnect();
    };
  }, []);


  // 거래 내역 데이터
  const [history, setHistory] = useState([]);
  
  // 거래 내역 요청 API 호출 및 응답 처리
  const handleHistory = async (e, user) => {
    e.preventDefault(); // 기본 폼 동작 방지
    try {
      // 서버로 로그인 요청
      const response = await api.post("/api/history", {
        user
      });

      console.log("거래내역응답:", response.data)
  
      // 조회 후 성공 처리
      if (response.data.success) {
        const historyData = response.data.response.transactions;
        console.log("조회 성공:", historyData);
        setHistory(historyData);
      } else {
        // 조회 후 실패 처리
        console.log("조회 실패:", response.data.message || "조회에 실패했습니다.");
      }
    } catch (error) {
      // 조회 실패 처리(MCI로부터 응답을 못 받은 경우 등)
      console.error("조회 에러:", error.response?.data.message || error.message);
    }
  };

  
  // 매도 및 매수 수량, 가격 데이터
  const [activeTab, setActiveTab] = useState("sell");
  const [sellQuantity, setSellQuantity] = useState(0);
  const [buyQuantity, setBuyQuantity] = useState(0);
  const [sellPrice, setSellPrice] = useState(sellHogaPrice);
  const [buyPrice, setBuyPrice] = useState(buyHogaPrice);

  // 매도 매수 호가 변할 때마다, 값 변경
  useEffect(()=>{
    setSellPrice(sellHogaPrice); // sellHogaPrice가 변경될 때마다 sellPrice 업데이트
  },[sellHogaPrice])

  useEffect(()=>{
    setBuyPrice(buyHogaPrice); // sellHogaPrice가 변경될 때마다 sellPrice 업데이트
  },[buyHogaPrice])

  // 주문창에 전달할 데이터
  const orderTypes = {
    sell: {
      labels: {
        title: "매도 주문",
        buttonText: "매도 (Enter)",
        buttonColor: "bg-blue-500 hover:bg-blue-600",
        titleColor: "text-blue-500",
        quantityLabel: "매도 수량",
        priceLabel: "매도 단가",
        totalLabel: "총 매도 금액",
        cancelButton: "매도 취소",
      },
      defaultValues: {
        quantity: sellQuantity,
        price: sellPrice,
      },
    },
    buy: {
      labels: {
        title: "매수 주문",
        buttonText: "매수 (Enter)",
        buttonColor: "bg-red-500 hover:bg-red-600",
        titleColor: "text-red-500",
        quantityLabel: "매수 수량",
        priceLabel: "매수 단가",
        totalLabel: "총 매수 금액",
        cancelButton: "매수 취소",
      },
      defaultValues: {
        quantity: buyQuantity,
        price: buyPrice,
      },
    },

    // modify: {
    //   labels: {
    //     title: "정정 주문",
    //     buttonText: "정정 (Enter)",
    //     buttonColor: "bg-yellow-500 hover:bg-yellow-600",
    //     titleColor: "text-yellow-500",
    //     quantityLabel: "정정 수량",
    //     priceLabel: "정정 단가",
    //     totalLabel: "총 정정 금액",
    //     cancelButton: "정정 취소",
    //   },
    //   defaultValues: {
    //     quantity: 5, // 정정은 잘 모르겠네여..
    //     price: 88000,
    //   },
    // },
  };

  
  const handleCancel = () => {
    console.log("주문이 취소되었습니다.");
  };

  // 주문 transaction_code 생성
  let lastTransactionCode = Math.floor(Math.random() * 999999) + 1; // 마지막 사용된 transaction_code
  function generateTransactionCode() {
    lastTransactionCode += 1; // 이전 값에서 1 증가
    return String(lastTransactionCode).padStart(6, "0"); // 6자리 유지 (앞에 0 채우기)
  }

  // 주문 
  const handleSubmit = (
    e,
    quantity,
    stock_code,
    stock_name,
    hogaPrice,
    ) => {
    e.preventDefault();
 
    const transaction_code = generateTransactionCode();
    const order_type = (activeTab === 'buy' ? "B" : "S");
    const user_id = user || 'jina';
    const order_time = getCurrentTimestamp(now);

    sendOrder({
      stock_code,
      stock_name,
      transaction_code,
      user_id,
      order_type,
      quantity,
      order_time,
      hogaPrice,
      original_order: "000000"
    });
  };


  return (
    <div className="w-full h-full p-8 min-h-0">
      <div className="w-full h-[100%] bg-white shadow-lg rounded-md p-4">
        <Title onLogout={onLogout} title="주문 페이지"/>

        <div className="h-full grid grid-cols-12 gap-6 p-6">
          {/* 좌측 주문 정보 */}
          <div className="col-span-7 bg-white rounded-lg p-6">
            <div>
              {/* 검색 필드 */}
              <div className="mb-4 flex items-center gap-4">
                {/* 종목명 */}
                <p className="text-gray-700 font-semibold flex-grow text-left truncate">
                  {stock_name}
                </p>
                {/* 입력창 */}
                <input
                  type="text"
                  className="border rounded-lg px-3 py-2 w-2/5 text-gray-700 text-right"
                  placeholder={`${stockId} (종목 코드)`}
                />
                {/* 버튼 */}
                <button className="bg-white border border-gray-400 text-gray-800 rounded-lg px-6 py-2 font-medium shadow-md 
                  hover:bg-gray-50 focus:outline-none :shadow-lg active:bg-gray-100 active:scale-95 transition-all duration-200 ease-in-out">
                  검색
                </button>
              </div>

              {/* 테이블 */}
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-700 text-sm">
                    <th className="p-4">현재가</th>
                    <th className="p-4">전일대비</th>
                    <th className="p-4">등락률</th>
                    {/* <th className="p-4">전일거래량</th> */}
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-gray-700 text-sm">
                    <td className="p-4 text-gray-700 font-semibold">{price?.toLocaleString()}</td>
                    <td className={`p-4 ${textColor} font-semibold`}>{icon} {change}</td>
                    <td className={`p-4 ${textColor} font-semibold`}>{rate_of_change}</td>
                    {/* <td className="p-4">???</td> */}
                  </tr>
                </tbody>
              </table>

              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-700 text-sm">
                    <th className="p-4">최고가</th>
                    <th className="p-4">최저가</th>
                    <th className="p-4">거래량</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-gray-700 text-sm">
                    <td className="p-4 text-gray-700 font-semibold">{high_price?.toLocaleString()}</td>
                    <td className="p-4 text-gray-700 font-semibold">{low_price?.toLocaleString()}</td>
                    <td className="p-4">{Number(volume)?.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
              
              <div className="mt-4 mb-4 text-left text-gray-700 font-semibold">1호가</div>
              
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-700 text-sm">
                    {/* <th className="p-4">최고가</th> */}
                    <th className="p-4">매도잔량</th>
                    <th className="p-4">{formatMarketTime}</th>
                    <th className="p-4">매수잔량</th>
                    {/* <th className="p-4">최저가</th> */}
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-gray-700 text-sm">
                    {/* <td className="p-4 bg-blue-100">{high_price}</td> */}
                    <td className="p-4 bg-blue-100">{sellHogaBalance}</td>
                    <td className="p-4 bg-blue-100">{sellHogaPrice?.toLocaleString()}</td>
                    <td className="p-4"></td>
                    {/* <td className="p-4"></td> */}
                  </tr>
                  <tr className="text-gray-700 text-sm">
                    {/* <td className="p-4"></td> */}
                    <td className="p-4"></td>
                    <td className="p-4 bg-red-100">{buyHogaPrice?.toLocaleString()}</td>
                    <td className="p-4 bg-red-100">{buyHogaBalance}</td>
                    {/* <td className="p-4 bg-red-100">{low_price}</td> */}
                  </tr>
                  <tr className="text-gray-700 text-sm">
                    {/* <td className="p-4 bg-blue-100">{high_price}</td> */}
                    <td className="p-4 "></td>
                    {/* <td className="p-4 bg-gray-100">최저가 {low_price?.toLocaleString()}</td> */}
                    <td className="p-4"></td>
                    {/* <td className="p-4"></td> */}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>


          {/* 우측 주문 폼 */}
          <div className="col-span-5 bg-gray-50 shadow-lg rounded-lg p-6 flex flex-col">
            {/* 탭 메뉴 */}
            <div className="col-span-12">
              <div className="flex justify-center border-b border-gray-300 mb-6">
                {Object.keys(orderTypes).map((type) => {
                  // 현재 활성화된 탭의 색상을 결정
                  const isActive = activeTab === type;
                  const tabColor =
                    type === "sell"
                      ? "text-blue-500"
                      : "text-red-500";

                  return (
                    <button
                      key={type}
                      className={`py-3 text-lg font-medium focus:ring-0 focus:outline-none hover:border-transparent ${
                        isActive ? `${tabColor} border-b-4` : "text-gray-400"
                      }`}
                      onClick={() => setActiveTab(type)}
                    >
                      {orderTypes[type].labels.title}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 탭별 콘텐츠 */}
            <div className="col-span-12 bg-gray-50 rounded-lg p-6">
              <StockOrderCard
                type={activeTab}
                labels={orderTypes[activeTab].labels}
                defaultValues={orderTypes[activeTab].defaultValues}
                quantity={activeTab === "sell" ? sellQuantity : buyQuantity} // 상태 전달
                setQuantity={
                  activeTab === "sell" ? setSellQuantity : setBuyQuantity
                } // 상태 업데이트 함수 전달
                onCancel={handleCancel}
                onSubmit={(e) => {
                  handleSubmit(
                    e,
                    activeTab === "sell" ? sellQuantity : buyQuantity,
                    stock_code,
                    stock_name,
                    activeTab === "sell" ? sellPrice : buyPrice,
                  );
                }}
              />
            </div>
          </div>


          {/* 주문체결 조회 섹션 */}
          <div className="col-span-12 bg-white rounded-lg p-6 mt-6">
            {/* 탭 메뉴 */}
            <div className="flex items-center justify-between border-b border-gray-300 mb-4">
              <div className="text-gray-700 font-medium px-6 py-3 focus:ring-0 focus:outline-none hover:border-transparent">
                거래 내역
              </div>
              <button type="submit" onClick={(e) => handleHistory(e, user)} className="bg-white border border-gray-400 text-gray-800 rounded-lg px-6 py-2 font-medium shadow-md 
                hover:bg-gray-50 hover:border-transparent :shadow-lg active:bg-gray-100 active:scale-95 transition-all duration-200 ease-in-out">
                조회
              </button>
            </div>

            {/* 계좌 및 조회 */}
            {/* <div className="flex items-center justify-end mb-4">
              <div className="flex items-center gap-4">
                <select
                  className="border rounded-lg p-2 w-64 text-gray-700"
                  defaultValue="계좌번호 선택"
                >
                  <option value="계좌번호 선택" disabled>
                    계좌번호 선택
                  </option>
                  <option value="계좌1">501-123456-45 연금저축</option>
                </select>
              </div>
            </div> */}

            {/* 테이블 */}
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-sm">
                  <th className="p-4">주문번호</th>
                  <th className="p-4">종목명</th>
                  <th className="p-4">주문수량</th>
                  <th className="p-4">주문구분</th>
                  <th className="p-4">체결가격</th>
                  <th className="p-4">주문상태</th>
                  <th className="p-4">거부사유</th>
                  {/* <th className="p-4">체결시간</th> */}
                </tr>
              </thead>
              <tbody>
                {history.length > 0 ? (
                  history
                  .filter((order) => order.tx_code) // tx_code가 존재하는 항목(거래내역)만 필터링
                  .map((order, index) => (
                    <tr key={index} className="text-gray-700 text-sm border-b">
                      <td className="p-4">{order.tx_code || "-"}</td> {/* 주문번호 */}
                      <td className="p-4">{order.stock_name || "-"}</td> {/* 종목명 */}
                      <td className="p-4">{order.quantity?.toLocaleString() || "0"}</td> {/* 주문수량 */}
                      <td className="p-4">{order.order_type === "B" ? "매수" : "매도"}</td> {/* 주문구분 */}
                      <td className="p-4">{order.price?.toLocaleString() || "-"}</td> {/* 체결가격 */}
                      <td className="p-4">
                        {(() => {
                          switch (order?.status) {
                            case "W":
                              return "미체결";
                            case "D":
                              return "체결";
                            case "C":
                              return "취소";
                            case "R":
                              return "거부";
                            default:
                              return "-";
                          }
                        })()}
                      </td>{/* 주문상태 */}
                      <td className="p-4">
                        {(() => {
                          switch (order?.reject_code) {
                            case "E203":
                              return "가격 오류";
                            case "E204":
                              return "매도 수량 부족";
                            case "E205":
                              return "매수 수량 부족";
                            case "E206":
                              return "종목 오류";
                            default:
                              return "-";
                          }
                        })()}
                        </td> {/* 거부사유 */}

                      {/* <td className="p-4">{order.reject_code || "-"}</td> 거부사유 */}
                      {/* <td className="p-4">{order.reject_code || "-"}</td> 체결시간 */}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="10" className="p-4 text-gray-500">
                      거래 내역이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Order;
