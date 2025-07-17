/**
 * 전일대비율에 따라 글자색과 등락 아이콘을 결정해주는 함수
 * 1. 동일 => 글자색: 검정, 아이콘: "―"
 * 2. 상승 => 글자색: 빨강, 아이콘: "▲"
 * 3. 하락 => 글자색: 파랑, 아이콘: "▼"
 */

export const getStockStyle = (value) => {
    let textColor = "text-gray-500"; // 기본값
    let icon = "";
  
    if (value > 0) {
      textColor = "text-red-500"; // 상승: 빨강
      icon = "▲";
    } else if (value < 0) {
      textColor = "text-blue-500"; // 하락: 파랑
      icon = "▼";
    }
  
    return { textColor, icon };
  };