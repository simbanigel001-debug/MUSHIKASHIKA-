import CryptoJS from 'crypto-js';

export interface UnsignedTokenPayload {
  tokenId: string;
  shiftId: string;
  conductorId: string;
  amountCents: number;
  currency: string;
  issuedAt: number;
}

export interface SignedTokenPayload extends UnsignedTokenPayload {
  signature: string;
}

export class TokenCryptoEngine {
  /**
   * Generates a cryptographically signed payload for offline token generation
   */
  public static signToken(
    payload: UnsignedTokenPayload,
    deviceSecretKey: string
  ): SignedTokenPayload {
    const rawData = `${payload.tokenId}:${payload.shiftId}:${payload.conductorId}:${payload.amountCents}:${payload.currency}:${payload.issuedAt}`;
    const signature = CryptoJS.HmacSHA256(rawData, deviceSecretKey).toString(CryptoJS.enc.Hex);

    return {
      ...payload,
      signature,
    };
  }

  /**
   * Verifies offline token validity and protection against signature tampering
   */
  public static verifyToken(
    token: SignedTokenPayload,
    deviceSecretKey: string
  ): boolean {
    const rawData = `${token.tokenId}:${token.shiftId}:${token.conductorId}:${token.amountCents}:${token.currency}:${token.issuedAt}`;
    const expectedSignature = CryptoJS.HmacSHA256(rawData, deviceSecretKey).toString(CryptoJS.enc.Hex);

    return expectedSignature === token.signature;
  }

  /**
   * Generates a 6-character alphanumeric code for offline short-code redemptions
   */
  public static generateShortVoucherCode(tokenId: string, signature: string): string {
    const combined = `${tokenId}${signature}`;
    const hash = CryptoJS.SHA256(combined).toString(CryptoJS.enc.Hex);
    return hash.substring(0, 6).toUpperCase();
  }
}
