import hanwhaLogo from '../assets/hanwha.png'
import { useState } from 'react';
import { useNavigate } from "react-router-dom"
import api from '../utils/api'
import styles from './Login.module.css';


function Login({onLogin}) {

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault(); // 기본 폼 동작 방지
    try {
      // 서버로 로그인 요청
      const response = await api.post("/api/login", {
        username,
        password,
      });

      // 응답 데이터를 구조 분해 할당
      const { success, message } = response.data;

      // 로그인 검증 후 성공 처리
      if (success) {
        // 로그인 성공 시 유저 정보 저장
        const userInfo = { username };
        console.log("로그인 성공:", response.data);
        onLogin(userInfo);
        navigate('/stock')
      } else {
        // 로그인 검증 후 실패 처리
        console.log(message || "로그인에 실패했습니다.");
        setErrorMessage(message || "로그인에 실패했습니다.");
      }
    } catch (error) {
      // 로그인 실패 처리(MCI로부터 로그인 응답을 못 받은 경우 등)
      console.error("로그인 에러:", error.response?.data || error.message);
      setErrorMessage(
        error.response?.data?.message || "로그인 중 오류가 발생했습니다."
      );
    }
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.container}>
        <div className={styles.mainWrapper}>
          <div className={styles.contentContainer}>
            <div className={styles.headerContainer}>
              <img
                loading="lazy"
                src={hanwhaLogo}
                className={styles.logo}
                alt="한화시스템 로고"
              />
              <div className={styles.titleWrapper}>
                <div className={styles.serviceName}>한화시스템</div>
                <div className={styles.serviceDescription}>모의 증권앱 프로젝트</div>
              </div>
            </div>
            
            <form className={styles.formContainer}>
              <input
                type="text"
                id="username"
                className={styles.inputField}
                placeholder="아이디"
                onChange={(e) => setUsername(e.target.value)}
              />
              
              <input
                type="password"
                id="password"
                className={styles.inputField}
                placeholder="비밀번호"
                onChange={(e) => setPassword(e.target.value)}
              />
              
              <div className={styles.rememberMe}>
                <input
                  type="checkbox"
                  id="remember"
                  className={styles.checkbox}
                />
                <label htmlFor="remember">아이디 저장</label>
              </div>
              
              <button type="submit" onClick={handleLogin} className={styles.loginButton}>
                로그인
              </button>
            </form>
            
            <div className={styles.footer}>
              <a href="#" className={styles.footerLink}>아이디등록</a>
              <img
                loading="lazy"
                src="https://cdn.builder.io/api/v1/image/assets/TEMP/121f0634545c56ab3b69ef976c33a7af5d2e0592ce4f393505ba40c14de7f8c9?placeholderIfAbsent=true&apiKey=76373063de8c47ab8cdeeecfaeeac5fc"
                className={styles.divider}
                alt=""
              />
              <a href="#" className={styles.footerLink}>아이디/비밀번호찾기</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
