// apps/crew-app/src/export-engine.ts
import { FinanceEngine } from './finance-engine.ts';

export class ExportEngine {
  static generateOwnerCsv(shiftId: string): string {
    const financials = FinanceEngine.getShiftFinancials(shiftId);
    const timestamp = new Date().toISOString();

    const gross = (financials.totalGross || 0).toFixed(2);
    const ownerPayout = (financials.totalOwnerPayout || 0).toFixed(2);
    const driverComm = (financials.totalDriverCommission || 0).toFixed(2);
    const marshalFee = (financials.totalMarshalCut || financials.totalMarshalFee || 0).toFixed(2);

    const headers = ['Shift ID', 'Timestamp', 'Gross Revenue ($)', 'Owner Net ($)', 'Driver Commission ($)', 'Marshal Fee ($)'];
    const row = [
      shiftId,
      timestamp,
      gross,
      ownerPayout,
      driverComm,
      marshalFee
    ];

    return `${headers.join(',')}\n${row.join(',')}`;
  }
}
