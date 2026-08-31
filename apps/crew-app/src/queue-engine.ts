// apps/crew-app/src/queue-engine.ts
import { mockDb } from '../../../shared/database/emulator.ts';

export interface QueueEntry {
  shiftId: string;
  rankId: string;
  position: number;
  passengerCount: number;
  status: 'QUEUED' | 'BOARDING' | 'DEPARTED';
  timestamp: string;
}

export class QueueEngine {
  private static queues: Map<string, QueueEntry[]> = new Map();

  static joinQueue(rankId: string, shiftId: string): QueueEntry {
    const rankQueue = this.queues.get(rankId) || [];
    
    // Prevent duplicate active queue entries
    const existing = rankQueue.find(q => q.shiftId === shiftId && q.status !== 'DEPARTED');
    if (existing) return existing;

    const entry: QueueEntry = {
      shiftId,
      rankId,
      position: rankQueue.length + 1,
      passengerCount: 0,
      status: 'QUEUED',
      timestamp: new Date().toISOString()
    };

    rankQueue.push(entry);
    this.queues.set(rankId, rankQueue);
    return entry;
  }

  static verifyPassengerCount(rankId: string, shiftId: string, count: number): { success: boolean; entry?: QueueEntry; reason?: string } {
    const rankQueue = this.queues.get(rankId) || [];
    const entry = rankQueue.find(q => q.shiftId === shiftId && q.status !== 'DEPARTED');

    if (!entry) {
      return { success: false, reason: 'SHIFT_NOT_FOUND_IN_QUEUE' };
    }

    if (count <= 0 || count > 18) { // Maximum capacity check for commuter omnibuses
      return { success: false, reason: 'INVALID_PASSENGER_COUNT' };
    }

    entry.passengerCount = count;
    entry.status = 'DEPARTED';

    // Re-index remaining vehicles in queue
    const updatedQueue = rankQueue.filter(q => q.status !== 'DEPARTED');
    updatedQueue.forEach((q, idx) => { q.position = idx + 1; });
    this.queues.set(rankId, updatedQueue);

    return { success: true, entry };
  }

  static getQueueStatus(rankId: string): QueueEntry[] {
    return this.queues.get(rankId) || [];
  }
}
