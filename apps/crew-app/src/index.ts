import { mockDb, mockRedis } from '../../../shared/database/emulator.ts';
import { RealtimeEngine } from './event-engine.ts';

console.log('--- STARTING COMBINED FLEET SERVICE ---');

// Phase 2 Check
const shiftId = 'shift-998';
mockDb.shifts.set(shiftId, {
  driverId: 'driver-001',
  conductorId: 'conductor-002',
  status: 'ACTIVE',
  startTime: new Date().toISOString()
});
mockRedis.set(`shift:${shiftId}:status`, 'ACTIVE');

console.log('Active Shift Saved to DB:', mockDb.shifts.get(shiftId));
console.log('Redis Status Cache:', mockRedis.get(`shift:${shiftId}:status`));

// Phase 3 Check: Connect WebSockets and Stream Live Data
console.log('\n--- EXECUTING PHASE 3 REALTIME TESTS ---');
RealtimeEngine.connect('crew-app-client-1');

// Send test location updates
RealtimeEngine.publishLocation({
  shiftId: 'shift-998',
  lat: -17.8252,
  lng: 31.0335,
  speed: 45,
  timestamp: new Date().toISOString()
});

const cachedGeo = mockRedis.get('location:shift-998');
console.log('Redis Geo Cache Check:', cachedGeo);

console.log('\n--- PHASE 3 REALTIME ENGINE COMPLETE ✅ ---');
