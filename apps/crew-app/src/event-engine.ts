import { ServerResponse } from 'node:http';
import { mockRedis } from '../../../shared/database/emulator.ts';

export interface TelemetryPoint {
  shiftId: string;
  lat: number;
  lng: number;
  speed: number;
  timestamp: string;
}

export class RealtimeEngine {
  private static clients: Set<ServerResponse> = new Set();

  static addClient(res: ServerResponse) {
    this.clients.add(res);
  }

  static removeClient(res: ServerResponse) {
    this.clients.delete(res);
  }

  static publishLocation(point: TelemetryPoint) {
    mockRedis.set(`location:${point.shiftId}`, JSON.stringify(point));
    const eventData = `data: ${JSON.stringify({ type: 'TELEMETRY_UPDATE', payload: point })}\n\n`;
    
    for (const client of this.clients) {
      client.write(eventData);
    }
  }

  static broadcastClearance(clearanceData: object) {
    const eventData = `data: ${JSON.stringify({ type: 'CLEARANCE_UPDATE', payload: clearanceData })}\n\n`;
    
    for (const client of this.clients) {
      client.write(eventData);
    }
  }
}
