import crypto from 'crypto';

// Standalone TokenCrypto logic check
class TokenCrypto {
  static generateToken(payload: object, secret: string): string {
    const data = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
    return `${Buffer.from(data).toString('base64')}.${hmac}`;
  }

  static verifyToken(token: string, secret: string): boolean {
    try {
      const [base64Data, signature] = token.split('.');
      const data = Buffer.from(base64Data, 'base64').toString('utf-8');
      const expectedHmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHmac));
    } catch {
      return false;
    }
  }
}

// Execution Suite
console.log('--- RUNNING PHASE 1 CRYPTO TESTS ---');

const SECRET = 'test-hmac-secret-key-32-bytes!';
const payload = { shiftId: 'shift-123', crewId: 'crew-456', fareAmount: 1.50 };

const token = TokenCrypto.generateToken(payload, SECRET);
console.log('Generated Token:', token);

const isValid = TokenCrypto.verifyToken(token, SECRET);
console.log('Valid Secret Check:', isValid ? 'PASSED ✅' : 'FAILED ❌');

const isInvalid = TokenCrypto.verifyToken(token, 'wrong-secret');
console.log('Invalid Secret Check:', !isInvalid ? 'PASSED ✅' : 'FAILED ❌');
