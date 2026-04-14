// src/server.ts
// HTTP server entry point

import app from './app';
import { API_CONSTANTS } from './config/constants';

const PORT = process.env.PORT || API_CONSTANTS.DEFAULT_PORT;

const server = app.listen(PORT, () => {
  console.log('');
  console.log('🚀 QuickFixU Backend Server Started');
  console.log('=====================================');
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('📚 API Routes:');
  console.log(`   POST   http://localhost:${PORT}/api/auth/register`);
  console.log(`   POST   http://localhost:${PORT}/api/auth/login`);
  console.log(`   POST   http://localhost:${PORT}/api/auth/google`);
  console.log(`   POST   http://localhost:${PORT}/api/auth/facebook`);
  console.log(`   POST   http://localhost:${PORT}/api/auth/refresh`);
  console.log(`   POST   http://localhost:${PORT}/api/auth/logout`);
  console.log(`   GET    http://localhost:${PORT}/api/users/me`);
  console.log(`   PATCH  http://localhost:${PORT}/api/users/me`);
  console.log(`   POST   http://localhost:${PORT}/api/users/me/photo`);
  console.log(`   DELETE http://localhost:${PORT}/api/users/me`);
  console.log(`   GET    http://localhost:${PORT}/api/professionals/search`);
  console.log(`   GET    http://localhost:${PORT}/api/professionals/:id`);
  console.log(`   PATCH  http://localhost:${PORT}/api/professionals/me`);
  console.log(`   POST   http://localhost:${PORT}/api/professionals/me/certifications`);
  console.log(`   GET    http://localhost:${PORT}/api/categories`);
  console.log(`   GET    http://localhost:${PORT}/api/categories/:slug`);
  console.log(`   GET    http://localhost:${PORT}/api/categories/:slug/professionals`);
  console.log('');
  console.log('✅ Core auth, user, professional, category, and upload routes are wired in this backend');
  console.log('ℹ️  Check route-level validation, env config, and service dependencies for runtime readiness');
  console.log('=====================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('⚠️  SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

export default server;
