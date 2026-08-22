import WebSocket from 'ws';
import { TelephonyAdapter } from './base';
import { PlivoAdapter } from './plivo';

export class TelephonyAdapterFactory {
  /**
   * Instantiate the appropriate TelephonyAdapter based on the provider string.
   * @param provider 'plivo' or other future providers like 'twilio'
   * @param ws The upgraded WebSocket connection.
   */
  static create(provider: string, ws: WebSocket): TelephonyAdapter {
    const formattedProvider = provider.toLowerCase();
    
    switch (formattedProvider) {
      case 'plivo':
        return new PlivoAdapter(ws);
      default:
        throw new Error(`Unsupported telephony provider: ${provider}`);
    }
  }
}
