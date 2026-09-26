// apps/crew-app/src/passenger-engine.ts
import { mockRedis } from '../../../shared/database/emulator.ts';

export interface BoardingPass {
  passId: string;
  shiftId: string;
  rankId: string;
  seatNumber: number;
  fareAmount: number;
  paymentMethod: 'ECOCASH' | 'INNBUCKS' | 'CASH';
  status: 'RESERVED' | 'PAID' | 'BOARDED';
  timestamp: string;
  currentLat?: number;
  currentLng?: number;
}

export class PassengerEngine {
  private static activePasses: Map<string, BoardingPass[]> = new Map();

  static issuePass(shiftId: string, rankId: string, paymentMethod: BoardingPass['paymentMethod']): BoardingPass {
    const shiftPasses = this.activePasses.get(shiftId) || [];
    const seatNumber = shiftPasses.length + 1;

    if (seatNumber > 16) {
      throw new Error('VEHICLE_FULL');
    }

    const pass: BoardingPass = {
      passId: `pass-${Date.now()}-${seatNumber}`,
      shiftId,
      rankId,
      seatNumber,
      fareAmount: 0.50, // Standard Bulawayo Kombi Fare ($0.50 USD)
      paymentMethod,
      status: 'BOARDED',
      timestamp: new Date().toISOString()
    };

    shiftPasses.push(pass);
    this.activePasses.set(shiftId, shiftPasses);
    return pass;
  }

  static getPassengerManifest(shiftId: string): BoardingPass[] {
    return this.activePasses.get(shiftId) || [];
  }

  static getBoardedCount(shiftId: string): number {
    return (this.activePasses.get(shiftId) || []).length;
  }

  /**
   * Tracks a passenger's real-time position using their unique Digital Pass ID
   * maps location directly to the assigned Kombi shift telemetry stream.
   */
  static trackPassenger(passId: string): { pass: BoardingPass | null; liveGeo: any } {
    let foundPass: BoardingPass | null = null;

    // Locate pass across active shifts
    for (const passes of this.activePasses.values()) {
      const match = passes.find(p => p.passId === passId);
      if (match) {
        foundPass = match;
        break;
      }
    }

    if (!foundPass) {
      return { pass: null, liveGeo: null };
    }

    // Resolve Kombi vehicle location from Redis using shiftId
    const vehicleGeoStr = mockRedis.get(`location:${foundPass.shiftId}`);
    const liveGeo = vehicleGeoStr ? JSON.parse(vehicleGeoStr) : null;

    if (liveGeo) {
      foundPass.currentLat = liveGeo.lat;
      foundPass.currentLng = liveGeo.lng;
    }

    return { pass: foundPass, liveGeo };
  }
}
