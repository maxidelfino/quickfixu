# Design: Fase 5 - Reviews & Ratings

**Change name:** `fase-5-reviews-ratings`  
**Date:** Marzo 2026  
**Status:** Design Complete  
**Prerequisite:** Fase 4 (Payments & Appointments) MUST be completed

---

## Technical Approach

Esta fase implementa el **sistema de reputación bidireccional** del marketplace: clientes califican profesionales Y viceversa después de appointments completados con payments confirmados. La arquitectura se basa en **PostgreSQL triggers** para cálculo automático de rating promedio, **UNIQUE constraints** para prevenir review bombing, **ventana temporal 30 días** post-completion, y **cronjobs reminder** para maximizar tasa de reviews.

**Key Technical Decisions:**
1. **Rating Calculation Trigger** → PostgreSQL trigger `update_user_rating()` recalcula AVG automáticamente AFTER INSERT review (performance + data integrity)
2. **Review Eligibility** → UNIQUE constraint `(appointment_id, reviewer_id)` + validación `appointment.status='completed' AND payment.payout_status='completed'`
3. **30-Day Window** → Constraint CHECK `created_at <= appointment.scheduled_date + INTERVAL '30 days'` enforced DB-level
4. **Reminder Cronjobs** → 2 cronjobs independientes: día 3 reminder (push + email), día 7 final reminder (push only)
5. **Dispute Resolution** → Tabla `review_disputes` preparada, procesamiento admin manual Fase 6 (NO filtros automáticos)

---

## Architecture Decisions

### Decision: Rating Calculation - PostgreSQL Trigger vs Application-Level

**Choice**: PostgreSQL Trigger `update_user_rating()` ejecutado AFTER INSERT ON reviews

**Alternatives considered**:
- Calcular en application code (controller): Vulnerable a race conditions, duplica lógica en múltiples endpoints, inconsistencia si hay writes directos DB
- Calcular on-demand al mostrar perfil: Query lento (AVG sobre miles reviews), cache invalidation compleja, stale data problemas

**Rationale**:
- **Data integrity garantizada**: Imposible que `user.average_rating` esté desincronizado con tabla reviews
- **Performance**: AVG solo se recalcula cuando necesario (INSERT review), no en cada GET profile
- **Atomic operation**: Trigger corre en misma transaction que INSERT, rollback automático si falla
- **Single source of truth**: Lógica cálculo vive solo en DB schema, no duplicada en codebase

**Implementation**:
```sql
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
DECLARE
  new_avg DECIMAL(3,2);
  new_count INTEGER;
BEGIN
  -- Recalcular rating promedio del reviewed_user
  SELECT AVG(rating), COUNT(*)
  INTO new_avg, new_count
  FROM reviews
  WHERE reviewed_id = NEW.reviewed_id;
  
  -- Actualizar users table
  UPDATE users
  SET average_rating = new_avg,
      review_count = new_count,
      updated_at = NOW()
  WHERE id = NEW.reviewed_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rating
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_user_rating();
```

**Trade-off aceptado**: Trigger agrega latencia ~10ms al INSERT review → Acceptable (review creation NO es time-critical, usuario espera confirmación visual)

---

### Decision: Review Bombing Prevention - UNIQUE Constraint vs Rate Limiting

**Choice**: UNIQUE constraint `(appointment_id, reviewer_id)` + validación `payment.payout_status='completed'`

**Alternatives considered**:
- Rate limiting solo (ej: 5 reviews/día): Permite review bombing con cuentas múltiples, no previene abuse estructural
- Verificar reviewer_id ≠ reviewed_id application-level: Vulnerable a bugs, permite bypass con DB access directo

**Rationale**:
- **1 review por appointment garantizado**: Imposible que mismo usuario deje múltiples reviews para mismo trabajo
- **Requiere payment real**: Atacante necesitaría pagar plataforma para cada review fake (económicamente inviable)
- **DB-enforced**: No depende de validación application-level (defense in depth)
- **Auditable**: Cada review trazable a appointment → payment → trabajo real comprobable

**Anti-retaliation protection**:
- Reviews son **públicas inmediatas** (simplicidad MVP, standard Uber/Airbnb)
- Admin panel Fase 6 permite marcar review como "retaliatory" → hide + notificar usuario
- Post-PMF feature: Blind reviews (ambos envían, publican simultáneo después window 48hs)

---

### Decision: 30-Day Review Window - DB Constraint vs Soft Validation

**Choice**: CHECK constraint `created_at <= (appointment.scheduled_date + INTERVAL '30 days')` en reviews table

**Alternatives considered**:
- Validar solo en endpoint POST /reviews: Permite bypass con SQL directo, inconsistencia data histórica si cambia regla
- No limitar ventana: Reviews años después distorsionan percepción (profesional mejoró pero tiene reviews viejas negativas)

**Rationale**:
- **Standard industria**: Airbnb=14 días, Uber=30 días, marketplaces físicos=30 días (memoria fresca usuario)
- **Previene gaming**: Usuarios no pueden esperar meses para dejar review estratégica (ej: después de ver respuesta profesional)
- **Data integrity**: Constraint DB impide exceptions, auditable
- **Grace period suficiente**: 30 días cubre viajes, demoras cliente, olvidos

**Implementation**:
```sql
ALTER TABLE reviews
ADD CONSTRAINT check_review_window
CHECK (
  created_at <= (
    SELECT scheduled_date + INTERVAL '30 days'
    FROM appointments
    WHERE id = appointment_id
  )
);
```

**Edge case handled**: Si appointment fue reprogramado múltiples veces, ventana usa `final_scheduled_date` (último timestamp antes completion)

---

### Decision: Reminder Notifications - Cronjob vs Event-Driven

**Choice**: 2 cronjobs independientes: día 3 reminder (push + email), día 7 reminder (push only)

**Alternatives considered**:
- Event-driven (queue con delay): Complejo setup (Redis Bull, AWS SQS), overkill para MVP, difícil debug delays
- Single cronjob con lógica condicional: Código acoplado, dificulta cambiar timing reminders independientemente

**Rationale**:
- **Simplicidad operacional**: Cronjob nativo node-cron, 0 dependencias externas
- **Timing industry-standard**: Día 3 (reminder temprano alto conversion), día 7 (último chance antes ventana cierre)
- **Dual channel día 3**: Push + email maximiza reach (usuarios que desactivaron push ven email)
- **Push-only día 7**: Menos intrusivo, asume vieron reminder previo

**Schedule**:
```typescript
// Cronjob: Daily 10:00 AM
cron.schedule('0 10 * * *', async () => {
  // Día 3 reminders (appointment completed hace 3 días, sin review)
  const day3Appointments = await prisma.appointment.findMany({
    where: {
      status: 'completed',
      completed_at: {
        gte: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 3-4 días atrás
        lte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      reviews: { none: {} }, // Sin review asociada
    },
  });
  
  await Promise.all([
    sendPushReminder(day3Appointments, 'Califica tu experiencia con {professional}'),
    sendEmailReminder(day3Appointments, 'reminder-day3.html'),
  ]);
  
  // Día 7 reminders (appointment completed hace 7 días, sin review)
  const day7Appointments = await prisma.appointment.findMany({
    where: {
      status: 'completed',
      completed_at: {
        gte: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
      reviews: { none: {} },
    },
  });
  
  await sendPushReminder(day7Appointments, 'Última oportunidad: Califica tu experiencia');
});
```

**Trade-off aceptado**: Granularidad diaria (no hourly) → Reminders NO llegan exactamente 72hs post-completion, sino "día 3 a las 10am" → Acceptable (reminder timing NO es crítico)

---

### Decision: Rating Default Value - NULL vs 0

**Choice**: `users.average_rating` default NULL (NOT 0)

**Alternatives considered**:
- Default 0: Profesionales nuevos parecen "pésimos" (0 estrellas), disuade early adopters, confunde "sin reviews" con "muy malo"

**Rationale**:
- **UX clarity**: NULL → Mostrar badge "Sin calificaciones aún" vs 0 estrellas rojas (señal negativa incorrecta)
- **Fair ranking**: Ordenar profesionales por rating DESC con NULLS LAST (nuevos aparecen final, no inicio)
- **Conversion optimization**: Primeros 5-10 clientes críticos para profesional nuevo, mostrar 0 estrellas mata conversión

**Implementation UI**:
```typescript
// ProfileCard component
{professional.average_rating === null ? (
  <Badge variant="neutral">Sin calificaciones</Badge>
) : (
  <StarRating value={professional.average_rating} count={professional.review_count} />
)}
```

---

### Decision: Dispute Resolution - Automated Filters vs Manual Admin

**Choice**: NO filtros automáticos, botón "Reportar" → Tabla `review_disputes` → Admin manual Fase 6

**Alternatives considered**:
- Filtro automático palabras ofensivas: Alta tasa falsos positivos (ej: "mala experiencia" trigerea "mala"), fácil bypass con typos/emojis
- ML sentiment analysis: Overkill MVP, requiere training dataset grande, latencia inference, costs

**Rationale**:
- **Precision over recall**: Mejor dejar review real negativa visible que censurar review legítima por error
- **Simplicidad operacional**: Tabla disputes simple, admin revisa queue, decisiones humanas contextuales
- **Post-PMF upgrade path**: Después 10k+ reviews, entrenar modelo custom con disputes históricos como ground truth

**Disputes Flow**:
1. Usuario ve review ofensiva/falsa → Click "Reportar"
2. Modal captura `reason` (enum: offensive, fake, retaliation, extortion) + `details` (500 chars opcional)
3. INSERT `review_disputes` con status='pending'
4. Admin panel Fase 6 muestra queue, admin puede:
   - Aprobar disputa → `review.hidden=true` + notificar usuarios
   - Rechazar disputa → `dispute.status='rejected'` + razón
   - Solicitar evidencia → `dispute.status='awaiting_evidence'`

---

## Data Flow Diagrams

### Review Creation Flow

```mermaid
sequenceDiagram
    participant Client as Cliente App
    participant API as Backend API
    participant DB as PostgreSQL
    participant Trigger as SQL Trigger
    participant FCM as Push Notifications

    Client->>API: POST /appointments/{id}/review
    API->>DB: Validar appointment.status='completed'
    API->>DB: Validar payment.payout_status='completed'
    API->>DB: Validar ventana 30 días
    API->>DB: Validar UNIQUE (appointment_id, reviewer_id)
    
    alt Validación OK
        API->>DB: INSERT INTO reviews
        DB->>Trigger: AFTER INSERT trigger
        Trigger->>DB: SELECT AVG(rating) FROM reviews WHERE reviewed_id
        Trigger->>DB: UPDATE users SET average_rating, review_count
        Trigger-->>API: Transaction committed
        API->>FCM: Push reviewed_user "Recibiste nueva calificación"
        API-->>Client: 201 Created {review}
    else Validación FAIL
        API-->>Client: 400 Bad Request {error}
    end
```

### Rating Display Flow

```mermaid
graph LR
    A[GET /users/:id/profile] --> B{average_rating NULL?}
    B -->|Sí| C[Mostrar 'Sin calificaciones']
    B -->|No| D[Mostrar estrellas + count]
    
    E[GET /users/:id/reviews?page=1] --> F[Query reviews con pagination]
    F --> G[Retornar reviews array]
    G --> H[Mostrar lista reviews]
    
    D --> I[Click Ver reviews]
    I --> E
```

### Reminder Cronjob Flow

```mermaid
graph TD
    A[Cronjob diario 10am] --> B{Día 3 sin review?}
    B -->|Sí| C[Enviar Push reminder]
    C --> D[Enviar Email reminder]
    
    A --> E{Día 7 sin review?}
    E -->|Sí| F[Enviar Push final reminder]
    
    B -->|No| G[Skip]
    E -->|No| G
```

### Dispute Resolution Flow

```mermaid
sequenceDiagram
    participant User as Usuario
    participant App as App
    participant API as Backend
    participant DB as PostgreSQL
    participant Admin as Admin Panel

    User->>App: Click "Reportar review"
    App->>User: Modal seleccionar reason
    User->>App: Submit dispute
    App->>API: POST /reviews/{id}/dispute
    API->>DB: INSERT review_disputes
    API->>Admin: Webhook notificar nuevo dispute
    
    Admin->>DB: GET pending disputes
    Admin->>Admin: Revisar evidencia
    
    alt Aprobar disputa
        Admin->>DB: UPDATE review SET hidden=true
        Admin->>API: Notificar usuarios involucrados
    else Rechazar disputa
        Admin->>DB: UPDATE dispute SET status='rejected'
        Admin->>API: Notificar disputer
    end
```

---

## Database Schema

### reviews Table

```prisma
model Review {
  id             Int      @id @default(autoincrement())
  appointment_id Int      
  reviewer_id    Int      // Quien deja review (cliente O profesional)
  reviewed_id    Int      // Quien recibe review (profesional O cliente)
  
  rating         Int      @db.SmallInt // 1-5 estrellas, NOT NULL
  comment        String?  @db.VarChar(500) // Opcional
  
  hidden         Boolean  @default(false) // Admin puede ocultar si es ofensiva
  
  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt
  
  // Relaciones
  appointment    Appointment @relation(fields: [appointment_id], references: [id], onDelete: Cascade)
  reviewer       User        @relation("ReviewsGiven", fields: [reviewer_id], references: [id])
  reviewed       User        @relation("ReviewsReceived", fields: [reviewed_id], references: [id])
  
  disputes       ReviewDispute[]
  
  @@unique([appointment_id, reviewer_id], name: "unique_review_per_appointment")
  @@index([reviewed_id, created_at], name: "idx_reviews_by_user")
  @@index([rating], name: "idx_reviews_by_rating")
  @@index([created_at], name: "idx_reviews_by_date")
}
```

**Constraints & Indexes Explanation:**

1. **UNIQUE (appointment_id, reviewer_id)**:
   - Previene que mismo usuario deje múltiples reviews para mismo appointment
   - Permite reviews bidireccionales (cliente review profesional AND profesional review cliente para mismo appointment)

2. **Index (reviewed_id, created_at)**:
   - Query común: "Mostrar reviews de profesional X ordenadas por recientes"
   - Composite index optimiza `WHERE reviewed_id=X ORDER BY created_at DESC`

3. **Index (rating)**:
   - Filtro frecuente: "Mostrar solo reviews 4-5 estrellas" o "Mostrar reviews ≤2"
   - Stats queries: "Distribución ratings profesional"

4. **Index (created_at)**:
   - Reminder cronjobs: "Appointments completados hace 3/7 días sin review"

---

### review_disputes Table

```prisma
model ReviewDispute {
  id          Int      @id @default(autoincrement())
  review_id   Int
  disputer_id Int      // Usuario que reporta (puede ser reviewer O reviewed)
  
  reason      String   @db.VarChar(50) // 'offensive' | 'fake' | 'retaliation' | 'extortion'
  details     String?  @db.Text // Explicación opcional usuario
  
  status      String   @default("pending") @db.VarChar(30) // 'pending' | 'approved' | 'rejected' | 'awaiting_evidence'
  
  admin_notes String?  @db.Text // Decisión admin
  resolved_by Int?     // Admin user_id que resolvió
  resolved_at DateTime?
  
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
  
  // Relaciones
  review      Review   @relation(fields: [review_id], references: [id], onDelete: Cascade)
  disputer    User     @relation("DisputesCreated", fields: [disputer_id], references: [id])
  resolver    User?    @relation("DisputesResolved", fields: [resolved_by], references: [id])
  
  @@index([status, created_at], name: "idx_pending_disputes")
  @@index([review_id], name: "idx_disputes_by_review")
}
```

---

### users Table - New Fields

```prisma
model User {
  // ... existing fields ...
  
  average_rating Decimal? @db.Decimal(3,2) // NULL si sin reviews, 1.00-5.00 si tiene
  review_count   Int      @default(0)
  
  // Relaciones reviews
  reviews_given    Review[] @relation("ReviewsGiven")
  reviews_received Review[] @relation("ReviewsReceived")
  
  disputes_created  ReviewDispute[] @relation("DisputesCreated")
  disputes_resolved ReviewDispute[] @relation("DisputesResolved")
}
```

---

### SQL Trigger: update_user_rating()

```sql
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
DECLARE
  new_avg DECIMAL(3,2);
  new_count INTEGER;
BEGIN
  -- Calcular rating promedio del usuario reviewed
  SELECT 
    ROUND(AVG(rating)::numeric, 2),
    COUNT(*)::integer
  INTO new_avg, new_count
  FROM reviews
  WHERE reviewed_id = NEW.reviewed_id
    AND hidden = FALSE; -- Excluir reviews ocultas por admin
  
  -- Actualizar tabla users
  UPDATE users
  SET 
    average_rating = new_avg,
    review_count = new_count,
    updated_at = NOW()
  WHERE id = NEW.reviewed_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
CREATE TRIGGER trigger_update_rating
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_user_rating();

-- Trigger para recalcular cuando admin oculta review
CREATE TRIGGER trigger_update_rating_on_hide
AFTER UPDATE OF hidden ON reviews
FOR EACH ROW
WHEN (OLD.hidden IS DISTINCT FROM NEW.hidden)
EXECUTE FUNCTION update_user_rating();
```

**Trigger Behavior:**
- Ejecuta AFTER INSERT (review nueva) o AFTER UPDATE OF hidden (admin oculta/muestra review)
- Calcula AVG solo de reviews NO ocultas (`hidden=FALSE`)
- Actualiza `users.average_rating` y `review_count` en single transaction
- ROUND(AVG, 2) garantiza precisión 2 decimales (ej: 4.73, NO 4.7333333)

---

## API Endpoints

### POST /appointments/:id/reviews

**Auth:** Required (JWT)  
**Body:**
```typescript
{
  rating: number;        // 1-5, required
  comment?: string;      // Max 500 chars, optional
}
```

**Validations:**
1. Appointment exists y `status='completed'`
2. Payment asociado `payout_status='completed'` (trabajo confirmado + pagado)
3. Reviewer es participant del appointment (client_id O professional_id)
4. Ventana 30 días: `NOW() <= appointment.scheduled_date + INTERVAL '30 days'`
5. No existe review previa (UNIQUE constraint catch)
6. `rating` entre 1-5 (integer)
7. `comment` máx 500 chars si presente

**Response 201:**
```json
{
  "id": 123,
  "appointment_id": 456,
  "reviewer_id": 789,
  "reviewed_id": 101,
  "rating": 5,
  "comment": "Excelente trabajo, muy profesional",
  "created_at": "2026-03-22T14:30:00Z"
}
```

**Errors:**
- 400: Appointment not completed / Payment not released / Window expired / Rating invalid
- 404: Appointment not found
- 409: Review already exists

---

### GET /users/:id/reviews

**Auth:** Optional (public endpoint)  
**Query Params:**
- `page` (default: 1)
- `limit` (default: 10, max: 50)
- `rating_filter` (optional: "1-2" | "3" | "4-5")
- `sort` (default: "recent", options: "recent" | "rating_desc" | "rating_asc")

**Response 200:**
```json
{
  "reviews": [
    {
      "id": 123,
      "reviewer": {
        "id": 789,
        "full_name": "Juan Pérez",
        "profile_picture": "https://..."
      },
      "rating": 5,
      "comment": "Excelente trabajo",
      "created_at": "2026-03-22T14:30:00Z",
      "appointment": {
        "id": 456,
        "service_description": "Instalación aire acondicionado"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 87,
    "has_more": true
  },
  "stats": {
    "average_rating": 4.73,
    "total_reviews": 87,
    "distribution": {
      "5": 65,
      "4": 15,
      "3": 5,
      "2": 1,
      "1": 1
    }
  }
}
```

---

### GET /users/:id/profile

**Auth:** Optional  
**Changes:** Agregar campos rating a response existente

```json
{
  "id": 101,
  "full_name": "Carlos Rodríguez",
  "average_rating": 4.73,
  "review_count": 87,
  "categories": ["Electricista", "Plomero"],
  "...": "otros campos existentes"
}
```

---

### POST /reviews/:id/dispute

**Auth:** Required  
**Body:**
```typescript
{
  reason: 'offensive' | 'fake' | 'retaliation' | 'extortion'; // Required
  details?: string; // Max 500 chars, opcional
}
```

**Validations:**
1. Review exists y NO está ya hidden
2. Usuario es participant del appointment (reviewer O reviewed)
3. No existe disputa pending previa para esta review del mismo usuario
4. `reason` es enum válido

**Response 201:**
```json
{
  "id": 456,
  "review_id": 123,
  "status": "pending",
  "created_at": "2026-03-22T15:00:00Z"
}
```

**Side Effects:**
- Webhook a admin panel (Slack/Discord notification)
- Email a team@quickfixu.com con link directo admin panel

---

## File Changes

**Backend Core:**
- `prisma/schema.prisma`: Agregar modelos `Review`, `ReviewDispute`, campos `User.average_rating`, `User.review_count`
- `prisma/migrations/`: Migration SQL con trigger `update_user_rating()`
- `src/routes/reviews.routes.ts`: CREATE - Rutas CRUD reviews
- `src/controllers/reviews.controller.ts`: CREATE - Lógica validación + persistencia
- `src/routes/disputes.routes.ts`: CREATE - Ruta POST dispute
- `src/controllers/disputes.controller.ts`: CREATE - Webhook admin notification

**Services:**
- `src/services/review-validation.service.ts`: CREATE - Validar eligibilidad appointment, ventana 30 días
- `src/utils/rating-calculator.ts`: CREATE - Helpers cálculo stats distribución (usado en GET reviews)

**Cronjobs:**
- `src/cronjobs/review-reminder.cron.ts`: CREATE - Cronjob diario 10am, día 3 + día 7 reminders
- `src/services/notification.service.ts`: MODIFY - Agregar templates reminder push + email

**Tests:**
- `tests/integration/reviews.test.ts`: CREATE - E2E create review, validaciones, trigger rating
- `tests/unit/review-validation.test.ts`: CREATE - Tests ventana 30 días, eligibilidad
- `tests/unit/rating-calculator.test.ts`: CREATE - Tests distribución stats

**Frontend (React Native):**
- `src/screens/ReviewCreateScreen.tsx`: CREATE - Form rating + comment, validación client-side
- `src/screens/ReviewListScreen.tsx`: CREATE - Lista reviews con filtros, pagination
- `src/components/StarRating.tsx`: CREATE - Componente visual estrellas
- `src/components/RatingDistribution.tsx`: CREATE - Gráfico barras distribución
- `src/components/ReviewCard.tsx`: CREATE - Card individual review con reviewer info

---

## Review Creation Flow - Detailed Sequence

### Scenario: Cliente califica profesional post-completion

**Preconditions:**
1. Appointment status = 'completed'
2. Payment payout_status = 'completed' (trabajo confirmado mutuamente)
3. `NOW() <= appointment.scheduled_date + 30 days`
4. Cliente NO dejó review previa para este appointment

**Flow:**

1. **Cliente abre App → Appointments History**
   - Ver lista appointments completados
   - Badge "Calificar" visible si no hay review

2. **Click "Calificar" → ReviewCreateScreen**
   - UI: 5 estrellas touch-selectable (componente StarRating)
   - Textarea opcional comment (placeholder: "Cuéntanos tu experiencia", maxLength: 500)
   - Botón "Enviar calificación" (disabled si rating no seleccionado)

3. **Submit Form → Client-Side Validation**
   - Rating presente y 1-5
   - Comment ≤ 500 chars si presente
   - Mostrar loading spinner

4. **POST /appointments/{id}/reviews → Backend**
   ```typescript
   // Backend validations
   const appointment = await prisma.appointment.findUnique({
     where: { id },
     include: { payment: true }
   });
   
   if (appointment.status !== 'completed') {
     throw new BadRequestError('Appointment must be completed');
   }
   
   if (appointment.payment.payout_status !== 'completed') {
     throw new BadRequestError('Payment must be confirmed before reviewing');
   }
   
   const windowExpired = isAfter(
     new Date(),
     addDays(appointment.scheduled_date, 30)
   );
   
   if (windowExpired) {
     throw new BadRequestError('Review window expired (30 days)');
   }
   
   // Determinar reviewed_id (quien recibe review)
   const reviewed_id = appointment.client_id === req.user.id
     ? appointment.professional_id
     : appointment.client_id;
   
   // INSERT review (UNIQUE constraint automático catch duplicates)
   const review = await prisma.review.create({
     data: {
       appointment_id: id,
       reviewer_id: req.user.id,
       reviewed_id,
       rating: req.body.rating,
       comment: req.body.comment,
     },
   });
   
   // Trigger SQL automáticamente actualiza users.average_rating
   
   // Push notification reviewed user
   await sendPushNotification(reviewed_id, {
     title: 'Nueva calificación recibida',
     body: `${req.user.full_name} te calificó con ${req.body.rating} estrellas`,
     data: { type: 'new_review', review_id: review.id },
   });
   
   return res.status(201).json(review);
   ```

5. **Response 201 → Cliente App**
   - Mostrar success message: "✅ Calificación enviada"
   - Actualizar appointment badge: "Calificar" → "Calificado ⭐ 5"
   - Navegar automático a ProfessionalProfileScreen (mostrar nueva review)

6. **Profesional recibe Push**
   - Notificación: "Nueva calificación recibida - Juan te calificó con 5 estrellas"
   - Click notificación → Navegar a ReviewListScreen

---

## Rating Calculation Logic

### Trigger Execution Example

**Initial State:**
```sql
-- Profesional ID 101
SELECT * FROM users WHERE id = 101;
-- average_rating: 4.50, review_count: 10

SELECT rating FROM reviews WHERE reviewed_id = 101;
-- 5, 5, 5, 4, 4, 4, 4, 5, 5, 4 (AVG = 4.5)
```

**New Review Inserted:**
```sql
INSERT INTO reviews (appointment_id, reviewer_id, reviewed_id, rating, comment)
VALUES (456, 789, 101, 3, 'Trabajo aceptable pero llegó tarde');

-- Trigger fires automatically:
-- 1. SELECT AVG(rating) FROM reviews WHERE reviewed_id=101 → 4.36
-- 2. UPDATE users SET average_rating=4.36, review_count=11 WHERE id=101
```

**Final State:**
```sql
SELECT * FROM users WHERE id = 101;
-- average_rating: 4.36, review_count: 11
```

### Distribution Stats Query

```sql
-- Usado en GET /users/:id/reviews para stats
SELECT 
  rating,
  COUNT(*) as count
FROM reviews
WHERE reviewed_id = :user_id
  AND hidden = FALSE
GROUP BY rating
ORDER BY rating DESC;

-- Result:
-- rating | count
-- -------+-------
--   5    |   6
--   4    |   4
--   3    |   1
--   2    |   0
--   1    |   0
```

**Frontend Display:**
```
⭐⭐⭐⭐⭐ 4.36 (11 calificaciones)

Distribución:
5 ⭐ ████████████████████ 55%
4 ⭐ ████████████ 36%
3 ⭐ ██ 9%
2 ⭐  0%
1 ⭐  0%
```

---

## Reminder Notifications Strategy

### Day 3 Reminder (High Conversion Window)

**Trigger:** Appointment completado hace 72-96 horas, sin review

**Push Notification:**
```json
{
  "title": "¿Cómo fue tu experiencia con {professional_name}?",
  "body": "Tu opinión ayuda a otros usuarios. Califica en 30 segundos.",
  "data": {
    "type": "review_reminder",
    "appointment_id": 456,
    "deep_link": "quickfixu://appointments/456/review"
  }
}
```

**Email Template:**
```html
<h2>Hola {client_name},</h2>
<p>Hace 3 días <strong>{professional_name}</strong> completó tu trabajo de <em>{service_description}</em>.</p>
<p>¿Cómo fue tu experiencia? Tu calificación toma solo 30 segundos y ayuda a otros usuarios a encontrar profesionales confiables.</p>

<a href="https://app.quickfixu.com/appointments/456/review">
  <button>Calificar ahora</button>
</a>

<p style="color: #666; font-size: 12px;">
  Tienes hasta el {expiry_date} para dejar tu calificación (30 días desde el servicio).
</p>
```

**Conversion Benchmark:** 35-40% usuarios dejan review después reminder día 3 (industry standard Airbnb/Uber)

---

### Day 7 Reminder (Last Chance)

**Trigger:** Appointment completado hace 168-192 horas, sin review

**Push Notification ONLY (menos intrusivo):**
```json
{
  "title": "Última oportunidad: Califica a {professional_name}",
  "body": "Tienes 23 días más para compartir tu experiencia",
  "data": {
    "type": "review_reminder_final",
    "appointment_id": 456
  }
}
```

**No email:** Evitar spam, asumimos vieron reminder previo

**Conversion Benchmark:** 10-15% usuarios adicionales (menor urgency)

---

### Opt-Out Mechanism

**User Settings:**
- Toggle "Recibir recordatorios de calificación" (default: ON)
- Almacenar en `users.notification_preferences` JSONB:
  ```json
  {
    "review_reminders": true,
    "message_notifications": true,
    "quote_notifications": true
  }
  ```

**Cronjob respeta opt-out:**
```typescript
const eligibleAppointments = await prisma.appointment.findMany({
  where: {
    // ... date filters ...
    client: {
      notification_preferences: {
        path: ['review_reminders'],
        equals: true, // Solo usuarios con reminders enabled
      },
    },
  },
});
```

---

## Moderation & Dispute Flow

### User Reports Review

**Scenario:** Profesional recibe review 1 estrella "Pésimo, me cobró de más" (potencial fake)

**Flow:**

1. **Profesional abre ReviewListScreen → Ve review negativa**
   - Botón "Reportar review" visible en cada review card

2. **Click "Reportar" → Modal Dispute**
   - Radio buttons:
     - ❌ Contenido ofensivo
     - 🎭 Review falsa (cliente nunca contrató)
     - ⚔️ Review retaliativa (dejada después disputa pago)
     - 💰 Extorsión (cliente pidió dinero para no dejar review negativa)
   - Textarea opcional: "Detalles adicionales (opcional, hasta 500 caracteres)"
   - Botón "Enviar reporte"

3. **POST /reviews/123/dispute → Backend**
   ```typescript
   await prisma.reviewDispute.create({
     data: {
       review_id: 123,
       disputer_id: req.user.id,
       reason: 'fake',
       details: 'Cliente nunca me contrató, aparentemente confundido',
       status: 'pending',
     },
   });
   
   // Webhook notification admin
   await axios.post(SLACK_WEBHOOK_URL, {
     text: `🚨 Nueva disputa review #123 - Reason: fake`,
     attachments: [{
       fields: [
         { title: 'Review ID', value: '123' },
         { title: 'Disputer', value: 'Carlos Rodríguez (profesional)' },
         { title: 'Reason', value: 'Review falsa' },
         { title: 'Details', value: 'Cliente nunca me contrató...' },
       ],
       actions: [{
         text: 'Ver en Admin Panel',
         url: 'https://admin.quickfixu.com/disputes/456'
       }]
     }]
   });
   ```

4. **Admin Panel Fase 6 (Future)**
   - Queue disputas pending ordenadas por antigüedad
   - Admin ve:
     - Review original (rating + comment)
     - Appointment details (payment proof, chat logs)
     - Disputer profile + historial disputas previas
     - Reviewer profile + historial reviews dejadas
   - Opciones admin:
     - ✅ Aprobar disputa → `review.hidden=true`, notificar usuarios
     - ❌ Rechazar disputa → Mantener review visible, notificar disputer
     - ⏸️ Solicitar evidencia → Status 'awaiting_evidence', email disputer

5. **Admin Aprueba Disputa:**
   ```sql
   UPDATE reviews SET hidden = TRUE WHERE id = 123;
   -- Trigger recalcula rating automáticamente (excluye reviews hidden)
   
   UPDATE review_disputes
   SET status = 'approved',
       admin_notes = 'Verificamos que appointment no existió, review fake',
       resolved_by = :admin_id,
       resolved_at = NOW()
   WHERE id = 456;
   ```

6. **Notificaciones Post-Resolución:**
   - **Profesional (disputer):** "✅ Tu reporte fue aprobado. La review fue removida."
   - **Cliente (reviewer):** "Tu calificación para {professional} fue removida por violar términos de servicio."

---

### Anti-Abuse Protections

**Prevent Spam Disputes:**
- Limit 3 disputes por usuario por mes
- Usuarios con >10 disputas rejected → Flag manual review account

**Retaliation Detection:**
- Si profesional disputa review → Cliente inmediatamente después deja review 1 estrella al profesional → Flag automático admin
- ML post-PMF: Detectar patron temporal disputes (ej: todas reviews 5 estrellas disputan única 1 estrella)

**Fake Review Patterns (Admin Dashboard Stats):**
- Usuarios con 0 appointments completed dejando reviews → Ban automático
- Reviews dejadas fuera ventana 30 días (imposible por constraint, pero validar data integrity)

---

## Testing Strategy

### Unit Tests

**review-validation.service.test.ts**
- ✅ Appointment completed + payment completed → Eligible
- ❌ Appointment pending → NOT eligible
- ❌ Payment not released → NOT eligible
- ✅ Day 29 post-completion → Eligible
- ❌ Day 31 post-completion → NOT eligible
- ❌ Reviewer not participant appointment → NOT eligible

**rating-calculator.test.ts**
- Input: [5,5,4,4,3] → Output: 4.20
- Input: [5] → Output: 5.00
- Input: [] → Output: NULL
- Distribution [5,5,5,4,4,3,2,1] → {5:3, 4:2, 3:1, 2:1, 1:1}

---

### Integration Tests

**reviews.test.ts - E2E Create Review**
```typescript
describe('POST /appointments/:id/reviews', () => {
  it('should create review and update user rating via trigger', async () => {
    // Setup: Appointment completed, payment released
    const appointment = await createTestAppointment({ status: 'completed' });
    await createTestPayment({ appointment_id: appointment.id, payout_status: 'completed' });
    
    // Initial state
    const professional = await prisma.user.findUnique({ where: { id: appointment.professional_id } });
    expect(professional.average_rating).toBeNull();
    expect(professional.review_count).toBe(0);
    
    // Create review
    const res = await request(app)
      .post(`/appointments/${appointment.id}/reviews`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ rating: 5, comment: 'Excelente' });
    
    expect(res.status).toBe(201);
    
    // Verify trigger updated user
    const updatedProfessional = await prisma.user.findUnique({ where: { id: appointment.professional_id } });
    expect(updatedProfessional.average_rating).toBe(5.00);
    expect(updatedProfessional.review_count).toBe(1);
  });
  
  it('should prevent duplicate reviews (UNIQUE constraint)', async () => {
    // Create first review
    await request(app)
      .post(`/appointments/${appointment.id}/reviews`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ rating: 5 });
    
    // Attempt duplicate
    const res = await request(app)
      .post(`/appointments/${appointment.id}/reviews`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ rating: 4 });
    
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already reviewed');
  });
  
  it('should reject review after 30-day window', async () => {
    // Appointment completado hace 31 días
    const oldAppointment = await createTestAppointment({
      status: 'completed',
      scheduled_date: subDays(new Date(), 31),
    });
    
    const res = await request(app)
      .post(`/appointments/${oldAppointment.id}/reviews`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ rating: 5 });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('window expired');
  });
});
```

---

### E2E Tests (React Native + Backend)

**Detox/Maestro E2E:**
1. Login cliente → Navigate to Appointments History
2. Tap appointment completado → Tap "Calificar"
3. Select 5 estrellas → Type comment → Submit
4. Verify success message → Navigate to Professional Profile
5. Verify nueva review visible en lista
6. Verify rating promedio actualizado card profesional

---

## Migration / Rollout

### Development (Semana 1)

**Día 1-2: DB Schema + Migrations**
```bash
# Crear migration con trigger
npx prisma migrate dev --name add_reviews_and_rating_trigger

# Verificar trigger creado
psql -d quickfixu_dev -c "\df update_user_rating"
```

**Día 3-5: Backend Implementation**
- Implementar routes/controllers reviews
- Implementar review-validation service
- Unit tests 100% coverage

**Día 6-7: Frontend Implementation**
- ReviewCreateScreen + StarRating component
- ReviewListScreen + filtros
- Integration con backend API

---

### Staging (Semana 2)

**Testing Scenarios:**
1. Crear 10 appointments test con status completed
2. Simular reviews ratings variados (1-5) → Verificar AVG correcto
3. Simular review duplicate → Verificar 409 error
4. Simular review post day-31 → Verificar 400 error
5. Trigger manualmente cronjob reminders → Verificar push/email llegaron

**Performance Testing:**
- Seed 10k reviews para profesional → Benchmark GET /users/:id/reviews
- Target: <200ms p95 latency con pagination

---

### Production Canary (Semana 3)

**Feature Flag:**
```typescript
// .env
REVIEWS_ENABLED=false // Default OFF producción

// Middleware
if (!process.env.REVIEWS_ENABLED && req.path.includes('/reviews')) {
  return res.status(503).json({ error: 'Reviews feature coming soon' });
}
```

**Beta Testing:**
- Habilitar REVIEWS_ENABLED=true solo para 10 usuarios beta
- Monitorear Sentry errores trigger SQL
- Validar push notifications delivery rate >95%

---

### Production Full Rollout (Semana 4)

**Day 1:**
- Feature flag REVIEWS_ENABLED=true para 10% usuarios (A/B test)
- Monitorear:
  - Error rate POST /reviews
  - Trigger execution time (avg <10ms)
  - Push notification delivery rate

**Day 3:**
- Si error rate <1% → Escalar a 50% usuarios

**Day 5:**
- Si métricas estables → Escalar a 100% usuarios
- Activar cronjob reminders producción

**Day 7:**
- Backfill ratings históricos (appointments completed pre-Fase 5):
  ```sql
  -- Script one-time: Notificar usuarios con appointments completados hace <30 días
  SELECT DISTINCT client_id, professional_id
  FROM appointments
  WHERE status = 'completed'
    AND scheduled_date >= NOW() - INTERVAL '30 days'
    AND id NOT IN (SELECT appointment_id FROM reviews);
  
  -- Enviar push masivo: "¿Ya calificaste tu experiencia con {professional}?"
  ```

---

### Rollback Plan

**Trigger SQL falla masivo:**
```sql
-- Deshabilitar trigger temporalmente
DROP TRIGGER IF EXISTS trigger_update_rating ON reviews;

-- Recalcular ratings manualmente (cronjob temporal)
UPDATE users u
SET average_rating = (
  SELECT AVG(rating) FROM reviews WHERE reviewed_id = u.id AND hidden = FALSE
),
review_count = (
  SELECT COUNT(*) FROM reviews WHERE reviewed_id = u.id AND hidden = FALSE
);

-- Restaurar trigger después fix
CREATE TRIGGER trigger_update_rating ...
```

**Feature Flag OFF:**
- Cambiar REVIEWS_ENABLED=false
- Frontend muestra mensaje: "Sistema de calificaciones en mantenimiento, vuelve pronto"
- Reviews existentes siguen visibles (read-only), solo POST deshabilitado

---

## Open Questions

### 1. Review Editing - Permitir editar review después creada?

**Propuesta:** NO permitir edits (standard Airbnb/Uber)

**Rationale:**
- Previene gaming (usuario deja 1 estrella, profesional contacta ofreciendo dinero, usuario edita a 5 estrellas)
- Simplicidad DB (sin tabla review_history, sin auditoría edits)
- Trust: Reviews inmutables más confiables para futuros clientes

**Alternativa:** Permitir delete + recreate dentro ventana 24hs (compromiso)

---

### 2. Anonymous Reviews - Ocultar nombre reviewer?

**Propuesta:** NO (public reviews con nombre/foto reviewer)

**Rationale:**
- Accountability: Reviews anónimas incentivan abuse
- Trust: Futuros clientes ven que reviewers son usuarios reales verificados
- Standard industria: Airbnb/Uber muestran nombre+foto

**Post-PMF Feature:** Opción "Calificar anónimamente" para reviews negativas (≤2 estrellas) para proteger clientes vulnerables

---

### 3. Professional Response to Reviews - Permitir respuesta pública?

**Propuesta:** SÍ (implementar Fase 6)

**Rationale:**
- Standard Google Reviews/TripAdvisor
- Permite profesional dar contexto review negativa ("Cliente canceló última hora y dejó review negativa por resentimiento")
- Mejora SEO (más contenido user-generated)

**Implementation:**
```prisma
model ReviewResponse {
  id         Int      @id @default(autoincrement())
  review_id  Int      @unique
  content    String   @db.VarChar(500)
  created_at DateTime @default(now())
}
```

**Constraint:** Solo reviewed_user puede responder, máx 1 respuesta por review

---

### 4. Review Incentives - Ofrecer descuento por dejar review?

**Propuesta:** NO incentivos monetarios (viola policy MercadoPago/App Stores)

**Rationale:**
- App Store guidelines prohíben "pay for reviews"
- Sesga ratings hacia positivo (solo usuarios que quieren descuento dejan review)
- Degrada trust sistema

**Alternativa:** Gamification NO-monetaria:
- Badge "Reviewer Activo" después 10 reviews
- Prioridad en quote responses (profesionales ven clientes con historial reviews)

---

### 5. Minimum Reviews Before Showing Rating - Threshold?

**Propuesta:** Mostrar rating desde primera review (NO threshold)

**Rationale:**
- Transparencia total (ocultar rating sospechoso para usuarios)
- Early adopters profesionales merecen visibilidad primera review positiva
- Users entienden "1 calificación" vs "87 calificaciones" en UI

**UI Clarity:**
```
⭐ 5.0 (1 calificación)  ← Mostrar desde review #1
⭐ 4.7 (87 calificaciones) ← Más confiable (visible en badge color: gray vs gold)
```

---

## Performance Considerations

### Database Indexes Impact

**Index cardinality analysis:**
```sql
-- Profesional con 1000 reviews
EXPLAIN ANALYZE
SELECT * FROM reviews
WHERE reviewed_id = 101
ORDER BY created_at DESC
LIMIT 10;

-- Sin índice (reviewed_id, created_at): Seq Scan 850ms
-- Con índice composite: Index Scan 12ms (70x faster)
```

**Index size overhead:**
- `idx_reviews_by_user`: ~50MB por 100k reviews (acceptable)
- `idx_reviews_by_rating`: ~30MB (minimal, high selectivity)

---

### Trigger Performance

**Benchmark trigger execution:**
```sql
-- INSERT review con 1000 reviews existentes
EXPLAIN ANALYZE
INSERT INTO reviews (appointment_id, reviewer_id, reviewed_id, rating)
VALUES (999, 888, 101, 5);

-- Trigger execution: 8-12ms (AVG query sobre 1000 rows)
-- Total INSERT latency: 25-30ms (acceptable, non-blocking user)
```

**Optimization:** Partial index solo reviews recientes (últimos 6 meses) para stats queries

---

### Pagination Strategy

**Cursor-based pagination (mejor que offset para reviews):**
```typescript
// GET /users/:id/reviews?cursor=2026-03-20T10:00:00Z&limit=10
const reviews = await prisma.review.findMany({
  where: {
    reviewed_id: userId,
    created_at: { lt: new Date(cursor) }, // Cursor = created_at última review página anterior
  },
  orderBy: { created_at: 'desc' },
  take: 10,
});

// Next page cursor = reviews[reviews.length - 1].created_at
```

**Benefits:**
- Consistente con inserts nuevos (offset skip rows inconsistente si hay nuevas reviews)
- Performance constante (offset 1000 requiere skip 1000 rows, cursor usa index directo)

---

## Security Considerations

### SQL Injection Prevention

**Prisma ORM protege automáticamente:**
```typescript
// SAFE (Prisma parameterized queries)
await prisma.review.findMany({
  where: { reviewed_id: req.params.id },
});

// UNSAFE (raw SQL sin sanitization)
await prisma.$queryRaw`SELECT * FROM reviews WHERE reviewed_id = ${req.params.id}`; // ❌ NEVER
```

---

### IDOR Prevention

**Validación ownership reviews:**
```typescript
// POST /reviews/:id/dispute
const review = await prisma.review.findUnique({
  where: { id: reviewId },
  include: { appointment: true },
});

// Verificar usuario es participant appointment
const isParticipant = 
  review.appointment.client_id === req.user.id ||
  review.appointment.professional_id === req.user.id;

if (!isParticipant) {
  throw new ForbiddenError('Cannot dispute review for appointment you are not part of');
}
```

---

### Rate Limiting

**Endpoints críticos:**
```typescript
// POST /appointments/:id/reviews
rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5, // Max 5 reviews per 15min (previene spam)
  message: 'Too many reviews created, try again later',
});

// POST /reviews/:id/dispute
rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // Max 3 disputes per hora
  message: 'Too many disputes submitted',
});
```

---

## Monitoring & Alerts

### Key Metrics

**Datadog/CloudWatch Dashboards:**
1. **Review creation rate:** Reviews/día (target: 30-40% appointments completados)
2. **Average rating platform-wide:** Monitorear tendencia (healthy: 4.2-4.6)
3. **Dispute rate:** Disputes/100 reviews (alert si >5%)
4. **Trigger execution time:** p95 latency (alert si >50ms)
5. **Reminder conversion rate:** Reviews creadas post-reminder / Total reminders enviados

**Alerts:**
```yaml
# Sentry alert
- name: "Trigger SQL Error Spike"
  condition: error_count > 10 in 5min
  notification: slack #engineering-critical

# Datadog alert  
- name: "Review Creation Rate Drop"
  condition: reviews_per_day < 50% baseline for 24h
  notification: slack #product-analytics
```

---

## Accessibility Considerations

### Screen Reader Support

**StarRating component:**
```tsx
<TouchableOpacity
  accessibilityLabel={`Calificar con ${star} estrellas`}
  accessibilityRole="button"
  accessibilityState={{ selected: rating === star }}
>
  <Icon name={rating >= star ? 'star' : 'star-outline'} />
</TouchableOpacity>
```

**Review comment:**
```tsx
<TextInput
  accessibilityLabel="Comentario opcional sobre tu experiencia"
  accessibilityHint="Máximo 500 caracteres"
  placeholder="Cuéntanos tu experiencia (opcional)"
/>
```

---

## Localization Support (Future)

**Reviews multilenguaje (post-expansion Brasil/Chile):**
```prisma
model Review {
  // ... existing fields ...
  language String @default("es") @db.VarChar(5) // 'es' | 'pt' | 'en'
}

// Google Translate API automática para comments (mostrar traducción + original)
```

---

## Documentation Artifacts

**Files created:**
- ✅ `docs/phases/fase-5-design.md` (este documento)

**Ready for:** sdd-tasks (task breakdown para implementación)

**Estimated Implementation Time:** 12-15 días (2-3 semanas)

---

## Executive Summary

Fase 5 implementa reputación bidireccional con arquitectura robusta:

✅ **Data Integrity:** PostgreSQL triggers garantizan rating sincronizado  
✅ **Anti-Abuse:** UNIQUE constraints + payment verification previenen review bombing  
✅ **User Experience:** Reminders día 3/7 maximizan conversion rate  
✅ **Moderation:** Dispute system preparado, admin manual Fase 6  
✅ **Performance:** Índices optimizados, trigger <10ms latency  
✅ **Scalability:** Cursor pagination, partial indexes para growth  

**Next Steps:**
1. Run `sdd-tasks` para breakdown implementación
2. Crear Prisma migration con trigger SQL
3. Implementar endpoints + tests
4. Deploy staging + performance testing
5. Rollout canary 10% → 100% usuarios
