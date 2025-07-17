# 컴파일러 및 플래그
CC = gcc
CFLAGS = -Wall -Wextra -g -I./headers
LDFLAGS = -I/usr/include/mysql -L/usr/lib64/mysql -lmysqlclient

# 실행 파일 이름
TARGETS = kmt_server menu kft_send_server kft_receive_server kft_matching_server transaction_checker

# 소스 파일 및 헤더 파일 경로
KMT_SOURCES = ./stock_system/kmt_server_db.c ./stock_system/db_sql.c
MENU_SOURCES = ./stock_system/hanwha_krx_screen.c ./stock_system/db_sql.c
KFT_SEND_SOURCES = ./order_system/send/send_server.c ./order_system/kft_log.c ./order_system/kft_ipc.c
KFT_RECEIVE_SOURCES = ./order_system/receive/receive_server.c ./order_system/kft_log.c ./order_system/kft_ipc.c
KFT_MATCHING_SOURCES = ./order_system/matching/matching_server.c ./order_system/kft_log.c ./order_system/kft_ipc.c ./order_system/matching/db_sql.c
TRANSACTION_CHECKER_SOURCES = ./matching_system/krx_matching.c

HEADERS = ./headers/krx_messages.h ./headers/kmt_common.h ./headers/kft_log.h ./headers/kft_ipc_db.h ./headers/krx_messages.h


# 기본 빌드 타겟
all: $(TARGETS)

# kmt_server 실행 파일 생성 규칙
kmt_server: $(KMT_SOURCES) $(HEADERS)
	$(CC) $(CFLAGS) $(KMT_SOURCES) -o $@ $(LDFLAGS)

# menu 실행 파일 생성 규칙
menu: $(MENU_SOURCES) $(HEADERS)
	$(CC) $(CFLAGS) $(MENU_SOURCES) -o $@ $(LDFLAGS) -lncursesw

# kft_send_server 실행 파일 생성 규칙
kft_send_server: $(KFT_SEND_SOURCES) $(HEADERS)
	$(CC) $(CFLAGS) $(KFT_SEND_SOURCES) -o $@ $(LDFLAGS)

# kft_receive_server 실행 파일 생성 규칙
kft_receive_server: $(KFT_RECEIVE_SOURCES) $(HEADERS)
	$(CC) $(CFLAGS) $(KFT_RECEIVE_SOURCES) -o $@ $(LDFLAGS)

# kft_matching_server 실행 파일 생성 규칙
kft_matching_server: $(KFT_MATCHING_SOURCES) $(HEADERS)
	$(CC) $(CFLAGS) $(KFT_MATCHING_SOURCES) -o $@ $(LDFLAGS)

# transaction_checker 실행 파일 생성 규칙
transaction_checker: $(TRANSACTION_CHECKER_SOURCES) $(HEADERS)	
	$(CC) $(CFLAGS) $(TRANSACTION_CHECKER_SOURCES) -o $@ $(LDFLAGS)

run: $(TARGETS)
	./$(TARGETS)

# 정리(clean) 규칙
clean:
	rm -f $(TARGETS)

# 재빌드 규칙
rebuild: clean all
