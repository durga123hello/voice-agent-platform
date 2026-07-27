import dgram from 'dgram';

/**
 * Dynamically finds an available UDP port by binding a temporary socket to port 0
 * and retrieving the assigned port number from the operating system.
 */
export function findFreeUdpPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    
    socket.bind(0, '127.0.0.1', () => {
      const address = socket.address();
      const port = address.port;
      
      socket.close(() => {
        resolve(port);
      });
    });

    socket.on('error', (err) => {
      reject(err);
    });
  });
}
