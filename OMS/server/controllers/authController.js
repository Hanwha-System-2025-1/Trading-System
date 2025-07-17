const { sendLoginRequest } = require('../services/mciService');


exports.login = async (req, res) => {
  const { username, password } = req.body;

  // 예외처리(실행 중단)
  if (!username || !password) {
    return res.status(400).json({ success: false, message: '아이디와 비밀번호를 입력해주세요.' });
  }

  // 프론트엔드로 로그인 성공/실패 응답 반환
  try {
    const result = await sendLoginRequest(username, password);
    console.log('result:',result)
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}