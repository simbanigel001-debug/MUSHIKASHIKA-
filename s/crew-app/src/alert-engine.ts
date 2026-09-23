// apps/crew-app/src/alert-engine.ts
export interface AlertMessage {
  id: string;
  recipient: string;
  channel: 'SMS' | 'WHATSAPP';
  message: string;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  timestamp: string;
}

export class AlertEngine {
  private static alertLog: AlertMessage[] = [];

  static sendDepartureAlert(ownerPhone: string, shiftId: string, grossFare: number, ownerPayout: number): AlertMessage {
    const message = `[MUSHIKASHIKA FLEET] Shift ${shiftId} departed rank.\nGross Earned: $${grossFare.toFixed(2)}\nNet Owner Payout: $${ownerPayout.toFixed(2)}`;
    return this.dispatch(ownerPhone, 'WHATSAPP', message);
  }

  static sendShiftClosedAlert(ownerPhone: string, shiftId: string, totalGross: number, ownerNet: number): AlertMessage {
    const message = `[MUSHIKASHIKA EOD RECONCILIATION]\nShift ${shiftId} Closed.\nTotal Gross: $${totalGross.toFixed(2)}\nFinal Owner Payout: $${ownerNet.toFixed(2)}`;
    return this.dispatch(ownerPhone, 'SMS', message);
  }

  private static dispatch(recipient: string, channel: AlertMessage['channel'], message: string): AlertMessage {
    const alert: AlertMessage = {
      id: `alt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      recipient,
      channel,
      message,
      status: 'SENT',
      timestamp: new Date().toISOString()
    };
    this.alertLog.push(alert);
    console.log(`\n📱 [ALERT ENGINE - ${channel}] To ${recipient}:\n${message}\n`);
    return alert;
  }

  static getAlertHistory(): AlertMessage[] {
    return [...this.alertLog];
  }
}
