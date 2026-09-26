// ============================================================================
// LIFT ENGINE & TOKEN MANAGEMENT - BULAWAYO TRANSIT NETWORK
// ============================================================================

export interface Location {
  lat: number;
  lng: number;
}

export interface LiftRequest {
  id: string;
  phone: string;
  pickupLandmark: string;
  destination: string;
  passengerCount: number;
  offeredFare: number;
  paymentMethod: 'CASH' | 'TOKEN' | 'ECOCASH' | 'INNBUCKS' | string;
  location: Location;
  status: 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';
  assignedShiftId?: string;
  createdAt: string;
}

export interface ChangeToken {
  tokenId: string;
  issuedByShiftId: string;
  amount: number;
  status: 'ACTIVE' | 'REDEEMED' | 'CASHED_OUT';
  issuedAt: string;
}

// In-Memory Data Repositories
const liftRequestsStore: Map<string, LiftRequest> = new Map();
const changeTokensStore: Map<string, ChangeToken> = new Map();

// ============================================================================
// 1. CHANGE TOKEN ENGINE
// ============================================================================

export class TokenEngine {
  /**
   * Generates a digital change token code for passengers paying large notes.
   */
  static issueChangeToken(shiftId: string, amount: number): ChangeToken {
    const randomCode = Math.floor(1000 + Math.random() * 9000);
    const tokenId = `CHG-${randomCode}`;

    const token: ChangeToken = {
      tokenId,
      issuedByShiftId: shiftId,
      amount,
      status: 'ACTIVE',
      issuedAt: new Date().toISOString()
    };

    changeTokensStore.set(tokenId, token);
    return token;
  }

  /**
   * Redeems or partially deducts fare from an active change token or pre-paid pass.
   */
  static redeemToken(
    tokenId: string,
    requiredAmount: number
  ): { success: boolean; remainingBalance: number; message: string } {
    const cleanTokenId = tokenId.trim().toUpperCase();
    const token = changeTokensStore.get(cleanTokenId);

    if (!token) {
      return { success: false, remainingBalance: 0, message: 'INVALID_TOKEN' };
    }
    if (token.status !== 'ACTIVE') {
      return { success: false, remainingBalance: 0, message: 'TOKEN_ALREADY_USED' };
    }
    if (token.amount < requiredAmount) {
      return {
        success: false,
        remainingBalance: token.amount,
        message: 'INSUFFICIENT_TOKEN_BALANCE'
      };
    }

    token.amount -= requiredAmount;
    if (token.amount === 0) {
      token.status = 'REDEEMED';
    }

    changeTokensStore.set(cleanTokenId, token);
    return {
      success: true,
      remainingBalance: token.amount,
      message: 'TOKEN_REDEEMED'
    };
  }

  static getTokenDetails(tokenId: string): ChangeToken | undefined {
    return changeTokensStore.get(tokenId.trim().toUpperCase());
  }
}

// ============================================================================
// 2. STREET LIFT ENGINE (IN-DRIVE MATCHING & DISTANCE ROUTING)
// ============================================================================

export class LiftEngine {
  /**
   * Haversine formula to estimate distance in km between two lat/lng points.
   */
  static calculateDistance(loc1: Location, loc2: Location): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (loc2.lat - loc1.lat) * (Math.PI / 180);
    const dLng = (loc2.lng - loc1.lng) * (Math.PI / 180);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(loc1.lat * (Math.PI / 180)) *
        Math.cos(loc2.lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Registers a new street lift broadcast request.
   */
  static createLiftRequest(params: {
    phone: string;
    pickupLandmark: string;
    destination: string;
    passengerCount: number;
    offeredFare: number;
    paymentMethod: string;
    lat: number;
    lng: number;
  }): LiftRequest {
    const id = `LIFT-${Date.now()}`;
    const lift: LiftRequest = {
      id,
      phone: params.phone,
      pickupLandmark: params.pickupLandmark,
      destination: params.destination,
      passengerCount: params.passengerCount,
      offeredFare: params.offeredFare,
      paymentMethod: params.paymentMethod,
      location: { lat: params.lat, lng: params.lng },
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    liftRequestsStore.set(id, lift);
    return lift;
  }

  /**
   * Finds pending street lift requests within a specified radius (in km) of a Kombi's live GPS location.
   */
  static findNearbyRequests(kombiLocation: Location, radiusKm: number = 3.0): LiftRequest[] {
    const nearby: LiftRequest[] = [];

    for (const lift of liftRequestsStore.values()) {
      if (lift.status === 'PENDING') {
        const dist = this.calculateDistance(kombiLocation, lift.location);
        if (dist <= radiusKm) {
          nearby.push(lift);
        }
      }
    }

    return nearby;
  }

  /**
   * Marks a street lift request as accepted by a driver/conductor shift.
   */
  static acceptLiftRequest(liftId: string, shiftId: string): { success: boolean; lift?: LiftRequest; message: string } {
    const lift = liftRequestsStore.get(liftId);
    if (!lift) return { success: false, message: 'LIFT_NOT_FOUND' };
    if (lift.status !== 'PENDING') return { success: false, message: 'LIFT_ALREADY_TAKEN' };

    lift.status = 'ACCEPTED';
    lift.assignedShiftId = shiftId;
    liftRequestsStore.set(liftId, lift);

    return { success: true, lift, message: 'LIFT_ACCEPTED' };
  }

  static getActiveRequests(): LiftRequest[] {
    return Array.from(liftRequestsStore.values());
  }
}
