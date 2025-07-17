#ifndef ENVS_H
#define ENVS_H

// Queue settings
#define KRX_TO_OMS_QUEUE "krx_to_oms_queue"
#define OMS_TO_KRX_QUEUE "oms_to_krx_queue" 
#define MAX_QUEUE_SIZE 1024                 
#define TIMEOUT_MS 5000                     

// Logging and configuration paths
#define LOG_FILE_PATH "logs/system.log"     
#define CONFIG_FILE_PATH "config/system.cfg" 

// Network settings
#define KRX_IP "hanwha_krx_server"                  
#define KRX_PORT 8088                       
#define FEP_KRX_R_PORT 8089                 

#define OMS_IP "host.docker.internal"                  
#define FEP_OMS_R_PORT 8081                 

// Database settings
#define MYSQL_IP "host.docker.internal"        
#define MYSQL_USER "root"                   
#define MYSQL_PW "ssafy"                     
#define MYSQL_DBNAME "hanwha_mci"                 

#endif // ENVS_H