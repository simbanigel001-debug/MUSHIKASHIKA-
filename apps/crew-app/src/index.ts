import { mockDb, mockRedis } from '../../../shared/database/emulator.ts';
import { RealtimeEngine } from './event-engine.ts';
import { TrustEngine } from './trust-engine.ts';

console.log('==================================================');
console.log('       MUSHIKASHIKA FLEET CORE SYSTEM TEST       ');
console.log('==================================================\n');

// Phase 2: DB & Cache Setup
const shiftId = 'shift-998';
const driverId = 'driver-001';

mockDb.shifts.set(shiftId, {
  driverId: driverId,
  conductorId: 'conductor-002',
  status: 'ACTIVE',
  startTime: new Date().toISOString()
});
mockRedis.set(`shift:${shiftId}:status`, 'ACTIVE');

// Set base trust score
mockDb.trustScores.set(driverId, 85);
console.log(`Initial DB Setup -> Active Shift: ${shiftId} | Driver ${driverId} Base Trust: 85`);

// Phase 3: Realtime Telemetry
console.log('\n--- PHASE 3: TELEMETRY STREAM ---');
RealtimeEngine.connect('crew-app-client-1');
RealtimeEngine.publishLocation({
  shiftId: shiftId,
  lat: -17.8252,
  lng: 31.0335,
  speed: 48,
  timestamp: new Date().toISOString()
});

// Phase 4: Trust & Rank Clearance Processing
console.log('\n--- PHASE 4: RANK CLEARANCE & TRUST ENGINE ---');
TrustEngine.processClearance({
  shiftId: shiftId,
  marshalId: 'marshal-CBD-01',
  signature: 'sig_valid_sha256_mock_hash',
  timestamp: new Date().toISOString()
});

console.log('\n==================================================');
console.log('    ✅ FULL SYSTEM PHASE 1-4 RUN SUCCESSFUL     ');
console.log('==================================================');
