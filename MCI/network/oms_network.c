#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <sys/epoll.h>
#include "./oms_network.h"
#include "./krx_network.h"
#include <mysql/mysql.h>
#include <pthread.h>
#include "../include/common.h"
#include "pools/thread_pool.h"
#include "pools/db_pool.h"
#include "waitfree-mpsc-queue/mpscq.h"
#include "../include/env.h"
#include <signal.h>
#include "errno.h"
#include "fcntl.h"

#define NUM_THREADS 8
#define BUFFER_SIZE 1000000
#define LOGIN_SUCCESS 200
#define ID_NOT_FOUND 201
#define PASSWORD_MISMATCH 202
#define SERVER_ERROR 500
#define MAX_CLIENTS 100
#define BROADCAST_FD 9999

// 클라이언트 소켓 관리
int oms_clients[MAX_CLIENTS];
int client_count = 0;
pthread_mutex_t client_list_mutex = PTHREAD_MUTEX_INITIALIZER;

char buffer[BUFFER_SIZE];
size_t buffer_offset = 0;

thread_pool_t *thrd_pool;
db_pool_t *db_pool;

struct mpscq *socket_queue;
struct mpscq *pipe_queue;

volatile sig_atomic_t stop_event_loop = 0;

typedef struct {
    int fd;              
    int epoll_fd;        
    int pipe_write;      
    int pipe_read;      
    size_t body_length;  
    char body[BUFFER_SIZE]; 
} client_task_t;

client_task_t *create_task(void *data, size_t data_size, int destination) {
    client_task_t *task = malloc(sizeof(client_task_t));
    if (!task) {
        perror("[create_task] malloc failed");
        return NULL;
    }

    task->body_length = data_size;
    memcpy(task->body, data, data_size);

    if (destination >= 0) {  // 소켓 전송일 경우
        task->fd = destination;
    } else {  // 파이프 전송일 경우
        task->pipe_write = -destination;
    }

    return task;
}

void handle_sigint(int sig) {
    (void) sig;
    printf("\n[handle_sigint] SIGINT received. Stopping event loops...\n");
    stop_event_loop = 1;
}

void *socket_event_loop(void *arg) {
    (void)arg;
    printf("[socket_event_loop] Started.\n");

    while (!stop_event_loop) {
        client_task_t *task = (client_task_t *)mpscq_dequeue(socket_queue);
        if (task) {
            if (task->fd == BROADCAST_FD) {
                broadcast_to_clients(task->body, task->body_length);
            } 
            else {
                ssize_t bytes_sent = send(task->fd, task->body, task->body_length, 0);
                if (bytes_sent == -1) {
                    perror("[socket_event_loop] send failed");
                }
            }
            free(task);
        }
    }

    printf("[socket_event_loop] Stopping. Cleaning up resources...\n");
    return NULL;
}

void *pipe_event_loop(void *arg) {
    (void) arg;
    printf("[pipe_event_loop] Started.\n");
    
    while (!stop_event_loop) {
        client_task_t *task = (client_task_t *)mpscq_dequeue(pipe_queue);
        if (task) {
            ssize_t bytes_written = write(task->pipe_write, task->body, task->body_length);
            if (bytes_written == -1) 
                perror("[pipe_event_loop] write failed");

            free(task);
        }
    }

    printf("[pipe_event_loop] Stopping. Cleaning up resources...\n");
    return NULL;
}

void process_client_task(void *arg) {
    client_task_t *task = (client_task_t *)arg;
    int fd = task->fd;
    int pipe_write = task->pipe_write;
    int pipe_read = task->pipe_read;
    char *body = task->body; 

    hdr *header = (hdr *)body;

    if (fd == pipe_read) {  
        printf("[OMS-KRX -> OMS-MCI] event occurs\n");
        switch (header->tr_id) {
            case MOT_STOCK_INFOS:
                handle_mot_stock_infos((mpt_stock_infos *)body);
                break;
            case MOT_CURRENT_MARKET_PRICE:
                handle_mot_market_price((mot_market_price *)body);
                break;
            default:
                printf("[ERROR] Unknown TR_ID from pipe: %d\n", header->tr_id);
                break;
        }
    } 
    else {
        printf("[OMS -> OMS-MCI] event occurs\n");
        switch (header->tr_id) {
            case OMQ_LOGIN:
                handle_omq_login((omq_login *)body, fd);
                break;
            case OMQ_TX_HISTORY:
                handle_omq_tx_history((omq_tx_history *)body, fd);
                break;
            case OMQ_STOCK_INFOS:
                handle_omq_stock_infos((omq_stock_infos *)body, pipe_write, fd);
                break;
            case OMQ_CURRENT_MARKET_PRICE:
                handle_omq_market_price((omq_market_price *)body, pipe_write);
                break;
            default:
                printf("[ERROR] Unknown TR_ID from OMS socket: %d\n", header->tr_id);
                break;
        }
    }

    free(task);
}

void handle_oms(int oms_sock, int pipe_write, int pipe_read) {
    int epoll_fd = epoll_create1(0);
    if (epoll_fd == -1) {
        perror("epoll_create1");
        exit(EXIT_FAILURE);
    }

    struct epoll_event ev, events[MAX_CLIENTS + 2];
    ev.events = EPOLLIN;
    
    ev.data.fd = oms_sock;
    if (epoll_ctl(epoll_fd, EPOLL_CTL_ADD, oms_sock, &ev) == -1) {
        perror("epoll_ctl: oms_sock");
        exit(EXIT_FAILURE);
    }

    ev.data.fd = pipe_read;
    if (epoll_ctl(epoll_fd, EPOLL_CTL_ADD, pipe_read, &ev) == -1) {
        perror("epoll_ctl: pipe_read");
        exit(EXIT_FAILURE);
    }

    thrd_pool = create_thread_pool(NUM_THREADS);
    printf("-------[THREAD POOL] ");
    db_pool = init_db_pool(MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DBNAME);
    printf("[DB_CONNECTION_POOL] -------\n");

    signal(SIGINT, handle_sigint); // sock, pipe thrd 자원정리용 시그널

    socket_queue = mpscq_create(NULL, 9000);
    pipe_queue = mpscq_create(NULL, 9000);

    pthread_t socket_thread, pipe_thread;
    pthread_create(&socket_thread, NULL, socket_event_loop, NULL);
    pthread_create(&pipe_thread, NULL, pipe_event_loop, NULL);

    while (1) {
        int nfds = epoll_wait(epoll_fd, events, MAX_CLIENTS + 2, -1); 
        if (nfds == -1) {
            perror("epoll_wait");
            break;
        }

        for (int i = 0; i < nfds; ++i) {
            ssize_t len = 0;

            if (events[i].data.fd == oms_sock) { // 새 클라이언트 연결 처리
                struct sockaddr_in client_addr;
                socklen_t client_len = sizeof(client_addr);
                
                int client_sock = accept(oms_sock, (struct sockaddr *)&client_addr, &client_len);
                if (client_sock == -1) {
                    perror("Accept failed");
                    continue;
                }

                printf("[MCI Server] Client connected: %s:%d\n",
                       inet_ntoa(client_addr.sin_addr),
                       ntohs(client_addr.sin_port));

                add_client(client_sock, epoll_fd);
                
            } else if (events[i].data.fd  == pipe_read) {
                len = read(pipe_read, buffer + buffer_offset, BUFFER_SIZE - buffer_offset);
            } else { // 클라이언트 데이터 수신
                len = recv(events[i].data.fd, buffer + buffer_offset, BUFFER_SIZE - buffer_offset, 0);
                if (len <= 0) {
                    remove_client(events[i].data.fd, epoll_fd);
                    continue;
                }
            }

            if (len < 0) {
                perror("Read error");
                continue;
            }

            buffer_offset += len;
            
            size_t processed_bytes = 0;
            while (processed_bytes + sizeof(hdr) <= buffer_offset) {
                hdr *header = (hdr *)(buffer + processed_bytes);

                if (processed_bytes + header->length > buffer_offset) {
                    break; 
                }

                if (events[i].data.fd == oms_sock) {
                    printf("[Connection]\n");
                } else{
                    client_task_t *task = malloc(sizeof(client_task_t));
                    if (!task) {
                        perror("malloc failed");
                        continue;
                    }

                    task->fd = events[i].data.fd;
                    task->epoll_fd = epoll_fd;
                    task->pipe_write = pipe_write;
                    task->pipe_read = pipe_read;
                    task->body_length = header->length;

                    memcpy(task->body, buffer + processed_bytes, header->length);

                    submit_task(thrd_pool, process_client_task, task);
                }
                processed_bytes += header->length;
            }

            if (processed_bytes < buffer_offset) {
                memmove(buffer, buffer + processed_bytes, buffer_offset - processed_bytes);
            }
            buffer_offset -= processed_bytes;
        }
    }

    pthread_join(socket_thread, NULL);
    pthread_join(pipe_thread, NULL);

    mpscq_destroy(socket_queue);
    mpscq_destroy(pipe_queue);

    destroy_thread_pool(thrd_pool);
    destroy_db_pool(db_pool);
    close(epoll_fd);
    close(oms_sock);
    close(pipe_write);
    close(pipe_read);
    exit(EXIT_SUCCESS);
}

void handle_omq_login(omq_login *data, int oms_sock) {
    printf("[OMQ_LOGIN] User ID: %s, Password: %s\n", data->user_id, data->user_pw);

    int status_code = validate_user_credentials(data->user_id, data->user_pw);

    send_login_response(oms_sock, data->user_id, status_code);
}

void handle_omq_tx_history(omq_tx_history *data, int oms_sock) {
    printf("[OMQ_TX_HISTORY] request id: %s\n", data->user_id);

    char query[512];
    snprintf(query, sizeof(query),
             "SELECT stock_code, stock_name, transaction_code, user_id, order_type, quantity, reject_code, "
             "DATE_FORMAT(order_time, '%%Y%%m%%d%%H%%i%%s') AS datetime, price, status "
             "FROM tx_history "
             "WHERE user_id = '%s' "
             "LIMIT 50", data->user_id);

    MYSQL *conn = get_db_connection(db_pool);

    if (mysql_query(conn, query)) {
        fprintf(stderr, "[handle_omq_tx_history] Query failed: %s\n", mysql_error(conn));
        return;
    }

    MYSQL_RES *result = mysql_store_result(conn);
    if (!result) {
        fprintf(stderr, "[handle_omq_tx_history] Failed to store result: %s\n", mysql_error(conn));
        return;
    }

    mot_tx_history response;
    memset(&response, 0, sizeof(response)); 

    response.hdr.tr_id = 13;
    
    int row_count = 0;
    MYSQL_ROW row;

    while ((row = mysql_fetch_row(result)) && row_count < 50) {
        strncpy(response.tx_history[row_count].stock_code, row[0], sizeof(response.tx_history[row_count].stock_code) - 1);
        response.tx_history[row_count].stock_code[sizeof(response.tx_history[row_count].stock_code) - 1] = '\0';

        strncpy(response.tx_history[row_count].stock_name, row[1], sizeof(response.tx_history[row_count].stock_name) - 1);
        response.tx_history[row_count].stock_name[sizeof(response.tx_history[row_count].stock_name) - 1] = '\0';

        strncpy(response.tx_history[row_count].tx_code, row[2], sizeof(response.tx_history[row_count].tx_code) - 1);
        response.tx_history[row_count].tx_code[sizeof(response.tx_history[row_count].tx_code) - 1] = '\0';

        strncpy(response.tx_history[row_count].user_id, row[3], sizeof(response.tx_history[row_count].user_id) - 1);
        response.tx_history[row_count].user_id[sizeof(response.tx_history[row_count].user_id) - 1] = '\0';

        response.tx_history[row_count].order_type = row[4][0];
        response.tx_history[row_count].quantity = atoi(row[5]);
        
        strncpy(response.tx_history[row_count].reject_code, row[6], sizeof(response.tx_history[row_count].reject_code) - 1);
        response.tx_history[row_count].reject_code[sizeof(response.tx_history[row_count].reject_code) - 1] = '\0';

        strncpy(response.tx_history[row_count].datetime, row[7], sizeof(response.tx_history[row_count].datetime) - 1);
        response.tx_history[row_count].datetime[sizeof(response.tx_history[row_count].datetime) - 1] = '\0';

        response.tx_history[row_count].price = atoi(row[8]);
        response.tx_history[row_count].status = row[9][0];
        
        printf("[TX_HISTORY] #%d Stock Code: %s, Name: %s, Tx Code: %s, User: %s, "
           "Order Type: %c, Quantity: %d, Reject Code: %s, Datetime: %s, Status: %c\n",
           row_count + 1,
           response.tx_history[row_count].stock_code,
           response.tx_history[row_count].stock_name,
           response.tx_history[row_count].tx_code,
           response.tx_history[row_count].user_id,
           response.tx_history[row_count].order_type,
           response.tx_history[row_count].quantity,
           response.tx_history[row_count].reject_code,
           response.tx_history[row_count].datetime,
           response.tx_history[row_count].status);
        
        row_count++;
    }

    response.hdr.length = sizeof(response);

    client_task_t *task = create_task(&response, sizeof(response), oms_sock);
    if (!mpscq_enqueue(socket_queue, task)) {
        perror("[handle_omq_stock_infos] Failed to enqueue task");
        free(task);
    }

    mysql_free_result(result);
    release_db_connection(db_pool,conn);
}

void handle_omq_stock_infos(omq_stock_infos *data, int pipe_write, int oms_sock) {
    printf("[OMQ_STOCK_INFOS] Forwarding request to KRX process from oms_sock: %d\n", oms_sock);
    
    if (data->hdr.length != sizeof(omq_stock_infos)) {
        perror("[OMQ_STOCK_INFOS] Invalid data size");
        return;
    }

    mpq_stock_infos stockInfo;
    stockInfo.hdr.tr_id = MKQ_STOCK_INFOS;
    stockInfo.hdr.length = sizeof(mpq_stock_infos);
    stockInfo.oms_sock = oms_sock;

    client_task_t *task = create_task(&stockInfo, sizeof(stockInfo), -pipe_write);
    if (!task) {
        perror("[handle_omq_stock_infos] Task creation failed");
        return;
    }

    if (!mpscq_enqueue(pipe_queue, task)) {
        perror("[handle_omq_stock_infos] Failed to enqueue task");
        free(task);
    }
}

void handle_mot_stock_infos(mpt_stock_infos *data) {
    printf("[MOT_STOCK_INFOS] Sending stock info to requesting OMS client: %d\n", data->oms_sock);
    
    mot_stock_infos stockInfo;
    stockInfo.hdr.tr_id = MOT_STOCK_INFOS;
    stockInfo.hdr.length = sizeof(mot_stock_infos);
    memcpy(stockInfo.body, data->body, sizeof(data->body));

    client_task_t *task = create_task(&stockInfo, sizeof(stockInfo), data->oms_sock);
    if (!task) {
        perror("[handle_mot_stock_infos] Task creation failed");
        return;
    }

    if (!mpscq_enqueue(socket_queue, task)) {
        perror("[handle_mot_stock_infos] Failed to enqueue task");
        free(task);
    }
}

void handle_omq_market_price(omq_market_price *data, int pipe_write) {
    printf("[OMQ_MARKET_PRICE] Forwarding request to KRX process\n");
    client_task_t *task = create_task(data, sizeof(omq_market_price), -pipe_write);
    if (!mpscq_enqueue(pipe_queue, task)) {
        perror("[handle_omq_stock_infos] Failed to enqueue task");
        free(task);
    }
}

void handle_mot_market_price(mot_market_price *data) {
    printf("[MOT_MARKET_PRICE] Broadcasting market price to all OMS clients\n");
    client_task_t *task = create_task(data, sizeof(mot_market_price), BROADCAST_FD);

    if (!mpscq_enqueue(socket_queue, task)) {
        perror("[handle_omq_stock_infos] Failed to enqueue task");
        free(task);
    }
}

int validate_user_credentials(const char *user_id, const char *user_pw) {
    char query[256];
    snprintf(query, sizeof(query),
             "SELECT user_pw FROM users WHERE user_id = '%s'", user_id);

    MYSQL *conn = get_db_connection(db_pool);

    if (mysql_query(conn, query)) {
        fprintf(stderr, "[validate_user_credentials] Query failed: %s\n", mysql_error(conn));
        return SERVER_ERROR;
    }

    MYSQL_RES *result = mysql_store_result(conn);
    if (!result) {
        fprintf(stderr, "[validate_user_credentials] Failed to store result: %s\n", mysql_error(conn));
        return SERVER_ERROR;
    }

    int status_code;
    if (mysql_num_rows(result) == 0) { // no id
        status_code = ID_NOT_FOUND;
    } else {
        MYSQL_ROW row = mysql_fetch_row(result);
        if (row && strcmp(row[0], user_pw) == 0) { // success
            status_code = LOGIN_SUCCESS;
        } else { // not correct pw
            status_code = PASSWORD_MISMATCH;
        }
    }

    mysql_free_result(result);
    release_db_connection(db_pool,conn);
    
    return status_code;
}

void send_login_response(int oms_sock,char *user_id, int status_code) {
    mot_login response;
    response.hdr.tr_id = MOT_LOGIN;
    response.hdr.length = sizeof(mot_login); // // 62 + 2(패딩)
    strncpy(response.user_id, user_id, sizeof(response.user_id) - 1);
    response.status_code = status_code;

    client_task_t *task = create_task(&response, sizeof(response), oms_sock);
    if (!mpscq_enqueue(socket_queue, task)) {
        perror("[handle_omq_stock_infos] Failed to enqueue task");
        free(task);
    }
    
    printf("[send_login_response]: status code:%d\n", status_code);

}

void add_client(int client_sock, int epoll_fd) {
    pthread_mutex_lock(&client_list_mutex);
    if (client_count < MAX_CLIENTS) {
        oms_clients[client_count++] = client_sock;

        struct epoll_event ev;
        ev.events = EPOLLIN;
        ev.data.fd = client_sock;
        if (epoll_ctl(epoll_fd, EPOLL_CTL_ADD, client_sock, &ev) == -1) {
            perror("[add_client] epoll_ctl add failed");
        } else {
            printf("[add_client] Added client socket %d\n", client_sock);
            printf("[add_client] Current OMS Client = %d\n",client_count);
        }
    } else {
        printf("[add_client Failed] Max clients reached. Closing socket %d\n", client_sock);
        close(client_sock);
    }
    pthread_mutex_unlock(&client_list_mutex);
}

void remove_client(int client_sock, int epoll_fd) {
    pthread_mutex_lock(&client_list_mutex);
    for (int i = 0; i < client_count; i++) {
        if (oms_clients[i] == client_sock) {
            epoll_ctl(epoll_fd, EPOLL_CTL_DEL, client_sock, NULL);
            close(client_sock);

            oms_clients[i] = oms_clients[--client_count];
            printf("[remove_client] Removed client socket %d\n", client_sock);
            printf("[remove_client] Current OMS Client = %d\n",client_count);
            break;
        }
    }
    pthread_mutex_unlock(&client_list_mutex);
}

void broadcast_to_clients(void *data, size_t data_size) {
    pthread_mutex_lock(&client_list_mutex);

    mot_market_price *price_data = (mot_market_price*)data;
    for (int i = 0; i < client_count; i++) {
        if (send(oms_clients[i], price_data, data_size, 0) == -1) {
            perror("[broadcast_to_clients] Failed to send to client");
            remove_client(oms_clients[i], 0);
        }
    }

    pthread_mutex_unlock(&client_list_mutex);
}
