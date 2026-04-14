# Proposal: Fase 5 - Reviews & Ratings

**Change:** `fase-5-reviews-ratings`  
**Date:** Marzo 2026  
**Status:** Proposal  
**Timeline:** 8-10 días (1.5-2 semanas)  
**Complexity:** BAJA-MEDIA (modelo simple, reglas negocio críticas)

---

## Intent

Implementar **el sistema de reputación bidireccional de QuickFixU**: clientes y profesionales pueden calificar y dejar reviews después de completar un trabajo. Este es el **núcleo de confianza del marketplace**.

**Problema que resuelve:**  
Actualmente clientes no pueden evaluar calidad de profesionales contratados. Profesionales buenos no se diferencian de malos. Sin reputación verificable, **clientes no confían en contratar desconocidos** y profesionales no pueden demostrar excelencia.

**Por qué es crítico:**  
Marketplaces sin sistema de reviews tienen tasa de conversión <10% (nadie confía en extraños sin historial). Reviews aumentan conversión >40% según estudios Airbnb/Uber. Esta es **la fase que diferencia QuickFixU de competencia** (mayoría NO tiene reviews verificadas post-trabajo).

---

## Scope

### In Scope

**Bloque 1: Crear Review Post-Completion**
- Botón "Calificar" visible en appointment SOLO si `status='completed'` AND `payment.status='completed'`
- Validar que reviewer NO haya dejado review aún (UNIQUE constraint)
- Validar ventana temporal 30 días desde `scheduled_date`
- Modal rating: selector estrellas 1-5 (obligatorio) + textarea comment (opcional, max 500 chars)
- Guardar review en tabla `reviews` con `appointment_id`, `reviewer_id`, `reviewed_id`, `rating`, `comment`
- Trigger automático actualiza `users.rating` (AVG de todas reviews recibidas)
- Notificación push a reviewed: "X te dejó una calificación de Y estrellas"

**Bloque 2: Visualizar Reviews en Perfil**
- Endpoint GET /api/users/:userId/reviews (público, no requiere auth)
- Paginación cursor-based con `created_at` + `id` (20 reviews/página)
- Filtro query param `?rating=5` (solo 5 estrellas) o `?rating=1-2` (solo 1-2 estrellas)
- Mostrar reviewer name + foto + fecha + rating + comment
- Ordenar por `created_at DESC` (más recientes primero)
- Incluir stats distribución: `{ "5_stars": 65, "4_stars": 20, "3_stars": 10, "2_stars": 3, "1_star": 2 }`

**Bloque 3: Rating Promedio en Cards/Listados**
- Mostrar `users.rating` + `users.rating_count` en:
  - Card profesional en búsqueda (GET /api/professionals/search)
  - Card propuesta recibida (GET /api/posts/:postId/proposals)
  - Perfil público profesional (GET /api/users/:userId)
- UI diferencia `rating = NULL` (sin calificaciones) vs `rating = 2.0` (calificación baja)
- Ordenar profesionales en búsqueda por rating DESC como secondary sort (primary: distancia)

**Bloque 4: Reminder Notificaciones**
- Cronjob diario busca appointments completados hace 3 días sin review → envía push "Califica tu experiencia con X"
- Cronjob diario busca appointments completados hace 7 días sin review → envía push final "Tienes Y días para calificar a X"
- Si ambos (cliente + profesional) ya dejaron review → no enviar reminders
- Después 30 días, deshabilitar botón "Calificar" (tooltip: "Plazo vencido")

**Bloque 5: Apelación Reviews Negativas (Preparación Fase 6)**
- Botón "Reportar review" visible solo si `rating <= 2` (reviews 1-2 estrellas)
- Modal: textarea motivo (obligatorio, min 20 chars) + opcional evidencia (fotos/PDFs)
- Crear registro tabla `review_disputes` (review_id, disputer_id, reason, evidence_urls, status='open')
- Notificación admin (email/Slack) con link al dispute
- UI placeholder "Disputa en revisión - Admin responderá en 48hs"
- **NO implementar mediación:** Admin panel + resolución son Fase 6

**Bloque 6: Moderación y Seguridad**
- Validar `rating` es integer 1-5 (rechazar 0, 6, null)
- Validar `comment` max 500 chars (truncar o rechazar)
- Sanitizar HTML en comment (escapar `<script>`, `<iframe>` para evitar XSS)
- Rate limit: max 1 review cada 10 segundos por usuario (evita spam accidental double-tap)
- Log todas las reviews creadas (auditoría admin, detectar patrones abuse)

### Out of Scope

- ❌ Blind reviews (ambos envían sin ver la del otro) — simplicidad MVP, implementar post-PMF si hay retaliation abuse
- ❌ Weighted average por recency (reviews recientes pesan más) — complejidad SQL alta, post-PMF si queja recurrente
- ❌ Filtro palabras ofensivas automático — falsos positivos, evasión fácil (typos), dejar para admin manual Fase 6
- ❌ Respuesta pública a reviews — evita flame wars, solo admin puede eliminar reviews inapropiadas
- ❌ Editar review post-submit — evita manipulación (profesional amenaza → cliente cambia 1★ a 5★)
- ❌ Reviews anónimas — transparencia > anonimato, nombre visible desincentiva calumnias
- ❌ Mediación admin de disputas — implementar en Fase 6 con admin panel completo

---

## Approach

### High-Level Technical Approach

**1. Review Timing (Post-Completion Only)**
- Garantizar integridad: review solo si `appointment.status='completed'` AND `payment.status='completed'`
- UNIQUE constraint `(appointment_id, reviewer_id)` bloquea duplicados
- Validación aplicación: reviewer debe ser participant del appointment (cliente o profesional)
- Ventana temporal 30 días: balance flexibilidad vs recencia (standard industria: Airbnb 14 días, Uber/TaskRabbit 30 días)

**2. Rating Calculation (Trigger Automático)**
- Trigger `AFTER INSERT ON reviews` recalcula AVG rating + COUNT
- SQL nativo simple: `UPDATE users SET rating = AVG(reviews.rating), rating_count = COUNT(*)`
- Performance: INDEX en `reviewed_id` garantiza O(n) rápido (<20ms con 1000 reviews)
- Rating default NULL (profesionales nuevos mostrar "Sin calificaciones aún" vs "0.0 estrellas")

**3. Paginación Cursor-Based (Escalable)**
- No OFFSET/LIMIT (performance degrada con páginas grandes)
- Cursor: `?cursor={created_at}_{id}&limit=20`
- Next page: `WHERE (created_at, id) < (cursor_created_at, cursor_id) ORDER BY created_at DESC`
- Consistente incluso si reviews nuevas se crean durante navegación

**4. Reminders Inteligentes (2 notificaciones solo)**
- Cronjob diario 3am: buscar `scheduled_date = NOW() - 3 days` sin review → push reminder
- Cronjob diario 3am: buscar `scheduled_date = NOW() - 7 days` sin review → push final reminder
- No spam: solo 2 notificaciones totales (día 3 y día 7)
- Stop reminders si ambos ya calificaron (consulta reviews existentes)

**5. Abuse Prevention (UNIQUE Constraint + Validaciones)**
- Review fake imposible: requiere appointment real (pago MercadoPago mínimo ARS 1000+)
- Review bombing bloqueado: UNIQUE constraint `appointment_id` = max 2 reviews por trabajo (cliente + profesional)
- XSS prevention: sanitizar HTML en comment antes guardar
- Rate limit: max 1 review cada 10 segundos (evita accidental double-tap submit)

**6. Dispute Preparation (Tabla + Endpoint, NO Mediación)**
- Crear tabla `review_disputes` con foreign keys reviews + users
- Endpoint POST /api/review-disputes guarda disputa + notifica admin
- UI muestra "En revisión" pero NO implementar panel admin (Fase 6)
- Preparación arquitectura para mediación futura sin bloquear MVP

---

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/routes/reviews.ts` | New | Endpoints: POST /reviews, GET /users/:id/reviews, POST /reviews/:id/report |
| `backend/src/middleware/validators.ts` | Modified | Validar rating 1-5, comment max 500 chars, sanitizar HTML |
| `backend/src/services/reviewService.ts` | New | Lógica validación appointment completado, ventana temporal 30 días |
| `backend/src/services/notificationService.ts` | Modified | Push "Nueva calificación", "Califica tu experiencia" reminders |
| `backend/src/cron/reviewReminders.ts` | New | Cronjob diario envía reminders día 3 y día 7 |
| `backend/prisma/schema.prisma` | Modified | Modelos Review, ReviewDispute |
| `backend/prisma/migrations/` | New | Create tables `reviews`, `review_disputes`, trigger `update_user_rating()` |
| `mobile/src/screens/AppointmentDetailsScreen.tsx` | Modified | Botón "Calificar" (disabled si >30 días o ya calificó) |
| `mobile/src/components/ReviewModal.tsx` | New | Modal: selector estrellas + textarea comment |
| `mobile/src/screens/ProfessionalProfileScreen.tsx` | Modified | Listar reviews con paginación + filtro rating + stats distribución |
| `mobile/src/components/RatingStars.tsx` | New | Componente reutilizable mostrar estrellas (0.0 - 5.0) |
| `mobile/src/components/RatingDistribution.tsx` | New | Gráfico barras "X% 5★, X% 4★, X% 3★..." |
| `mobile/src/services/reviews.ts` | New | API calls: createReview, getUserReviews, reportReview |

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **Review bombing** (bots dejan 100 reviews 5★ fake) | Baja | UNIQUE constraint `appointment_id` + validación payment completed bloquea completamente. Crear review fake requiere pago real MercadoPago (ARS 1000+ mínimo) = no escalable. Admin puede detectar patrones (50 reviews en 1 día = sospechoso). |
| **Retaliation reviews** (profesional deja 1★ vengativo porque cliente le dio 1★) | Media | Admin puede eliminar reviews claramente retaliatorias (texto "me calificó mal así que le doy lo mismo"). Post-PMF: implementar blind reviews si es problema recurrente (medir: % reviews con mismo rating bidireccional). |
| **Extorsión** (profesional amenaza cliente: "Si no me das 5★, te doy 1★") | Baja | Botón "Reportar extorsión" en modal review. Si cliente reporta antes de enviar review → admin investiga. Si confirmado → ban permanente profesional + eliminar review del profesional. |
| **Review fake positivas** (amigos/familiares dejan 5★ sin trabajo real) | Baja | UNIQUE constraint en appointment_id bloquea completamente (no puede haber review sin trabajo). Para dejarse review fake, necesitarían crear post → proposal → pago → appointment → confirmar = ARS 1000+ mínimo. No escalable. |
| **Comment abuse** (insultos, difamación, amenazas en texto review) | Media | Botón "Reportar review inapropiada" (cualquier usuario puede reportar). Admin revisa manualmente (Fase 6). Si confirma violación términos → eliminar comment (mantener rating). Filtro palabras ofensivas automático en Fase 7+ (muchos falsos positivos). |
| **Cliente no deja review nunca** (50% clientes ignoran reminders) | Alta | Esperado (industria promedio ~30% review rate). Reminders día 3 y 7 ayudan. Incentivo futuro: descuento 5% próximo servicio si dejó review (Fase 7+). No bloquear MVP por esto. |
| **Trigger performance** (AVG query lento con 1000 reviews) | Baja | INDEX en `reviewed_id` garantiza O(n) rápido. Profesional con 1000 reviews → AVG ~20ms. Cachear `users.rating` en Redis si >5000 reviews (post-PMF). |
| **Race condition** (cliente deja review mientras admin elimina appointment) | Baja | Lock transaccional: validar `appointment.status='completed'` en mismo WHERE al INSERT review. Si appointment cambió → rollback, error "Appointment modificado, refresca pantalla". |

---

## Rollback Plan

### Escenario 1: Bug Crítico Post-Deploy (Trigger Rompe DB, Reviews Duplicadas)

**Rollback Inmediato:**
1. Feature flag `DISABLE_REVIEWS=true` → deshabilitar botón "Calificar" en UI (mostrar banner "Sistema de calificaciones en mantenimiento")
2. Rollback migration que creó trigger `update_user_rating()` (solo si trigger causa deadlocks)
3. Mantener tabla `reviews` intacta (no borrar datos)
4. Recalcular `users.rating` manualmente con script si trigger falló

**Restauración:**
1. Fix bug en staging con tests E2E
2. Deploy fix a producción
3. Re-run migration trigger corregido
4. Validar integridad: COUNT reviews BY reviewed_id = users.rating_count
5. Feature flag `DISABLE_REVIEWS=false`

### Escenario 2: Pérdida Datos Críticos (Reviews Borradas Accidentalmente)

**Restauración:**
1. Restore DB desde último snapshot (backups cada 6 horas)
2. Re-run trigger `update_user_rating()` para recalcular todos ratings
3. Validar integridad: AVG manual vs users.rating (must match)
4. Notificar usuarios afectados (email + push "Sistema de reviews restaurado")

### Escenario 3: Abuse Masivo (Bot Deja 1000 Reviews Fake en 1 Hora)

**Mitigación:**
1. Identificar bot: query `SELECT reviewer_id, COUNT(*) FROM reviews WHERE created_at > NOW() - INTERVAL '1 hour' GROUP BY reviewer_id HAVING COUNT(*) > 10`
2. Soft-delete todas reviews del bot: `UPDATE reviews SET deleted_at = NOW() WHERE reviewer_id = :botId`
3. Recalcular rating de todos `reviewed_id` afectados (trigger automático al soft-delete si implementado, sino script manual)
4. Ban permanente usuario bot: `UPDATE users SET is_banned = true WHERE id = :botId`
5. Rate limit más agresivo: 1 review cada 60 segundos (vs 10 segundos actual)

---

## Dependencies

**Internas:**
- ✅ Fase 4 completada (appointments + payments funcionando)
- ✅ Tabla `appointments` con `status='completed'`
- ✅ Tabla `payments` con `status='completed'`
- ✅ Tabla `users` con campos `rating DECIMAL(3,2)` y `rating_count INTEGER` (ya definidos en DataModel)
- ✅ FCM push notifications infrastructure
- ✅ JWT auth + roles (client/professional)

**Técnicas:**
- PostgreSQL trigger functions (PL/pgSQL)
- Prisma ORM (migraciones)
- React Native modal + star rating component
- HTML sanitization library (DOMPurify o equivalente backend)
- Cronjob scheduler (node-cron)

---

## Success Criteria

### Technical
- [ ] Trigger latency <50ms (p95) al insertar review
- [ ] GET /users/:id/reviews latency <200ms (p95) con 100 reviews
- [ ] Paginación cursor-based sin degradación performance en página 10+
- [ ] 0 reviews duplicadas (mismo appointment_id + reviewer_id)
- [ ] 0 XSS vulnerabilities en comment rendering
- [ ] 100% reviews auditables (log completo creación + modificación)

### Business
- [ ] Review submission rate >30% (% appointments completados con al least 1 review)
- [ ] Bilateral review rate >15% (% appointments con ambas reviews)
- [ ] Reminder open rate >40% (% usuarios que abren notificación reminder)
- [ ] Reminder conversion rate >20% (% usuarios que califican después de reminder)
- [ ] Dispute rate <2% (% reviews reportadas vs total reviews)
- [ ] Average rating distribution: 60% 5★, 20% 4★, 10% 3★, 7% 2★, 3% 1★ (healthy marketplace)

### User Experience
- [ ] Review submission completo en <30 segundos (desde click "Calificar" hasta confirmación)
- [ ] Notificación push "Nueva calificación" llega <10 segundos después review creada
- [ ] Stats distribución visible en perfil sin lag (cached o pre-calculado)
- [ ] UI diferencia clara "Sin calificaciones" (NULL) vs "Calificación baja" (2.0★)
- [ ] 0 quejas usuarios "no pude calificar" (si <30 días, botón debe funcionar)

---

## Open Questions (Resolver Pre-Implementation)

1. **Ventana Temporal:**
   - ¿30 días es suficiente o extender a 45/60?
   - ¿Qué pasa si trabajo tiene garantía extendida (ej: instalación eléctrica con garantía 90 días)?

2. **Reminders Frecuencia:**
   - ¿Día 3 y día 7 es adecuado o más frecuente (día 2-5-7)?
   - ¿Permitir usuario desactivar reminders reviews (opt-out)?

3. **Dispute Límite:**
   - ¿Solo reviews 1-2★ pueden ser reportadas o todas?
   - ¿Límite temporal para reportar (ej: 7 días post-review)?

4. **Rating Visibility:**
   - ¿Mostrar rating promedio desde primera review (N=1) o esperar mínimo 3 reviews (más confiable)?
   - ¿Cómo ordenar profesionales con mismo rating (4.5★) pero diferente cantidad (10 vs 100 reviews)?

5. **Comment Length:**
   - ¿500 caracteres es adecuado o reducir a 300 (más conciso)?
   - ¿Permitir saltos de línea en comment o todo single-line?

6. **Testing:**
   - ¿Cómo testear reminders cronjob sin esperar 3/7 días (mockar dates, override scheduled_date)?
   - ¿Crear reviews de prueba en staging con appointments reales o mock data?

---

## Next Steps

1. **Resolver Open Questions** → confirmar parámetros con stakeholders
2. **Create Spec** (`fase-5-spec.md`) → requirements detallados por feature + API contracts + Gherkin scenarios
3. **Create Design** (`fase-5-design.md`) → arquitectura técnica, diagramas ERD, DB schema completo, trigger logic
4. **Create Tasks** (`fase-5-tasks.md`) → breakdown 6 bloques en subtareas implementables con estimaciones
5. **Implementation** → 3-4 milestones (Semana 1-2)
6. **Verification** → E2E tests, abuse testing, performance testing (trigger + paginación)

---

**Approved:** ⏳ Pending  
**Next Phase:** `sdd-spec` (Specifications)  
**Estimated Effort:** 8-10 días  
**Risk Level:** 🟡 MEDIA (modelo simple, reglas negocio críticas para prevenir abuse)
