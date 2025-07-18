#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <poll.h>
#include <arpa/inet.h>
#include <netinet/in.h>
#include <fcntl.h> // For open()
#include <errno.h>
#include <mqueue.h>
#include <oms_fep_krx_struct.h>
#include <envs.h>
#include <mysql/mysql.h>
#include <pthread.h>  // For threads

// shared memory
#include <sys/mman.h>
#include <sys/stat.h>
#include <sys/types.h>

//log
#include <stdarg.h>
#include <time.h>


typedef struct {
    int wc; // Write counter
} W_count;

#define QUEUE_NAME "/wc_queue"
#define SUBMIT_QUEUE_NAME "/submit_queue"
#define KRX_CLOSED_QUE "/krx_closed_que"  // Message queue name

// socket
#define MAX_CLIENTS 20
#define BUFFER_SIZE 1024

#define LOG_FILE_PATH "/home/ubuntu/logs/oms_listener.log"
#define ORDER_TIME_FORMAT "%Y%m%d%H%M%S"


FILE *log_file = NULL;

// Global variables for sockets
int client_sockets[MAX_CLIENTS] = {0}; // Track client sockets

// Function to close all active sockets
void disconnect_clients() {
    log_message("INFO", "socket", "Disconnecting all clients connected to FEP_OMS_R_PORT...\n");

    for (int i = 0; i < MAX_CLIENTS; i++) {
        if (client_sockets[i] > 0) {
            close(client_sockets[i]);  // Close the socket
            client_sockets[i] = -1;  // Mark as closed
        }
    }

    log_message("INFO", "socket", "All client connections closed.\n");
}

// Thread function to monitor the KRX_CLOSED_QUE
void *monitor_krx_closed_queue(void *arg) {
    mqd_t krx_mq;
    struct mq_attr krx_attr;
    krx_attr.mq_flags = 0;
    krx_attr.mq_maxmsg = 10;  // Maximum number of messages in the queue
    krx_attr.mq_msgsize = sizeof(int);  // Message size
    krx_attr.mq_curmsgs = 0;

    // Open the message queue
    krx_mq = mq_open(KRX_CLOSED_QUE, O_CREAT | O_RDONLY, 0644, &krx_attr);
    if (krx_mq == -1) {
        log_message("ERROR", "mq", "Failed to open krx_closed_que\n");
        return NULL;
    }

    log_message("INFO", "mq", "Monitoring krx_closed_que for disconnection events...\n");

    int received_value;
    while (1) {
        ssize_t bytes_read = mq_receive(krx_mq, (char *)&received_value, sizeof(int), NULL);
        if (bytes_read == -1) {
            log_message("ERROR", "mq", "mq_receive failed in krx_closed_que\n");
            continue;
        }

        log_message("INFO", "mq", "Received disconnect signal from KRX_CLOSED_QUE\n");

        // Close all client connections
        disconnect_clients();
    }

    mq_close(krx_mq);
    return NULL;
}

// Initialize logging
void init_log() {
    mkdir("/home/ubuntu/logs", 0777);
    log_file = fopen(LOG_FILE_PATH, "a");
    if (!log_file) {
        perror("Failed to open log file");
        exit(EXIT_FAILURE);
    }
}

// Log function with level and module
void log_message(const char *level, const char *module, const char *format, ...) {
    if (!log_file) return;

    time_t now = time(NULL);
    struct tm *tm_info = localtime(&now);
    char time_buffer[20];

    strftime(time_buffer, sizeof(time_buffer), "%Y-%m-%d %H:%M:%S", tm_info);
    fprintf(log_file, "[%s] [%s] [%s] ", time_buffer, level, module);

    va_list args;
    va_start(args, format);
    vfprintf(log_file, format, args);
    va_end(args);

    fflush(log_file);
}

// Function to clean up the log file
void close_log() {
    if (log_file) {
        fflush(log_file);  // Ensure all data is written before closing
        fclose(log_file);
    }
}

// Function to print the elements of fot_order_is_submitted
void print_fot_order_is_submitted(const fot_order_is_submitted *submit_result) {
    log_message("DEBUG", "order", "  Transaction ID: %d\n", submit_result->hdr.tr_id);
    log_message("DEBUG", "order","  Length: %d\n", submit_result->hdr.length);
    log_message("DEBUG", "order","Transaction Code: %s\n", submit_result->transaction_code);
    log_message("DEBUG", "order","User ID: %s\n", submit_result->user_id);
    log_message("DEBUG", "order","Response Time: %s\n", submit_result->time);
    log_message("DEBUG", "order","Reject Code: %s\n", submit_result->reject_code);
}

void save_order_to_file_bin(fkq_order *order, FILE *file) {
        fwrite(order, sizeof(fkq_order), 1, file);    
        fflush(file);
}

void send_error_to_oms(fkq_order *order, char *reject_code, int sock){
    log_message("TEST", "loadtest","ad\n");
    fot_order_is_submitted tx_result;
    memset(&tx_result, 0, sizeof(fot_order_is_submitted)); // Initialize the struct
    log_message("TEST", "loadtest","ae\n");
    tx_result.hdr.tr_id = 10;
    tx_result.hdr.length = sizeof(fot_order_is_submitted);

    strncpy(tx_result.transaction_code, order->transaction_code, sizeof(tx_result.transaction_code));
    tx_result.transaction_code[sizeof(tx_result.transaction_code) - 1] = '\0'; // Null-terminate
    log_message("TEST", "loadtest","af\n");
    strncpy(tx_result.user_id, order->user_id, sizeof(tx_result.user_id));
    tx_result.user_id[sizeof(tx_result.user_id) - 1] = '\0'; // Null-terminate
    log_message("TEST", "loadtest","a\n");    
    strncpy(tx_result.time, order->order_time, sizeof(tx_result.time));
    tx_result.time[sizeof(tx_result.time) - 1] = '\0'; // Null-terminate

    strncpy(tx_result.reject_code, reject_code, sizeof(tx_result.reject_code));
    tx_result.reject_code[sizeof(tx_result.reject_code) - 1] = '\0'; // Null-terminate

    ssize_t bytes_sent = send(sock, &tx_result, sizeof(fot_order_is_submitted), 0);
    if (bytes_sent < 0) {
        log_message("ERROR", "socket", "Failed to send data to connected socket");
    } else if (bytes_sent == 0) {
        log_message("ERROR", "socket", "Peer has closed the connection. Sending might not work.");
    } else if (bytes_sent < sizeof(fot_order_is_submitted)) {
        log_message("ERROR", "socket", "Partial data sent. Expected %lu bytes, sent %ld bytes.\n",
                sizeof(fot_order_is_submitted), bytes_sent);
    } else {
        log_message("INFO", "socket", "Successfully sent response to OMS via connected socket. Sent %ld bytes.\n", bytes_sent);
    }

    log_message("INFO", "validation", "sent oms back reject code: %s.\n", reject_code);
    // fflush(log_file);
}

int is_order_time_future(const char *order_time) {
    struct tm order_tm = {0};
    time_t order_epoch, current_time;

    // Convert order_time string to struct tm
    if (strptime(order_time, ORDER_TIME_FORMAT, &order_tm) == NULL) {
        fprintf(stderr, "Error parsing order_time: %s\n", order_time);
        return -1; // Error case
    }

    // Convert struct tm to epoch time
    order_epoch = mktime(&order_tm);
    if (order_epoch == -1) {
        fprintf(stderr, "Error converting order_time to epoch\n");
        return -1;
    }

    // Get the current epoch time
    current_time = time(NULL);
    if (current_time == -1) {
        fprintf(stderr, "Error getting current time\n");
        return -1;
    }

    // Check if current time is more than 2 second past order time
    if (order_epoch > current_time + 2) {
        return 1; // order time is future => error
    } else {
        return 0; // within range
    }
}

int main() {

    init_log();

    // Create thread to monitor KRX_CLOSED_QUE
    pthread_t krx_thread;
    if (pthread_create(&krx_thread, NULL, monitor_krx_closed_queue, NULL) != 0) {
        log_message("ERROR", "thread", "Failed to create krx_closed_que monitoring thread\n");
        return EXIT_FAILURE;
    }

    log_message("INFO", "thread", "KRX_CLOSED_QUE monitoring thread started successfully\n");

    // mysql connection
    MYSQL *conn;
    MYSQL_RES *res;
    MYSQL_ROW row;
    
    //set timezone as KST
    setenv("TZ", "Asia/Seoul", 1);
    tzset(); // Apply the changes

    // MySQL 초기화
    conn = mysql_init(NULL);
    if (conn == NULL) {
        log_message("ERROR", "db", "mysql_init() failed\n");
        log_message("ERROR", "db", "process will be closed...\n");
        // fflush(log_file);
        return EXIT_FAILURE;
    }

    // 데이터베이스 연결
    if (mysql_real_connect(conn, MYSQL_IP, MYSQL_USER, MYSQL_PW, MYSQL_DBNAME, 0, NULL, 0) == NULL) {
        log_message("ERROR", "db", "mysql_real_connect() failed: %s\n", mysql_error(conn));
        mysql_close(conn);
        log_message("ERROR", "db", "process will be closed...\n");
        fflush(log_file);
        return EXIT_FAILURE;
    }

    // message queue
    mqd_t mq, submit_mq;
    struct mq_attr attr = {0};
    attr.mq_flags = 0;
    attr.mq_maxmsg = 200;   // Maximum number of messages in the queue
    attr.mq_msgsize = sizeof(int); // Maximum size of each message in bytes
    attr.mq_curmsgs = 0;   // Current number of messages in the queue
    
    struct mq_attr submit_attr = {0};

    // mmap memory code
    const char *shared_mem_name = "/W_count";
    const size_t shared_mem_size = sizeof(W_count);
    int is_initialized = 0; // Flag to track if shared memory is newly created

   // Create or open the shared memory object
    int shm_fd = shm_open(shared_mem_name, O_CREAT | O_RDWR | O_EXCL, 0666);
    if (shm_fd == -1) {
        if (errno == EEXIST) {
            // Shared memory already exists
            shm_fd = shm_open(shared_mem_name, O_RDWR, 0666);
            if (shm_fd == -1) {
                log_message("ERROR", "shm", "shm_open failed");
                log_message("ERROR", "shm", "process will be closed...\n");
                exit(EXIT_FAILURE);
            }
        } else {
            log_message("ERROR", "shm", "shm_open failed");
            log_message("ERROR", "shm", "process will be closed...\n");
            exit(EXIT_FAILURE);
        }
    } else {
        // This is the first time the shared memory is being created
        is_initialized = 1;
    }

    // Set size of the shared memory object
    if (ftruncate(shm_fd, shared_mem_size) == -1) {
        log_message("ERROR", "shm","ftruncate failed");
        close(shm_fd);
        shm_unlink(shared_mem_name);
        log_message("ERROR", "shm", "process will be closed...\n");
        exit(EXIT_FAILURE);
    }

    // Map the shared memory object
    W_count *w_count = mmap(NULL, shared_mem_size, PROT_READ | PROT_WRITE, MAP_SHARED, shm_fd, 0);
    if (w_count == MAP_FAILED) {
        log_message("ERROR", "shm","mmap failed");
        close(shm_fd);
        shm_unlink(shared_mem_name);
        log_message("ERROR", "shm", "process will be closed...\n");
        exit(EXIT_FAILURE);
    }

    // Initialize shared memory if it is newly created
    if (is_initialized) {
        w_count->wc = 0; // Initialize write counter to 0
        log_message("DEBUG", "shm", "Shared memory initialized. wr = %d\n", w_count->wc);
        log_message("DEBUG", "shm","Shared memory initialized. PID: %d\n", getpid());
    } else {
        log_message("DEBUG", "shm", "Shared memory already exists. wc = %d\n", w_count->wc);
    }

    // socket code
    int server_fd, activity;
    struct sockaddr_in address;
    socklen_t addrlen = sizeof(address);

    // Buffer for receiving data
    char buffer[BUFFER_SIZE];

    // Create server socket
    if ((server_fd = socket(AF_INET, SOCK_STREAM, 0)) == 0) {
        log_message("ERROR", "socket", "Socket failed");
        log_message("ERROR", "socket", "process will be closed...\n");
        exit(EXIT_FAILURE);
    }

    // 포트 재사용 옵션 추가
    int opt = 1;
    if (setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt)) < 0) {
        log_message("ERROR", "socket", "setsockopt failed");
        exit(EXIT_FAILURE);
    }

    // Configure server address
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY; // Listen on all network interfaces
    address.sin_port = htons(FEP_OMS_R_PORT);

    // Bind the socket
    if (bind(server_fd, (struct sockaddr *)&address, sizeof(address)) < 0) {
        log_message("ERROR", "socket","Bind failed");
        close(server_fd);
        log_message("ERROR", "socket", "process will be closed...\n");
        exit(EXIT_FAILURE);
    }

    // Start listening
    if (listen(server_fd, MAX_CLIENTS) < 0) {
        log_message("ERROR", "socket", "Listen failed");
        close(server_fd);
        log_message("ERROR", "socket", "process will be closed...\n");
        exit(EXIT_FAILURE);
    }
    // int client_sockets[MAX_CLIENTS] = {0}; // Track client sockets
    log_message("DEBUG", "socket", "Server listening on port %d\n", FEP_OMS_R_PORT);

    // Poll array to monitor multiple file descriptors
    struct pollfd fds[MAX_CLIENTS];

    // Initialize poll array
    fds[0].fd = server_fd;  // Monitor the server socket for new connections
    fds[0].events = POLLIN; // Monitor for incoming data

    for (int i = 1; i < MAX_CLIENTS; i++) {
        fds[i].fd = -1; // Initialize all other file descriptors
    }

    // set file dir structure
    const char *home_dir = getenv("HOME");
    char filepath[256];
    if (home_dir != NULL) {
        snprintf(filepath, sizeof(filepath), "%s/received_data.txt", home_dir);
    } else {
        // Fallback to current directory if $HOME is not set
        strncpy(filepath, "./received_data.txt", sizeof(filepath));
    }
    FILE *file = fopen(filepath, "ab");
    if (file == NULL) {
        log_message("ERROR", "file", "Error opening file");
        return;
    }

    // Open the message queue
    mq = mq_open(QUEUE_NAME, O_CREAT | O_WRONLY, 0644, NULL, &attr);
    if (mq == -1) {
        log_message("ERROR", "mq", "mq_open failed");
        exit(1);
    }
    log_message("DEBUG", "mq","wc queue opened.\n");

     // Open the sender queue
    submit_mq = mq_open(SUBMIT_QUEUE_NAME, O_RDONLY);
    if (submit_mq == -1) {
        log_message("ERROR", "mq","mq_open (submit mq) failed");
        mq_close(mq);
        log_message("ERROR", "mq", "process will be closed...\n");
        exit(EXIT_FAILURE);
    }

      // Get queue attributes
    if (mq_getattr(submit_mq, &submit_attr) == -1) {
        log_message("ERROR", "mq", "mq_getattr");
        mq_close(mq);
        log_message("ERROR", "mq", "process will be closed...\n");
        exit(EXIT_FAILURE);
    }
    log_message("DEBUG", "mq","submit message queue opened.\n");
    
    while (1) {
        // Wait for an event
        activity = poll(fds, MAX_CLIENTS, -1); // Infinite timeout

        if (activity < 0) {
            log_message("ERROR", "socket", "Poll error");
            break;
        }

        // Check if the server socket is ready (new incoming connection)
        if (fds[0].revents & POLLIN) {
            struct sockaddr_in client_addr;
            socklen_t client_addr_len = sizeof(client_addr);
            int client_fd = accept(server_fd, (struct sockaddr *)&client_addr, &client_addr_len);
      
            if (client_fd < 0) {
                log_message("ERROR", "socket", "Accept failed");
                continue;
            }

            log_message("INFO", "socket", "New connection from %s:%d\n",
                   inet_ntoa(address.sin_addr), ntohs(address.sin_port));
            // Add new socket to poll array
            for (int i = 1; i < MAX_CLIENTS; i++) {
                if (fds[i].fd == -1) {
                    fds[i].fd = client_fd;
                    fds[i].events = POLLIN; // Monitor for incoming data
                    // client_sockets[i] = new_socket;
                    break;
                }
            }
        }

        // Check all client sockets for activity
        for (int i = 1; i < MAX_CLIENTS; i++) {
            if (fds[i].fd != -1 && (fds[i].revents & POLLIN)) {
                fkq_order received_order;
                memset(&received_order, 0, sizeof(fkq_order)); // Initialize the struct
                log_message("TEST", "loadtest","aa\n");
                ssize_t bytes_received = recv(fds[i].fd, &received_order, sizeof(received_order), 0);
                log_message("TEST", "loadtest","ab\n");
                if (bytes_received <= 0) {
                    // Connection closed or error
                    log_message("INFO", "socket", "Client disconnected\n");
                    close(fds[i].fd);
                    fds[i].fd = -1;
                // } else if (bytes_received == sizeof(received_order.hdr.length)) {
                } else if (bytes_received == sizeof(received_order)) {
                    log_message("TEST", "loadtest","ac\n");
                    // validation
                    if (received_order.hdr.tr_id !=9 ) { // Example valid range
                        send_error_to_oms(&received_order, "E002", fds[i].fd);
                        continue; // Skip processing
                    } else if (received_order.price < 0){
                        send_error_to_oms(&received_order, "E102", fds[i].fd);
                        continue; // Skip processing
                    } else if (received_order.quantity <= 0){ 
                        send_error_to_oms(&received_order, "E103", fds[i].fd);
                        continue; // Skip processing
                    } else if (!((received_order.order_type != 'B') || (received_order.order_type != 'C') || (received_order.order_type != 'S'))){
                        send_error_to_oms(&received_order, "E104", fds[i].fd);
                        continue; // Skip processing
                    } else if (is_order_time_future(received_order.order_time)){
                        send_error_to_oms(&received_order, "E105", fds[i].fd);
                        continue; // Skip processing
                    } else if ((received_order.order_type == 'C' && strcmp(received_order.original_order, "NA") !=0)) {
                        send_error_to_oms(&received_order, "E106", fds[i].fd);
                        continue; // Skip processing
                    } 
                    log_message("INFO", "order", "Order received successfully.\n");
                    log_message("DEBUG", "order","%d,%d,%s,%s,%s,%s,%c,%d,%s,%d,%s\n",
                            received_order.hdr.tr_id,
                            received_order.hdr.length,
                            received_order.stock_code,
                            received_order.stock_name,
                            received_order.transaction_code,
                            received_order.user_id,
                            received_order.order_type,
                            received_order.quantity,
                            received_order.order_time,
                            received_order.price,
                            received_order.original_order);
                    
                    // db insert
                    // const char *insert_query = "INSERT INTO tx_history (stock_code, stock_name, transaction_code, user_id, order_type, quantity, order_time, price, original_order, status) VALUES (received_order.stock_code, received_order.stock_name, received_order.transaction_code, received_order.user_id, received_order.order_type, received_order.quantity, received_order.order_time, received_order.price, received_order.original_order, 'W')";
                    char insert_query[512];  // Large enough to hold the full query
                    snprintf(insert_query, sizeof(insert_query),
                            "INSERT INTO tx_history (stock_code, stock_name, transaction_code, user_id, order_type, quantity, order_time, price, original_order, status) "
                            "VALUES ('%s', '%s', '%s', '%s', '%c', %d, '%s', %d, '%s', 'W')",
                            received_order.stock_code, received_order.stock_name, received_order.transaction_code,
                            received_order.user_id, received_order.order_type, received_order.quantity,
                            received_order.order_time, received_order.price, received_order.original_order ? received_order.original_order : "NULL");

                        if (mysql_query(conn, insert_query)) {
                            // insert 실패시 에러 반환 로직
                            send_error_to_oms(&received_order, "E101", fds[i].fd);
                            log_message("ERROR", "db", "INSERT query failed: %s\n", mysql_error(conn));

                            continue;
                        }
                    log_message("INFO", "DB", "Data is inserted into DB successfully!\n");
                    // Save the order to file
                    save_order_to_file_bin(&received_order, file);
                    w_count->wc++;
                    log_message("INFO", "shm", "wc increased. wc = %d\n", w_count->wc);

                    //send wc
                    if(mq_send(mq, (char *)&w_count->wc, sizeof(int), 0)==-1){
                        log_message("ERROR", "mq", "mq_send failed: could be mq full");
                        log_message("ERROR", "mq", "process will be closed...\n");
                        exit(1);
                    }           
                    log_message("DEBUG", "mq", "wc msg sent: %d", w_count->wc);   
                    // receive submit_result from queue
                    fot_order_is_submitted submit_result;
                    memset(&submit_result, 0, sizeof(fot_order_is_submitted));

                    ssize_t bytes_read = mq_receive(submit_mq, (char *)&submit_result, submit_attr.mq_msgsize, NULL);

                    // strncpy for comm w javascript
                    fot_order_is_submitted result_for_sending;
                    memset(&result_for_sending, 0, sizeof(fot_order_is_submitted)); // Initialize the struct
                    result_for_sending.hdr.tr_id = submit_result.hdr.tr_id;
                    result_for_sending.hdr.length = submit_result.hdr.length;

                    strncpy(result_for_sending.transaction_code, submit_result.transaction_code, sizeof(result_for_sending.transaction_code));
                    result_for_sending.transaction_code[sizeof(result_for_sending.transaction_code) - 1] = '\0'; // Null-terminate

                    strncpy(result_for_sending.user_id, submit_result.user_id, sizeof(result_for_sending.user_id));
                    result_for_sending.user_id[sizeof(result_for_sending.user_id) - 1] = '\0'; // Null-terminate

                    strncpy(result_for_sending.time, submit_result.time, sizeof(result_for_sending.time));
                    result_for_sending.time[sizeof(result_for_sending.time) - 1] = '\0'; // Null-terminate

                    strncpy(result_for_sending.reject_code, submit_result.reject_code, sizeof(result_for_sending.reject_code));
                    result_for_sending.reject_code[sizeof(result_for_sending.reject_code) - 1] = '\0'; // Null-terminate
                    ////

                    if (bytes_read == -1) {
                        log_message("ERROR", "mq","submit_mq_receive failed");
                        mq_close(submit_mq);
                        log_message("ERROR", "mq", "process will be closed...\n");
                        exit(1);
                    }

                    print_fot_order_is_submitted(&result_for_sending);

                    // send back to oms by connected socket
                    ssize_t bytes_sent = send(fds[i].fd, &result_for_sending, sizeof(fot_order_is_submitted), 0);

                    if (bytes_sent < 0) {
                        log_message("ERROR", "socket", "Failed to send data to connected socket");
                    } else if (bytes_sent < sizeof(fot_order_is_submitted)) {
                        log_message("ERROR", "socket", "Partial data sent. Expected %lu bytes, sent %ld bytes.\n",
                        sizeof(fot_order_is_submitted), bytes_sent);
                    } else {
                        log_message("INFO", "socket", "Successfully sent response to OMS via connected socket. Sent %ld bytes.\n", bytes_sent);
                    }

                } else {
                    send_error_to_oms(&received_order, "E001", fds[i].fd);
                    log_message("ERROR", "socket", "Incomplete data received. Expected %lu bytes, got %ld bytes.\n", sizeof(fkq_order), bytes_received);
                }    
            }
        }
    }

    close(server_fd);
    pthread_join(krx_thread, NULL);

    // Close the message queue
    mq_close(mq);
    mq_close(KRX_CLOSED_QUE);
   // 연결 닫기
    mysql_close(conn);

    return 0;
}