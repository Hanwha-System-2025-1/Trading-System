CREATE DATABASE IF NOT EXISTS hanwha_krx;
USE hanwha_krx;

-- 종목 정보 테이블(stock_info)
CREATE TABLE stock_info (
    stock_code VARCHAR(7) NOT NULL,         -- 종목코드
    stock_name VARCHAR(50) NOT NULL,        -- 종목명
    PRIMARY KEY (stock_code)                -- 기본키 (종목코드)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 시세 테이블 (market_prices)
CREATE TABLE market_prices (
    stock_code VARCHAR(7) NOT NULL,          -- 종목코드
    closing_price INT NOT NULL,             -- 전일종가
    stock_price INT NOT NULL,               -- 현재가
    volume BIGINT NOT NULL,                 -- 거래량
    contrast INT NOT NULL,                  -- 대비
    fluctuation_rate VARCHAR(6) NOT NULL,   -- 등락률
    buying_balance INT NOT NULL,            -- 매수잔량
    selling_balance INT NOT NULL,           -- 매도잔량
    bid_price INT NOT NULL,                 -- 매수호가
    ask_price INT NOT NULL,                 -- 매도호가
    high_price INT NOT NULL,                -- 고가
    low_price INT NOT NULL,                 -- 저가
    time VARCHAR(15) NOT NULL,              -- 시간 (yyyymmddhhmmss)
    PRIMARY KEY (stock_code, time),         -- 복합 기본키 (종목코드 + 시간)
    FOREIGN KEY (stock_code) REFERENCES stock_info(stock_code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE orders (
    transaction_code CHAR(6) PRIMARY KEY,
    stock_code CHAR(6),
    stock_name VARCHAR(50),
    user_id VARCHAR(20),
    order_type CHAR(1),
    quantity INT,
    order_time CHAR(14),
    price INT,
    status ENUM('NEW', 'FILLED', 'CANCELLED') DEFAULT 'NEW'
);

CREATE TABLE executions (
    execution_id INT PRIMARY KEY AUTO_INCREMENT,
    transaction_code CHAR(6),
    executed_quantity INT,
    executed_price INT,
    execution_time CHAR(14),
    FOREIGN KEY (transaction_code) REFERENCES orders(transaction_code)
);

-- stock_info 데이터 삽입
INSERT INTO stock_info (stock_code, stock_name) VALUES
('005930', '삼성전자'),
('000660', 'SK하이닉스'),
('035420', 'NAVER'),
('272210', '한화시스템');



-- market_prices 데이터 삽입
INSERT INTO market_prices (stock_code, closing_price, stock_price, volume, contrast, fluctuation_rate,
                           buying_balance, selling_balance, bid_price, ask_price, high_price, low_price, time)
VALUES
('005930', 53000, 53400, 61407, 200, '-0.3%', 10840, 500, 53400, 53410, 54000, 50000, '20250120123456'),
('000660', 94000, 94500, 31234, 500, '+0.5%', 15000, 300, 94500, 94510, 95000, 93000, '20250120123500'),
('035420', 285000, 290000, 12000, 5000, '+1.75%', 2000, 100, 290000, 290010, 295000, 280000, '20250120123600'),
('272210', 15000, 15200, 45000, 200, '+1.33%', 8000, 1200, 15100, 15250, 15500, 14800, '20250120123700');
