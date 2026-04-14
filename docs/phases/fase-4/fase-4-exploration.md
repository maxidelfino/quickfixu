# Exploration: Fase 4 - Payments & Appointments

**Change name:** `fase-4-payments-appointments`  
**Date:** Marzo 2026  
**Status:** Exploration Complete  
**Prerequisite:** Fase 3 (Chat en Tiempo Real) MUST be completed

---

## 1. Executive Summary

La Fase 4 implementa **EL CORE DEL NEGOCIO de QuickFixU**: pagos seguros con MercadoPago + sistema de appointments (trabajos agendados) con confirmación mutua, reprogramaciones y penalizaciones. Sin esta fase, el marketplace NO genera revenue — los clientes aceptan propuestas pero NO pagan, los profesionales trabajan sin garantía de cobro.

**Complejidad:** CRÍTICA — Esta es la fase de mayor riesgo legal y financiero del MVP. Involucra:
- Integración con pasarela de pagos externa (MercadoPago)
- Manejo de dinero real (compliance PCI, AFIP)
- Escrow/retención de fondos hasta confirmación mutua
- Cálculo de comisiones variable (0%, 10%, 50%)
- Penalizaciones por cancelación (15% del monto)
- Reprogramaciones limitadas (máximo 2)
- Payout automático a profesionales (API MercadoPago)
- Tracking de deudas para pagos en efectivo (balances)
- Timeout auto-release si cliente no confirma en 7 días
- Webhooks idempotentes (mismo pago puede notificarse múltiples veces)
- Testing riguroso con dinero de prueba (sandbox MercadoPago)

**Decisiones clave tomadas:**

| Decisión | Opción Seleccionada | Justificación |
|----------|---------------------|---------------|
| **Checkout MercadoPago** | Checkout Pro (redirect a webview MP) | Simplicidad MVP, PCI compliance automático, UI nativa MP, 0 mantenimiento frontend de formularios de tarjeta. Checkout API (in-app) requiere certificación PCI + tokenización compleja. |
| **Escrow (retención pago)** | NO usar Marketplace Split Payment. Guardar `mercadopago_payment_id` + hacer payout manual después confirmación | MP Marketplace requiere cuenta seller aprobada (proceso lento, burocracia). MVP retiene pago en cuenta QuickFixU, libera con payout cuando ambos confirman. Migrar a Split Payment post-PMF. |
| **Confirmación Mutua** | Tabla `appointment_confirmations` (client_confirmed, professional_confirmed) + trigger cuando AMBOS = true | Tracking explícito de quién confirmó. Cliente confirma "trabajo bien hecho", profesional confirma "trabajo completado". Solo cuando ambos = payout automático. |
| **Timeout Auto-Release** | 7 días desde `scheduled_date` sin confirmación cliente → auto-confirmar + payout profesional | Protege profesional de clientes fantasma. Notificación cliente días 5, 6, 7: "Confirma trabajo o se liberará pago automáticamente". Admin puede extender plazo en disputas. |
| **Webhook Idempotencia** | `mercadopago_payment_id` UNIQUE en tabla `payments` + upsert en webhook handler | MP puede enviar mismo webhook múltiples veces (retry). Upsert con WHERE `mercadopago_payment_id` evita duplicar payments. Validar firma HMAC-SHA256 de MP. |
| **Signature Verification** | Validar `x-signature` header con HMAC-SHA256 usando MP secret | Protege contra webhooks falsos (atacante no puede forjar firma sin secret). Rechazar webhooks sin firma válida (log + alert Sentry). |
| **Penalizaciones** | Descontar 15% de `payment.amount` al cancelar después de 2 reprogramaciones. Si profesional cancela → refund 15% a cliente. Si cliente cancela → payout 15% a profesional. | Desincentiva cancelaciones abusivas. 15% es suficientemente alto para importar, pero no confiscatorio (no bloquea 100%). Cliente/profesional pueden cancelar gratis si es dentro de primeras 2 reprogramaciones. |
| **Reprogramaciones** | Máximo 2 (`appointments.rescheduled_count <= 2`). Tercera = automáticamente dispara opción cancelar con penalty. | Balance flexibilidad vs abuse. 2 reprogramaciones cubren casos legítimos (emergencia, clima, enfermedad). Más de 2 = patrón problemático. |
| **Comisión Variable** | `commission_percentage` calculado en runtime: 0% si (tarjeta registrada AND <1 año desde created_at), 50% si sin tarjeta, 10% default | Incentivo alineado con PRD. Guardar `commission_percentage` snapshot en payment (auditoría, no recalcular histórico si cambian reglas). |
| **Pagos Efectivo** | Crear payment con `payment_method='cash'`, `status='pending'`. Al confirmar trabajo → payment.status='completed', balance.balance -= commission. Cronjob fin de mes cobra tarjeta profesional. | Permite pagos fuera de plataforma (realidad Argentina) pero captura comisión. Requiere tarjeta registrada (sin tarjeta = NO puede pagar efectivo). Bloquear profesional si deuda >30 días impaga. |
| **Payout Timing** | <24hs después de confirmación mutua. Cronjob cada hora busca payments con `status='completed'` AND `payout_status='pending'` AND ambos confirmaron. | Balance entre inmediatez (UX profesional) y seguridad (ventana para detectar fraude). 24hs es standard industria (Airbnb, Uber). |
| **Disputas** | Botón "Reportar problema" activo hasta 48hs después `scheduled_date`. Si reportado → payment.status='disputed', bloquear payout, notificar admin. | Fase 6 implementa mediación admin. Fase 4 solo bloquea flujo automático. Admin resuelve manualmente (refund, payout, split). |
| **Testing** | Sandbox MercadoPago (credenciales `TEST-xxx`). Tabla `sandbox_payments` separada para no contaminar producción. E2E tests con tarjetas de prueba MP. | Crítico: NO mezclar dinero real con sandbox. Feature flag `USE_SANDBOX` en backend. Frontend detecta via API response si está en sandbox (mostrar banner "MODO PRUEBA"). |
| **AFIP Compliance** | Guardar TODOS los campos de payment (amount, commission, net_amount, penalty) + timestamp para auditoría. Generar CSV exportable mensual. | Argentina requiere declaración de ingresos digitales. QuickFixU es responsable solidario con profesionales. Export CSV para contador: fecha, profesional DNI, monto bruto, comisión, neto. |
| **Refunds** | MercadoPago API `POST /v1/payments/{id}/refunds` (total o parcial). Actualizar payment.status='refunded', crear registro en tabla `refunds` (reason, amount). | Casos: disputa resuelta a favor cliente, cancelación temprana, error técnico. Refund total vs parcial (ej: 15% penalty queda con profesional, resto refund). |

**Features a entregar:**

### Bloque 1: Integración MercadoPago Base
1. ✅ Crear preferencia de pago cuando cliente acepta propuesta (POST /create_preference)
2. ✅ Checkout Pro redirect (webview React Native con deep link return)
3. ✅ Webhook handler para notificaciones IPN (POST /webhooks/mercadopago)
4. ✅ Verificación firma HMAC-SHA256 webhook
5. ✅ Idempotencia webhook (mismo payment_id múltiples veces)
6. ✅ Estados payment: `pending`, `completed`, `failed`, `refunded`, `disputed`
7. ✅ Guardar `mercadopago_payment_id` para tracking

### Bloque 2: Cálculo Comisiones
8. ✅ Detectar si profesional tiene tarjeta registrada (`professionals.credit_card_token`)
9. ✅ Calcular antigüedad profesional (`created_at < 1 año`)
10. ✅ Calcular `commission_percentage`: 0% / 10% / 50%
11. ✅ Calcular `commission_amount` = amount * commission_percentage / 100
12. ✅ Calcular `net_amount` = amount - commission_amount - penalty_amount
13. ✅ Mostrar transparencia en UI checkout ("Comisión 0% - Promoción Año 1")

### Bloque 3: Appointments (Trabajos Agendados)
14. ✅ Crear appointment automáticamente cuando payment.status='completed'
15. ✅ Estados appointment: `scheduled`, `in_progress`, `completed`, `cancelled_by_client`, `cancelled_by_professional`
16. ✅ Trackear `rescheduled_count` (máximo 2)
17. ✅ Tabla `appointment_confirmations` (client_confirmed, professional_confirmed BOOLEAN)
18. ✅ UI "Marcar trabajo completado" (cliente + profesional independientes)
19. ✅ Notificación push cuando uno confirma, recordatorio al otro

### Bloque 4: Escrow (Confirmación Mutua)
20. ✅ Lógica trigger: cuando ambos confirman → payment.payout_status='ready'
21. ✅ Cronjob cada hora: buscar payments ready + hacer payout API MP
22. ✅ Actualizar payment.payout_status='completed', payment.payout_at=NOW()
23. ✅ Notificación profesional: "Pago liberado - ARS X,XXX en camino"
24. ✅ Timeout auto-release: 7 días sin confirmación cliente → auto-confirmar
25. ✅ Notificaciones preventivas días 5, 6, 7

### Bloque 5: Reprogramaciones
26. ✅ Botón "Solicitar reprogramación" (cliente o profesional)
27. ✅ Modal: nueva fecha/hora + motivo opcional
28. ✅ Notificación a la otra parte con botones "Aceptar" / "Rechazar"
29. ✅ Si acepta: actualizar `scheduled_date`, `scheduled_time`, incrementar `rescheduled_count`
30. ✅ Si `rescheduled_count >= 2`: mostrar warning "Última reprogramación permitida"
31. ✅ Si `rescheduled_count = 2` e intenta reprogramar de nuevo → forzar cancelar con penalty

### Bloque 6: Cancelaciones y Penalizaciones
32. ✅ Botón "Cancelar trabajo" (hasta 12hs antes de scheduled_date)
33. ✅ Modal: "¿Estás seguro? Se aplicará penalización 15% si ya reprogramaste 2 veces"
34. ✅ Calcular `penalty_amount` = amount * 0.15
35. ✅ Si profesional cancela → refund (amount - penalty) a cliente, payout penalty a profesional
36. ✅ Si cliente cancela → payout penalty a profesional (no refund)
37. ✅ Actualizar appointment.status, appointment.penalty_applied=TRUE, appointment.cancelled_by, appointment.cancellation_reason

### Bloque 7: Pagos Efectivo + Balances
38. ✅ Opción "Pagar en efectivo" en checkout (solo si profesional tiene tarjeta)
39. ✅ Crear payment con `payment_method='cash'`, `status='pending'`
40. ✅ Al confirmar trabajo → payment.status='completed', actualizar balance
41. ✅ Tabla `balances`: `professional_id`, `balance` (negativo = deuda)
42. ✅ Cronjob fin de mes: cobrar tarjeta profesional por `balance` negativo
43. ✅ Si pago falla → notificación + bloquear profesional (no puede aceptar nuevos trabajos)

### Bloque 8: Disputas (preparación Fase 6)
44. ✅ Botón "Reportar problema" (activo hasta 48hs después scheduled_date)
45. ✅ Modal: textarea motivo + opcional subir fotos evidencia
46. ✅ Crear registro tabla `disputes` (appointment_id, reporter_id, reason, status='open')
47. ✅ Actualizar payment.status='disputed', bloquear payout automático
48. ✅ Notificación admin (email/Slack) con link al dispute
49. ✅ UI placeholder "En disputa - Admin mediará en 48hs"

### Bloque 9: Testing & Compliance
50. ✅ Sandbox MercadoPago (credenciales TEST, feature flag)
51. ✅ E2E tests: crear pago → webhook → confirmar → payout (todo en sandbox)
52. ✅ Export CSV mensual para AFIP (payments completados + refundados)
53. ✅ Logs detallados toda transacción (Sentry + Winston)
54. ✅ Alertas críticas: payout falla, webhook signature inválido, balance deuda >30 días

**Riesgos identificados:**

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| **Webhook duplicado** (MP envía mismo evento múltiples veces) | CRÍTICO — Crear 2 payments por mismo pago real | Upsert con UNIQUE INDEX en `mercadopago_payment_id`. Validar firma HMAC. Log duplicados (no error, solo warning). |
| **Webhook falso** (atacante forja petición) | CRÍTICO — Marcar payment completed sin pago real | Validar signature `x-signature` con HMAC-SHA256. Rechazar sin firma válida. Nunca confiar solo en `payment_id` en body. |
| **Race condition:** Cliente confirma mientras profesional cancela | ALTO — Estados inconsistentes (appointment completed pero payment cancelled) | Lock optimista: WHERE `appointment.status='scheduled'` en UPDATE. Si falla → rollback, mostrar error "Otro usuario modificó este trabajo". |
| **Payout falla** (API MP rechaza payout: cuenta inválida, límite excedido) | ALTO — Profesional no recibe dinero, frustración | Retry automático 3 veces (exponential backoff). Si falla → payment.payout_status='failed', notificar admin urgente. Admin resuelve manualmente (transferencia bancaria). |
| **Timeout auto-release se dispara por error** (cliente confirmaría pero sistema lo auto-confirma antes) | MEDIO — Cliente pierde control | Notificaciones preventivas días 5, 6, 7. UI clara "Tienes X días para confirmar o rechazar trabajo". Admin puede extender timeout manualmente en disputas. |
| **Cliente reporta disputa después de auto-release** | MEDIO — Dinero ya pagado a profesional | Botón "Reportar problema" se bloquea después de payout (grayed out, tooltip "El pago ya fue liberado. Contacta soporte"). Soporte puede iniciar refund manualmente. |
| **Profesional sin tarjeta intenta pago efectivo** | BAJO — Error UX | Validar en checkout: si sin tarjeta → deshabilitar opción "Efectivo", tooltip "Registra tarjeta para habilitar". Solo MP/tarjeta permitido. |
| **Deuda balance crece sin control** | ALTO — Profesional debe ARS 50K, no puede pagar de golpe | Límite máximo deuda: ARS 20K. Si balance < -20K → bloquear aceptar nuevos trabajos. Notificación "Regulariza deuda para seguir trabajando". Plan de pagos manual (admin). |
| **Cambio comisiones retroactivo** | MEDIO — Cálculos históricos inconsistentes | Snapshot `commission_percentage` en payment al crearlo (NO recalcular). Histórico immutable. Nuevas comisiones aplican solo a nuevos payments. |
| **Sandbox contamina producción** | CRÍTICO — Payments de prueba mezclados con reales | Feature flag `process.env.USE_SANDBOX`. Tabla separada `sandbox_payments` (NO usar tabla `payments` principal). Banner UI "MODO PRUEBA" visible siempre. |
| **AFIP auditoría sin datos completos** | CRÍTICO — Multas fiscales | Export CSV con TODOS los campos obligatorios (DNI profesional, fecha, monto, comisión). Guardar payments soft-deleted (deleted_at) por 10 años (ley argentina). |

**Ready for proposal:** ✅ YES — Arquitectura definida, integración MercadoPago validada (docs oficiales), plan de testing exhaustivo, compliance AFIP cubierto.

---

## 2. Current State (Post Fase 3)

### Ya Tenemos Implementado:
✅ Tabla `proposals` con `price`, `scheduled_date`, `scheduled_time`, `status` (pending/accepted/rejected)  
✅ Cliente acepta propuesta → proposal.status='accepted' (lógica Fase 2)  
✅ Chat en tiempo real (Fase 3) — negociación precios ya funciona  
✅ FCM push notifications (infrastructure ready)  
✅ JWT auth + user/professional roles  
✅ MercadoPago credenciales en `.env` (asumo — si no, solicitar al usuario)  

### Base de Datos Actual:
```sql
-- Tablas existentes (Fases 1-3)
users (id, full_name, email, phone, dni, fcm_token, created_at, ...)
professionals (id, user_id, credit_card_token, is_verified, created_at, ...)
proposals (id, post_id, professional_id, price, scheduled_date, scheduled_time, status, ...)
chats (id, client_id, professional_id, ...)
messages (id, chat_id, sender_id, message_text, read, ...)
notifications (id, user_id, type, title, body, ...)
```

### Tablas a Crear (Fase 4):

```sql
-- Migration: 20260322_create_payments_table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- UUID para idempotencia
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE RESTRICT,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  professional_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  -- Montos (todos en ARS, 2 decimales)
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0), -- Precio total trabajo
  commission_percentage DECIMAL(5,2) NOT NULL CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  commission_amount DECIMAL(10,2) NOT NULL CHECK (commission_amount >= 0),
  net_amount DECIMAL(10,2) NOT NULL CHECK (net_amount >= 0), -- Monto neto profesional
  penalty_amount DECIMAL(10,2) DEFAULT 0 CHECK (penalty_amount >= 0),
  penalty_reason VARCHAR(100), -- 'cancelled_by_client' | 'cancelled_by_professional'
  
  -- Método pago
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('mercadopago', 'cash')),
  mercadopago_payment_id VARCHAR(100) UNIQUE, -- ID transacción MP (para tracking/webhooks)
  currency VARCHAR(3) DEFAULT 'ARS',
  
  -- Estados
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'disputed')),
  payout_status VARCHAR(20) DEFAULT 'pending' CHECK (payout_status IN ('pending', 'ready', 'processing', 'completed', 'failed')),
  payout_at TIMESTAMP, -- Cuándo se liberó pago a profesional
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payments_proposal_id ON payments(proposal_id);
CREATE INDEX idx_payments_client_id ON payments(client_id);
CREATE INDEX idx_payments_professional_id ON payments(professional_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_payout_status ON payments(payout_status) WHERE payout_status IN ('ready', 'processing');
CREATE UNIQUE INDEX idx_payments_mp_payment_id ON payments(mercadopago_payment_id) WHERE mercadopago_payment_id IS NOT NULL;

-- Migration: 20260322_create_appointments_table
CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  proposal_id INTEGER UNIQUE NOT NULL REFERENCES proposals(id) ON DELETE RESTRICT, -- 1-to-1
  payment_id UUID UNIQUE NOT NULL REFERENCES payments(id) ON DELETE RESTRICT, -- 1-to-1
  
  -- Fecha/hora trabajo (puede cambiar por reprogramaciones)
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  
  -- Estados
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled' CHECK (
    status IN ('scheduled', 'in_progress', 'completed', 'cancelled_by_client', 'cancelled_by_professional')
  ),
  
  -- Reprogramaciones
  rescheduled_count INTEGER NOT NULL DEFAULT 0 CHECK (rescheduled_count <= 2),
  last_reschedule_reason TEXT,
  
  -- Cancelaciones
  cancellation_reason TEXT,
  cancelled_by VARCHAR(20) CHECK (cancelled_by IN ('client', 'professional')),
  penalty_applied BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraint: si cancelled, debe tener motivo
  CONSTRAINT chk_appt_cancelled CHECK (
    (status LIKE 'cancelled%' AND cancelled_by IS NOT NULL AND cancellation_reason IS NOT NULL) OR
    (status NOT LIKE 'cancelled%' AND cancelled_by IS NULL)
  )
);

CREATE INDEX idx_appointments_proposal_id ON appointments(proposal_id);
CREATE INDEX idx_appointments_payment_id ON appointments(payment_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_scheduled_date ON appointments(scheduled_date);

-- Migration: 20260322_create_appointment_confirmations_table
CREATE TABLE appointment_confirmations (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER UNIQUE NOT NULL REFERENCES appointments(id) ON DELETE CASCADE, -- 1-to-1
  
  -- Confirmaciones independientes
  client_confirmed BOOLEAN DEFAULT FALSE,
  client_confirmed_at TIMESTAMP,
  professional_confirmed BOOLEAN DEFAULT FALSE,
  professional_confirmed_at TIMESTAMP,
  
  -- Auto-release
  auto_release_date TIMESTAMP NOT NULL, -- scheduled_date + 7 días
  auto_released BOOLEAN DEFAULT FALSE, -- TRUE si se disparó timeout
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_appt_confirmations_appointment_id ON appointment_confirmations(appointment_id);
CREATE INDEX idx_appt_confirmations_auto_release ON appointment_confirmations(auto_release_date) WHERE client_confirmed = FALSE;

-- Trigger: Cuando ambos confirman → payment.payout_status='ready'
CREATE OR REPLACE FUNCTION handle_mutual_confirmation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_confirmed = TRUE AND NEW.professional_confirmed = TRUE THEN
    UPDATE payments
    SET payout_status = 'ready',
        updated_at = NOW()
    WHERE id = (
      SELECT payment_id FROM appointments WHERE id = NEW.appointment_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mutual_confirmation
AFTER UPDATE ON appointment_confirmations
FOR EACH ROW
WHEN (NEW.client_confirmed = TRUE AND NEW.professional_confirmed = TRUE)
EXECUTE FUNCTION handle_mutual_confirmation();

-- Migration: 20260322_create_balances_table
CREATE TABLE balances (
  id SERIAL PRIMARY KEY,
  professional_id INTEGER UNIQUE NOT NULL REFERENCES professionals(id) ON DELETE RESTRICT, -- 1-to-1
  
  balance DECIMAL(10,2) NOT NULL DEFAULT 0, -- Negativo = deuda
  last_settlement_date TIMESTAMP, -- Última fecha cobro exitoso
  last_settlement_amount DECIMAL(10,2), -- Último monto cobrado
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_balances_professional_id ON balances(professional_id);
CREATE INDEX idx_balances_balance ON balances(balance) WHERE balance < 0; -- Solo deudas

-- Migration: 20260322_create_disputes_table (preparación Fase 6)
CREATE TABLE disputes (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- Quién reporta
  
  reason TEXT NOT NULL,
  evidence_urls TEXT[], -- Array URLs fotos evidencia (PostgreSQL array)
  
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved_refund', 'resolved_payout', 'resolved_split', 'closed_no_action')),
  admin_notes TEXT, -- Notas internas admin
  resolved_at TIMESTAMP,
  resolution_reason TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_disputes_appointment_id ON disputes(appointment_id);
CREATE INDEX idx_disputes_status ON disputes(status) WHERE status IN ('open', 'investigating');
CREATE INDEX idx_disputes_created_at ON disputes(created_at DESC);

-- Migration: 20260322_create_refunds_table
CREATE TABLE refunds (
  id SERIAL PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0), -- Monto refund (puede ser parcial)
  reason VARCHAR(100) NOT NULL, -- 'dispute_resolved' | 'cancellation_early' | 'technical_error'
  mercadopago_refund_id VARCHAR(100) UNIQUE, -- ID refund MP
  
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX idx_refunds_status ON refunds(status);
```

---

## 3. Technical Options Evaluated

### 3.1 MercadoPago Integration: Checkout Pro vs Checkout API

**Contexto:** ¿Formulario de pago en nuestra app (Checkout API) o redirect a webview MercadoPago (Checkout Pro)?

#### Opción A: Checkout Pro (Redirect Webview) ✅

**Flujo:**
```typescript
// Backend: Crear preferencia de pago
POST /api/payments/create-preference
Body: {
  proposalId: 123
}

// Respuesta:
{
  preferenceId: "123456789-abc-def",
  initPoint: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123456789-abc-def",
  sandboxInitPoint: "https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=..."
}

// Frontend: Abrir webview
import { WebView } from 'react-native-webview';

<WebView
  source={{ uri: initPoint }}
  onNavigationStateChange={(navState) => {
    // Detectar deep link return
    if (navState.url.includes('quickfixu://payment/success')) {
      // Cerrar webview, actualizar UI
      handlePaymentSuccess();
    }
  }}
/>

// MP redirige después de pago:
// Success: quickfixu://payment/success?payment_id=123&status=approved
// Failure: quickfixu://payment/failure?payment_id=123&status=rejected
// Pending: quickfixu://payment/pending?payment_id=123&status=in_process
```

**Backend crear preferencia:**
```typescript
import mercadopago from 'mercadopago';

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

router.post('/create-preference', requireAuth, async (req, res) => {
  const { proposalId } = req.body;
  const userId = req.userId;
  
  // Validar propuesta
  const proposal = await prisma.proposal.findFirst({
    where: {
      id: proposalId,
      status: 'accepted',
    },
    include: {
      post: {
        include: {
          user: true, // Cliente
        },
      },
      professional: {
        include: {
          user: true, // Profesional
        },
      },
    },
  });
  
  if (!proposal || proposal.post.user_id !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Calcular comisión
  const { commissionPercentage, commissionAmount, netAmount } = calculateCommission(
    proposal.price,
    proposal.professional
  );
  
  // Crear payment record (status pending)
  const payment = await prisma.payment.create({
    data: {
      proposal_id: proposalId,
      client_id: userId,
      professional_id: proposal.professional.user_id,
      amount: proposal.price,
      commission_percentage: commissionPercentage,
      commission_amount: commissionAmount,
      net_amount: netAmount,
      payment_method: 'mercadopago',
      status: 'pending',
    },
  });
  
  // Crear preferencia MP
  const preference = {
    items: [
      {
        title: `Trabajo: ${proposal.post.title}`,
        description: `Profesional: ${proposal.professional.user.full_name}`,
        unit_price: parseFloat(proposal.price),
        quantity: 1,
        currency_id: 'ARS',
      },
    ],
    payer: {
      email: proposal.post.user.email,
      name: proposal.post.user.full_name,
      phone: {
        area_code: '',
        number: proposal.post.user.phone,
      },
    },
    back_urls: {
      success: 'quickfixu://payment/success',
      failure: 'quickfixu://payment/failure',
      pending: 'quickfixu://payment/pending',
    },
    auto_return: 'approved', // Auto-redirect en éxito
    external_reference: payment.id, // UUID del payment (lo usamos en webhook)
    notification_url: `${API_URL}/webhooks/mercadopago`, // Webhook IPN
  };
  
  const response = await mercadopago.preferences.create(preference);
  
  res.json({
    preferenceId: response.body.id,
    initPoint: response.body.init_point,
    sandboxInitPoint: response.body.sandbox_init_point,
  });
});
```

**Pros:**
- ✅ **PCI Compliance automático** — MP maneja datos sensibles de tarjeta, no nosotros
- ✅ **UI nativa MP** — Usuarios reconocen interfaz familiar, confianza
- ✅ **0 mantenimiento frontend** — No tenemos que validar tarjetas, CVV, expiration, etc.
- ✅ **Múltiples métodos pago** — Tarjeta, saldo MP, Mercado Crédito, cuotas (todo out-of-the-box)
- ✅ **Mobile-friendly** — WebView funciona perfecto en React Native
- ✅ **Testing fácil** — Sandbox MP tiene tarjetas de prueba documentadas

**Cons:**
- Usuario sale de nuestra app (webview = contexto diferente, aunque seamless)
- Menos control sobre UX (no podemos customizar formulario MP)

**Veredicto:** ✅ **RECOMENDADO MVP** — Simplicidad + seguridad > control UX. Es el estándar para MVPs.

---

#### Opción B: Checkout API (In-App Tokenization) 🔴

**Flujo:**
```typescript
// Frontend: Formulario tarjeta custom
<CreditCardInput
  onCardChange={(card) => {
    // Tokenizar con SDK MP (client-side)
    const token = await mercadopago.createCardToken(card);
    // Enviar token a backend (NO enviar número tarjeta real)
    handlePayment(token);
  }}
/>

// Backend: Crear payment con token
const payment = await mercadopago.payment.create({
  transaction_amount: amount,
  token: cardToken,
  description: 'Trabajo electricista',
  installments: 1,
  payment_method_id: 'visa',
  payer: { email: 'cliente@example.com' },
});
```

**Pros:**
- Control total UX (formulario custom, branding)
- Usuario nunca sale de la app

**Cons:**
- ❌ **Certificación PCI requerida** — Aunque no guardamos números, manejamos datos sensibles (CVV)
- ❌ **Mantenimiento complejo** — Validación Luhn, regex tarjetas, manejo errores MP
- ❌ **Testing difícil** — Mockear SDK MP, tarjetas de prueba
- ❌ **Menor conversión** — Usuarios desconfían formularios custom vs MP oficial

**Veredicto:** ❌ Rechazado MVP — Overhead injustificado. Migrar post-PMF si conversión mejora significativamente.

---

### 3.2 Escrow Implementation: Split Payment vs Manual Payout

**Contexto:** ¿Cómo retener dinero hasta confirmación mutua?

#### Opción A: Manual Payout (Pago a cuenta QuickFixU, liberar después) ✅

**Flujo:**
```typescript
// 1. Cliente paga → dinero va a cuenta MercadoPago de QuickFixU
// 2. Guardar mercadopago_payment_id en tabla payments
// 3. Cuando ambos confirman trabajo:
//    - payment.payout_status = 'ready'
//    - Cronjob detecta payments con payout_status='ready'
//    - Hacer payout a profesional vía MP API

// Cronjob (cada hora)
async function processPendingPayouts() {
  const readyPayments = await prisma.payment.findMany({
    where: {
      payout_status: 'ready',
      status: 'completed',
    },
    include: {
      professional: {
        include: {
          user: true,
        },
      },
    },
  });
  
  for (const payment of readyPayments) {
    try {
      // Actualizar a processing (evitar duplicados si cronjob corre 2 veces)
      await prisma.payment.update({
        where: { id: payment.id },
        data: { payout_status: 'processing' },
      });
      
      // Payout vía MP API
      const payout = await mercadopago.money_requests.create({
        amount: parseFloat(payment.net_amount),
        email: payment.professional.user.email,
        concept: 'Pago por trabajo completado',
        currency_id: 'ARS',
      });
      
      // Actualizar payment
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          payout_status: 'completed',
          payout_at: new Date(),
        },
      });
      
      // Notificación profesional
      await sendPushNotification(payment.professional.user_id, {
        title: '💸 Pago liberado',
        body: `Recibiste ARS ${payment.net_amount} por trabajo completado`,
      });
    } catch (error) {
      // Payout falló (cuenta inválida, límite excedido, etc.)
      await prisma.payment.update({
        where: { id: payment.id },
        data: { payout_status: 'failed' },
      });
      
      // Alerta admin (Sentry + email)
      Sentry.captureException(error, {
        tags: { payment_id: payment.id },
      });
    }
  }
}
```

**Pros:**
- ✅ **Simple MVP** — No requiere aprobación MercadoPago Marketplace
- ✅ **Control total** — Decidimos cuándo liberar pago (confirmación mutua, timeout, disputa)
- ✅ **Flexible** — Podemos hacer payouts parciales (ej: 50% ahora, 50% después)
- ✅ **Auditoría fácil** — Todo pago pasa por nuestra cuenta (log completo)

**Cons:**
- Dinero "parqueado" en cuenta QuickFixU (riesgo financiero si cuentas grandes)
- Responsabilidad fiscal (AFIP nos ve como intermediario)
- Mitigation: Cuenta bancaria separada solo para escrow (no mezclar con operativo)

**Veredicto:** ✅ **RECOMENDADO MVP** — Balance simplicidad vs riesgo aceptable.

---

#### Opción B: MercadoPago Marketplace (Split Payment) 🟡

**Flujo:**
```typescript
// Cada profesional debe tener cuenta MP aprobada como "seller"
// Al crear preferencia, especificar split:
const preference = {
  items: [...],
  marketplace: 'QuickFixU',
  marketplace_fee: commissionAmount, // Comisión va a QuickFixU
  collector_id: professionalMPAccountId, // Dinero neto va directo a profesional
};

// Dinero se splitea automáticamente:
// - commissionAmount → cuenta QuickFixU
// - netAmount → cuenta profesional
```

**Pros:**
- Dinero NO pasa por cuenta QuickFixU (menos riesgo financiero)
- Payout automático (MP lo hace)
- Menos responsabilidad fiscal (profesional recibe directo)

**Cons:**
- ❌ **Aprobación lenta** — Profesional debe aplicar a "MP Marketplace Seller" (proceso burocrático, puede tardar semanas)
- ❌ **Barrera entrada** — Muchos profesionales NO tienen cuenta MP o no quieren el trámite
- ❌ **Menos control** — NO podemos retener pago (iría directo a profesional)
- ❌ **Escrow complejo** — Requeriría reserva de fondos (feature avanzada MP, no disponible ARG)

**Veredicto:** 🟡 **Post-PMF** — Migrar cuando tengamos >1000 profesionales y riesgo financiero sea alto.

---

### 3.3 Webhook Handling: Idempotencia y Signature Verification

**Contexto:** MercadoPago envía webhooks IPN (Instant Payment Notification) cuando cambia estado de pago. ¿Cómo manejar de forma segura?

#### Opción A: Signature Verification + Upsert con Unique Index ✅

**Implementación:**
```typescript
import crypto from 'crypto';

router.post('/webhooks/mercadopago', async (req, res) => {
  try {
    // 1. Verificar firma HMAC-SHA256
    const signature = req.headers['x-signature'];
    const xRequestId = req.headers['x-request-id'];
    
    if (!signature || !xRequestId) {
      console.warn('Webhook sin firma o request ID');
      return res.status(400).json({ error: 'Missing signature' });
    }
    
    // Parsear firma (formato: "ts=timestamp,v1=hash")
    const parts = signature.split(',');
    const ts = parts.find(p => p.startsWith('ts=')).split('=')[1];
    const hash = parts.find(p => p.startsWith('v1=')).split('=')[1];
    
    // Recrear firma
    const manifest = `id:${req.body.id};request-id:${xRequestId};ts:${ts};`;
    const expectedHash = crypto
      .createHmac('sha256', process.env.MP_WEBHOOK_SECRET)
      .update(manifest)
      .digest('hex');
    
    if (hash !== expectedHash) {
      console.error('Firma webhook inválida', { hash, expectedHash });
      Sentry.captureMessage('Webhook MP con firma inválida', {
        level: 'error',
        tags: { ip: req.ip },
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // 2. Extraer datos webhook
    const { type, data } = req.body;
    
    // Solo procesar webhooks de payment
    if (type !== 'payment') {
      return res.status(200).json({ message: 'Ignored non-payment webhook' });
    }
    
    const paymentId = data.id; // mercadopago_payment_id
    
    // 3. Obtener detalles pago desde API MP (NO confiar solo en webhook body)
    const mpPayment = await mercadopago.payment.get(paymentId);
    const paymentData = mpPayment.body;
    
    // 4. Buscar payment en nuestra BD por external_reference (nuestro UUID)
    const externalReference = paymentData.external_reference; // UUID payment
    
    const payment = await prisma.payment.findUnique({
      where: { id: externalReference },
    });
    
    if (!payment) {
      console.error('Payment no encontrado en BD', { externalReference });
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    // 5. Actualizar payment según status MP (IDEMPOTENTE)
    const newStatus = mapMPStatusToOurStatus(paymentData.status);
    
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        mercadopago_payment_id: paymentId, // Guardar MP ID
        status: newStatus,
        updated_at: new Date(),
      },
    });
    
    // 6. Si payment completed → crear appointment
    if (newStatus === 'completed') {
      await createAppointmentFromPayment(payment.id);
    }
    
    // 7. Notificar profesional
    if (newStatus === 'completed') {
      await sendPushNotification(payment.professional_id, {
        title: '💰 Pago confirmado',
        body: 'El cliente pagó. El trabajo está agendado.',
        data: { type: 'payment_completed', paymentId: payment.id },
      });
    }
    
    // 8. Responder 200 OK (importante para que MP no reintente)
    res.status(200).json({ message: 'Webhook processed' });
  } catch (error) {
    console.error('Error procesando webhook MP', error);
    Sentry.captureException(error);
    // Responder 500 → MP reintentará webhook
    res.status(500).json({ error: 'Internal error' });
  }
});

function mapMPStatusToOurStatus(mpStatus: string): string {
  switch (mpStatus) {
    case 'approved':
      return 'completed';
    case 'pending':
    case 'in_process':
    case 'in_mediation':
      return 'pending';
    case 'rejected':
    case 'cancelled':
      return 'failed';
    case 'refunded':
    case 'charged_back':
      return 'refunded';
    default:
      return 'pending';
  }
}

async function createAppointmentFromPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      proposal: true,
    },
  });
  
  if (!payment) return;
  
  // Verificar que no exista appointment ya (idempotencia)
  const existing = await prisma.appointment.findUnique({
    where: { payment_id: paymentId },
  });
  
  if (existing) {
    console.log('Appointment ya existe, skipping');
    return;
  }
  
  // Crear appointment
  const appointment = await prisma.appointment.create({
    data: {
      proposal_id: payment.proposal_id,
      payment_id: paymentId,
      scheduled_date: payment.proposal.scheduled_date,
      scheduled_time: payment.proposal.scheduled_time,
      status: 'scheduled',
    },
  });
  
  // Crear registro de confirmaciones
  await prisma.appointmentConfirmation.create({
    data: {
      appointment_id: appointment.id,
      auto_release_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // + 7 días
    },
  });
  
  console.log('Appointment creado', appointment.id);
}
```

**Pros:**
- ✅ **Seguridad máxima** — Firma HMAC impide webhooks falsos
- ✅ **Idempotencia** — Mismo webhook múltiples veces = 1 sola actualización (gracias a WHERE unique)
- ✅ **Verificación doble** — Fetch payment desde API MP (no confiar solo en body webhook)
- ✅ **Logging completo** — Sentry alertas si firma inválida (potencial ataque)

**Cons:**
- Complejidad adicional (parsear firma, validar HMAC)
- Mitigation: Librería `@mercadopago/sdk-nodejs` facilita validación

**Veredicto:** ✅ **RECOMENDADO** — Crítico para seguridad financiera.

---

#### Opción B: Sin Signature Verification (Solo Validar IP MP) 🔴

**Implementación:**
```typescript
router.post('/webhooks/mercadopago', async (req, res) => {
  // Validar que viene de IPs MercadoPago
  const allowedIPs = ['209.225.49.0/24', '216.33.197.0/24']; // Ejemplo
  if (!allowedIPs.includes(req.ip)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Procesar sin validar firma
  // ...
});
```

**Pros:**
- Más simple (menos código)

**Cons:**
- ❌ **Inseguro** — Atacante puede spoofear IP (con proxy/VPN)
- ❌ **Sin garantía origen** — No sabemos si webhook realmente viene de MP
- ❌ **IPs MP cambian** — MP puede agregar nuevos rangos sin avisar → nuestro código bloquea webhooks legítimos

**Veredicto:** ❌ **INACEPTABLE** — Riesgo financiero demasiado alto.

---

### 3.4 Confirmación Mutua: Tabla Separada vs Flags en Appointment

**Contexto:** ¿Cómo trackear que AMBOS (cliente + profesional) confirmaron trabajo completado?

#### Opción A: Tabla `appointment_confirmations` Separada ✅

**Estructura:**
```sql
CREATE TABLE appointment_confirmations (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER UNIQUE NOT NULL REFERENCES appointments(id),
  
  client_confirmed BOOLEAN DEFAULT FALSE,
  client_confirmed_at TIMESTAMP,
  
  professional_confirmed BOOLEAN DEFAULT FALSE,
  professional_confirmed_at TIMESTAMP,
  
  auto_release_date TIMESTAMP NOT NULL,
  auto_released BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Pros:**
- ✅ **Separación de concerns** — Appointment maneja estado trabajo, Confirmations maneja confirmaciones
- ✅ **Queries eficientes** — Filtrar por `auto_release_date` es rápido (índice dedicado)
- ✅ **Escalabilidad** — Fácil agregar más confirmaciones (ej: "materiales pagados", "sitio limpiado")

**Cons:**
- JOIN adicional para obtener confirmaciones (overhead mínimo)

**Veredicto:** ✅ **RECOMENDADO** — Limpio, escalable, fácil testing.

---

#### Opción B: Flags Directamente en Appointment 🟡

**Estructura:**
```sql
ALTER TABLE appointments ADD COLUMN client_confirmed BOOLEAN DEFAULT FALSE;
ALTER TABLE appointments ADD COLUMN professional_confirmed BOOLEAN DEFAULT FALSE;
ALTER TABLE appointments ADD COLUMN auto_release_date TIMESTAMP;
```

**Pros:**
- Sin JOIN (consultas ligeramente más rápidas)
- Menos tablas (simplicidad)

**Cons:**
- appointments crece con campos no relacionados directamente al estado del trabajo
- Dificulta agregar más confirmaciones (sería appointments.material_confirmed, appointments.cleanup_confirmed...)

**Veredicto:** 🟡 Aceptable para MVP ultra-simple. Opción A es mejor práctica.

---

### 3.5 Auto-Release Timeout: Cronjob vs Event-Driven

**Contexto:** Si cliente NO confirma en 7 días → auto-confirmar y liberar pago. ¿Cómo implementar?

#### Opción A: Cronjob Diario Busca Appointments Expirados ✅

**Implementación:**
```typescript
// Cronjob (cada 24 horas a las 3am)
import cron from 'node-cron';

cron.schedule('0 3 * * *', async () => {
  console.log('Running auto-release cronjob');
  
  const now = new Date();
  
  // Buscar confirmations con auto_release_date pasado y cliente NO confirmó
  const expiredConfirmations = await prisma.appointmentConfirmation.findMany({
    where: {
      auto_release_date: { lte: now },
      client_confirmed: false,
      auto_released: false,
    },
    include: {
      appointment: {
        include: {
          payment: true,
          proposal: {
            include: {
              post: {
                include: {
                  user: true, // Cliente
                },
              },
            },
          },
        },
      },
    },
  });
  
  for (const conf of expiredConfirmations) {
    try {
      // Auto-confirmar
      await prisma.appointmentConfirmation.update({
        where: { id: conf.id },
        data: {
          client_confirmed: true,
          client_confirmed_at: now,
          auto_released: true,
        },
      });
      
      // Si profesional ya confirmó → trigger payout
      if (conf.professional_confirmed) {
        await prisma.payment.update({
          where: { id: conf.appointment.payment_id },
          data: { payout_status: 'ready' },
        });
      }
      
      // Notificar cliente (informativo, no puede revertir)
      await sendPushNotification(conf.appointment.proposal.post.user_id, {
        title: '⏰ Pago liberado automáticamente',
        body: 'El trabajo fue marcado como completado (plazo vencido). Si hubo problemas, contacta soporte.',
        data: {
          type: 'auto_release',
          appointmentId: conf.appointment.id,
        },
      });
      
      console.log('Auto-released appointment', conf.appointment.id);
    } catch (error) {
      console.error('Error auto-releasing', conf.appointment.id, error);
      Sentry.captureException(error);
    }
  }
});
```

**Pros:**
- ✅ **Simple** — 1 query, loop, updates
- ✅ **Predecible** — Corre siempre a la misma hora
- ✅ **Debuggeable** — Logs claros de qué appointments se auto-releasearon

**Cons:**
- Latencia hasta 24hs (si auto_release_date es 3:01am, se procesa al día siguiente 3am)
- Mitigation: Cronjob cada 1 hora si latencia crítica (unlikely)

**Veredicto:** ✅ **RECOMENDADO** — Standard industry para timeouts.

---

#### Opción B: Event-Driven con Queue Delayed Jobs 🟡

**Implementación:**
```typescript
// Al crear appointment, agendar job delayed 7 días
import Bull from 'bull';

const autoReleaseQueue = new Bull('auto-release', {
  redis: REDIS_URL,
});

// Al crear appointment
async function createAppointment(paymentId) {
  const appointment = await prisma.appointment.create({...});
  
  // Agendar job 7 días en el futuro
  await autoReleaseQueue.add(
    { appointmentId: appointment.id },
    { delay: 7 * 24 * 60 * 60 * 1000 } // 7 días en ms
  );
}

// Processor
autoReleaseQueue.process(async (job) => {
  const { appointmentId } = job.data;
  // Lógica auto-release
});
```

**Pros:**
- Preciso al minuto (se dispara exactamente 7 días después)

**Cons:**
- Complejidad adicional (Bull + Redis + queue monitoring)
- Riesgo: si Redis cae, jobs se pierden (mitigation: persistence Bull, pero aún así)
- Testing difícil (mockear delays)

**Veredicto:** 🟡 **Post-PMF** — Overkill para MVP. Cronjob es suficiente.

---

### 3.6 Comisión Variable: Función Runtime vs Snapshot en Payment

**Contexto:** Comisión cambia según tarjeta registrada + antigüedad. ¿Calcular cada vez o guardar snapshot?

#### Opción A: Snapshot en Payment (Calcular al Crear, Nunca Recalcular) ✅

**Implementación:**
```typescript
function calculateCommission(
  amount: number,
  professional: Professional
): {
  commissionPercentage: number;
  commissionAmount: number;
  netAmount: number;
} {
  let commissionPercentage = 10; // Default: 10%
  
  // Si tiene tarjeta registrada
  if (professional.credit_card_token) {
    // Verificar antigüedad (<1 año)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    if (professional.created_at > oneYearAgo) {
      commissionPercentage = 0; // Promoción año 1
    }
  } else {
    // Sin tarjeta → 50% (desincentivar)
    commissionPercentage = 50;
  }
  
  const commissionAmount = (amount * commissionPercentage) / 100;
  const netAmount = amount - commissionAmount;
  
  return {
    commissionPercentage,
    commissionAmount,
    netAmount,
  };
}

// Al crear payment
router.post('/create-preference', async (req, res) => {
  const { proposalId } = req.body;
  
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { professional: true },
  });
  
  // Calcular comisión AHORA (snapshot)
  const { commissionPercentage, commissionAmount, netAmount } = calculateCommission(
    proposal.price,
    proposal.professional
  );
  
  // Guardar en payment (INMUTABLE)
  const payment = await prisma.payment.create({
    data: {
      amount: proposal.price,
      commission_percentage: commissionPercentage, // Snapshot
      commission_amount: commissionAmount, // Snapshot
      net_amount: netAmount, // Snapshot
      // ...
    },
  });
  
  // ...
});
```

**Pros:**
- ✅ **Histórico correcto** — Si cambian reglas comisión (ej: año 2 → 15%), payments viejos mantienen su 10%
- ✅ **Auditoría AFIP** — Podemos mostrar exactamente qué comisión se cobró en cada transacción
- ✅ **Sin sorpresas** — Profesional ve comisión al aceptar propuesta, eso es lo que se cobra (no cambia retroactivamente)

**Cons:**
- Duplicación lógica (reglas comisión están en código + guardadas en BD)
- Mitigation: 1 sola función `calculateCommission`, usada siempre

**Veredicto:** ✅ **RECOMENDADO** — Crítico para compliance y UX transparente.

---

#### Opción B: Calcular en Runtime Siempre (NO Guardar Snapshot) 🔴

**Implementación:**
```typescript
// NO guardar commission en payment, calcular al mostrarlo
const payment = await prisma.payment.findUnique({...});
const { commissionPercentage } = calculateCommission(payment.amount, payment.professional);
// Mostrar commissionPercentage en UI
```

**Pros:**
- Menos campos en BD (más simple)

**Cons:**
- ❌ **Histórico incorrecto** — Si reglas cambian, recalcular payments viejos da valores diferentes
- ❌ **Auditoría imposible** — No podemos demostrar a AFIP qué comisión cobramos hace 2 años
- ❌ **UX confusa** — Profesional vio "0% comisión" al aceptar, pero año después vemos "10%" en historial (parece error)

**Veredicto:** ❌ **INACEPTABLE** — Riesgo legal + UX rota.

---

### 3.7 Pagos Efectivo: Tracking Deuda vs Bloquear Feature

**Contexto:** PRD permite pagos efectivo (post año 1). ¿Cómo cobrar comisión si no pasó por MP?

#### Opción A: Balance Negativo + Cobro Fin de Mes con Tarjeta Registrada ✅

**Implementación:**
```typescript
// Cliente selecciona "Pagar en efectivo"
router.post('/create-cash-payment', requireAuth, async (req, res) => {
  const { proposalId } = req.body;
  
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { professional: true },
  });
  
  // Validar que profesional tiene tarjeta registrada
  if (!proposal.professional.credit_card_token) {
    return res.status(400).json({
      error: 'Profesional debe registrar tarjeta para aceptar pagos en efectivo',
    });
  }
  
  // Calcular comisión (snapshot)
  const { commissionPercentage, commissionAmount, netAmount } = calculateCommission(
    proposal.price,
    proposal.professional
  );
  
  // Crear payment con status pending (se completa al confirmar trabajo)
  const payment = await prisma.payment.create({
    data: {
      proposal_id: proposalId,
      client_id: req.userId,
      professional_id: proposal.professional.user_id,
      amount: proposal.price,
      commission_percentage: commissionPercentage,
      commission_amount: commissionAmount,
      net_amount: netAmount,
      payment_method: 'cash',
      status: 'pending', // Se marca completed al confirmar trabajo
    },
  });
  
  // Crear appointment directamente (no esperar webhook)
  const appointment = await prisma.appointment.create({
    data: {
      proposal_id: proposalId,
      payment_id: payment.id,
      scheduled_date: proposal.scheduled_date,
      scheduled_time: proposal.scheduled_time,
      status: 'scheduled',
    },
  });
  
  res.json({ payment, appointment });
});

// Cuando ambos confirman trabajo completado
async function handleMutualConfirmationCash(appointmentId) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { payment: true },
  });
  
  if (appointment.payment.payment_method !== 'cash') return;
  
  // Marcar payment completed
  await prisma.payment.update({
    where: { id: appointment.payment_id },
    data: { status: 'completed' },
  });
  
  // Actualizar balance profesional (deuda)
  const professionalId = appointment.payment.professional_id;
  
  await prisma.balance.upsert({
    where: { professional_id: professionalId },
    update: {
      balance: {
        decrement: appointment.payment.commission_amount, // Restar comisión (balance se hace negativo)
      },
    },
    create: {
      professional_id: professionalId,
      balance: -appointment.payment.commission_amount,
    },
  });
}

// Cronjob último día del mes (día 28-31, depende del mes)
cron.schedule('0 2 1 * *', async () => {
  // Día 1 del mes a las 2am (cobrar deudas mes anterior)
  console.log('Running monthly balance settlement');
  
  const professionalsWithDebt = await prisma.balance.findMany({
    where: { balance: { lt: 0 } }, // Balance negativo = deuda
    include: {
      professional: {
        include: {
          user: true,
        },
      },
    },
  });
  
  for (const balance of professionalsWithDebt) {
    try {
      const amountToCharge = Math.abs(balance.balance); // Convertir a positivo
      
      // Cobrar de tarjeta registrada vía MP
      const payment = await mercadopago.payment.create({
        transaction_amount: amountToCharge,
        token: balance.professional.credit_card_token,
        description: `Comisiones QuickFixU - ${new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' })}`,
        payment_method_id: 'visa', // Detectar método real del token
        payer: {
          email: balance.professional.user.email,
        },
      });
      
      if (payment.body.status === 'approved') {
        // Cobro exitoso → resetear balance
        await prisma.balance.update({
          where: { id: balance.id },
          data: {
            balance: 0,
            last_settlement_date: new Date(),
            last_settlement_amount: amountToCharge,
          },
        });
        
        // Notificar profesional
        await sendPushNotification(balance.professional.user_id, {
          title: '💳 Comisiones cobradas',
          body: `Se cobraron ARS ${amountToCharge} de comisiones del mes pasado`,
        });
      } else {
        // Cobro falló → notificar + bloquear
        await prisma.professional.update({
          where: { id: balance.professional_id },
          data: { is_blocked_for_debt: true },
        });
        
        await sendPushNotification(balance.professional.user_id, {
          title: '⚠️ Pago comisiones falló',
          body: `No pudimos cobrar ARS ${amountToCharge}. Actualiza tu tarjeta para seguir trabajando.`,
        });
        
        // Alerta admin
        Sentry.captureMessage('Balance settlement failed', {
          level: 'warning',
          tags: {
            professional_id: balance.professional_id,
            amount: amountToCharge,
          },
        });
      }
    } catch (error) {
      console.error('Error settling balance', balance.id, error);
      Sentry.captureException(error);
    }
  }
});
```

**Pros:**
- ✅ **Permite pagos efectivo** (realidad Argentina)
- ✅ **Captura comisión** (no se pierde revenue)
- ✅ **Flexible** (profesional paga fin de mes, no inmediatamente)

**Cons:**
- Riesgo de impago (profesional cancela tarjeta, no tiene fondos)
- Complejidad tracking deudas
- Mitigation: Límite máximo deuda ARS 20K, bloquear si excede

**Veredicto:** ✅ **RECOMENDADO** — Necesario para market fit ARG.

---

#### Opción B: Bloquear Pagos Efectivo Completamente 🔴

**Implementación:**
```typescript
// Solo permitir payment_method='mercadopago'
if (req.body.paymentMethod === 'cash') {
  return res.status(400).json({ error: 'Cash payments not supported' });
}
```

**Pros:**
- Muy simple (0 código balances)
- 100% trazabilidad (todo pasa por MP)

**Cons:**
- ❌ **Mala UX Argentina** — Muchos usuarios prefieren efectivo (desconfianza digital)
- ❌ **Limita adopción** — Profesionales pueden irse a competencia que acepta efectivo

**Veredicto:** ❌ Rechazado — No se alinea con realidad del mercado.

---

## 4. Architecture Decisions (Finales)

### AD-001: Checkout Pro con Webview MercadoPago

**Decision:** Usar Checkout Pro (redirect webview) para todos los pagos con tarjeta/MP.

**Rationale:**
- PCI compliance automático (no manejamos datos sensibles)
- UI familiar usuarios argentinos (confianza)
- 0 mantenimiento formularios frontend
- Testing fácil con sandbox MP

**Implications:**
- Usuario sale brevemente de app (webview seamless)
- Deep links configurados: `quickfixu://payment/{success|failure|pending}`
- No customización UI formulario pago

---

### AD-002: Manual Payout (No Marketplace Split Payment MVP)

**Decision:** Pago va a cuenta QuickFixU, liberamos con payout manual después de confirmación mutua.

**Rationale:**
- Simplicidad MVP (no requiere aprobación marketplace)
- Control total timing payout (confirmación, timeout, disputa)
- Flexible para refunds parciales

**Implications:**
- Responsabilidad fiscal (somos intermediarios)
- Cuenta bancaria separada para escrow
- Migrar a Marketplace post-PMF (cuando riesgo financiero sea alto)

---

### AD-003: Webhook Signature Verification HMAC-SHA256

**Decision:** Validar firma `x-signature` header con HMAC-SHA256 en todos los webhooks.

**Rationale:**
- Seguridad crítica (impide webhooks falsos)
- Standard MP (docs oficiales recomiendan)

**Implications:**
- Código validación firma en middleware
- Rechazar webhooks sin firma válida
- Alerta Sentry si firma inválida (potencial ataque)

---

### AD-004: Idempotencia Webhook con UNIQUE INDEX mercadopago_payment_id

**Decision:** UNIQUE INDEX en `payments.mercadopago_payment_id`, upsert en webhook handler.

**Rationale:**
- MP puede enviar mismo webhook múltiples veces (retry)
- Evita crear payments duplicados
- Log duplicados como warning (no error)

**Implications:**
- Migration agregar UNIQUE INDEX
- WHERE clause en upsert: `mercadopago_payment_id = X`

---

### AD-005: Tabla appointment_confirmations Separada

**Decision:** Tabla dedicada para trackear confirmaciones cliente/profesional independientes.

**Rationale:**
- Separación concerns (appointment = estado trabajo, confirmations = confirmaciones)
- Escalable (fácil agregar más confirmaciones futuro)
- Queries eficientes (índice auto_release_date)

**Implications:**
- JOIN adicional (overhead mínimo)
- Trigger automático cuando ambos confirman → payment.payout_status='ready'

---

### AD-006: Cronjob Diario para Auto-Release (7 Días Timeout)

**Decision:** Cronjob cada 24 horas busca appointments con `auto_release_date < NOW()` y `client_confirmed=false`, auto-confirma.

**Rationale:**
- Simple, predecible, debuggeable
- Latencia hasta 24hs aceptable (no crítica)
- Standard industry (Airbnb, Uber usan similar)

**Implications:**
- Notificaciones preventivas días 5, 6, 7
- Cliente pierde control después timeout (solo disputa vía soporte)

---

### AD-007: Snapshot Comisión en Payment (NO Recalcular)

**Decision:** Calcular `commission_percentage`, `commission_amount`, `net_amount` al crear payment, guardar como snapshot immutable.

**Rationale:**
- Histórico correcto si reglas comisión cambian
- Auditoría AFIP (demostrar qué se cobró en cada transacción)
- UX transparente (profesional ve comisión al aceptar, no cambia después)

**Implications:**
- Función `calculateCommission()` centralizada
- Nunca recalcular payments históricos

---

### AD-008: Balance Negativo + Cobro Fin de Mes para Pagos Efectivo

**Decision:** Permitir `payment_method='cash'`, actualizar `balance.balance -= commission` al confirmar trabajo, cobrar tarjeta profesional fin de mes.

**Rationale:**
- Permite pagos efectivo (realidad Argentina)
- Captura comisión (no pierde revenue)
- Flexible (profesional paga mensual, no inmediato)

**Implications:**
- Validar profesional tiene tarjeta registrada (sin tarjeta = NO puede cash)
- Límite máximo deuda ARS 20K
- Bloquear profesional si pago falla (is_blocked_for_debt=true)

---

### AD-009: Reprogramaciones Máximo 2, Tercera Cancelación con Penalty

**Decision:** `appointments.rescheduled_count <= 2`. Si intenta tercera reprogramación → forzar cancelar con penalty 15%.

**Rationale:**
- Balance flexibilidad vs abuse
- 2 reprogramaciones cubre casos legítimos (emergencia, clima)
- Más de 2 = patrón problemático

**Implications:**
- UI warning "Última reprogramación permitida" en segunda
- Botón reprogramar bloqueado si `rescheduled_count = 2`

---

### AD-010: Penalty 15% Descontado de Payment Amount

**Decision:** Si profesional cancela → refund (amount - penalty 15%) a cliente, payout penalty a profesional. Si cliente cancela → payout penalty a profesional.

**Rationale:**
- Desincentiva cancelaciones abusivas
- 15% es significativo pero no confiscatorio
- Asimétrico: cliente cancela = profesional recibe algo (reservó tiempo)

**Implications:**
- Calcular `penalty_amount` = amount * 0.15
- Actualizar `payment.penalty_amount`, `payment.penalty_reason`
- Refund parcial vía MP API (si cancela profesional)

---

## 5. Implementation Roadmap

### Milestone 1: Integración MercadoPago Base (Semana 1)
- [ ] Install `mercadopago` SDK
- [ ] Crear endpoint `POST /api/payments/create-preference`
- [ ] Frontend: WebView checkout + deep links
- [ ] Webhook handler `POST /webhooks/mercadopago`
- [ ] Signature verification HMAC-SHA256
- [ ] Testing sandbox (tarjetas de prueba MP)

### Milestone 2: Payments & Appointments Creation (Semana 2)
- [ ] Migration tabla `payments`
- [ ] Migration tabla `appointments`
- [ ] Migration tabla `appointment_confirmations`
- [ ] Lógica crear appointment cuando payment.status='completed'
- [ ] UI "Trabajo agendado" (calendario profesional)

### Milestone 3: Confirmación Mutua & Payout (Semana 3)
- [ ] UI botón "Marcar trabajo completado" (cliente + profesional)
- [ ] Trigger automático cuando ambos confirman
- [ ] Cronjob payout automático (cada hora)
- [ ] Notificaciones push (confirmación, payout liberado)
- [ ] Testing E2E flow completo

### Milestone 4: Reprogramaciones & Cancelaciones (Semana 4)
- [ ] UI solicitar reprogramación (modal fecha/hora + motivo)
- [ ] Lógica aceptar/rechazar reprogramación
- [ ] Incrementar `rescheduled_count`, validar <= 2
- [ ] UI cancelar trabajo (warning penalty)
- [ ] Calcular penalty 15%, refund/payout según quién cancela

### Milestone 5: Pagos Efectivo & Balances (Semana 5)
- [ ] Migration tabla `balances`
- [ ] UI opción "Pagar en efectivo" (checkbox checkout)
- [ ] Validar profesional tiene tarjeta registrada
- [ ] Actualizar balance al confirmar trabajo cash
- [ ] Cronjob fin de mes cobrar tarjeta profesional
- [ ] UI bloquear profesional si deuda impaga

### Milestone 6: Auto-Release Timeout (Semana 6)
- [ ] Cronjob diario auto-release appointments expirados
- [ ] Notificaciones preventivas días 5, 6, 7
- [ ] UI "Pago liberado automáticamente" (cliente post-timeout)
- [ ] Admin panel extensión manual timeout (disputas)

### Milestone 7: Disputas (Preparación Fase 6) (Semana 7)
- [ ] Migration tabla `disputes`
- [ ] UI botón "Reportar problema" (hasta 48hs post-trabajo)
- [ ] Modal evidencia (textarea + upload fotos)
- [ ] Actualizar payment.status='disputed', bloquear payout
- [ ] Notificación admin (email/Slack)
- [ ] UI placeholder "En disputa - Admin mediará"

### Milestone 8: Testing & Compliance (Semana 8)
- [ ] E2E tests completos (Cypress o Detox)
- [ ] Export CSV mensual AFIP
- [ ] Logs detallados (Winston + Sentry)
- [ ] Alertas críticas (payout falla, signature inválida, deuda >30 días)
- [ ] Load testing webhook handler (100 webhooks/segundo)
- [ ] Security audit (penetration testing webhooks)

---

## 6. Testing Strategy

### Unit Tests

```typescript
describe('calculateCommission', () => {
  it('should return 0% for professional with card <1 year', () => {
    const professional = {
      credit_card_token: 'token_abc',
      created_at: new Date('2025-06-01'), // <1 año
    };
    
    const result = calculateCommission(10000, professional);
    
    expect(result.commissionPercentage).toBe(0);
    expect(result.commissionAmount).toBe(0);
    expect(result.netAmount).toBe(10000);
  });
  
  it('should return 10% for professional with card >1 year', () => {
    const professional = {
      credit_card_token: 'token_abc',
      created_at: new Date('2024-01-01'), // >1 año
    };
    
    const result = calculateCommission(10000, professional);
    
    expect(result.commissionPercentage).toBe(10);
    expect(result.commissionAmount).toBe(1000);
    expect(result.netAmount).toBe(9000);
  });
  
  it('should return 50% for professional without card', () => {
    const professional = {
      credit_card_token: null,
      created_at: new Date('2025-01-01'),
    };
    
    const result = calculateCommission(10000, professional);
    
    expect(result.commissionPercentage).toBe(50);
    expect(result.commissionAmount).toBe(5000);
    expect(result.netAmount).toBe(5000);
  });
});

describe('Webhook Signature Verification', () => {
  it('should accept valid signature', () => {
    const body = { id: 123, type: 'payment' };
    const secret = 'test_secret';
    const ts = Math.floor(Date.now() / 1000);
    
    const manifest = `id:${body.id};request-id:test-request-id;ts:${ts};`;
    const hash = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    
    const signature = `ts=${ts},v1=${hash}`;
    
    const isValid = verifyWebhookSignature(signature, body, secret);
    expect(isValid).toBe(true);
  });
  
  it('should reject invalid signature', () => {
    const signature = 'ts=123,v1=invalid_hash';
    const body = { id: 123 };
    const secret = 'test_secret';
    
    const isValid = verifyWebhookSignature(signature, body, secret);
    expect(isValid).toBe(false);
  });
});
```

### Integration Tests

```typescript
describe('Payment Flow E2E', () => {
  it('should create payment → webhook → appointment', async () => {
    // 1. Cliente acepta propuesta
    const proposal = await createTestProposal({ price: 8500 });
    
    // 2. Crear preferencia MP
    const { body } = await request(app)
      .post('/api/payments/create-preference')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ proposalId: proposal.id })
      .expect(200);
    
    expect(body.preferenceId).toBeDefined();
    
    // 3. Simular webhook MP (payment approved)
    const payment = await prisma.payment.findFirst({
      where: { proposal_id: proposal.id },
    });
    
    await request(app)
      .post('/webhooks/mercadopago')
      .send({
        type: 'payment',
        data: { id: 'mp_12345' },
      })
      .set('x-signature', generateValidSignature())
      .expect(200);
    
    // 4. Verificar payment actualizado
    const updatedPayment = await prisma.payment.findUnique({
      where: { id: payment.id },
    });
    
    expect(updatedPayment.status).toBe('completed');
    expect(updatedPayment.mercadopago_payment_id).toBe('mp_12345');
    
    // 5. Verificar appointment creado
    const appointment = await prisma.appointment.findUnique({
      where: { payment_id: payment.id },
    });
    
    expect(appointment).toBeDefined();
    expect(appointment.status).toBe('scheduled');
  });
});

describe('Mutual Confirmation Flow', () => {
  it('should trigger payout when both confirm', async () => {
    const appointment = await createTestAppointment();
    
    // 1. Profesional confirma
    await request(app)
      .post(`/api/appointments/${appointment.id}/confirm`)
      .set('Authorization', `Bearer ${professionalToken}`)
      .expect(200);
    
    let payment = await prisma.payment.findUnique({
      where: { id: appointment.payment_id },
    });
    
    expect(payment.payout_status).toBe('pending'); // Aún falta cliente
    
    // 2. Cliente confirma
    await request(app)
      .post(`/api/appointments/${appointment.id}/confirm`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);
    
    payment = await prisma.payment.findUnique({
      where: { id: appointment.payment_id },
    });
    
    expect(payment.payout_status).toBe('ready'); // Ambos confirmaron
  });
});
```

### Load Testing (K6)

```javascript
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 100, // 100 virtual users
  duration: '60s',
};

export default function () {
  // Simular 100 webhooks concurrentes/segundo
  const payload = JSON.stringify({
    type: 'payment',
    data: { id: `mp_${Date.now()}` },
  });
  
  const res = http.post('https://api.quickfixu.com/webhooks/mercadopago', payload, {
    headers: {
      'Content-Type': 'application/json',
      'x-signature': 'valid_signature_here',
    },
  });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

---

## 7. Security Considerations

### PCI Compliance
- ✅ **NO guardamos números de tarjeta** — Solo `credit_card_token` de MP (tokenizado)
- ✅ **NO manejamos CVV** — Checkout Pro lo hace
- ✅ **HTTPS obligatorio** — All requests (TLS 1.3)
- ✅ **Logs sanitizados** — No imprimir tokens, signatures, CVV

### Webhook Security
- ✅ **Signature verification HMAC-SHA256** — Rechazar webhooks sin firma válida
- ✅ **Rate limiting** — 100 webhooks/minuto por IP (evitar DDoS)
- ✅ **Idempotencia** — UNIQUE INDEX `mercadopago_payment_id`
- ✅ **Fetch payment desde API MP** — No confiar solo en webhook body

### AFIP Compliance
- ✅ **Export CSV mensual** — Todos los payments (completed + refunded)
- ✅ **Campos obligatorios:** DNI profesional, fecha, monto bruto, comisión, neto
- ✅ **Soft delete payments** — Guardar por 10 años (ley argentina)
- ✅ **Auditoría completa** — Logs Winston + Sentry de TODAS las transacciones

### Fraud Prevention
- ✅ **Límite máximo deuda** — ARS 20K (bloquear profesional si excede)
- ✅ **Bloqueo automático pago falla** — `is_blocked_for_debt=true`
- ✅ **Alertas admin** — Sentry + email si payout falla, signature inválida, deuda >30 días
- ✅ **Timeout auto-release** — 7 días (protege profesional de clientes fantasma)

---

## 8. Risks & Mitigations

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|-----------|
| **Webhook duplicado crea 2 payments** | ALTA | CRÍTICO | UNIQUE INDEX `mercadopago_payment_id`, upsert, log duplicados |
| **Webhook falso (atacante forja)** | MEDIA | CRÍTICO | Signature verification HMAC, rechazar sin firma válida, alertas Sentry |
| **Payout falla (API MP rechaza)** | MEDIA | ALTO | Retry 3 veces (exp backoff), payment.payout_status='failed', alerta admin urgente |
| **Race condition confirmación mutua** | BAJA | ALTO | Lock optimista WHERE `status='scheduled'`, rollback si falla |
| **Timeout auto-release error** | BAJA | MEDIO | Notificaciones preventivas días 5-7, admin puede extender manualmente |
| **Deuda balance crece sin control** | MEDIA | ALTO | Límite ARS 20K, bloquear profesional, plan de pagos manual |
| **Cliente reporta disputa post-payout** | MEDIA | MEDIO | Bloquear botón "Reportar" post-payout, refund manual admin |
| **Sandbox contamina producción** | ALTA (dev error) | CRÍTICO | Feature flag `USE_SANDBOX`, tabla `sandbox_payments` separada, banner UI "MODO PRUEBA" |
| **AFIP auditoría datos incompletos** | BAJA | CRÍTICO | Export CSV todos campos obligatorios, soft delete 10 años, testing export |

---

## 9. Open Questions (Resolver con Usuario)

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
   - ¿Habilitar desde MVP o solo post-año 1 (como dice PRD)?
   - ¿Mostrar en UI desde día 1 (grayed out año 1) o ocultar completamente?

6. **Testing:**
   - ¿Quién provee tarjetas de prueba MP (nosotros o cliente)?
   - ¿Ambiente staging con BD separada o feature flag en producción?

---

## 10. Success Metrics (Fase 4)

### Technical Metrics
- Webhook latency <500ms (p95)
- Payout success rate >98%
- Payment creation success rate >99%
- 0 webhooks con signature inválida aceptados
- 0 payments duplicados por mismo `mercadopago_payment_id`

### Business Metrics
- Payment completion rate >85% (clientes que llegan a checkout y completan pago)
- Mutual confirmation rate >90% (ambos confirman dentro de 7 días)
- Auto-release rate <10% (idealmente ambos confirman antes de timeout)
- Cancellation rate <5% (con penalty aplicado)
- Dispute rate <2% (reportes problemas)

### Compliance Metrics
- 100% payments exportables a CSV AFIP
- 0 payments sin snapshot comisión
- 100% webhooks con logs completos (Winston + Sentry)

---

## 11. Conclusion

La Fase 4 es **el corazón del negocio de QuickFixU**. Sin pagos seguros y appointments funcionales, el marketplace NO genera revenue. Esta exploración definió:

✅ **Arquitectura robusta:** Checkout Pro + escrow manual + confirmación mutua + timeout auto-release  
✅ **Seguridad financiera:** Signature verification webhooks + idempotencia + PCI compliance  
✅ **Compliance AFIP:** Snapshot comisiones + export CSV + logs auditables  
✅ **Flexibilidad Argentina:** Pagos efectivo + tracking deudas + cobro fin de mes  
✅ **UX profesional:** Transparencia comisiones + reprogramaciones (max 2) + penalizaciones justas (15%)  

**Next Steps:**
1. ✅ Aprobar exploración → crear `fase-4-proposal.md`
2. Resolver open questions con usuario (credenciales MP, límites)
3. Crear `fase-4-spec.md` (requirements detallados)
4. Crear `fase-4-design.md` (arquitectura técnica detallada)
5. Crear `fase-4-tasks.md` (breakdown implementación 8 milestones)
6. Implementar (8 semanas estimadas)

**Ready for Proposal:** ✅ **YES** — Todos los riesgos identificados, decisiones técnicas tomadas, plan de testing exhaustivo.

---

**Fin Exploration Fase 4 - Payments & Appointments**  
*Autor: Claude Code + Usuario*  
*Fecha: Marzo 2026*  
*Versión: 1.0*
