import * as mediasoup from 'mediasoup';

let worker: mediasoup.types.Worker;
let router: mediasoup.types.Router;

export async function initMediasoup() {
  try {
    worker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort: 10000,
      rtcMaxPort: 10100
    });

    worker.on('died', () => {
      console.error('mediasoup worker died, exiting process in 2 seconds...');
      setTimeout(() => process.exit(1), 2000);
    });

    const mediaCodecs: mediasoup.types.RtpCodecCapability[] = [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        preferredPayloadType: 100
      }
    ];

    router = await worker.createRouter({ mediaCodecs });
    console.log('Mediasoup Worker and Router initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize mediasoup:', error);
    throw error;
  }
}

export function getRouter(): mediasoup.types.Router {
  if (!router) {
    throw new Error('Mediasoup Router has not been initialized yet.');
  }
  return router;
}
