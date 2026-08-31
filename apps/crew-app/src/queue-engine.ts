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

  static verifyPassengerCount(rankId: string, shiftId: string, count: number) {
    const rankQueue = this.queues.get(rankId) || [];
    const entry = rankQueue.find(q => q.shiftId === shiftId && q.status !== 'DEPARTED');

    if (!entry) return { success: false, reason: 'SHIFT_NOT_IN_QUEUE' };
    if (count <= 0 || count > 18) return { success: false, reason: 'INVALID_PASSENGER_COUNT' };

    entry.passengerCount = count;
    entry.status = 'DEPARTED';

    const remaining = rankQueue.filter(q => q.status !== 'DEPARTED');
    remaining.forEach((q, idx) => { q.position = idx + 1; });
    this.queues.set(rankId, remaining);

    return { success: true, entry, remainingCount: remaining.length };
  }

  static getQueueStatus(rankId: string): QueueEntry[] {
    return this.queues.get(rankId) || [];
  }
}
