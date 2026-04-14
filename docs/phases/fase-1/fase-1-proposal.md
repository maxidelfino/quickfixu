# Proposal: Fase 1 - Core Authentication & Profiles

## Executive Summary

QuickFixU necesita una base sólida de autenticación y perfiles de usuario antes de implementar la lógica de negocio core (posts, quotes, chat). Esta fase establece la infraestructura de seguridad, identidad y geocoding que soportará todo el marketplace bidireccional. Implementaremos registro/login con JWT + refresh tokens, OAuth social (Google/Facebook), perfiles editables con fotos (Cloudinary), y geocoding híbrido (Nominatim + Google Places) para búsquedas geográficas de 30km. **Effort estimado: 6 semanas (5 sprints).**

---

## Intent & Motivation

### Problem Statement

Sin un sistema robusto de autenticación y perfiles, no podemos:
- Distinguir entre clientes y profesionales (rol derivado)
- Verificar identidad para transacciones seguras ($10K+ mensuales en pagos retenidos)
- Geolocalizar profesionales/posts con precisión (<100ms queries PostGIS)
- Ofrecer registro social fluido (60% usuarios móviles prefieren OAuth)
- Validar certificaciones profesionales (compliance regulatorio CABA)

### Why Now

**Es la fase fundacional.** Todas las features posteriores dependen de:
1. **Identidad verificada**: Pagos, reputación, chat requieren users autenticados
2. **Geocoding funcional**: El modelo de negocio gira en torno al radio de 30km
3. **Perfiles completos**: Certificaciones profesionales son obligatorias (normativa eléctrica/gas)
4. **OAuth**: 80% de competidores (GetNinjas, Workana) ya ofrecen login social

### User Impact

**Clientes:**
- Registro en <60 segundos (vs 3-4 minutos formulario tradicional)
- Login social sin recordar contraseñas (reduce abandono 40%)
- Dirección geocodificada automática (autocompletar Google Places)

**Profesionales:**
- Perfil completo con foto + certificaciones = 3x más confianza
- Geocoding preciso = solo ven trabajos dentro de su radio real
- OAuth = incorporación rápida (tiempo crítico para profesionales activos)

---

## Scope

### In Scope

1. **Registro email/password** con diferenciación cliente vs profesional
2. **Login email/password** → JWT access token (15min) + refresh token (7 días) en httpOnly cookies
3. **OAuth Google** con `@react-native-google-signin/google-signin` (iOS + Android)
4. **OAuth Facebook** con `react-native-fbsdk-next` (iOS + Android)
5. **Refresh token rotation automática** (detecta ataques de reuso)
6. **Logout** con invalidación de refresh token en BD
7. **Edición de perfil usuario**: nombre, teléfono, dirección, foto
8. **Upload foto perfil** a Cloudinary free tier (25GB)
9. **Geocoding híbrido**: Nominatim (gratis) + Google Places Autocomplete ($28/mes)
10. **Prisma schema + migrations** para: `users`, `professionals`, `categories`, `professional_categories`, `certifications`
11. **PostGIS setup** con índices GIST para queries `ST_DWithin` (<100ms)
12. **Seed inicial**: 3 categorías (Electricista, Plomero, Gasista)

### Out of Scope

- **Email verification flow** (Fase 2) — MVP acepta emails sin verificar, soporte manual valida
- **Password reset** (Fase 2) — Workaround: soporte manual cambia contraseña vía admin panel
- **OAuth account linking** (Fase 3) — Si email existe, por ahora falla registro OAuth (error claro)
- **OCR certificaciones** (Fase 2) — Admin valida PDFs manualmente en MVP
- **Multi-factor authentication** (Fase 4)
- **Apple Sign In** (Fase 3) — Solo Google + Facebook para MVP
- **Geofencing push notifications** (Fase 2)

### Dependencies

**Ninguna.** Esta es la Fase 1 fundacional.

**Bloqueantes externos:**
- Aprobación developer accounts (Google Cloud Console, Facebook App Dashboard) — lead time 3-7 días
- Aprobación Cloudinary free tier (instantánea)
- PostgreSQL 15+ con extensión PostGIS (Railway/Render proveen imagen preconfigurada)

### Affected Components

| Component | Impact | Changes |
|-----------|--------|---------|
| **Backend API** | New | Node.js + Express + TypeScript setup completo |
| **Database** | New | PostgreSQL 15 + PostGIS + Prisma ORM |
| **Mobile App** | New | React Native + navegación auth/main |
| **Auth Layer** | New | JWT middleware, OAuth SDKs, Keychain storage |
| **Storage** | New | Cloudinary integration para imágenes |
| **Geocoding** | New | Nominatim API + Google Places Autocomplete |

---

## Approach

### High-level Strategy

**Backend-first foundation:** Implementamos API REST completa con autenticación JWT antes de construir UI móvil. Esto permite testing exhaustivo con Postman/Supertest antes de integración frontend.

**Seguridad por capas:**
1. **Passwords**: bcrypt cost 12 (~300ms hashing, aceptable para signup)
2. **Tokens**: JWT firmados con RS256 (claves asimétricas), refresh tokens hasheados en BD
3. **Storage**: react-native-keychain con hardware-backed encryption (iOS Keychain/Android Keystore)
4. **Transport**: HTTPS obligatorio, cookies httpOnly + secure + sameSite

**OAuth mobile-native:** SDKs nativos de Google/Facebook (NO WebView Passport.js) porque:
- Google deprecará OAuth WebView en 2027
- UX superior (reutiliza sesión nativa del dispositivo)
- Menos superficie de ataque CSRF

### Implementation Phases

#### Sprint 1: Backend Foundation (Semana 1-2)
**Objetivo:** API lista para recibir requests autenticados

- Node.js + TypeScript + Express setup
- Prisma schema (`users`, `professionals`, `categories`, `professional_categories`, `certifications`)
- PostgreSQL 15 + PostGIS en Railway/Render
- Migrations iniciales
- Seed 3 categorías
- Endpoint health check `/api/health`

**Entregables:**
- `prisma/schema.prisma` completo
- Migrations aplicadas
- API corriendo en `localhost:3000`

---

#### Sprint 2: JWT Authentication (Semana 2-3)
**Objetivo:** Login/registro funcional con tokens

- POST `/api/auth/register` (email, password, role)
- POST `/api/auth/login` → retorna JWT + refresh token en cookies
- POST `/api/auth/refresh` → rota refresh token
- POST `/api/auth/logout` → invalida refresh token
- Middleware `requireAuth` para rutas protegidas
- Bcrypt hashing passwords
- Validaciones con `validator.js`

**Entregables:**
- 4 endpoints auth funcionales
- Tests Supertest con 90%+ coverage
- Documentación Postman collection

---

#### Sprint 3: OAuth Integration (Semana 3-4)
**Objetivo:** Login social Google + Facebook

- Configuración Google Cloud Console (OAuth 2.0 credentials)
- Configuración Facebook Developer App
- `@react-native-google-signin/google-signin` setup iOS + Android
- `react-native-fbsdk-next` setup iOS + Android
- POST `/api/auth/google` (backend valida idToken)
- POST `/api/auth/facebook` (backend valida accessToken)
- Flujo: SDK mobile → token → backend verifica → retorna JWT

**Entregables:**
- OAuth Google funcional ambas plataformas
- OAuth Facebook funcional ambas plataformas
- Error handling para cuenta duplicada

---

#### Sprint 4: User Profiles (Semana 4-5)
**Objetivo:** CRUD perfiles + geocoding

- GET `/api/users/me` (perfil autenticado)
- PATCH `/api/users/me` (editar nombre, teléfono, dirección)
- POST `/api/users/me/photo` (upload Cloudinary)
- Geocoding service (Nominatim API + cache BD)
- Google Places Autocomplete frontend
- Validación `libphonenumber-js` para teléfonos argentinos
- Actualización `users.location` (PostGIS GEOGRAPHY)

**Entregables:**
- Perfiles editables con validaciones
- Foto perfil en Cloudinary
- Direcciones geocodificadas lat/lng

---

#### Sprint 5: Professional Profiles (Semana 5-6)
**Objetivo:** Perfiles profesionales con certificaciones

- GET `/api/professionals/me` (datos profesional autenticado)
- PATCH `/api/professionals/me` (descripción, experiencia, categorías)
- POST `/api/professionals/certifications` (upload PDF Cloudinary)
- GET `/api/professionals/:id` (perfil público profesional)
- Relación many-to-many `professional_categories`
- Estado certificación: `pending`, `approved`, `rejected`

**Entregables:**
- Perfil profesional completo
- Upload certificaciones
- Admin puede aprobar/rechazar (manualmente en Prisma Studio MVP)

---

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Runtime** | Node.js | 20.x LTS |
| **Language** | TypeScript | ^5.0 |
| **Framework** | Express.js | ^4.18 |
| **ORM** | Prisma | ^5.0 |
| **Database** | PostgreSQL | 15+ |
| **Geo Extension** | PostGIS | 3.4+ |
| **Mobile** | React Native | ^0.73 |
| **Navigation** | React Navigation | ^6.0 |
| **State** | Zustand | ^4.5 |
| **HTTP** | React Query | ^5.0 |
| **Auth JWT** | jsonwebtoken | ^9.0 |
| **OAuth Google** | @react-native-google-signin/google-signin | ^11.0 |
| **OAuth Facebook** | react-native-fbsdk-next | ^12.0 |
| **Secure Storage** | react-native-keychain | ^8.1 |
| **Image Upload** | Cloudinary | SDK 1.x |
| **Geocoding** | Nominatim API + Google Places | - |
| **Validation** | validator.js + libphonenumber-js | latest |
| **Testing Backend** | Jest + Supertest | ^29.0 |
| **Testing Mobile** | React Native Testing Library | ^12.0 |
| **Hosting** | Railway o Render | - |

---

### Architecture Patterns

#### JWT Strategy
```
1. Login → Backend genera:
   - Access token (JWT, 15min, payload: userId + role)
   - Refresh token (UUID hasheado en BD, 7 días)
2. Frontend guarda en react-native-keychain
3. Requests → Header: Authorization: Bearer {accessToken}
4. Access token expira → POST /auth/refresh con refreshToken
5. Backend valida refresh token en BD → rota (invalida viejo, genera nuevo)
6. Logout → Backend marca refresh token como revoked
```

#### OAuth Flow (Google ejemplo)
```
1. Mobile: GoogleSignin.signIn() → recibe idToken
2. Mobile → POST /api/auth/google { idToken }
3. Backend valida con Google API (verifica firma + audience)
4. Backend busca user por email o crea nuevo
5. Backend retorna JWT access + refresh tokens
6. Mobile guarda en Keychain
```

#### Geocoding Hybrid
```
1. Usuario tipea dirección → Autocomplete Google Places (UX)
2. Usuario selecciona → Frontend recibe lat/lng de Google
3. Frontend → Backend con dirección completa + lat/lng
4. Backend valida coordenadas con Nominatim (gratis, cache 90%)
5. Si Nominatim falla → fallback Google Geocoding API
6. Backend guarda: users.location = ST_GeogFromText('POINT(lng lat)')
```

#### Middleware Chain
```
Express app:
  → helmet (security headers)
  → cors (allow mobile origins)
  → express.json()
  → rate-limit (100 req/min por IP)
  → routes:
      → /api/auth/* (public)
      → /api/users/* (requireAuth middleware)
      → /api/professionals/* (requireAuth + isProfessional middleware)
  → errorHandler (Prisma errors → HTTP status codes)
```

---

## Risks & Mitigations

| # | Risk | Probability | Impact | Mitigation |
|---|------|-------------|--------|------------|
| 1 | **OAuth approval delays** (Google/Facebook review 3-7 días) | High | Medium | Iniciar solicitudes Sprint 1, continuar con email/password si bloquea |
| 2 | **Nominatim rate limits** (1 req/sec gratis) | Medium | Low | Implementar cache BD (90% hits), queue requests con p-queue |
| 3 | **Refresh token attack** (token robado reusado) | Low | High | Rotation automática: reuso invalida toda familia de tokens |
| 4 | **Cloudinary storage overflow** (25GB free) | Low | Medium | Resize imágenes 800x800 (calidad 80%), monitoreo uso mensual |
| 5 | **PostGIS queries lentas** (sin índices) | Medium | High | Índices GIST obligatorios: `CREATE INDEX idx_users_location ON users USING GIST(location)` |
| 6 | **OAuth mobile config complejidad** (iOS/Android diferentes) | High | Medium | Seguir docs oficiales SDK paso a paso, tests en ambas plataformas Sprint 3 |
| 7 | **Password reset workaround manual** (soporte saturado) | Medium | Low | Documentar proceso admin Prisma Studio, preparar scripts automatizados Fase 2 |
| 8 | **Geocoding precision errors** (<50m requerido) | Low | Medium | Validar con dataset CABA conocido (Obelisco, Plaza de Mayo), alertas si δ > 100m |
| 9 | **JWT secret leak** (repo público accidental) | Low | Critical | Secrets en `.env` NUNCA commiteados, validación pre-commit hook, Railway env vars |
| 10 | **Account enumeration** (endpoint revela emails existentes) | Medium | Low | Login/register retornan mensajes genéricos idénticos, timing attack protection |

---

## Success Criteria

### Functional Requirements Met

- [ ] Usuario puede registrarse como **cliente** (email, password, nombre)
- [ ] Usuario puede registrarse como **profesional** (incluye categorías + certificaciones)
- [ ] Login con email/password genera **JWT válido** (<500ms)
- [ ] **OAuth Google** funciona en iOS y Android (sign-in fluido)
- [ ] **OAuth Facebook** funciona en iOS y Android (sign-in fluido)
- [ ] **Refresh token rotation** automática (access token renovado transparentemente)
- [ ] **Logout** invalida refresh token (reuso falla con 401)
- [ ] **Edición de perfil** actualiza BD (nombre, teléfono, dirección)
- [ ] **Foto de perfil** sube a Cloudinary y retorna URL (formato: `https://res.cloudinary.com/...`)
- [ ] **Dirección geocodifica** a lat/lng correctamente (precisión ±50m en CABA)
- [ ] **PostGIS queries** ejecutan en <200ms (30km radius search con 10K users simulados)

### Non-Functional Requirements

**Performance:**
- POST `/auth/login`: p50 <200ms, p95 <500ms, p99 <1s
- POST `/auth/refresh`: p95 <100ms
- PATCH `/users/me`: p95 <300ms
- Geocoding Nominatim (cache hit): <50ms
- Geocoding Google (cache miss): <500ms

**Security:**
- Bcrypt cost: 12 (balanceado seguridad/UX)
- JWT expiration: access 15min, refresh 7 días
- Tokens en Keychain: hardware-backed encryption
- HTTPS obligatorio producción
- Headers: helmet.js defaults (CSP, HSTS, X-Frame-Options)

**Availability:**
- Uptime objetivo: 99.5% (Railway/Render SLA)
- Health check endpoint: GET `/api/health` (200 si BD conectada)

**Scalability:**
- Soportar 1,000 usuarios concurrentes (target MVP)
- PostGIS queries <100ms hasta 50K professionals

---

## Timeline & Milestones

| Semana | Sprint | Entregables | Horas estimadas |
|--------|--------|-------------|-----------------|
| **1-2** | Sprint 1 | Backend foundation, Prisma schema, PostgreSQL + PostGIS, seeds | 40h |
| **2-3** | Sprint 2 | JWT auth (register, login, refresh, logout), middleware, tests | 35h |
| **3-4** | Sprint 3 | OAuth Google + Facebook, mobile SDKs, backend validation | 40h |
| **4-5** | Sprint 4 | User profiles CRUD, geocoding, Cloudinary upload, Places Autocomplete | 35h |
| **5-6** | Sprint 5 | Professional profiles, certifications upload, categorías many-to-many | 30h |

**Total:** 6 semanas (~180 horas dev time = ~30 días laborables con 6h/día productivas)

**Hitos críticos:**
- ✅ **Día 10:** API autenticación funcional (JWT)
- ✅ **Día 20:** OAuth mobile completo
- ✅ **Día 25:** Perfiles usuario editables
- ✅ **Día 30:** Perfiles profesional + certificaciones

---

## Open Questions for Stakeholders

**Estas 10 preguntas requieren decisión de Product Owner antes de Sprint 3:**

1. **OAuth account linking:** Si un usuario se registró con email/password y luego intenta OAuth con mismo email, ¿linkamos automáticamente las cuentas o rechazamos? (Recomendación: rechazar MVP, feature Fase 3)

2. **Password strength:** ¿Aceptamos contraseñas débiles (6 chars) para facilitar MVP o forzamos mínimo 8 chars + 1 mayúscula + 1 número? (Trade-off UX vs seguridad)

3. **Email verification:** Sin verificación Fase 1, ¿cómo manejamos emails falsos? ¿Soporte manual valida en onboarding profesionales? ¿O bloqueamos features críticas (publicar posts) hasta verificar?

4. **Photo moderation:** ¿Cloudinary AI moderation ($49/mes) o revisión manual admin? (Riesgo: fotos inapropiadas perfiles públicos)

5. **Geocoding fallback:** Si Google Places falla y Nominatim también, ¿permitimos continuar sin geocoding o bloqueamos registro? (Crítico para profesionales, no para clientes)

6. **Certification validation SLA:** ¿Admin debe aprobar certificaciones en <24h, <48h, o <7 días? (Impacta onboarding profesional)

7. **Categorías iniciales:** ¿Solo 3 (Electricista, Plomero, Gasista) suficiente MVP o agregamos Pintor, Cerrajero, Albañil? (Trade-off: menos categorías = mayor densidad profesionales por categoría)

8. **Professional multi-category limit:** ¿Un profesional puede tener máximo cuántas categorías? ¿3, 5, ilimitadas? (Previene perfiles "hago todo" baja calidad)

9. **Token expiration policy mobile:** 7 días refresh token significa re-login semanal. ¿Aceptable UX o extendemos a 30 días? (Trade-off seguridad vs fricción)

10. **DNI validation:** ¿Validamos formato DNI argentino en backend (regex) o solo guardamos string libre? Si validamos, ¿aceptamos DNI viejos (7-8 dígitos) o solo nuevos (8 dígitos)?

---

## Rollback Plan

### Si falla deployment completo (crash crítico):
1. **Railway/Render**: Rollback a deployment anterior con 1 click (guardan últimos 10 deployments)
2. **Base de datos**: Restore snapshot PostgreSQL (Railway hace backups automáticos cada 24h)
3. **Downtime estimado**: 5-10 minutos

### Si falla OAuth (proveedores rechazan app):
1. **Feature flag**: Deshabilitar botones OAuth en mobile
2. **Fallback**: Solo email/password funcional
3. **Comunicación**: Banner "Login social temporalmente deshabilitado"

### Si falla Cloudinary (cuota excedida):
1. **Graceful degradation**: Permitir perfiles sin foto (placeholder default)
2. **Alternative**: Migrar a Supabase Storage (gratis 1GB) con código compatible
3. **Código preparado**: Interface `StorageProvider` permite swap sin refactor

### Si falla Geocoding (APIs down):
1. **Fallback**: Permitir registro sin geocoding preciso
2. **Background job**: node-cron cada hora reintenta geocodificar direcciones NULL
3. **Manual**: Admin puede geocodificar manualmente en Prisma Studio

### Migraciones Prisma reversibles:
```bash
# Crear migration
npx prisma migrate dev --name add_certifications

# Si falla, rollback
npx prisma migrate resolve --rolled-back <migration-name>
```

**Política de rollback:**
- Migrations destructivas (DROP columna) requieren aprobación manual
- Migrations aditivas (ADD columna) son safe y auto-aplicables

---

## Dependencies

### External Services

| Service | Purpose | Approval Lead Time | Fallback |
|---------|---------|-------------------|----------|
| Google Cloud Console | OAuth credentials | 3-7 días | Email/password solo |
| Facebook Developer | OAuth app review | 3-7 días | Email/password solo |
| Cloudinary | Image hosting | Instantáneo | Supabase Storage |
| Nominatim | Free geocoding | No approval | Google Geocoding API |
| Railway/Render | Hosting PostgreSQL + API | Instantáneo | Switch entre ambos |

### Internal Prerequisites

- Ninguno (Fase 1 es fundacional)

### Blockers

- **Hard blocker:** PostgreSQL 15+ con PostGIS (sin esto, no hay geocoding)
- **Soft blocker:** OAuth approvals (podemos lanzar con email/password solo)

---

## Related Documents

- [`docs/PRD.md`](../PRD.md) — Product Requirements Document (2095 líneas)
- [`docs/03-DataModel.md`](../03-DataModel.md) — Modelo de datos completo (1427 líneas)
- [`docs/PostgreSQL-Indexes.sql`](../PostgreSQL-Indexes.sql) — Índices PostGIS optimizados
- [`docs/phases/fase-1-exploration.md`](./fase-1-exploration.md) — Exploración técnica (15 decisiones evaluadas)
- **Next artifacts:** `fase-1-spec.md` (especificaciones detalladas), `fase-1-design.md` (arquitectura técnica)

---

**End of Proposal**
