import { mockDb, mockRedis } from '../../../shared/database/emulator.ts';

export interface LocationPayload {
  shiftId: string;
  lat: number;
  lng: number;
  speed: number;
  timestamp: string;
}

export class RealtimeEngine {
  // Simulate active WebSocket connection pool
  private static connections = new Set<string>();

  static connect(clientId: string) {
    this.connections.add(clientId);
    console.log(`[WS CONNECTED] Client: ${clientId}`);
  }

  static publishLocation(payload: LocationPayload) {
    // 1. Check if shift exists in DB
    const shift = mockDb.shifts.get(payload.shiftId);
    if (!shift) {
      console.log(`[WS ERROR] Shift ${payload.shiftId} not found!`);
      return false;
    }

    // 2. Cache current location state in Redis (latest point)
    const geoKey = `location:${payload.shiftId}`;
    mockRedis.set(geoKey, JSON.stringify({ lat: payload.lat, lng: payload.lng, speed: payload.speed }));

    // 3. Broadcast to all active listener connections
    console.log(`[WS BROADCAST] Shift ${payload.shiftId} Location -> Lat: ${payload.lat}, Lng: ${payload.lng} (${payload.speed} km/h)`);
    return true;
  }
}
