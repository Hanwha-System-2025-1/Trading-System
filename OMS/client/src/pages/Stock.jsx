import { useState } from "react";
import Title from "../components/Title";
import api from "../utils/api";
import CustomCircularProgress from "../components/CustomCircularProgress";
import Nav from "../components/Nav";
import { useQuery } from "react-query";
import StockCard from "../components/Stock/StockCard";
import { Helmet } from "react-helmet";

const Stock = ({onLogout}) => {
  const [stockList, setStockList] = useState([
    {
      "stockId": "001",
      "stockName": "Samsung Electronics",
      "currentPrice": 70000,
      "priceDifference": "-500",
      "rateDifference": "-0.71",
      "liked": true
    },
    {
      "stockId": "002",
      "stockName": "LG Chem",
      "currentPrice": 800000,
      "priceDifference": "20000",
      "rateDifference": "2.56",
      "liked": false
    },
    {
      "stockId": "003",
      "stockName": "SK Hynix",
      "currentPrice": 120000,
      "priceDifference": "3000",
      "rateDifference": "2.56",
      "liked": true
    },
    {
      "stockId": "004",
      "stockName": "Hyundai Motor",
      "currentPrice": 200000,
      "priceDifference": "-10000",
      "rateDifference": "-4.76",
      "liked": false
    },
    {
      "stockId": "005",
      "stockName": "POSCO",
      "currentPrice": 300000,
      "priceDifference": "5000",
      "rateDifference": "1.69",
      "liked": true
    },
    {
      "stockId": "006",
      "stockName": "Samsung Biologics",
      "currentPrice": 700000,
      "priceDifference": "-10000",
      "rateDifference": "-1.42",
      "liked": true
    },
    {
      "stockId": "007",
      "stockName": "LG Display",
      "currentPrice": 150000,
      "priceDifference": "4000",
      "rateDifference": "2.73",
      "liked": false
    },
    {
      "stockId": "008",
      "stockName": "Kakao",
      "currentPrice": 120000,
      "priceDifference": "-3000",
      "rateDifference": "-2.44",
      "liked": true
    },
    {
      "stockId": "009",
      "stockName": "Celltrion",
      "currentPrice": 300000,
      "priceDifference": "-10000",
      "rateDifference": "-3.23",
      "liked": false
    },
    {
      "stockId": "010",
      "stockName": "KB Financial Group",
      "currentPrice": 50000,
      "priceDifference": "1000",
      "rateDifference": "2.04",
      "liked": true
    }
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

  // if (isLoading || isError) {
  //   return <CustomCircularProgress />;
  // }

  return (
    <div className="w-full h-full p-8 min-h-0">
      {/* <Helmet>
        <title>{"헬멧!?"}</title>
      </Helmet> */}
      <div className="w-full h-[100%] bg-white shadow-lg rounded-md p-4">
        <Title onLogout={onLogout} title="전체 종목 조회"/>
        <div className="w-full h-[90%] min-h-0 overflow-y-auto no-scrollbar">
          <div className="w-full min-h-0 grid grid-cols-3 gap-4 no-scrollbar place-items-center">
            {stockList.map((item, index) => (
              <StockCard size="medium" item={item} key={index} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Stock;