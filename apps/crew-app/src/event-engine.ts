// event-engine.ts
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

  /**
   * Register an incoming SSE HTTP connection
   */
  static addClient(res: ServerResponse) {
    this.clients.add(res);
  }

  /**
   * Remove a disconnected client
   */
  static removeClient(res: ServerResponse) {
    this.clients.delete(res);
  }

  /**
   * Publish location updates to Redis cache and broadcast to all active SSE clients
   */
  static publishLocation(point: TelemetryPoint) {
    // 1. Update in-memory Redis Geo cache
    mockRedis.set(`location:${point.shiftId}`, JSON.stringify(point));

    // 2. Broadcast event to connected clients
    const eventData = `data: ${JSON.stringify({ type: 'TELEMETRY_UPDATE', payload: point })}\n\n`;
    
    for (const client of this.clients) {
      client.write(eventData);
    }
  }

  /**
   * Broadcast rank clearance and trust updates
   */
  static broadcastClearance(clearanceData: object) {
    const eventData = `data: ${JSON.stringify({ type: 'CLEARANCE_UPDATE', payload: clearanceData })}\n\n`;
    
    for (const client of this.clients) {
      client.write(eventData);
    }
  }
}
