// apps/crew-app/public/idb-queue.js
export class LocalStorageQueue {
  static STORAGE_KEY = 'mushikashika_offline_queue';

  static addEvent(type, payload) {
    const queue = this.getQueue();
    queue.push({
      id: `local-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      payload,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queue));
  }

  static getQueue() {
    const data = localStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  static clearQueue() {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  static async syncWithServer() {
    const items = this.getQueue();
    if (items.length === 0) return { syncedCount: 0 };

    try {
      const res = await fetch('/api/offline/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });

      if (res.ok) {
        const data = await res.json();
        this.clearQueue();
        return data;
      }
    } catch {
      console.warn('[PWA Queue] Server still unreachable. Retrying later.');
    }
    return { syncedCount: 0 };
  }
}
