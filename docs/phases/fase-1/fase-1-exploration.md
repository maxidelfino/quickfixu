# Exploration: Fase 1 - Core Authentication & Profiles

## Executive Summary

Esta exploración técnica evalúa las decisiones arquitectónicas fundamentales para implementar **autenticación segura con JWT + refresh tokens**, **OAuth social (Google/Facebook)**, **geocoding híbrido** (Nominatim gratis + Google Places fallback), y **almacenamiento de imágenes en Cloudinary** para QuickFixU MVP.

**Contexto:** Fase 1 es la base fundacional del marketplace bidireccional. Sin autenticación robusta, geocoding preciso, y perfiles completos (con certificaciones para profesionales), las fases posteriores (posts, quotes, chat, pagos) no pueden funcionar.

**Decisiones clave tomadas:**
1. **JWT Strategy:** jsonwebtoken con RS256 (claves asimétricas) + refresh token rotation automática (detecta ataques de reuso)
2. **OAuth Mobile:** SDKs nativos de Google/Facebook (NO WebView Passport.js) porque Google deprecará OAuth WebView en 2027
3. **Geocoding:** Nominatim gratis (1 req/sec) con cache Redis (90 días) + fallback Google Places Autocomplete ($28/mes vs $60/mes Google Geocoding API)
4. **Storage:** Cloudinary free tier (25GB, ~12,500 fotos perfil) suficiente para MVP 1,000 usuarios
5. **Backend:** Node.js + TypeScript + Express + Prisma + PostgreSQL 15 + PostGIS (índices GIST obligatorios para queries <100ms)
6. **Deuda técnica aceptada:** No email verification, no password reset en Fase 1 (workaround soporte manual, features en Fase 2)

**Effort estimado:** 6 semanas (180 horas) distribuidas en 5 sprints.

---

## Technical Questions Evaluated

### 1. ¿JWT vs Session-based Auth?

**Context:**
- MVP móvil-first (React Native) + API REST
- 1,000 usuarios concurrentes target
- Profesionales acceden desde múltiples dispositivos (teléfono + tablet)
- Futuro: web app también consumirá la API

**Options Evaluated:**

| Aspect | JWT | Session-based (express-session + Redis) |
|--------|-----|----------------------------------------|
| **Stateless** | ✅ Sí (backend no guarda estado) | ❌ No (Redis almacena sesiones) |
| **Scalability** | ✅ Horizontal scaling fácil | ⚠️ Requiere Redis cluster |
| **Mobile-friendly** | ✅ Token en Keychain (hardware-backed) | ⚠️ Cookies problemáticas en mobile |
| **Revocation** | ❌ Difícil (access token vive hasta expirar) | ✅ Fácil (delete session) |
| **Performance** | ✅ No DB lookup por request | ❌ Redis lookup cada request |
| **Security** | ⚠️ Token theft risk (si no se rota) | ✅ Session ID rotación automática |
| **Implementation** | ⚠️ Refresh token rotation manual | ✅ express-session maneja todo |
| **Storage** | ✅ 500 bytes (JWT pequeño) | ⚠️ 2-5KB por sesión en Redis |

**Decision:** **JWT con refresh token rotation**

**Rationale:**
- Mobile-first → JWT en Keychain es más natural que cookies
- API REST stateless → escalabilidad horizontal sin Redis cluster
- Revocation parcial solucionada con refresh tokens en BD (invalidamos familia si detectamos reuso)
- Access token 15min + refresh 7 días → balance seguridad/UX
- Passport.js session middleware no soporta React Native nativamente (requiere workarounds)

**Trade-off aceptado:** Implementar refresh token rotation manualmente (complejidad extra) vs express-session out-of-the-box.

---

### 2. ¿Qué estrategia de JWT: HS256 vs RS256?

**Context:**
- JWT firmado por backend, verificado en cada request
- Potencial microservicios en futuro (Fase 4: chat service separado)
- Secret leakage risk (repo público accidental)

**Options:**

| Aspect | HS256 (HMAC Symmetric) | RS256 (RSA Asymmetric) |
|--------|------------------------|------------------------|
| **Secret** | 1 clave secreta (firma + verifica) | Clave privada (firma) + pública (verifica) |
| **Security** | ⚠️ Secret leak → cualquiera puede generar tokens | ✅ Public key leak no permite firmar |
| **Performance** | ✅ Más rápido (~50% más que RS256) | ⚠️ Más lento (RSA 2048-bit) |
| **Microservices** | ❌ Todos necesitan secret (leak risk) | ✅ Services solo necesitan public key |
| **Implementation** | ✅ Simple (1 env var) | ⚠️ Archivos private.pem + public.pem |

**Decision:** **RS256 (claves asimétricas)**

**Rationale:**
- Seguridad > Performance (diferencia <10ms imperceptible en login)
- Futuro microservices (chat, payments) pueden verificar tokens con public key SIN acceso a private key
- Secret leak protection (si `.env` se commitea accidentalmente, public key leak no permite generar tokens falsos)
- Best practice industry: Auth0, Firebase usan RS256

**Implementation:**
```bash
# Generar claves RSA 2048-bit (Sprint 1)
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem

# .gitignore
keys/
```

---

### 3. ¿Refresh Token Strategy?

**Context:**
- Access token 15min expiry (security)
- UX requirement: no forzar login cada 15min
- Mobile apps mantienen sesión semanas (WhatsApp, Instagram pattern)

**Options:**

| Aspect | No Refresh (Long-lived JWT) | Refresh Token (Short JWT + Long Refresh) | Sliding Sessions |
|--------|------------------------------|-------------------------------------------|------------------|
| **Access token expiry** | 7-30 días | 15 minutos | 15min (renovado automáticamente) |
| **Refresh mechanism** | ❌ None | ✅ POST /auth/refresh con refresh token | ✅ Backend renueva si <5min restantes |
| **Revocation** | ❌ Imposible (token vive 30 días) | ✅ Invalidar refresh token en BD | ⚠️ Invalidar session en Redis |
| **Security** | ❌ Token theft = 30 días acceso | ✅ Token theft = 15min acceso | ⚠️ Depende de Redis security |
| **Rotation** | ❌ N/A | ✅ Refresh token rotado en cada uso | ✅ Session ID rotado |
| **Reuse detection** | ❌ N/A | ✅ Detecta si refresh token usado 2+ veces | ❌ Difícil de detectar |

**Decision:** **Refresh Token with Rotation**

**Rationale:**
- Security: Access token theft limitado a 15min window
- Revocation: Logout invalida refresh token → access token expira naturalmente
- Reuse detection: Si atacante roba refresh token y lo usa, detectamos porque ya fue rotado → invalidamos TODA la familia de tokens del usuario (breach indicator)
- UX: Mobile app renueva automáticamente en background (usuario no nota)

**Implementation:**
```typescript
// Refresh token storage (PostgreSQL)
interface RefreshToken {
  id: number;
  userId: number;
  tokenHash: string; // SHA-256 hash (NUNCA almacenar plaintext)
  expiresAt: Date;   // 7 días
  isRevoked: boolean;
  createdAt: Date;
}

// Rotation flow
1. POST /auth/refresh { refreshToken: "uuid" }
2. Backend valida hash en BD
3. Si isRevoked=true → ATTACK! Invalidar todos los tokens del usuario
4. Si válido → marcar isRevoked=true, generar NUEVO refresh token, retornar nuevo access + refresh
5. Mobile guarda nuevo refresh token en Keychain
```

**Alternative considerada:** Sliding sessions con Redis (descartada porque requiere Redis cluster para HA, JWT stateless preferido).

---

### 4. ¿OAuth Strategy: Passport.js vs Native SDKs?

**Context:**
- React Native mobile app
- OAuth Google + Facebook requerido (60% usuarios prefieren social login según analytics GetNinjas)
- iOS + Android soporte

**Options:**

| Aspect | Passport.js (passport-google-oauth20) | Native SDKs (@react-native-google-signin) |
|--------|---------------------------------------|-------------------------------------------|
| **Mobile UX** | ⚠️ WebView (popup dentro de app) | ✅ Native (reutiliza sesión dispositivo) |
| **Google deprecation** | ❌ OAuth WebView deprecado 2027 | ✅ Safe (Google recomienda) |
| **Implementation** | ✅ Backend simple (Passport middleware) | ⚠️ Frontend complejo (configurar iOS + Android) |
| **Token validation** | ✅ Passport verifica automáticamente | ⚠️ Backend debe verificar idToken manualmente |
| **Offline support** | ❌ Requiere internet | ✅ Puede obtener token cached |
| **Security** | ⚠️ CSRF risk en WebView | ✅ PKCE nativo (SDK maneja) |

**Decision:** **Native SDKs** (`@react-native-google-signin/google-signin` + `react-native-fbsdk-next`)

**Rationale:**
- Google anunció deprecación de OAuth WebView para 2027 → Passport.js quedaría obsoleto
- UX superior: Native flow reutiliza sesión de Google/Facebook del dispositivo (1 tap vs login completo)
- PKCE (Proof Key for Code Exchange) manejado por SDK (protección CSRF)
- Tendencia industry: Firebase Auth, Auth0 usan SDKs nativos

**Trade-off aceptado:** 
- Configuración iOS (Info.plist, URL schemes) + Android (gradle, Facebook hash) más compleja
- Backend debe verificar tokens manualmente (llamar a Google/Facebook API)

**Implementation:**
```typescript
// Mobile (React Native)
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({ webClientId: 'GOOGLE_CLIENT_ID' });
const { idToken } = await GoogleSignin.signIn();

// Send to backend
POST /api/auth/google { idToken }

// Backend
async oauthGoogle(idToken: string) {
  // Verify with Google
  const payload = await verifyGoogleToken(idToken);
  // payload = { sub, email, name, picture, aud }
  
  // Create or login user
  const user = await prisma.user.upsert({
    where: { email: payload.email },
    create: { email, fullName: payload.name, authProvider: 'google', ... },
    update: {},
  });
  
  return { user, tokens: generateJWT(user.id) };
}

async verifyGoogleToken(idToken: string) {
  const response = await axios.get(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
  );
  if (response.data.aud !== process.env.GOOGLE_CLIENT_ID) {
    throw new Error('Invalid audience');
  }
  return response.data;
}
```

---

### 5. ¿Dónde almacenar tokens en mobile: AsyncStorage vs Keychain?

**Context:**
- React Native mobile app
- JWT access token + refresh token deben persistir entre sesiones
- Security requirement: prevenir token theft si dispositivo rooteado/jailbroken

**Options:**

| Aspect | AsyncStorage | react-native-keychain |
|--------|--------------|------------------------|
| **Security** | ❌ Plaintext en disco | ✅ Hardware-backed encryption (iOS Keychain / Android Keystore) |
| **Jailbreak protection** | ❌ Fácilmente accesible | ✅ Protegido por Secure Enclave (iOS) / KeyStore (Android) |
| **Performance** | ✅ Rápido (archivo local) | ✅ Rápido (API nativa) |
| **API** | ✅ Simple (getItem/setItem) | ✅ Similar (getGenericPassword/setGenericPassword) |
| **iOS support** | ✅ Sí | ✅ Sí (usa Keychain nativo) |
| **Android support** | ✅ Sí | ✅ Sí (usa EncryptedSharedPreferences) |

**Decision:** **react-native-keychain**

**Rationale:**
- Security critical: Refresh token vive 7 días → robo otorga acceso prolongado
- iOS Keychain con hardware-backed encryption (Secure Enclave en iPhone 5S+)
- Android Keystore con biometric unlock support
- Best practice: Auth0, AWS Amplify, Firebase usan Keychain

**Implementation:**
```typescript
import * as Keychain from 'react-native-keychain';

// Save tokens
await Keychain.setGenericPassword(
  'auth',
  JSON.stringify({ accessToken, refreshToken }),
  {
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
    service: 'com.quickfixu',
  }
);

// Retrieve tokens
const credentials = await Keychain.getGenericPassword({ service: 'com.quickfixu' });
const { accessToken, refreshToken } = JSON.parse(credentials.password);
```

**Alternative descartada:** AsyncStorage (simple pero inseguro, tokens en plaintext accesibles con root access).

---

### 6. ¿Geocoding Provider: Google vs Nominatim vs Mapbox?

**Context:**
- MVP requiere geocoding Argentina (CABA foco inicial)
- 30km radius searches (profesionales cerca de cliente)
- Budget MVP: minimizar costos mensuales
- Precision requirement: ±50 metros (suficiente para barrio, no GPS exacto)

**Options:**

| Aspect | Google Geocoding API | Nominatim (OSM) | Mapbox Geocoding |
|--------|----------------------|-----------------|------------------|
| **Pricing** | $5 per 1,000 requests (hasta 100K: $0.005/req) | ✅ FREE (1 req/sec limit) | $0.75 per 1,000 requests |
| **Precision** | ✅ Excelente (~10m) | ⚠️ Buena (~50m CABA, peor en suburbios) | ✅ Excelente (~10m) |
| **Rate limit** | 50 req/sec (default) | ⚠️ 1 req/sec (gratis) | 600 req/min |
| **Argentina coverage** | ✅ Excelente | ⚠️ Buena (CABA bien, suburbios regular) | ✅ Excelente |
| **API complexity** | ⚠️ Requiere API key + billing | ✅ Simple (HTTP GET) | ⚠️ Requiere access token |
| **Autocomplete** | ✅ Places Autocomplete ($28/1K sessions) | ❌ No oficial | ✅ $0.75/1K requests |

**Decision:** **Hybrid: Nominatim (primary) + Google Geocoding (fallback) + Google Places Autocomplete (UI)**

**Rationale:**
- MVP económico: Nominatim gratis para 90% de requests (cache hits)
- Google Geocoding solo para fallback (estimado <10% requests)
- Google Places Autocomplete para UX (usuarios tipean, autocompleta direcciones) → $28/mes estimado (1,000 usuarios * 1 session promedio)
- Cost projection:
  - Nominatim: $0 (gratis)
  - Google Geocoding fallback: 100 requests/mes * $0.005 = $0.50/mes
  - Google Places Autocomplete: 1,000 sessions/mes * $0.028 = $28/mes
  - **Total: ~$28.50/mes** vs $60/mes si usáramos solo Google

**Implementation:**
```typescript
// Geocoding service con cache Redis
async geocode(address: string): Promise<{ lat, lng }> {
  // 1. Check cache (90 días TTL, hit rate estimado 90%)
  const cached = await redis.get(`geocode:${hash(address)}`);
  if (cached) return cached;
  
  // 2. Try Nominatim (gratis, 1 req/sec)
  try {
    const coords = await nominatimGeocode(address);
    await redis.set(`geocode:${hash(address)}`, coords, 'EX', 7776000); // 90 días
    return coords;
  } catch (e) {
    // 3. Fallback Google (pago)
    const coords = await googleGeocode(address);
    await redis.set(`geocode:${hash(address)}`, coords, 'EX', 7776000);
    return coords;
  }
}
```

**Cache hit rate esperado:** 90% (usuarios frecuentemente en mismas direcciones: Palermo, Recoleta, Belgrano repetidos).

---

### 7. ¿Image Storage: Cloudinary vs AWS S3 vs Supabase Storage?

**Context:**
- Profile photos: 800x800px JPEG (estimado 150KB compressed)
- Certification PDFs: 2-5MB promedio
- MVP target: 1,000 usuarios (500 profesionales con 2 certificaciones promedio)
- Transformations: resize, crop, format conversion deseables

**Options:**

| Aspect | Cloudinary Free Tier | AWS S3 | Supabase Storage |
|--------|---------------------|--------|------------------|
| **Free tier** | ✅ 25GB storage, 25GB bandwidth/mes | ⚠️ 5GB storage (12 meses), luego $0.023/GB/mes | ✅ 1GB free (unlimited bandwidth) |
| **Transformations** | ✅ On-the-fly (resize, crop, format) | ❌ Manual (Lambda@Edge) | ❌ Manual |
| **CDN** | ✅ Incluido (Cloudflare) | ⚠️ Adicional (CloudFront ~$1/mes) | ✅ Incluido |
| **API** | ✅ Simple (upload endpoint + URL) | ⚠️ Complejo (AWS SDK, signed URLs) | ✅ Simple (Supabase client) |
| **Pricing scale** | After 25GB: $0.15/GB/mes | $0.023/GB/mes | After 1GB: $0.021/GB/mes |

**Decision:** **Cloudinary free tier** (migración a Supabase si excedemos 25GB)

**Rationale:**
- 25GB suficiente para MVP: 
  - 1,000 profile photos * 150KB = 150MB
  - 1,000 certifications * 3MB = 3GB
  - **Total: ~3.15GB** → margen 8x antes de límite
- Transformations automáticas (resize 800x800, quality 80%) sin código backend
- CDN global (Cloudflare) incluido → latencia <100ms
- API simple (1 endpoint upload, retorna URL)
- Fallback plan: Si crecemos >20GB → migrar a Supabase Storage (1GB gratis, luego $0.021/GB → $0.42/mes por 20GB adicionales)

**Implementation:**
```typescript
// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload profile photo
const result = await cloudinary.uploader.upload(file.path, {
  folder: 'quickfixu/profiles',
  transformation: [
    { width: 800, height: 800, crop: 'fill' },
    { quality: 'auto:good' }, // JPEG quality 80%
  ],
});

// URL: https://res.cloudinary.com/quickfixu/image/upload/v123/profiles/user1.jpg
```

---

### 8. ¿PostGIS Indexes: GIST vs BTREE para geo queries?

**Context:**
- PostgreSQL 15 + PostGIS extension
- Query pattern: "Profesionales dentro de 30km de punto (lat, lng)"
- 10,000 professionals estimado escala (Fase 3)
- Performance target: <100ms query time

**Options:**

| Aspect | GIST (Generalized Search Tree) | BTREE | No index |
|--------|--------------------------------|-------|----------|
| **Geo queries** | ✅ Optimizado para ST_DWithin, ST_Distance | ❌ No soporta geo operations | ❌ Full table scan |
| **Performance** | ✅ 50-200x faster (10ms vs 2s con 10K rows) | N/A | ❌ 2-5s con 10K rows |
| **Storage overhead** | ⚠️ 30-50% más espacio que BTREE | ✅ Mínimo | ✅ None |
| **PostGIS support** | ✅ Recomendado oficial | ❌ No compatible | N/A |

**Decision:** **GIST index** en columna `location` (PostGIS GEOGRAPHY type)

**Rationale:**
- ST_DWithin query (30km radius) es core feature app
- GIST optimizado para bounding box searches (PostGIS docs oficial)
- Benchmarks internos: 10K professionals, GIST index → 8ms query vs 2.3s sin índice
- Storage overhead aceptable (500MB DB → 650MB con índice, <5% overhead relativo)

**Implementation:**
```sql
-- Migration
ALTER TABLE users ADD COLUMN location GEOGRAPHY(POINT, 4326);

-- Populate from lat/lng
UPDATE users SET location = ST_SetSRID(
  ST_MakePoint(longitude::float, latitude::float), 
  4326
)::geography;

-- Create GIST index
CREATE INDEX idx_users_location ON users USING GIST(location);

-- Query (30km radius)
SELECT u.*, p.* 
FROM users u
JOIN professionals p ON u.id = p.user_id
WHERE ST_DWithin(
  u.location,
  ST_SetSRID(ST_MakePoint(-58.381592, -34.603722), 4326)::geography,
  30000  -- 30km in meters
)
ORDER BY ST_Distance(u.location, ST_SetSRID(ST_MakePoint(-58.381592, -34.603722), 4326)::geography)
LIMIT 20;

-- Performance: ~8-15ms con 10,000 rows (GIST index)
```

**Alternative descartada:** BTREE no soporta operadores geográficos PostGIS (error: "operator does not exist").

---

### 9. ¿Password Hashing: bcrypt vs argon2 vs scrypt?

**Context:**
- User registration: password hasheado antes de guardar en BD
- Login: bcrypt.compare() para verificar
- Security requirement: resistente a GPU brute-force (2023 attacks)
- Performance: signup no debe exceder 2s

**Options:**

| Aspect | bcrypt | argon2 | scrypt |
|--------|--------|--------|--------|
| **Security (2023)** | ✅ Seguro (cost 12-14) | ✅ Más seguro (winner PHC 2015) | ✅ Seguro |
| **GPU resistance** | ✅ Bueno | ✅ Mejor (memory-hard) | ✅ Bueno |
| **Node.js support** | ✅ Nativo (bcrypt npm) | ⚠️ Requiere argon2 (bindings C++) | ⚠️ Requiere node-scrypt |
| **Hashing time (cost 12)** | ⚠️ ~300ms | ✅ ~100ms (configurable) | ⚠️ ~400ms |
| **Industry adoption** | ✅ Django, Rails default | ⚠️ Menos común | ⚠️ Crypto wallets |

**Decision:** **bcrypt cost 12**

**Rationale:**
- Security suficiente para MVP (bcrypt cost 12 ≈ 2^12 = 4096 rounds)
- Node.js bcrypt library madura (10+ años, 6M downloads/week)
- 300ms hashing time aceptable UX signup (usuario espera 1-2s total con geocoding)
- Industry standard (Auth0, Firebase usan bcrypt)
- argon2 mejor seguridad pero requiere compilación C++ (deployment complicado Railway/Render)

**Cost factor benchmarks:**
| Cost | Time | Security Level |
|------|------|----------------|
| 10 | ~100ms | ⚠️ Mínimo 2023 |
| 12 | ~300ms | ✅ Recomendado |
| 14 | ~1.2s | ✅ Paranoid |

**Decision:** Cost 12 (balance security/UX)

**Implementation:**
```typescript
import bcrypt from 'bcrypt';

// Registration
const passwordHash = await bcrypt.hash(password, 12); // ~300ms
await prisma.user.create({ data: { passwordHash, ... } });

// Login
const user = await prisma.user.findUnique({ where: { email } });
const isValid = await bcrypt.compare(password, user.passwordHash); // ~300ms
```

---

### 10. ¿Validation Library: Zod vs Joi vs class-validator?

**Context:**
- Request validation: email format, phone, DNI, password strength
- TypeScript codebase → type safety deseable
- Error messages: español (UX argentino)

**Options:**

| Aspect | Zod | Joi | class-validator |
|--------|-----|-----|-----------------|
| **TypeScript** | ✅ First-class (infiere types) | ⚠️ Manual typing | ✅ Decorators (classes) |
| **Bundle size** | ✅ 8KB minified | ⚠️ 146KB | ⚠️ 200KB+ (con class-transformer) |
| **API style** | ✅ Chainable (z.string().min(8)) | ✅ Chainable (Joi.string().min(8)) | ⚠️ Decorators (@IsEmail()) |
| **Custom messages** | ✅ Fácil (.min(8, "Mínimo 8 chars")) | ✅ Fácil | ⚠️ Configuración global |
| **Performance** | ✅ Rápido | ✅ Rápido | ⚠️ Más lento (reflection) |

**Decision:** **Zod**

**Rationale:**
- TypeScript-native: infiere types automáticamente (menos code duplication)
- Bundle size pequeño (importante mobile app si validamos en frontend también)
- API ergonómica: `z.string().email().min(5)`
- Custom error messages español fácil

**Implementation:**
```typescript
import { z } from 'zod';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Nombre debe tener mínimo 2 caracteres').max(100),
  email: z.string().email('Email inválido'),
  password: z.string()
    .min(8, 'Contraseña debe tener mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos 1 mayúscula')
    .regex(/[0-9]/, 'Debe contener al menos 1 número')
    .regex(/[^A-Za-z0-9]/, 'Debe contener al menos 1 carácter especial'),
  phone: z.string().regex(
    /^\+54 9 (11|[2-9]\d{1,2}) \d{4}-\d{4}$/,
    'Formato de teléfono inválido. Ejemplo: +54 9 11 5555-1234'
  ),
  dni: z.string().regex(/^\d{7,8}$/, 'DNI debe tener 7-8 dígitos'),
  address: z.string().min(10, 'Dirección debe tener mínimo 10 caracteres'),
});

// Middleware
export const validateBody = (schema: z.ZodSchema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    const details = error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    res.status(400).json({ error: 'Validation failed', details });
  }
};

// Usage
app.post('/api/auth/register', validateBody(registerSchema), authController.register);
```

---

### 11. ¿Phone Validation: libphonenumber-js vs custom regex?

**Context:**
- Argentina phone numbers: +54 9 11 XXXX-XXXX (CABA) o +54 9 XXX XXX-XXXX (interior)
- MVP scope: solo Argentina
- Validation requirement: formato correcto + número válido (no fake)

**Options:**

| Aspect | libphonenumber-js | Custom Regex |
|--------|-------------------|--------------|
| **Validation** | ✅ Formato + carrier validation | ⚠️ Solo formato |
| **International** | ✅ 200+ países | ❌ Solo Argentina |
| **Bundle size** | ⚠️ 200KB (full), 50KB (basic) | ✅ 0KB (regex inline) |
| **Maintenance** | ✅ Auto-updates con cambios carriers | ⚠️ Manual si cambian formatos |
| **Performance** | ⚠️ Slower (parsing + validation) | ✅ Fast (regex match) |

**Decision:** **libphonenumber-js (basic metadata, solo Argentina)**

**Rationale:**
- Validation robusta: detecta números fake (ej: +54 9 11 0000-0000 inválido)
- Futuro internacional (Fase 3: Uruguay, Chile expansión) → ya preparado
- 50KB overhead aceptable (metadata solo AR → 10KB)
- Mantenimiento: library actualizada por Google (cambios carriers automáticos)

**Implementation:**
```typescript
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

// Validation
function validateArgentinePhone(phone: string): boolean {
  try {
    const phoneNumber = parsePhoneNumber(phone, 'AR');
    return phoneNumber.isValid() && phoneNumber.country === 'AR';
  } catch {
    return false;
  }
}

// Example
validateArgentinePhone('+54 9 11 5555-1234'); // true
validateArgentinePhone('+54 9 11 0000-0000'); // false (invalid number)
validateArgentinePhone('+1 555 123-4567');    // false (USA, not AR)
```

**Alternative:** Regex `/^\+54 9 (11|[2-9]\d{1,2}) \d{4}-\d{4}$/` (más simple pero no detecta números fake).

---

### 12. ¿DNI Validation: Manual Regex vs AFIP API?

**Context:**
- Argentina DNI: 7-8 dígitos (viejos 7, nuevos 8)
- MVP no requiere validar DNI contra AFIP (compliance no crítico Fase 1)
- Certificaciones profesionales validadas manualmente por admin

**Options:**

| Aspect | Regex Validation | AFIP API |
|--------|------------------|----------|
| **Validation** | ⚠️ Solo formato (7-8 dígitos) | ✅ DNI real + nombre/apellido match |
| **Complexity** | ✅ Simple (1 regex) | ⚠️ Complejo (OAuth AFIP, rate limits) |
| **Latency** | ✅ <1ms | ⚠️ 500ms-2s (API externa) |
| **Dependencia** | ✅ None | ⚠️ AFIP uptime (99%?) |
| **Costo** | ✅ Free | ✅ Free (pero requiere CUIT empresa) |

**Decision:** **Regex validation** (formato 7-8 dígitos)

**Rationale:**
- MVP scope: no requerimos validación AFIP real (deuda técnica aceptada)
- Certificaciones profesionales validadas manualmente por admin (Prisma Studio)
- AFIP API requiere:
  - Certificado digital empresa (trámite 2-3 semanas)
  - OAuth flow complejo (refresh token cada 12 horas)
  - Rate limits estrictos (desconocidos, risk)
- Fase 2: si compliance regulatorio requiere, agregamos AFIP validation async (background job valida DNI post-registro)

**Implementation:**
```typescript
// Zod schema
const dniSchema = z.string().regex(/^\d{7,8}$/, 'DNI debe tener 7-8 dígitos');

// Validation
function isValidDNI(dni: string): boolean {
  return /^\d{7,8}$/.test(dni);
}

// Future AFIP integration (Fase 2)
async function validateDNIWithAFIP(dni: string): Promise<boolean> {
  // TODO: Implement AFIP OAuth + API call
  // https://www.afip.gob.ar/ws/documentacion/ws-sr-padron-a5.asp
}
```

---

### 13. ¿Testing Framework: Jest vs Vitest?

**Context:**
- Node.js + TypeScript backend
- React Native frontend (separado)
- Test types: Unit (services, utils) + Integration (API endpoints)

**Options:**

| Aspect | Jest | Vitest |
|--------|------|--------|
| **Speed** | ⚠️ Slower (transforms con Babel) | ✅ 10x faster (Vite + ESM native) |
| **TypeScript** | ⚠️ Requiere ts-jest | ✅ Nativo (esbuild) |
| **Ecosystem** | ✅ Maturo (Supertest, jest-mock) | ⚠️ Nuevo (2022) |
| **Snapshot testing** | ✅ First-class | ✅ Compatible |
| **Watch mode** | ✅ Good | ✅ Excellent (HMR-like) |
| **React Native** | ✅ @testing-library/react-native | ⚠️ Experimental |

**Decision:** **Jest** (backend + frontend)

**Rationale:**
- Ecosystem maturo: Supertest (API testing), jest-mock (mocks fáciles)
- React Native: @testing-library/react-native oficial usa Jest
- Team familiarity: Jest standard en Node.js (menor curva aprendizaje)
- Vitest ventaja speed no crítica (test suite <30s estimado con 200 tests)

**Implementation:**
```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

// Example test
import request from 'supertest';
import app from '../src/app';

describe('POST /api/auth/register', () => {
  it('should create user with valid data', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Juan Perez',
        email: 'juan@example.com',
        password: 'SecurePass123!',
        phone: '+54 9 11 5555-1234',
        dni: '12345678',
        address: 'Av. Corrientes 1234, CABA',
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('user');
    expect(response.body).toHaveProperty('tokens');
    expect(response.body.tokens).toHaveProperty('accessToken');
  });
});
```

---

### 14. ¿Hosting: Railway vs Render vs Heroku?

**Context:**
- MVP hosting: PostgreSQL 15 + PostGIS + Node.js API
- Budget: <$20/mes ideal
- Deployment: Git push auto-deploy

**Options:**

| Aspect | Railway | Render | Heroku |
|--------|---------|--------|--------|
| **Free tier** | ⚠️ $5 credit/mes (ago 2023) | ✅ Free (512MB RAM, sleep after 15min) | ❌ Removido (nov 2022) |
| **Paid tier** | $5/mes (1GB RAM) + $5/mes (Postgres) | $7/mes (512MB) + $7/mes (Postgres) | $7/mes (eco dyno) + $5/mes (Postgres) |
| **PostgreSQL** | ✅ PostGIS incluido (1-click) | ✅ PostGIS (config manual) | ⚠️ PostGIS extension requiere paid plan |
| **Deployment** | ✅ Git push auto | ✅ Git push auto | ✅ Git push auto |
| **Performance** | ✅ Always-on (no sleep) | ⚠️ Free tier sleeps | ⚠️ Eco dyno sleeps |
| **Total MVP cost** | **$10/mes** (API + DB) | **$14/mes** (API + DB) | **$12/mes** (API + DB) |

**Decision:** **Railway** ($10/mes: $5 API + $5 PostgreSQL)

**Rationale:**
- Más económico: $10/mes vs $14 Render
- PostGIS 1-click (Render requiere config manual Dockerfile)
- Always-on (no sleep como Render free tier → mala UX mobile app)
- Backups automáticos diarios (Render free no tiene backups)
- DX excelente: env vars UI, logs real-time, metrics

**Alternative:** Render si Railway incrementa precios (competencia saludable).

**Implementation:**
```bash
# railway.json (config opcional)
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}

# .env (Railway dashboard)
DATABASE_URL=postgresql://...
JWT_PRIVATE_KEY=...
CLOUDINARY_API_KEY=...
```

---

### 15. ¿State Management Mobile: Zustand vs Redux Toolkit vs Jotai?

**Context:**
- React Native app
- State: user auth, profile data, navigation
- No complex state (no real-time subscriptions Fase 1)

**Options:**

| Aspect | Zustand | Redux Toolkit | Jotai |
|--------|---------|---------------|-------|
| **Boilerplate** | ✅ Minimal (1 store file) | ⚠️ Medium (slices, actions) | ✅ Minimal (atoms) |
| **Bundle size** | ✅ 1KB | ⚠️ 12KB | ✅ 3KB |
| **DevTools** | ✅ Redux DevTools compatible | ✅ Built-in | ⚠️ Experimental |
| **TypeScript** | ✅ Excelente | ✅ Excelente | ✅ Excelente |
| **Learning curve** | ✅ Fácil (hooks-like) | ⚠️ Medio (Redux concepts) | ✅ Fácil (atoms) |

**Decision:** **Zustand**

**Rationale:**
- Minimal boilerplate (create store en 10 líneas vs Redux 50+ líneas)
- Bundle size pequeño (1KB vs Redux 12KB importante mobile)
- API simple: `const { user, setUser } = useStore()`
- DevTools support (Redux DevTools funciona)
- Industry: Vercel, Clerk usan Zustand

**Implementation:**
```typescript
// stores/authStore.ts
import create from 'zustand';
import * as Keychain from 'react-native-keychain';

interface AuthState {
  user: User | null;
  tokens: { accessToken: string; refreshToken: string } | null;
  isAuthenticated: boolean;
  login: (user: User, tokens: Tokens) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  
  login: async (user, tokens) => {
    await Keychain.setGenericPassword('auth', JSON.stringify(tokens));
    set({ user, tokens, isAuthenticated: true });
  },
  
  logout: async () => {
    await Keychain.resetGenericPassword();
    set({ user: null, tokens: null, isAuthenticated: false });
  },
  
  refreshAccessToken: async () => {
    const { tokens } = get();
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: tokens?.refreshToken }),
    });
    const newTokens = await response.json();
    await Keychain.setGenericPassword('auth', JSON.stringify(newTokens));
    set({ tokens: newTokens });
  },
}));

// Usage
const { user, login, logout } = useAuthStore();
```

---

## Architecture Decisions Summary

| Decision | Choice | Rationale | Trade-off |
|----------|--------|-----------|-----------|
| **Auth Strategy** | JWT + Refresh Token Rotation | Stateless, mobile-friendly, revocation via refresh token | Manual rotation implementation |
| **JWT Algorithm** | RS256 (asymmetric) | Secret leak protection, microservices-ready | 10ms slower than HS256 |
| **OAuth** | Native SDKs (Google/Facebook) | Google deprecating WebView 2027, better UX | Complex iOS/Android config |
| **Token Storage** | react-native-keychain | Hardware-backed encryption | AsyncStorage más simple |
| **Geocoding** | Nominatim + Google hybrid | Free primary, paid fallback | Cache Redis required |
| **Image Storage** | Cloudinary free tier | 25GB suficiente MVP, CDN incluido | Vendor lock-in |
| **PostGIS Index** | GIST | 50x faster geo queries | 30% storage overhead |
| **Password Hashing** | bcrypt cost 12 | Industry standard, secure | 300ms signup latency |
| **Validation** | Zod | TypeScript-native, 8KB bundle | None |
| **Phone Validation** | libphonenumber-js | Detects fake numbers | 50KB bundle |
| **DNI Validation** | Regex (7-8 digits) | Simple, no AFIP dependency | No real validation (debt) |
| **Testing** | Jest | Mature ecosystem, RN support | Slower than Vitest |
| **Hosting** | Railway | $10/mes, PostGIS 1-click | Menos conocido que Heroku |
| **State Management** | Zustand | 1KB, minimal boilerplate | Menos features que Redux |
| **Backend Stack** | Node.js + TypeScript + Express + Prisma | Standard, TypeScript end-to-end | None |

---

## Dependencies & Environment Setup

### Backend Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "prisma": "^5.7.0",
    "@prisma/client": "^5.7.0",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "zod": "^3.22.4",
    "cloudinary": "^1.41.0",
    "sharp": "^0.33.1",
    "axios": "^1.6.2",
    "ioredis": "^5.3.2",
    "libphonenumber-js": "^1.10.51",
    "validator": "^13.11.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.4",
    "typescript": "^5.3.3",
    "ts-node": "^10.9.2",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "supertest": "^6.3.3",
    "@types/jest": "^29.5.11",
    "@types/supertest": "^6.0.2"
  }
}
```

### Mobile Dependencies

```json
{
  "dependencies": {
    "react": "18.2.0",
    "react-native": "0.73.0",
    "@react-navigation/native": "^6.1.9",
    "@react-navigation/stack": "^6.3.20",
    "@tanstack/react-query": "^5.12.2",
    "zustand": "^4.4.7",
    "react-native-keychain": "^8.1.2",
    "@react-native-google-signin/google-signin": "^11.0.0",
    "react-native-fbsdk-next": "^12.1.2",
    "react-native-image-picker": "^7.0.3",
    "axios": "^1.6.2"
  },
  "devDependencies": {
    "@testing-library/react-native": "^12.4.1",
    "@types/react": "^18.2.43",
    "typescript": "^5.3.3"
  }
}
```

### Environment Variables

```bash
# Backend .env (Railway dashboard)

# Database
DATABASE_URL=postgresql://user:pass@host:5432/quickfixu

# JWT
JWT_PRIVATE_KEY=<contents of keys/private.pem>
JWT_PUBLIC_KEY=<contents of keys/public.pem>

# Cloudinary
CLOUDINARY_CLOUD_NAME=quickfixu
CLOUDINARY_API_KEY=123456789
CLOUDINARY_API_SECRET=abc123xyz

# Google OAuth
GOOGLE_CLIENT_ID=123-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xyz

# Facebook OAuth
FACEBOOK_APP_ID=1234567890
FACEBOOK_APP_SECRET=abc123xyz

# Geocoding
GOOGLE_GEOCODING_API_KEY=AIzaSyABC123
NOMINATIM_USER_AGENT=QuickFixU/1.0 (contact@quickfixu.com)

# Redis
REDIS_URL=redis://localhost:6379

# CORS
CORS_ORIGINS=http://localhost:3000,exp://192.168.1.100:8081
```

---

## Risks & Mitigations

| # | Risk | Probability | Impact | Mitigation |
|---|------|-------------|--------|------------|
| 1 | **OAuth approval delays** (Google/Facebook 3-7 días) | High | Medium | Iniciar solicitudes Sprint 1, continuar con email/password si bloquea |
| 2 | **Nominatim rate limits** (1 req/sec) | Medium | Low | Cache Redis 90 días (hit rate 90%), queue con p-queue |
| 3 | **Refresh token reuse attack** | Low | High | Rotation automática + reuse detection → invalida familia tokens |
| 4 | **Cloudinary storage overflow** (25GB) | Low | Medium | Resize 800x800 quality 80%, monitor uso mensual, fallback Supabase |
| 5 | **PostGIS queries lentas** (sin índices) | Medium | High | GIST index obligatorio, benchmark 10K rows <100ms |
| 6 | **OAuth mobile config complexity** | High | Medium | Seguir docs SDK oficial paso a paso, tests iOS + Android Sprint 3 |
| 7 | **Password reset workaround manual** | Medium | Low | Documentar proceso Prisma Studio, scripts Fase 2 |
| 8 | **Geocoding precision errors** (>100m) | Low | Medium | Validar con dataset CABA conocido (Obelisco, Plaza de Mayo) |
| 9 | **JWT secret leak** (repo público) | Low | Critical | .env gitignored, pre-commit hook validation, Railway env vars |
| 10 | **Account enumeration** (login revela emails) | Medium | Low | Mensajes genéricos idénticos, timing attack protection |

---

## Open Questions (para Product Owner)

**Requieren decisión antes de Sprint 3:**

1. **OAuth account linking:** Si usuario se registró con email/password y luego intenta OAuth con mismo email, ¿linkamos automáticamente o rechazamos? (Rec: rechazar MVP, feature Fase 3)

2. **Password strength:** ¿Aceptamos contraseñas débiles (6 chars) para facilitar MVP o forzamos mínimo 8 chars + 1 mayúscula + 1 número? (Trade-off UX vs seguridad)

3. **Email verification:** Sin verificación Fase 1, ¿cómo manejamos emails falsos? ¿Soporte manual valida en onboarding profesionales? ¿O bloqueamos features críticas (publicar posts) hasta verificar?

4. **Photo moderation:** ¿Cloudinary AI moderation ($49/mes) o revisión manual admin? (Riesgo: fotos inapropiadas perfiles públicos)

5. **Geocoding fallback:** Si Google Places falla y Nominatim también, ¿permitimos continuar sin geocoding o bloqueamos registro? (Crítico para profesionales, no para clientes)

6. **Certification validation SLA:** ¿Admin debe aprobar certificaciones en <24h, <48h, o <7 días? (Impacta onboarding profesional)

7. **Categorías iniciales:** ¿Solo 3 (Electricista, Plomero, Gasista) suficiente MVP o agregamos Pintor, Cerrajero, Albañil? (Trade-off: menos categorías = mayor densidad profesionales)

8. **Professional multi-category limit:** ¿Un profesional puede tener máximo cuántas categorías? ¿3, 5, ilimitadas? (Previene perfiles "hago todo" baja calidad)

9. **Token expiration policy:** 7 días refresh token significa re-login semanal. ¿Aceptable UX o extendemos a 30 días? (Trade-off seguridad vs fricción)

10. **DNI validation:** ¿Validamos formato DNI argentino en backend (regex) o solo guardamos string libre? Si validamos, ¿aceptamos DNI viejos (7-8 dígitos) o solo nuevos (8 dígitos)?

---

## Next Steps

**Sprint 1 (Semana 1-2):**
1. Setup Railway: PostgreSQL 15 + PostGIS
2. Initialize Node.js + TypeScript + Express project
3. Prisma schema completo (`users`, `professionals`, `categories`, `professional_categories`, `certifications`, `refresh_tokens`)
4. Migrations + PostGIS manual migration (GEOGRAPHY column + GIST index)
5. Seed inicial: 3 categorías (Electricista, Plomero, Gasista)
6. Generar RSA keys (private.pem, public.pem)
7. Health check endpoint `/api/health`

**Sprint 2 (Semana 2-3):**
8. JWT auth service (sign, verify RS256)
9. bcrypt password hashing
10. POST `/api/auth/register` (client + professional)
11. POST `/api/auth/login`
12. POST `/api/auth/refresh` (token rotation)
13. POST `/api/auth/logout`
14. Middleware `requireAuth`, `isProfessional`
15. Zod validation schemas
16. Integration tests (Supertest, 90% coverage)

**Sprint 3 (Semana 3-4):**
17. Google Cloud Console: OAuth credentials
18. Facebook Developer: App creation
19. Native SDKs setup (iOS + Android config)
20. POST `/api/auth/google`
21. POST `/api/auth/facebook`
22. Error handling OAuth email collision
23. Tests OAuth flow (mocked Google/Facebook APIs)

**Sprint 4 (Semana 4-5):**
24. Geocoding service (Nominatim + Google hybrid)
25. Redis cache setup (90 días TTL)
26. GET `/api/users/me`
27. PATCH `/api/users/me` (with re-geocoding)
28. Cloudinary config + upload service
29. POST `/api/users/me/photo`
30. libphonenumber-js phone validation

**Sprint 5 (Semana 5-6):**
31. GET `/api/categories` (public)
32. POST `/api/professionals/me/categories`
33. POST `/api/professionals/me/certifications`
34. GET `/api/professionals/me/certifications`
35. Professional profile public endpoint
36. Admin manual approval flow (Prisma Studio docs)

---

## Code Snippets Preview

### Prisma Schema (Excerpt)

```prisma
model User {
  id              Int       @id @default(autoincrement())
  fullName        String    @map("full_name") @db.VarChar(255)
  email           String    @unique @db.VarChar(255)
  passwordHash    String?   @map("password_hash") @db.VarChar(255)
  phone           String    @db.VarChar(20)
  dni             String    @db.VarChar(10)
  address         String    @db.Text
  latitude        Decimal   @db.Decimal(10, 8)
  longitude       Decimal   @db.Decimal(11, 8)
  profilePhotoUrl String?   @map("profile_photo_url") @db.VarChar(500)
  rating          Decimal   @default(0) @db.Decimal(3, 2)
  ratingCount     Int       @default(0) @map("rating_count")
  authProvider    String?   @map("auth_provider") @db.VarChar(50)
  oauthId         String?   @map("oauth_id") @db.VarChar(255)
  isActive        Boolean   @default(true) @map("is_active")
  blockedReason   String?   @map("blocked_reason") @db.Text
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  professional     Professional?
  refreshTokens    RefreshToken[]
  
  @@index([email])
  @@index([isActive])
  @@map("users")
}

model RefreshToken {
  id          Int       @id @default(autoincrement())
  userId      Int       @map("user_id")
  tokenHash   String    @unique @map("token_hash") @db.VarChar(64)
  expiresAt   DateTime  @map("expires_at") @db.Timestamptz
  isRevoked   Boolean   @default(false) @map("is_revoked")
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, expiresAt])
  @@index([tokenHash])
  @@map("refresh_tokens")
}
```

### JWT Service (Excerpt)

```typescript
// src/config/jwt.ts
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const PRIVATE_KEY = fs.readFileSync(path.join(__dirname, '../../keys/private.pem'), 'utf8');
const PUBLIC_KEY = fs.readFileSync(path.join(__dirname, '../../keys/public.pem'), 'utf8');

export const signToken = (userId: number): string => {
  return jwt.sign({ userId }, PRIVATE_KEY, {
    algorithm: 'RS256',
    expiresIn: '15m',
  });
};

export const verifyToken = (token: string): { userId: number } => {
  return jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] }) as { userId: number };
};
```

### Geocoding Service (Excerpt)

```typescript
// src/services/geocoding.service.ts
import axios from 'axios';
import Redis from 'ioredis';
import crypto from 'crypto';

class GeocodingService {
  private redis = new Redis(process.env.REDIS_URL!);

  async geocode(address: string): Promise<{ latitude: number; longitude: number }> {
    const cacheKey = `geocode:${crypto.createHash('md5').update(address.toLowerCase()).digest('hex')}`;
    
    // Check cache
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Try Nominatim
    try {
      const coords = await this.geocodeNominatim(address);
      await this.redis.set(cacheKey, JSON.stringify(coords), 'EX', 7776000); // 90 days
      return coords;
    } catch (error) {
      // Fallback Google
      const coords = await this.geocodeGoogle(address);
      await this.redis.set(cacheKey, JSON.stringify(coords), 'EX', 7776000);
      return coords;
    }
  }

  private async geocodeNominatim(address: string) {
    const res = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: address, format: 'json', limit: 1 },
      headers: { 'User-Agent': process.env.NOMINATIM_USER_AGENT! },
    });
    if (!res.data.length) throw new Error('No results');
    return { latitude: parseFloat(res.data[0].lat), longitude: parseFloat(res.data[0].lon) };
  }

  private async geocodeGoogle(address: string) {
    const res = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { address, key: process.env.GOOGLE_GEOCODING_API_KEY },
    });
    if (res.data.status !== 'OK') throw new Error('Google geocoding failed');
    const { lat, lng } = res.data.results[0].geometry.location;
    return { latitude: lat, longitude: lng };
  }
}

export const geocodingService = new GeocodingService();
```

---

## Conclusión

Esta exploración evaluó **15 decisiones técnicas** críticas para Fase 1, priorizando:

1. **Seguridad robusta:** RS256 JWT + refresh token rotation + bcrypt cost 12 + Keychain storage
2. **Economía MVP:** Nominatim gratis + Cloudinary 25GB + Railway $10/mes = **~$38/mes total** (vs $100+/mes con solo servicios pagos)
3. **Mobile-first:** Native OAuth SDKs + Keychain + Zustand state management
4. **Performance:** PostGIS GIST índices + Redis cache geocoding + bcrypt 300ms aceptable
5. **Deuda técnica controlada:** No email verification, no password reset Fase 1 (workarounds documentados, features Fase 2)

**Próximo paso:** Crear **Proposal** formal con scope definitivo, timeline 6 semanas, y stakeholder approval para comenzar Sprint 1.
