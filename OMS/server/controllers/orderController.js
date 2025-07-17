const { sendOrderRequest } = require("../services/fepService");

exports.placeOrder = async (req, res) => {
  const orderData = req.body;
  console.log('orderData:', orderData);

  // 프론트엔드로 주문 성공/실패 응답 반환
  try {
    const result = await sendOrderRequest(orderData);
    console.log('result:',result);

    if (result.success === true) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    // 네트워크 오류 또는 서버 문제
    // sendOrderRequest 함수 내부에서 오류 발생하거나 Promise.reject 반환하는 경우 등등
    res.status(500).json({ success: false, message: error.message || "네트워크 혹은 서버 내부 오류입니다."});
  }
}