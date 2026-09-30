import crypto from 'crypto';

export interface Shift {
  shiftId: string;
  driverId: string;
  vehicleReg: string;
  status: 'ACTIVE' | 'CLOSED';
  grossFare: number;
  driverCommission: number;
  rankFee: number;
  ownerNetPayout: number;
  departures: Array<{ count: number; gross: number; timestamp: number }>;
}

export interface SettlementSummary {
  totalGross: number;
  totalDriverCommission: number;
  totalRankFees: number;
  totalOwnerPayout: number;
}

class SystemStore {
  private shifts: Map<string, Shift> = new Map();
  public readonly hmacSecret = 'kombi-rank-super-secret-key-2026';

  constructor() {
    // Seed initial demo shift
    this.shifts.set('shift-998', {
      shiftId: 'shift-998',
      driverId: 'drv-101',
      vehicleReg: 'ABK-4092',
      status: 'ACTIVE',
      grossFare: 0,
      driverCommission: 0,
      rankFee: 0,
      ownerNetPayout: 0,
      departures: []
    });
  }

  getShift(id: string): Shift | undefined {
    return this.shifts.get(id);
  }

  getAllShifts(): Shift[] {
    return Array.from(this.shifts.values());
  }

  saveShift(shift: Shift): void {
    this.shifts.set(shift.shiftId, shift);
  }

  getAggregateFinancials(): SettlementSummary {
    return Array.from(this.shifts.values()).reduce(
      (acc, s) => {
        acc.totalGross += s.grossFare;
        acc.totalDriverCommission += s.driverCommission;
        acc.totalRankFees += s.rankFee;
        acc.totalOwnerPayout += s.ownerNetPayout;
        return acc;
      },
      { totalGross: 0, totalDriverCommission: 0, totalRankFees: 0, totalOwnerPayout: 0 }
    );
  }

  generateHmac(shiftId: string): string {
    return crypto.createHmac('sha256', this.hmacSecret).update(shiftId).digest('hex');
  }
}

export const store = new SystemStore();
