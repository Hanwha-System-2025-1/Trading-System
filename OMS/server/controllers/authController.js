const { sendLoginRequest } = require('../services/mciService');


exports.login = async (req, res) => {
  const { username, password } = req.body;

  // 예외처리(실행 중단)
  if (!username || !password) {
    return res.status(400).json({ success: false, message: '아이디와 비밀번호를 입력해주세요.' });
  }

  // 프론트엔드로 주문 요청 성공/실패 응답 반환
  try {
    const result = await sendLoginRequest(username, password);

    // result 예외처리
    // if (!result || typeof result !== "object" || !("success" in result)) {
    //   throw new Error("서버로부터 유효한 응답을 받지 못했습니다.");
    // }

    // Promse.resolve를 반환한 경우 success 여부 분기 처리
    if (result.success === true) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}