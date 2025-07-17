#include <string.h>

#include "../headers/kft_ipc_db.h"
#include "../headers/kft_log.h"


// 메시지 큐 초기화 (한 번만 호출됨)
int init_message_queue(int key_id) {
    int message_queue_id = msgget((key_t)key_id, IPC_CREAT | 0666);
    if (message_queue_id == -1) {
        log_message("ERROR", "[%s] Server: 메시지 큐 생성 실패 (que ID: %d)",get_timestamp_char(), key_id);
        exit(1);
    }
    printf("[TRACE] 메시지 큐 생성 완료 (ID: %d)\n", message_queue_id);
    log_message("TRACE", "[%s] Server: 메시지 큐 생성 완료 (ID: %d)",get_timestamp_char() , message_queue_id);
    return message_queue_id;
}

// 메시지 큐에 데이터 전송
void send_to_queue(int message_queue_id, long exectype, char *stock_code, char *transaction_code, char order_type, int price, int quantity) {
    if (message_queue_id == -1) {
        printf("[ERROR] 메시지 큐가 초기화되지 않았습니다.\n");
        return;
    }

    ExecutionMessage msg;
    msg.msgtype = 2;
    msg.exectype = exectype;
    strcpy(msg.stock_code, stock_code);
    strcpy(msg.transaction_code, transaction_code);
    msg.order_type = order_type;
    msg.price = price;
    msg.quantity = quantity;
    
    if (msgsnd(message_queue_id, &msg, sizeof(msg), IPC_NOWAIT) == -1) {
        perror("[ERROR] msgsnd() 실패");
        log_message("ERROR", "[%s] MessageQueue: msgsnd() 실패", get_timestamp_char());
    } else {
        printf("[TRACE] msgsnd() 성공: %s, 수량 %d, 가격 %d\n", stock_code, quantity, price);
        log_message("TRACE", "[%s] MessageQueue: msgsnd() 성공: %s, 수량 %d, 가격 %d",get_timestamp_char(), stock_code, quantity, price);
    }
}

void send_order_to_queue(int message_queue_id, fkq_order *msg) {
    if (message_queue_id == -1) {
        printf("[ERROR] 메시지 큐가 초기화되지 않았습니다.\n");
        return;
    }
    
    
    if (msgsnd(message_queue_id, msg, sizeof(*msg), IPC_NOWAIT) == -1) {
        perror("[ERROR] msgsnd() 실패");
        log_message("ERROR", "[%s] MessageQueue: msgsnd() 실패", get_timestamp_char());
    } else {
        printf("[TRACE] msgsnd() 성공: %s, 수량 %d, 가격 %d\n", msg->stock_name, msg->quantity, msg->price);
        log_message("TRACE", "[%s] MessageQueue: msgsnd() 성공: %s, 수량 %d, 가격 %d",get_timestamp_char(), msg->stock_name, msg->quantity, msg->price);
    }
}

void send_execution_to_queue(int message_queue_id, kft_execution *msg) {
    if (message_queue_id == -1) {
        printf("[ERROR] 메시지 큐가 초기화되지 않았습니다.\n");
        return;
    }
    
    if (msgsnd(message_queue_id, msg, sizeof(*msg), IPC_NOWAIT) == -1) {
        perror("[ERROR] msgsnd() 실패");
        log_message("ERROR", "[%s] MessageQueue: msgsnd() 실패",get_timestamp_char());
    } else {
        printf("[TRACE] msgsnd() 성공: %s, 가격 %d\n", msg->transaction_code, msg->executed_price);
        log_message("TRACE", "[%s] MessageQueue: msgsnd() 성공: %s, 가격 %d",get_timestamp_char(), msg->transaction_code, msg->executed_price);
    }
}