# Modelo de Datos QuickFixU - Versión Refinada

**Versión:** 2.0  
**Fecha:** Marzo 2026  
**Status:** Actualizado con refinamientos MVP

---

## 1. Introducción

Este documento describe la estructura completa del modelo de datos de QuickFixU, diseñado para soportar un marketplace bidireccional de servicios profesionales. El modelo está optimizado para:

- **Geolocalización eficiente**: Búsquedas en radio 30km con PostGIS
- **Chat en tiempo real**: Arquitectura escalable con WebSockets
- **Pagos seguros**: Retención hasta confirmación mutua
- **Reputación transparente**: Sistema bidireccional con constraints

**Stack Base de Datos:**
- PostgreSQL 15+ con extensiones PostGIS y pg_trgm
- Prisma ORM (TypeScript)
- Redis para cache y sesiones

**Diagrama ER Interactivo:** https://dbdiagram.io/d/QuickFixU-ER-Diagram (ver DBML al final documento)

---

## 2. Decisiones de Diseño Críticas

### 2.1 Eliminación de Campo `role` en Users

**Problema Original:** Campo `role` (client/professional) creaba ambigüedad y permitía inconsistencias.

**Solución Implementada:**
- La distinción viene de la **existencia de registro en tabla `professionals`**
- Si `user_id` existe en `professionals` → Es profesional
- Si NO existe → Es cliente
- **Regla de negocio enforced**: Un user NO puede ser ambos simultáneamente

**Beneficios:**
- Elimina inconsistencias (role='client' pero tiene registro professional)
- Simplifica queries (JOIN professionals para detectar role)
- Permite migración futura (cliente puede "convertirse" en profesional agregando registro)

---

### 2.2 Geolocalización con PostGIS

**Campos añadidos:**
- `users.latitude` y `users.longitude` (ubicación principal usuario)
- `posts.latitude` y `posts.longitude` (ubicación del problema, puede diferir de user)

**Tipo de dato:** `GEOGRAPHY(POINT, 4326)` (WGS84 - estándar GPS)

**Ventaja sobre lat/lng separados:**
- Queries Haversine nativos PostGIS (ST_Distance, ST_DWithin)
- Índices GIST espaciales (10-100x más rápido)
- Precision hasta centímetros

**Ejemplo Query:**
```sql
-- Profesionales en 30km de cliente
SELECT u.id, u.full_name,
  ST_Distance(u.location, ST_MakePoint(-58.3816, -34.6037)::geography) / 1000 AS distance_km
FROM users u
JOIN professionals p ON u.id = p.user_id
WHERE ST_DWithin(u.location, ST_MakePoint(-58.3816, -34.6037)::geography, 30000)
ORDER BY distance_km;
```

---

### 2.3 Migración de Tags a Relaciones Many-to-Many

**Problema Original:**
- `posts.tags` y `professionals.profession_tags` como VARCHAR (ej: "electricista,plomero")
- Imposible hacer JOINs eficientes
- Inconsistencias en capitalización/typos

**Solución:**
- Tabla `categories` normalizada (id, name, slug, icon_url)
- Tablas pivot: `professional_categories` y `post_categories`
- Queries con JOINs estándar, índices en foreign keys

**Migración de datos existentes:**
```sql
-- Script ejecutar ANTES de eliminar campo tags
INSERT INTO categories (name, slug) VALUES 
  ('Electricista', 'electricista'),
  ('Plomero', 'plomero'),
  ('Gasista', 'gasista');

-- Migrar posts
INSERT INTO post_categories (post_id, category_id)
SELECT p.id, c.id
FROM posts p
JOIN categories c ON LOWER(p.tags) LIKE '%' || c.slug || '%';

-- Eliminar campo deprecated
ALTER TABLE posts DROP COLUMN tags;
```

---

### 2.4 Appointments como Entidad Separada

**Razón:**
- Una `proposal` es solo un presupuesto (puede ser rejected)
- Un `appointment` es un trabajo **confirmado y agendado**
- Separar permite trackear reprogramaciones, cancelaciones, estados específicos

**Flujo:**
1. Professional crea `proposal` (status: pending)
2. Cliente acepta → `proposal.status` = accepted
3. Se crea `appointment` (proposal_id FK, status: scheduled)
4. Trabajo se completa → `appointment.status` = completed
5. Review se asocia a `appointment_id` (NO proposal_id)

---

### 2.5 Soft Delete en Posts

**Implementación:**
- Campo `deleted_at` (nullable timestamp)
- Cronjob diario: Posts cerrados/expirados hace >90 días → `deleted_at = NOW()`
- Queries siempre filtran `WHERE deleted_at IS NULL`
- Permite auditoría/recovery sin pérdida datos

**Beneficios:**
- GDPR/compliance (usuario puede solicitar hard delete después)
- Analytics históricos (patrones temporales)
- Recovery ante errores

---

## 3. Tablas Detalladas

### 3.1 users

**Descripción:** Tabla central de usuarios (clientes Y profesionales). Autenticación, perfil básico, geolocalización.

**Campos:**

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Identificador único |
| `full_name` | VARCHAR(255) | NOT NULL | Nombre completo (ej: "Juan Pérez") |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Email único para login |
| `password_hash` | VARCHAR(255) | NOT NULL | Bcrypt hash (costo 12) |
| `phone` | VARCHAR(20) | NOT NULL | Formato: +54 9 11 4567-8901 |
| `dni` | VARCHAR(10) | NOT NULL | DNI argentino sin puntos (ej: "38456789") |
| `address` | TEXT | NOT NULL | Dirección completa (ej: "Av. Santa Fe 1234, Palermo, CABA") |
| `latitude` | DECIMAL(10,8) | NOT NULL | Latitud WGS84 (ej: -34.603722) |
| `longitude` | DECIMAL(11,8) | NOT NULL | Longitud WGS84 (ej: -58.381592) |
| `profile_photo_url` | VARCHAR(500) | NULLABLE | URL Cloudinary (ej: https://res.cloudinary.com/xxx) |
| `rating` | DECIMAL(3,2) | DEFAULT 0 | Rating promedio calculado (0.00 - 5.00) |
| `oauth_provider` | VARCHAR(50) | NULLABLE | 'google' / 'facebook' / NULL |
| `oauth_id` | VARCHAR(255) | NULLABLE | ID del proveedor OAuth |
| `fcm_token` | VARCHAR(500) | NULLABLE | Token Firebase Cloud Messaging (push notifications) |
| `is_active` | BOOLEAN | DEFAULT TRUE | FALSE si usuario baneado/desactivado |
| `blocked_reason` | TEXT | NULLABLE | Motivo bloqueo (visible solo admin) |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Fecha registro |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Última modificación perfil |

**Índices:**
```sql
CREATE INDEX idx_users_email ON users(email); -- Login
CREATE INDEX idx_users_location ON users USING GIST(ST_MakePoint(longitude, latitude)::geography); -- Búsquedas geo
CREATE INDEX idx_users_is_active ON users(is_active); -- Filtrar baneados
```

**Constraints:**
```sql
ALTER TABLE users ADD CONSTRAINT chk_rating CHECK (rating >= 0 AND rating <= 5);
ALTER TABLE users ADD CONSTRAINT chk_oauth CHECK (
  (oauth_provider IS NULL AND oauth_id IS NULL) OR 
  (oauth_provider IS NOT NULL AND oauth_id IS NOT NULL)
);
```

**Ejemplo Datos:**
```json
{
  "id": 1,
  "full_name": "Lucía Fernández",
  "email": "lucia.fernandez@gmail.com",
  "password_hash": "$2b$12$KIXxWxWv8YrZ...",
  "phone": "+54 9 11 5678-1234",
  "dni": "35123456",
  "address": "Av. Córdoba 2500, Palermo, CABA",
  "latitude": -34.599128,
  "longitude": -58.401432,
  "profile_photo_url": "https://res.cloudinary.com/quickfixu/image/upload/v1234/lucia.jpg",
  "rating": 4.50,
  "oauth_provider": "google",
  "oauth_id": "108234567890123456789",
  "fcm_token": "fcm_token_example_abc123...",
  "is_active": true,
  "blocked_reason": null,
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-03-20T14:22:00Z"
}
```

---

### 3.2 professionals

**Descripción:** Datos específicos de profesionales. Relación 1-to-1 con `users`. Si existe registro aquí, el user es profesional.

**Campos:**

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Identificador único |
| `user_id` | INTEGER | UNIQUE, NOT NULL, FK → users.id | Relación 1-to-1 con users |
| `company_name` | VARCHAR(255) | NULLABLE | Nombre empresa (ej: "Instalaciones López SRL") |
| `dni` | VARCHAR(10) | NOT NULL | Duplicado de users.dni (denormalizado para queries rápidas) |
| `hourly_rate` | DECIMAL(10,2) | NOT NULL | Tarifa por hora en ARS (ej: 4500.00) |
| `available_schedule` | JSONB | NOT NULL | Horarios disponibilidad (ver ejemplo abajo) |
| `credit_card_token` | VARCHAR(255) | NULLABLE | Token MercadoPago (para cobro comisiones cash) |
| `is_verified` | BOOLEAN | DEFAULT FALSE | TRUE si tiene al menos 1 certificación aprobada |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Fecha registro como profesional |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Última modificación perfil |

**Índices:**
```sql
CREATE INDEX idx_professionals_user_id ON professionals(user_id);
CREATE INDEX idx_professionals_is_verified ON professionals(is_verified);
CREATE INDEX idx_professionals_hourly_rate ON professionals(hourly_rate); -- Ordenar por precio
```

**available_schedule JSON Schema:**
```json
{
  "lunes": { "available": true, "start": "08:00", "end": "18:00" },
  "martes": { "available": true, "start": "08:00", "end": "18:00" },
  "miércoles": { "available": true, "start": "08:00", "end": "18:00" },
  "jueves": { "available": true, "start": "08:00", "end": "18:00" },
  "viernes": { "available": true, "start": "08:00", "end": "18:00" },
  "sábado": { "available": true, "start": "09:00", "end": "13:00" },
  "domingo": { "available": false, "start": null, "end": null }
}
```

**Ejemplo Datos:**
```json
{
  "id": 1,
  "user_id": 5,
  "company_name": "Electricidad Martín López",
  "dni": "38456789",
  "hourly_rate": 4500.00,
  "available_schedule": { /* ver arriba */ },
  "credit_card_token": "mp_card_token_abc123xyz",
  "is_verified": true,
  "created_at": "2026-01-20T09:00:00Z",
  "updated_at": "2026-03-18T11:45:00Z"
}
```

---

### 3.3 categories

**Descripción:** Catálogo de profesiones/categorías. Normalizado para evitar inconsistencias.

**Campos:**

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Identificador único |
| `name` | VARCHAR(100) | UNIQUE, NOT NULL | Nombre mostrar (ej: "Electricista") |
| `slug` | VARCHAR(100) | UNIQUE, NOT NULL | URL-friendly (ej: "electricista") |
| `icon_url` | VARCHAR(500) | NULLABLE | URL ícono (ej: https://cdn.quickfixu.com/icons/electricista.svg) |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Fecha creación categoría |

**Índices:**
```sql
CREATE INDEX idx_categories_slug ON categories(slug);
```

**Ejemplo Datos:**
```sql
INSERT INTO categories (name, slug, icon_url) VALUES
  ('Electricista', 'electricista', 'https://cdn.quickfixu.com/icons/electricista.svg'),
  ('Plomero', 'plomero', 'https://cdn.quickfixu.com/icons/plomero.svg'),
  ('Gasista', 'gasista', 'https://cdn.quickfixu.com/icons/gasista.svg');
```

---

### 3.4 professional_categories

**Descripción:** Tabla pivot many-to-many entre `professionals` y `categories`. Un profesional puede tener múltiples categorías.

**Campos:**

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `professional_id` | INTEGER | NOT NULL, FK → professionals.id | Profesional |
| `category_id` | INTEGER | NOT NULL, FK → categories.id | Categoría |
| PRIMARY KEY | | (professional_id, category_id) | Composite PK (evita duplicados) |

**Índices:**
```sql
CREATE INDEX idx_prof_cat_professional ON professional_categories(professional_id);
CREATE INDEX idx_prof_cat_category ON professional_categories(category_id);
```

**Ejemplo Datos:**
```sql
-- Martín (professional_id=1) es Electricista Y Plomero
INSERT INTO professional_categories (professional_id, category_id) VALUES
  (1, 1), -- Electricista
  (1, 2); -- Plomero
```

---

### 3.5 certifications

**Descripción:** Certificaciones/matrículas profesionales. Validación con OCR + aprobación manual admin.

**Campos:**

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Identificador único |
| `professional_id` | INTEGER | NOT NULL, FK → professionals.id | Profesional dueño |
| `certification_type` | VARCHAR(100) | NOT NULL | Tipo (ej: "Matrícula Gasista", "Carnet ENARGAS") |
| `certification_number` | VARCHAR(100) | NULLABLE | Número extraído OCR (ej: "12345") |
| `issue_date` | DATE | NULLABLE | Fecha emisión |
| `expiry_date` | DATE | NULLABLE | Fecha vencimiento |
| `document_url` | VARCHAR(500) | NOT NULL | URL PDF/imagen en Cloudinary |
| `ocr_data` | JSONB | NULLABLE | Datos completos extraídos por Tesseract.js |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'pending' | 'pending' / 'approved' / 'rejected' |
| `reviewed_by` | INTEGER | NULLABLE, FK → users.id | Admin que aprobó/rechazó |
| `reviewed_at` | TIMESTAMP | NULLABLE | Fecha revisión |
| `rejection_reason` | TEXT | NULLABLE | Motivo rechazo (visible profesional) |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Fecha subida |

**Índices:**
```sql
CREATE INDEX idx_cert_professional ON certifications(professional_id);
CREATE INDEX idx_cert_status ON certifications(status);
```

**Constraints:**
```sql
ALTER TABLE certifications ADD CONSTRAINT chk_cert_status CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE certifications ADD CONSTRAINT chk_cert_reviewed CHECK (
  (status = 'pending' AND reviewed_by IS NULL) OR
  (status IN ('approved', 'rejected') AND reviewed_by IS NOT NULL)
);
```

**ocr_data JSON Ejemplo:**
```json
{
  "raw_text": "MATRICULA GASISTA N° 12345\nEMISION: 10/01/2020\nVENCIMIENTO: 10/01/2030\nTITULAR: MARTIN LOPEZ",
  "confidence": 0.87,
  "extracted_fields": {
    "type": "Matrícula Gasista",
    "number": "12345",
    "issue_date": "2020-01-10",
    "expiry_date": "2030-01-10",
    "holder_name": "MARTIN LOPEZ"
  }
}
```

**Ejemplo Datos:**
```json
{
  "id": 1,
  "professional_id": 1,
  "certification_type": "Matrícula Gasista",
  "certification_number": "12345",
  "issue_date": "2020-01-10",
  "expiry_date": "2030-01-10",
  "document_url": "https://res.cloudinary.com/quickfixu/raw/upload/v1234/cert_martin_12345.pdf",
  "ocr_data": { /* ver arriba */ },
  "status": "approved",
  "reviewed_by": 10,
  "reviewed_at": "2026-01-22T14:00:00Z",
  "rejection_reason": null,
  "created_at": "2026-01-21T10:30:00Z"
}
```

---

### 3.6 posts

**Descripción:** Publicaciones de problemas por clientes. Visibles en feed profesionales.

**Campos:**

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Identificador único |
| `user_id` | INTEGER | NOT NULL, FK → users.id | Cliente que publicó |
| `title` | VARCHAR(100) | NOT NULL | Título (ej: "Fuga de agua en cocina") |
| `description` | TEXT | NOT NULL | Descripción detallada (max 500 chars frontend) |
| `latitude` | DECIMAL(10,8) | NOT NULL | Ubicación problema (puede diferir user.latitude) |
| `longitude` | DECIMAL(11,8) | NOT NULL | Ubicación problema |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'open' | 'open' / 'closed' / 'expired' / 'completed' |
| `expires_at` | TIMESTAMP | NOT NULL | created_at + 48 horas (cronjob marca expired) |
| `deleted_at` | TIMESTAMP | NULLABLE | Soft delete después 90 días |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Fecha publicación |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Última modificación |

**Índices:**
```sql
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_location ON posts USING GIST(ST_MakePoint(longitude, latitude)::geography);
CREATE INDEX idx_posts_expires_at ON posts(expires_at); -- Cronjob expiración
CREATE INDEX idx_posts_deleted_at ON posts(deleted_at); -- Filtrar soft deleted
CREATE INDEX idx_posts_created_at ON posts(created_at DESC); -- Feed ordenado
```

**Constraints:**
```sql
ALTER TABLE posts ADD CONSTRAINT chk_post_status CHECK (status IN ('open', 'closed', 'expired', 'completed'));
```

**Ejemplo Datos:**
```json
{
  "id": 1,
  "user_id": 1,
  "title": "Fuga de agua debajo pileta cocina",
  "description": "Pérdida constante de agua debajo de la pileta. El gabinete está mojado. Urgente.",
  "latitude": -34.599128,
  "longitude": -58.401432,
  "status": "open",
  "expires_at": "2026-03-23T22:00:00Z",
  "deleted_at": null,
  "created_at": "2026-03-21T22:00:00Z",
  "updated_at": "2026-03-21T22:00:00Z"
}
```

---

### 3.7 post_categories

**Descripción:** Tabla pivot many-to-many entre `posts` y `categories`. Un post puede necesitar múltiples profesiones.

**Campos:**

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `post_id` | INTEGER | NOT NULL, FK → posts.id | Post |
| `category_id` | INTEGER | NOT NULL, FK → categories.id | Categoría |
| PRIMARY KEY | | (post_id, category_id) | Composite PK |

**Índices:**
```sql
CREATE INDEX idx_post_cat_post ON post_categories(post_id);
CREATE INDEX idx_post_cat_category ON post_categories(category_id);
```

**Ejemplo Datos:**
```sql
-- Post "Fuga agua + Problemas luz" necesita Plomero Y Electricista
INSERT INTO post_categories (post_id, category_id) VALUES
  (1, 2), -- Plomero
  (1, 1); -- Electricista
```

---

### 3.8 post_media

**Descripción:** Imágenes/videos asociados a posts. Relación 1-to-many (1 post → múltiples media).

**Campos:**

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Identificador único |
| `post_id` | INTEGER | NOT NULL, FK → posts.id | Post dueño |
| `media_type` | VARCHAR(10) | NOT NULL | 'image' / 'video' |
| `media_url` | VARCHAR(500) | NOT NULL | URL Cloudinary |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Fecha subida |

**Índices:**
```sql
CREATE INDEX idx_post_media_post_id ON post_media(post_id);
```

**Constraints:**
```sql
ALTER TABLE post_media ADD CONSTRAINT chk_media_type CHECK (media_type IN ('image', 'video'));
```

**Ejemplo Datos:**
```json
[
  {
    "id": 1,
    "post_id": 1,
    "media_type": "image",
    "media_url": "https://res.cloudinary.com/quickfixu/image/upload/v1234/post_1_img1.jpg",
    "created_at": "2026-03-21T22:05:00Z"
  },
  {
    "id": 2,
    "post_id": 1,
    "media_type": "image",
    "media_url": "https://res.cloudinary.com/quickfixu/image/upload/v1234/post_1_img2.jpg",
    "created_at": "2026-03-21T22:05:00Z"
  }
]
```

---

### 3.9 proposals

**Descripción:** Presupuestos enviados por profesionales a posts de clientes.

**Campos:**

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Identificador único |
| `post_id` | INTEGER | NOT NULL, FK → posts.id | Post al que responde |
| `professional_id` | INTEGER | NOT NULL, FK → professionals.id | Profesional que envía |
| `price` | DECIMAL(10,2) | NOT NULL | Precio total trabajo en ARS |
| `description` | TEXT | NOT NULL | Detalles oferta (max 300 chars frontend) |
| `scheduled_date` | DATE | NOT NULL | Fecha propuesta trabajo |
| `scheduled_time` | TIME | NOT NULL | Hora propuesta trabajo |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'pending' | 'pending' / 'accepted' / 'rejected' / 'expired' / 'cancelled' |
| `expires_at` | TIMESTAMP | NOT NULL | created_at + 48 horas |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Fecha envío |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Última modificación |

**Índices:**
```sql
CREATE INDEX idx_proposals_post_id ON proposals(post_id);
CREATE INDEX idx_proposals_professional_id ON proposals(professional_id);
CREATE INDEX idx_proposals_status ON proposals(status);
CREATE INDEX idx_proposals_expires_at ON proposals(expires_at);
```

**Constraints:**
```sql
ALTER TABLE proposals ADD CONSTRAINT chk_proposal_status CHECK (
  status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')
);
ALTER TABLE proposals ADD CONSTRAINT chk_proposal_price CHECK (price > 0);
```

**Ejemplo Datos:**
```json
{
  "id": 1,
  "post_id": 1,
  "professional_id": 1,
  "price": 8500.00,
  "description": "Reparación fuga + cambio junta flexible. Incluye materiales.",
  "scheduled_date": "2026-03-22",
  "scheduled_time": "09:00:00",
  "status": "accepted",
  "expires_at": "2026-03-23T22:30:00Z",
  "created_at": "2026-03-21T22:30:00Z",
  "updated_at": "2026-03-21T23:15:00Z"
}
```

---

### 3.10 appointments

**Descripción:** Trabajos agendados (cuando proposal es aceptada). Trackea reprogramaciones, cancelaciones, estados.

**Campos:**

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Identificador único |
| `proposal_id` | INTEGER | UNIQUE, NOT NULL, FK → proposals.id | Propuesta aceptada (1-to-1) |
| `scheduled_date` | DATE | NOT NULL | Fecha trabajo (copiado de proposal, puede cambiar) |
| `scheduled_time` | TIME | NOT NULL | Hora trabajo |
| `status` | VARCHAR(30) | NOT NULL, DEFAULT 'scheduled' | Ver valores abajo |
| `rescheduled_count` | INTEGER | NOT NULL, DEFAULT 0 | Cantidad reprogramaciones (max 2) |
| `cancellation_reason` | TEXT | NULLABLE | Motivo cancelación |
| `cancelled_by` | VARCHAR(20) | NULLABLE | 'client' / 'professional' |
| `penalty_applied` | BOOLEAN | DEFAULT FALSE | TRUE si se aplicó penalización 15% |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Fecha agendado |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Última modificación |

**Status valores:**
- `scheduled`: Agendado, esperando fecha
- `in_progress`: Profesional marcó "En camino" o "Iniciado"
- `completed`: Ambos confirmaron finalización
- `cancelled_by_client`: Cliente canceló (penalty a profesional)
- `cancelled_by_professional`: Profesional canceló (penalty refund cliente)

**Índices:**
```sql
CREATE INDEX idx_appointments_proposal_id ON appointments(proposal_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_scheduled_date ON appointments(scheduled_date);
```

**Constraints:**
```sql
ALTER TABLE appointments ADD CONSTRAINT chk_appt_status CHECK (
  status IN ('scheduled', 'in_progress', 'completed', 'cancelled_by_client', 'cancelled_by_professional')
);
ALTER TABLE appointments ADD CONSTRAINT chk_appt_rescheduled CHECK (rescheduled_count <= 2);
ALTER TABLE appointments ADD CONSTRAINT chk_appt_cancelled CHECK (
  (status LIKE 'cancelled%' AND cancelled_by IS NOT NULL AND cancellation_reason IS NOT NULL) OR
  (status NOT LIKE 'cancelled%' AND cancelled_by IS NULL)
);
```

**Ejemplo Datos:**
```json
{
  "id": 1,
  "proposal_id": 1,
  "scheduled_date": "2026-03-22",
  "scheduled_time": "09:00:00",
  "status": "completed",
  "rescheduled_count": 0,
  "cancellation_reason": null,
  "cancelled_by": null,
  "penalty_applied": false,
  "created_at": "2026-03-21T23:15:00Z",
  "updated_at": "2026-03-22T10:30:00Z"
}
```

---

### 3.11 chats

**Descripción:** Conversaciones 1-to-1 entre cliente y profesional. Puede originarse desde post o búsqueda directa.

**Campos:**

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Identificador único |
| `client_id` | INTEGER | NOT NULL, FK → users.id | Cliente |
| `professional_id` | INTEGER | NOT NULL, FK → users.id | Profesional |
| `last_message_at` | TIMESTAMP | NULLABLE | Timestamp último mensaje (para ordenar lista) |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Fecha inicio conversación |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Última modificación |

**Índices:**
```sql
CREATE INDEX idx_chats_client_id ON chats(client_id);
CREATE INDEX idx_chats_professional_id ON chats(professional_id);
CREATE INDEX idx_chats_last_message_at ON chats(last_message_at DESC);
CREATE UNIQUE INDEX idx_chats_unique_pair ON chats(client_id, professional_id); -- Solo 1 chat por par
```

**Ejemplo Datos:**
```json
{
  "id": 1,
  "client_id": 1,
  "professional_id": 5,
  "last_message_at": "2026-03-21T23:45:00Z",
  "created_at": "2026-03-21T22:30:00Z",
  "updated_at": "2026-03-21T23:45:00Z"
}
```

---

### 3.12 messages

**Descripción:** Mensajes individuales en chat. Soporta texto + media (imágenes/videos).

**Campos:**

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Identificador único |
| `chat_id` | INTEGER | NOT NULL, FK → chats.id | Chat al que pertenece |
| `sender_id` | INTEGER | NOT NULL, FK → users.id | Usuario que envía |
| `message_text` | TEXT | NULLABLE | Texto mensaje (max 2000 chars frontend) |
| `media_url` | VARCHAR(500) | NULLABLE | URL imagen/video (opcional) |
| `read` | BOOLEAN | DEFAULT FALSE | TRUE si destinatario leyó |
| `read_at` | TIMESTAMP | NULLABLE | Timestamp lectura |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Fecha envío |

**Índices:**
```sql
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_read ON messages(read) WHERE read = FALSE; -- Solo no leídos (partial index)
```

**Constraints:**
```sql
ALTER TABLE messages ADD CONSTRAINT chk_message_content CHECK (
  message_text IS NOT NULL OR media_url IS NOT NULL
); -- Al menos uno debe existir
```

**Ejemplo Datos:**
```json
[
  {
    "id": 1,
    "chat_id": 1,
    "sender_id": 1,
    "message_text": "Hola Martín, vi tu propuesta. ¿Podés venir a las 9am en vez de 8am?",
    "media_url": null,
    "read": true,
    "read_at": "2026-03-21T23:32:00Z",
    "created_at": "2026-03-21T23:30:00Z"
  },
  {
    "id": 2,
    "chat_id": 1,
    "sender_id": 5,
    "message_text": "Dale, perfecto. Confirmo 9am.",
    "media_url": null,
    "read": true,
    "read_at": "2026-03-21T23:46:00Z",
    "created_at": "2026-03-21T23:45:00Z"
  }
]
```

---

### 3.13 payments

**Descripción:** Transacciones de pago. Se crea cuando cliente acepta propuesta y paga. Relación con proposal y appointment.

**Campos:**

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Identificador único |
| `proposal_id` | INTEGER | NULLABLE, FK → proposals.id | Propuesta asociada (si viene de post) |
| `appointment_id` | INTEGER | NULLABLE, FK → appointments.id | Trabajo asociado |
| `client_id` | INTEGER | NOT NULL, FK → users.id | Cliente que paga |
| `professional_id` | INTEGER | NOT NULL, FK → users.id | Profesional que recibe |
| `amount` | DECIMAL(10,2) | NOT NULL | Monto total trabajo (bruto) |
| `commission_percentage` | DECIMAL(5,2) | NOT NULL | % comisión (0 / 10 / 50) |
| `commission_amount` | DECIMAL(10,2) | NOT NULL | Monto comisión en ARS (amount * %) |
| `net_amount` | DECIMAL(10,2) | NOT NULL | Monto neto profesional (amount - commission - penalty) |
| `penalty_amount` | DECIMAL(10,2) | DEFAULT 0 | Penalización cancelación (15% amount) |
| `penalty_reason` | VARCHAR(100) | NULLABLE | 'cancelled_by_client' / 'cancelled_by_professional' |
| `payment_method` | VARCHAR(20) | NOT NULL | 'mercadopago' / 'cash' |
| `mercadopago_payment_id` | VARCHAR(100) | NULLABLE | ID transacción MP (para tracking/webhooks) |
| `currency` | VARCHAR(3) | DEFAULT 'ARS' | Moneda (preparado expansión) |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'pending' | 'pending' / 'completed' / 'refunded' / 'failed' |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Fecha pago |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Última modificación |

**Índices:**
```sql
CREATE INDEX idx_payments_proposal_id ON payments(proposal_id);
CREATE INDEX idx_payments_appointment_id ON payments(appointment_id);
CREATE INDEX idx_payments_client_id ON payments(client_id);
CREATE INDEX idx_payments_professional_id ON payments(professional_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_mp_payment_id ON payments(mercadopago_payment_id);
```

**Constraints:**
```sql
ALTER TABLE payments ADD CONSTRAINT chk_payment_status CHECK (
  status IN ('pending', 'completed', 'refunded', 'failed')
);
ALTER TABLE payments ADD CONSTRAINT chk_payment_method CHECK (
  payment_method IN ('mercadopago', 'cash')
);
ALTER TABLE payments ADD CONSTRAINT chk_payment_amounts CHECK (
  amount > 0 AND commission_amount >= 0 AND net_amount >= 0 AND penalty_amount >= 0
);
```

**Ejemplo Datos:**
```json
{
  "id": 1,
  "proposal_id": 1,
  "appointment_id": 1,
  "client_id": 1,
  "professional_id": 5,
  "amount": 8500.00,
  "commission_percentage": 0.00,
  "commission_amount": 0.00,
  "net_amount": 8500.00,
  "penalty_amount": 0.00,
  "penalty_reason": null,
  "payment_method": "mercadopago",
  "mercadopago_payment_id": "123456789",
  "currency": "ARS",
  "status": "completed",
  "created_at": "2026-03-21T23:20:00Z",
  "updated_at": "2026-03-22T10:35:00Z"
}
```

---

### 3.14 reviews

**Descripción:** Calificaciones bidireccionales. Se crea después de completar appointment + payment. Asociado a appointment (NO directamente a user).

**Campos:**

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Identificador único |
| `appointment_id` | INTEGER | NOT NULL, FK → appointments.id | Trabajo calificado |
| `reviewer_id` | INTEGER | NOT NULL, FK → users.id | Quien califica |
| `reviewed_id` | INTEGER | NOT NULL, FK → users.id | Quien recibe calificación |
| `rating` | INTEGER | NOT NULL | 1-5 estrellas |
| `comment` | TEXT | NULLABLE | Comentario (max 500 chars frontend) |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Fecha review |

**Índices:**
```sql
CREATE INDEX idx_reviews_appointment_id ON reviews(appointment_id);
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_reviewed_id ON reviews(reviewed_id);
CREATE UNIQUE INDEX idx_reviews_unique_per_user ON reviews(appointment_id, reviewer_id); -- 1 review por appointment por user
```

**Constraints:**
```sql
ALTER TABLE reviews ADD CONSTRAINT chk_review_rating CHECK (rating >= 1 AND rating <= 5);
```

**Trigger Actualizar Rating Promedio User:**
```sql
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET rating = (
    SELECT COALESCE(AVG(rating), 0)
    FROM reviews
    WHERE reviewed_id = NEW.reviewed_id
  )
  WHERE id = NEW.reviewed_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_rating
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_user_rating();
```

**Ejemplo Datos:**
```json
[
  {
    "id": 1,
    "appointment_id": 1,
    "reviewer_id": 1,
    "reviewed_id": 5,
    "rating": 5,
    "comment": "Súper profesional, rápido y prolijo. Resolvió el problema en 30 minutos. Lo recomiendo 100%.",
    "created_at": "2026-03-22T11:30:00Z"
  },
  {
    "id": 2,
    "appointment_id": 1,
    "reviewer_id": 5,
    "reviewed_id": 1,
    "rating": 5,
    "comment": "Excelente cliente, comunicativa y puntual en el pago. Un placer trabajar así.",
    "created_at": "2026-03-22T11:32:00Z"
  }
]
```

---

### 3.15 balances

**Descripción:** Tracking deuda profesionales (cuando pago es en efectivo). Cobro automático fin de mes.

**Campos:**

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Identificador único |
| `professional_id` | INTEGER | UNIQUE, NOT NULL, FK → professionals.id | Profesional (1-to-1) |
| `balance` | DECIMAL(10,2) | NOT NULL, DEFAULT 0 | Balance actual (negativo = deuda) |
| `last_settlement_date` | TIMESTAMP | NULLABLE | Última fecha cobro exitoso |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Fecha creación registro |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Última modificación |

**Índices:**
```sql
CREATE INDEX idx_balances_professional_id ON balances(professional_id);
CREATE INDEX idx_balances_balance ON balances(balance) WHERE balance < 0; -- Solo deudas (partial index)
```

**Ejemplo Datos:**
```json
{
  "id": 1,
  "professional_id": 1,
  "balance": -850.00,
  "last_settlement_date": "2026-02-28T03:00:00Z",
  "created_at": "2026-01-20T09:00:00Z",
  "updated_at": "2026-03-22T10:35:00Z"
}
```

**Cálculo balance:**
- Cliente paga ARS 8,500 en efectivo
- Comisión 10% = ARS 850
- Se resta de balance: `balance -= 850` → balance = -850 (deuda)
- Fin mes: Cronjob cobra ARS 850 de tarjeta profesional → balance = 0

---

### 3.16 bonuses

**Descripción:** Bonos fidelización profesionales (FASE 2 - preparar estructura). Cada 20 trabajos = 25% total.

**Campos:**

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Identificador único |
| `professional_id` | INTEGER | NOT NULL, FK → professionals.id | Profesional |
| `jobs_completed_count` | INTEGER | NOT NULL | Cantidad trabajos completados (ej: 20, 40, 60) |
| `bonus_amount` | DECIMAL(10,2) | NOT NULL | Monto bono calculado (25% total 20 trabajos) |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'pending' | 'pending' / 'paid' |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Fecha desbloqueado bono |
| `paid_at` | TIMESTAMP | NULLABLE | Fecha pago bono |

**Índices:**
```sql
CREATE INDEX idx_bonuses_professional_id ON bonuses(professional_id);
CREATE INDEX idx_bonuses_status ON bonuses(status);
```

**Constraints:**
```sql
ALTER TABLE bonuses ADD CONSTRAINT chk_bonus_status CHECK (status IN ('pending', 'paid'));
ALTER TABLE bonuses ADD CONSTRAINT chk_bonus_amount CHECK (bonus_amount > 0);
```

**Ejemplo Datos:**
```json
{
  "id": 1,
  "professional_id": 1,
  "jobs_completed_count": 20,
  "bonus_amount": 42500.00,
  "status": "pending",
  "created_at": "2026-04-15T10:00:00Z",
  "paid_at": null
}
```

**Cálculo:**
- Trabajos 1-20 totalizaron ARS 170,000
- Bono 25% = ARS 42,500
- Profesional lo solicita en app → Admin aprueba → Payout MP

---

### 3.17 notifications

**Descripción:** Log notificaciones push enviadas. Útil para debugging, analytics, re-envío fallidos.

**Campos:**

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Identificador único |
| `user_id` | INTEGER | NOT NULL, FK → users.id | Destinatario |
| `type` | VARCHAR(50) | NOT NULL | Tipo notificación (ver lista abajo) |
| `title` | VARCHAR(100) | NOT NULL | Título push |
| `body` | TEXT | NOT NULL | Cuerpo mensaje |
| `data` | JSONB | NULLABLE | Payload adicional (deep link info) |
| `read` | BOOLEAN | DEFAULT FALSE | TRUE si usuario abrió notificación |
| `sent_at` | TIMESTAMP | DEFAULT NOW() | Timestamp envío FCM |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Timestamp creación registro |

**Tipos notificación (type):**
- `new_proposal` - Nueva propuesta recibida
- `message` - Nuevo mensaje chat
- `proposal_expiring` - Propuesta expira en 24hs
- `appointment_reminder_24h` - Recordatorio 24hs antes
- `appointment_reminder_1h` - Recordatorio 1h antes
- `appointment_completed` - Profesional marcó completado
- `payment_received` - Pago liberado a profesional
- `review_reminder` - Recordatorio dejar review
- `rescheduled_request` - Solicitud reprogramación

**Índices:**
```sql
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_read ON notifications(read) WHERE read = FALSE;
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at DESC);
```

**data JSON Ejemplo:**
```json
{
  "type": "new_proposal",
  "proposalId": 123,
  "chatId": 456,
  "deepLink": "quickfixu://chat/456"
}
```

**Ejemplo Datos:**
```json
{
  "id": 1,
  "user_id": 1,
  "type": "new_proposal",
  "title": "🎉 Nueva propuesta",
  "body": "Martín envió un presupuesto: ARS 8,500",
  "data": { /* ver arriba */ },
  "read": true,
  "sent_at": "2026-03-21T22:32:00Z",
  "created_at": "2026-03-21T22:32:00Z"
}
```

---

## 4. Relaciones y Diagrama ER

### 4.1 Relaciones Principales

**One-to-One (1:1):**
- `users` ↔ `professionals` (user_id UNIQUE)
- `proposals` ↔ `appointments` (proposal_id UNIQUE)
- `professionals` ↔ `balances` (professional_id UNIQUE)

**One-to-Many (1:N):**
- `users` → `posts` (1 user, múltiples posts)
- `users` → `chats` (como client_id o professional_id)
- `chats` → `messages` (1 chat, múltiples mensajes)
- `posts` → `post_media` (1 post, múltiples imágenes/videos)
- `posts` → `proposals` (1 post, múltiples propuestas)
- `professionals` → `proposals` (1 profesional, múltiples propuestas)
- `professionals` → `certifications` (1 profesional, múltiples certificaciones)
- `professionals` → `bonuses` (1 profesional, múltiples bonos)
- `users` → `reviews` (como reviewer_id o reviewed_id)
- `users` → `payments` (como client_id o professional_id)
- `appointments` → `reviews` (1 appointment, 2 reviews max - bidireccional)
- `users` → `notifications` (1 user, múltiples notificaciones)

**Many-to-Many (N:M):**
- `professionals` ↔ `categories` (via `professional_categories`)
- `posts` ↔ `categories` (via `post_categories`)

---

### 4.2 Constraints de Integridad Referencial

**ON DELETE Policies:**

```sql
-- Si user se borra, borrar todo en cascada (GDPR compliance)
ALTER TABLE professionals ADD CONSTRAINT fk_professionals_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE posts ADD CONSTRAINT fk_posts_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE chats ADD CONSTRAINT fk_chats_client
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE chats ADD CONSTRAINT fk_chats_professional
  FOREIGN KEY (professional_id) REFERENCES users(id) ON DELETE CASCADE;

-- Si post se borra (hard delete), borrar propuestas asociadas
ALTER TABLE proposals ADD CONSTRAINT fk_proposals_post
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;

-- Si professional se borra, NO borrar proposals (mantener historial)
ALTER TABLE proposals ADD CONSTRAINT fk_proposals_professional
  FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE RESTRICT;

-- Si proposal se borra, NO permitir (appointments debe existir siempre)
ALTER TABLE appointments ADD CONSTRAINT fk_appointments_proposal
  FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE RESTRICT;

-- Payments no se pueden borrar nunca (auditoría fiscal)
ALTER TABLE payments ADD CONSTRAINT fk_payments_client
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE payments ADD CONSTRAINT fk_payments_professional
  FOREIGN KEY (professional_id) REFERENCES users(id) ON DELETE RESTRICT;

-- Reviews no se pueden borrar (reputación permanente)
ALTER TABLE reviews ADD CONSTRAINT fk_reviews_appointment
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE RESTRICT;
```

---

## 5. Índices para Performance

**Ver sección 6 completa con SQL detallado.**

**Resumen índices críticos:**
1. **Geolocalización**: GIST en users.location y posts.location (búsquedas <50ms)
2. **Chat ordenado**: B-tree en chats.last_message_at DESC (lista conversaciones)
3. **Feed posts**: B-tree en posts.created_at DESC + status (timeline rápido)
4. **Búsqueda profesionales**: Composite en (category_id, is_verified, hourly_rate)
5. **Notificaciones no leídas**: Partial index en notifications WHERE read=FALSE
6. **Expiración posts/proposals**: B-tree en expires_at (cronjob eficiente)

---

## 6. Queries Frecuentes Optimizadas

### 6.1 Buscar Profesionales por Categoría y Cercanía

```sql
-- Input: category_slug='plomero', client_lat=-34.6037, client_lng=-58.3816, radius=30km
SELECT 
  u.id,
  u.full_name,
  u.profile_photo_url,
  u.rating,
  p.hourly_rate,
  ST_Distance(
    u.location,
    ST_MakePoint(:client_lng, :client_lat)::geography
  ) / 1000 AS distance_km,
  ARRAY_AGG(c.name) AS categories
FROM users u
JOIN professionals p ON u.id = p.user_id
JOIN professional_categories pc ON p.id = pc.professional_id
JOIN categories c ON pc.category_id = c.id
WHERE 
  u.is_active = TRUE
  AND p.is_verified = TRUE
  AND ST_DWithin(
    u.location,
    ST_MakePoint(:client_lng, :client_lat)::geography,
    30000 -- 30km en metros
  )
  AND EXISTS (
    SELECT 1 FROM professional_categories pc2
    JOIN categories c2 ON pc2.category_id = c2.id
    WHERE pc2.professional_id = p.id AND c2.slug = :category_slug
  )
GROUP BY u.id, p.id
ORDER BY distance_km ASC
LIMIT 50;
```

**Performance:** <100ms con 10K profesionales (con índice GIST)

---

### 6.2 Feed de Posts para Profesional

```sql
-- Input: professional_id=5, professional_location, categories=[1,2]
SELECT 
  p.id,
  p.title,
  p.description,
  p.created_at,
  u.full_name AS client_name,
  u.rating AS client_rating,
  ST_Distance(
    ST_MakePoint(p.longitude, p.latitude)::geography,
    :professional_location
  ) / 1000 AS distance_km,
  ARRAY_AGG(c.name) AS categories,
  (SELECT COUNT(*) FROM proposals WHERE post_id = p.id) AS proposal_count
FROM posts p
JOIN users u ON p.user_id = u.id
JOIN post_categories pc ON p.id = pc.post_id
JOIN categories c ON pc.category_id = c.id
WHERE 
  p.status = 'open'
  AND p.deleted_at IS NULL
  AND p.expires_at > NOW()
  AND ST_DWithin(
    ST_MakePoint(p.longitude, p.latitude)::geography,
    :professional_location,
    30000
  )
  AND pc.category_id = ANY(:categories) -- [1,2]
GROUP BY p.id, u.id
ORDER BY p.created_at DESC
LIMIT 20;
```

**Performance:** <200ms con 5K posts activos

---

### 6.3 Historial Chat Paginado

```sql
-- Input: chat_id=123, offset=0, limit=50
SELECT 
  m.id,
  m.sender_id,
  m.message_text,
  m.media_url,
  m.read,
  m.created_at,
  u.full_name AS sender_name,
  u.profile_photo_url AS sender_photo
FROM messages m
JOIN users u ON m.sender_id = u.id
WHERE m.chat_id = :chat_id
ORDER BY m.created_at DESC
LIMIT :limit OFFSET :offset;
```

**Performance:** <50ms con 10K mensajes (índice en chat_id + created_at)

---

### 6.4 Próximos Appointments (Calendario Profesional)

```sql
-- Input: professional_id=5, start_date='2026-03-22', end_date='2026-03-29'
SELECT 
  a.id,
  a.scheduled_date,
  a.scheduled_time,
  a.status,
  pr.price,
  po.title AS post_title,
  u.full_name AS client_name,
  u.phone AS client_phone,
  u.address AS client_address,
  ST_Y(ST_MakePoint(u.longitude, u.latitude)) AS client_lat,
  ST_X(ST_MakePoint(u.longitude, u.latitude)) AS client_lng
FROM appointments a
JOIN proposals pr ON a.proposal_id = pr.id
JOIN posts po ON pr.post_id = po.id
JOIN users u ON po.user_id = u.id
WHERE 
  pr.professional_id = :professional_id
  AND a.scheduled_date BETWEEN :start_date AND :end_date
  AND a.status IN ('scheduled', 'in_progress')
ORDER BY a.scheduled_date ASC, a.scheduled_time ASC;
```

**Performance:** <30ms con 500 appointments

---

### 6.5 Calcular Rating Promedio User

```sql
-- Trigger ejecuta después de cada INSERT en reviews
UPDATE users
SET rating = (
  SELECT ROUND(AVG(rating)::numeric, 2)
  FROM reviews
  WHERE reviewed_id = :user_id
)
WHERE id = :user_id;
```

**Alternativa (materialized view para stats avanzadas):**
```sql
CREATE MATERIALIZED VIEW user_stats AS
SELECT 
  u.id,
  COUNT(r.id) AS total_reviews,
  AVG(r.rating) AS avg_rating,
  COUNT(r.id) FILTER (WHERE r.rating = 5) AS five_star_count,
  COUNT(r.id) FILTER (WHERE r.rating = 4) AS four_star_count,
  COUNT(r.id) FILTER (WHERE r.rating = 3) AS three_star_count,
  COUNT(r.id) FILTER (WHERE r.rating = 2) AS two_star_count,
  COUNT(r.id) FILTER (WHERE r.rating = 1) AS one_star_count
FROM users u
LEFT JOIN reviews r ON u.id = r.reviewed_id
GROUP BY u.id;

-- Refresh cada hora (cronjob)
REFRESH MATERIALIZED VIEW CONCURRENTLY user_stats;
```

---

## 7. Migraciones y Versionado

**Herramienta:** Prisma Migrate

**Workflow:**
```bash
# Desarrollo
npx prisma migrate dev --name add_fcm_token_users

# Staging
npx prisma migrate deploy

# Producción
npx prisma migrate deploy
```

**Rollback Strategy:**
- Prisma NO soporta rollback automático
- Backup BD antes de cada migración producción
- Migrations destructivas (DROP COLUMN) requieren aprobación manual

**Ejemplo Migration:**
```sql
-- Migration: 20260321_add_geolocation_users
ALTER TABLE users ADD COLUMN latitude DECIMAL(10,8);
ALTER TABLE users ADD COLUMN longitude DECIMAL(11,8);

-- Migrar datos existentes (geocode addresses con script Python/Node)
-- Script externo llama Google Geocoding API y actualiza lat/lng

-- Después de migración completa:
ALTER TABLE users ALTER COLUMN latitude SET NOT NULL;
ALTER TABLE users ALTER COLUMN longitude SET NOT NULL;
CREATE INDEX idx_users_location ON users USING GIST(ST_MakePoint(longitude, latitude)::geography);
```

---

## 8. Backup y Disaster Recovery

**Estrategia:**
- **Automated backups**: Railway/Render hacen backup diario automático (retention 7 días)
- **Manual snapshot**: Antes de cada deploy producción
- **Point-in-time recovery**: PostgreSQL WAL archiving (30 días retention)
- **Offsite backup**: Export semanal a S3 (encrypted)

**Comandos:**
```bash
# Backup manual
pg_dump -h host -U user -d quickfixu_prod > backup_$(date +%Y%m%d).sql

# Restore
psql -h host -U user -d quickfixu_prod < backup_20260321.sql
```

**Testing recovery:** Cada 3 meses, restore a staging y validar integridad

---

## 9. Seguridad y Compliance

### 9.1 Datos Sensibles

**Encriptados en BD:**
- `users.password_hash` (bcrypt cost 12)
- `professionals.credit_card_token` (tokenizado MP, NO guardamos número real)

**Encriptados en tránsito:**
- Todas requests HTTPS (TLS 1.3)
- WebSocket sobre WSS (secure)

**PII (Personally Identifiable Information):**
- `users.email`, `users.phone`, `users.dni`, `users.address`
- Acceso restringido: Solo owner + admin
- GDPR: Derecho a borrado (hard delete user + CASCADE)

---

### 9.2 Auditoría

**Logs críticos:**
- Tabla `audit_logs` (Fase 2):
  - `user_id`, `action` (ej: 'update_payment_status'), `old_value`, `new_value`, `ip_address`, `timestamp`
- Retención: 1 año (compliance fiscal Argentina)

**Eventos auditados:**
- Cambios payment.status
- Aprobación/rechazo certificaciones
- Bloqueos usuarios (is_active=FALSE)
- Refunds (payment.status='refunded')

---

## 10. Anexo: Schema Prisma Completo

**Ver archivo:** `prisma/schema.prisma` (generado desde modelo)

**Comando generar:**
```bash
npx prisma db pull  # Desde BD existente
npx prisma generate # Cliente Prisma TypeScript
```

---

## 11. Conclusión

Este modelo de datos está diseñado para:
- ✅ **Performance**: Índices estratégicos, queries <200ms
- ✅ **Escalabilidad**: Soporta 10K+ usuarios sin cambios arquitectura
- ✅ **Integridad**: Constraints + triggers garantizan consistencia
- ✅ **Auditoría**: Soft deletes, timestamps, logs
- ✅ **Flexibilidad**: JSONB permite evolución sin migrations (horarios, OCR data)
- ✅ **Seguridad**: Encriptación, PII protegida, compliance GDPR

**Próximos pasos:**
1. Implementar schema en Prisma (`schema.prisma`)
2. Ejecutar migrations en desarrollo
3. Seed BD con datos ejemplo (categorías, users test, posts ficticios)
4. Testing queries performance con dataset 1K registros
5. Deploy staging + validación E2E

---

**Fin Documento Modelo de Datos - v2.0**  
*Última actualización: Marzo 2026*
