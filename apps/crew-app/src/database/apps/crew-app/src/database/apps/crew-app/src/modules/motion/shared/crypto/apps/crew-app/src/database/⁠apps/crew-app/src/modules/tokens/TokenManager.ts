import { TokenCryptoEngine, SignedTokenPayload } from '../../../../shared/crypto/TokenCrypto';
import { TokenDatabase } from '../../database/TokenDatabase';

export class TokenManager {
  private shiftId: string;
  private conductorId: string;
  private deviceSecretKey: string;

  constructor(shiftId: string, conductorId: string, deviceSecretKey: string) {
    this.shiftId = shiftId;
    this.conductorId = conductorId;
    this.deviceSecretKey = deviceSecretKey;
  }

  /**
   * Issues change token offline, saves to SQLite, returns QR payload string & Short Code
   */
  public async issueChangeToken(amountCents: number, currency = 'USD'): Promise<{
    qrPayload: string;
    shortCode: string;
    signedToken: SignedTokenPayload;
  }> {
    const tokenId = `TKN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const unsignedPayload = {
      tokenId,
      shiftId: this.shiftId,
      conductorId: this.conductorId,
      amountCents,
      currency,
      issuedAt: Date.now(),
    };

    const signedToken = TokenCryptoEngine.signToken(unsignedPayload, this.deviceSecretKey);
    const shortCode = TokenCryptoEngine.generateShortVoucherCode(signedToken.tokenId, signedToken.signature);

    // Save to local offline database
    await TokenDatabase.recordTokenIssuance(signedToken, shortCode);

    return {
      qrPayload: JSON.stringify(signedToken),
      shortCode,
      signedToken,
    };
  }

  /**
   * Process passenger token redemption scanned phone-to-phone
   */
  public async processRedemption(
    rawQrPayload: string,
    currentLat: number,
    currentLng: number
  ): Promise<{ success: boolean; message: string; amountCents?: number }> {
    try {
      const signedToken: SignedTokenPayload = JSON.parse(rawQrPayload);

      // 1. Verify cryptographic HMAC signature
      const isValidSig = TokenCryptoEngine.verifyToken(signedToken, this.deviceSecretKey);
      if (!isValidSig) {
        return { success: false, message: 'Invalid or tampered token signature.' };
      }

      // 2. Check local double-spend
      const alreadyRedeemed = await TokenDatabase.isTokenRedeemedLocally(signedToken.tokenId);
      if (alreadyRedeemed) {
        return { success: false, message: 'Token has already been redeemed.' };
      }

      // 3. Record redemption
      const redemptionId = `RED-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await TokenDatabase.recordRedemption(
        redemptionId,
        signedToken.tokenId,
        signedToken.amountCents,
        currentLat,
        currentLng
      );

      return {
        success: true,
        message: 'Token successfully redeemed.',
        amountCents: signedToken.amountCents,
      };
    } catch (error) {
      return { success: false, message: 'Failed to parse token payload.' };
    }
  }
}
