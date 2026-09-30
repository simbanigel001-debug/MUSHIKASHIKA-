import { Shift, store } from './db';

const FARE_PER_PASSENGER = 1.50;
const DRIVER_COMMISSION_RATE = 0.20; // 20% to Driver
const RANK_MARSHAL_FEE_RATE = 0.10;  // 10% Rank Fee

export interface SettlementResult {
  batchGross: number;
  driverCut: number;
  rankCut: number;
  ownerCut: number;
}

export function calculateDepartureSettlement(passengerCount: number): SettlementResult {
  const batchGross = passengerCount * FARE_PER_PASSENGER;
  const driverCut = batchGross * DRIVER_COMMISSION_RATE;
  const rankCut = batchGross * RANK_MARSHAL_FEE_RATE;
  const ownerCut = batchGross - (driverCut + rankCut);

  return { batchGross, driverCut, rankCut, ownerCut };
}

export function processRankDeparture(shiftId: string, passengerCount: number): Shift {
  const shift = store.getShift(shiftId);
  if (!shift) throw new Error(`Shift ${shiftId} not found`);
  if (shift.status === 'CLOSED') throw new Error(`Shift ${shiftId} is closed`);

  const settlement = calculateDepartureSettlement(passengerCount);

  shift.grossFare += settlement.batchGross;
  shift.driverCommission += settlement.driverCut;
  shift.rankFee += settlement.rankCut;
  shift.ownerNetPayout += settlement.ownerCut;
  shift.departures.push({
    count: passengerCount,
    gross: settlement.batchGross,
    timestamp: Date.now()
  });

  store.saveShift(shift);
  return shift;
}
