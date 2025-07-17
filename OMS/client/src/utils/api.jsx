// axios 라이브러리를 활용한 ajax 통신구현
import axios from "axios";

// 서버 API URI
const SERVER = import.meta.env.VITE_API_URL;

// api 인스턴스 생성 및 공통 설정
const api = axios.create({
  baseURL: '/', // Vite 개발 서버 루트
  // withCredentials: true, // 쿠키와 인증 정보를 포함하여 요청
});

export default api;
