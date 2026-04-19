// src/app.ts
// Express application setup with middleware and routes

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorMiddleware } from './middleware/error.middleware';
import { globalRateLimiter } from './middleware/rateLimit.middleware';
import { API_CONSTANTS } from './config/constants';

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import professionalRoutes from './routes/professional.routes';
import categoryRoutes from './routes/category.routes';
import requestRoutes from './routes/request.routes';
import proposalRoutes from './routes/proposal.routes';
import appointmentRoutes from './routes/appointment.routes';

// Load environment variables
dotenv.config();

const app = express();

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

// Helmet: Sets security-related HTTP headers
app.use(helmet());

// CORS: Allow cross-origin requests from mobile app
// In development, allow all origins (emulator, simulator, physical device)
app.use(cors({
  origin: process.env.NODE_ENV === 'development' ? '*' : API_CONSTANTS.CORS_ORIGINS,
  credentials: process.env.NODE_ENV !== 'development', // credentials not compatible with wildcard
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ============================================================
// BODY PARSING MIDDLEWARE
// ============================================================

app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// ============================================================
// RATE LIMITING
// ============================================================

// Global rate limiter (100 req/15min per IP)
app.use(globalRateLimiter);

// ============================================================
// HEALTH CHECK ENDPOINT
// ============================================================

/**
 * GET /api/health
 * Health check endpoint for monitoring
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ============================================================
// API ROUTES
// ============================================================

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/professionals', professionalRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/appointments', appointmentRoutes);

// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
  });
});

// ============================================================
// ERROR HANDLER (MUST BE LAST)
// ============================================================

app.use(errorMiddleware);

export default app;
