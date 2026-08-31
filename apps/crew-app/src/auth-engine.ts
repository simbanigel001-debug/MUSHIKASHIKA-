// apps/crew-app/src/auth-engine.ts
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'mushikashika_fleet_secret_key_2026';

export interface TokenPayload {
  userId: string;
  role: 'DRIVER' | 'CONDUCTOR' | 'MARSHAL' | 'OWNER';
  shiftId?: string;
}

export class AuthEngine {
  static generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
  }

  static verifyToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch {
      return null;
    }
  }

  static extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.split(' ')[1];
  }
}
