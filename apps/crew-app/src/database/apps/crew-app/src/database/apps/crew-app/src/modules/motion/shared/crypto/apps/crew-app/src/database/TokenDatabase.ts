import { getDBConnection } from './Database';
import { SignedTokenPayload } from '../../../../shared/crypto/TokenCrypto';

export class TokenDatabase {
  public static async initTokenTables() {
    const db = await getDBConnection();

    // Table for tokens issued by this conductor
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS tokens_issued (
        token_id TEXT PRIMARY KEY,
        shift_id TEXT NOT NULL,
        conductor_id TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        currency TEXT NOT NULL,
        short_code TEXT NOT NULL,
        signature TEXT NOT NULL,
        issued_at INTEGER NOT NULL,
        sync_status TEXT DEFAULT 'PENDING'
      );
    `);

    // Table for tokens redeemed by passengers on this vehicle
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS tokens_redeemed (
        redemption_id TEXT PRIMARY KEY,
        token_id TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        redeemed_at INTEGER NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        sync_status TEXT DEFAULT 'PENDING'
      );
    `);
  }

  public static async recordTokenIssuance(token: SignedTokenPayload, shortCode: string) {
    const db = await getDBConnection();
    await db.executeSql(
      `INSERT INTO tokens_issued 
       (token_id, shift_id, conductor_id, amount_cents, currency, short_code, signature, issued_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [token.tokenId, token.shiftId, token.conductorId, token.amountCents, token.currency, shortCode, token.signature, token.issuedAt]
    );
  }

  public static async recordRedemption(
    redemptionId: string,
    tokenId: string,
    amountCents: number,
    lat: number,
    lng: number
  ) {
    const db = await getDBConnection();
    await db.executeSql(
      `INSERT INTO tokens_redeemed 
       (redemption_id, token_id, amount_cents, redeemed_at, latitude, longitude) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [redemptionId, tokenId, amountCents, Date.now(), lat, lng]
    );
  }

  public static async isTokenRedeemedLocally(tokenId: string): Promise<boolean> {
    const db = await getDBConnection();
    const [results] = await db.executeSql(
      `SELECT token_id FROM tokens_redeemed WHERE token_id = ?`,
      [tokenId]
    );
    return results.rows.length > 0;
  }
}
