# Proposal: Fase 2 - Posts & Proposals

**Change name:** `fase-2-posts-proposals`  
**Date:** Marzo 2026  
**Status:** Proposal  
**Prerequisite:** Fase 1 (Core Authentication & Profiles) MUST be completed

---

## 1. Executive Summary

Fase 2 implementa el **núcleo transaccional de QuickFixU**: clientes publican problemas (`posts`), profesionales envían presupuestos (`proposals`), y se inicia la negociación. Sin esta fase, la plataforma es solo un directorio sin capacidad de generar transacciones.

**Complejidad:** ALTA — Incluye upload multimedia, geolocalización 30km, paginación cursor-based, cronjobs expiración, y notificaciones push.

**Duración estimada:** 16 días (3 semanas sprint, 1 desarrollador full-time)

**Risk level:** MEDIUM — Dependencias externas (Cloudinary bandwidth, PostGIS performance), abuse prevention crítico.

---

## 2. Intent & Motivation

### Problem
- Clientes no pueden solicitar servicios (app sin funcionalidad core)
- Profesionales no pueden ofertar presupuestos
- Sin flujo transaccional, no hay revenue posible

### User Need
- **Cliente:** "Necesito urgente un electricista, quiero subir fotos del problema y recibir presupuestos rápido"
- **Profesional:** "Quiero ver trabajos cerca de mi ubicación y enviar presupuestos competitivos"

### Business Value
- Habilita primera transacción (milestone PMF)
- Datos para validar pricing y comisiones
- Feed activo = engagement retention

---

## 3. Scope

### In Scope (Fase 2)

#### 3.1 Posts (Publicaciones Cliente)
- ✅ Crear post: título, descripción, ubicación, categorías, multimedia (5 imágenes + 2 videos)
- ✅ Upload con Multer + Cloudinary (límites: 5MB imgs, 50MB videos, timeout 30s)
- ✅ Feed profesionales: filtro geográfico 30km (PostGIS `ST_DWithin`)
- ✅ Paginación cursor-based (`createdAt + id` para evitar duplicados)
- ✅ Estados: `open → closed/expired`
- ✅ Expiración automática 48hs (cronjob cada 1 hora)
- ✅ Soft delete 90 días post-cierre, hard delete 180 días después
- ✅ Rate limit: 10 posts/día por cliente (abuse prevention)
- ✅ Privacy: truncar coordenadas a 2 decimales (±1km) en feed

#### 3.2 Proposals (Presupuestos Profesional)
- ✅ Crear propuesta: precio (ARS 500-100K), descripción, fecha/hora agendada
- ✅ Validación: 1 sola propuesta por profesional por post (constraint DB)
- ✅ Editar propuesta `pending` (sin tabla `proposal_history` en MVP)
- ✅ Aceptar/rechazar propuesta por cliente
- ✅ Transacción atómica: aceptar propuesta → cerrar post → rechazar otras propuestas
- ✅ Estados: `pending → accepted/rejected/expired`
- ✅ Expiración automática 48hs (cronjob)

#### 3.3 Feed & Geolocalización
- ✅ Feed profesionales: posts filtrados por:
  - Radio 30km (PostGIS)
  - Categorías del profesional
  - Status `open` y no expirados
- ✅ Paginación cursor-based (índice `created_at DESC, id DESC`)
- ✅ Performance: <200ms con 10K posts activos

#### 3.4 Notificaciones Push (FCM)
- ✅ Eventos críticos:
  - Profesional envía propuesta → notificar cliente
  - Cliente acepta propuesta → notificar profesional
  - Cliente rechaza propuesta → notificar profesional
  - Post/Proposal a punto expirar (24hs antes) → notificar owner
- ✅ Tabla `notifications` para historial in-app
- ✅ Endpoints: listar, marcar leída, marcar todas leídas

#### 3.5 Cronjobs
- ✅ Expiración posts/proposals: cada 1 hora
- ✅ Soft delete posts antiguos: diario 3am
- ✅ Hard delete posts: semanal domingos 4am

#### 3.6 Chat Auto-Creación
- ✅ Crear registro en tabla `chats` cuando profesional envía propuesta
- ✅ Sin mensajes ni WebSockets (Fase 3)
- ✅ Solo marca "conversación activa" entre cliente-profesional

### Out of Scope (Fases Posteriores)

#### Fase 3: Chat & Real-time
- ❌ Mensajes chat (tabla `messages` + Socket.io)
- ❌ WebSockets tiempo real
- ❌ Notificación "nuevo post en zona" (spam risk)
- ❌ Queue asíncrono videos (Bull + Redis)
- ❌ Tabla `proposal_history` (audit trail negociaciones)

#### Fase 4: Payments & Appointments
- ❌ Integración MercadoPago
- ❌ Payment retention/escrow
- ❌ Appointments (agendar visita técnica)
- ❌ Estado post `completed` (después de pago)

#### Fase 5: Reputation
- ❌ Reviews cliente → profesional
- ❌ Reviews profesional → cliente (bidireccional)
- ❌ Rating promedio en perfiles

---

## 4. Approach

### Sprint 1: Database & Core Entities (5 días)
1. **Prisma schema** (2 días)
   - Modelos: `Post`, `PostCategory`, `PostMedia`, `Proposal`, `Chat`, `Notification`
   - Relaciones con `User`, `Professional`, `Category`
   - Migraciones + raw SQL PostGIS (trigger `update_post_location`)
   - Índices: GIST spatial, compound (`status, expires_at`), cursor pagination (`created_at DESC, id DESC`)

2. **Seeds & test data** (1 día)
   - 3 clientes, 5 profesionales, 10 posts, 20 proposals
   - Estados variados (`open/closed/expired`, `pending/accepted/rejected`)

3. **Services layer** (2 días)
   - `PostService`: CRUD, upload media, validaciones
   - `ProposalService`: crear, aceptar/rechazar, transacción atómica
   - `FeedService`: query geográfica + paginación cursor

### Sprint 2: API & Upload (6 días)
4. **Posts endpoints** (3 días)
   - `POST /api/posts` — Multer config (5 imgs + 2 vids), Cloudinary upload, rate limit
   - `GET /api/posts` — Feed profesionales (geo + categorías + paginación)
   - `GET /api/posts/:id` — Detalle post
   - `PATCH /api/posts/:id` — Editar (solo si 0 propuestas)
   - `GET /api/posts/me` — Historial cliente
   - Middleware: `requireClient`, `requirePostOwnership`

5. **Proposals endpoints** (2 días)
   - `POST /api/proposals` — Crear propuesta, validar 1 por profesional
   - `PATCH /api/proposals/:id` — Editar `pending`
   - `POST /api/proposals/:id/accept` — Transacción atómica
   - `POST /api/proposals/:id/reject` — Rechazar
   - `GET /api/posts/:postId/proposals` — Propuestas de post
   - `GET /api/proposals/me` — Historial profesional

6. **Upload service** (1 día)
   - Extender `UploadService` para videos (transcode H.264)
   - Timeout 30s, retry lógica
   - Validación tipos MIME

### Sprint 3: Notifications & Cronjobs (5 días)
7. **Notifications** (2 días)
   - Extender `NotificationService` (eventos nuevos)
   - Endpoints: `GET /api/notifications`, `PATCH /:id/read`, `PATCH /read-all`
   - Integration tests FCM sandbox

8. **Cronjobs** (1 día)
   - `CronService`: expiración (1 hora), soft delete (diario), hard delete (semanal)
   - Monitoring: logs structured (Winston)

9. **Testing E2E** (2 días)
   - Happy path: crear post → enviar propuesta → aceptar → verificar estados
   - Edge cases: race conditions, expiración concurrente, upload timeout
   - Integration: Cloudinary uploads, PostGIS queries

**Total:** 16 días (flex +2 días para bugs y ajustes finales)

---

## 5. Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | Agregar 6 modelos (Post, PostCategory, PostMedia, Proposal, Chat, Notification) |
| `prisma/migrations/` | New | Migraciones + raw SQL PostGIS triggers |
| `prisma/seed.ts` | Modified | Seeds posts + proposals + chats |
| `src/services/` | New | PostService, ProposalService, FeedService, CronService |
| `src/services/upload.service.ts` | Modified | Extender para videos |
| `src/services/notification.service.ts` | Modified | Agregar eventos (new_proposal, proposal_accepted, etc.) |
| `src/controllers/` | New | PostController, ProposalController, NotificationController |
| `src/middleware/` | New | requireClient, requirePostOwnership, postRateLimiter |
| `src/routes/` | New | posts.routes.ts, proposals.routes.ts, notifications.routes.ts |
| `src/config/constants.ts` | Modified | Rangos precio propuesta, límites upload |
| `src/jobs/` | New | Cronjobs (expiración, soft/hard delete) |
| `package.json` | Modified | Agregar: multer, node-cron |
| `docs/API.md` | New | Documentar endpoints Posts, Proposals, Notifications |

---

## 6. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Cloudinary bandwidth exhaustion** (free tier 25GB/mes) | MEDIUM | HIGH | Monitorear uso semanal, alert >80%, script migración S3 pre-planeado. Límite 2 videos/post reduce consumo. |
| **Abuse: cliente spam posts** (bots, competencia) | MEDIUM | MEDIUM | Rate limit 10 posts/día. Admin dashboard detectar >20 posts/día (flag manual). Captcha Fase 3. |
| **Race condition: 2 clientes aceptan misma propuesta** | LOW | HIGH | Transacción `prisma.$transaction` con row-level lock. Constraint DB check status válido. |
| **Privacy leak: ubicación exacta cliente** | HIGH | MEDIUM | Truncar coordenadas a 2 decimales en feed (±1km). Dirección completa solo después aceptar propuesta (Fase 3 chat). |
| **Upload timeout videos grandes** (>50MB) | MEDIUM | LOW | Timeout 30s, mensaje error claro. Frontend comprime video (react-native-video-processing). Queue async Fase 3 si >20% fallan. |
| **Cronjob no ejecuta (servidor down)** | LOW | MEDIUM | Frontend valida `expires_at` localmente. Query filtra `expires_at > NOW()`. Monitoring alert si no ejecuta 2hs. |
| **PostGIS performance degradation** (>50K posts) | LOW | MEDIUM | Índice GIST validado <200ms con 10K. Redis Geo cache post-PMF si >500ms. |

---

## 7. Rollback Plan

### Fase 2 Incompleta (medio sprint)
1. Mantener rama `main` en Fase 1 (auth + profiles)
2. Rama feature `feat/fase-2-posts-proposals` para desarrollo
3. No merge hasta testing E2E completo

### Fase 2 en Producción con Bugs Críticos
1. **Rollback inmediato DB:**
   - No es posible (migraciones agregan tablas nuevas)
   - Alternativa: deshabilitar endpoints Posts/Proposals vía feature flag
   
2. **Feature flags:**
   ```typescript
   // config/features.ts
   export const FEATURES = {
     POSTS_ENABLED: process.env.ENABLE_POSTS === 'true',
     PROPOSALS_ENABLED: process.env.ENABLE_PROPOSALS === 'true',
   };
   
   // Middleware
   if (!FEATURES.POSTS_ENABLED) {
     return res.status(503).json({ error: 'Feature temporarily disabled' });
   }
   ```

3. **Data integrity:**
   - Posts/proposals creados quedan en BD (no eliminar)
   - Cronjobs detener vía `node-cron.stop()`
   - Notificaciones FCM pausar (no enviar)

4. **Recovery:**
   - Hotfix en rama `hotfix/fase-2-*`
   - Testing acelerado (solo regresión crítica)
   - Deploy con reactivación feature flags

---

## 8. Dependencies

### Infrastructure (Ya Existentes Fase 1)
- ✅ PostgreSQL 15+ con PostGIS
- ✅ Redis (cache geocoding)
- ✅ Cloudinary (free tier)
- ✅ Firebase Cloud Messaging (FCM)
- ✅ Node.js + Express + Prisma

### NPM Packages (Nuevos)
```json
{
  "multer": "^1.4.5-lts.1",
  "@types/multer": "^1.4.11",
  "node-cron": "^3.0.3",
  "@types/node-cron": "^3.0.11"
}
```

### External APIs
- Cloudinary API (upload)
- FCM (push notifications)
- Nominatim (geocoding reverse — ya integrado)

### Team Dependencies
- **DevOps:** Confirmar Cloudinary free tier disponible + Redis running
- **Security:** Revisar rate limits + validaciones precio
- **Product:** Aprobar scope features (posts + proposals)

---

## 9. Success Criteria

### Functional
- [ ] Cliente puede crear post con 5 imágenes + 2 videos
- [ ] Profesional ve feed filtrado por ubicación 30km + categorías
- [ ] Profesional puede enviar 1 propuesta por post
- [ ] Cliente puede aceptar propuesta (post se cierra, otras propuestas rechazadas)
- [ ] Notificaciones push recibidas en eventos críticos
- [ ] Posts expiran automáticamente 48hs (cronjob)
- [ ] Soft delete posts 90 días post-cierre

### Performance
- [ ] Feed profesionales <200ms con 10K posts activos
- [ ] Upload 5 imágenes <5s (Cloudinary)
- [ ] Upload 1 video <30s (Cloudinary transcode)
- [ ] Paginación cursor-based sin duplicados

### Security
- [ ] Rate limit 10 posts/día efectivo
- [ ] Ubicación truncada a 2 decimales en feed
- [ ] Transacción aceptar propuesta sin race conditions
- [ ] Middleware autorización (requireClient, requireProfessional)

### Data Integrity
- [ ] Constraint 1 propuesta por profesional por post
- [ ] Estados válidos (posts: open/closed/expired, proposals: pending/accepted/rejected)
- [ ] Soft delete no afecta queries activos (`deleted_at IS NULL`)

---

## 10. Open Questions

### Q1: ¿Límite de posts abiertos simultáneos por cliente?
**Status:** Pendiente decisión Product  
**Options:**
- Sin límite (riesgo abuse)
- Máx 5 posts open simultáneos

**Recommendation:** Implementar límite 5 en MVP (ajustable en `constants.ts`).

---

### Q2: ¿Permitir editar post después de recibir propuestas?
**Status:** Propuesta técnica  
**Recommendation:** ❌ Bloquear edición si post tiene >0 propuestas (invalidaría presupuestos existentes).

```typescript
if (post.proposals.length > 0) {
  throw new AppError(400, 'No puedes editar un post que ya tiene propuestas. Cierra este post y crea uno nuevo.');
}
```

---

### Q3: ¿Cliente puede ver cuántas propuestas tiene un post?
**Status:** Pendiente decisión Product  
**Options:**
- ✅ Mostrar contador "5 propuestas recibidas" (genera urgencia profesional)
- ❌ Ocultar (profesional no ve competencia)

**Recommendation:** ✅ Mostrar contador (transparencia aumenta engagement).

---

## 11. Timeline & Milestones

| Milestone | Duración | Entregable | Fecha Estimada |
|-----------|----------|------------|----------------|
| **M1: Database & Models** | 5 días | Schema Prisma + migrations + seeds | Día 5 |
| **M2: API Endpoints** | 6 días | Posts CRUD + Proposals CRUD + upload | Día 11 |
| **M3: Notifications & Jobs** | 5 días | FCM events + cronjobs + tests E2E | Día 16 |
| **Total** | 16 días | Fase 2 completa y testeada | Día 16 |

**Hitos de validación:**
- Día 5: Demo interno BD (crear post + propuesta en seed)
- Día 11: Demo endpoints (Postman collection funcional)
- Día 16: Demo E2E (cliente → post → profesional → propuesta → aceptar)

---

## 12. Related Documents

| Document | Location | Description |
|----------|----------|-------------|
| Exploration Fase 2 | `docs/phases/fase-2-exploration.md` | Análisis técnico detallado (450 líneas) |
| Data Model | `docs/03-DataModel.md` | Schema completo BD (inclye posts/proposals) |
| PRD | `docs/PRD.md` | Requerimientos producto completo |
| API Spec (Post-Fase 2) | `docs/API.md` | Endpoints documentados (crear después implementar) |

---

## 13. Approval Checklist

Antes de proceder a `sdd-spec`:

- [ ] **Product Owner:** Aprueba scope features (posts + proposals + notifs)
- [ ] **Tech Lead:** Revisa decisiones arquitectura (Cloudinary, paginación, cronjobs)
- [ ] **DevOps:** Confirma Cloudinary free tier + Redis disponible
- [ ] **Security:** Aprueba validaciones precio + rate limits
- [ ] **Fase 1 completa:** Auth + profiles + geocoding funcionando en staging

---

**Next Step:** Ejecutar `sdd-spec` para especificación detallada con escenarios de uso.
