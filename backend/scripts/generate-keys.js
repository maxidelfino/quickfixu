// scripts/generate-keys.js
// Generate RSA 2048-bit key pair for JWT signing (RS256 algorithm)

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const KEYS_DIR = path.join(__dirname, '..', 'keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.pem');

console.log('🔐 Generating RSA 2048-bit key pair for JWT...');

// Create keys directory if it doesn't exist
if (!fs.existsSync(KEYS_DIR)) {
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  console.log('📁 Created keys/ directory');
}

// Check if keys already exist
if (fs.existsSync(PRIVATE_KEY_PATH) || fs.existsSync(PUBLIC_KEY_PATH)) {
  console.warn('⚠️  WARNING: Keys already exist!');
  console.warn('   - private.pem:', fs.existsSync(PRIVATE_KEY_PATH) ? '✅' : '❌');
  console.warn('   - public.pem:', fs.existsSync(PUBLIC_KEY_PATH) ? '✅' : '❌');
  console.warn('');
  console.warn('   Regenerating keys will INVALIDATE all existing JWTs!');
  console.warn('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
  
  // Wait 5 seconds to allow cancellation
  execSync('timeout 5', { stdio: 'inherit', shell: true });
  console.log('');
}

try {
  // Generate private key (RSA 2048-bit)
  console.log('🔑 Generating private key...');
  execSync(`openssl genrsa -out "${PRIVATE_KEY_PATH}" 2048`, {
    stdio: 'inherit',
  });

  // Extract public key from private key
  console.log('🔓 Extracting public key...');
  execSync(`openssl rsa -in "${PRIVATE_KEY_PATH}" -pubout -out "${PUBLIC_KEY_PATH}"`, {
    stdio: 'inherit',
  });

  console.log('');
  console.log('✅ Key pair generated successfully!');
  console.log('   📁 Private key: keys/private.pem');
  console.log('   📁 Public key:  keys/public.pem');
  console.log('');
  console.log('⚠️  IMPORTANT SECURITY NOTES:');
  console.log('   1. NEVER commit keys/ directory to version control');
  console.log('   2. keys/ is already in .gitignore');
  console.log('   3. Store private.pem securely in production (env vars or secrets manager)');
  console.log('   4. Public key can be shared safely (used only for verification)');
  console.log('');
  console.log('🚀 You can now start the server with: npm run dev');
} catch (error) {
  console.error('');
  console.error('❌ Key generation failed!');
  console.error('');
  console.error('📌 Troubleshooting:');
  console.error('   - Ensure OpenSSL is installed and in PATH');
  console.error('   - Windows: Install from https://slproweb.com/products/Win32OpenSSL.html');
  console.error('   - macOS: OpenSSL is pre-installed');
  console.error('   - Linux: sudo apt install openssl');
  console.error('');
  console.error('Error details:', error.message);
  process.exit(1);
}
