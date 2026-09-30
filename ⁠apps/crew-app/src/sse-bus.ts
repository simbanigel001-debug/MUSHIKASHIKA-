import { Response } from 'express';
import { store } from './db';

class SSEBroadcaster {
  private clients: Set<Response> = new Set();

  addClient(res: Response): void {
    this.clients.add(res);
  }

  removeClient(res: Response): void {
    this.clients.delete(res);
  }

  broadcast(eventType: string, payload: unknown): void {
    const data = `event: ${eventType}\ndata: ${JSON.stringify({ eventType, payload, timestamp: Date.now() })}\n\n`;
    this.clients.forEach((client) => client.write(data));
  }

  broadcastFinancialUpdate(): void {
    const cumulative = store.getAggregateFinancials();
    this.broadcast('OWNER_FINANCIAL_UPDATE', { cumulative });
  }
}

export const sseBus = new SSEBroadcaster();
