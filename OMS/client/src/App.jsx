import './App.css'
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Stock from './pages/Stock';
import Order from './pages/Order';
import NotFound from './components/NotFound';

function App() {
  const [user, setUser] = useState({});

  // 새로고침, 브라우저를 닫았다가 다시 열 때 로그인 상태 복원
  useEffect(() => {
    const storedUserInfo = localStorage.getItem("userInfo");
    if (storedUserInfo) {
      setUser(JSON.parse(storedUserInfo));
    }
  }, []);


  // 로그인 성공 시 호출될 함수
  const handleLogin = (userInfo) => {
    setUser(userInfo);
    localStorage.setItem("userInfo", JSON.stringify(userInfo));
  };

  // 로그아웃 함수
  const handleLogout = () => {
    localStorage.removeItem("userInfo"); // localStorage에서 유저 정보 삭제
    setUser(null); // React 상태 초기화
  };

  return (
    <Router>
      <Routes>
        {/* 로그인 페이지 */}
        <Route path="/" element={<Login onLogin={handleLogin}/>} />
        
        {/* 종목 페이지 (로그인 후 접근 가능) */}
        {/* <Route path="/stock" element={user ? <Stock onLogout={handleLogout} /> : <Login onLogin={handleLogin} />} /> */}
        <Route path="/stock" element={<Stock user={user} onLogout={handleLogout} /> } />
        
        {/* 주문 페이지 (스톡에서 주문 버튼 클릭 시 이동) */}
        {/* <Route path="/order" element={user ? <Order/> : <Login onLogin={handleLogin} />} /> */}
        <Route path="/order" element={ <Order user={user.username} /> } />

        {/* 특정 종목 주문 페이지 */}
        <Route path="stock/:stockId" element={<Order user={user.username} />} />

        {/* 잘못된 경로 */}
        <Route path="*" element={<NotFound />}></Route>
      </Routes>
    </Router>
  );
}

export default App;
