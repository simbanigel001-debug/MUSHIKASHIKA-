// apps/crew-app/src/shift-engine.ts
import { mockDb } from '../../../shared/database/emulator.ts';
import { FinanceEngine } from './finance-engine.ts';

export interface ShiftSummaryReport {
  shiftId: string;
  driverId: string;
  conductorId: string;
  startTime: string;
  endTime: string;
  finalTrustScore: number;
  financials: ReturnType<typeof FinanceEngine.getShiftFinancials>;
  status: 'COMPLETED';
}

export class ShiftEngine {
  private static activeShifts: Map<string, any> = new Map();

  static closeShift(shiftId: string): ShiftSummaryReport | { error: string } {
    const shift = mockDb.shifts.get(shiftId);
    if (!shift) return { error: 'SHIFT_NOT_FOUND' };

    const financials = FinanceEngine.getShiftFinancials(shiftId);
    const finalTrustScore = mockDb.trustScores.get(shift.driverId) || 80;

    const summary: ShiftSummaryReport = {
      shiftId,
      driverId: shift.driverId,
      conductorId: shift.conductorId,
      startTime: shift.startTime,
      endTime: new Date().toISOString(),
      finalTrustScore,
      financials,
      status: 'COMPLETED'
    };

    // Mark shift completed in store
    mockDb.shifts.set(shiftId, { ...shift, status: 'COMPLETED', summary });
    return summary;
  }
}
