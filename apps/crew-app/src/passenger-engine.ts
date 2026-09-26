// apps/crew-app/src/passenger-engine.ts
export interface BoardingPass {
  passId: string;
  shiftId: string;
  rankId: string;
  seatNumber: number;
  fareAmount: number;
  paymentMethod: 'ECOCASH' | 'INNBUCKS' | 'CASH';
  status: 'RESERVED' | 'PAID' | 'BOARDED';
  timestamp: string;
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
      status: 'PAID',
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
}
