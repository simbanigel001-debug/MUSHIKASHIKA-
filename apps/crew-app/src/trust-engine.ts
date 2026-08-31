// trust-engine.ts
import crypto from 'node:crypto';
import { mockDb } from '../../../shared/database/emulator.ts';

const MARSHAL_SECRET_KEY = process.env.MARSHAL_SECRET || 'super_secret_rank_marshal_key';
const MAX_TIMESTAMP_DRIFT_MS = 60 * 1000; // 60 seconds

export interface ClearancePayload {
  shiftId: string;
  marshalId: string;
  timestamp: string;
  signature?: string;
}

export class TrustEngine {
  /**
   * Generates a valid HMAC signature for testing/marshal app simulation
   */
  static generateSignature(payload: { shiftId: string; marshalId: string; timestamp: string }): string {
    const message = `${payload.shiftId}:${payload.marshalId}:${payload.timestamp}`;
    return crypto.createHmac('sha256', MARSHAL_SECRET_KEY).update(message).digest('hex');
  }

  /**
   * Verifies clearance payload authenticity and updates driver trust score
   */
  static processClearance(payload: ClearancePayload) {
    const { shiftId, marshalId, timestamp, signature } = payload;

    // 1. Validate Timestamp to prevent Replay Attacks
    const payloadTime = new Date(timestamp).getTime();
    const currentTime = Date.now();
    
    if (isNaN(payloadTime) || Math.abs(currentTime - payloadTime) > MAX_TIMESTAMP_DRIFT_MS) {
      return {
        success: false,
        reason: 'EXPIRED_OR_INVALID_TIMESTAMP',
        newScore: this.adjustTrustScore(shiftId, -10)
      };
    }

    // 2. Validate HMAC Signature
    const expectedSignature = this.generateSignature({ shiftId, marshalId, timestamp });
    
    if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return {
        success: false,
        reason: 'INVALID_CRYPTOGRAPHIC_SIGNATURE',
        newScore: this.adjustTrustScore(shiftId, -15)
      };
    }

    // 3. Signature Validated — Boost Trust Score
    const updatedScore = this.adjustTrustScore(shiftId, +5);

    return {
      success: true,
      reason: 'RANK_CLEARANCE_VERIFIED',
      marshalId,
      timestamp,
      newScore: updatedScore
    };
  }

  private static adjustTrustScore(shiftId: string, delta: number): number {
    const shift = mockDb.shifts.get(shiftId);
    const driverId = shift ? shift.driverId : 'driver-001';
    
    const currentScore = mockDb.trustScores.get(driverId) || 80;
    const newScore = Math.min(100, Math.max(0, currentScore + delta));
    
    mockDb.trustScores.set(driverId, newScore);
    return newScore;
  }
}
