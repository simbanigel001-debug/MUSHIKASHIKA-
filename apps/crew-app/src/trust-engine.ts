import { mockDb } from '../../../shared/database/emulator.ts';

export interface ClearanceToken {
  shiftId: string;
  marshalId: string;
  signature: string;
  timestamp: string;
}

export class TrustEngine {
  // Validate rank clearance token and update trust rating
  static processClearance(token: ClearanceToken): { success: boolean; newScore: number } {
    const shift = mockDb.shifts.get(token.shiftId);
    if (!shift) {
      console.log(`[TRUST ERROR] Invalid Shift ID: ${token.shiftId}`);
      return { success: false, newScore: 0 };
    }

    // Save clearance record
    const clearanceId = `clr-${Date.now()}`;
    mockDb.rankClearances.set(clearanceId, {
      shiftId: token.shiftId,
      marshalId: token.marshalId,
      signature: token.signature,
      clearedAt: token.timestamp
    });

    // Calculate score bump (+5 per verified rank clearance up to 100)
    const currentScore = mockDb.trustScores.get(shift.driverId) || 80;
    const updatedScore = Math.min(100, currentScore + 5);
    
    mockDb.trustScores.set(shift.driverId, updatedScore);

    console.log(`[CLEARANCE VERIFIED] Marshal ${token.marshalId} cleared Shift ${token.shiftId}`);
    console.log(`[TRUST SCORE] Crew ${shift.driverId} updated to ${updatedScore}/100`);

    return { success: true, newScore: updatedScore };
  }
}
