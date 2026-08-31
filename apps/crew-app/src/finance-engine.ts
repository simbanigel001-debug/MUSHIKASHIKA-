// apps/crew-app/src/finance-engine.ts
import { mockDb } from '../../../shared/database/emulator.ts';

export interface TripSettlement {
  shiftId: string;
  tripId: string;
  passengerCount: number;
  fareRate: number;
  grossFare: number;
  marshalFee: number;
  netOwnerPayout: number;
  driverCommission: number;
  timestamp: string;
}

export class FinanceEngine {
  private static settlements: TripSettlement[] = [];
  private static DEFAULT_FARE = 1.50; // $1.50 per seat
  private static MARSHAL_FEE_RATE = 0.05; // 5% rank fee
  private static DRIVER_COMMISSION_RATE = 0.20; // 20% driver cut

  static processDepartureSettlement(shiftId: string, passengerCount: number): TripSettlement {
    const grossFare = passengerCount * this.DEFAULT_FARE;
    const marshalFee = Number((grossFare * this.MARSHAL_FEE_RATE).toFixed(2));
    const driverCommission = Number((grossFare * this.DRIVER_COMMISSION_RATE).toFixed(2));
    const netOwnerPayout = Number((grossFare - marshalFee - driverCommission).toFixed(2));

    const settlement: TripSettlement = {
      shiftId,
      tripId: `TRIP-${Date.now()}`,
      passengerCount,
      fareRate: this.DEFAULT_FARE,
      grossFare,
      marshalFee,
      netOwnerPayout,
      driverCommission,
      timestamp: new Date().toISOString()
    };

    this.settlements.push(settlement);
    return settlement;
  }

  static getShiftFinancials(shiftId: string) {
    const shiftTrips = this.settlements.filter(s => s.shiftId === shiftId);
    const totalGross = shiftTrips.reduce((acc, curr) => acc + curr.grossFare, 0);
    const totalOwnerPayout = shiftTrips.reduce((acc, curr) => acc + curr.netOwnerPayout, 0);
    const totalDriverCommission = shiftTrips.reduce((acc, curr) => acc + curr.driverCommission, 0);

    return {
      tripsCompleted: shiftTrips.length,
      totalGross: Number(totalGross.toFixed(2)),
      totalOwnerPayout: Number(totalOwnerPayout.toFixed(2)),
      totalDriverCommission: Number(totalDriverCommission.toFixed(2)),
      recentSettlement: shiftTrips[shiftTrips.length - 1] || null
    };
  }
}
