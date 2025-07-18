import { useQuery } from "react-query";
import { useNavigate } from "react-router-dom";
import { getStockStyle } from "../../utils/getStockStyle";
import api from "../../utils/api";
import logoImage from "../../assets/hanwha.png";
import Card from "./Card";
// import LikeButton from "./LikeButton";
import Avatar from "@mui/joy/Avatar";

/** 주식종목 카드 */
const StockCard = ({ item, size }) => {
  const navigate = useNavigate();
  const {
    stock_code,
    stock_name,
    price,
    volume,
    change,
    rate_of_change,
    hoga,
    high_price,
    low_price,
    market_time,
  } = item;
  const { textColor, icon } = getStockStyle(change); // 대비와 등락률에 따른 스타일 변환

  // size별 카드 크기
  const width = size === "medium" ? "w-[300px] " : "w-[212px] ";
  const xsText = size === "medium" ? "text-[14px]" : "text-xs";
  const mdText = size === "medium" ? "text-[20px]" : "text-md";
  const xlText = size === "medium" ? "text-[24px]" : "text-xl";
  const avatarSize = size === "medium" ? "28px" : "20px";

  // 상세조회 페이지 이동
  const handleCardClick = () => {
    navigate(`/stock/${stock_code}`, {
      state: {
        stock_code,
        stock_name,
        price,
        volume,
        change,
        rate_of_change,
        hoga,
        high_price,
        low_price,
        market_time,
      },
    });
  };

  // Access 토큰 가져오기
  // const userAuthContext = useContext(UserAuthContext);
  // const accessToken = userAuthContext?.accessToken;

  // 종목 정보(좋아요 정보) 가져오기
  const data = true;
  // const { data } = useQuery(["stock-details", stockId], async () => {
  //   const response = await api.get(`/stock/${stockId}`, {
  //     headers: { accesstoken: accessToken },
  //   });
  //   return response?.data;
  // });

  // 좋아요 여부 저장
  // let isFavorite = data?.data?.interested;

  // 기업 로고 저장
  // const logoImage = data?.data?.imageUrl;

  return (
    <div className={`${width}`} onClick={handleCardClick}>
      <Card className="hover:cursor-pointer" size={size}>
        <div className="h-full flex flex-col justify-between relative">
          <div className="absolute right-0 top-0">
            {/* 좋아요 data가 반환되면 좋아요 버튼 활성화 */}
            {data && (
              <div className="absolute right-0 top-0">
                {/* <LikeButton
                  stockId={stockId}
                  isFavorite={isFavorite}
                  size={size}
                /> */}
              </div>
            )}
          </div>

          <div className="flex items-start gap-2">
            <p className={`${xsText} text-slate-500 `}>KOSPI</p>
            <p className={`${xsText} text-slate-500 `}>{stock_code}</p>
          </div>

          <div className="flex items-center gap-2">
            <Avatar
              src={logoImage}
              size="sm"
              sx={{ "--Avatar-size": avatarSize }}
            />
            <h2 className={`${mdText} text-black `}>{stock_name}</h2>
          </div>

          <div className="flex items-center">
            <p className={`${xlText} mr-5 ` + textColor}>
              {price.toLocaleString()}
            </p>
            <p className={`${xsText} text-center ` + textColor}>
              {icon} {Math.abs(change).toLocaleString()} ({rate_of_change})
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default StockCard;
