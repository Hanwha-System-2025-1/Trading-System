const net = require('net');
const { parseResponse } = require('../services/protocolService');

exports.startStockUpdates = () => {
  const client = new net.Socket();
  client.connect(process.env.MCI_PORT, process.env.MCI_HOST, () => {
    console.log('Connected to MCI server for stock updates');
  });

  client.on('data', (data) => {
    const stockData = parseResponse(data);
    console.log('Stock update received:', stockData);
    // TODO: Implement logic to send data to frontend via WebSocket or other methods
  });

  client.on('error', (err) => {
    console.error('Error receiving stock updates:', err.message);
  });

  client.on('close', () => {
    console.log('Stock update connection closed');
  });
};
