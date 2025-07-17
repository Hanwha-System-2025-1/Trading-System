#include "../../headers/kft_ipc_db.h"
#include "../../headers/kft_log.h" 

#define DB_HOST "localhost"
#define DB_USER "root"
#define DB_PASS "Hanwha1!"
#define DB_NAME "hanwha_krx"


MYSQL *connect_to_mysql() {
    MYSQL *conn = mysql_init(NULL);
    if (conn == NULL) {
        printf("[ERROR] mysql_init() 실패\n");
        log_message("ERROR", "[%s] Database: mysql_init() 실패",get_timestamp_char());
        exit(1);
    }

    if (mysql_real_connect(conn, DB_HOST, DB_USER, DB_PASS, DB_NAME, 0, NULL, 0) == NULL) {
        printf("[ERROR] MySQL 연결 실패: %s\n", mysql_error(conn));
        log_message("ERROR", "[%s] Database: MySQL 연결 실패: %s",get_timestamp_char() , mysql_error(conn));
        mysql_close(conn);
        exit(1);
    }

    printf("[TRACE] MySQL 연결 성공!\n");
    log_message("TRACE", "[%s] Database: MySQL 연결 성공",get_timestamp_char());
    return conn;  // 연결 객체 반환
}

// 주문 데이터 MySQL 저장 함수
void insert_order(MYSQL *conn, fkq_order *order) {
    char query[512];

    snprintf(query, sizeof(query),
            "INSERT INTO orders (transaction_code, stock_code, stock_name, user_id, order_type, quantity, order_time, price) "
            "VALUES ('%s', '%s', '%s', '%s', '%c', %d, '%s', %d)",
            order->transaction_code, order->stock_code, order->stock_name, order->user_id, 
            order->order_type, order->quantity, order->order_time, order->price);



    if (mysql_query(conn, query)) {
        printf("[ERROR] INSERT 실패: %s\n쿼리: %s\n", mysql_error(conn), query);
        log_message("ERROR", "[%s] Database: INSERT 실패.  %s | Query: %s",get_timestamp_char() , mysql_error(conn), query);
    } else {
        printf("[TRACE] 데이터 삽입 성공! 거래 코드: %s\n", order->transaction_code);
        log_message("TRACE", "[%s] Database: 주문 데이터 저장 완료. 거래 코드: %s",get_timestamp_char(), order->transaction_code);
    }
}
// 체결 데이터 MySQL 저장 함수
void insert_execution(MYSQL *conn, kft_execution *execution, const int executed_quantity) {
    char query_execution[512];

    snprintf(query_execution, sizeof(query_execution),
            "INSERT INTO executions (transaction_code, executed_quantity, executed_price, execution_time) "
            "VALUES ('%s', %d, %d, '%s')", execution->transaction_code,executed_quantity,execution->executed_price,execution->time);

    char query_update[512];
    snprintf(query_update, sizeof(query_update),
            "UPDATE orders  SET status = 'FILLED'  WHERE transaction_code = '%s'",
            execution->transaction_code);



    if (mysql_query(conn, query_execution)) {
        printf( "[ERROR] INSERT 실패: %s\n쿼리: %s\n", mysql_error(conn), query_execution);
        log_message("ERROR", "[%s] Database: INSERT 실패: %s | Query: %s", get_timestamp_char(), mysql_error(conn), query_execution);
    } else {
        printf("[TRACE] 데이터 삽입 성공! 거래 코드: %s\n", execution->transaction_code);
        log_message("TRACE", "[%s] Database: 체결정보 저장 완료. 거래 코드: %s", get_timestamp_char(), execution->transaction_code);
        if (mysql_query(conn, query_update)) {
            printf( "[ERROR] UPDATE 실패: %s\n쿼리: %s\n", mysql_error(conn), query_update);
            log_message("ERROR", "[%s] Database: 주문 상태 변경 실패: %s | Query: %s", get_timestamp_char(), mysql_error(conn), query_execution);

        } else {
            printf("[TRACE] 상태 업데이트 성공! 거래 코드: %s\n", execution->transaction_code);
            log_message("TRACE", "[%s] Database: 주문 상태 변경 완료. 거래 코드: %s", get_timestamp_char(), execution->transaction_code);
        }
        // DB 에러도 에러코드 추가해서 반환
    }
}