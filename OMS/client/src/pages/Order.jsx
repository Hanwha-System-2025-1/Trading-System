import { useContext } from "react";
import { useQuery } from "react-query";
import { useNavigate, useParams } from "react-router-dom";
// import { UserAuthContext } from "../../App";
import api from "../utils/api";

// import StockChart from "./stockChart/StockChart";
// import StockInformationTabs from "./stockInformationTabs/StockInformationTabs";
// import FavoriteItemsCarousel from "../main/favoriteStocks/FavoriteItemsCarousel";
import CustomCircularProgress from "../components/CustomCircularProgress";
import NotFound from "../components/NotFound";
// import { StockDetailsTitle } from "./stockItemTitle/StockDetailsTitle";
import { Helmet } from "react-helmet";

/** 주식 상세정보 화면 */
const Order = () => {
  const navigate = useNavigate();
  const { stockId } = useParams();

  // const userAuthContext = useContext(UserAuthContext);
  // const accessToken = userAuthContext?.accessToken;

  const { isLoading, data, error } = useQuery(
    ["stock-details", stockId],
    async () => {
      const response = await api.get(`/stock/${stockId}`, {
        // headers: { accesstoken: accessToken },
      });
      return response?.data;
    },
    { refetchInterval: 3000 }
  );

  if (isLoading) return <CustomCircularProgress />;

  if (typeof stockId === "undefined") return <NotFound />;

  if (
    error ||
    data?.error?.code === "MYSQL_NO_DATA" ||
    data?.error?.message === "994"
  ) {
    alert("올바른 종목 코드로 조회해주시기 바랍니다.");
    navigate("/stock");
    return <NotFound />;
  }

  const stockItem = data?.data;

  return (
    <div className="h-full flex flex-col">
      <Helmet>
        <title>{`TooT - ${stockItem.stockName}`}</title>
      </Helmet>
      {/* 상단 캐러셀 */}
      <div className="h-1/5">
        {/* <FavoriteItemsCarousel /> */}
      </div>
      {/* 하단 상세 정보 */}
      <div className="h-4/5 px-6 pb-4">
        <div className="h-full grid grid-rows-6 grid-cols-3 gap-4">
          {/* 종목명, 코드 등 */}
          <div className="row-span-1 col-span-3 flex items-center">
            <StockDetailsTitle stockId={stockId} stockItem={stockItem} />
          </div>
          {/* 주식 차트 */}
          <div className="row-span-5 col-span-2">
            <StockChart stockItem={stockItem} />
          </div>
          {/* 종목 정보 */}
          <div className="row-span-5 col-span-1">
            <StockInformationTabs stockId={stockId} stockItem={stockItem} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Order;
