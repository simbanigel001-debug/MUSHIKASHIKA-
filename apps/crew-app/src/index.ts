import { mockDb, mockRedis } from '../../../shared/database/emulator.ts';

console.log('--- STARTING COMBINED FLEET SERVICE ---');

// Record a mock active shift
const shiftId = 'shift-998';
mockDb.shifts.set(shiftId, {
  driverId: 'driver-001',
  conductorId: 'conductor-002',
  status: 'ACTIVE',
  startTime: new Date().toISOString()
});

// Cache shift state in Redis mock
mockRedis.set(`shift:${shiftId}:status`, 'ACTIVE');

console.log('Active Shift Saved to DB:', mockDb.shifts.get(shiftId));
console.log('Redis Status Cache:', mockRedis.get(`shift:${shiftId}:status`));
console.log('\n--- PHASE 2 DATABASE & CACHE INTEGRATION COMPLETE ✅ ---');
