#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <sys/wait.h>
#include <pthread.h>
#include <mqueue.h>
#include <sys/epoll.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <errno.h>
#include <sys/mman.h>

#include "./krx_network.h"
#include "./oms_network.h"
#include "../data/batch.h"

#define BUFFER_SIZE 1000000 // 버퍼 사이즈


pthread_mutex_t socket_mutex = PTHREAD_MUTEX_INITIALIZER; // Socket 동기화
pthread_mutex_t pipe_mutex = PTHREAD_MUTEX_INITIALIZER;  // 파이프 write 동기화

void print_kmt_current_market_prices(kmt_current_market_prices *data) {
    printf("Transaction ID: %d\n", data->hdr.tr_id);
    printf("Length: %d bytes\n", data->hdr.length);
    printf("=== Market Prices ===\n");

    for (int i = 0; i < 4; i++) {
        printf("\n[Stock %d]\n", i + 1);
        printf("Stock Code: %s\n", data->body[i].stock_code);
        printf("Stock Name: %s\n", data->body[i].stock_name);
        printf("Price: %d\n", data->body[i].price);
        printf("Volume: %ld\n", data->body[i].volume);
        printf("Change: %d\n", data->body[i].change);
        printf("Rate of Change: %s\n", data->body[i].rate_of_change);
        printf("Hoga 1 - Type: %d, Price: %d, Balance: %d\n",
               data->body[i].hoga[0].trading_type,
               data->body[i].hoga[0].price,
               data->body[i].hoga[0].balance);
        printf("Hoga 2 - Type: %d, Price: %d, Balance: %d\n",
               data->body[i].hoga[1].trading_type,
               data->body[i].hoga[1].price,
               data->body[i].hoga[1].balance);
        printf("High Price: %d\n", data->body[i].high_price);
        printf("Low Price: %d\n", data->body[i].low_price);
        printf("Market Time: %s\n", data->body[i].market_time);
    }
}

void *handle_current_market_price(void *arg) {
    int pipe_write = *(int *)arg;

    // Message Queue 열기
    mqd_t mq = mq_open(MQ_NAME, O_RDONLY);
    if (mq == (mqd_t)-1) {
        perror("[Market Price Thread] Failed to open message queue");
        pthread_exit(NULL);
    }

    while (1) {
        kmt_current_market_prices received_data;

        // Message Queue에서 데이터 읽기
        ssize_t bytes_read = mq_receive(mq, (char *)&received_data, MQ_MSG_SIZE, NULL);
        if (bytes_read == -1) {
            perror("[Market Price Thread] Failed to receive from message queue");
            continue;
        }

        // print_kmt_current_market_prices(&received_data);
        printf("[Market Price Thread] Received data from message queue.\n");

        // 데이터를 mot_market_price로 변환
        mot_market_price transformed_data;
        transformed_data.hdr.tr_id = MOT_CURRENT_MARKET_PRICE;
        transformed_data.hdr.length = received_data.hdr.length;
        
        for (int i = 0; i < 4; i++) {
            transformed_data.body[i] = received_data.body[i];
        }

        // 파이프로 전송
        pthread_mutex_lock(&pipe_mutex);
        if (write(pipe_write, &transformed_data, sizeof(transformed_data)) == -1) {
            perror("[Market Price Thread] Failed to write to pipe");
        }
        pthread_mutex_unlock(&pipe_mutex);
    }

    mq_close(mq);
    pthread_exit(NULL);
}

// 오늘 날짜 기반 파일 경로 생성
void get_today_filepath(char *filepath, size_t size) {
    time_t now = time(NULL);
    struct tm *t = localtime(&now);
    
    snprintf(filepath, size, "%s%s%04d_%02d_%02d%s",
             FILE_DIRECTORY, FILE_PREFIX, t->tm_year + 1900, t->tm_mon + 1, t->tm_mday, FILE_EXTENSION);
}

// 파일이 오늘 날짜 파일인지 확인
int is_valid_today_file(const char *filepath) {
    char today_filepath[256];
    get_today_filepath(today_filepath, sizeof(today_filepath));
    return strcmp(filepath, today_filepath) == 0;
}

// 데이터를 오늘 날짜의 파일로 저장
void save_stock_info_to_file(const void *data, size_t size) {
    char today_filepath[256];
    get_today_filepath(today_filepath, sizeof(today_filepath));

    FILE *file = fopen(today_filepath, "wb");  // 바이너리 모드로 저장
    if (file == NULL) {
        perror("[KRX-Save] Failed to open file for writing");
        return;
    }

    size_t written = fwrite(data, 1, size, file);
    fclose(file);

    if (written == size) {
        printf("[KRX-Save] Data saved successfully\n");
    } else {
        perror("[KRX-Save] Failed to write full data to file");
    }
}

// 파일을 메모리 매핑하여 파이프에 전송
void send_file_data_to_pipe(mkq_thread *args, int pipe_write) {
    mpt_stock_infos mpt_data;
    mpt_data.hdr.tr_id = MOT_STOCK_INFOS;
    mpt_data.hdr.length = sizeof(mpt_stock_infos);
    mpt_data.oms_sock = args->request->oms_sock;

    int fd = open(args->today_filepath, O_RDONLY);
    if (fd == -1) {
        perror("[KRX-Pipe] Failed to open file");
        return;
    }

    struct stat file_stat;
    if (fstat(fd, &file_stat) == -1) {
        perror("[KRX-Pipe] Failed to get file size");
        close(fd);
        return;
    }

    size_t file_size = file_stat.st_size;
    if (file_size == 0) {
        printf("[KRX-Pipe] File is empty, skipping transmission.\n");
        close(fd);
        return;
    }

    void *mapped_data = mmap(NULL, file_size, PROT_READ, MAP_PRIVATE, fd, 0);
    if (mapped_data == MAP_FAILED) {
        perror("[KRX-Pipe] Failed to map file to memory");
        close(fd);
        return;
    }

    size_t copy_size = file_size < sizeof(mpt_data.body) ? file_size : sizeof(mpt_data.body);
    memcpy(mpt_data.body, mapped_data, copy_size);

    pthread_mutex_lock(&pipe_mutex);
    if (write(pipe_write, &mpt_data, sizeof(mpt_stock_infos)) == -1) {
        perror("[KRX-Pipe] Failed to write data to pipe");
    } else {
        printf("[KRX-Pipe] Sent stock info data to pipe successfully\n");
    }
    pthread_mutex_unlock(&pipe_mutex);

    munmap(mapped_data, file_size);
    close(fd);
}

void *handle_mkq_stock_infos(void *arg) {
    mkq_thread *args = (mkq_thread *)arg;

    if (access(args->today_filepath, F_OK) == 0 && is_valid_today_file(args->today_filepath)) {
        send_file_data_to_pipe(args, args->pipe_write);
    } else {
        printf("[MKQ Thread] No valid file found for today.\n");
    }

    free(args->request);
    free(args->today_filepath);
    free(args);
    pthread_exit(NULL);
}

mkq_thread *create_mkq_thread_args(int pipe_write, char *today_filepath, void *buffer, size_t length) {
    mkq_thread *args = malloc(sizeof(mkq_thread));
    if (args == NULL) {
        perror("[MKQ Thread] Failed to allocate memory for MKQ_thread arguments");
        return NULL;
    }

    memset(args, 0, sizeof(mkq_thread)); 
    args->pipe_write = pipe_write;
    
    args->today_filepath = strdup(today_filepath); 
    if (args->today_filepath == NULL) {
        perror("[MKQ Thread] Failed to allocate memory for today_filepath");
        free(args);
        return NULL;
    }

    args->request = malloc(length);
    if (args->request == NULL) {
        perror("[MKQ Thread] Failed to allocate memory for MKQ_data");
        free(args->today_filepath);
        free(args);
        return NULL;
    }

    // 버퍼 복사
    memcpy(args->request, buffer, length);
    return args;
}

void *handle_kmt_stock_infos(void *arg) {
    kmt_thread *args = (kmt_thread *)arg;
    save_stock_info_to_file(args->data->body, sizeof(args->data->body));

    free(args->data);
    free(args);
    pthread_exit(NULL);
}

kmt_thread *create_kmt_thread_args(void *buffer, size_t length) {
    kmt_thread *args = malloc(sizeof(kmt_thread));
    if (args == NULL) {
        perror("[KMT Thread] Failed to allocate memory for KMT_thread arguments");
        return NULL;
    }

    memset(args, 0, sizeof(kmt_thread)); 
    args->data = malloc(length);

    if (args->data == NULL) {
        perror("[KMT Thread] Failed to allocate memory for KMT_data");
        free(args);
        return NULL;
    }

    memcpy(args->data, buffer, length);
    return args;
}

void init_stock_info_request(int krx_sock) {
    mkq_stock_infos mkq_data;
    
    memset(&mkq_data, 0, sizeof(mkq_stock_infos));
    mkq_data.hdr.tr_id = MKQ_STOCK_INFOS;
    mkq_data.hdr.length = sizeof(mkq_stock_infos);

    char data[512] = "huhuhuhuhuh";

    pthread_mutex_lock(&socket_mutex); // 소켓 동기화 시작
    if (send(krx_sock, &data, sizeof(data), 0) == -1) {
        perror("[INIT] Failed to send data to KRX socket");
    } else {
        printf("[INIT] Data sent to KRX socket successfully.\n");
    }
    pthread_mutex_unlock(&socket_mutex); // 소켓 동기화 종료
}

int handle_krx(int krx_sock, int pipe_write, int pipe_read) {
    

    // Message Queue 생성
    struct mq_attr attr = {0};
    attr.mq_flags = 0;
    attr.mq_maxmsg = MQ_MAX_MSG;
    attr.mq_msgsize = MQ_MSG_SIZE;
    attr.mq_curmsgs = 0;

    mqd_t mq = mq_open(MQ_NAME, O_CREAT | O_RDWR, 0644, &attr);
    if (mq == (mqd_t)-1) {
        perror("[KRX] Failed to create message queue");
        exit(EXIT_FAILURE);
    }

    // 고정 스레드 생성
    pthread_t market_thread;

    if (pthread_create(&market_thread, NULL, handle_current_market_price, &pipe_write) != 0) {
        perror("[KRX] Failed to create market price thread");
        mq_close(mq);
        mq_unlink(MQ_NAME);
        exit(EXIT_FAILURE);
    }

    pthread_detach(market_thread);

    // epoll 관측 구간
    int epoll_fd, nfds;
    struct epoll_event ev, events[MAX_EVENTS];

    // epoll 파일 디스크립터 생성
    if ((epoll_fd = epoll_create1(0)) == -1) {
        perror("epoll_create1 failed");
        exit(EXIT_FAILURE);
    }

    // KRX 소켓을 epoll에 추가
    ev.events = EPOLLIN | EPOLLET;
    ev.data.fd = krx_sock;
    if (epoll_ctl(epoll_fd, EPOLL_CTL_ADD, krx_sock, &ev) == -1) {
        perror("epoll_ctl: krx_sock");
        exit(EXIT_FAILURE);
    }

    // 파이프 읽기 끝을 epoll에 추가
    ev.events = EPOLLIN | EPOLLET;
    ev.data.fd = pipe_read;
    if (epoll_ctl(epoll_fd, EPOLL_CTL_ADD, pipe_read, &ev) == -1) {
        perror("epoll_ctl: pipe_read");
        exit(EXIT_FAILURE);
    }

    printf("[KRX] epoll initialized and monitoring started.\n");

    char krx_buffer[BUFFER_SIZE];
    size_t krx_buffer_offset = 0;

    char pipe_buffer[BUFFER_SIZE];
    size_t pipe_buffer_offset = 0;

    char today_filepath[256];
    get_today_filepath(today_filepath, sizeof(today_filepath));

    // 초기 주식 정보 파일 저장
    if (access(today_filepath, F_OK) != 0 || !is_valid_today_file(today_filepath)) {
        init_stock_info_request(krx_sock);
    }

    while (1) {
        // epoll 대기
        nfds = epoll_wait(epoll_fd, events, MAX_EVENTS, -1);
        if (nfds == -1) {
            perror("epoll_wait failed");
            return EXIT_FAILURE;
        }

        // 이벤트 처리
        for (int i = 0; i < nfds; i++) {
            int fd = events[i].data.fd;
            if (fd == krx_sock) { // KRX 소켓에서 데이터 수신
                ssize_t bytes_received = recv(krx_sock,
                                                krx_buffer + krx_buffer_offset,
                                                BUFFER_SIZE - krx_buffer_offset,
                                                0);

                if (bytes_received == -1) {
                    if (errno == EWOULDBLOCK || errno == EAGAIN) {
                        if (krx_buffer_offset == 0) {
                            printf("[KRX-Socket] Buffer is fully processed. Ready to send.\n");
                        }
                        break;
                    } else {
                        perror("[KRX-Socket] recv() error");
                        close(krx_sock);
                        return EXIT_FAILURE;
                    }
                }

                if (bytes_received == 0) {
                    printf("[KRX-Socket] Connection closed by KRX server. Notifying parent process...\n");
                    close(krx_sock);
                    return EXIT_FAILURE;
                }

                krx_buffer_offset += bytes_received;

                // 버퍼 내 데이터 처리
                while (krx_buffer_offset >= sizeof(hdr)) {
                    hdr *header = (hdr *)krx_buffer;
                    size_t total_length = header->length;

                    // 데이터가 부족하면 다음 수신을 기다림
                    if (krx_buffer_offset < total_length) {
                        break;
                    }

                    // 요청 처리
                    int tr_id = header->tr_id;
                    printf("[KRX-Socket] Received request with tr_id: %d, length: %d\n", tr_id, header->length);

                    switch (tr_id) {
                        case KMT_CURRENT_MARKET_PRICES: {
                            // Message Queue에 데이터 추가
                            if (mq_send(mq, krx_buffer, total_length, 0) == -1) {
                                perror("[KRX-Socket] Failed to send data to message queue");
                            } else {
                                printf("[KRX-Socket] Data sent to message queue.\n");
                            }
                            break;
                        }

                        case KMT_STOCK_INFOS: {
                            kmt_thread *args = create_kmt_thread_args(krx_buffer, header->length);
                            if (args == NULL) {
                                continue; // 메모리 할당 실패 시 다음 루프
                            }
                            
                            pthread_t request_thread;
                            if (pthread_create(&request_thread, NULL, handle_kmt_stock_infos, args) != 0) {
                                perror("[KRX-Socket] Failed to create KMT_thread");
                                free(args);
                                continue;
                            }
                            pthread_detach(request_thread);
                            break;
                        }

                        default:
                            printf("[KRX-Socket] Unknown tr_id: %d\n", tr_id);
                            break;
                    }

                    memmove(krx_buffer, krx_buffer + total_length, krx_buffer_offset - total_length);
                    krx_buffer_offset -= total_length;
                }
            } else if (fd == pipe_read) { // 파이프에서 데이터 수신
                ssize_t bytes_received = read(pipe_read,
                                                pipe_buffer + pipe_buffer_offset,
                                                BUFFER_SIZE - pipe_buffer_offset);
                if (bytes_received == -1) {
                    if (errno == EAGAIN || errno == EWOULDBLOCK) {
                        if (pipe_buffer_offset == 0) {
                            printf("[KRX-Pipe] Buffer is fully processed. Ready to send.\n");
                        }
                        break;
                    } else {
                        perror("[KRX-Pipe] read() error");
                        break;
                    }
                }
                if (bytes_received == 0) {
                    printf("[KRX-Pipe] EOF on pipe.\n");
                    break;
                }

                pipe_buffer_offset += bytes_received;
                while (pipe_buffer_offset >= sizeof(hdr)) {
                    hdr *header = (hdr *)pipe_buffer;
                    size_t total_length = header->length;

                    // 데이터가 부족하면 다음 수신을 기다림
                    if (pipe_buffer_offset < total_length) {
                        break;
                    }

                    // 요청 처리
                    int tr_id = header->tr_id;
                    printf("[KRX-Pipe] Received request with tr_id: %d, length: %d\n", tr_id, header->length);

                    switch (tr_id) {
                        case MKQ_STOCK_INFOS: { //tr_id: omq_stock_infos와 동일 (mpq_stock_infos)
                            mkq_thread *args = create_mkq_thread_args(pipe_write, today_filepath, pipe_buffer, header->length);

                            pthread_t request_thread;
                            if (pthread_create(&request_thread, NULL, handle_mkq_stock_infos, args) != 0) {
                                perror("[KRX-Socket] Failed to create MKQ_thread");
                                free(args);
                                continue;
                            }
                            pthread_detach(request_thread);
                            break;
                        }
                        default:
                            printf("[KRX-Pipe] Unknown tr_id: %d\n", tr_id);
                            break;
                    }
                    
                    memmove(pipe_buffer, pipe_buffer + total_length, pipe_buffer_offset - total_length);
                    pipe_buffer_offset -= total_length;
                }
            }
        }
    }

    mq_close(mq);
    mq_unlink(MQ_NAME);
    close(krx_sock);
    close(epoll_fd);
    close(pipe_read);
    
    return EXIT_SUCCESS;

}