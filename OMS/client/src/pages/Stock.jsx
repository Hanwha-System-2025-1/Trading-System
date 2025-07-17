import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import Title from "../components/Title";
import api from "../utils/api";
import CustomCircularProgress from "../components/CustomCircularProgress";
import Nav from "../components/Nav";
import { useQuery } from "react-query";
import StockCard from "../components/Stock/StockCard";
import { Helmet } from "react-helmet";

const socket = io("http://localhost:5000"); //백엔드와 웹소켓 연결 생성

const Stock = ({user, onLogout}) => {
  const [isLoading, setIsLoading] = useState(true)
  const [marketData, setMarketData] = useState([
    {
      stock_code: "000001",
      stock_name: "Stock1",
      price: 1000,
      change: 0,
      rate_of_change: "+0.0%",
    },
    {
      stock_code: "000002",
      stock_name: "Stock2",
      price: 1100,
      change: 10,
      rate_of_change: "+1.0%",
    },
    {
      stock_code: "000003",
      stock_name: "Stock3",
      price: 1200,
      change: 20,
      rate_of_change: "+2.0%",
    },
    {
      stock_code: "000004",
      stock_name: "Stock4",
      price: 1300,
      change: 30,
      rate_of_change: "+3.0%",
    }
  ]);


  // 종목 실시간 데이터 업데이트
  useEffect(() => {
    socket.on("marketData", (data) => {
      setMarketData(data.marketData);
      setIsLoading(false)
    });  // 마운트 될 때, 등록 후 서버에서 "marketData" 이벤트를 보낼 때마다 setMarketData()가 실행

    return () => {
      socket.off("marketData");
    }; // useEffe1ct 정리 함수(컴포넌트가 제거될 때, 이벤트 리스너를 해제하여 메모리 누수 방지)
  }, []);


  // 테스트용 데이터
  const [stockList, setStockList] = useState([
    {
      "stockId": "001",
      "stockName": "Samsung Electronics",
      "currentPrice": 70000,
      "priceDifference": "-500",
      "rateDifference": "-0.71",
      "liked": true
    },
  ]);

  // const { isLoading, isError } = useQuery("stock-all", async () => {
  //   const response = await api.get("/stock/showall", {
  //     headers: {
  //       accesstoken: accessToken,
  //     },
  //   });
  //   setStockList(response.data.data);
  //   console.log(response.data.data);
  // });

  return (
    <div className="w-full h-full bg-white shadow-lg rounded-md p-8">
      <Title onLogout={onLogout} title="전체 종목 조회"/>
        <div className="w-full h-[90%] min-h-0 overflow-y-auto no-scrollbar">
          <div className="w-full min-h-0 grid grid-cols-3 gap-4 no-scrollbar place-items-center">
            {isLoading ? <CustomCircularProgress/> : null}
            {marketData.map((item, index) => (
              <StockCard size="medium" item={item} key={index} />
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="absolute top-0 left-0 w-full h-full flex justify-center items-center backdrop-blur-sm z-50">
            <CustomCircularProgress />
          </div>
        )}

    </div>
  );
};

export default Stock;