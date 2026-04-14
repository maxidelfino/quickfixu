// src/config/jwt.ts
// JWT signing and verification using RS256 (asymmetric encryption)

import fs from 'fs';
import jwt from 'jsonwebtoken';
import path from 'path';

// Load RSA keys from filesystem
const PRIVATE_KEY_PATH = path.join(__dirname, '../../keys/private.pem');
const PUBLIC_KEY_PATH = path.join(__dirname, '../../keys/public.pem');

let PRIVATE_KEY: string;
let PUBLIC_KEY: string;

try {
  PRIVATE_KEY = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
  PUBLIC_KEY = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
} catch (error) {
  console.error('❌ Failed to load JWT keys!');
  console.error('   Run: npm run generate-keys');
  console.error('   Error:', error);
  process.exit(1);
}

export interface TokenPayload {
  userId: number;
}

/**
 * Sign JWT with RS256 private key
 * @param userId - User ID to embed in token
 * @returns JWT string (expires in 15 minutes)
 */
export const signToken = (userId: number): string => {
  return jwt.sign(
    { userId } as TokenPayload,
    PRIVATE_KEY,
    {
      algorithm: 'RS256',
      expiresIn: '15m', // Short-lived access token
    }
  );
};

/**
 * Verify JWT with RS256 public key
 * @param token - JWT string to verify
 * @returns Decoded payload
 * @throws JsonWebTokenError if invalid
 * @throws TokenExpiredError if expired
 */
export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, PUBLIC_KEY, {
    algorithms: ['RS256'],
  }) as TokenPayload;
};
