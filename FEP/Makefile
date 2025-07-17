# 컴파일러 및 플래그
CC = gcc
CFLAGS = -Wall -Wextra -g -I./include/headers
LDFLAGS = -I/usr/include/mysql -L/usr/lib64/mysql -lmysqlclient -lrt -lpthread

# 실행 파일 이름
TARGETS = oms_listener krx_sender krx_listener db_updator

# 소스 파일 및 헤더 파일 경로
OMS_LISTENER = ./oms_to_krx/oms_listener.c
KRX_SENDER = ./oms_to_krx/krx_sender.c
KRX_LISTENER = ./krx_to_oms/krx_listener.c
DB_UPDATOR = ./krx_to_oms/db_updator.c

HEADERS = ./include/envs.h ./include/oms_fep_krx_struct.h


# 기본 빌드 타겟
all: $(TARGETS)

# kmt_server 실행 파일 생성 규칙
oms_listener: $(OMS_LISTENER) $(HEADERS)
	$(CC) $(CFLAGS) $(OMS_LISTENER) -o $@ $(LDFLAGS)

krx_sender: $(KRX_SENDER) $(HEADERS)
	$(CC) $(CFLAGS) $(KRX_SENDER) -o $@ $(LDFLAGS)

krx_listener: $(KRX_LISTENER) $(HEADERS)
	$(CC) $(CFLAGS) $(KRX_LISTENER) -o $@ $(LDFLAGS)

db_updator: $(DB_UPDATOR) $(HEADERS)
	$(CC) $(CFLAGS) $(DB_UPDATOR) -o $@ $(LDFLAGS)

run: $(TARGETS)
	@echo "Running all targets..."
	@for target in $(TARGETS); do ./$$target & done; wait

# 정리(clean) 규칙
clean:
	rm -f $(TARGETS)

# 재빌드 규칙
rebuild: clean all
