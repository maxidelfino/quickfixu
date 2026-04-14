# Proposal: Fase 4 - Payments & Appointments

**Change:** `fase-4-payments-appointments`  
**Date:** Marzo 2026  
**Status:** Proposal  
**Timeline:** 18-21 días (3-4 semanas)  
**Complexity:** MUY ALTA (integración financiera crítica)

---

## Intent

Implementar **el core de monetización de QuickFixU**: sistema completo de pagos seguros con MercadoPago + appointments (trabajos agendados) con confirmación mutua, escrow, reprogramaciones, penalizaciones y payout automático.

**Problema que resuelve:**  
Actualmente clientes aceptan propuestas pero NO pueden pagar — el marketplace NO genera revenue. Profesionales trabajan sin garantía de cobro. Fase 4 cierra el loop transaccional completo.

**Por qué es crítico:**  
Sin esta fase, QuickFixU es solo un "tablón de anuncios" sin modelo de negocio. Esta es la fase de mayor riesgo legal/financiero del MVP (manejo de dinero real, compliance PCI, AFIP).

---

## Scope

### In Scope

**Bloque 1: Integración MercadoPago Base**
- Crear preferencia de pago cuando cliente acepta propuesta (Checkout Pro)
- Webview redirect React Native con deep links
- Webhook handler IPN con firma HMAC-SHA256
- Idempotencia webhook (UNIQUE INDEX `mercadopago_payment_id`)
- Estados payment: `pending`, `completed`, `failed`, `refunded`, `disputed`

**Bloque 2: Appointments & Confirmación Mutua**
- Crear appointment automáticamente cuando payment.status='completed'
- Tabla `appointment_confirmations` (client_confirmed, professional_confirmed independientes)
- UI "Marcar trabajo completado" para ambas partes
- Trigger automático cuando ambos confirman → payment.payout_status='ready'
- Notificaciones push confirmación

**Bloque 3: Escrow & Payout Automático**
- Retención pago en cuenta QuickFixU hasta confirmación mutua
- Cronjob cada hora: buscar payments ready → payout MP API
- Timeout auto-release: 7 días sin confirmación cliente → auto-confirmar + payout
- Notificaciones preventivas días 5, 6, 7

**Bloque 4: Comisiones Variables**
- Cálculo runtime: 0% (tarjeta + <1 año), 10% (default), 50% (sin tarjeta)
- Snapshot comisión en payment (immutable, auditoría AFIP)
- Transparencia UI checkout ("Comisión 0% - Promoción Año 1")

**Bloque 5: Reprogramaciones**
- Máximo 2 reprogramaciones por appointment
- Modal solicitar reprogramación (fecha/hora + motivo)
- Aceptar/rechazar con notificación push
- UI warning "Última reprogramación permitida" en segunda

**Bloque 6: Cancelaciones & Penalizaciones**
- Penalty 15% si cancela después de 2 reprogramaciones
- Si profesional cancela → refund (amount - 15%) a cliente
- Si cliente cancela → payout 15% a profesional
- Actualizar appointment.status, penalty_applied, cancellation_reason

**Bloque 7: Pagos Efectivo + Balances**
- Opción "Pagar en efectivo" (solo si profesional tiene tarjeta)
- Payment con `payment_method='cash'`, `status='pending'`
- Al confirmar trabajo → actualizar balance profesional (deuda)
- Cronjob fin de mes: cobrar tarjeta profesional por balance negativo
- Bloquear profesional si pago falla (>30 días impago)

**Bloque 8: Disputas (Preparación Fase 6)**
- Botón "Reportar problema" (activo hasta 48hs post-trabajo)
- Modal evidencia (textarea + upload fotos)
- Actualizar payment.status='disputed', bloquear payout automático
- Notificación admin (email/Slack)
- UI placeholder "En disputa - Admin mediará"

**Bloque 9: Testing & Compliance**
- Sandbox MercadoPago (credenciales TEST, feature flag)
- E2E tests: pago → webhook → confirmar → payout (todo sandbox)
- Export CSV mensual AFIP (payments completados + refundados)
- Logs detallados (Winston + Sentry)
- Alertas críticas: payout falla, webhook signature inválido, deuda >30 días

### Out of Scope

- ❌ MercadoPago Marketplace Split Payment (migrar post-PMF)
- ❌ Checkout API in-app (tokenización custom) — usar Checkout Pro
- ❌ Mediación admin de disputas (Fase 6)
- ❌ Múltiples métodos pago (solo MP + efectivo MVP)
- ❌ Subscripciones/membresías profesionales (Fase futura)
- ❌ Pagos recurrentes automáticos
- ❌ Integración con pasarelas alternativas (Stripe, PayPal)

---

## Approach

### High-Level Technical Approach

**1. Checkout Pro Webview (MercadoPago)**
- Simplicidad MVP: PCI compliance automático, 0 mantenimiento formularios frontend
- Cliente acepta propuesta → backend crea preferencia MP → frontend abre webview
- Deep links: `quickfixu://payment/{success|failure|pending}`
- MP redirige post-pago → cerrar webview, actualizar UI

**2. Escrow Manual (No Marketplace MVP)**
- Pago va a cuenta QuickFixU (no split payment)
- Guardar `mercadopago_payment_id` en payment
- Cuando ambos confirman → payout MP API a profesional
- Control total timing (confirmación, timeout, disputa)

**3. Webhook Security & Idempotencia**
- Validar firma HMAC-SHA256 (`x-signature` header)
- UNIQUE INDEX `payments.mercadopago_payment_id` → upsert
- Fetch payment desde API MP (NO confiar solo en body webhook)
- Log duplicados como warning (no error)

**4. Confirmación Mutua + Timeout**
- Tabla `appointment_confirmations` separada (escalable)
- Trigger DB: cuando ambos confirman → payment.payout_status='ready'
- Cronjob diario (3am): buscar `auto_release_date < NOW()` → auto-confirmar cliente
- Notificaciones preventivas días 5, 6, 7

**5. Comisión Snapshot (No Recalcular)**
- Función `calculateCommission()` centralizada
- Al crear payment: guardar `commission_percentage`, `commission_amount`, `net_amount`
- Histórico immutable (si reglas cambian, payments viejos mantienen snapshot)
- Auditoría AFIP completa

**6. Balance Negativo (Pagos Efectivo)**
- Validar profesional tiene `credit_card_token` (sin tarjeta = NO efectivo)
- Al confirmar trabajo cash → `balance.balance -= commission`
- Cronjob día 1 del mes: cobrar tarjeta profesional por balance negativo
- Si falla → `is_blocked_for_debt=true`

---

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/routes/payments.ts` | New | Endpoints crear preferencia, webhook handler, payout cronjob |
| `backend/src/services/mercadopago.ts` | New | SDK MP: crear preferencia, validar firma, fetch payment, payout |
| `backend/src/services/commission.ts` | New | Cálculo comisiones variables (0%/10%/50%) |
| `backend/src/cron/payout.ts` | New | Cronjob cada hora: procesar payouts ready |
| `backend/src/cron/autoRelease.ts` | New | Cronjob diario: auto-release appointments expirados |
| `backend/src/cron/balances.ts` | New | Cronjob fin de mes: cobrar balances negativos |
| `backend/prisma/schema.prisma` | Modified | Agregar tablas: payments, appointments, appointment_confirmations, balances, disputes, refunds |
| `backend/prisma/migrations/` | New | 6 migraciones (payments, appointments, confirmations, balances, disputes, refunds) |
| `mobile/src/screens/CheckoutScreen.tsx` | New | Webview Checkout Pro, deep links, loading states |
| `mobile/src/screens/AppointmentDetailsScreen.tsx` | Modified | Botones: confirmar trabajo, reprogramar, cancelar, reportar problema |
| `mobile/src/services/payments.ts` | New | API calls: create-preference, confirm-appointment, reschedule, cancel |
| `mobile/src/navigation/linking.ts` | Modified | Deep links: quickfixu://payment/{success|failure|pending} |
| `.env` | Modified | MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, USE_SANDBOX |

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **Webhook duplicado crea 2 payments** | Alta | UNIQUE INDEX `mercadopago_payment_id`, upsert, log duplicados (no error) |
| **Webhook falso (atacante forja petición)** | Media | Signature verification HMAC-SHA256, rechazar sin firma válida, alertas Sentry |
| **Payout falla (API MP rechaza)** | Media | Retry 3 veces (exp backoff), payment.payout_status='failed', alerta admin urgente |
| **Race condition confirmación mutua** | Baja | Lock optimista WHERE `appointment.status='scheduled'`, rollback si falla |
| **Timeout auto-release error (cliente pierde control)** | Baja | Notificaciones preventivas días 5-7, admin puede extender manualmente, botón "Reportar" activo 48hs |
| **Deuda balance crece sin control** | Media | Límite máximo ARS 20K, bloquear profesional si excede, plan pagos manual admin |
| **Sandbox contamina producción** | Alta (dev error) | Feature flag `USE_SANDBOX`, tabla `sandbox_payments` separada, banner UI "MODO PRUEBA" |
| **AFIP auditoría datos incompletos** | Baja | Export CSV todos campos obligatorios (DNI, fecha, monto, comisión), soft delete 10 años |
| **Cliente reporta disputa post-payout** | Media | Bloquear botón "Reportar" post-payout (grayed out), refund manual admin |

---

## Rollback Plan

### Escenario 1: Bug Crítico Post-Deploy (Payments Duplicados, Webhooks Fallan)

**Rollback Inmediato:**
1. Feature flag `DISABLE_PAYMENTS=true` → deshabilitar botón "Pagar" en UI (mostrar banner "Temporalmente en mantenimiento")
2. Rollback deploy backend a versión anterior
3. Mantener webhook endpoint activo (solo log, no procesar) para no perder notificaciones MP
4. Queue webhooks en Redis para reprocesar después de fix

**Restauración:**
1. Fix bug en staging con tests E2E
2. Deploy fix a producción
3. Reprocesar webhooks queueados
4. Feature flag `DISABLE_PAYMENTS=false`

### Escenario 2: Pérdida Datos Críticos (Payments/Appointments Borrados)

**Restauración:**
1. Restore DB desde último snapshot (backups cada 6 horas)
2. Replay webhooks MP desde log (idempotencia asegura sin duplicados)
3. Validar integridad: COUNT payments = COUNT appointments (1-to-1)
4. Notificar usuarios afectados (email + push)

### Escenario 3: MercadoPago API Down >4 Horas

**Mitigación:**
1. Banner UI: "Procesamiento pagos demorado - Tu pago está seguro"
2. Queue create-preference requests en Redis (retry cada 15min)
3. Email cliente: "Pago pendiente, recibirás notificación cuando se confirme"
4. Contacto directo MP soporte empresarial

---

## Dependencies

**Externas:**
- MercadoPago cuenta activa (credenciales producción + test)
- Webhook URL configurada en panel MercadoPago: `https://api.quickfixu.com/webhooks/mercadopago`
- Secret HMAC-SHA256 webhook (obtener desde panel MP)
- Tarjetas de prueba MP para testing sandbox

**Internas:**
- ✅ Fase 3 completada (chat en tiempo real ya funcional)
- ✅ Tabla `proposals` con `price`, `scheduled_date`, `scheduled_time`, `status`
- ✅ FCM push notifications infrastructure
- ✅ JWT auth + roles (client/professional)
- ✅ Sentry error tracking configurado
- ✅ Winston logs configurado

**Técnicas:**
- `@mercadopago/sdk-nodejs` (latest)
- `node-cron` (cronjobs)
- Prisma ORM (migraciones)
- React Native WebView

---

## Success Criteria

### Technical
- [ ] Webhook latency <500ms (p95)
- [ ] Payout success rate >98%
- [ ] Payment creation success rate >99%
- [ ] 0 webhooks con signature inválida aceptados
- [ ] 0 payments duplicados por mismo `mercadopago_payment_id`
- [ ] 100% payments exportables a CSV AFIP (campos completos)

### Business
- [ ] Payment completion rate >85% (clientes que llegan a checkout y pagan)
- [ ] Mutual confirmation rate >90% (ambos confirman dentro de 7 días)
- [ ] Auto-release rate <10% (idealmente ambos confirman antes de timeout)
- [ ] Cancellation rate <5% (con penalty aplicado)
- [ ] Dispute rate <2% (reportes problemas)

### Security
- [ ] 100% webhooks con signature HMAC-SHA256 válida
- [ ] 0 datos sensibles (tokens, CVV) en logs
- [ ] PCI compliance automático (Checkout Pro)
- [ ] Rate limiting webhooks: 100 req/min por IP

### User Experience
- [ ] Checkout completo en <60 segundos (desde aceptar propuesta hasta payment.status='completed')
- [ ] Notificación push payout liberado <1 hora después confirmación mutua
- [ ] UI transparencia comisión mostrada SIEMPRE antes de pagar
- [ ] 0 quejas usuarios "no sabía que había comisión"

---

## Open Questions (Resolver Pre-Implementation)

1. **Credenciales MercadoPago:**
   - ¿Ya tienen cuenta MP creada?
   - ¿Access token producción + test disponibles?
   - ¿Configuraron webhook URL en panel MP?

2. **Límite Deuda Balance:**
   - ¿ARS 20K es razonable o ajustar?
   - ¿Qué hacer si profesional con ARS 50K deuda (plan pagos, perdón parcial)?

3. **Timeout Auto-Release:**
   - ¿7 días es suficiente o extender a 10/14?
   - ¿Notificaciones día 5-6-7 o más frecuente?

4. **Penalty Cancelación:**
   - ¿15% es adecuado o ajustar (10%, 20%)?
   - ¿Permitir cancelación gratis hasta X horas antes (ej: 24hs)?

5. **Pagos Efectivo:**
   - ¿Habilitar desde MVP o solo post-año 1?
   - ¿Mostrar en UI desde día 1 (grayed out) o ocultar completamente?

6. **Testing:**
   - ¿Quién provee tarjetas de prueba MP?
   - ¿Ambiente staging con BD separada o feature flag en producción?

---

## Next Steps

1. **Resolver Open Questions** → confirmar parámetros con stakeholders
2. **Create Spec** (`fase-4-spec.md`) → requirements detallados por feature
3. **Create Design** (`fase-4-design.md`) → arquitectura técnica, diagramas, DB schema
4. **Create Tasks** (`fase-4-tasks.md`) → breakdown 9 bloques en subtareas implementables
5. **Implementation** → 8 milestones (Semana 1-8)
6. **Verification** → E2E tests, security audit, AFIP compliance check

---

**Approved:** ⏳ Pending  
**Next Phase:** `sdd-spec` (Specifications)  
**Estimated Effort:** 18-21 días  
**Risk Level:** 🔴 MUY ALTO (integración financiera crítica)
