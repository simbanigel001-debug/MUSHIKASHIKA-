// apps/crew-app/src/offline-engine.ts
export interface OfflineQueueItem {
  id: string;
  type: 'TELEMETRY' | 'RANK_JOIN' | 'DEPARTURE';
  payload: Record<string, unknown>;
  timestamp: string;
}

export class OfflineEngine {
  private static queue: OfflineQueueItem[] = [];

  static enqueue(type: OfflineQueueItem['type'], payload: Record<string, unknown>): OfflineQueueItem {
    const item: OfflineQueueItem = {
      id: `offline-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      payload,
      timestamp: new Date().toISOString()
    };
    this.queue.push(item);
    return item;
  }

  static getQueue(): OfflineQueueItem[] {
    return [...this.queue];
  }

  static clearQueue(): number {
    const count = this.queue.length;
    this.queue = [];
    return count;
  }
}
