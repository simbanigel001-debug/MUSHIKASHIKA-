// apps/crew-app/src/anomaly-engine.ts

export interface AnomalyReport {
  id: string;
  shiftId: string;
  type: 'RANK_BYPASS' | 'GPS_SPOOFING' | 'REVENUE_LEAKAGE' | 'UNAUTHORIZED_STOP';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  timestamp: string;
  deductedTrust: number;
}

export class AnomalyEngine {
  private static anomalyLog: AnomalyReport[] = [];

  // Geofence center for CBD Main Rank (Bulawayo)
  private static CBD_RANK_GEOFENCE = { lat: -20.1585, lng: 28.6028, radiusKm: 0.5 };

  static inspectTelemetry(shiftId: string, currentLat: number, currentLng: number, speed: number, hasMarshalClearance: boolean): AnomalyReport | null {
    // 1. Check for Speed Anomalies / GPS Spoofing
    if (speed > 120) { // Unrealistic urban kombi speed
      return this.raiseAnomaly(
        shiftId,
        'GPS_SPOOFING',
        'CRITICAL',
        `Unrealistic speed detected (${speed} km/h). Possible GPS tampering.`,
        25
      );
    }

    // 2. Check for Rank Bypass (Vehicle moved away from rank without clearance)
    const distanceFromRank = this.calculateDistance(
      currentLat,
      currentLng,
      this.CBD_RANK_GEOFENCE.lat,
      this.CBD_RANK_GEOFENCE.lng
    );

    if (distanceFromRank > this.CBD_RANK_GEOFENCE.radiusKm && !hasMarshalClearance) {
      return this.raiseAnomaly(
        shiftId,
        'RANK_BYPASS',
        'HIGH',
        'Vehicle left rank boundaries without Marshal HMAC Clearance.',
        15
      );
    }

    return null;
  }

  static inspectFareReconciliation(shiftId: string, digitalPassCount: number, reportedCount: number): AnomalyReport | null {
    if (reportedCount < digitalPassCount) {
      const discrepancy = digitalPassCount - reportedCount;
      return this.raiseAnomaly(
        shiftId,
        'REVENUE_LEAKAGE',
        'MEDIUM',
        `Passenger count discrepancy detected: ${discrepancy} digital ticket(s) missing from manifest.`,
        10
      );
    }
    return null;
  }

  private static raiseAnomaly(
    shiftId: string,
    type: AnomalyReport['type'],
    severity: AnomalyReport['severity'],
    description: string,
    deductedTrust: number
  ): AnomalyReport {
    const report: AnomalyReport = {
      id: `anom-${Date.now()}`,
      shiftId,
      type,
      severity,
      description,
      timestamp: new Date().toISOString(),
      deductedTrust
    };

    this.anomalyLog.unshift(report);
    return report;
  }

  static getActiveAnomalies(shiftId?: string): AnomalyReport[] {
    if (shiftId) {
      return this.anomalyLog.filter(a => a.shiftId === shiftId);
    }
    return this.anomalyLog;
  }

  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
