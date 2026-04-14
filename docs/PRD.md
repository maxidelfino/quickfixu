# Product Requirements Document (PRD)
# QuickFixU - Plataforma de Servicios Profesionales

**Versión:** 1.0  
**Fecha:** Marzo 2026  
**Autor:** Equipo QuickFixU  
**Estado:** Draft para MVP

---

## 1. Executive Summary

**QuickFixU** es una plataforma móvil bidireccional (marketplace) que conecta clientes con profesionales independientes en Argentina, comenzando con electricistas, plomeros y gasistas. La aplicación resuelve el problema crítico de encontrar profesionales confiables, comparar presupuestos y realizar pagos seguros en situaciones de urgencia doméstica.

### Propuesta de Valor Única

- **Para Clientes**: Acceso inmediato a profesionales verificados, presupuestos transparentes, chat en tiempo real, y pagos seguros con retención hasta confirmación del trabajo.
- **Para Profesionales**: Flujo constante de trabajos, visibilidad en su zona (30km), cobro garantizado, y 0% comisión el primer año (con tarjeta registrada).

### Diferenciadores Clave vs Competencia

1. **Feed de trabajos**: Los clientes publican problemas, los profesionales ofertan presupuestos (modelo inverso tipo Workana/Fiverr aplicado a servicios físicos)
2. **Seguridad financiera**: Retención de pago hasta confirmación mutua (reduce estafas)
3. **Reputación bidireccional**: Profesionales califican a clientes (evita usuarios problemáticos)
4. **Incentivo económico**: 0% comisión primer año con tarjeta registrada (acelera adopción)
5. **Verificación real**: OCR automático de certificaciones + validación manual admin

### Mercado Objetivo Inicial

- **Geografía**: Ciudad Autónoma de Buenos Aires (CABA) y Gran Buenos Aires (GBA)
- **Expansión Fase 2**: Interior de Argentina (Rosario, Córdoba, Mendoza)
- **Expansión Fase 3**: Países limítrofes (Uruguay, Chile, Paraguay)

### Modelo de Ingresos

- **Comisión por transacción**: 10% sobre el monto del trabajo (después del primer año)
- **Promoción inicial**: 0% comisión durante 12 meses para profesionales con tarjeta registrada
- **Fallback**: 50% comisión para profesionales sin tarjeta (desincentivar pagos fuera de plataforma)
- **Fase 2**: Planes Premium para destacar perfiles profesionales

### Métricas de Éxito (MVP - Primeros 6 meses)

**Números Conservadores y Realistas:**

- **Profesionales activos**: 200-300 (con al menos 1 trabajo completado/mes)
- **Clientes registrados**: 800-1,200 
- **Transacciones mensuales**: 150-250 (mes 6)
- **GMV (Gross Merchandise Value)**: ARS 1,500,000 - ARS 2,500,000 mensual (mes 6)
- **Retención profesionales**: 60% a 3 meses
- **Retención clientes**: 40% a 3 meses (uso repetido)
- **NPS (Net Promoter Score)**: >40

**Justificación de números conservadores:**
- Sin marketing agresivo inicial (crecimiento orgánico + redes sociales)
- Efecto red bilateral (necesitas masa crítica de ambos lados)
- Tiempo de validación de certificaciones manual (bottleneck inicial)
- Confianza en nueva plataforma se construye gradualmente

---

## 2. Vision & Mission

### Visión (2028)

Convertirnos en la plataforma líder de servicios profesionales en Latinoamérica, siendo la primera opción de millones de hogares cuando necesitan resolver problemas domésticos con profesionales confiables, rápidos y transparentes.

### Misión

Empoderar a profesionales independientes con herramientas digitales para crecer su negocio, mientras brindamos a clientes acceso inmediato a servicios de calidad con total transparencia y seguridad en cada transacción.

### Valores Core

1. **Confianza**: Verificación rigurosa, reputación transparente, pagos seguros
2. **Inmediatez**: Respuesta en minutos, no días
3. **Transparencia**: Precios claros, sin sorpresas, historial público
4. **Empoderamiento**: Profesionales dueños de su tiempo y tarifas
5. **Calidad**: Solo profesionales verificados, sistema de mejora continua

---

## 3. Problem Statement

### Problema del Cliente

**Situación actual:**
Cuando un caño explota a las 22hs o se corta la luz en pleno verano, los clientes enfrentan:

1. **Búsqueda caótica**: Googlear "plomero urgente", llamar 5-6 números de dudosa procedencia
2. **Desconfianza total**: No saben si es profesional real, si tiene matrícula, si cobra precio justo
3. **Negociación a ciegas**: Presupuestos telefónicos vagos, "tengo que ver", sorpresas al final
4. **Riesgo financiero**: Pagar cash por adelantado sin garantías, o pagar al final con trabajo mal hecho
5. **Sin recourse**: Si algo sale mal, no hay a quién reclamar

**Impacto emocional**: Estrés, ansiedad, sensación de vulnerabilidad, miedo a estafa.

### Problema del Profesional

**Situación actual:**
Electricistas, plomeros y gasistas independientes enfrentan:

1. **Marketing caro e ineficiente**: Volantes, páginas amarillas, grupos de WhatsApp, boca a boca
2. **Flujo de trabajo irregular**: Semanas sin llamadas, luego 10 pedidos simultáneos
3. **Clientes morosos**: "Te pago la semana que viene", fantasmas, regateo eterno
4. **Sin reputación digital**: 20 años de experiencia, pero cero presencia online
5. **Intermediarios abusivos**: Empresas que se quedan 30-40% de comisión

**Impacto económico**: Ingresos inestables, imposibilidad de planificar, subvaloración del trabajo.

### Validación del Problema

**Evidencia cualitativa:**
- Grupos de Facebook "Busco plomero urgente CABA" con miles de posts desesperados
- Reviews de apps competidoras quejándose de profesionales no verificados
- Foros de profesionales pidiendo "plataforma que no se quede con todo"

**Evidencia cuantitativa (estimada sector informal Argentina):**
- 60% de profesionales de oficios NO tienen presencia digital
- 75% de transacciones en efectivo (sin trazabilidad, riesgo para ambas partes)
- Tiempo promedio para conseguir profesional confiable: 2-3 días

---

## 4. Target Users & Personas

### Persona 1: Lucía - La Cliente Urbana Ocupada

**Demografía:**
- **Edad**: 32 años
- **Ocupación**: Analista de Marketing, trabaja remoto
- **Ubicación**: Palermo, CABA
- **Ingresos**: ARS 350,000/mes
- **Situación**: Vive sola en departamento alquilado

**Comportamiento:**
- Usa apps para todo (Rappi, PedidosYa, Mercado Libre)
- Prefiere pagar con tarjeta/MP, evita efectivo
- Lee reviews antes de cualquier compra
- Valora tiempo > dinero (pagaría 10-15% más por inmediatez)

**Pain Points:**
- Tuvo experiencia traumática con plomero que cobró ARS 15,000 por problema que no solucionó
- No conoce profesionales confiables (se mudó hace 1 año)
- Horario laboral 9-18hs, necesita coordinar visitas con anticipación

**Jobs to be Done:**
- "Cuando tengo una fuga de agua, necesito que alguien confiable venga HOY y me dé precio justo ANTES de empezar"

**Success Metrics:**
- Encuentra profesional en <30 minutos
- Precio dentro de su presupuesto (ARS 5,000 - ARS 20,000 para trabajos comunes)
- Problema resuelto en primera visita (95% de los casos)

---

### Persona 2: Roberto - El Profesional Independiente Experimentado

**Demografía:**
- **Edad**: 45 años
- **Ocupación**: Electricista matriculado (20 años experiencia)
- **Ubicación**: Villa Crespo, CABA
- **Ingresos**: ARS 400,000/mes (variable según temporada)
- **Situación**: Casado, 2 hijos, monotributista categoría H

**Comportamiento:**
- Usa WhatsApp para coordinar trabajos
- Tiene 30-40 clientes "fijos" pero busca expandirse
- Cobra mitad efectivo, mitad transferencia
- No tiene página web, solo perfil Facebook desactualizado

**Pain Points:**
- Meses flojos (mayo-junio) con 40% menos ingresos
- Clientes nuevos desconfían porque no tiene "presencia digital"
- Pierde tiempo en visitas donde el cliente finalmente no contrata
- Competencia desleal (changas sin matrícula que cobran mitad de precio)

**Goals:**
- Flujo constante de trabajos (mínimo 15 por mes)
- Clientes que paguen en tiempo y forma
- Construir reputación digital que respalde su experiencia
- Evitar intermediarios que cobran comisiones abusivas

**Success Metrics:**
- Mínimo 12 trabajos/mes en meses bajos
- 80% de propuestas enviadas resultan en contratación
- Cobro inmediato (no esperar 7-15 días)
- Rating >4.5 estrellas después de 50 trabajos

---

### Persona 3: Martín - El Joven Profesional Digital Native

**Demografía:**
- **Edad**: 28 años
- **Ocupación**: Gasista (3 años desde recibido)
- **Ubicación**: San Isidro, GBA Norte
- **Ingresos**: ARS 250,000/mes
- **Situación**: Soltero, vive con padres, ahorrando para independizarse

**Comportamiento:**
- Usa Mercado Libre, Instagram, TikTok activamente
- Acepta transferencias, Mercado Pago, cripto
- Busca formas de diferenciarse (contenido educativo en redes)
- Ambicioso, quiere escalar (contratar ayudante en 2 años)

**Pain Points:**
- Clientes mayores desconfían por ser "muy joven"
- Difícil competir con gasistas con 20 años de trayectoria
- Marketing digital caro (Google Ads, Instagram Ads)
- No sabe cómo hacer crecer su base de clientes rápido

**Goals:**
- Construir portafolio digital robusto (fotos, videos, reviews)
- Aparecer en más búsquedas que competencia
- Cobrar lo justo sin regateos eternos
- Tener 100+ reviews en 6 meses

**Success Metrics:**
- 20+ trabajos/mes en temporada alta
- Reviews que mencionen "profesional, puntual, precio justo"
- Ingresos mensuales creciendo 15% cada trimestre
- Convertirse en "Top Professional" en la app

---

## 5. Features & Requirements

### 5.1 MVP (Fase 1: 0-6 meses) - MUST HAVE

#### Feature 1: Onboarding Diferenciado

**Cliente:**
- Registro con email/password o OAuth (Google/Facebook)
- Validación email + SMS (phone)
- Datos: Nombre completo, DNI, Dirección (autocomplete Google Maps), Foto perfil (opcional)
- Geolocalización: Captura automática de lat/long desde dirección ingresada
- Tutorial interactivo: "Publica un problema" o "Busca profesionales"

**Profesional:**
- Mismo flujo inicial + pasos adicionales:
  - Profesión/categoría (Electricista/Plomero/Gasista - puede elegir múltiples)
  - Empresa/Compañía (opcional)
  - Tarifa por hora base (editable después)
  - Subir certificaciones/matrículas (PDF/JPG - OCR automático con Tesseract.js)
  - Tarjeta de crédito (tokenizada con MercadoPago) - INCENTIVO: "0% comisión primer año"
  - Horarios de disponibilidad (JSON: lunes-domingo, start-end times)
  - Radio de cobertura: Por defecto 30km, editable 10-50km

**Validación Profesional:**
- OCR extrae: Tipo certificación, Número, Fecha emisión, Fecha vencimiento
- Status inicial: "pending"
- Admin revisa manualmente (Fase 1: ~48hs de demora)
- Notificación push cuando status cambia a "approved" o "rejected"
- Si rejected: campo "rejection_reason" visible + opción re-subir

**Acceptance Criteria:**
- Cliente completa registro en <3 minutos
- Profesional completa registro en <8 minutos
- OCR tiene 80%+ accuracy en extracción de datos
- 95% profesionales aprobados en <72hs

---

#### Feature 2: Búsqueda y Descubrimiento de Profesionales

**Para Cliente:**

**Vista Principal: Buscar Profesionales**
- Filtros:
  - Categoría (Electricista/Plomero/Gasista)
  - Ordenar por: Distancia, Tarifa (menor-mayor), Rating (mayor-menor)
  - Radio: 10km, 20km, 30km (default), 50km
- Resultados:
  - Tarjeta con: Foto, Nombre, Rating (estrellas), Precio/hora, Distancia, Categorías
  - Badge "Verificado" si certificaciones aprobadas
  - Badge "0% comisión" si registró tarjeta
- Mapa inferior: Pins de profesionales (clustering si >20 resultados)

**Perfil de Profesional (vista detalle):**
- Header: Foto grande, Nombre, Empresa (si tiene), Rating + cantidad reviews
- Stats: Trabajos completados, Años experiencia (calculado desde created_at), Tiempo respuesta promedio
- Tarifas: Precio/hora + nota "Precio final se acuerda antes de empezar"
- Horarios: Grid visual lunes-domingo con rangos horarios
- Certificaciones: Lista con íconos check verde
- Reviews: Últimas 5 (con opción "Ver todas")
- Botón primario: "Enviar mensaje"
- Botón secundario: "Solicitar presupuesto" (pre-llena chat con template)

**Acceptance Criteria:**
- Búsqueda devuelve resultados en <2s (con 1000+ profesionales en BD)
- Mapa carga <3s
- Perfil carga en <1s
- Filtros responden en <500ms

---

#### Feature 3: Feed de Publicaciones de Problemas

**Para Cliente:**

**Crear Publicación (Post):**
- Campos:
  - Título (50 chars max): "Fuga de agua en cocina"
  - Descripción (500 chars max): Textarea con contador
  - Categorías (obligatorio): Checkboxes múltiple (puede necesitar electricista + plomero)
  - Ubicación: Por defecto usa dirección perfil, opción editar "El problema está en otra ubicación"
  - Media: Subir hasta 5 imágenes o 2 videos (15s max c/u)
  - Urgencia: "Normal" (48hs) o "Urgente" (12hs) - SOLO visual, no afecta lógica
- Preview antes de publicar
- Botón: "Publicar problema"

**Post publicado:**
- Status: "open"
- Expires_at: created_at + 48hs (cronjob marca como "expired")
- Visible en feed de profesionales en radio 30km
- Cliente ve: "Tu publicación está activa. Recibirás propuestas por mensaje."

**Gestión de publicaciones:**
- Sección "Mis publicaciones" con tabs: Activas, Cerradas, Expiradas
- Puede cerrar manualmente (status "closed")
- Contador: "5 propuestas recibidas"
- Soft delete después de 90 días (deleted_at)

**Para Profesional:**

**Feed de Trabajos:**
- Vista principal profesional: Timeline infinito con posts
- Filtros:
  - Mis categorías (default activado)
  - Radio: 10-50km
  - Ordenar: Más recientes, Más cercanos, Menos propuestas
- Tarjeta post:
  - Título, Descripción (truncada), Distancia, Tiempo publicado
  - Thumbnails media (si tiene)
  - Badge "Urgente" (si aplica)
  - Badge "3 propuestas" (si >1)
- Al hacer tap: Vista detalle completa + perfil cliente simplificado (rating, reviews)

**Enviar Propuesta:**
- Botón: "Enviar presupuesto"
- Modal:
  - Precio total (ARS)
  - Descripción trabajo (300 chars): "Incluye materiales" o "Solo mano de obra"
  - Fecha propuesta (date picker)
  - Hora propuesta (time picker)
  - Botón: "Enviar propuesta"
- Se crea proposal (status "pending") + mensaje automático en chat

**Acceptance Criteria:**
- Cliente crea post en <2 minutos
- Upload media funciona en 4G (compresión automática)
- Profesional ve post en feed <30s después publicación
- Profesional envía propuesta en <1 minuto

---

#### Feature 4: Chat en Tiempo Real

**Arquitectura:**
- WebSockets con Socket.io
- Conexión persistente mientras app en foreground
- Polling cada 30s si app en background (+ push notification)

**Features chat:**
- Mensajes texto (2000 chars max)
- Envío imágenes/videos (desde galería o cámara)
- Indicador "escribiendo..."
- Double check: Enviado (1 check), Entregado (2 checks grises), Leído (2 checks azules)
- Timestamp con formato relativo ("Hace 5 min", "Ayer 14:30")
- Scroll infinito hacia arriba (carga 50 mensajes por batch)

**Conversación inicial:**
- Cliente envía mensaje a profesional → Crea chat
- Profesional envía propuesta desde post → Crea chat + mensaje automático
- Template mensaje propuesta:
  ```
  📋 Nueva propuesta:
  💰 Precio: ARS X,XXX
  📅 Fecha: DD/MM
  🕐 Hora: HH:MM
  📝 Detalles: [descripción]
  
  [Botón: Ver propuesta completa]
  ```

**Gestión propuestas en chat:**
- Cliente ve propuesta como card especial en chat
- Botones: "Aceptar" o "Rechazar" o "Negociar" (responder mensaje)
- Si acepta: Modal confirma → Redirige a pantalla Pago
- Si rechaza: Propuesta se marca "rejected", sigue pudiendo chatear

**Lista de chats:**
- Ordenada por last_message_at (más reciente arriba)
- Badge rojo con cantidad mensajes no leídos
- Preview último mensaje (truncado)
- Avatar + nombre otro usuario
- Timestamp relativo

**Acceptance Criteria:**
- Latencia mensaje <500ms (red estable)
- Imágenes se comprimen a <500KB antes envío
- Notificación push llega en <5s si app cerrada
- Chat funciona offline (mensajes en cola, envío al reconectar)

---

#### Feature 5: Sistema de Propuestas y Agendamiento

**Flujo completo:**

1. **Profesional crea propuesta** (desde feed o chat)
2. **Cliente recibe notificación** → Ve propuesta en chat
3. **Cliente acepta propuesta**:
   - Proposal.status → "accepted"
   - Se crea **Appointment**:
     - proposal_id (FK)
     - scheduled_date (de propuesta)
     - scheduled_time (de propuesta)
     - status: "scheduled"
     - rescheduled_count: 0
   - Otras propuestas del mismo post → status "rejected" (auto)
   - Post.status → "closed"

4. **Cliente paga**:
   - Redirige a pantalla Checkout (Feature 6)
   - Se crea **Payment** (status "pending")

5. **Día del trabajo**:
   - Push notification a ambos: "Recordatorio: Trabajo hoy a las [hora]"
   - Profesional puede marcar: "En camino" (status appointment → "in_progress")

6. **Después del trabajo**:
   - Profesional marca: "Trabajo completado"
   - Cliente recibe notificación: "¿Confirmas que el trabajo fue completado?"
   - Cliente confirma → Payment.status → "completed", Appointment.status → "completed"
   - Ambos reciben notificación: "Califica tu experiencia"

**Reprogramaciones:**
- Cualquiera de los dos puede solicitar (botón en detalle appointment)
- Modal: Nueva fecha/hora + Motivo (opcional)
- Notificación al otro usuario con botones: "Aceptar" o "Rechazar"
- Si acepta: rescheduled_count + 1, scheduled_date/time actualizados
- Si rescheduled_count > 2: "Límite alcanzado. Debes cancelar o mantener esta fecha."

**Cancelaciones:**
- Botón "Cancelar trabajo" (hasta 12hs antes)
- Modal: "¿Estás seguro? Se aplicará penalización 15%"
- Si confirma:
  - Appointment.status → "cancelled_by_[client|professional]"
  - Appointment.cancellation_reason → texto motivo
  - Appointment.penalty_applied → true
  - Payment: Se calcula penalty (15% del amount)
    - Si cancela cliente: penalty va a profesional
    - Si cancela profesional: penalty se devuelve a cliente (refund MP)
  - Notificación a ambos con explicación penalización

**Acceptance Criteria:**
- Flujo completo (propuesta → pago → trabajo → review) tiene <5 pasos por usuario
- Reprogramaciones se resuelven en <2 minutos
- Penalización se calcula y aplica automáticamente
- Recordatorios llegan 24hs antes y 1h antes

---

#### Feature 6: Pagos Seguros con MercadoPago

**Integración:**
- SDK MercadoPago para React Native
- Tokenización de tarjetas en backend (PCI compliance)
- Webhooks para notificaciones de estado pago

**Checkout:**
- Pantalla resumen:
  - Descripción trabajo
  - Profesional (nombre + rating)
  - Fecha/hora agendada
  - Subtotal: ARS X,XXX
  - Comisión app: ARS XXX (10% o 0% primer año) - TRANSPARENTE
  - Total: ARS X,XXX
- Métodos pago:
  - Tarjeta crédito/débito (MP)
  - Mercado Pago (saldo + cuotas)
  - Efectivo (genera "deuda" para profesional, solo si ya pasó primer año)
- Botón: "Pagar ahora"

**Flujo pago tarjeta/MP:**
- Cliente ingresa datos o selecciona método MP
- Backend crea preferencia MP
- Cliente completa pago (webview MP)
- Webhook notifica backend → Payment.status → "completed"
- Dinero se retiene en QuickFixU
- Cuando ambos confirman trabajo completado → Payout a profesional (API MP)

**Flujo pago efectivo (solo post primer año):**
- Cliente selecciona "Efectivo"
- Payment.payment_method → "cash"
- Payment.status → "pending" (hasta confirmación trabajo)
- Al confirmar trabajo completado:
  - Payment.status → "completed"
  - Se crea/actualiza **Balance** para profesional:
    - Balance.balance -= commission_amount (deuda)
- Cronjob último día del mes:
  - Calcula total balance negativo
  - Cobra de tarjeta registrada profesional (API MP)
  - Si pago exitoso: Balance.balance → 0, Balance.last_settlement_date → now
  - Si pago falla: Notificación profesional + bloqueo de recibir nuevos trabajos hasta saldar

**Comisiones (transparencia):**
- En todo momento visible cuánto se lleva app
- Año 1 con tarjeta registrada: 0% → Professional ve "ARS X,XXX (sin comisión)"
- Año 1 sin tarjeta: 50% → Professional ve "ARS X,XXX (comisión 50%: -ARS XXX) = ARS XXX neto"
- Post año 1: 10% → Professional ve "ARS X,XXX (comisión 10%: -ARS XXX) = ARS XXX neto"

**Disputas/Problemas:**
- Si cliente no confirma trabajo después 7 días: Payout automático a profesional (+ notificación cliente)
- Si cliente reporta problema: Se retiene pago, admin media (Fase 2)
- Botón "Reportar problema" activo hasta 48hs después trabajo

**Acceptance Criteria:**
- Checkout carga en <2s
- Pago se completa en <30s (flow MP)
- Webhook procesa en <5s
- Payout a profesional en <24hs después confirmación
- Comisiones calculadas con precisión 100% (testing riguroso)

---

#### Feature 7: Sistema de Reputación Bidireccional

**Trigger:**
- Appointment.status == "completed" + Payment.status == "completed"
- Notificación push a ambos: "Califica tu experiencia con [nombre]"
- Botón en app: "Dejar reseña"

**Formulario review:**
- Rating: 1-5 estrellas (obligatorio)
- Comentario: Textarea 500 chars (opcional)
- Categorías sugeridas (chips, opcional):
  - Para profesional: "Puntual", "Profesional", "Precio justo", "Resolvió problema", "Comunicativo"
  - Para cliente: "Puntual en pago", "Comunicativo", "Ambiente de trabajo adecuado", "Respetuoso"
- Botón: "Enviar reseña"

**Publicación:**
- Review.appointment_id → FK (1 review por appointment por usuario)
- Review.reviewer_id → quien califica
- Review.reviewed_id → quien recibe calificación
- Ambas reviews se publican simultáneamente (para evitar bias)
- Si solo 1 califica en 7 días: Se publica sola, se cierra ventana para el otro

**Display reviews:**
- En perfil usuario:
  - Rating promedio (2 decimales) + total reviews
  - Gráfico barras (5⭐: X%, 4⭐: X%, etc.)
  - Lista reviews ordenada por reciente
  - Cada review: Avatar reviewer, Nombre, Rating, Fecha, Comentario, Categorías (chips)
- Filtros: "Todas", "5 estrellas", "Críticas (<3 estrellas)"

**Protección anti-abuse:**
- No se puede editar review después de enviada
- No se puede borrar (salvo admin en casos extremos)
- Usuario no puede ver review del otro hasta publicar la suya (evita venganza)

**Apelaciones (Fase 2):**
- Botón "Reportar review inapropiada"
- Admin revisa caso
- Si procede: Review oculta (no borrada, por auditoría)

**Acceptance Criteria:**
- Notificación review llega <1h después completar trabajo
- Review se publica en <5s
- Rating promedio actualiza en tiempo real
- Review inapropiada (insultos, amenazas) se puede reportar fácilmente

---

#### Feature 8: Notificaciones Push

**Triggers clave (MVP):**

**Para Cliente:**
1. Nueva propuesta recibida en post publicado
2. Profesional respondió mensaje (si app cerrada)
3. Propuesta aceptada expirará en 24hs
4. Recordatorio trabajo: 24hs antes y 1h antes
5. Profesional marcó "trabajo completado"
6. Profesional solicitó reprogramación
7. Recordatorio dejar review (1h, 24hs, 7 días después trabajo)

**Para Profesional:**
8. Nuevo post publicado en tu categoría y radio
9. Cliente respondió mensaje
10. Cliente aceptó tu propuesta
11. Cliente pagó (trabajo confirmado)
12. Recordatorio trabajo: 24hs antes y 1h antes
13. Cliente confirmó trabajo completado (dinero disponible)
14. Cliente solicitó reprogramación
15. Recordatorio dejar review

**Configuración (MVP básico):**
- Toggle on/off por categoría en Ajustes
- Opción "No molestar" por horario (ej: 22hs-8hs)

**Implementación:**
- Firebase Cloud Messaging (FCM)
- fcm_token en users (actualizado en cada login)
- Backend envía notificaciones vía FCM API
- React Native: @react-native-firebase/messaging

**Acceptance Criteria:**
- Notificaciones llegan en <10s (red estable)
- Deep link abre pantalla correcta (ej: notif "nueva propuesta" → abre chat)
- Usuario puede silenciar categorías específicas
- No enviar si usuario tiene app abierta en esa pantalla

---

#### Feature 9: Calendario de Trabajos (Profesional)

**Vista:**
- Tab "Calendario" en bottom navigation profesional
- Vista por defecto: Semana (7 días)
- Cada appointment es card en timeline:
  - Hora inicio (de scheduled_time)
  - Título post + nombre cliente
  - Dirección (con mapa thumbnail o botón "Abrir en Google Maps")
  - Status badge: "Confirmado", "En progreso", "Completado"
- Botón "+" para agregar nota personal (no visible para cliente)

**Navegación:**
- Swipe left/right para cambiar semana
- Botón "Hoy" para volver a semana actual
- Al tap en card: Detalle completo appointment con opciones:
  - Ver chat con cliente
  - Llamar cliente (si tiene phone)
  - Cómo llegar (abre Google Maps)
  - Reprogramar
  - Cancelar
  - Marcar "En camino" / "Completado"

**Integraciones futuras (Fase 2):**
- Sincronización con Google Calendar
- Export a .ics
- Notificación si appointments se solapan (warning)

**Acceptance Criteria:**
- Vista carga en <1s con 50+ appointments
- Swipe responsive (<100ms)
- Botón "Cómo llegar" abre Google Maps con lat/long correctos

---

#### Feature 10: Perfiles y Configuración

**Perfil Cliente:**
- Secciones editables:
  - Foto perfil (upload nuevo o desde galería)
  - Nombre completo
  - Email (no editable, solo ver)
  - Teléfono
  - DNI (validación formato argentino)
  - Dirección (autocomplete Google Maps + actualiza lat/long)
- Secciones solo lectura:
  - Rating promedio
  - Cantidad trabajos completados
  - Reviews recibidas (últimas 5 + botón "Ver todas")
  - Miembro desde: [fecha]
- Botón "Guardar cambios" abajo

**Perfil Profesional:**
- Todo lo anterior +
  - Empresa/Compañía (opcional)
  - Categorías (multi-select: Electricista, Plomero, Gasista)
  - Tarifa por hora (editable, con note "Precio final se acuerda con cliente")
  - Radio cobertura (slider 10-50km)
  - Horarios disponibilidad:
    - Grid lunes-domingo
    - Por cada día: Toggle "Disponible" + time pickers inicio/fin
    - Botón "Copiar a todos los días"
  - Certificaciones:
    - Lista con status (Aprobada ✅, Pendiente ⏳, Rechazada ❌)
    - Botón "Agregar nueva certificación"
    - Si rechazada: ver motivo + botón "Resubir"
  - Tarjeta de crédito:
    - Solo muestra últimos 4 dígitos (tokenizada)
    - Botón "Actualizar tarjeta"
    - Banner incentivo: "🎉 0% comisión activa hasta [fecha]"
- Stats adicionales:
  - Trabajos completados este mes
  - Ingresos totales (bruto)
  - Progreso bono fidelización (si aplica Fase 2)

**Configuración (ambos roles):**
- Notificaciones:
  - Toggle por tipo (propuestas, mensajes, recordatorios)
  - Horario "No molestar"
- Privacidad:
  - Quién puede ver mi teléfono (Nadie / Después aceptar propuesta / Todos)
- Seguridad:
  - Cambiar contraseña
  - Cerrar sesión en todos los dispositivos
- Legal:
  - Términos y condiciones
  - Política privacidad
  - Centro de ayuda (FAQ)
- Soporte:
  - Botón "Contactar soporte" (abre chat con admin Fase 2 o email Fase 1)

**Acceptance Criteria:**
- Edición perfil guarda cambios en <2s
- Validaciones client-side (DNI formato, teléfono formato +54)
- Subir foto perfil comprime a <200KB
- Horarios disponibilidad se reflejan en búsquedas inmediatamente

---

### 5.2 Fase 2 (6-12 meses) - SHOULD HAVE

#### Feature 11: Panel de Administración Web

**Usuarios:**
- Lista paginada con filtros (role, status, created_at)
- Ver perfil completo
- Acciones: Bloquear/Desbloquear, Ver historial transacciones, Ver reviews

**Certificaciones pendientes:**
- Queue ordenada por created_at
- Ver documento uploaded + datos extraídos OCR
- Botones: "Aprobar" o "Rechazar" (con campo motivo)
- Stats: Promedio tiempo aprobación, % aprobadas vs rechazadas

**Disputas:**
- Lista reportes abiertos
- Ver evidencia ambas partes (chat, fotos, pagos)
- Acciones: Contactar usuarios, Liberar pago, Reembolsar, Cerrar sin acción
- Notas internas (no visibles para usuarios)

**Métricas:**
- Dashboard: GMV, Transacciones, Nuevos usuarios, Retención, NPS
- Gráficos temporales (últimos 30 días)
- Funnel conversión (registro → primer trabajo)

---

#### Feature 12: Bonos de Fidelización

**Regla:**
- Cada 20 trabajos completados = Bono 25% del total de esos 20 trabajos

**Implementación:**
- Tabla bonuses (professional_id, jobs_completed_count, bonus_amount, status)
- Cronjob diario: Verifica si professional alcanzó múltiplo de 20 trabajos
- Si alcanza: Crea bonus (status "pending")
- Notificación profesional: "🎉 Desbloqueaste bono de ARS X,XXX por 20 trabajos completados"
- Profesional puede solicitar payout en Perfil → Bonos
- Admin aprueba → Payout vía MP → Bonus.status = "paid"

---

#### Feature 13: Planes Premium Profesionales

**Tiers:**
- **Gratis**: Todo lo actual MVP
- **Premium** (ARS 15,000/mes):
  - Badge "Premium" en perfil
  - Aparece primero en búsquedas y feed
  - 3 "destacados" por semana (su perfil se muestra en banner home clientes)
  - Estadísticas avanzadas (views perfil, tasa conversión propuestas)
- **Elite** (ARS 30,000/mes):
  - Todo Premium +
  - Soporte prioritario
  - Acceso beta nuevas features
  - Perfil personalizable (colores, banner)

---

#### Feature 14: Expansión Profesiones

- Agregar categorías: Niñeras, Paseadores perros, Jardineros, Cerrajeros, Pintores
- Mismo flow, ajustar certificaciones requeridas por profesión

---

#### Feature 15: Videollamadas en Chat

- Integración Twilio Video o Agora
- Botón "Llamar" en chat (solo si ambos online)
- Útil para mostrar problema en tiempo real antes de visita

---

#### Feature 16: Versión Web Cliente

- Progressive Web App (PWA)
- Mismo stack frontend (React + Expo Web)
- Solo para clientes (profesionales siguen en mobile)
- Features: Publicar post, Buscar profesionales, Chat, Gestionar appointments

---

### 5.3 Fase 3 (12-24 meses) - NICE TO HAVE

#### Feature 17: Planes de Mantenimiento

- Cliente puede contratar "paquete" con profesional (ej: 4 visitas/año electricista)
- Pago único con descuento
- Profesional tiene ingresos predecibles

#### Feature 18: Marketplace de Materiales

- Integración con proveedores (ej: easy.com.ar)
- Profesional puede agregar materiales al presupuesto
- Cliente aprueba
- QuickFixU cobra comisión sobre materiales también

#### Feature 19: Sistema de Aprendices

- Profesionales pueden listar "Busco ayudante"
- Otros usuarios aplican
- Sub-marketplace de empleo dentro de app

#### Feature 20: IA para Detección de Problemas

- Cliente sube foto problema
- IA identifica (ej: "Fuga en junta flexible, urgencia media, costo estimado ARS 5,000-8,000")
- Auto-sugiere categoría profesional

---

## 6. User Flows

### 6.1 Flow Cliente: Desde Problema a Solución

**Escenario:** Lucía tiene fuga de agua en cocina (22hs, urgente)

1. **Descubrimiento y Registro (5 min)**
   - Busca "plomero urgente" en Google → Ve ad QuickFixU
   - Descarga app
   - Registro rápido: Google OAuth → Nombre, Dirección, Teléfono
   - Tutorial: "Publica tu problema y recibe presupuestos en minutos"

2. **Publicación (3 min)**
   - Tap "Publicar problema"
   - Título: "Fuga de agua debajo pileta cocina"
   - Descripción: "Perdida constante, mojó gabinete, urgente"
   - Categoría: Plomero ✅
   - Sube 2 fotos: fuga + gabinete mojado
   - Marca "Urgente"
   - Tap "Publicar"
   - Confirmación: "Tu problema está publicado. Te avisaremos cuando recibas propuestas."

3. **Recepción Propuestas (15-30 min)**
   - [5 min] Notificación: "Roberto envió una propuesta"
   - Abre app → Chat con Roberto
   - Ve propuesta: ARS 8,500, Mañana 8am, "Incluye materiales junta flexible"
   - Ve perfil Roberto: 4.8⭐, 87 trabajos, Electricista/Plomero, "Verificado"
   - [10 min] Notificación: "Martín envió propuesta"
   - Propuesta Martín: ARS 7,200, Mañana 10am, "Solo mano obra, materiales aparte"
   - [15 min] Notificación: "Carlos envió propuesta"
   - Propuesta Carlos: ARS 12,000, "Hoy mismo 23hs", "Servicio urgente incluido"

4. **Selección y Negociación (10 min)**
   - Lucía compara: Roberto (mejor rating, precio medio, mañana temprano)
   - Chatea con Roberto: "¿Podés 9am? Entro a trabajar 10am"
   - Roberto: "Dale, perfecto. Confirmo 9am."
   - Lucía: "Acepto propuesta" (tap botón en card propuesta)
   - Otras propuestas → Auto-rechazadas
   - Post cierra automáticamente

5. **Pago (2 min)**
   - Redirige a checkout:
     - Reparación fuga cocina - Roberto
     - 21/03/2026 9:00am
     - Subtotal: ARS 8,500
     - Comisión QuickFixU: ARS 0 (Promoción)
     - Total: ARS 8,500
   - Mercado Pago (ya tiene configurado)
   - Tap "Pagar ahora"
   - Confirmación: "Pago exitoso. Roberto recibirá el dinero cuando confirmes que el trabajo fue completado."

6. **Día del Trabajo (mañana 9am)**
   - [8am] Notificación: "Recordatorio: Roberto llegará en 1 hora"
   - [8:50am] Notificación: "Roberto está en camino"
   - [9:10am] Roberto llega, soluciona fuga (30 min trabajo)
   - [9:45am] Roberto en app: "Trabajo completado"
   - [9:46am] Lucía recibe notificación: "¿Confirmas que Roberto completó el trabajo?"
   - Lucía abre app, ve opciones: "Sí, está perfecto" o "Hay un problema"
   - Tap "Sí, está perfecto"
   - Confirmación: "Pago liberado a Roberto. ¡Gracias por usar QuickFixU!"

7. **Review (1h después)**
   - Notificación: "Califica tu experiencia con Roberto"
   - Abre formulario:
     - Rating: 5⭐
     - Comentario: "Súper profesional, rápido y prolijo. Lo recomiendo 100%"
     - Chips: Puntual ✅, Profesional ✅, Precio justo ✅
   - Tap "Enviar reseña"
   - Confirmación: "Gracias por tu opinión. Ayuda a otros usuarios."

**Total tiempo activo cliente:** ~25 minutos en 24hs  
**Tiempo real hasta solución:** <12hs (vs 2-3 días método tradicional)

---

### 6.2 Flow Profesional: Desde Registro a Primer Cobro

**Escenario:** Martín (gasista joven) quiere expandir su base de clientes

1. **Descubrimiento (vía redes sociales)**
   - Ve ad Instagram QuickFixU: "0% comisión primer año"
   - Tap "Descargar app"

2. **Registro (8 min)**
   - Email + contraseña
   - Datos: Martín López, DNI 38.456.789, +54 9 11 4567-8901
   - Dirección: Av. Libertador 1234, San Isidro
   - Categoría: Gasista ✅
   - Tarifa: ARS 4,500/hora
   - Horarios:
     - Lunes-Viernes: 8am-18pm
     - Sábado: 9am-13pm
     - Domingo: No disponible
   - Radio: 30km
   - Subir matrícula gasista (foto PDF con celular)
   - OCR extrae: Matrícula N° 12345, Vence 15/08/2027
   - Registra tarjeta Visa débito (tokenizada MP)
   - Confirmación: "Tu perfil está en revisión. Te notificaremos en 24-48hs."

3. **Aprobación (24hs después)**
   - Notificación: "¡Tu perfil fue aprobado! Ya podés recibir trabajos."
   - Abre app, ve feed de trabajos

4. **Primer Trabajo - Feed (30 min después aprobación)**
   - Post nuevo en feed: "Calefón no enciende, hace ruido raro"
   - Distancia: 8km de Martín
   - Publicado: Hace 10 min
   - 0 propuestas aún
   - Martín tap en post → Ve detalle completo + 3 fotos calefón
   - Ve perfil cliente (Ana Martínez): 4.5⭐, 3 trabajos previos
   - Martín tap "Enviar presupuesto"

5. **Creación Propuesta (2 min)**
   - Precio: ARS 6,000
   - Descripción: "Revisión completa calefón, probable limpieza quemadores. Incluye repuestos menores."
   - Fecha: Mañana 22/03
   - Hora: 14:00pm
   - Tap "Enviar propuesta"
   - Confirmación: "Propuesta enviada. Te avisaremos si Ana responde."

6. **Cliente Acepta (1h después)**
   - Notificación: "🎉 Ana aceptó tu propuesta"
   - Notificación: "💰 Ana pagó ARS 6,000. Dinero disponible al completar trabajo."
   - Martín ve en Calendario: Mañana 14hs, Casa Ana (Dirección + mapa)

7. **Día del Trabajo (mañana 14hs)**
   - [13hs] Recordatorio notificación
   - [13:50hs] Martín tap "En camino"
   - [14:10hs] Llega, soluciona (limpió quemadores + ajustó electroválvula)
   - [15:00hs] Martín tap "Trabajo completado"
   - [15:02hs] Ana confirma
   - Notificación Martín: "¡Trabajo confirmado! ARS 6,000 disponibles en 24hs."

8. **Payout (24hs después)**
   - QuickFixU procesa payout vía MP a cuenta Martín
   - Notificación: "💸 Recibiste ARS 6,000 (sin comisión - primer año)"
   - Martín ve en Perfil: "1 trabajo completado, ARS 6,000 ganados este mes"

9. **Review (30 min después trabajo)**
   - Notificación: "Califica a Ana"
   - Rating: 5⭐
   - Comentario: "Excelente predisposición, pagó al instante, recomendada"
   - Chips: Puntual en pago ✅, Comunicativa ✅

**Total tiempo activo profesional:** ~15 minutos en 48hs  
**Tiempo hasta primer cobro:** 48hs (vs semanas/meses en método tradicional)

---

## 7. Technical Architecture

### 7.1 Stack Completo

**Frontend:**
- **Framework**: React Native 0.73+ (Expo 50+)
- **Lenguaje**: TypeScript 5.0+
- **Estado**: Zustand (alternativa ligera a Redux para MVP)
- **Navegación**: React Navigation 6
- **UI Components**: React Native Paper (Material Design) + custom components
- **Formularios**: React Hook Form + Zod (validación)
- **HTTP Client**: Axios con interceptors
- **WebSockets**: Socket.io-client
- **Mapas**: react-native-maps (Google Maps)
- **Notificaciones**: @react-native-firebase/messaging
- **Storage local**: AsyncStorage (offline persistence)
- **Imágenes**: react-native-fast-image (caching) + react-native-image-picker

**Backend:**
- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js 4.18+
- **Lenguaje**: TypeScript 5.0+
- **ORM**: Prisma 5+ (type-safe, migrations automáticas)
- **Validación**: Zod (compartido con frontend)
- **Autenticación**: JWT (access token 15min, refresh token 7 días)
- **WebSockets**: Socket.io 4+
- **Jobs**: node-cron (cronjobs)
- **Logging**: Winston + Morgan
- **Monitoreo**: Sentry (errores) + LogRocket (session replay Fase 2)

**Base de Datos:**
- **PostgreSQL** 15+ con extensiones:
  - **PostGIS** (geolocalización)
  - **pg_trgm** (full-text search trigrams)
- **Redis** (sesiones, cache, rate limiting)

**Storage:**
- **Cloudinary** (imágenes/videos) - Free tier: 25GB storage, 25GB bandwidth/mes
- **Alternativa**: Supabase Storage (más control, mismo pricing)

**APIs Terceros:**
- **MercadoPago SDK**: Pagos, tokenización, webhooks
- **Google Maps API**: Geocoding (dirección → lat/long), Autocomplete
- **Firebase Cloud Messaging**: Push notifications
- **Tesseract.js**: OCR certificaciones (browser-based, sin costo)

**Hosting:**
- **Backend**: Railway.app o Render.com (Free tier + upgrade $7-20/mes)
- **Base de Datos**: Railway PostgreSQL o Supabase (Free tier: 500MB, suficiente MVP)
- **Redis**: Upstash (Free tier: 10K comandos/día)
- **Frontend**: Expo Application Services (build iOS/Android)

**DevOps:**
- **Git**: GitHub (privado)
- **CI/CD**: GitHub Actions (testing + deploy automático)
- **Environments**: Development, Staging, Production
- **Secrets**: GitHub Secrets + .env files (nunca commiteados)

---

### 7.2 Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────┐
│                         MOBILE APP                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │  Cliente   │  │Profesional │  │   Shared   │               │
│  │  Screens   │  │  Screens   │  │ Components │               │
│  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘               │
│         │                │                │                      │
│         └────────────────┴────────────────┘                     │
│                          │                                       │
│                  ┌───────▼────────┐                             │
│                  │  State Manager │ (Zustand)                   │
│                  │  + API Client  │ (Axios)                     │
│                  └───────┬────────┘                             │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                ┌──────────┴───────────┐
                │                      │
         HTTP/REST                WebSockets
                │                      │
┌───────────────▼──────────────────────▼───────────────────────────┐
│                       BACKEND API                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │    Auth     │  │     API     │  │  WebSocket  │             │
│  │ Middleware  │  │   Routes    │  │   Handler   │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                      │
│         └────────────────┴────────────────┘                     │
│                          │                                       │
│                  ┌───────▼────────┐                             │
│                  │   Controllers  │                             │
│                  └───────┬────────┘                             │
│                          │                                       │
│                  ┌───────▼────────┐                             │
│                  │    Services    │ (Business Logic)            │
│                  └───────┬────────┘                             │
│                          │                                       │
│                  ┌───────▼────────┐                             │
│                  │  Prisma Client │                             │
│                  └───────┬────────┘                             │
└──────────────────────────┼──────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
┌────────▼────────┐ ┌──────▼──────┐ ┌───────▼────────┐
│   PostgreSQL    │ │    Redis    │ │   Cloudinary   │
│   + PostGIS     │ │   (Cache)   │ │   (Storage)    │
└─────────────────┘ └─────────────┘ └────────────────┘
         │
         │
┌────────▼────────────────────────────────────────────────────────┐
│                    EXTERNAL APIs                                 │
│  ┌──────────┐  ┌───────────┐  ┌──────┐  ┌──────────────┐      │
│  │   MP     │  │   FCM     │  │ GMaps│  │ Tesseract.js │      │
│  │ Payments │  │   Push    │  │ Geo  │  │     OCR      │      │
│  └──────────┘  └───────────┘  └──────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

---

### 7.3 Decisiones Técnicas Clave

#### 1. **PostgreSQL + PostGIS vs MongoDB**

**Decisión:** PostgreSQL + PostGIS

**Razones:**
- **Transacciones ACID**: Pagos requieren consistencia total (no eventual)
- **Relaciones complejas**: Users ↔ Professionals ↔ Proposals ↔ Payments (JOIN eficientes)
- **Geolocalización nativa**: PostGIS tiene queries Haversine optimizadas + índices GIST
- **Prisma ORM**: Type-safety + migrations automáticas (dev experience superior)
- **Escalabilidad vertical**: 10K usuarios no requieren sharding (MongoDB overkill)

**Trade-offs:**
- Menos flexible para cambios schema (vs Mongo schemaless)
- Mitigation: Prisma migrations bien documentadas, backward compatibility

---

#### 2. **Zustand vs Redux Toolkit**

**Decisión:** Zustand

**Razones:**
- **Simplicidad**: 90% menos boilerplate que Redux
- **Performance**: Re-renders selectivos sin necesidad de selectors memoizados
- **Bundle size**: 1KB vs 11KB (RTK)
- **Suficiente para MVP**: Estado no es excesivamente complejo

**Trade-offs:**
- Menos herramientas debug (vs Redux DevTools)
- Mitigation: Zustand tiene middleware devtools, suficiente para MVP

---

#### 3. **Socket.io vs WebSocket nativo**

**Decisión:** Socket.io

**Razones:**
- **Fallback automático**: Si WebSocket falla, usa long-polling
- **Rooms**: Perfecto para chats 1-to-1 (room = chat_id)
- **Reconnection**: Manejo automático de desconexiones
- **Broadcasting**: Enviar a grupos (ej: todos profesionales categoría X en radio Y)

**Trade-offs:**
- Overhead protocol (vs WS puro)
- Mitigation: Para chat/notificaciones, latencia adicional irrelevante (<50ms)

---

#### 4. **JWT vs Session-based Auth**

**Decisión:** JWT (access + refresh tokens)

**Razones:**
- **Stateless**: No requiere storage de sesiones en servidor (escalabilidad)
- **Mobile-friendly**: Tokens en AsyncStorage, refresh automático
- **Cross-platform**: Mismo token para mobile + web (Fase 2)

**Implementación:**
- Access token: 15 minutos (en memoria, no AsyncStorage por seguridad)
- Refresh token: 7 días (AsyncStorage, httpOnly si web)
- Refresh endpoint: `/auth/refresh` (rotación de refresh token)

**Trade-offs:**
- No se puede invalidar JWT antes de expirar (logout forzado difícil)
- Mitigation: TTL corto (15min) + blacklist Redis para casos críticos (baneos)

---

#### 5. **Cloudinary vs AWS S3**

**Decisión:** Cloudinary (MVP), S3 (post-PMF)

**Razones MVP:**
- **Free tier generoso**: 25GB storage + 25GB bandwidth
- **Transformaciones automáticas**: Resize, compress, format (WebP)
- **URL directo**: No necesitas signed URLs complejas
- **CDN incluido**: Latencia baja global

**Cuándo migrar a S3:**
- Cuando superes free tier (estimado: >5K usuarios activos)
- Costo S3: ~$0.023/GB/mes storage + $0.09/GB bandwidth (10x más barato a escala)

---

#### 6. **Tesseract.js vs AWS Textract**

**Decisión:** Tesseract.js (MVP)

**Razones:**
- **Gratis**: Open source, cero costo
- **Suficientemente preciso**: 80-85% accuracy en certificaciones argentinas (font estándar)
- **Privacidad**: Datos no salen del servidor
- **Async worker threads**: No bloquea event loop Node.js

**Cuándo migrar a Textract:**
- Si accuracy <75% en producción (demasiados falsos rechazos)
- Si volumen certificaciones >1000/mes (Textract más optimizado)
- Costo Textract: $1.50 por 1000 páginas (aceptable post-PMF)

---

### 7.4 Geolocalización: Implementación Detallada

**Problema:** Buscar profesionales en radio 30km con <2s latency

**Solución:**

**Schema:**
```sql
-- En tabla users
ALTER TABLE users ADD COLUMN location GEOGRAPHY(POINT, 4326);
-- 4326 = WGS84 (estándar GPS)

-- Índice GIST (Generalized Search Tree) para queries espaciales
CREATE INDEX idx_users_location ON users USING GIST(location);
```

**Query Haversine con PostGIS:**
```sql
-- Encontrar profesionales en 30km de cliente
SELECT 
  u.id, u.full_name, p.hourly_rate,
  ST_Distance(u.location, ST_MakePoint(:client_lng, :client_lat)::geography) / 1000 AS distance_km
FROM users u
JOIN professionals p ON u.id = p.user_id
WHERE ST_DWithin(
  u.location,
  ST_MakePoint(:client_lng, :client_lat)::geography,
  30000  -- 30km en metros
)
AND p.is_verified = true
ORDER BY distance_km ASC
LIMIT 50;
```

**Performance:**
- Con índice GIST: <50ms con 10K profesionales
- Sin índice: ~2-3s (full table scan)

**Actualización ubicación:**
- Cuando user edita dirección → Llamada Google Geocoding API → Actualiza lat/long
- Rate limit: 1 actualización cada 5 minutos (evitar abuse)

---

### 7.5 Chat en Tiempo Real: Arquitectura

**Conexión WebSocket:**

**Cliente (React Native):**
```typescript
import io from 'socket.io-client';

const socket = io(API_URL, {
  auth: { token: accessToken },
  transports: ['websocket'],
});

// Join room (chat)
socket.emit('join:chat', { chatId: 123 });

// Enviar mensaje
socket.emit('message:send', {
  chatId: 123,
  text: 'Hola, puedo ver fotos?',
});

// Recibir mensaje
socket.on('message:new', (message) => {
  // Agregar a estado local
  addMessageToChat(message);
});
```

**Servidor (Node.js):**
```typescript
import { Server } from 'socket.io';

io.on('connection', (socket) => {
  const userId = socket.data.user.id;

  socket.on('join:chat', async ({ chatId }) => {
    // Validar que user pertenece a chat
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        OR: [
          { client_id: userId },
          { professional_id: userId },
        ],
      },
    });

    if (chat) {
      socket.join(`chat:${chatId}`);
    }
  });

  socket.on('message:send', async ({ chatId, text }) => {
    // Guardar en BD
    const message = await prisma.message.create({
      data: {
        chat_id: chatId,
        sender_id: userId,
        message_text: text,
      },
    });

    // Broadcast a todos en room (incluido sender)
    io.to(`chat:${chatId}`).emit('message:new', message);

    // Si destinatario offline, enviar push notification
    await sendPushNotification(chatId, userId, text);
  });
});
```

**Persistencia:**
- Todos mensajes se guardan en PostgreSQL (messages table)
- Load inicial: Últimos 50 mensajes (scroll up carga 50 más)
- WebSocket solo para delivery en tiempo real

**Offline handling:**
- Frontend: Queue mensajes en AsyncStorage si no hay conexión
- Cuando reconecta: Envía queue → Backend procesa → Broadcasting

---

### 7.6 Cronjobs Críticos

**1. Expiración de Posts (cada 1 hora):**
```typescript
cron.schedule('0 * * * *', async () => {
  await prisma.post.updateMany({
    where: {
      status: 'open',
      expires_at: { lte: new Date() },
    },
    data: { status: 'expired' },
  });
});
```

**2. Soft Delete Posts (diario 2am):**
```typescript
cron.schedule('0 2 * * *', async () => {
  const date90DaysAgo = new Date();
  date90DaysAgo.setDate(date90DaysAgo.getDate() - 90);

  await prisma.post.updateMany({
    where: {
      status: { in: ['closed', 'expired'] },
      updated_at: { lte: date90DaysAgo },
      deleted_at: null,
    },
    data: { deleted_at: new Date() },
  });
});
```

**3. Cobro Balances Profesionales (último día mes, 3am):**
```typescript
cron.schedule('0 3 28-31 * *', async () => {
  const isLastDayOfMonth = /* lógica validación */;
  if (!isLastDayOfMonth) return;

  const professionalDebts = await prisma.balance.findMany({
    where: { balance: { lt: 0 } },
    include: { professional: { include: { user: true } } },
  });

  for (const debt of professionalDebts) {
    const charged = await chargeCreditCard(
      debt.professional.credit_card_token,
      Math.abs(debt.balance)
    );

    if (charged.success) {
      await prisma.balance.update({
        where: { id: debt.id },
        data: {
          balance: 0,
          last_settlement_date: new Date(),
        },
      });
    } else {
      // Notificar profesional + bloquear de recibir trabajos
      await notifyDebtFailed(debt.professional.user);
    }
  }
});
```

**4. Recordatorios Appointments (cada 15 min):**
```typescript
cron.schedule('*/15 * * * *', async () => {
  const now = new Date();
  const in1Hour = new Date(now.getTime() + 60 * 60 * 1000);
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Recordatorio 1h antes
  const appointments1h = await prisma.appointment.findMany({
    where: {
      status: 'scheduled',
      scheduled_date: { /* lógica fecha+hora entre now y in1Hour */ },
    },
    include: { proposal: { include: { post: { include: { user: true } } } } },
  });

  for (const appt of appointments1h) {
    await sendPushNotification(
      appt.proposal.professional_id,
      '🔔 Trabajo en 1 hora',
      `${appt.proposal.post.title} - ${appt.proposal.post.user.full_name}`
    );
  }

  // Repetir para 24hs
});
```

**5. Payout Automático si Cliente No Confirma (diario 4am):**
```typescript
cron.schedule('0 4 * * *', async () => {
  const date7DaysAgo = new Date();
  date7DaysAgo.setDate(date7DaysAgo.getDate() - 7);

  const pendingPayments = await prisma.payment.findMany({
    where: {
      status: 'pending',
      created_at: { lte: date7DaysAgo },
    },
    include: { appointment: true },
  });

  for (const payment of pendingPayments) {
    if (payment.appointment?.status === 'completed') {
      // Auto-payout a profesional
      await processPayoutToProfessional(payment);
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'completed' },
      });

      // Notificar cliente (timeout)
      await sendPushNotification(
        payment.client_id,
        '⚠️ Pago liberado automáticamente',
        'No confirmaste el trabajo en 7 días. Pago entregado al profesional.'
      );
    }
  }
});
```

---

## 8. Data Model

**Ver:** `docs/03-DataModel.md` (sección siguiente con detalle exhaustivo)

**Referencia rápida:**
- **12 tablas core**: users, professionals, categories, professional_categories, posts, post_categories, post_media, proposals, appointments, chats, messages, payments
- **5 tablas soporte**: reviews, certifications, balances, bonuses (Fase 2), notifications
- **Relaciones clave**: Many-to-many (professionals ↔ categories, posts ↔ categories), 1-to-many (users → posts, chats → messages), 1-to-1 (proposals → appointments)

**Diagrama ER:** Ver DBML completo más adelante

---

## 9. Integrations

### 9.1 MercadoPago

**Features usadas:**
- **Checkout Pro**: Flow completo pago (webview embebido)
- **Tokenización**: Guardar tarjetas profesionales (PCI compliance)
- **Webhooks**: Notificaciones estado pago
- **Payouts**: Transferir dinero a profesionales

**Flujo Pago Cliente:**
1. Backend crea preferencia MP: `POST /checkout/preferences`
2. Frontend abre webview con init_point
3. Cliente completa pago en MP
4. MP envía webhook a backend: `POST /webhooks/mercadopago`
5. Backend valida signature, actualiza payment.status
6. Frontend recibe notificación (WebSocket) y actualiza UI

**Flujo Payout Profesional:**
1. Cuando appointment + payment confirmed:
2. Backend llama `POST /v1/money-requests` (MP Payouts API)
3. Dinero se transfiere a cuenta MP profesional
4. Webhook confirma payout exitoso
5. Notificación a profesional

**Costos:**
- Checkout Pro: 4.99% + ARS 3.99 por transacción (cliente paga)
- Payouts: Gratis (beneficio para marketplaces)

**Documentación:** https://www.mercadopago.com.ar/developers

---

### 9.2 Google Maps Platform

**APIs usadas:**

**1. Geocoding API:**
- Input: "Av. Corrientes 1234, CABA"
- Output: { lat: -34.603722, lng: -58.381592 }
- Cuándo: User edita dirección en perfil

**2. Places Autocomplete API:**
- Input: "Av. Corr..." (mientras tipea)
- Output: Lista sugerencias con place_id
- Cuándo: Campo dirección en registro/edición perfil

**3. Maps SDK (React Native):**
- Display: Mapa con pins profesionales
- Interacción: Tap pin → Ver perfil
- Cuándo: Pantalla búsqueda profesionales

**Costos (Free tier):**
- Geocoding: $5 por 1000 requests (después de 40K gratis/mes)
- Autocomplete: $2.83 por 1000 sessions
- Maps SDK: $7 por 1000 loads

**Optimizaciones:**
- Cache geocoding results en PostgreSQL (no re-geocodear misma dirección)
- Autocomplete: Debounce 300ms (reduce requests 60%)
- Maps: Clustering de pins (1 request vs 50)

**Documentación:** https://developers.google.com/maps

---

### 9.3 Firebase Cloud Messaging (FCM)

**Setup:**
1. Proyecto Firebase (gratis, ilimitado)
2. Apps iOS + Android registradas
3. Certificados APNs (iOS) + google-services.json (Android)

**Flujo:**
1. App instala → Genera FCM token
2. Frontend envía token a backend: `POST /users/fcm-token`
3. Backend guarda en users.fcm_token
4. Cuando trigger notificación:
   ```typescript
   await admin.messaging().send({
     token: user.fcm_token,
     notification: {
       title: '🎉 Nueva propuesta',
       body: 'Roberto envió presupuesto: ARS 8,500',
     },
     data: {
       type: 'new_proposal',
       proposalId: '123',
       chatId: '456',
     },
   });
   ```
5. App recibe notificación → Deep link a pantalla correcta

**Deep links:**
- Android: `quickfixu://chat/456`
- iOS: Universal Links `https://quickfixu.com/chat/456` → Abre app

**Documentación:** https://firebase.google.com/docs/cloud-messaging

---

### 9.4 Tesseract.js (OCR)

**Setup:**
```typescript
import Tesseract from 'tesseract.js';

const worker = await Tesseract.createWorker('spa'); // Español
```

**Flujo:**
1. Profesional sube foto/PDF certificación
2. Backend descarga de Cloudinary → Buffer
3. Tesseract procesa:
   ```typescript
   const { data: { text } } = await worker.recognize(buffer);
   ```
4. Parsing con regex:
   ```typescript
   const matriculaMatch = text.match(/matr[íi]cula.*?(\d{4,6})/i);
   const vencimientoMatch = text.match(/venc.*?(\d{2}\/\d{2}\/\d{4})/i);
   ```
5. Guarda en certifications.ocr_data (JSON)
6. Admin revisa en panel (ve texto extraído + imagen original)

**Accuracy tips:**
- Pre-procesamiento imagen: Contrast + Grayscale (Cloudinary transformations)
- Multi-idioma: 'spa+eng' (certificaciones mezclan ambos)
- Confidence threshold: Solo guardar si confidence >60%

**Documentación:** https://github.com/naptha/tesseract.js

---

## 10. Success Metrics & KPIs

### 10.1 Métricas Adquisición (Primeros 3 meses)

**Clientes:**
- **Registros/semana**: 20-30 (orgánico + redes sociales)
- **Costo por Adquisición (CAC)**: <ARS 500 (con ads limitados)
- **Fuentes**: 40% orgánico, 30% Instagram, 20% referidos, 10% Google

**Profesionales:**
- **Registros/semana**: 8-12
- **Aprobación rate**: 70% (30% rechazados por certificaciones inválidas)
- **Tiempo aprobar**: <48hs (manual MVP)

---

### 10.2 Métricas Activación

**Clientes:**
- **Publica primer post**: 60% (dentro de primeras 24hs)
- **Recibe >1 propuesta**: 80% de posts
- **Acepta propuesta**: 45% de posts (resto expira o no convence precio)

**Profesionales:**
- **Completa perfil 100%**: 85% (incentivo 0% comisión empuja)
- **Envía primera propuesta**: 70% (dentro de primera semana)
- **Primera propuesta aceptada**: 25% (competencia + pricing)

---

### 10.3 Métricas Engagement

**Clientes:**
- **Tiempo en app/sesión**: 8-12 minutos (búsqueda + chat + checkout)
- **Sesiones/semana**: 1.5 (mayoría necesita profesional ocasionalmente)
- **Tasa apertura notificaciones**: 65%

**Profesionales:**
- **Tiempo en app/día**: 20-30 minutos (check feed + responder mensajes)
- **Propuestas enviadas/semana**: 5-8 (profesional activo)
- **Tasa respuesta clientes**: 80% (responde a mensaje en <2hs)

---

### 10.4 Métricas Transaccionales

**GMV (Gross Merchandise Value):**
- **Mes 1**: ARS 150,000 (10 transacciones @ ARS 15K promedio)
- **Mes 3**: ARS 600,000 (50 transacciones)
- **Mes 6**: ARS 2,000,000 (150 transacciones)

**Ticket promedio:**
- **Electricista**: ARS 12,000
- **Plomero**: ARS 18,000
- **Gasista**: ARS 22,000
- **Promedio ponderado**: ARS 15,500

**Take rate (comisión real):**
- **Mes 1-12**: ~2% (mayoría profesionales con 0% comisión promo)
- **Post mes 12**: ~9% (90% usa app, 10% comisión estándar)

**Ingresos QuickFixU:**
- **Mes 6 MVP**: ARS 40,000 (take rate 2%)
- **Mes 12**: ARS 180,000 (take rate 9%)
- **Año 2 (sin promo)**: ARS 500K-800K/mes

---

### 10.5 Métricas Retención

**Clientes:**
- **D7 (día 7)**: 30% (vuelve a buscar profesional o revisar historial)
- **M1 (mes 1)**: 40% (usa app al menos 2 veces)
- **M3 (mes 3)**: 25% (usuarios recurrentes, problemas hogar continuos)

**Profesionales:**
- **D7**: 60% (chequea feed diariamente)
- **M1**: 65% (completó al menos 2 trabajos)
- **M3**: 50% (base sólida profesionales activos)

**Churn reasons (encuestas salida):**
- Clientes: 40% "No tuve más problemas", 30% "Conseguí profesional fijo", 20% "Precios altos", 10% "Mala experiencia"
- Profesionales: 50% "Pocos trabajos en mi zona", 30% "Comisión post-año 1 alta", 20% "Preferencia WhatsApp directo"

---

### 10.6 Métricas Calidad

**Reputación:**
- **Rating promedio clientes**: 4.2-4.5⭐
- **Rating promedio profesionales**: 4.5-4.8⭐ (selección natural, malos desaparecen)
- **% reviews positivas (≥4⭐)**: 75%

**Disputas:**
- **% trabajos con disputa**: <5%
- **Tiempo resolución disputa (Fase 2)**: <72hs
- **% refunds otorgados**: 15% de disputas (resto mediación)

**Cancelaciones:**
- **Por cliente**: 8% de appointments
- **Por profesional**: 5% (penalización desalienta)
- **Mutuo acuerdo**: 3%

---

### 10.7 Métricas Norte Star

**Primarios 6 meses:**
1. **Trabajos completados/mes**: 150 (mes 6)
2. **Profesionales activos/mes**: 80 (con ≥1 trabajo)
3. **NPS (Net Promoter Score)**: >40

**Long-term (post-PMF):**
1. **GMV anual**: ARS 50M+ (sustentable)
2. **Retención M6 profesionales**: >50%
3. **Marketplace liquidity**: <24hs desde post hasta propuesta aceptada (80% casos)

---

## 11. Risks & Mitigation

### 11.1 Riesgos Técnicos

#### Riesgo 1: Escalabilidad - Queries Geoespaciales Lentas

**Impacto:** Alto  
**Probabilidad:** Media (con >5K profesionales)  
**Síntomas:** Búsqueda tarda >5s, timeouts, quejas usuarios

**Mitigation:**
- **Preventivo**: Índices GIST en location (implementado desde día 1)
- **Monitoring**: New Relic APM, alertas si query >2s
- **Plan B**: Cache resultados búsqueda en Redis (TTL 5 min), invalida al crear/editar profesional
- **Plan C**: Sharding por región geográfica (CABA, GBA Norte, GBA Sur, etc.)

---

#### Riesgo 2: WebSocket Cae en Producción

**Impacto:** Alto (chat inusable)  
**Probabilidad:** Baja (Socket.io robusto)  
**Síntomas:** Mensajes no llegan, "Desconectado" en UI

**Mitigation:**
- **Preventivo**: Health check endpoint `/ws-health`, monitoring cada 30s
- **Fallback**: Si WebSocket falla >30s, app switch a polling HTTP cada 3s
- **Redundancia**: Múltiples instancias backend con load balancer (Render/Railway auto-scaling)
- **Alerting**: PagerDuty notifica equipo si >10% usuarios reportan desconexión

---

#### Riesgo 3: Webhooks MercadoPago Se Pierden

**Impacto:** Crítico (pagos no se confirman, usuarios atascados)  
**Probabilidad:** Media (MP tiene ~99.5% reliability)  
**Síntomas:** Payment stuck en "pending", cliente pagó pero no avanza

**Mitigation:**
- **Preventivo**: Endpoint `/webhooks/mercadopago` con retry automático (3 intentos)
- **Idempotencia**: Validar payment_id único (evitar double-processing)
- **Backup polling**: Cronjob cada 15 min consulta API MP pagos "pending" >10 min, actualiza manualmente
- **Manual override**: Admin puede marcar payment "completed" manualmente en panel (con audit log)

---

### 11.2 Riesgos de Negocio

#### Riesgo 4: Profesionales Evaden Comisión (Off-platform Dealing)

**Impacto:** Crítico (pérdida ingresos 100%)  
**Probabilidad:** Alta (incentivo fuerte)  
**Síntomas:** Cliente y profesional desaparecen después primer contacto, baja tasa conversión propuestas

**Mitigation:**
- **Preventivo (MVP)**: 
  - No mostrar teléfono hasta aceptar propuesta + pagar
  - Filtro palabras clave en chat: "WhatsApp", "llamame al", números telefónicos → Blurreado + warning
- **Incentivo positivo**: 0% comisión año 1 (reduce motivación evadir)
- **Detección (Fase 2)**: ML detecta patrones (propuesta aceptada pero no pago, conversación termina abruptamente)
- **Penalización**: Si detectado, ban 30 días + review manual
- **Educación**: Tooltip: "💡 Pagar por la app te protege con garantía y reputación"

---

#### Riesgo 5: Falta Masa Crítica Profesionales en Zona

**Impacto:** Alto (chicken-egg, clientes no encuentran profesionales)  
**Probabilidad:** Alta (problema classic marketplace)  
**Síntomas:** Posts expiran sin propuestas, clientes desinstalan app

**Mitigation:**
- **Growth táctico**:
  - Foco inicial hiperlocal: SOLO Palermo, Recoleta, Belgrano (barrios high-density)
  - Reclutamiento manual: Ir a ferreterías, dejar volantes "Conseguí más clientes, 0% comisión"
  - Referidos: Profesional invita otro profesional → Ambos ARS 5,000 bono después 5 trabajos
- **Incentivo liquidez**:
  - Garantía mínima: Primeros 50 profesionales garantizados 3 trabajos primer mes (QuickFixU subsidia clientes si falta demanda)
- **Plan B**: Si zona tiene <5 profesionales, no mostrar a clientes (evitar frustración)

---

#### Riesgo 6: Profesionales Sin Matrícula (Changas) Intentan Registrarse

**Impacto:** Alto (reputación plataforma, riesgo legal)  
**Probabilidad:** Alta (mercado informal dominante Argentina)  
**Síntomas:** Certificaciones falsas, trabajos mal hechos, quejas clientes

**Mitigation:**
- **Validación rigurosa**:
  - OCR + revisión manual admin (no automatizar 100% MVP)
  - Cross-check número matrícula con registros públicos (si disponibles APIs gubernamentales)
  - Exigir foto carnet profesional + selfie (anti-fake)
- **Zero tolerance**: 1 reporte trabajo mal hecho + certificación falsa = ban permanente + reporte autoridades
- **Comunicación**: Landing page + onboarding: "Solo profesionales matriculados. Validación estricta."
- **Seguro (Fase 3)**: Partnership con aseguradora para trabajos (cobertura daños por mala práctica)

---

### 11.3 Riesgos Legales y Regulatorios

#### Riesgo 7: Regulación Retención de Pagos

**Impacto:** Crítico (modelo negocio)  
**Probabilidad:** Media (ambigüedad legal Argentina)  
**Síntomas:** AFIP o BCRA cuestiona retención dinero, exige licencia procesador pagos

**Mitigation:**
- **Legal counsel**: Consulta abogado especializado fintech ANTES de lanzar
- **Estructura correcta**: QuickFixU como "facilitador de pagos" (no procesador), MercadoPago maneja dinero
- **Transparencia**: T&C claros: "QuickFixU retiene pago hasta confirmación servicio, luego libera vía MercadoPago"
- **Compliance**: Registro eventual como PSP (Proveedor Servicios Pago) si volumen >$X millones/mes
- **Plan B**: Si regulación prohíbe retención, switch a "depósito en garantía" con cuenta fiduciaria banco

---

#### Riesgo 8: Accidente Grave en Trabajo (Incendio, Fuga Gas, Lesión)

**Impacto:** Catastrófico (demandas, cierre plataforma)  
**Probabilidad:** Baja pero no cero  
**Síntomas:** Noticia "Gasista de app causó explosión", demanda millonaria

**Mitigation:**
- **Disclaimer férreo T&C**:
  - "QuickFixU no emplea profesionales, solo conecta. Cada profesional es contratista independiente responsable su trabajo."
  - "Cliente verifica certificaciones profesional. QuickFixU no garantiza calidad trabajo."
- **Seguro plataforma**: Póliza responsabilidad civil (USD 50K-100K cobertura, ~USD 200/mes)
- **Proceso verificación documentado**: Audit trail completo (admin aprobó certificación en X fecha, documento Y)
- **Exclusión profesionales riesgosos**: Si >2 reportes serios, ban preventivo hasta investigación
- **Partnership aseguradoras (Fase 2)**: Ofrecer seguro trabajo opcional (cliente paga extra ARS 500, cubre hasta ARS 50K daños)

---

### 11.4 Riesgos de Adopción/Mercado

#### Riesgo 9: Competencia Agresiva (Tutti, Zolvers)

**Impacto:** Alto (dificultad crecimiento)  
**Probabilidad:** Media (si detectan tracción QuickFixU)  
**Síntomas:** Competidores lanzan promo similar, roban profesionales, pricing wars

**Mitigation:**
- **Diferenciación sostenible**:
  - Feed trabajos (no tienen)
  - 0% comisión año 1 (difícil igualar sin funding)
  - Reputación bidireccional (pocos tienen)
- **Network effects rápido**: Foco en 1-2 barrios, dominar antes expandir (hyperlocal strategy)
- **Relaciones profesionales**: Tratarlos como partners (escuchar feedback, features pedidas), loyalty
- **Speed**: Iterar features más rápido (ventaja startup vs corporación)
- **Plan B**: Si price war inevitable, competir en calidad (mejor matching, mejor UX, mejor soporte)

---

#### Riesgo 10: Baja Adopción Mobile en Profesionales +50 años

**Impacto:** Medio (pierdes segmento experimentado)  
**Probabilidad:** Alta (brecha digital real)  
**Síntomas:** Profesionales +50 no completan registro, abandonan en paso certificaciones

**Mitigation:**
- **UX simplificado**: Onboarding paso a paso, NO overwhelm con features
- **Soporte humano**: WhatsApp "Ayuda registro" (humano responde dudas, guía por videollamada)
- **Talleres presenciales (Fase 2)**: "Cómo usar QuickFixU" en sindicatos, cámaras profesionales
- **Referidos generacionales**: Profesional joven invita mentor/jefe → Ambos bonos
- **Alternativa (Fase 3)**: Permitir "asistente" (hijo/sobrino) maneje app, profesional hace trabajo

---

## 12. Roadmap

### 12.1 Fase 1: MVP (Meses 0-6)

**Mes 1-2: Desarrollo Core**
- ✅ Setup infraestructura (Railway, PostgreSQL, Redis, Cloudinary)
- ✅ Backend API: Auth, Users, Professionals, Posts, Proposals
- ✅ Frontend: Onboarding, Búsqueda, Feed, Chat básico
- ✅ Integración MercadoPago (sandbox)
- ✅ Geolocalización PostGIS + Google Maps
- ✅ OCR Tesseract.js (certificaciones)

**Mes 3: Features Críticos**
- ✅ Sistema propuestas + appointments
- ✅ Pagos reales MercadoPago (production)
- ✅ Notificaciones push FCM
- ✅ Reviews bidireccionales
- ✅ Calendario profesional
- ✅ Cronjobs (expiración posts, recordatorios)

**Mes 4: Testing + Refinamiento**
- ✅ Beta cerrada: 20 clientes + 10 profesionales (amigos/familia)
- ✅ Bugs críticos identificados y resueltos
- ✅ Performance tuning (queries <2s)
- ✅ UX improvements según feedback beta

**Mes 5: Soft Launch**
- 🚀 Launch CABA (Palermo, Belgrano, Recoleta solo)
- 🚀 Landing page live (SEO básico)
- 🚀 Instagram + Facebook ads (ARS 50K/mes budget)
- 🚀 Reclutamiento manual profesionales (volantes ferreterías)
- 🎯 Objetivo: 50 clientes, 20 profesionales, 20 transacciones

**Mes 6: Iteración + Expansión Geográfica**
- 📈 Análisis métricas: Retención, NPS, GMV
- 🔧 Fixes según feedback usuarios reales
- 🌎 Expansión GBA Norte (San Isidro, Vicente López)
- 🎯 Objetivo: 150 clientes, 50 profesionales, 60 transacciones

---

### 12.2 Fase 2: Growth (Meses 6-12)

**Mes 7-8: Features Crecimiento**
- Panel administración web (validación certificaciones, disputas)
- Bonos fidelización profesionales (cada 20 trabajos)
- Videollamadas en chat (Twilio)
- Planes Premium profesionales (destacados, stats avanzadas)

**Mes 9-10: Expansión Nacional**
- Lanzamiento Interior: Rosario, Córdoba, Mendoza
- Campañas marketing localizadas
- Partnerships: Ferreterías (volantes en compras), Sindicatos profesionales

**Mes 11-12: Optimización**
- Mejoras performance (caching Redis agresivo, CDN)
- A/B testing (precios comisión, copy propuestas, UI checkout)
- Programa referidos (cliente invita cliente, bono ARS 1,000)
- 🎯 Objetivo año 1: 3,000 clientes, 800 profesionales, 1,500 transacciones totales

---

### 12.3 Fase 3: Expansión y Diversificación (Meses 12-24)

**Q1 Año 2:**
- Versión web cliente (PWA)
- Expansión profesiones: Niñeras, Jardineros, Cerrajeros, Pintores
- Planes mantenimiento (suscripciones recurrentes cliente-profesional)

**Q2 Año 2:**
- Expansión internacional: Uruguay (Montevideo), Chile (Santiago)
- Marketplace materiales (integración Easy, Sodimac)
- IA detección problemas (upload foto → IA sugiere profesional + precio)

**Q3 Año 2:**
- Sistema aprendices (profesionales buscan ayudantes)
- Seguro trabajos (partnership aseguradora)
- API pública (permitir otras apps integrar QuickFixU)

**Q4 Año 2:**
- Fundraising Serie A (si tracción valida)
- Expansión agresiva Latam (Colombia, México, Perú)
- Equipo 20+ personas (actualmente 2-3 fundadores)

---

## 13. Appendix

### 13.1 Decisiones Técnicas Documentadas

**1. No usar MongoDB:**  
Rechazado por falta ACID transactions (pagos requieren consistencia), relaciones complejas mejor en PostgreSQL, PostGIS superior a geolocalización Mongo.

**2. No usar GraphQL:**  
Overkill para MVP, REST suficiente, over-fetching no es bottleneck con <100 requests/min, complejidad extra no justificada.

**3. No usar Expo Go (usar Expo bare workflow):**  
Necesitamos native modules (react-native-maps, FCM push), Expo Go muy limitado, EAS Build maneja bare workflow perfecto.

**4. No hacer app web progresiva (PWA) en MVP:**  
Mobile-first crítico (profesionales en movimiento, geolocalización nativa), web puede esperar Fase 2.

**5. Prisma sobre TypeORM:**  
Type-safety superior, migrations automáticas confiables, queries más legibles, mejor DX (developer experience).

---

### 13.2 Supuestos y Validaciones Pendientes

**Supuestos validar Beta:**
1. ✅ Clientes prefieren comparar presupuestos (feed) vs buscar directamente → **A/B test**
2. ✅ 0% comisión suficiente incentivo registro tarjeta → **Medir adoption rate**
3. ✅ 48hs suficiente para posts (no muy largo/corto) → **Analizar % expiraciones sin propuestas**
4. ✅ Penalización 15% desalienta cancelaciones → **Medir tasa cancelación pre/post implementación**
5. ✅ Profesionales dispuestos pagar 10% comisión post año 1 → **Encuestas, churn rate mes 13**

**Riesgos no validados (requieren tracción):**
- Liquidez marketplace en zonas suburbanas (GBA Sur, Oeste)
- Willingness to pay planes Premium (puede ser que 0% comisión suficiente, nadie pague Premium)
- Bono fidelización costo-efectivo (vs simplemente bajar comisión a 8%)

---

### 13.3 Referencias y Benchmarks

**Competidores analizados:**
- **Thumbtack (USA)**: Take rate 20%, $1B+ GMV, modelo similar feed trabajos
- **TaskRabbit (USA)**: Adquirida por IKEA $X million, take rate 15%, enfoque assembly/handyman
- **Habitissimo (España)**: Verticalmente integrado construcción/reformas, take rate 10-15%
- **Tutti (Argentina)**: Competidor directo, modelo Tinder profesionales, poca info pública

**Métricas industria (marketplaces servicios):**
- Retención M3 clientes: 20-30% (benchmark bajo por naturaleza esporádica)
- Retención M3 profesionales: 50-60% (supply side más sticky)
- Take rate sostenible: 8-15% (debajo profesionales migran, arriba clientes evaden)
- CAC/LTV ratio saludable: <1:3 (USD 10 CAC → USD 30+ LTV)

**Papers/libros consultados:**
- "Platform Revolution" (Parker, Van Alstyne, Choudary) - Estrategias marketplace
- "Crossing the Chasm" (Geoffrey Moore) - Adopción early adopters → mainstream
- Artículos a16z sobre "Marketplace Liquidity" y "Taking rake without being evil"

---

### 13.4 Glosario Técnico

- **GMV**: Gross Merchandise Value - Volumen total transacciones (antes comisiones)
- **Take Rate**: % comisión plataforma sobre GMV
- **CAC**: Customer Acquisition Cost - Costo adquirir 1 usuario
- **LTV**: Lifetime Value - Valor total que genera 1 usuario en su vida
- **NPS**: Net Promoter Score - Métrica lealtad (% promoters - % detractors)
- **Churn**: Tasa abandono usuarios (% que dejan de usar en período)
- **DAU/MAU**: Daily/Monthly Active Users
- **Liquidity**: Qué tan rápido supply encuentra demand (y viceversa)
- **PMF**: Product-Market Fit - Producto que mercado demanda fuertemente

---

### 13.5 Contactos y Recursos

**Equipo Inicial:**
- Founder/CEO: [Nombre] - Producto, Estrategia
- CTO: [Nombre] - Arquitectura, Backend
- Lead Frontend: [Nombre] - React Native, UI/UX

**Asesores:**
- Legal: [Bufete] - Compliance fintech, T&C
- Contable: [Estudio] - Facturación, impuestos startup
- Marketing: [Consultor] - Growth hacking, ads

**Comunidad:**
- Slack "Founders Argentina" - Networking, consejos
- Meetups React Native Buenos Aires - Hiring, tech talks
- WhatsApp Profesionales Beta - Feedback directo

---

## 14. Conclusión

QuickFixU ataca un problema real y doloroso para millones de argentinos: encontrar profesionales confiables rápidamente. Con un MVP lean, diferenciadores claros (feed trabajos, 0% comisión, reputación bidireccional), y ejecución enfocada en hyperlocal growth, tenemos alta probabilidad de alcanzar PMF en primeros 6 meses.

Los riesgos principales (off-platform dealing, falta liquidez) son mitigables con incentivos correctos y crecimiento táctico. El stack tecnológico es probado, escalable y económico (>95% open source o free tier).

**Próximos pasos inmediatos:**
1. ✅ Validar PRD con stakeholders (founders, advisors)
2. ✅ Setup repositorio + infraestructura (semana 1)
3. ✅ Sprint 1 backend: Auth + Users + Professionals (semana 2-3)
4. ✅ Sprint 2 frontend: Onboarding + Búsqueda (semana 3-4)
5. ✅ Iteración continua hasta MVP completo (mes 3)

**Compromiso:**
- Weekly demos viernes (mostrar progreso)
- Métricas dashboard actualizado diario (post-launch)
- Retrospectivas cada sprint (qué funcionó, qué no)

Let's build this. 🚀

---

**Fin del PRD - v1.0**  
*Última actualización: Marzo 2026*
