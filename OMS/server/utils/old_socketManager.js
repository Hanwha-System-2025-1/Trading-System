// const net = require('net');

// const mciSocket = new net.Socket();
// const fepSocket = new net.Socket();

// function initializeSockets() {
//   const mciHost = '3.35.134.101'
//   const mciPort = 8081

//   const fepHost = '3.35.106.137'
//   const fepPort = 8080

//   // MCI 서버 소켓 초기화
//   mciSocket.connect(mciPort, mciHost, () => {
//     console.log(`Connected to MCI server at ${mciHost}:${mciPort}`);
//   });

//   mciSocket.on('error', (err) => {
//     console.error('MCI socket error:', err.message);
//   });

// //   mciSocket.on('close', () => {
// //     console.log('MCI socket closed');
// //   });

//   // FEP 서버 소켓 초기화
//   fepSocket.connect(fepPort, fepHost, () => {
//     console.log(`Connected to FEP server at ${fepHost}:${fepPort}`);
//   });

//   fepSocket.on('error', (err) => {
//     console.error('FEP socket error:', err.message);
//   });

// //   fepSocket.on('close', () => {
// //     console.log('FEP socket closed');
// //   });
// }

// function getMciSocket() {
//   return mciSocket;
// }

// function getFepSocket() {
//   return fepSocket;
// }

// module.exports = {
//   initializeSockets,
//   getMciSocket,
//   getFepSocket,
// };
