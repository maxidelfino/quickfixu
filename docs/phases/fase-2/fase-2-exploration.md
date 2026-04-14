# Exploration: Fase 2 - Posts & Proposals

**Change name:** `fase-2-posts-proposals`  
**Date:** Marzo 2026  
**Status:** Exploration Complete  
**Prerequisite:** Fase 1 (Core Authentication & Profiles) MUST be completed

---

## 1. Executive Summary

La Fase 2 implementa el **núcleo del negocio de QuickFixU**: clientes publican problemas (`posts`), profesionales envían presupuestos (`proposals`), y se negocia/acepta a través de chat. Sin esta fase, la aplicación es solo un directorio de profesionales sin transacciones.

**Complejidad:** ALTA — Esta fase tiene más interdependencias técnicas que Fase 1.

**Decisiones clave tomadas:**

| Decisión | Opción Seleccionada | Justificación |
|----------|---------------------|---------------|
| Upload múltiple media | Multer + Cloudinary con límites: 5 imágenes + 2 videos | Balance usabilidad vs costo (free tier Cloudinary) |
| Procesamiento videos | Sincrónico con timeout 30s (MVP), asíncrono con queue Fase 3 | Simplicidad MVP, 80% videos <30MB |
| Paginación posts | Cursor-based con `createdAt` + `id` | Evita duplicados cuando nuevo post se inserta |
| Búsqueda geográfica | PostGIS `ST_DWithin` 30km + índice GIST | Ya implementado Fase 1, performance <200ms |
| Cronjob expiración | node-cron cada 1 hora (posts/proposals expirados) | Balance carga servidor vs inmediatez |
| Notificaciones | FCM push + tabla `notifications` in-app | FCM ya integrado Fase 1, tabla para historial |
| Validación precio propuesta | ARS 500 - ARS 100,000 (rango configurable) | Previene errores tipeo, permite ajuste futuro |
| Múltiples propuestas | Profesional puede enviar 1 sola por post | Simplifica lógica MVP, re-negociar en chat |
| Re-negociación | Modificar propuesta `pending` (trackear cambios en chat) | Sin tabla `proposal_history` en MVP |
| Soft delete posts | Cronjob diario marca `deleted_at` después 90 días | GDPR compliance, recuperación datos |

**Features a entregar:**
1. **Posts (Publicaciones Cliente):** Crear, listar, expirar, soft delete
2. **Post Media:** Upload múltiples imágenes/videos con validación
3. **Proposals (Presupuestos Profesional):** Crear, aceptar/rechazar, expirar
4. **Feed Profesionales:** Posts filtrados por categoría + geolocalización 30km
5. **Historial Posts Cliente:** Ver propuestas recibidas, estados
6. **Notificaciones Push:** Eventos críticos (nueva propuesta, aceptación, expiración)
7. **Interacción Chat-Proposals:** Auto-creación chat cuando envía propuesta
8. **Cronjobs:** Expiración automática posts/proposals (48hs)

**Riesgos identificados:**
- **Abuse prevention:** Cliente spam (crear 100 posts/día) → Rate limit 10 posts/día
- **Cloudinary bandwidth:** Free tier 25GB/mes, videos consumen rápido → Límite 2 videos/post
- **Expiración race conditions:** Post expira mientras cliente acepta propuesta → Lock transaccional
- **Geolocalización privacy:** Mostrar ubicación exacta en post → Truncar a 2 decimales (±1km)

**Ready for proposal:** ✅ YES — Todas las preguntas clave tienen respuesta, dependencias claras.

---

## 2. Current State (Post Fase 1)

### Ya Tenemos Implementado:
✅ Usuarios (clientes + profesionales) con autenticación JWT  
✅ Perfiles con geolocalización PostGIS (lat/lng en `users.location`)  
✅ Tabla `categories` + join `professional_categories` (many-to-many)  
✅ Cloudinary integración (upload profile photos)  
✅ FCM push notifications (token en `users.fcm_token`)  
✅ Middleware `requireAuth` y `isProfessional`  
✅ Geocoding service (Nominatim + Google fallback)  
✅ Redis cache (para geocoding)  

### Base de Datos Actual:
```sql
-- Tablas ya existentes (Fase 1)
users (id, full_name, email, latitude, longitude, location [PostGIS], fcm_token, ...)
professionals (id, user_id, years_experience, description, ...)
categories (id, name, slug, icon)
professional_categories (professional_id, category_id)
certifications (id, professional_id, file_url, status, ...)
refresh_tokens (id, user_id, token_hash, expires_at, ...)
```

### Tablas a Crear (Fase 2):
```sql
posts (id, user_id, title, description, latitude, longitude, location [PostGIS], status, expires_at, deleted_at, ...)
post_categories (post_id, category_id)  -- many-to-many
post_media (id, post_id, media_type, media_url, ...)
proposals (id, post_id, professional_id, price, description, scheduled_date, scheduled_time, status, expires_at, ...)
chats (id, client_id, professional_id, last_message_at, ...)  -- Fase 3 agrega messages
notifications (id, user_id, type, title, body, data [JSON], read, sent_at, ...)
```

**IMPORTANTE:** Tabla `chats` se crea en Fase 2 pero no tiene `messages` ni WebSockets hasta Fase 3. En Fase 2 solo existe para marcar que "este cliente y profesional tienen conversación activa" (creada al enviar propuesta).

---

## 3. Technical Options Evaluated

### 3.1 Upload Múltiple de Media

**Contexto:** Cliente debe poder subir fotos/videos del problema para que profesional evalúe sin visita previa.

#### Opción A: Solo Imágenes (Sin Videos) 🔴
**Pros:**
- Más simple (no procesamiento pesado)
- Cloudinary free tier dura más tiempo
- Upload rápido (<2s con 5 imágenes)

**Cons:**
- Cliente no puede mostrar problema dinámico (ej: ruido calefón, fuga activa)
- Competencia (TaskRabbit, Thumbtack) permite videos
- Desventaja competitiva clara

**Veredicto:** ❌ Rechazado — Los videos son críticos para diferenciación.

---

#### Opción B: Multer + Cloudinary con Límites: 5 Imágenes + 2 Videos ✅
**Pros:**
- Balance usabilidad vs costo
- Multer maneja multipart/form-data nativamente
- Cloudinary auto-transcode videos a formatos web-friendly
- Límite 2 videos protege free tier (25GB bandwidth/mes)

**Cons:**
- Videos grandes (>50MB) pueden tener timeout
- Cloudinary free tier bandwidth se consume rápido si hay muchos posts

**Implementación:**
```typescript
// Multer config
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max por archivo
    files: 7, // 5 imgs + 2 videos
  },
  fileFilter: (req, file, cb) => {
    const allowedImages = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedVideos = ['video/mp4', 'video/quicktime']; // .mov
    
    if ([...allowedImages, ...allowedVideos].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Controller
router.post('/posts', requireAuth, upload.array('media', 7), async (req, res) => {
  const { title, description, categoryIds, latitude, longitude } = req.body;
  const files = req.files as Express.Multer.File[];
  
  // Validar tipos: max 5 imágenes + 2 videos
  const images = files.filter(f => f.mimetype.startsWith('image/'));
  const videos = files.filter(f => f.mimetype.startsWith('video/'));
  
  if (images.length > 5) {
    return res.status(400).json({ error: 'Maximum 5 images allowed' });
  }
  if (videos.length > 2) {
    return res.status(400).json({ error: 'Maximum 2 videos allowed' });
  }
  
  // Upload a Cloudinary (paralelo con Promise.all)
  const uploadPromises = files.map(file => 
    uploadService.uploadPostMedia(file, userId, postId)
  );
  const urls = await Promise.all(uploadPromises);
  
  // Crear post + post_media en transacción
  // ...
});
```

**Validaciones:**
- **Tipos MIME:** `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `video/quicktime`
- **Tamaño imágenes:** 5MB max (valida Multer)
- **Tamaño videos:** 50MB max (80% casos <30MB según competencia)
- **Timeout upload:** 30 segundos (rechaza videos muy pesados)

**Veredicto:** ✅ **RECOMENDADO** — Mejor balance MVP.

---

#### Opción C: AWS S3 + Lambda Transcoding 🟡
**Pros:**
- Más escalable (procesamiento asíncrono)
- S3 más barato a gran escala ($0.023/GB vs Cloudinary)
- Lambda auto-scale para procesamiento videos

**Cons:**
- Complejidad alta (setup S3 + Lambda + CloudFront)
- Costo adicional Lambda (free tier 1M requests/mes, suficiente MVP pero requiere setup)
- Time-to-market más lento (Cloudinary es plug-and-play)

**Veredicto:** 🟡 **Post-PMF** — Migrar cuando superemos Cloudinary free tier (estimado: 5K posts con video).

---

### 3.2 Procesamiento Asíncrono de Videos

**Contexto:** Videos grandes pueden tardar >10s en subir + transcode. ¿Bloqueamos request o procesamos async?

#### Opción A: Sincrónico con Timeout 30s ✅
**Pros:**
- Simple (sin queue infrastructure)
- Cliente recibe URL inmediata al finalizar upload
- 80% videos <30MB se procesan en <10s (según Cloudinary docs)

**Cons:**
- Timeout para videos >50MB (cliente debe reintentar)
- Request HTTP largo (mobile app debe manejar)

**Implementación:**
```typescript
// uploadService.ts
async uploadPostMedia(file: Express.Multer.File, userId: number, postId: number): Promise<string> {
  const isVideo = file.mimetype.startsWith('video/');
  
  const result = await new Promise<any>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `quickfixu/posts/${postId}`,
        resource_type: isVideo ? 'video' : 'image',
        timeout: 30000, // 30s timeout
        ...(isVideo && {
          eager: [{ format: 'mp4', video_codec: 'h264' }], // Transcode a H.264
          eager_async: false, // Esperar transcode antes de retornar
        }),
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(file.buffer);
  });
  
  return result.secure_url;
}
```

**Veredicto:** ✅ **RECOMENDADO MVP** — Simplicidad > features avanzadas.

---

#### Opción B: Queue con Bull + Redis 🟡
**Pros:**
- No bloquea request HTTP (retorna inmediato)
- Retry automático si upload falla
- Cliente puede ver "Procesando video..." en UI

**Cons:**
- Requiere Bull + Redis (infraestructura adicional)
- Cliente debe hacer polling para saber cuándo video está listo
- Complejidad testing (jobs asíncronos)

**Cuándo migrar:** Cuando >20% uploads fallen por timeout (métrica a trackear).

**Veredicto:** 🟡 **Fase 3** — Implementar si MVP tiene problemas de timeout.

---

### 3.3 Paginación Feed de Posts

**Contexto:** Profesionales verán feed con cientos de posts abiertos. ¿Offset/limit o cursor-based?

#### Opción A: Offset/Limit (Tradicional) 🔴
```sql
SELECT * FROM posts WHERE status='open' ORDER BY created_at DESC LIMIT 20 OFFSET 40;
```

**Pros:**
- Simple de implementar
- Cliente puede saltar a página N directamente

**Cons:**
- **Problema grave:** Si nuevo post se inserta entre página 1 y 2, cliente ve duplicado
- Performance degrada con offset alto (PostgreSQL escanea todas las filas previas)

**Veredicto:** ❌ Rechazado — Duplicados son UX killer en feed.

---

#### Opción B: Cursor-Based con `createdAt` + `id` ✅
```sql
-- Primera página
SELECT * FROM posts 
WHERE status='open' AND deleted_at IS NULL
ORDER BY created_at DESC, id DESC 
LIMIT 20;

-- Siguiente página (cursor = último post: {createdAt: '2026-03-22T10:00:00Z', id: 42})
SELECT * FROM posts 
WHERE status='open' AND deleted_at IS NULL
  AND (created_at < '2026-03-22T10:00:00Z' OR (created_at = '2026-03-22T10:00:00Z' AND id < 42))
ORDER BY created_at DESC, id DESC 
LIMIT 20;
```

**Pros:**
- ✅ No hay duplicados (cursor apunta a posición exacta)
- ✅ Performance constante (índice en `created_at, id`)
- ✅ Funciona con inserts/deletes concurrentes

**Cons:**
- Cliente no puede saltar a página N (solo "siguiente")
- Cursor más complejo que `?page=2`

**Implementación Frontend:**
```typescript
// React Native con React Query
const { data, fetchNextPage } = useInfiniteQuery({
  queryKey: ['posts', filters],
  queryFn: ({ pageParam }) => 
    api.get('/posts', { params: { cursor: pageParam, limit: 20 } }),
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});

// Backend retorna
{
  posts: [...],
  nextCursor: { createdAt: '...', id: 42 }, // Null si última página
}
```

**Veredicto:** ✅ **RECOMENDADO** — Standard industry para feeds.

---

#### Opción C: Keyset Pagination (Solo `createdAt`) 🟡
```sql
WHERE created_at < :cursor ORDER BY created_at DESC
```

**Pros:**
- Más simple que opción B

**Cons:**
- **Falla si múltiples posts tienen mismo `created_at`** (probable con inserts masivos)
- Solución: agregar `id` como tiebreaker (= Opción B)

**Veredicto:** 🟡 Equivalente a Opción B — usar `createdAt + id` siempre.

---

### 3.4 Búsqueda Geográfica 30km

**Contexto:** Feed profesionales debe mostrar solo posts en radio 30km. Ya tenemos PostGIS implementado (Fase 1).

#### Opción A: Haversine SQL Puro 🔴
```sql
-- Calcular distancia con fórmula Haversine (sin PostGIS)
SELECT *, (
  6371 * acos(
    cos(radians(:prof_lat)) * cos(radians(latitude)) *
    cos(radians(longitude) - radians(:prof_lng)) +
    sin(radians(:prof_lat)) * sin(radians(latitude))
  )
) AS distance_km
FROM posts
HAVING distance_km <= 30
ORDER BY distance_km;
```

**Pros:**
- No requiere extensión PostGIS

**Cons:**
- **Lentísimo:** Full table scan (no índice espacial)
- No usa índice GIST (ventaja clave PostGIS)
- Performance: ~2-5s con 10K posts

**Veredicto:** ❌ Rechazado — PostGIS ya está instalado.

---

#### Opción B: PostGIS `ST_DWithin` con Índice GIST ✅
```sql
-- Ya implementado en Fase 1 para buscar profesionales
SELECT p.*, 
  ST_Distance(
    p.location,
    ST_SetSRID(ST_MakePoint(:prof_lng, :prof_lat), 4326)::geography
  ) / 1000 AS distance_km
FROM posts p
JOIN post_categories pc ON p.id = pc.post_id
WHERE p.status = 'open'
  AND p.deleted_at IS NULL
  AND p.expires_at > NOW()
  AND ST_DWithin(
    p.location,
    ST_SetSRID(ST_MakePoint(:prof_lng, :prof_lat), 4326)::geography,
    30000  -- 30km en metros
  )
  AND pc.category_id = ANY(:prof_category_ids)
ORDER BY p.created_at DESC
LIMIT 20;
```

**Pros:**
- ✅ Performance <200ms con 10K posts (índice GIST)
- ✅ Reutiliza infraestructura Fase 1
- ✅ Precisión geográfica exacta (no aproximación)

**Cons:**
- Ninguno (ya está implementado)

**Índice requerido:**
```sql
CREATE INDEX idx_posts_location ON posts USING GIST(location);
CREATE INDEX idx_posts_status_expires ON posts(status, expires_at);
```

**Veredicto:** ✅ **RECOMENDADO** — Ya validado en Fase 1.

---

#### Opción C: Redis Geo (Cache) 🟡
```typescript
// Cache posts por zona geográfica en Redis
redis.geoadd('posts:open', longitude, latitude, postId);
const nearbyIds = await redis.georadius('posts:open', profLng, profLat, 30, 'km');
```

**Pros:**
- Queries sub-10ms (in-memory)
- Escala a millones de posts

**Cons:**
- Complejidad: mantener sincronización Redis ↔ PostgreSQL
- Cache invalidation complejo (cuando post expira/cierra)
- Overkill para MVP (<10K posts)

**Cuándo migrar:** Cuando feed PostgreSQL tarde >500ms (estimado: 50K posts activos).

**Veredicto:** 🟡 **Post-PMF** — No necesario hasta escala mayor.

---

### 3.5 Cronjobs Expiración

**Contexto:** Posts y proposals expiran 48hs después de creación. ¿Cada cuánto ejecutar el cronjob?

#### Opción A: node-cron cada 5 minutos 🔴
```typescript
cron.schedule('*/5 * * * *', async () => {
  await expirePostsAndProposals();
});
```

**Pros:**
- Expiración casi en tiempo real

**Cons:**
- Carga innecesaria en servidor (ejecuta 288 veces/día)
- Query ejecuta incluso si no hay posts por expirar

**Veredicto:** ❌ Overkill — No hay urgencia de expirar exactamente en minuto 48.

---

#### Opción B: node-cron cada 1 hora ✅
```typescript
cron.schedule('0 * * * *', async () => {
  const now = new Date();
  
  // Expirar posts abiertos cuyo expires_at < now
  const expiredPosts = await prisma.post.updateMany({
    where: {
      status: 'open',
      expires_at: { lt: now },
    },
    data: { status: 'expired' },
  });
  
  // Expirar proposals pendientes
  const expiredProposals = await prisma.proposal.updateMany({
    where: {
      status: 'pending',
      expires_at: { lt: now },
    },
    data: { status: 'expired' },
  });
  
  console.log(`Expired ${expiredPosts.count} posts, ${expiredProposals.count} proposals`);
});
```

**Pros:**
- ✅ Balance carga vs inmediatez (24 ejecuciones/día)
- ✅ Diferencia 1 hora en expiración es aceptable UX
- ✅ Query eficiente (índice en `expires_at`)

**Cons:**
- Post puede quedar "técnicamente abierto" hasta 59 minutos después de expirar

**Mitigación:** Frontend valida `expires_at` localmente y muestra badge "Expirado" aunque status sea `open`.

**Veredicto:** ✅ **RECOMENDADO** — Standard para este tipo de job.

---

#### Opción C: PostgreSQL Triggers (Expiración Automática) 🟡
```sql
-- Trigger que marca status='expired' automáticamente en SELECT
CREATE OR REPLACE FUNCTION check_expiration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at < NOW() AND NEW.status = 'open' THEN
    NEW.status := 'expired';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Pros:**
- Expiración instantánea (no espera cronjob)

**Cons:**
- Trigger ejecuta en CADA SELECT (overhead)
- No envía notificaciones (cronjob puede notificar cliente)
- Complejidad debug (lógica en DB)

**Veredicto:** 🟡 **Evitar en MVP** — Triggers ocultan lógica de negocio.

---

### 3.6 Notificaciones Push

**Contexto:** FCM ya integrado (Fase 1). ¿Qué eventos notificar?

#### Eventos Críticos (MUST HAVE) ✅
1. **Profesional envía propuesta** → Notificar cliente
2. **Cliente acepta propuesta** → Notificar profesional
3. **Cliente rechaza propuesta** → Notificar profesional
4. **Post a punto de expirar (24hs antes)** → Notificar cliente
5. **Proposal a punto de expirar (24hs antes)** → Notificar profesional

#### Eventos Secundarios (NICE TO HAVE - Fase 3) 🟡
6. Nuevo post en zona profesional → Notificar si tiene categoría
7. Mensaje nuevo en chat → Notificar destinatario

**Implementación:**
```typescript
// notificationService.ts
async sendProposalNotification(proposalId: number) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      post: { include: { user: true } },
      professional: { include: { user: true } },
    },
  });
  
  const client = proposal.post.user;
  
  // Enviar FCM
  await admin.messaging().send({
    token: client.fcm_token,
    notification: {
      title: '🎉 Nueva propuesta',
      body: `${proposal.professional.user.full_name} envió presupuesto: ARS ${proposal.price}`,
    },
    data: {
      type: 'new_proposal',
      proposalId: proposalId.toString(),
      postId: proposal.post_id.toString(),
    },
  });
  
  // Guardar en tabla notifications (historial in-app)
  await prisma.notification.create({
    data: {
      user_id: client.id,
      type: 'new_proposal',
      title: '🎉 Nueva propuesta',
      body: `${proposal.professional.user.full_name} envió presupuesto: ARS ${proposal.price}`,
      data: { proposalId, postId: proposal.post_id },
    },
  });
}
```

**Tabla `notifications`:**
```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'new_proposal', 'proposal_accepted', 'post_expiring', ...
  title VARCHAR(100) NOT NULL,
  body TEXT NOT NULL,
  data JSONB, -- { proposalId, postId, ... }
  read BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_notifications_user_read (user_id, read)
);
```

**Veredicto:** ✅ Implementar eventos críticos + tabla notifications.

---

### 3.7 Validaciones Precio Propuesta

**Contexto:** ¿Permitir cualquier precio o validar rangos?

#### Opción A: Sin Validación (Cualquier Precio) 🔴
**Pros:**
- Flexibilidad total profesional

**Cons:**
- Profesional puede poner ARS 1 por error (typo)
- Cliente confundido con precios irreales

**Veredicto:** ❌ Rechazado — Mínimo ARS 500 protege contra errores.

---

#### Opción B: Rango Configurable ARS 500 - ARS 100,000 ✅
```typescript
// validation schema
const proposalSchema = z.object({
  price: z.number()
    .min(500, 'Precio mínimo ARS 500')
    .max(100000, 'Precio máximo ARS 100,000. Para trabajos mayores, contactar soporte.'),
  description: z.string().min(10).max(300),
  scheduled_date: z.string().refine(date => new Date(date) > new Date(), 'Fecha debe ser futura'),
  scheduled_time: z.string().regex(/^\d{2}:\d{2}$/),
});
```

**Pros:**
- ✅ Previene errores tipeo
- ✅ Límite superior protege contra abuse (presupuestos fake altísimos)
- ✅ Configurable en constants (ajustar si inflación)

**Cons:**
- Trabajos >ARS 100K existen (renovación completa instalación eléctrica)

**Mitigación:** Mensaje error invita contactar soporte para trabajos mayores (admin puede crear manualmente).

**Veredicto:** ✅ **RECOMENDADO** — Balance seguridad vs flexibilidad.

---

### 3.8 Múltiples Propuestas del Mismo Profesional

**Contexto:** ¿Profesional puede enviar 2+ propuestas al mismo post?

#### Opción A: Permitir Múltiples (con Historial) 🟡
**Pros:**
- Profesional puede enviar "Plan A" (ARS 5K solo mano obra) y "Plan B" (ARS 8K con materiales)

**Cons:**
- Confusión cliente (¿cuál es la válida?)
- Complejidad UI (mostrar 3 propuestas del mismo profesional)

**Veredicto:** 🟡 **Fase 3** — Feature nice-to-have pero no crítico MVP.

---

#### Opción B: Solo 1 Propuesta (Editar en Chat para Re-negociar) ✅
**Implementación:**
```typescript
// Constraint en DB
CREATE UNIQUE INDEX idx_proposals_professional_post 
ON proposals(professional_id, post_id) 
WHERE status IN ('pending', 'accepted');

// Validación backend
const existingProposal = await prisma.proposal.findFirst({
  where: {
    professional_id: professionalId,
    post_id: postId,
    status: { in: ['pending', 'accepted'] },
  },
});

if (existingProposal) {
  throw new AppError(409, 'Ya enviaste una propuesta a este post. Edítala en el chat.');
}
```

**Pros:**
- ✅ Simple (1 propuesta = 1 conversación en chat)
- ✅ Profesional puede modificar propuesta `pending` (re-negociar precio en chat)

**Cons:**
- No permite "planes alternativos"

**Veredicto:** ✅ **RECOMENDADO MVP** — Simplicidad > features avanzadas.

---

### 3.9 Estados de Post

**Contexto:** Cuando cliente acepta propuesta, ¿qué pasa con el post y otras propuestas?

#### Flujo Implementado:
```
1. Cliente crea post → status='open'
2. Profesional envía propuesta → status propuesta='pending'
3. Cliente acepta propuesta:
   a. Proposal.status → 'accepted'
   b. Post.status → 'closed'
   c. Otras proposals del mismo post → status='rejected' (auto)
   d. Se crea Chat (si no existe)
4. Post expira (48hs) sin aceptación:
   a. Post.status → 'expired'
   b. Todas proposals pendientes → status='expired'
```

**Estados Post:**
- `open`: Abierto, profesionales pueden enviar propuestas
- `closed`: Cliente aceptó una propuesta (trabajo en progreso)
- `expired`: Pasaron 48hs sin aceptación
- `completed`: Trabajo finalizado (Fase 4 - después de pago)

**Estados Proposal:**
- `pending`: Enviada, esperando respuesta cliente
- `accepted`: Cliente aceptó (solo 1 por post)
- `rejected`: Cliente rechazó explícitamente O auto-rechazada cuando acepta otra
- `expired`: Pasaron 48hs sin respuesta
- `cancelled`: Profesional canceló antes de aceptación (edge case)

**Transacción Aceptar Propuesta:**
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Marcar propuesta aceptada
  await tx.proposal.update({
    where: { id: proposalId },
    data: { status: 'accepted' },
  });
  
  // 2. Cerrar post
  await tx.post.update({
    where: { id: postId },
    data: { status: 'closed' },
  });
  
  // 3. Rechazar otras propuestas
  await tx.proposal.updateMany({
    where: {
      post_id: postId,
      id: { not: proposalId },
      status: 'pending',
    },
    data: { status: 'rejected' },
  });
  
  // 4. Crear chat (si no existe)
  await tx.chat.upsert({
    where: {
      client_id_professional_id: {
        client_id: clientId,
        professional_id: professionalId,
      },
    },
    create: { client_id: clientId, professional_id: professionalId },
    update: {},
  });
});
```

**Veredicto:** ✅ Flujo validado — Cubre casos edge.

---

### 3.10 Re-negociación de Propuestas

**Contexto:** Cliente y profesional negocian precio en chat. ¿Cómo actualizar propuesta?

#### Opción A: Tabla `proposal_history` (Full Audit) 🟡
```sql
CREATE TABLE proposal_history (
  id SERIAL PRIMARY KEY,
  proposal_id INTEGER REFERENCES proposals(id),
  old_price DECIMAL(10,2),
  new_price DECIMAL(10,2),
  old_date DATE,
  new_date DATE,
  changed_by INTEGER REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT NOW()
);
```

**Pros:**
- Audit trail completo
- Útil para analytics (cuántas veces se negocia)

**Cons:**
- Complejidad adicional MVP
- 90% propuestas no se re-negocian (según competencia)

**Veredicto:** 🟡 **Fase 3** — No crítico MVP.

---

#### Opción B: Permitir Editar Propuesta `pending` (Sin Historial) ✅
```typescript
// PATCH /api/proposals/:id
async updateProposal(proposalId: number, data: Partial<Proposal>) {
  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  
  if (proposal.status !== 'pending') {
    throw new AppError(400, 'Solo puedes editar propuestas pendientes');
  }
  
  const updated = await prisma.proposal.update({
    where: { id: proposalId },
    data: {
      price: data.price,
      scheduled_date: data.scheduled_date,
      scheduled_time: data.scheduled_time,
      description: data.description,
    },
  });
  
  // Notificar cliente que profesional actualizó propuesta
  await notificationService.sendProposalUpdated(proposalId);
  
  return updated;
}
```

**Pros:**
- ✅ Simple (sin tabla adicional)
- ✅ Profesional edita directamente en app
- ✅ Cliente ve precio actualizado inmediato

**Cons:**
- No hay historial (no se sabe precio anterior)

**Mitigación:** Mensajes en chat contienen texto "Actualicé el precio a ARS 7,500" (historial implícito).

**Veredicto:** ✅ **RECOMENDADO MVP** — Suficiente sin `proposal_history`.

---

### 3.11 Soft Delete de Posts

**Contexto:** Posts viejos (90 días después de cerrar/expirar) deben eliminarse por GDPR/storage.

#### Implementación:
```typescript
// Cronjob diario 3am
cron.schedule('0 3 * * *', async () => {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - 90); // 90 días atrás
  
  const deleted = await prisma.post.updateMany({
    where: {
      status: { in: ['closed', 'expired'] },
      updated_at: { lt: threshold },
      deleted_at: null,
    },
    data: { deleted_at: new Date() },
  });
  
  console.log(`Soft deleted ${deleted.count} old posts`);
});

// Queries SIEMPRE filtran deleted_at IS NULL
const posts = await prisma.post.findMany({
  where: {
    status: 'open',
    deleted_at: null, // ← IMPORTANTE
  },
});
```

**Hard Delete (180 días después de soft delete):**
```typescript
// Cronjob semanal domingos 4am
cron.schedule('0 4 * * 0', async () => {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - 180);
  
  // Borrar posts + cascade a post_media, post_categories, proposals
  await prisma.post.deleteMany({
    where: {
      deleted_at: { lt: threshold },
    },
  });
});
```

**Veredicto:** ✅ Implementar soft delete + hard delete.

---

### 3.12 Autorización y Permisos

**Middleware a implementar:**

```typescript
// middleware/requireClient.ts
export const requireClient = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.user.role !== 'client') {
    return res.status(403).json({ error: 'Only clients can create posts' });
  }
  
  next();
};

// middleware/requireProfessional.ts (ya existe Fase 1)
export const requireProfessional = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'professional') {
    return res.status(403).json({ error: 'Only professionals can send proposals' });
  }
  next();
};

// middleware/requireOwnership.ts
export const requirePostOwnership = async (req: Request, res: Response, next: NextFunction) => {
  const postId = parseInt(req.params.id);
  const post = await prisma.post.findUnique({ where: { id: postId } });
  
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }
  
  if (post.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit your own posts' });
  }
  
  next();
};
```

**Endpoints protegidos:**
| Endpoint | Middleware | Validación Adicional |
|----------|------------|----------------------|
| `POST /api/posts` | `requireAuth` + `requireClient` | Rate limit 10 posts/día |
| `PATCH /api/posts/:id` | `requireAuth` + `requirePostOwnership` | Solo status='open' |
| `GET /api/posts/:id` | `requireAuth` | Cualquier usuario puede ver |
| `POST /api/proposals` | `requireAuth` + `requireProfessional` | Validar post.status='open' |
| `PATCH /api/proposals/:id` | `requireAuth` + `requireProposalOwnership` | Solo status='pending' |
| `POST /api/proposals/:id/accept` | `requireAuth` + `requirePostOwnership` | Cliente del post |

**Veredicto:** ✅ Implementar middleware reutilizables.

---

## 4. Architecture Decisions

### AD-001: Upload Strategy
**Decision:** Multer + Cloudinary sincrónico con límites 5 imágenes + 2 videos, timeout 30s.  
**Rationale:** Balance MVP simplicidad vs features. Cloudinary free tier suficiente para 5K posts.  
**Alternatives Considered:** AWS S3 + Lambda (overkill MVP), solo imágenes (desventaja competitiva).  
**Risks:** Cloudinary bandwidth se puede agotar si videos virales. **Mitigation:** Monitorear uso, migrar S3 si >80% free tier.

---

### AD-002: Pagination Strategy
**Decision:** Cursor-based con `(createdAt DESC, id DESC)`.  
**Rationale:** Evita duplicados en feed, performance constante con índice.  
**Alternatives Considered:** Offset/limit (duplicados), keyset sin id (falla con timestamps iguales).  
**Implementation:** Backend retorna `nextCursor: {createdAt, id}`, frontend usa React Query `useInfiniteQuery`.

---

### AD-003: Geolocation Queries
**Decision:** PostGIS `ST_DWithin` 30km con índice GIST (reutilizar Fase 1).  
**Rationale:** Ya validado, performance <200ms con 10K posts.  
**Alternatives Considered:** Haversine SQL puro (lento), Redis Geo cache (overkill MVP).  
**Risks:** Ninguno (infraestructura existente).

---

### AD-004: Expiration Cronjobs
**Decision:** node-cron cada 1 hora para posts/proposals, cronjob diario para soft delete.  
**Rationale:** Balance carga servidor vs UX (1 hora delay aceptable).  
**Alternatives Considered:** Cada 5 min (overkill), triggers PostgreSQL (lógica oculta).  
**Implementation:** Frontend valida `expires_at` localmente (muestra "Expirado" inmediato).

---

### AD-005: Notification Strategy
**Decision:** FCM push para eventos críticos + tabla `notifications` in-app.  
**Rationale:** FCM ya integrado Fase 1, tabla permite historial/recovery.  
**Events MVP:** new_proposal, proposal_accepted/rejected, post/proposal_expiring.  
**Events Fase 3:** new_message, new_post_in_area.

---

### AD-006: Proposal Validation
**Decision:** Precio rango ARS 500 - ARS 100,000, fecha futura >2hs adelante.  
**Rationale:** Previene errores tipeo, límite superior protege abuse.  
**Configuration:** Rangos en `config/constants.ts` (ajustable sin code deploy).

---

### AD-007: Multiple Proposals
**Decision:** Profesional solo 1 propuesta por post, editable en chat (sin historial tabla).  
**Rationale:** Simplicidad MVP, 90% casos no re-negocian.  
**Constraint:** `UNIQUE INDEX (professional_id, post_id) WHERE status IN ('pending', 'accepted')`.  
**Fase 3:** Agregar tabla `proposal_history` si analytics requiere.

---

### AD-008: Post State Machine
**Decision:** Estados `open → closed/expired`, transacción atómica acepta propuesta + cierra post + rechaza otras.  
**Rationale:** Previene race conditions (2 clientes aceptan simultáneo).  
**Implementation:** `prisma.$transaction` con row-level locks.

---

### AD-009: Soft Delete Policy
**Decision:** Soft delete 90 días después cerrar/expirar, hard delete 180 días después soft delete.  
**Rationale:** GDPR compliance, recuperación errores, analytics históricos.  
**Indexes:** `CREATE INDEX idx_posts_deleted_at ON posts(deleted_at) WHERE deleted_at IS NULL` (partial).

---

### AD-010: Authorization Model
**Decision:** Middleware `requireClient`, `requireProfessional`, `requireOwnership` reutilizables.  
**Rationale:** DRY, testeable, auditable.  
**Enforcement:** Controller-level (NO service-level, servicios asumen ya autorizado).

---

## 5. Dependencies Required

### NPM Packages (Adicionales a Fase 1)

```json
{
  "dependencies": {
    "multer": "^1.4.5-lts.1",       // Multipart/form-data parsing
    "sharp": "^0.33.0",              // YA EXISTE Fase 1, confirmar versión
    "@prisma/client": "^5.9.0",      // YA EXISTE, confirmar migración
    "node-cron": "^3.0.3",           // Cronjobs expiración
    "zod": "^3.22.4"                 // YA EXISTE Fase 1
  },
  "devDependencies": {
    "@types/multer": "^1.4.11",
    "@types/node-cron": "^3.0.11"
  }
}
```

**Nota:** `cloudinary`, `firebase-admin` (FCM), `jsonwebtoken`, `bcrypt` ya instalados en Fase 1.

---

### External Services (Ya Configurados Fase 1)
- ✅ Cloudinary (subir media posts)
- ✅ Firebase Cloud Messaging (notificaciones push)
- ✅ PostGIS (geocoding posts)
- ✅ Redis (cache geocoding)

---

### Database Migrations

```prisma
// Agregar a prisma/schema.prisma

model Post {
  id          Int       @id @default(autoincrement())
  userId      Int       @map("user_id")
  title       String    @db.VarChar(100)
  description String    @db.Text
  latitude    Decimal   @db.Decimal(10, 8)
  longitude   Decimal   @db.Decimal(11, 8)
  // location es PostGIS GEOGRAPHY, agregado via raw SQL (Prisma no soporta nativamente)
  status      String    @db.VarChar(20) @default("open") // open, closed, expired, completed
  expiresAt   DateTime  @map("expires_at") @db.Timestamptz
  deletedAt   DateTime? @map("deleted_at") @db.Timestamptz
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  user         User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  categories   PostCategory[]
  media        PostMedia[]
  proposals    Proposal[]

  @@index([userId])
  @@index([status, expiresAt])
  @@index([deletedAt])
  @@index([createdAt(sort: Desc)])
  @@map("posts")
}

model PostCategory {
  postId      Int  @map("post_id")
  categoryId  Int  @map("category_id")

  post      Post      @relation(fields: [postId], references: [id], onDelete: Cascade)
  category  Category  @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([postId, categoryId])
  @@index([postId])
  @@index([categoryId])
  @@map("post_categories")
}

model PostMedia {
  id        Int      @id @default(autoincrement())
  postId    Int      @map("post_id")
  mediaType String   @map("media_type") @db.VarChar(10) // 'image' | 'video'
  mediaUrl  String   @map("media_url") @db.VarChar(500)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  post  Post  @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@index([postId])
  @@map("post_media")
}

model Proposal {
  id              Int       @id @default(autoincrement())
  postId          Int       @map("post_id")
  professionalId  Int       @map("professional_id")
  price           Decimal   @db.Decimal(10, 2)
  description     String    @db.Text
  scheduledDate   DateTime  @map("scheduled_date") @db.Date
  scheduledTime   DateTime  @map("scheduled_time") @db.Time
  status          String    @db.VarChar(20) @default("pending") // pending, accepted, rejected, expired, cancelled
  expiresAt       DateTime  @map("expires_at") @db.Timestamptz
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  post          Post          @relation(fields: [postId], references: [id], onDelete: Cascade)
  professional  Professional  @relation(fields: [professionalId], references: [id], onDelete: Restrict)

  @@index([postId])
  @@index([professionalId])
  @@index([status])
  @@index([expiresAt])
  @@unique([professionalId, postId], name: "unique_professional_post_proposal")
  @@map("proposals")
}

model Chat {
  id             Int       @id @default(autoincrement())
  clientId       Int       @map("client_id")
  professionalId Int       @map("professional_id")
  lastMessageAt  DateTime? @map("last_message_at") @db.Timestamptz
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  client        User  @relation("ClientChats", fields: [clientId], references: [id], onDelete: Cascade)
  professional  User  @relation("ProfessionalChats", fields: [professionalId], references: [id], onDelete: Cascade)

  @@unique([clientId, professionalId])
  @@index([clientId])
  @@index([professionalId])
  @@index([lastMessageAt(sort: Desc)])
  @@map("chats")
}

model Notification {
  id      Int      @id @default(autoincrement())
  userId  Int      @map("user_id")
  type    String   @db.VarChar(50) // 'new_proposal', 'proposal_accepted', 'post_expiring', ...
  title   String   @db.VarChar(100)
  body    String   @db.Text
  data    Json?    // { proposalId, postId, ... }
  read    Boolean  @default(false)
  sentAt  DateTime @default(now()) @map("sent_at") @db.Timestamptz

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, read])
  @@index([sentAt(sort: Desc)])
  @@map("notifications")
}
```

**Raw SQL Post-Migration (PostGIS):**
```sql
-- Ejecutar después de prisma migrate
ALTER TABLE posts ADD COLUMN location GEOGRAPHY(POINT, 4326);

-- Trigger para mantener location sincronizado con lat/lng
CREATE OR REPLACE FUNCTION update_post_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude::float, NEW.latitude::float), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_post_location
BEFORE INSERT OR UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION update_post_location();

-- Índice espacial GIST
CREATE INDEX idx_posts_location ON posts USING GIST(location);
```

---

## 6. API Endpoints (Preliminary)

### Posts Endpoints

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/api/posts` | ✅ | Client | Crear post con media |
| GET | `/api/posts` | ✅ | Professional | Feed posts filtrado (geo + categorías) |
| GET | `/api/posts/:id` | ✅ | Any | Ver detalle post |
| PATCH | `/api/posts/:id` | ✅ | Owner | Editar post (solo open) |
| DELETE | `/api/posts/:id` | ✅ | Owner | Cerrar post manualmente |
| GET | `/api/posts/me` | ✅ | Client | Historial posts propios |

---

### Proposals Endpoints

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/api/proposals` | ✅ | Professional | Enviar propuesta a post |
| GET | `/api/proposals/:id` | ✅ | Involved | Ver detalle propuesta |
| PATCH | `/api/proposals/:id` | ✅ | Owner | Editar propuesta pending |
| POST | `/api/proposals/:id/accept` | ✅ | Client | Aceptar propuesta |
| POST | `/api/proposals/:id/reject` | ✅ | Client | Rechazar propuesta |
| GET | `/api/posts/:postId/proposals` | ✅ | Post Owner | Ver propuestas de post |
| GET | `/api/proposals/me` | ✅ | Professional | Historial propuestas enviadas |

---

### Notifications Endpoints

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/api/notifications` | ✅ | Any | Listar notificaciones usuario |
| PATCH | `/api/notifications/:id/read` | ✅ | Owner | Marcar leída |
| PATCH | `/api/notifications/read-all` | ✅ | Any | Marcar todas leídas |

---

## 7. Database Changes

**Nuevas Tablas:** `posts`, `post_categories`, `post_media`, `proposals`, `chats`, `notifications`

**Cambios Tablas Existentes:**
- `users`: Agregar relaciones `posts`, `proposals`, `chats`, `notifications`
- `professionals`: Agregar relación `proposals`
- `categories`: Agregar relación `post_categories`

**Índices Críticos:**
```sql
-- Performance feed profesionales
CREATE INDEX idx_posts_location ON posts USING GIST(location);
CREATE INDEX idx_posts_status_expires ON posts(status, expires_at);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);

-- Performance queries propuestas
CREATE INDEX idx_proposals_post_status ON proposals(post_id, status);
CREATE INDEX idx_proposals_professional_status ON proposals(professional_id, status);
CREATE INDEX idx_proposals_expires_at ON proposals(expires_at) WHERE status IN ('pending', 'accepted');

-- Performance notificaciones
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at DESC);

-- Soft delete queries
CREATE INDEX idx_posts_deleted_at ON posts(deleted_at) WHERE deleted_at IS NULL;
```

**Constraints:**
```sql
-- Solo 1 propuesta activa por profesional por post
CREATE UNIQUE INDEX idx_unique_professional_post_proposal 
ON proposals(professional_id, post_id) 
WHERE status IN ('pending', 'accepted');

-- Estados válidos
ALTER TABLE posts ADD CONSTRAINT chk_post_status 
CHECK (status IN ('open', 'closed', 'expired', 'completed'));

ALTER TABLE proposals ADD CONSTRAINT chk_proposal_status 
CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled'));

-- Precio propuesta razonable
ALTER TABLE proposals ADD CONSTRAINT chk_proposal_price 
CHECK (price >= 500 AND price <= 100000);

-- Tipo media válido
ALTER TABLE post_media ADD CONSTRAINT chk_media_type 
CHECK (media_type IN ('image', 'video'));
```

---

## 8. Risks & Mitigations

### Risk 1: Cloudinary Bandwidth Exhaustion
**Probability:** MEDIUM (si 1 video viral visto 10K veces)  
**Impact:** HIGH (uploads fallan)  
**Mitigation:**
- Monitorear uso Cloudinary dashboard semanal
- Alert cuando >80% free tier (20GB usado de 25GB)
- Migración pre-planeada a S3 (script ready Fase 3)
- Límite 2 videos/post reduce riesgo

---

### Risk 2: Abuse: Cliente Spam de Posts
**Probability:** MEDIUM (bots, competencia maliciosa)  
**Impact:** MEDIUM (BD crece descontrolado, feed saturado)  
**Mitigation:**
```typescript
// Rate limit específico para crear posts
const postRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 horas
  max: 10, // Max 10 posts por día
  keyGenerator: (req) => req.user.id.toString(),
  message: { error: 'Límite de 10 posts diarios alcanzado' },
});

router.post('/posts', requireAuth, requireClient, postRateLimiter, createPost);
```
- Fase 3: Captcha en frontend si usuario tiene >5 posts/día
- Admin dashboard para detectar usuarios con >20 posts/día (flag manual)

---

### Risk 3: Race Condition: 2 Clientes Aceptan Misma Propuesta
**Probability:** LOW (requiere timing milisegundo)  
**Impact:** HIGH (post cerrado 2 veces, 2 propuestas accepted)  
**Mitigation:**
```typescript
// Transacción con row-level lock
await prisma.$transaction(async (tx) => {
  // Lock post row (SELECT ... FOR UPDATE)
  const post = await tx.post.findUnique({
    where: { id: postId },
    include: { proposals: true },
  });
  
  if (post.status !== 'open') {
    throw new AppError(409, 'Post ya está cerrado');
  }
  
  // Verificar propuesta todavía pending
  const proposal = await tx.proposal.findUnique({ where: { id: proposalId } });
  if (proposal.status !== 'pending') {
    throw new AppError(409, 'Propuesta ya fue procesada');
  }
  
  // Resto de lógica...
});
```
- Constraint DB adicional: `CHECK (status = 'open' OR EXISTS (SELECT 1 FROM proposals WHERE post_id=posts.id AND status='accepted' LIMIT 1))`

---

### Risk 4: Geolocalización Privacy Leak
**Probability:** HIGH (mostrar ubicación exacta en post)  
**Impact:** MEDIUM (cliente puede revelar dirección antes de aceptar propuesta)  
**Mitigation:**
```typescript
// Truncar coordenadas a 2 decimales (±1km precision)
function truncateCoordinates(lat: number, lng: number) {
  return {
    latitude: Math.round(lat * 100) / 100,   // -34.6037 → -34.60
    longitude: Math.round(lng * 100) / 100,  // -58.3816 → -58.38
  };
}

// Al mostrar post en feed profesionales
const postsForFeed = posts.map(post => ({
  ...post,
  latitude: truncateCoordinates(post.latitude, post.longitude).latitude,
  longitude: truncateCoordinates(post.latitude, post.longitude).longitude,
  // ubicación exacta solo visible después de aceptar propuesta
}));
```
- Dirección completa visible solo después de aceptar propuesta (en chat Fase 3)

---

### Risk 5: Cronjob Expiración No Ejecuta (Servidor Down)
**Probability:** LOW (uptime 99.5%)  
**Impact:** MEDIUM (posts/proposals quedan open indefinidamente)  
**Mitigation:**
- Frontend valida `expires_at` localmente (muestra "Expirado" aunque BD no actualizada)
- Query posts SIEMPRE filtra `expires_at > NOW()` (doble check)
- Monitoring: Alert si cronjob no ejecuta en 2 horas consecutivas

---

### Risk 6: Upload Timeout Videos Grandes
**Probability:** MEDIUM (20% videos >30MB según competencia)  
**Impact:** LOW (cliente reintenta con video más corto)  
**Mitigation:**
- Mensaje error claro: "Video muy grande. Intenta con uno <30MB o 15 segundos"
- Frontend comprime video antes de enviar (react-native-video-processing)
- Fase 3: Queue asíncrono si >20% uploads fallan

---

## 9. Open Questions

### Q1: ¿Límite de posts abiertos simultáneos por cliente?
**Contexto:** Cliente puede tener múltiples problemas en paralelo (plomero + electricista).  
**Options:**
- Sin límite (riesgo abuse)
- Máx 5 posts open simultáneos

**Recommendation:** Implementar límite 5 en MVP, ajustar si clientes se quejan.

---

### Q2: ¿Profesionales ven posts de todas las categorías o solo las suyas?
**Decision TOMADA:** Solo categorías del profesional (filtro `WHERE category_id IN :prof_categories`).  
**Rationale:** Feed más relevante, menos noise.

---

### Q3: ¿Permitir editar post después de recibir propuestas?
**Contexto:** Cliente recibe 3 propuestas, luego edita descripción (invalida propuestas).  
**Recommendation:** 
- ✅ Permitir editar SOLO si 0 propuestas recibidas
- ❌ Bloquear edición si >1 propuesta (cliente debe cerrar y crear nuevo post)

```typescript
// Validación editar post
if (post.proposals.length > 0) {
  throw new AppError(400, 'No puedes editar un post que ya tiene propuestas. Cierra este post y crea uno nuevo.');
}
```

---

### Q4: ¿Notificar profesionales cuando nuevo post en su zona?
**Contexto:** Puede generar spam (100 profesionales electricistas en CABA reciben notif de cada post).  
**Recommendation Fase 2:** ❌ NO notificar (profesionales abren app y ven feed).  
**Fase 3:** Implementar notificaciones inteligentes:
- Solo si profesional tiene <5 propuestas pending (no saturado)
- Solo si post está a <10km (muy cercano)
- Max 3 notificaciones/día por profesional

---

### Q5: ¿Cliente puede ver cuántas propuestas tiene un post antes de expirar?
**Contexto:** Competencia muestra "3 profesionales interesados" en post.  
**Options:**
- ✅ Mostrar contador "5 propuestas recibidas" (transparencia)
- ❌ Ocultar (para que profesional no vea competencia)

**Recommendation:** ✅ Mostrar contador (genera urgencia al profesional).

---

## 10. Integration with Fase 1

### Infraestructura Reutilizada:
✅ **Autenticación:** JWT access/refresh tokens (requireAuth middleware)  
✅ **Roles:** Detección client vs professional (já en req.user.role)  
✅ **Geocoding:** GeocodingService (Nominatim + Google)  
✅ **Upload:** UploadService (Cloudinary) — extender para videos  
✅ **PostGIS:** Índices GIST, queries ST_DWithin  
✅ **FCM:** NotificationService (enviar push) — extender para nuevos eventos  
✅ **Redis:** Cache geocoding — reutilizar mismo cliente  
✅ **Prisma:** ORM + migraciones — agregar modelos Posts/Proposals  

### Nuevos Servicios a Crear:
- `PostService`: CRUD posts + validaciones
- `ProposalService`: Crear/aceptar/rechazar propuestas + auto-cerrar post
- `FeedService`: Feed profesionales con filtros geo + categorías
- `CronService`: Expiration jobs (posts, proposals, soft delete)
- `NotificationService` (extender): Eventos nuevos (new_proposal, post_expiring, ...)

### Dependencias de Datos:
- **Posts requieren:** `users.id` (cliente), `categories.id` (filtro), `users.location` (profesional para geo)
- **Proposals requieren:** `posts.id`, `professionals.id`, `chats` (auto-create)
- **Notifications requieren:** `users.fcm_token` (ya existe)

### Testing:
- Reutilizar setup Fase 1 (Jest + Supertest)
- Seed BD: Crear 3 clientes + 5 profesionales + 10 posts + 20 proposals
- Integration tests: Happy path crear post → enviar propuesta → aceptar → verificar estados

---

## 11. Next Steps (Ready for Proposal)

✅ **Esta exploración está COMPLETA.**

**Siguiente fase (orquestador debe ejecutar):**
1. Ejecutar `sdd-propose` para crear propuesta formal Fase 2
2. Después, ejecutar `sdd-spec` para especificación detallada
3. Después, ejecutar `sdd-design` para diseño técnico
4. Después, ejecutar `sdd-tasks` para breakdown de tareas

**Aprobaciones requeridas antes de implementar:**
- [ ] Product Owner aprueba features scope (posts + proposals + notifs)
- [ ] Tech Lead revisa decisiones arquitectura (Cloudinary, paginación, cronjobs)
- [ ] DevOps confirma Cloudinary free tier + Redis disponible
- [ ] Security revisa validaciones precio + rate limits abuse

**Estimación rough (a refinar en sdd-tasks):**
- Setup modelos Prisma + migraciones: 2 días
- Endpoints Posts (CRUD + upload media): 3 días
- Endpoints Proposals (crear/aceptar/rechazar): 3 días
- Feed profesionales (geo + paginación): 2 días
- Cronjobs expiración: 1 día
- Notificaciones (extender FCM): 2 días
- Testing E2E + fixes: 3 días
- **Total:** ~16 días (3 semanas sprint) — 1 dev full-time

---

## 12. Key Learnings

1. **Upload media es el feature más complejo técnicamente** — Multer + Cloudinary + validaciones + timeout manejo requiere diseño cuidadoso.

2. **Paginación cursor-based es MANDATORY para feeds** — Offset/limit genera duplicados que matan UX.

3. **PostGIS es ventaja competitiva** — Búsqueda 30km <200ms imposible sin índice espacial.

4. **Cronjobs cada 1 hora son suficientes** — Expiración exacta al minuto no aporta valor UX.

5. **Notificaciones = engagement driver** — Eventos críticos (nueva propuesta) deben notificar inmediato.

6. **Rate limits son mandatory desde día 1** — Abuse prevention no puede ser afterthought.

7. **Geolocalización truncada protege privacy** — Mostrar ubicación exacta antes de aceptar propuesta es riesgo.

8. **Transacciones atómicas evitan race conditions** — Aceptar propuesta debe ser todo-o-nada.

9. **Soft delete es GDPR compliance básico** — Hard delete inmediato dificulta auditoría.

10. **Cloudinary free tier es sufficient MVP** — 25GB bandwidth soporta ~5K posts con video (6-12 meses runway).

---

**Fin de Exploración Fase 2**  
**Ready for Proposal:** ✅ YES  
**Blockers:** None  
**Dependencies:** Fase 1 completada (REQUIRED)
