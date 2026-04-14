# Exploration: Fase 5 - Reviews & Ratings

**Change name:** `fase-5-reviews-ratings`  
**Date:** Marzo 2026  
**Status:** Exploration Complete  
**Prerequisite:** Fase 4 (Payments & Appointments) MUST be completed

---

## 1. Executive Summary

La Fase 5 implementa **el sistema de reputación bidireccional de QuickFixU**: tanto clientes como profesionales pueden calificar y dejar reviews después de completar un trabajo. Este es el **núcleo de confianza del marketplace** — sin reputación verificable, los clientes no confían en contratar profesionales desconocidos y los profesionales no pueden diferenciarse de la competencia.

**Complejidad:** MEDIA-ALTA — Aunque el modelo de datos es relativamente simple (tabla `reviews` + trigger para actualizar ratings), las reglas de negocio son críticas para evitar abuse (reviews falsas, spam, extorsión) y garantizar equidad (ambos lados pueden calificar, reviews solo post-completion).

**Decisiones clave tomadas:**

| Decisión | Opción Seleccionada | Justificación |
|----------|---------------------|---------------|
| **Timing reviews** | Solo después `appointment.status='completed'` AND `payment.status='completed'` | Garantiza trabajo realmente sucedió (no reviews ficticias). Cliente solo puede calificar si pagó, profesional si trabajó. |
| **Ventana temporal** | 30 días después `scheduled_date` para dejar review | Balance flexibilidad (cliente olvida confirmar inmediatamente) vs recencia (review >30 días pierde contexto). Después 30 días, botón "Calificar" se deshabilita. |
| **Blind reviews** | NO (cada uno ve review inmediatamente después enviarla) | Simplicidad MVP. Blind reviews requieren tabla temporal + cronjob para liberar ambas reviews simultáneamente. Post-PMF si hay evidencia de retaliation. |
| **1 review por persona** | UNIQUE constraint `(appointment_id, reviewer_id)` | Evita spam (mismo cliente calificar 10 veces mismo trabajo). Permite 2 reviews por appointment (cliente + profesional). |
| **Rating obligatorio** | Rating (1-5 estrellas) required, comment (texto) opcional | El número es lo que se muestra en cards/listados (UX crítico). Texto opcional reduce fricción (muchos no quieren escribir). |
| **Comment límite** | Max 500 caracteres | Previene abusos (reviews de 5000 palabras con insultos). Suficiente para "Excelente trabajo, llegó puntual" o "Dejó todo sucio, no vuelvo a contratar". |
| **Actualización rating** | Trigger automático `UPDATE users.rating = AVG(reviews.rating)` cuando se crea review | Real-time. Alternativa cronjob diario es más lenta (profesional ve rating viejo 24hs). Trigger es estándar para este caso. |
| **Rating default** | Profesionales nuevos sin reviews: `rating = NULL` (no mostrar 0 estrellas) | UI diferencia "sin calificaciones aún" (NULL) vs "malo" (2.0 estrellas). Mostrar 0 estrellas espanta clientes de profesionales nuevos. |
| **Peso recency** | NO (todas reviews pesan igual en promedio) | Simplicidad MVP. Weighted average por recency requiere función custom + recalcular histórico. Post-PMF si profesional mejora y quiere que reviews viejas pesen menos. |
| **Apelación reviews negativas** | Preparar estructura (`review_disputes` table) pero implementación en Fase 6 (Admin Panel) | Crítico tener el flujo (profesional reporta review injusta → admin media → decisión eliminar/mantener). Pero UI admin + mediación son Fase 6. |
| **Moderación automática** | NO filtro palabras ofensivas en MVP | Complejidad alta (falsos positivos, evasión con typos). Dejar para Fase 6 con admin manual. Por ahora confiar en comunidad + reportar reviews inapropiadas. |
| **Respuesta a reviews** | NO (profesional NO puede responder públicamente a review negativa) | Simplicidad + evita flame wars ("tu review es mentira" → "no, es verdad" ad infinitum). Solo admin puede eliminar si review viola términos. |
| **Editar review** | NO (una vez enviada, review es inmutable) | Evita "arrepentimientos" manipulados (profesional amenaza → cliente cambia 1★ a 5★). Si realmente hay error, cliente reporta a admin. |
| **Reviews anónimas** | NO (siempre se ve nombre + foto del reviewer) | Transparencia > anonimato. Reviews anónimas invitan a abuse (competencia puede dejar 1★ sin consecuencias). Nombre visible desincentiva calumnias. |
| **Reminder notificación** | Push notification 3 días y 7 días después completar trabajo si no dejó review | Balance reminder útil vs spam. 2 notificaciones suficientes (día 3 y día 7). Si ignora ambas, asumir que no quiere calificar. |
| **Mostrar todas reviews** | Sí, con paginación cursor-based (20 reviews/página) + filtro por rating | Transparencia > curación. No ocultar reviews malas (sería manipulación). Clientes pueden filtrar "solo 5★" o "solo 1-2★" para tomar decisión informada. |
| **Stats distribución** | Mostrar "X% 5 estrellas, X% 4 estrellas..." en perfil profesional | UX estándar marketplaces (Airbnb, Amazon). Ayuda cliente entender si 4.2★ promedio es por "muchos 4★" o "mitad 5★ mitad 1★". |

**Features a entregar:**

### Bloque 1: Crear Review Post-Completion
1. ✅ Botón "Calificar" visible en appointment SOLO si `status='completed'` AND `payment.status='completed'`
2. ✅ Validar que reviewer NO haya dejado review aún (UNIQUE constraint)
3. ✅ Validar ventana temporal 30 días desde `scheduled_date`
4. ✅ Modal rating: selector estrellas 1-5 (obligatorio) + textarea comment (opcional, max 500 chars)
5. ✅ Guardar review en tabla `reviews` con `appointment_id`, `reviewer_id`, `reviewed_id`, `rating`, `comment`
6. ✅ Trigger automático actualiza `users.rating` (AVG de todas reviews recibidas)
7. ✅ Notificación push a reviewed: "X te dejó una calificación de Y estrellas"

### Bloque 2: Visualizar Reviews en Perfil
8. ✅ Endpoint GET /api/users/:userId/reviews (público, no requiere auth)
9. ✅ Paginación cursor-based con `created_at` + `id` (20 reviews/página)
10. ✅ Filtro query param `?rating=5` (solo 5 estrellas) o `?rating=1-2` (solo 1-2 estrellas)
11. ✅ Mostrar reviewer name + foto + fecha + rating + comment
12. ✅ Ordenar por `created_at DESC` (más recientes primero)
13. ✅ Incluir stats distribución: `{ "5_stars": 65, "4_stars": 20, "3_stars": 10, "2_stars": 3, "1_star": 2 }`

### Bloque 3: Rating Promedio en Cards/Listados
14. ✅ Mostrar `users.rating` + `users.rating_count` en:
    - Card profesional en búsqueda (GET /api/professionals/search)
    - Card propuesta recibida (GET /api/posts/:postId/proposals)
    - Perfil público profesional (GET /api/users/:userId)
15. ✅ UI diferencia `rating = NULL` (sin calificaciones) vs `rating = 2.0` (calificación baja)
16. ✅ Ordenar profesionales en búsqueda por rating DESC como secondary sort (primary: distancia)

### Bloque 4: Reminder Notificaciones
17. ✅ Cronjob diario busca appointments completados hace 3 días sin review → envía push "Califica tu experiencia con X"
18. ✅ Cronjob diario busca appointments completados hace 7 días sin review → envía push final "Tienes Y días para calificar a X"
19. ✅ Si ambos (cliente + profesional) ya dejaron review → no enviar reminders
20. ✅ Después 30 días, deshabilitar botón "Calificar" (tooltip: "Plazo vencido")

### Bloque 5: Apelación Reviews Negativas (Preparación Fase 6)
21. ✅ Botón "Reportar review" visible solo si `rating <= 2` (reviews 1-2 estrellas)
22. ✅ Modal: textarea motivo (obligatorio, min 20 chars) + opcional evidencia (fotos/PDFs)
23. ✅ Crear registro tabla `review_disputes` (review_id, disputer_id, reason, evidence_urls, status='open')
24. ✅ Notificación admin (email/Slack) con link al dispute
25. ✅ UI placeholder "Disputa en revisión - Admin responderá en 48hs"
26. ✅ **NO implementar mediación:** Admin panel + resolución son Fase 6

### Bloque 6: Moderación y Seguridad
27. ✅ Validar `rating` es integer 1-5 (rechazar 0, 6, null)
28. ✅ Validar `comment` max 500 chars (truncar o rechazar)
29. ✅ Sanitizar HTML en comment (escapar `<script>`, `<iframe>` para evitar XSS)
30. ✅ Rate limit: max 1 review cada 10 segundos por usuario (evita spam accidental double-tap)
31. ✅ Log todas las reviews creadas (auditoría admin, detectar patrones abuse)

**Riesgos identificados:**

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| **Review bombing** (profesional contrata bots para dejarse 100 reviews 5★) | CRÍTICO — Destruye confianza marketplace | UNIQUE constraint `appointment_id` + `reviewer_id` garantiza 1 review por trabajo real. Bots tendrían que crear appointments reales (pagar MercadoPago) = costoso. Admin puede detectar patrones (50 reviews en 1 día = sospechoso). |
| **Retaliation reviews** (profesional deja 1★ a cliente porque cliente le dio 1★) | ALTO — Desincentiva reviews honestas | Blind reviews (ambos envían sin ver la del otro) es solución ideal, pero compleja para MVP. Alternativa: Admin puede eliminar reviews claramente retaliatorias (texto "me dio 1 estrella así que le doy lo mismo"). Post-PMF implementar blind. |
| **Extorsión** (profesional amenaza cliente: "Si no me das 5★, te doy 1★") | ALTO — Ilegal + destruye confianza | Botón "Reportar extorsión" en modal review. Si cliente reporta antes de enviar review → admin investiga. Si confirmado → ban permanente profesional + eliminar review del profesional. Log todos los reportes. |
| **Review fake positivas** (amigos/familiares dejan 5★ sin trabajo real) | MEDIO — Degrada calidad ratings | UNIQUE constraint en appointment_id bloquea completamente (no puede haber review sin trabajo). Para dejarse review fake, necesitarían crear post → proposal → pago → appointment → confirmar = ARS 1000+ mínimo. No escalable. |
| **Reviews obsoletas** (profesional malo en 2024, mejoró en 2026, pero promedio sigue bajo) | MEDIO — Profesional no puede "resetear" reputación | Weighted average por recency (reviews <6 meses pesan 1.5x, >2 años pesan 0.5x). Requiere función SQL custom. Dejar para post-PMF si hay queja recurrente. |
| **Comment abuse** (insultos, difamación, amenazas en texto review) | MEDIO — Legal liability + UX tóxica | Botón "Reportar review inapropiada" (cualquier usuario puede reportar). Admin revisa manualmente (Fase 6). Si confirma violación términos → eliminar comment (mantener rating). Filtro palabras ofensivas automático en Fase 7+ (muchos falsos positivos). |
| **Cliente no deja review nunca** (50% clientes ignoran reminders) | BAJO — Profesionales buenos quedan con pocas reviews | Esperado (industria promedio ~30% review rate). Reminders día 3 y 7 ayudan. Incentivo futuro: descuento 5% próximo servicio si dejó review (Fase 7+). No bloquear MVP por esto. |
| **Profesional deja review negativa a cliente malo** (no paga, trata mal, etc.) | BAJO — Es feature, no bug | Reputación bidireccional es intencional. Cliente con 2.5★ promedio (porque nunca paga a tiempo) no podrá conseguir profesionales buenos. Esto auto-regula calidad clientes. |
| **Race condition:** Cliente deja review mientras admin elimina appointment | BAJO — Edge case rarísimo | Lock transaccional: validar `appointment.status='completed'` en mismo WHERE al INSERT review. Si appointment cambió → rollback, error "Appointment modificado, refresca pantalla". |

**Ready for proposal:** ✅ YES — Arquitectura definida, todas las decisiones clave tomadas, dependencias claras (Fase 4 appointments), riesgos identificados con mitigaciones.

---

## 2. Current State (Post Fase 4)

### Ya Tenemos Implementado:
✅ Tabla `appointments` con status `scheduled`, `in_progress`, `completed`, `cancelled_by_client`, `cancelled_by_professional`  
✅ Tabla `payments` con status `pending`, `completed`, `failed`, `refunded`, `disputed`  
✅ Tabla `appointment_confirmations` (client_confirmed, professional_confirmed)  
✅ Trigger confirmación mutua → `payment.payout_status='ready'`  
✅ Notificaciones push FCM (infraestructura lista)  
✅ Tabla `users` con campos `rating DECIMAL(3,2)` y `rating_count INTEGER` (definidos en DataModel pero sin uso aún)  

### Base de Datos Actual:
```sql
-- Tablas existentes (Fases 1-4)
users (id, full_name, email, profile_photo_url, role, rating, rating_count, ...)
professionals (id, user_id, years_experience, description, ...)
appointments (id, proposal_id, payment_id, scheduled_date, status, ...)
payments (id, proposal_id, client_id, professional_id, amount, status, ...)
appointment_confirmations (id, appointment_id, client_confirmed, professional_confirmed, ...)
notifications (id, user_id, type, title, body, read, sent_at, ...)
```

### Tablas a Crear (Fase 5):

```sql
-- Migration: 20260322_create_reviews_table
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,
  
  -- Quién califica a quién
  reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- Quien deja review
  reviewed_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- Quien recibe review
  
  -- Contenido review
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5), -- 1-5 estrellas
  comment TEXT, -- Opcional, max 500 chars (validado en app)
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraint: Solo 1 review por persona por appointment
  CONSTRAINT uq_review_per_person_per_appointment UNIQUE (appointment_id, reviewer_id),
  
  -- Constraint: Reviewer y reviewed deben ser diferentes
  CONSTRAINT chk_review_different_users CHECK (reviewer_id != reviewed_id),
  
  -- Constraint: Reviewer debe ser parte del appointment (client o professional)
  -- Validado en aplicación, no DB constraint directo
  CHECK (
    -- Si reviewer es client del appointment → reviewed es professional
    -- Si reviewer es professional del appointment → reviewed es client
    -- Validación completa en trigger o app layer
    TRUE
  )
);

CREATE INDEX idx_reviews_appointment_id ON reviews(appointment_id);
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_reviewed_id ON reviews(reviewed_id); -- Crítico para calcular AVG rating
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX idx_reviews_rating ON reviews(rating); -- Para filtro por rating

-- Migration: 20260322_create_review_disputes_table (preparación Fase 6)
CREATE TABLE review_disputes (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE RESTRICT,
  disputer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- Quien reporta (reviewed)
  
  reason TEXT NOT NULL, -- Motivo disputa (min 20 chars validado en app)
  evidence_urls TEXT[], -- Array URLs fotos/PDFs evidencia (PostgreSQL array)
  
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved_kept', 'resolved_removed', 'closed_invalid')),
  admin_notes TEXT, -- Notas internas admin
  resolved_at TIMESTAMP,
  resolution_reason TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Solo 1 disputa por review
  CONSTRAINT uq_one_dispute_per_review UNIQUE (review_id)
);

CREATE INDEX idx_review_disputes_review_id ON review_disputes(review_id);
CREATE INDEX idx_review_disputes_status ON review_disputes(status) WHERE status IN ('open', 'investigating');
CREATE INDEX idx_review_disputes_created_at ON review_disputes(created_at DESC);

-- Trigger: Actualizar users.rating cuando se crea review
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalcular rating promedio del reviewed_id
  WITH rating_stats AS (
    SELECT 
      AVG(rating)::DECIMAL(3,2) AS avg_rating,
      COUNT(*) AS total_reviews
    FROM reviews
    WHERE reviewed_id = NEW.reviewed_id
  )
  UPDATE users
  SET 
    rating = rating_stats.avg_rating,
    rating_count = rating_stats.total_reviews,
    updated_at = NOW()
  FROM rating_stats
  WHERE id = NEW.reviewed_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_rating
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_user_rating();

-- Nota: Si se elimina review (admin), crear trigger similar AFTER DELETE
-- para recalcular rating sin esa review. No implementado en MVP (Fase 6).
```

**Validaciones adicionales a nivel aplicación (NO constraints DB):**

1. **Reviewer debe ser parte del appointment:**
   ```typescript
   // Validar que reviewer es client o professional del appointment
   const appointment = await prisma.appointment.findUnique({
     where: { id: appointmentId },
     include: {
       payment: true, // Para obtener client_id y professional_id
     },
   });
   
   const isClient = appointment.payment.client_id === reviewerId;
   const isProfessional = appointment.payment.professional_id === reviewerId;
   
   if (!isClient && !isProfessional) {
     throw new Error('Only appointment participants can leave reviews');
   }
   
   // Determinar reviewed_id (la otra persona del appointment)
   const reviewedId = isClient 
     ? appointment.payment.professional_id 
     : appointment.payment.client_id;
   ```

2. **Appointment debe estar completado:**
   ```typescript
   if (appointment.status !== 'completed') {
     throw new Error('Can only review completed appointments');
   }
   
   if (appointment.payment.status !== 'completed') {
     throw new Error('Can only review after payment is completed');
   }
   ```

3. **Ventana temporal 30 días:**
   ```typescript
   const daysSinceCompletion = Math.floor(
     (Date.now() - appointment.scheduled_date.getTime()) / (1000 * 60 * 60 * 24)
   );
   
   if (daysSinceCompletion > 30) {
     throw new Error('Review window expired (30 days after completion)');
   }
   ```

---

## 3. Technical Options Evaluated

### 3.1 Timing de Reviews: Cuándo se Pueden Dejar

**Contexto:** ¿En qué momento del flujo cliente/profesional puede dejar review?

#### Opción A: Inmediatamente Después de Aceptar Propuesta 🔴
**Flujo:**
- Cliente acepta propuesta → ambos pueden calificar inmediatamente

**Pros:**
- Más simple (no esperar trabajo completado)

**Cons:**
- ❌ **Reviews ficticias:** Cliente puede dejar 5★ sin que trabajo suceda (o viceversa)
- ❌ **Sin contexto:** No se puede calificar trabajo que no ocurrió aún
- ❌ **Abuse fácil:** Profesional podría crear propuestas falsas con amigos para inflarse reviews

**Veredicto:** ❌ **INACEPTABLE** — Reviews sin trabajo real no tienen valor.

---

#### Opción B: Después de `appointment.status='completed'` Y `payment.status='completed'` ✅
**Flujo:**
- Trabajo finaliza → ambos confirman → appointment.status='completed'
- Payment procesado → payment.status='completed'
- SOLO entonces botón "Calificar" se habilita

**Pros:**
- ✅ **Garantiza trabajo sucedió:** UNIQUE constraint appointment_id + constraint payment completed = imposible review sin trabajo
- ✅ **Contexto real:** Ambos experimentaron el trabajo (cliente vio resultado, profesional vio sitio/cliente)
- ✅ **Anti-abuse natural:** Crear review fake requiere pagar MercadoPago (ARS 1000+ mínimo) = no escalable

**Cons:**
- Si appointment se cancela → no se puede dejar review (pero esto es correcto: no hay nada que calificar)

**Implementación:**
```typescript
router.post('/reviews', requireAuth, async (req, res) => {
  const { appointmentId, rating, comment } = req.body;
  const reviewerId = req.userId;
  
  // 1. Validar appointment existe y está completado
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      payment: true,
    },
  });
  
  if (!appointment) {
    return res.status(404).json({ error: 'Appointment not found' });
  }
  
  if (appointment.status !== 'completed') {
    return res.status(400).json({ error: 'Can only review completed appointments' });
  }
  
  if (appointment.payment.status !== 'completed') {
    return res.status(400).json({ error: 'Can only review after payment is completed' });
  }
  
  // 2. Validar ventana temporal (30 días)
  const daysSinceCompletion = Math.floor(
    (Date.now() - new Date(appointment.scheduled_date).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysSinceCompletion > 30) {
    return res.status(400).json({ error: 'Review window expired (30 days)' });
  }
  
  // 3. Determinar reviewed_id
  const isClient = appointment.payment.client_id === reviewerId;
  const isProfessional = appointment.payment.professional_id === reviewerId;
  
  if (!isClient && !isProfessional) {
    return res.status(403).json({ error: 'Only appointment participants can review' });
  }
  
  const reviewedId = isClient 
    ? appointment.payment.professional_id 
    : appointment.payment.client_id;
  
  // 4. Crear review (UNIQUE constraint bloquea duplicados)
  try {
    const review = await prisma.review.create({
      data: {
        appointment_id: appointmentId,
        reviewer_id: reviewerId,
        reviewed_id: reviewedId,
        rating: rating,
        comment: comment || null,
      },
    });
    
    // 5. Trigger automático ya actualizó users.rating
    
    // 6. Notificar reviewed
    await sendPushNotification(reviewedId, {
      title: '⭐ Nueva calificación',
      body: `Recibiste ${rating} estrellas`,
      data: { type: 'new_review', reviewId: review.id },
    });
    
    res.status(201).json({ review });
  } catch (error) {
    // UNIQUE constraint violation (ya dejó review)
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'You already reviewed this appointment' });
    }
    throw error;
  }
});
```

**Veredicto:** ✅ **RECOMENDADO** — Único modelo que garantiza integridad reviews.

---

### 3.2 Ventana Temporal: ¿Cuántos Días Después de Completar?

**Contexto:** ¿Cuánto tiempo tiene usuario para dejar review después de completar trabajo?

#### Opción A: Sin Límite (Review permanentemente abierta) 🔴
**Pros:**
- Flexible (cliente puede calificar 6 meses después)

**Cons:**
- ❌ **Contexto perdido:** Review de trabajo hace 1 año no es confiable (cliente no recuerda detalles)
- ❌ **Extorsión diferida:** Profesional puede amenazar "Si no me recomiendas, te doy 1★" meses después
- ❌ **Incentivo débil:** Sin urgencia, tasa de reviews baja (<10% según industria)

**Veredicto:** ❌ Rechazado — Sin límite reduce calidad y cantidad de reviews.

---

#### Opción B: 7 Días (Ventana Corta) 🟡
**Pros:**
- Recencia garantizada (review fresca)
- Urgencia alta (cliente califica rápido)

**Cons:**
- ❌ **Inflexible:** Cliente que viaja 10 días pierde ventana
- ❌ **Profesional jodido:** Si trabajo tiene garantía 30 días, cliente puede descubrir falla día 15 (fuera de ventana)

**Veredicto:** 🟡 Muy corto — No cubre casos legítimos.

---

#### Opción C: 30 Días ✅
**Pros:**
- ✅ **Balance flexibilidad vs recencia:** 30 días suficiente para "descubrir" problemas (ej: instalación eléctrica falla semana después)
- ✅ **Cubre garantías:** Mayoría trabajos domésticos tienen garantía 15-30 días
- ✅ **Standard industria:** Airbnb (14 días), Uber (30 días), TaskRabbit (30 días)

**Cons:**
- Review puede ser de trabajo hace 1 mes (aceptable si es límite superior)

**Implementación:**
```typescript
// Cronjob diario: detectar appointments con ventana expirada
cron.schedule('0 2 * * *', async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // Buscar appointments completados hace >30 días sin review de cliente
  const expiredAppointments = await prisma.appointment.findMany({
    where: {
      status: 'completed',
      scheduled_date: { lt: thirtyDaysAgo },
      // No existe review del cliente
      reviews: {
        none: {
          reviewer_id: { equals: /* client_id from payment */ },
        },
      },
    },
    include: { payment: true },
  });
  
  // Actualizar metadata para UI (opcional, puede validarse on-demand)
  // O simplemente validar en endpoint POST /reviews
});
```

**UI:**
```typescript
// Frontend: mostrar estado botón "Calificar"
const daysSinceCompletion = Math.floor(
  (Date.now() - appointment.scheduled_date.getTime()) / (1000 * 60 * 60 * 24)
);

if (daysSinceCompletion > 30) {
  // Botón disabled, tooltip "Plazo vencido (30 días)"
} else {
  // Botón enabled, tooltip "Tienes X días para calificar"
}
```

**Veredicto:** ✅ **RECOMENDADO** — Standard industria, flexible pero no infinito.

---

### 3.3 Blind Reviews: ¿Ambos Envían Sin Ver Review del Otro?

**Contexto:** ¿Cliente ve review de profesional inmediatamente o esperamos a que ambos envíen?

#### Opción A: Reviews Públicas Inmediatas (NO Blind) ✅
**Flujo:**
- Cliente envía review 4★ → profesional VE 4★ inmediatamente
- Profesional envía review 5★ → cliente VE 5★ inmediatamente

**Pros:**
- ✅ **Simple:** No requiere tabla temporal ni cronjob
- ✅ **Transparencia:** Usuario ve resultado inmediato (UX satisfactorio)
- ✅ **No espera:** No hay "reviews pendientes" bloqueadas

**Cons:**
- Riesgo retaliation (profesional ve 1★ del cliente → le deja 1★ vengativo)

**Mitigación retaliation:**
- Admin puede eliminar reviews claramente retaliatorias (texto "me calificó mal así que yo también")
- Botón "Reportar review inapropiada" para detectar patrones
- Post-PMF: si retaliation es problema recurrente, migrar a blind reviews

**Implementación:**
```typescript
// Al crear review, simplemente INSERT y mostrar
const review = await prisma.review.create({ data: {...} });
res.status(201).json({ review }); // Usuario ve review inmediatamente
```

**Veredicto:** ✅ **RECOMENDADO MVP** — Simplicidad > prevenir edge case poco común.

---

#### Opción B: Blind Reviews (Ambos Envían, Se Liberan Simultáneamente) 🟡
**Flujo:**
- Cliente envía review 4★ → se guarda en `pending_reviews` tabla temporal
- Profesional envía review 5★ → se guarda en `pending_reviews`
- Cronjob detecta ambos enviaron → mueve a tabla `reviews`, envía notificaciones

**Pros:**
- ✅ **Previene retaliation:** Profesional NO sabe qué calificó cliente hasta después enviar la suya
- ✅ **Honestidad:** Incentiva reviews genuinas (no "defensivas")

**Cons:**
- ❌ **Complejidad alta:** Tabla adicional, cronjob sincronización, manejo timeout (qué pasa si solo 1 envía)
- ❌ **UX confusa:** Cliente envía review pero NO la ve publicada (espera misteriosa)
- ❌ **Edge cases:** Si solo cliente envía (profesional nunca envía) → ¿cuándo liberar review cliente? (7 días? 30 días?)

**Implementación sketch:**
```sql
CREATE TABLE pending_reviews (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER UNIQUE NOT NULL,
  client_rating INTEGER,
  client_comment TEXT,
  client_submitted_at TIMESTAMP,
  professional_rating INTEGER,
  professional_comment TEXT,
  professional_submitted_at TIMESTAMP
);

-- Cronjob: detectar ambos campos NOT NULL → mover a reviews
```

**Veredicto:** 🟡 **Post-PMF** — Solo implementar si hay evidencia de retaliation abuse en MVP (medir: % reviews con mismo rating bidireccional después de ver rating del otro).

---

### 3.4 Cálculo Rating Promedio: Trigger vs Cronjob

**Contexto:** ¿Cuándo actualizar `users.rating` cuando se crea review?

#### Opción A: Trigger Automático AFTER INSERT ✅
**Pros:**
- ✅ **Real-time:** `users.rating` actualizado inmediatamente después crear review
- ✅ **Simple:** SQL nativo, no requiere infraestructura adicional
- ✅ **Consistente:** Imposible que rating esté desactualizado (trigger garantiza sync)

**Cons:**
- Overhead mínimo en INSERT review (1 UPDATE adicional)

**Implementación:**
```sql
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
BEGIN
  WITH rating_stats AS (
    SELECT 
      AVG(rating)::DECIMAL(3,2) AS avg_rating,
      COUNT(*) AS total_reviews
    FROM reviews
    WHERE reviewed_id = NEW.reviewed_id
  )
  UPDATE users
  SET 
    rating = rating_stats.avg_rating,
    rating_count = rating_stats.total_reviews,
    updated_at = NOW()
  FROM rating_stats
  WHERE id = NEW.reviewed_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_rating
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_user_rating();
```

**Performance:**
- AVG query con INDEX en `reviewed_id` es O(n) donde n = # reviews del usuario
- Profesional con 100 reviews → AVG tarda ~5ms
- Profesional con 1000 reviews → AVG tarda ~20ms (aceptable, pocas inserts reviews)

**Veredicto:** ✅ **RECOMENDADO** — Standard para este caso de uso.

---

#### Opción B: Cronjob Diario Recalcula Todos los Ratings 🔴
**Pros:**
- No overhead en INSERT review

**Cons:**
- ❌ **Latencia alta:** Rating desactualizado hasta 24hs
- ❌ **UX malo:** Profesional recibe review 5★, ve rating viejo (4.2) por 24hs
- ❌ **Ineficiente:** Recalcula TODOS usuarios (99% no tienen reviews nuevas)

**Veredicto:** ❌ Rechazado — Trigger es mejor en todos los aspectos.

---

### 3.5 Rating Default: NULL vs 0 vs 5

**Contexto:** Profesional nuevo sin reviews aún, ¿qué mostrar?

#### Opción A: `rating = 0` 🔴
**UI:** Profesional aparece con "⭐ 0.0 (0 reseñas)"

**Cons:**
- ❌ **Confuso:** 0 estrellas parece "muy malo" (escala es 1-5, no 0-5)
- ❌ **Espanta clientes:** Profesional nuevo parece incompetente

**Veredicto:** ❌ Rechazado.

---

#### Opción B: `rating = 5` (Optimista) 🔴
**UI:** Profesional aparece con "⭐ 5.0 (0 reseñas)"

**Cons:**
- ❌ **Engañoso:** Cliente piensa que es excelente, pero no tiene historial
- ❌ **Abuse:** Profesional crea cuenta nueva cada vez que acumula reviews malas

**Veredicto:** ❌ Rechazado — Manipulable.

---

#### Opción C: `rating = NULL` ✅
**UI:** Profesional aparece con "Sin calificaciones aún"

**Pros:**
- ✅ **Honesto:** Cliente sabe que no hay historial
- ✅ **Diferencia nuevo vs malo:** "Sin calificaciones" (NULL) vs "⭐ 2.3 (12 reseñas)" (malo)

**Implementación:**
```typescript
// Frontend: render rating
if (user.rating === null) {
  return <Text>Sin calificaciones aún</Text>;
} else {
  return <Text>⭐ {user.rating.toFixed(1)} ({user.rating_count} reseñas)</Text>;
}
```

**SQL:**
```sql
-- Profesional nuevo
INSERT INTO users (..., rating, rating_count) VALUES (..., NULL, 0);

-- Después de primera review
-- Trigger actualiza: rating = 4.0, rating_count = 1
```

**Veredicto:** ✅ **RECOMENDADO** — Transparente y honesto.

---

### 3.6 Peso por Recency: ¿Reviews Recientes Pesan Más?

**Contexto:** Profesional malo en 2024 (10 reviews de 2★), mejoró en 2026 (5 reviews de 5★). ¿Promedio ponderado?

#### Opción A: Simple Average (Todas Pesan Igual) ✅
**Cálculo:**
```sql
AVG(rating) → (10*2 + 5*5) / 15 = 3.0
```

**Pros:**
- ✅ **Simple:** SQL nativo, no requiere función custom
- ✅ **Predecible:** Cliente entiende "promedio de todas las reviews"

**Cons:**
- Profesional que mejoró queda "atrapado" por reviews viejas

**Mitigación:**
- UI muestra "últimas 10 reviews" con filtro temporal (cliente puede ver solo reviews 2026)
- Profesional puede contactar admin para eliminar reviews MUY viejas (>2 años) si demuestran mejora

**Veredicto:** ✅ **RECOMENDADO MVP** — Simplicidad > edge case optimización.

---

#### Opción B: Weighted Average por Recency 🟡
**Cálculo:**
```sql
-- Reviews <6 meses: peso 1.5x
-- Reviews 6-12 meses: peso 1.0x
-- Reviews >2 años: peso 0.5x

SELECT 
  SUM(
    rating * CASE
      WHEN created_at > NOW() - INTERVAL '6 months' THEN 1.5
      WHEN created_at > NOW() - INTERVAL '2 years' THEN 1.0
      ELSE 0.5
    END
  ) / SUM(
    CASE
      WHEN created_at > NOW() - INTERVAL '6 months' THEN 1.5
      WHEN created_at > NOW() - INTERVAL '2 years' THEN 1.0
      ELSE 0.5
    END
  ) AS weighted_rating
FROM reviews
WHERE reviewed_id = :userId;
```

**Pros:**
- Reviews recientes reflejan mejor calidad actual

**Cons:**
- ❌ **Complejidad SQL:** Requiere función custom (no AVG simple)
- ❌ **Recalcular histórico:** Al cambiar pesos (ajustar 6 meses → 3 meses), todos ratings cambian
- ❌ **UX confusa:** Cliente no entiende por qué rating cambió sin reviews nuevas (aging de pesos)

**Veredicto:** 🟡 **Post-PMF** — Solo implementar si hay queja recurrente "no puedo resetear reputación".

---

### 3.7 Moderación: Filtro Automático vs Manual

**Contexto:** ¿Cómo prevenir reviews con insultos, difamación, amenazas?

#### Opción A: Filtro Palabras Ofensivas Automático 🔴
**Implementación:**
```typescript
const badWords = ['idiota', 'estafador', 'ladrón', 'puto', ...];
const containsBadWord = badWords.some(word => comment.toLowerCase().includes(word));

if (containsBadWord) {
  return res.status(400).json({ error: 'Review contains inappropriate language' });
}
```

**Pros:**
- Previene reviews obviamente tóxicas

**Cons:**
- ❌ **Falsos positivos:** "Este tipo es un crack, lo re-comiendo" (blocked por "crack"? "tipo"?)
- ❌ **Evasión fácil:** "est4fad0r", "l a d r ó n" bypass filtro
- ❌ **Mantenimiento:** Lista debe actualizarse constantemente (slang argentino cambia)

**Veredicto:** ❌ **NO MVP** — Más problemas que soluciones.

---

#### Opción B: Botón "Reportar Review" + Admin Manual ✅
**Flujo:**
- Cualquier usuario ve review → botón "Reportar inapropiada"
- Modal: textarea motivo (obligatorio)
- Backend crea `review_reports` (review_id, reporter_id, reason)
- Admin recibe notificación → revisa manualmente → decisión: eliminar comment (mantener rating) o rechazar reporte

**Pros:**
- ✅ **Flexibilidad:** Contexto humano (admin entiende sarcasmo, jerga, falsos positivos)
- ✅ **Menos false positives:** Filtro social (solo reviews realmente problemáticas son reportadas)
- ✅ **Simple MVP:** No requiere ML, NLP, lista palabras

**Cons:**
- Requiere admin activo (Fase 6)

**Implementación:**
```typescript
router.post('/reviews/:reviewId/report', requireAuth, async (req, res) => {
  const { reviewId } = req.params;
  const { reason } = req.body;
  const reporterId = req.userId;
  
  if (!reason || reason.length < 10) {
    return res.status(400).json({ error: 'Reason required (min 10 chars)' });
  }
  
  const report = await prisma.reviewReport.create({
    data: {
      review_id: parseInt(reviewId),
      reporter_id: reporterId,
      reason,
    },
  });
  
  // Notificar admin (Slack/email)
  await notifyAdmin({
    title: '⚠️ Review reportada',
    body: `Review #${reviewId} fue reportada por ${reason.substring(0, 50)}...`,
    link: `/admin/review-reports/${report.id}`,
  });
  
  res.json({ message: 'Report submitted. Admin will review within 48 hours.' });
});
```

**Veredicto:** ✅ **RECOMENDADO** — Balance eficacia vs complejidad.

---

## 4. Affected Areas

### Backend (Node.js + Express + Prisma):
- **`src/routes/reviews.ts`** — Nuevo archivo: POST /reviews, GET /users/:id/reviews, POST /reviews/:id/report
- **`src/middleware/validators.ts`** — Validar rating 1-5, comment max 500 chars
- **`src/services/reviewService.ts`** — Lógica validación appointment completado, ventana temporal
- **`src/services/notificationService.ts`** — Enviar push "Nueva calificación", "Califica tu experiencia"
- **`prisma/migrations/`** — Create tables `reviews`, `review_disputes`
- **`prisma/schema.prisma`** — Modelos Review, ReviewDispute

### Database (PostgreSQL):
- **Nueva tabla `reviews`** con UNIQUE constraint, indexes, trigger update rating
- **Nueva tabla `review_disputes`** (preparación Fase 6)
- **Trigger `update_user_rating()`** — Recalcula AVG rating al insertar review

### Frontend (React Native):
- **`screens/AppointmentDetailsScreen.tsx`** — Botón "Calificar" (disabled si >30 días o ya calificó)
- **`components/ReviewModal.tsx`** — Nuevo modal: selector estrellas + textarea comment
- **`screens/ProfessionalProfileScreen.tsx`** — Listar reviews con paginación + filtro rating
- **`components/RatingStars.tsx`** — Componente reutilizable mostrar estrellas
- **`components/RatingDistribution.tsx`** — Gráfico barras "X% 5★, X% 4★..."

### Cronjobs:
- **`src/jobs/sendReviewReminders.ts`** — Diario: enviar push día 3 y día 7 si no dejó review
- **`src/jobs/cleanupExpiredReviews.ts`** — (Opcional) Marcar appointments fuera ventana 30 días

---

## 5. Implementation Approach

### Bloque 1: Crear Review Post-Completion (Semana 1)
**Tasks:**
1. Crear migration tabla `reviews` + trigger `update_user_rating()`
2. Endpoint POST /api/reviews con validaciones (appointment completed, ventana 30 días, UNIQUE constraint)
3. Frontend: botón "Calificar" en AppointmentDetailsScreen (solo si completed + <30 días)
4. Modal ReviewModal.tsx (selector estrellas obligatorio, textarea opcional)
5. Notificación push a reviewed ("X te dejó Y estrellas")
6. Testing: crear review, validar UNIQUE constraint, verificar trigger actualiza `users.rating`

### Bloque 2: Visualizar Reviews en Perfil (Semana 2)
**Tasks:**
7. Endpoint GET /api/users/:userId/reviews (paginación cursor, filtro rating)
8. Frontend: ProfessionalProfileScreen lista reviews con RatingStars component
9. Componente RatingDistribution.tsx (stats "X% 5★, X% 4★...")
10. Ordenar profesionales en búsqueda por rating DESC (secondary sort después distancia)
11. Testing: paginación, filtro rating=5, rating=1-2, stats distribución correctas

### Bloque 3: Reminder Notificaciones (Semana 3)
**Tasks:**
12. Cronjob `sendReviewReminders.ts` diario
13. Buscar appointments completados hace 3 días sin review → push "Califica tu experiencia"
14. Buscar appointments completados hace 7 días sin review → push final reminder
15. Deshabilitar reminders si ambos ya dejaron review
16. Frontend: deshabilitar botón "Calificar" si >30 días (tooltip "Plazo vencido")
17. Testing: mockear dates, verificar reminders día 3 y día 7, verificar botón disabled después 30 días

### Bloque 4: Apelación Reviews Negativas (Semana 3)
**Tasks:**
18. Crear migration tabla `review_disputes`
19. Botón "Reportar review" visible solo si rating ≤ 2
20. Modal: textarea motivo (min 20 chars) + upload evidencia opcional
21. Endpoint POST /api/review-disputes
22. Notificación admin (email/Slack) con link al dispute
23. UI placeholder "Disputa en revisión" (NO implementar resolución admin, eso es Fase 6)
24. Testing: crear disputa, validar notificación admin, verificar UNIQUE constraint (1 disputa por review)

---

## 6. Risks and Mitigations

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|-----------|
| **Review bombing** (bots dejan 100 reviews 5★ fake) | Baja | Crítico | UNIQUE constraint `appointment_id` + validación payment completed bloquea completamente. Bots tendrían que pagar ARS 1000+ por review = no escalable. |
| **Retaliation reviews** (profesional da 1★ vengativo) | Media | Alto | Admin puede eliminar reviews retaliatorias (Fase 6). Opción B: migrar a blind reviews post-PMF si es problema recurrente. |
| **Extorsión** (profesional amenaza cliente) | Baja | Alto | Botón "Reportar extorsión" en modal review. Admin investiga → ban permanente si confirmado. |
| **Comment abuse** (insultos, difamación) | Media | Medio | Botón "Reportar review inapropiada" → admin manual (Fase 6). NO filtro automático (falsos positivos). |
| **Cliente nunca deja review** (50% ignoran reminders) | Alta | Bajo | Esperado (industria ~30% review rate). Reminders día 3 y 7 ayudan. Incentivo futuro: descuento 5% si dejó review (Fase 7+). |
| **Trigger performance** (AVG query lento con 1000 reviews) | Baja | Medio | INDEX en `reviewed_id` garantiza O(n) rápido. Profesional con 1000 reviews → AVG ~20ms. Cachear `users.rating` en Redis si >5000 reviews (post-PMF). |

---

## 7. Recommendation

**Implementar Fase 5 con esta arquitectura:**

### ✅ Decisiones Confirmadas:
1. **Timing:** Solo después `appointment.status='completed'` AND `payment.status='completed'`
2. **Ventana temporal:** 30 días después scheduled_date
3. **Blind reviews:** NO (reviews públicas inmediatas en MVP)
4. **Rating cálculo:** Trigger automático AFTER INSERT, simple AVG
5. **Rating default:** NULL (mostrar "Sin calificaciones")
6. **Moderación:** Botón "Reportar" + admin manual (NO filtro automático)
7. **Reminder:** Push día 3 y día 7 si no dejó review

### 🟡 Decisiones Post-PMF (NO implementar ahora):
- Blind reviews (solo si hay evidencia retaliation abuse)
- Weighted average por recency (solo si queja recurrente "no puedo resetear reputación")
- Filtro palabras ofensivas automático (demasiados falsos positivos)

### Próximos Pasos:
1. **Fase 5 Proposal:** Escribir propuesta formal con scope definitivo
2. **Fase 5 Spec:** Detallar requirements funcionales + API contract + scenarios Gherkin
3. **Fase 5 Design:** Arquitectura técnica detallada + diagramas flujo + decisiones DB
4. **Fase 5 Tasks:** Breakdown granular tasks + estimaciones

**Ready for Proposal:** ✅ YES
