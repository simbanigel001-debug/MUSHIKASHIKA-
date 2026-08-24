import LocationServices from 'react-native-geolocation-service';
import { Accelerometer } from 'expo-sensors';
import { QueueManager } from '../../database/QueueManager';

export interface RoadsideStopEvent {
  timestamp: number;
  latitude: number;
  longitude: number;
  dwellDurationSeconds: number;
  maxSpeedBeforeStopKmh: number;
  isMockLocation: boolean;
}

export interface SpeedViolationEvent {
  timestamp: number;
  latitude: number;
  longitude: number;
  recordedSpeedKmh: number;
  speedLimitKmh: number;
}

export class MotionEngine {
  private static SPEED_STOP_THRESHOLD_MS = 0.83; // ~3 km/h
  private static MIN_DWELL_SECONDS = 30;
  private static HIGHWAY_SPEED_LIMIT_KMH = 100;

  private stopStartTime: number | null = null;
  private currentStopLocation: { latitude: number; longitude: number } | null = null;
  private maxSpeedInSegmentKmh = 0;
  private currentAcceleration = 1.0;

  constructor() {
    Accelerometer.setUpdateInterval(500);
    Accelerometer.addListener(data => {
      // Calculate G-force magnitude to verify motion against GPS
      this.currentAcceleration = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
    });
  }

  public async processTelemetryPoint(position: LocationServices.GeoPosition) {
    const { speed, latitude, longitude, mockSubscribed } = position.coords;
    const now = Date.now();
    const currentSpeedKmh = speed && speed > 0 ? Math.round(speed * 3.6) : 0;

    // 1. Check Overspeeding
    if (currentSpeedKmh > MotionEngine.HIGHWAY_SPEED_LIMIT_KMH) {
      const violation: SpeedViolationEvent = {
        timestamp: now,
        latitude,
        longitude,
        recordedSpeedKmh: currentSpeedKmh,
        speedLimitKmh: MotionEngine.HIGHWAY_SPEED_LIMIT_KMH,
      };
      await QueueManager.saveSpeedViolation(violation);
    }

    if (currentSpeedKmh > this.maxSpeedInSegmentKmh) {
      this.maxSpeedInSegmentKmh = currentSpeedKmh;
    }

    // 2. Anti-Spoofing Check (Zero acceleration but high GPS speed = Fake GPS)
    const isMock = !!mockSubscribed || (currentSpeedKmh > 20 && Math.abs(this.currentAcceleration - 1.0) < 0.02);

    // 3. Evaluate Roadside Stop Dwell
    const isStopped = speed !== null && speed <= MotionEngine.SPEED_STOP_THRESHOLD_MS;

    if (isStopped) {
      if (!this.stopStartTime) {
        this.stopStartTime = now;
        this.currentStopLocation = { latitude, longitude };
      }
    } else if (this.stopStartTime && this.currentStopLocation) {
      const dwellDurationSeconds = Math.floor((now - this.stopStartTime) / 1000);
      const stopData = { ...this.currentStopLocation };
      const peakSpeed = this.maxSpeedInSegmentKmh;

      this.stopStartTime = null;
      this.currentStopLocation = null;
      this.maxSpeedInSegmentKmh = currentSpeedKmh;

      if (dwellDurationSeconds >= MotionEngine.MIN_DWELL_SECONDS) {
        const stopEvent: RoadsideStopEvent = {
          timestamp: now,
          latitude: stopData.latitude,
          longitude: stopData.longitude,
          dwellDurationSeconds,
          maxSpeedBeforeStopKmh: peakSpeed,
          isMockLocation: isMock
        };
        await QueueManager.saveStopEvent(stopEvent);
      }
    }
  }
}
