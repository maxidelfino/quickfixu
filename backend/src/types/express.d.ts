// src/types/express.d.ts
// Extend Express Request interface to include authenticated user

declare namespace Express {
  export interface Request {
    user?: {
      id: number;
      email: string;
      role: 'client' | 'professional';
    };
  }
}
