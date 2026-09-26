// apps/crew-app/src/lift-engine.ts

export interface LiftRequest {
  id: string;
  passengerPhone: string;
  pickupLat: number;
  pickupLng: number;
  pickupLandmark: string; // e.g., "Near Ascot Shopping Centre"
  destination: string;    // e.g., "CBD Main Rank"
  passengerCount: number;
  offeredFare: number;
  status: 'PENDING' | 'ACCEPTED' | 'PICKED_UP' | 'CANCELLED';
  acceptedByShiftId?: string;
  timestamp: string;
}

export class LiftEngine {
  private static requests: Map<string, LiftRequest> = new Map();

  static createRequest(data: Omit<LiftRequest, 'id' | 'status' | 'timestamp'>): LiftRequest {
    const id = `lift-${Date.now()}`;
    const request: LiftRequest = {
      ...data,
      id,
      status: 'PENDING',
      timestamp: new Date().toISOString()
    };
    this.requests.set(id, request);
    return request;
  }

  static acceptRequest(requestId: string, shiftId: string): LiftRequest {
    const req = this.requests.get(requestId);
    if (!req) throw new Error('REQUEST_NOT_FOUND');
    if (req.status !== 'PENDING') throw new Error('REQUEST_ALREADY_TAKEN');

    req.status = 'ACCEPTED';
    req.acceptedByShiftId = shiftId;
    this.requests.set(requestId, req);
    return req;
  }

  static markPickedUp(requestId: string): LiftRequest {
    const req = this.requests.get(requestId);
    if (!req) throw new Error('REQUEST_NOT_FOUND');
    req.status = 'PICKED_UP';
    this.requests.set(requestId, req);
    return req;
  }

  static getPendingRequests(): LiftRequest[] {
    return Array.from(this.requests.values()).filter(r => r.status === 'PENDING');
  }

  static getAllRequests(): LiftRequest[] {
    return Array.from(this.requests.values());
  }
}
