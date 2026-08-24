import { getDBConnection } from './Database';
import { RoadsideStopEvent, SpeedViolationEvent } from '../modules/motion/MotionEngine';

export class QueueManager {
  public static async saveStopEvent(event: RoadsideStopEvent) {
    const db = await getDBConnection();
    await db.executeSql(
      `INSERT INTO roadside_stops 
       (timestamp, latitude, longitude, dwell_duration_seconds, max_speed_before_stop_kmh, is_mock_location) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [event.timestamp, event.latitude, event.longitude, event.dwellDurationSeconds, event.maxSpeedBeforeStopKmh, event.isMockLocation ? 1 : 0]
    );
  }

  public static async saveSpeedViolation(event: SpeedViolationEvent) {
    const db = await getDBConnection();
    await db.executeSql(
      `INSERT INTO speed_violations 
       (timestamp, latitude, longitude, recorded_speed_kmh, speed_limit_kmh) 
       VALUES (?, ?, ?, ?, ?)`,
      [event.timestamp, event.latitude, event.longitude, event.recordedSpeedKmh, event.speedLimitKmh]
    );
  }

  public static async syncPendingEvents(apiEndpoint: string, authToken: string) {
    const db = await getDBConnection();
    const [stops] = await db.executeSql(`SELECT * FROM roadside_stops WHERE sync_status = 'PENDING'`);
    const [speeding] = await db.executeSql(`SELECT * FROM speed_violations WHERE sync_status = 'PENDING'`);

    if (stops.rows.length === 0 && speeding.rows.length === 0) return;

    try {
      const response = await fetch(`${apiEndpoint}/telemetry/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          stops: stops.rows.raw(),
          speedViolations: speeding.rows.raw()
        })
      });

      if (response.ok) {
        // Mark items as SYNCED locally
        await db.executeSql(`UPDATE roadside_stops SET sync_status = 'SYNCED' WHERE sync_status = 'PENDING'`);
        await db.executeSql(`UPDATE speed_violations SET sync_status = 'SYNCED' WHERE sync_status = 'PENDING'`);
      }
    } catch (error) {
      console.log('Network unavailable. Events remain queued locally.');
    }
  }
}
