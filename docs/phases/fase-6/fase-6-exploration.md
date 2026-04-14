# Exploration: Fase 6 - Admin Panel & OCR Certification Validation

**Change name:** `fase-6-admin-panel-ocr`  
**Date:** Marzo 2026  
**Status:** Exploration Complete  
**Prerequisite:** Fase 4 (Payments & Appointments) MUST be completed, Fase 5 (Reviews) optional

---

## 1. Executive Summary

La Fase 6 implementa **dos pilares críticos** del negocio QuickFixU:
1. **Panel de Administración Web** — Dashboard React.js para gestión operativa
2. **OCR Certificaciones** — Validación automática + manual de matrículas profesionales con Tesseract.js

Sin esta fase, el negocio NO puede operar a escala: certificaciones se validan manualmente en Prisma Studio (bottleneck), disputas se resuelven por email/WhatsApp (caos), no hay visibilidad de métricas (ceguera operativa), contenido inapropiado no se modera (riesgo legal).

**Complejidad:** ALTA — Esta fase tiene complejidad DUAL:
- **Frontend:** Aplicación web completa (React.js) separada de mobile app
- **Backend:** OCR pipeline con Tesseract.js + preprocesamiento de imágenes + queue async
- **Operativa:** Workflows mediación humana para disputas + certificaciones edge cases

**Decisiones clave tomadas:**

| Decisión | Opción Seleccionada | Justificación |
|----------|---------------------|---------------|
| **Admin Panel Stack** | React.js + TypeScript + Material-UI (MUI) + React Query | Consistencia con mobile (React Native), Material-UI es battle-tested para dashboards empresariales, React Query simplifica state management de API calls. |
| **Admin Auth** | Tabla `admins` separada con flag `is_super_admin`, login separado `/admin/login`, JWT con claim `role: 'admin'` | Separar users de admins evita escalada privilegios (user compromised ≠ admin access). Super admin puede crear/bloquear otros admins. |
| **OCR Library** | Tesseract.js v5 en Node.js backend (NO browser) | PRD especifica Tesseract.js (económico vs AWS Textract). Backend procesa PDFs/imágenes, extrae texto, parsea con regex. Browser-based OCR sería lento + consume ancho banda cliente. |
| **OCR Queue** | Bull + Redis para jobs async | Upload certificación → enqueue job OCR → worker procesa en background (no bloquea request). Permite retry automático si Tesseract falla (timeout, imagen corrupta). |
| **Image Preprocessing** | sharp (resize, grayscale, contrast, deskew) ANTES de Tesseract | OCR accuracy mejora 20-40% con preprocesamiento: escala de grises reduce ruido, contrast threshold binariza texto, deskew corrige rotación. |
| **PDF Handling** | pdf-poppler (convierte PDF → PNG pages) → Tesseract procesa cada página | Certificaciones vienen como PDF multipágina. Poppler extrae imágenes, Tesseract OCR por página, backend concatena resultados. |
| **OCR Accuracy Threshold** | Confidence >60% → auto-pending, <60% → flag "low confidence" en admin UI | Tesseract devuelve confidence score (0-100). Si bajo, admin sabe que debe revisar con más cuidado. NO auto-aprobar certificaciones (riesgo legal). |
| **Regex Parsing** | Diccionario de patterns por tipo certificación (gasista, electricista, plomero) | Ejemplo gasista: `MATRÍCULA.*?(\d{4,8})`, `VENCIMIENTO.*?(\d{2}[-/]\d{2}[-/]\d{4})`. Admin puede agregar/editar patterns en BD (tabla `certification_patterns`). |
| **Admin Dispute Resolution** | Estados: `open` → `investigating` → `resolved_refund` / `resolved_payout` / `resolved_split` / `closed_no_action` | Flujo lineal simple. Admin ve chat history + payment details + fotos evidencia, decide acción. Refund/payout se ejecutan vía MP API desde panel. |
| **Refund/Payout desde Panel** | Botones "Refund Total" / "Refund Parcial" / "Payout Profesional" llaman backend endpoints protegidos con auth admin | Backend valida que admin tiene permiso `resolve_disputes`, ejecuta MP API, actualiza payment/dispute status, notifica usuarios vía FCM. |
| **Content Moderation** | Queue manual en admin panel (posts/perfiles reportados por usuarios) + botón "Delete & Ban" | MVP sin AI moderation (Cloudinary AI Moderation $49/mes post-PMF). Usuarios pueden reportar contenido inapropiado → entra en queue admin → admin revisa → elimina + banea usuario si necesario. |
| **Analytics Dashboard** | Charts.js para gráficos, queries SQL agregados en backend, cache Redis 5 minutos | KPIs: GMV mensual, transacciones/día, usuarios registrados, profesionales activos, conversion funnel. No real-time (refresh cada 5min OK para admin). |
| **Admin Logs** | Tabla `admin_actions` (admin_id, action_type, entity_type, entity_id, details JSONB, timestamp) | Auditoría completa: qué admin aprobó/rechazó qué certificación, quién hizo refund, quién baneó usuario. Filtros en UI por admin, fecha, tipo acción. |
| **MFA Admin** | NO en MVP — password fuerte + rate limiting login suficiente | MFA (Authy, Google Authenticator) es post-PMF. MVP: password min 12 chars, bcrypt cost 12, rate limit 5 intentos/10min por IP. |

**Features a entregar:**

### Bloque 1: Admin Panel Base
1. ✅ Aplicación React.js separada (carpeta `/admin-panel`, build independiente)
2. ✅ Login admin (`/admin/login`) con JWT separado de users
3. ✅ Sidebar navegación: Dashboard, Usuarios, Profesionales, Certificaciones, Disputas, Pagos, Posts, Logs
4. ✅ Tabla `admins` con campos: `id`, `email`, `password_hash`, `full_name`, `is_super_admin`, `is_active`
5. ✅ Super admin puede crear otros admins (POST `/api/admin/admins/create`)
6. ✅ Middleware backend `requireAdmin` valida JWT claim `role: 'admin'`

### Bloque 2: Dashboard Analytics
7. ✅ Card KPIs: Usuarios totales, Profesionales activos (≥1 trabajo/mes), GMV mes actual, Transacciones mes actual
8. ✅ Gráfico líneas: Registros/día últimos 30 días
9. ✅ Gráfico barras: Transacciones/día últimos 30 días
10. ✅ Gráfico líneas: GMV/día últimos 30 días (acumulativo)
11. ✅ Top 5 profesionales: más trabajos completados, mejor rating (≥20 reviews)
12. ✅ Conversion funnel: Registros → Posts → Propuestas → Pagos → Completados (últimos 30 días)
13. ✅ Filtros time range: Hoy, Semana, Mes, Año
14. ✅ Queries SQL cached en Redis (TTL 5 minutos)

### Bloque 3: Gestión Usuarios
15. ✅ Lista paginada usuarios (50 por página, cursor-based pagination)
16. ✅ Filtros: role (client/professional), status (active/blocked), fecha registro
17. ✅ Search por nombre, email, DNI (full-text con pg_trgm)
18. ✅ Vista detalle usuario: perfil completo + historial transacciones + reviews recibidas
19. ✅ Botón "Bloquear Usuario" → modal motivo → actualiza `users.is_active = false`, `users.blocked_reason`
20. ✅ Botón "Desbloquear Usuario" (solo super admin)
21. ✅ Notificación FCM a usuario bloqueado: "Tu cuenta fue suspendida. Motivo: [X]. Contacta soporte."

### Bloque 4: OCR Certificaciones
22. ✅ Queue Bull job `process-certification-ocr` al subir certificación
23. ✅ Worker OCR: PDF → Poppler PNG → sharp preprocessing → Tesseract.js
24. ✅ Preprocesamiento sharp: grayscale, resize 2000px width, normalize contrast, sharpen
25. ✅ Tesseract language `spa` (español), PSM mode `3` (automatic page segmentation)
26. ✅ Extracción regex según tipo certificación (tabla `certification_patterns`)
27. ✅ Guardar resultado en `certifications.ocr_data` (JSON: raw_text, confidence, extracted_fields)
28. ✅ Si confidence <60% → flag `low_confidence` en admin UI
29. ✅ Retry automático 3 veces si Tesseract timeout/error

### Bloque 5: Gestión Certificaciones
30. ✅ Lista certificaciones `status = 'pending'` ordenada por `created_at ASC` (más antiguas primero)
31. ✅ Card certificación: profesional nombre, tipo cert, número extraído OCR, fecha subida
32. ✅ Vista detalle: imagen original (lado izquierdo) + OCR data editable (lado derecho)
33. ✅ Admin puede editar campos OCR si incorrecto (type, number, issue_date, expiry_date)
34. ✅ Botón "Aprobar" → actualiza `status='approved'`, `reviewed_by=admin.id`, `reviewed_at=NOW()`
35. ✅ Botón "Rechazar" → modal motivo → actualiza `status='rejected'`, `rejection_reason`
36. ✅ Si aprobar → verificar al menos 1 certificación aprobada → `professionals.is_verified = true`
37. ✅ Notificación FCM profesional: "Certificación aprobada" o "Certificación rechazada. Motivo: [X]. Puedes re-subir."
38. ✅ Stats panel: Promedio tiempo aprobación, % aprobadas vs rechazadas, queue size

### Bloque 6: Gestión Disputas
39. ✅ Lista disputas `status IN ('open', 'investigating')` ordenada por `created_at ASC`
40. ✅ Filtros: tipo (payment_issue, review_appeal), estado, fecha
41. ✅ Vista detalle disputa:
    - Info appointment: fecha, profesional, cliente, monto
    - Payment details: method, status, commission, net_amount
    - Chat history completo (read-only)
    - Fotos evidencia subidas por reporter
    - Textarea admin notes (solo visible admins)
42. ✅ Timeline SLA: badge "⏰ Resolver en <48hs" si `created_at < 48 hours ago`
43. ✅ Botones acción:
    - "Refund Total" → llama `POST /api/admin/disputes/:id/refund-total`
    - "Refund Parcial" → modal monto + motivo → `POST /api/admin/disputes/:id/refund-partial`
    - "Payout Profesional" → libera pago si estaba retenido
    - "Eliminar Review" (solo si dispute type = review_appeal)
    - "Cerrar sin acción" → marca `status='closed_no_action'`
44. ✅ Backend ejecuta MP API refund/payout, actualiza dispute status, notifica usuarios
45. ✅ Admin actions logueadas en `admin_actions` table

### Bloque 7: Gestión Pagos
46. ✅ Lista payments con filtros: status, payment_method, date range, monto min/max
47. ✅ Vista detalle payment: proposal, appointment, confirmations, dispute (si existe)
48. ✅ Botón "Force Payout" (solo super admin) → fuerza payout aunque no haya confirmación mutua
49. ✅ Lista refunds: payment, monto, reason, status, created_at
50. ✅ Stats: Total transacciones mes, GMV, comisiones cobradas, refunds emitidos

### Bloque 8: Moderación Contenido
51. ✅ Tabla `content_reports` (reporter_id, entity_type, entity_id, reason, status, created_at)
52. ✅ Endpoint mobile `POST /api/reports/create` → crea report
53. ✅ Lista reports `status='open'` en admin panel
54. ✅ Vista detalle: contenido reportado (post + imágenes O perfil usuario)
55. ✅ Botones:
    - "Eliminar Contenido" → soft delete (posts.deleted_at = NOW())
    - "Bloquear Usuario" → users.is_active = false
    - "Descartar Reporte" → reports.status = 'dismissed'
56. ✅ Admin actions logueadas

### Bloque 9: Logs y Monitoring
57. ✅ Tabla `admin_actions` (campos arriba)
58. ✅ Vista logs filtrable: admin, acción, entidad, fecha
59. ✅ Export CSV logs (útil auditoría)
60. ✅ Panel errores: últimos 50 errores críticos (integración Sentry SDK frontend)
61. ✅ Webhook logs: últimos 100 webhooks MP (request body, signature validation, response)

**Riesgos identificados:**

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| **OCR baja accuracy (<50%)** en certificaciones con calidad mala (foto borrosa, PDF escaneado bajo DPI) | ALTO — Admin debe transcribir manualmente, bottleneck | Rechazar uploads <300 DPI (validar con sharp metadata). Tutorial usuario: "Toma foto con buena luz, sin sombras". Mostrar preview antes upload. |
| **Tesseract timeout** en PDFs >10 páginas | MEDIO — Job falla, profesional no recibe feedback | Límite 5 páginas por certificación (validar en upload). Si >5 páginas → rechazar con error "Certificación muy larga, sube solo páginas relevantes". |
| **Admin accidentalmente aprueba certificación falsa** (OCR extrajo datos pero documento es fake) | CRÍTICO — Profesional sin matrícula real empieza a trabajar, riesgo legal QuickFixU | Checkbox "Confirmo que verifiqué manualmente documento" obligatorio en UI. Admin actions logueadas (accountability). Auditoría random 10% certificaciones aprobadas por admin senior. |
| **Disputa refund/payout ejecutado dos veces** (admin hace doble-click botón) | CRÍTICO — Doble refund = pérdida dinero | Botón disabled después primer click + loading spinner. Backend idempotencia: WHERE `dispute.status = 'investigating'` en UPDATE (si ya resuelto → error). |
| **Admin panel sin MFA** comprometido (password leaked) | CRÍTICO — Atacante puede refund fraudulento, borrar usuarios | Rate limiting login (5 intentos/10min), password strength min 12 chars, bcrypt cost 12. Log de logins fallidos (Sentry alert si >20 en 1 hora). Post-MVF: MFA obligatorio. |
| **Regex parsing falla** (nueva certificación formato diferente) | MEDIO — OCR no extrae datos, admin debe transcribir | Admin puede editar OCR fields manualmente (siempre). Botón "Reportar Formato Nuevo" → alerta dev para agregar regex pattern. |
| **Queue Bull Redis down** → OCR jobs no procesan | ALTO — Certificaciones quedan stuck en pending sin OCR | Health check endpoint `/api/health` valida Redis + Bull queue. Alert Sentry si Redis unreachable. Fallback: endpoint manual `POST /api/admin/certifications/:id/retry-ocr` (admin trigger). |
| **Dashboard queries lentas** (agregados SQL sin índices) | MEDIO — Panel tarda >5s cargar | Índices en campos filtrados (created_at, status). Cache Redis 5min. Queries optimizadas (EXPLAIN ANALYZE). Si >10K payments → materialized views (Postgres). |
| **Admin borra usuario con transacciones activas** | ALTO — Foreign key cascade deletes payments/appointments | Soft delete solo (users.is_active = false). Hard delete requiere super admin + confirmación "BORRAR" text input. Validar 0 appointments activos antes hard delete. |

**Ready for proposal:** ✅ YES — Arquitectura definida, stack seleccionado (React + MUI + React Query), OCR pipeline completo, workflows mediación claros, plan de auditoría y logs.

---

## 2. Current State (Post Fase 4)

### Ya Tenemos Implementado:
✅ Tabla `certifications` con campos: `id`, `professional_id`, `certification_type`, `certification_number`, `document_url`, `ocr_data`, `status`, `reviewed_by`, `reviewed_at`, `rejection_reason`  
✅ Tabla `disputes` (Fase 4) con campos: `id`, `appointment_id`, `reporter_id`, `reason`, `evidence_urls`, `status`, `admin_notes`, `resolved_at`  
✅ Tabla `payments` con `mercadopago_payment_id` para refunds  
✅ MercadoPago API integration (refunds endpoint POST /v1/payments/:id/refunds)  
✅ FCM push notifications infrastructure  
✅ Cloudinary storage (certifications ya se suben allí en Fase 1)  
✅ JWT auth backend con middleware `requireAuth`  
✅ Redis para cache (geocoding, puede extenderse para Bull queues)  
✅ Prisma ORM con PostgreSQL 15  

### Tablas a Crear (Fase 6):

```sql
-- Migration: 20260322_create_admins_table
CREATE TABLE admins (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL, -- bcrypt cost 12
  full_name VARCHAR(255) NOT NULL,
  is_super_admin BOOLEAN DEFAULT FALSE, -- Solo super admins pueden crear/bloquear admins
  is_active BOOLEAN DEFAULT TRUE, -- Bloquear admin comprometido
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_admins_email ON admins(email);
CREATE INDEX idx_admins_is_active ON admins(is_active);

-- Seed: Admin inicial (crear manualmente con script)
INSERT INTO admins (email, password_hash, full_name, is_super_admin)
VALUES ('admin@quickfixu.com', '$2b$12$...', 'Admin QuickFixU', TRUE);

-- Migration: 20260322_create_admin_actions_table
CREATE TABLE admin_actions (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,
  action_type VARCHAR(50) NOT NULL, -- 'approve_cert', 'reject_cert', 'refund_payment', 'ban_user', etc.
  entity_type VARCHAR(50) NOT NULL, -- 'certification', 'payment', 'user', 'dispute'
  entity_id INTEGER NOT NULL, -- ID de la entidad afectada
  details JSONB, -- Info adicional (ej: {"reason": "Certificación falsa", "amount_refunded": 5000})
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_admin_actions_admin_id ON admin_actions(admin_id);
CREATE INDEX idx_admin_actions_entity ON admin_actions(entity_type, entity_id);
CREATE INDEX idx_admin_actions_created_at ON admin_actions(created_at DESC);

-- Migration: 20260322_create_content_reports_table
CREATE TABLE content_reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('post', 'user', 'review')),
  entity_id INTEGER NOT NULL,
  reason TEXT NOT NULL, -- "Contenido inapropiado", "Spam", "Perfil falso"
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'action_taken')),
  resolved_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_content_reports_status ON content_reports(status) WHERE status = 'open';
CREATE INDEX idx_content_reports_entity ON content_reports(entity_type, entity_id);
CREATE INDEX idx_content_reports_created_at ON content_reports(created_at DESC);

-- Migration: 20260322_create_certification_patterns_table
CREATE TABLE certification_patterns (
  id SERIAL PRIMARY KEY,
  certification_type VARCHAR(100) NOT NULL, -- "Matrícula Gasista", "Carnet Electricista"
  field_name VARCHAR(50) NOT NULL, -- "number", "issue_date", "expiry_date", "holder_name"
  regex_pattern TEXT NOT NULL, -- Regex para extraer campo (ej: "MATRÍCULA.*?(\d{4,8})")
  example_value VARCHAR(255), -- Ejemplo (ej: "12345")
  is_active BOOLEAN DEFAULT TRUE, -- Admin puede deshabilitar patterns obsoletos
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cert_patterns_type ON certification_patterns(certification_type);

-- Seed: Patterns comunes
INSERT INTO certification_patterns (certification_type, field_name, regex_pattern, example_value) VALUES
  ('Matrícula Gasista', 'number', 'MATR[ÍI]CULA.*?(\d{4,8})', '12345'),
  ('Matrícula Gasista', 'issue_date', 'EMISI[ÓO]N.*?(\d{2}[-/]\d{2}[-/]\d{4})', '10/01/2020'),
  ('Matrícula Gasista', 'expiry_date', 'VENCIMIENTO.*?(\d{2}[-/]\d{2}[-/]\d{4})', '10/01/2030'),
  ('Carnet Electricista', 'number', 'N[°Ú]MERO.*?(\d{4,8})', '56789'),
  ('Carnet Electricista', 'issue_date', 'FECHA.*?(\d{2}[-/]\d{2}[-/]\d{4})', '15/03/2021');
```

### Nuevos Endpoints Backend (Fase 6):

```typescript
// Admin Auth
POST /api/admin/login
  Body: { email, password }
  Response: { token: "jwt...", admin: { id, email, full_name, is_super_admin } }

POST /api/admin/admins/create (super admin only)
  Body: { email, password, full_name }
  Response: { admin: { id, email, ... } }

// Analytics
GET /api/admin/analytics/dashboard
  Query: ?timeRange=month
  Response: { kpis: {...}, charts: {...}, topProfessionals: [...], conversionFunnel: {...} }

// Usuarios
GET /api/admin/users
  Query: ?page=1&role=professional&status=active&search=nombre
  Response: { users: [...], pagination: {...} }

GET /api/admin/users/:id
  Response: { user: {...}, transactions: [...], reviews: [...] }

POST /api/admin/users/:id/block
  Body: { reason: "Spam posts" }
  Response: { success: true }

POST /api/admin/users/:id/unblock (super admin only)

// Certificaciones
GET /api/admin/certifications/pending
  Response: { certifications: [...] }

GET /api/admin/certifications/:id
  Response: { certification: {...}, professional: {...}, ocrData: {...} }

POST /api/admin/certifications/:id/approve
  Body: { edited_fields?: { number, issue_date, ... } }
  Response: { success: true }

POST /api/admin/certifications/:id/reject
  Body: { reason: "Documento ilegible" }
  Response: { success: true }

POST /api/admin/certifications/:id/retry-ocr (manual trigger)

// Disputas
GET /api/admin/disputes
  Query: ?status=open&type=payment_issue
  Response: { disputes: [...] }

GET /api/admin/disputes/:id
  Response: { dispute: {...}, appointment: {...}, payment: {...}, chat_messages: [...] }

POST /api/admin/disputes/:id/refund-total
  Body: { admin_notes: "Cliente tiene razón, trabajo incompleto" }
  Response: { success: true, refund: {...} }

POST /api/admin/disputes/:id/refund-partial
  Body: { amount: 2500, admin_notes: "..." }

POST /api/admin/disputes/:id/payout-professional

POST /api/admin/disputes/:id/close-no-action

// Pagos
GET /api/admin/payments
  Query: ?status=completed&dateFrom=2026-03-01&dateTo=2026-03-31
  Response: { payments: [...], stats: {...} }

POST /api/admin/payments/:id/force-payout (super admin only)

// Moderación
GET /api/admin/reports
  Query: ?status=open
  Response: { reports: [...] }

POST /api/admin/reports/:id/delete-content

POST /api/admin/reports/:id/ban-user
  Body: { reason: "Contenido inapropiado" }

POST /api/admin/reports/:id/dismiss

// Logs
GET /api/admin/actions
  Query: ?admin_id=1&action_type=refund_payment&dateFrom=...
  Response: { actions: [...] }

GET /api/admin/actions/export-csv

GET /api/admin/webhooks/logs
  Response: { webhooks: [...] } // Últimos 100 webhooks MP
```

---

## 3. Technical Options Evaluated

### 3.1 Admin Panel: Separate App vs Integrated in Mobile

**Contexto:** ¿Construir admin panel como app React.js separada o agregar rutas admin en React Native mobile app?

#### Opción A: React.js Web App Separada ✅

**Arquitectura:**
```
quickfixu/
├── mobile-app/          # React Native (ya existe)
│   ├── src/
│   ├── package.json
│   └── App.tsx
├── admin-panel/         # React.js NUEVO
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Certifications.tsx
│   │   │   ├── Disputes.tsx
│   │   │   └── Users.tsx
│   │   ├── components/
│   │   ├── api/         # React Query hooks
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts   # Bundler: Vite
├── backend/             # Node.js + Express (ya existe)
└── package.json         # Workspace root (opcional)
```

**Stack:**
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@mui/material": "^5.15.0",         // Material-UI
    "@mui/x-data-grid": "^6.18.0",      // Tablas con filtros/paginación
    "@mui/x-date-pickers": "^6.18.0",   // Date range pickers
    "@tanstack/react-query": "^5.17.0", // State management API
    "recharts": "^2.10.0",              // Gráficos analytics
    "axios": "^1.6.0",
    "react-hook-form": "^7.49.0",       // Forms
    "zod": "^3.22.0",                   // Validación
    "date-fns": "^3.0.0"                // Date utils
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.3.0",
    "@types/react": "^18.2.0"
  }
}
```

**Deployment:**
```bash
# Build
cd admin-panel
npm run build  # Output: dist/

# Deploy a Railway/Render (Nginx sirve static files)
# O deploy a Cloudflare Pages / Vercel (gratis para static sites)
```

**Pros:**
- ✅ **Ecosistema maduro:** MUI tiene componentes enterprise (DataGrid, Charts, DatePickers)
- ✅ **Performance:** Web bundle más liviano que React Native (no incluye código mobile)
- ✅ **Desarrollo rápido:** Hot reload Vite (<1s), debugging browser DevTools
- ✅ **SEO/Accessibility:** No crítico para admin, pero buen extra
- ✅ **Deployment fácil:** Static site (dist/) se hostea en CDN gratis (Cloudflare Pages)
- ✅ **Responsive:** Funciona en desktop + tablet (admins usan laptop/desktop mayormente)

**Cons:**
- Codebase adicional (2 frontends: mobile + admin)
- Mitigation: Compartir tipos TypeScript entre mobile/admin/backend (monorepo Nx o Turborepo)

**Veredicto:** ✅ **RECOMENDADO** — Standard industria. Admin panels son SIEMPRE web apps.

---

#### Opción B: Rutas Admin en React Native Mobile App 🔴

**Idea:**
```typescript
// mobile-app/src/navigation/index.tsx
<Stack.Navigator>
  {userRole === 'admin' ? (
    <>
      <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
      <Stack.Screen name="AdminCertifications" component={AdminCertifications} />
    </>
  ) : (
    <>
      <Stack.Screen name="Home" component={Home} />
      {/* ... rutas normales */}
    </>
  )}
</Stack.Navigator>
```

**Pros:**
- 1 solo codebase (mobile-app)
- Admins pueden usar app mobile para tareas urgentes (aprobar certificación desde celular)

**Cons:**
- ❌ **UX terrible:** Tablas complejas en pantalla 6" es horrible, gráficos ilegibles
- ❌ **Componentes limitados:** React Native NO tiene equivalente MUI DataGrid (tablas con sort/filter)
- ❌ **Performance:** Admins usan desktop, no necesitan app mobile
- ❌ **Confusión:** Mixing admin UI con user UI en mismo bundle

**Veredicto:** ❌ **RECHAZADO** — Anti-pattern. Admins trabajan en desktop.

---

### 3.2 OCR: Tesseract.js Backend vs Browser-Based

**Contexto:** ¿Dónde ejecutar OCR: en servidor Node.js o en browser del admin?

#### Opción A: Tesseract.js en Backend Node.js Worker ✅

**Arquitectura:**
```typescript
// backend/src/services/ocr.service.ts
import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import pdf2pic from 'pdf2pic';

export async function processOCR(certificationId: number) {
  const cert = await prisma.certification.findUnique({ where: { id: certificationId } });
  
  // 1. Descargar archivo de Cloudinary
  const fileBuffer = await downloadFile(cert.document_url);
  
  // 2. Si PDF → convertir a imágenes
  let images: Buffer[];
  if (cert.document_url.endsWith('.pdf')) {
    images = await convertPDFToImages(fileBuffer); // pdf-poppler
  } else {
    images = [fileBuffer];
  }
  
  // 3. Preprocesar cada imagen
  const processedImages = await Promise.all(
    images.map(img => preprocessImage(img)) // sharp
  );
  
  // 4. OCR con Tesseract
  const ocrResults = await Promise.all(
    processedImages.map(img => runTesseract(img))
  );
  
  // 5. Parsear con regex
  const extractedFields = parseOCRText(ocrResults, cert.certification_type);
  
  // 6. Guardar resultado
  await prisma.certification.update({
    where: { id: certificationId },
    data: {
      ocr_data: {
        raw_text: ocrResults.map(r => r.text).join('\n'),
        confidence: averageConfidence(ocrResults),
        extracted_fields: extractedFields,
      },
      certification_number: extractedFields.number,
      issue_date: extractedFields.issue_date,
      expiry_date: extractedFields.expiry_date,
    },
  });
}

async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize({ width: 2000 }) // Tesseract funciona mejor con imágenes grandes
    .grayscale()              // Escala de grises reduce ruido
    .normalize()              // Auto-ajusta contraste
    .sharpen()                // Mejora bordes texto
    .toBuffer();
}

async function runTesseract(imageBuffer: Buffer): Promise<any> {
  const worker = await Tesseract.createWorker('spa', 1, {
    // logger: (m) => console.log(m), // Debug
  });
  
  const { data } = await worker.recognize(imageBuffer, {
    tessedit_pageseg_mode: Tesseract.PSM.AUTO, // Auto page segmentation
  });
  
  await worker.terminate();
  return data;
}

function parseOCRText(results: any[], certificationType: string): any {
  const fullText = results.map(r => r.text).join('\n');
  const patterns = await prisma.certificationPattern.findMany({
    where: { certification_type: certificationType, is_active: true },
  });
  
  const extracted: any = {};
  
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.regex_pattern, 'i');
    const match = fullText.match(regex);
    if (match && match[1]) {
      extracted[pattern.field_name] = match[1].trim();
    }
  }
  
  return extracted;
}

// Queue Bull job
import Bull from 'bull';
const ocrQueue = new Bull('ocr-certifications', { redis: REDIS_URL });

ocrQueue.process(async (job) => {
  const { certificationId } = job.data;
  await processOCR(certificationId);
});

// Trigger al subir certificación
router.post('/api/professionals/me/certifications', requireAuth, upload.single('file'), async (req, res) => {
  // ... validaciones, upload Cloudinary
  
  const certification = await prisma.certification.create({
    data: {
      professional_id: professionalId,
      certification_type: req.body.type,
      document_url: cloudinaryUrl,
      status: 'pending',
    },
  });
  
  // Enqueue OCR job
  await ocrQueue.add({ certificationId: certification.id }, {
    attempts: 3, // Retry hasta 3 veces
    backoff: { type: 'exponential', delay: 5000 },
  });
  
  res.json({ certification });
});
```

**Pros:**
- ✅ **Performance:** Servidor tiene CPU/RAM dedicado, OCR procesa en segundos
- ✅ **No bloquea UI:** Job async, usuario ve "Procesando..." y recibe notificación cuando termina
- ✅ **Retry automático:** Si Tesseract falla (timeout, imagen corrupta), Bull reintenta
- ✅ **Escalable:** Workers Bull se pueden escalar horizontalmente (múltiples servidores)
- ✅ **Preprocesamiento:** sharp solo funciona en Node.js (no browser)

**Cons:**
- CPU intensivo (servidor debe tener suficiente RAM para Tesseract)
- Mitigation: Railway/Render ofrecen instancias con 4GB RAM suficiente para MVP

**Veredicto:** ✅ **RECOMENDADO** — Standard para OCR server-side.

---

#### Opción B: Tesseract.js en Browser (Admin Panel) 🟡

**Idea:**
```typescript
// admin-panel/src/pages/Certifications.tsx
import { createWorker } from 'tesseract.js';

async function handleApprove(certificationId: number) {
  // Descargar imagen de Cloudinary
  const imageUrl = certification.document_url;
  
  // OCR en browser
  const worker = await createWorker('spa');
  const { data: { text } } = await worker.recognize(imageUrl);
  await worker.terminate();
  
  // Mostrar resultado en UI para que admin edite
  setOcrText(text);
}
```

**Pros:**
- No requiere backend OCR (menos código)
- Admin ve OCR procesarse en tiempo real (progress bar)

**Cons:**
- ❌ **Performance horrible:** OCR de 1 PDF 5 páginas = 30-60 segundos en browser
- ❌ **Consume ancho banda admin:** Descarga archivo completo al browser
- ❌ **No retry:** Si falla, admin debe refrescar página manualmente
- ❌ **Sin preprocesamiento:** sharp no funciona en browser (Canvas API es limitado)

**Veredicto:** 🟡 **Solo si backend OCR falla** — Puede ser fallback manual.

---

### 3.3 OCR Image Preprocessing: sharp vs ImageMagick

**Contexto:** Tesseract accuracy mejora 20-40% con preprocesamiento. ¿Qué librería usar?

#### Opción A: sharp (Node.js) ✅

**Ya usamos sharp en Fase 1 para resize profile photos**, extendemos para OCR:

```typescript
async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize({ width: 2000 }) // Tesseract recomienda 300 DPI ~ 2000px width para A4
    .grayscale()              // RGB → Grayscale reduce ruido color
    .normalize()              // Auto-ajusta histogram (mejora contraste)
    .sharpen({ sigma: 1.5 })  // Acentúa bordes texto
    .threshold(128)           // Binarización (blanco/negro puro) — opcional si normalize suficiente
    .toBuffer();
}
```

**Técnicas avanzadas (post-MVP si accuracy <60%):**
```typescript
// Deskew (corregir rotación)
// Requiere librería adicional (deskew npm) o implementación custom
// No es trivial, skip MVP

// Denoise (reducir ruido salt-and-pepper)
.median(3) // Filtro mediana (sharp soporta)

// Morphological operations (eliminar manchas)
// Sharp NO soporta directamente, requiere ImageMagick
```

**Pros:**
- ✅ Ya instalado (Fase 1)
- ✅ Rápido (libvips C++ backend)
- ✅ Suficiente para MVP (resize + grayscale + normalize cubre 80% casos)

**Cons:**
- No tiene morphological operations avanzadas (erosion/dilation)

**Veredicto:** ✅ **RECOMENDADO MVP** — Buena accuracy con operaciones básicas.

---

#### Opción B: ImageMagick (via imagemagick npm wrapper) 🟡

```typescript
import { convert } from 'imagemagick';

convert([
  inputPath,
  '-resize', '2000x',
  '-type', 'Grayscale',
  '-normalize',
  '-sharpen', '0x1',
  '-morphology', 'close', 'rectangle:1x10', // Conectar caracteres rotos
  outputPath
], (err, stdout) => { /* ... */ });
```

**Pros:**
- Morphological operations avanzadas (útil para certificaciones muy dañadas)

**Cons:**
- Requiere ImageMagick instalado en servidor (Railway/Render puede no tenerlo por default)
- Wrapper Node.js es spawn subprocess (más lento que sharp)

**Veredicto:** 🟡 **Post-MVP si accuracy <60%** — Migrar si sharp no suficiente.

---

### 3.4 Admin Auth: Unified Users Table vs Separate Admins Table

**Contexto:** ¿Admins son filas en tabla `users` con `role='admin'` o tabla separada?

#### Opción A: Tabla `admins` Separada ✅

**Schema:**
```sql
CREATE TABLE admins (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  is_super_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Login endpoint separado:**
```typescript
router.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;
  
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin || !admin.is_active) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = jwt.sign(
    { id: admin.id, role: 'admin', is_super: admin.is_super_admin },
    JWT_SECRET,
    { expiresIn: '8h' } // Admins tienen sesiones más largas que users (no mobile)
  );
  
  res.json({ token, admin: { id: admin.id, email: admin.email, full_name: admin.full_name } });
});
```

**Middleware protección:**
```typescript
export function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden - Admins only' });
    }
    
    req.adminId = decoded.id;
    req.isSuperAdmin = decoded.is_super;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireSuperAdmin(req, res, next) {
  requireAdmin(req, res, () => {
    if (!req.isSuperAdmin) {
      return res.status(403).json({ error: 'Super admin only' });
    }
    next();
  });
}
```

**Pros:**
- ✅ **Seguridad:** Escalada privilegios imposible (user.id ≠ admin.id, diferentes tablas)
- ✅ **Auditoría:** admin_actions.admin_id FK a `admins`, no contamina tabla users
- ✅ **Permisos claros:** is_super_admin flag simple
- ✅ **Login separado:** /admin/login vs /auth/login (UX clara)

**Cons:**
- Tabla adicional (complejidad mínima)

**Veredicto:** ✅ **RECOMENDADO** — Best practice security.

---

#### Opción B: Campo `role` en Tabla `users` 🔴

**Schema:**
```sql
ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'client' CHECK (role IN ('client', 'professional', 'admin'));
```

**Pros:**
- 1 sola tabla (más simple)

**Cons:**
- ❌ **Escalada privilegios:** Si atacante compromete user JWT, puede modificar role a 'admin' (si hay bug validation)
- ❌ **Conflicto roles:** Usuario es admin Y profesional? (posible pero raro, confuso)
- ❌ **Auditoría mezclada:** admin_actions.admin_id apunta a users.id (mezcla users normales con admins)

**Veredicto:** ❌ **RECHAZADO** — Riesgo seguridad innecesario.

---

### 3.5 Dispute Resolution: Manual Refund vs Automated Workflow

**Contexto:** ¿Admin ejecuta refunds manualmente en MercadoPago dashboard o desde admin panel?

#### Opción A: Refund/Payout desde Admin Panel ✅

**Implementación:**
```typescript
// Endpoint: POST /api/admin/disputes/:id/refund-total
router.post('/api/admin/disputes/:id/refund-total', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { admin_notes } = req.body;
  
  const dispute = await prisma.dispute.findUnique({
    where: { id: parseInt(id) },
    include: { appointment: { include: { payment: true } } },
  });
  
  if (!dispute || dispute.status !== 'investigating') {
    return res.status(400).json({ error: 'Dispute not in investigating status' });
  }
  
  const payment = dispute.appointment.payment;
  
  // 1. Ejecutar refund en MercadoPago
  try {
    const refund = await mercadopago.refund.create({
      payment_id: payment.mercadopago_payment_id,
      amount: parseFloat(payment.amount),
    });
    
    // 2. Actualizar payment
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'refunded' },
    });
    
    // 3. Crear registro refund
    await prisma.refund.create({
      data: {
        payment_id: payment.id,
        amount: payment.amount,
        reason: 'dispute_resolved_refund',
        mercadopago_refund_id: refund.id,
        status: 'completed',
        completed_at: new Date(),
      },
    });
    
    // 4. Actualizar dispute
    await prisma.dispute.update({
      where: { id: dispute.id },
      data: {
        status: 'resolved_refund',
        admin_notes,
        resolved_at: new Date(),
      },
    });
    
    // 5. Log admin action
    await prisma.adminAction.create({
      data: {
        admin_id: req.adminId,
        action_type: 'refund_total',
        entity_type: 'dispute',
        entity_id: dispute.id,
        details: { amount: payment.amount, reason: admin_notes },
      },
    });
    
    // 6. Notificar usuarios
    await sendPushNotification(payment.client_id, {
      title: 'Reembolso procesado',
      body: `Disputa resuelta a tu favor. Recibirás ARS ${payment.amount} en 5-10 días hábiles.`,
    });
    
    await sendPushNotification(payment.professional_id, {
      title: 'Disputa resuelta',
      body: 'El pago fue reembolsado al cliente. Contacta soporte si tienes dudas.',
    });
    
    res.json({ success: true, refund });
  } catch (error) {
    console.error('Error refunding payment', error);
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

// Similar endpoints:
// POST /api/admin/disputes/:id/refund-partial
// POST /api/admin/disputes/:id/payout-professional
// POST /api/admin/disputes/:id/close-no-action
```

**UI Admin Panel:**
```tsx
// admin-panel/src/pages/DisputeDetail.tsx
function DisputeDetail({ disputeId }) {
  const { data: dispute } = useQuery(['dispute', disputeId], () => api.getDispute(disputeId));
  const refundMutation = useMutation((notes) => api.refundTotal(disputeId, notes));
  
  return (
    <Box>
      <Typography variant="h4">Disputa #{disputeId}</Typography>
      
      <Card>
        <CardContent>
          <Typography>Appointment: {dispute.appointment.id}</Typography>
          <Typography>Monto: ARS {dispute.appointment.payment.amount}</Typography>
          <Typography>Reportado por: {dispute.reporter.full_name}</Typography>
          <Typography>Motivo: {dispute.reason}</Typography>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent>
          <Typography variant="h6">Chat History</Typography>
          {dispute.chat_messages.map(msg => (
            <Box key={msg.id}>
              <Typography><strong>{msg.sender.full_name}:</strong> {msg.message_text}</Typography>
            </Box>
          ))}
        </CardContent>
      </Card>
      
      <Card>
        <CardContent>
          <Typography variant="h6">Evidencia</Typography>
          {dispute.evidence_urls.map(url => (
            <img key={url} src={url} style={{ maxWidth: 200 }} />
          ))}
        </CardContent>
      </Card>
      
      <Box mt={2}>
        <TextField
          label="Notas admin (internas)"
          multiline
          rows={4}
          fullWidth
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
        />
      </Box>
      
      <Box mt={2} display="flex" gap={2}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => refundMutation.mutate(adminNotes)}
          disabled={refundMutation.isLoading}
        >
          {refundMutation.isLoading ? 'Procesando...' : 'Refund Total Cliente'}
        </Button>
        
        <Button
          variant="outlined"
          onClick={() => setShowPartialRefundModal(true)}
        >
          Refund Parcial
        </Button>
        
        <Button
          variant="outlined"
          color="success"
          onClick={() => payoutMutation.mutate(adminNotes)}
        >
          Payout Profesional
        </Button>
        
        <Button
          variant="text"
          onClick={() => closeNoActionMutation.mutate(adminNotes)}
        >
          Cerrar sin Acción
        </Button>
      </Box>
    </Box>
  );
}
```

**Pros:**
- ✅ **Workflow integrado:** Admin NO tiene que cambiar a dashboard MP
- ✅ **Auditoría completa:** Todo refund logueado en `admin_actions` + `refunds` table
- ✅ **Notificaciones automáticas:** Users reciben FCM push inmediato
- ✅ **Idempotencia:** Backend valida dispute status antes de refund

**Cons:**
- Código backend adicional (endpoints + MP API calls)

**Veredicto:** ✅ **RECOMENDADO** — UX admin crítico para escalar operaciones.

---

#### Opción B: Refund Manual en MercadoPago Dashboard 🔴

**Flujo:**
1. Admin ve disputa en panel QuickFixU
2. Admin abre MercadoPago dashboard en otra pestaña
3. Admin busca payment por ID
4. Admin ejecuta refund manual
5. Admin vuelve a QuickFixU panel, marca disputa como resuelta manualmente

**Pros:**
- Menos código backend

**Cons:**
- ❌ **UX horrible:** Context switching, propenso a errores
- ❌ **Sin auditoría:** No sabemos qué admin hizo qué refund
- ❌ **Sin notificaciones:** Users NO reciben FCM push automático

**Veredicto:** ❌ **INACEPTABLE** — No escala.

---

## 4. Affected Areas

### Nuevos Archivos a Crear:

**Admin Panel (React.js):**
- `admin-panel/src/App.tsx` — Router principal + Auth context
- `admin-panel/src/pages/Dashboard.tsx` — Analytics KPIs + charts
- `admin-panel/src/pages/Certifications.tsx` — Queue certificaciones pending
- `admin-panel/src/pages/CertificationDetail.tsx` — Imagen OCR + campos editables
- `admin-panel/src/pages/Disputes.tsx` — Lista disputas
- `admin-panel/src/pages/DisputeDetail.tsx` — Chat history + refund buttons
- `admin-panel/src/pages/Users.tsx` — Tabla usuarios con filtros
- `admin-panel/src/pages/Payments.tsx` — Lista payments
- `admin-panel/src/pages/Reports.tsx` — Content reports queue
- `admin-panel/src/pages/Logs.tsx` — Admin actions log
- `admin-panel/src/components/Sidebar.tsx` — Navegación
- `admin-panel/src/api/client.ts` — Axios instance con JWT
- `admin-panel/src/hooks/useAuth.tsx` — Auth context

**Backend (Node.js):**
- `backend/src/routes/admin/auth.ts` — Login admin
- `backend/src/routes/admin/analytics.ts` — Dashboard KPIs
- `backend/src/routes/admin/certifications.ts` — CRUD certificaciones
- `backend/src/routes/admin/disputes.ts` — Dispute resolution
- `backend/src/routes/admin/users.ts` — Gestión usuarios
- `backend/src/routes/admin/payments.ts` — Pagos management
- `backend/src/routes/admin/reports.ts` — Content moderation
- `backend/src/routes/admin/logs.ts` — Admin actions
- `backend/src/services/ocr.service.ts` — Tesseract + sharp pipeline
- `backend/src/services/pdf.service.ts` — PDF → PNG conversion
- `backend/src/middleware/requireAdmin.ts` — Auth middleware
- `backend/src/workers/ocr.worker.ts` — Bull queue processor

**Database Migrations:**
- `backend/prisma/migrations/XXX_create_admins.sql`
- `backend/prisma/migrations/XXX_create_admin_actions.sql`
- `backend/prisma/migrations/XXX_create_content_reports.sql`
- `backend/prisma/migrations/XXX_create_certification_patterns.sql`

---

## 5. Approaches

### Approach 1: Full-Featured Admin Panel (Recomendado) ✅

**Implementación:**
- React.js + MUI + React Query
- Todos los módulos (dashboard, users, certifications, disputes, payments, reports, logs)
- OCR automático con Tesseract.js backend
- Refund/payout integrado en panel

**Effort:** ALTO (80-100 horas)  
**Pros:** Producto completo, operaciones escalables, UX admin excelente  
**Cons:** Tiempo desarrollo significativo  

---

### Approach 2: Admin Panel Mínimo (MVP Ultra-Light) 🟡

**Implementación:**
- Solo módulos críticos: Certificaciones + Disputas
- Dashboard analytics skip (usar Metabase o Grafana externo)
- Users/Payments/Reports se gestionan en Prisma Studio
- OCR automático (esencial)

**Effort:** MEDIO (40-50 horas)  
**Pros:** Más rápido de lanzar  
**Cons:** Admin tools fragmentados, no escala, UX pobre  

**Veredicto:** 🟡 Solo si presión tiempo extrema.

---

### Approach 3: No Admin Panel, Solo Scripts CLI 🔴

**Implementación:**
- Certificaciones: script `npm run approve-cert <id>`
- Disputas: script `npm run refund <paymentId> <amount>`
- Analytics: queries SQL manual

**Effort:** BAJO (10 horas)  
**Pros:** Cero frontend, muy rápido  
**Cons:** NO escalable, propenso errores, sin auditoría UI  

**Veredicto:** ❌ Inviable para operación real.

---

## 6. Recommendation

**Approach 1: Full-Featured Admin Panel** es la única opción viable para operar QuickFixU a escala.

**Justificación:**
1. **Certificaciones** son el cuello de botella de crecimiento — sin panel eficiente, backlog crece exponencialmente
2. **Disputas** requieren contexto completo (chat + payment + evidencia) — Prisma Studio NO lo provee
3. **Analytics** son críticos para decisiones negocio (GMV, conversion funnel, retention)
4. **Auditoría** es obligatorio para compliance (AFIP, regulaciones fintech Argentina)

**Secuencia implementación sugerida:**
1. **Sprint 1 (20h):** Admin auth + dashboard analytics + tabla admins
2. **Sprint 2 (25h):** OCR pipeline (Tesseract + Bull queue + preprocessing)
3. **Sprint 3 (20h):** Gestión certificaciones (lista pending + detail + approve/reject)
4. **Sprint 4 (15h):** Gestión disputas (lista + detail + refund/payout)
5. **Sprint 5 (10h):** Gestión usuarios + content reports
6. **Sprint 6 (10h):** Logs admin actions + webhook logs

**Total:** 100 horas (~2.5 semanas 2 devs full-time)

---

## 7. Risks

Ya cubiertos en tabla sección 1 (Executive Summary).

**Riesgo adicional NO listado:**

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| **Admin panel expuesto público** (no requiere VPN) | ALTO — Atacante puede intentar brute-force login | Rate limiting agresivo (5 intentos/10min), Cloudflare WAF, IP whitelist opcional (Railway permite), alertas Sentry si >50 logins fallidos/hora. |

---

## 8. Ready for Proposal

✅ **YES**

**Razones:**
- Stack seleccionado (React + MUI + React Query) es probado en producción
- OCR pipeline definido (Tesseract + sharp + Bull) con fallback manual
- Workflows admin claros (certificaciones, disputas, moderación)
- Plan auditoría completo (admin_actions table + logs)
- Riesgos identificados con mitigaciones

**Siguiente paso:** Crear propuesta formal con:
- Wireframes admin panel (Figma)
- API contract completo (Swagger/OpenAPI)
- Task breakdown detallado (GitHub issues)
- Timeline estimado con milestones
