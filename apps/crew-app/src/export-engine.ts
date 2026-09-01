// apps/crew-app/src/export-engine.ts
import { FinanceEngine } from './finance-engine.ts';

export class ExportEngine {
  static generateOwnerCsv(shiftId: string): string {
    const financials = FinanceEngine.getShiftFinancials(shiftId);
    const timestamp = new Date().toISOString();

    const headers = ['Shift ID', 'Timestamp', 'Gross Revenue ($)', 'Owner Net ($)', 'Driver Commission ($)', 'Marshal Fee ($)'];
    const row = [
      shiftId,
      timestamp,
      financials.totalGross.toFixed(2),
      financials.totalOwnerPayout.toFixed(2),
      financials.totalDriverCommission.toFixed(2),
      financials.totalMarshalFee.toFixed(2)
    ];

    return `${headers.join(',')}\n${row.join(',')}`;
  }
}
