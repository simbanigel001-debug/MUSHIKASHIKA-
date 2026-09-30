// apps/crew-app/src/mushikashika-terminal.ts

export interface TelemetryData {
  vehicleId: string;
  currentSpeedKmH: number;
  roadType: 'URBAN' | 'SUBURBAN' | 'HIGHWAY';
  durationOverSpeedSec?: number;
}

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface DispatchResult {
  success: boolean;
  token?: string;
  plateNumber: string;
  passengerCount: number;
  driverId: string;
  timestamp: string;
  message: string;
}

export interface SabhukuEvaluation {
  vehicleId: string;
  isCompliant: boolean;
  speedLimit: number;
  recordedSpeed: number;
  infringementNotice?: string;
}

export class MushikashikaTerminalEngine {
  private speedLimits: Record<string, number> = {
    URBAN: 50,
    SUBURBAN: 60,
    HIGHWAY: 80,
  };

  /**
   * Generates a text-based ASCII UI representation for Sabhuku rank operators.
   */
  public renderSabhukuScreen(plateNumber: string, passengerCount: number, driverId: string): string {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const isCapacityValid = passengerCount <= 16;
    const capacityStatus = isCapacityValid ? 'PASS (LEGAL)' : 'OVERLOAD ALERT';

    return `
================================================================
          👑 SABHUKU TERMINAL - RANK CLEARANCE ENGINE 👑
================================================================
 TIME         : ${timestamp}
 VEHICLE PLATE: ${plateNumber}
 DRIVER ID    : ${driverId}
 PASSENGERS   : ${passengerCount} / 16 [${capacityStatus}]
 SYSTEM STATUS: ${isCapacityValid ? 'READY_FOR_DISPATCH' : 'DISPATCH_BLOCKED'}
================================================================
 [1] Press DISPATCH to issue digital clearance token
 [2] Press FLAG to log loading anomaly or queue jump
================================================================
`;
  }

  /**
   * Validates capacity and generates a signed-style clearance token for departure.
   */
  public dispatchVehicle(plateNumber: string, passengerCount: number, driverId: string): DispatchResult {
    const timestamp = new Date().toISOString();

    if (passengerCount > 16) {
      return {
        success: false,
        plateNumber,
        passengerCount,
        driverId,
        timestamp,
        message: `DISPATCH_REJECTED: Overloaded (${passengerCount}/16 max seats).`,
      };
    }

    if (!plateNumber || !driverId) {
      return {
        success: false,
        plateNumber,
        passengerCount,
        driverId,
        timestamp,
        message: 'DISPATCH_REJECTED: Missing vehicle plate or driver identification.',
      };
    }

    // Generate lightweight dispatch hash token
    const rawToken = `${plateNumber}:${driverId}:${passengerCount}:${timestamp}`;
    const token = `SBK-DISPATCH-${Buffer.from(rawToken).toString('base64').substring(0, 16)}`;

    return {
      success: true,
      token,
      plateNumber,
      passengerCount,
      driverId,
      timestamp,
      message: 'DISPATCH_APPROVED: Vehicle cleared for rank departure.',
    };
  }

  /**
   * Processes live telemetry data and evaluates compliance with speed caps.
   */
  public processInTransitTelemetry(telemetry: TelemetryData, _location?: GeoLocation): SabhukuEvaluation {
    const roadType = telemetry.roadType || 'SUBURBAN';
    const limit = this.speedLimits[roadType] ?? 60;
    const recordedSpeed = telemetry.currentSpeedKmH;

    if (recordedSpeed > limit) {
      const excess = Math.round(recordedSpeed - limit);
      return {
        vehicleId: telemetry.vehicleId,
        isCompliant: false,
        speedLimit: limit,
        recordedSpeed,
        infringementNotice: `SPEEDING_VIOLATION: ${recordedSpeed} km/h in a ${limit} km/h ${roadType} zone (+${excess} km/h).`,
      };
    }

    return {
      vehicleId: telemetry.vehicleId,
      isCompliant: true,
      speedLimit: limit,
      recordedSpeed,
    };
  }
}
