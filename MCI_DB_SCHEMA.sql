CREATE DATABASE IF NOT EXISTS hanwha_mci;
USE hanwha_mci;

-- 사용자 테이블
CREATE TABLE users (
    user_id VARCHAR(50) PRIMARY KEY,
    user_pw VARCHAR(50) NOT NULL
);

-- 거래 내역 테이블
CREATE TABLE tx_history (
    stock_code        VARCHAR(6) NOT NULL,
    stock_name        VARCHAR(50) NOT NULL,
    transaction_code  VARCHAR(6) NOT NULL,  -- tx_code
    user_id           VARCHAR(50) NOT NULL,
    order_type        CHAR(1) NOT NULL,     -- 'B' 또는 'S'
    quantity          INT NOT NULL,
    reject_code       VARCHAR(4),
    order_time        DATETIME NOT NULL,
    price             INT NOT NULL,
    status            CHAR(1) NOT NULL,     -- ((W)aiting, (C)anceled, (D)one)
    
    PRIMARY KEY (transaction_code),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- 더미 사용자 데이터
INSERT INTO users (user_id, user_pw) VALUES
('admin', 'admin')