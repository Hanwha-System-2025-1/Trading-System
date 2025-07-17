const { sendHistoryRequest } = require("../services/mciService");

exports.getHistory = async (req, res) => {
  const username = req.body;
  const user = username?.user || "jina"; // 기본값 설정
  console.log("user:", user);

  // 프론트엔드로 주문 성공/실패 응답 반환
  try {
    const result = await sendHistoryRequest(user);
    console.log('result:',result);

    if (result.success === true) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}