# Proposal: Fase 3 - Chat en Tiempo Real

**Change:** `fase-3-chat-realtime`  
**Date:** Marzo 2026  
**Complexity:** MUY ALTA  
**Estimated Timeline:** 14-18 días (2-3 semanas)  
**Prerequisite:** Fase 2 (Posts & Proposals) MUST be completed

---

## Intent

Implementar **mensajería en tiempo real bidireccional** con WebSockets para permitir que clientes y profesionales negocien presupuestos, coordinen visitas y compartan detalles técnicos de los problemas de reparación.

**Problema actual:** Fase 2 crea registros en tabla `chats` pero NO provee interfaz ni lógica de mensajería. Clientes y profesionales no pueden comunicarse después de recibir/enviar propuestas, bloqueando el flujo transaccional completo.

**Por qué es crítico:** Sin chat funcional, la app es solo un tablón de anuncios estático. Chat en tiempo real convierte QuickFixU de plataforma transaccional a plataforma sticky con engagement continuo.

---

## Scope

### In Scope

**Backend:**
- ✅ Integración Socket.io (namespace `/`, rooms por chat)
- ✅ Autenticación JWT en WebSocket handshake
- ✅ Migración tabla `messages` (UUID PK, índices, trigger)
- ✅ 8 eventos Socket.io core: `send_message`, `new_message`, `typing`, `stop_typing`, `mark_read`, `message_read`, `join_chat`, `leave_chat`
- ✅ Delivery guarantee at-least-once con ACKs + deduplicación
- ✅ Rate limiting 20 mensajes/min (Redis sliding window)
- ✅ Typing indicator con throttle 500ms + timeout 3s
- ✅ Read receipts batch (actualización cada 2s)
- ✅ Multimedia upload (Cloudinary signed URL, 1 archivo/mensaje)
- ✅ Notificaciones push condicionales (offline O online en otro chat)
- ✅ Paginación cursor-based (50 mensajes/batch)

**Frontend (React Native):**
- ✅ Hook `useSocket()` con reconexión automática
- ✅ Pantalla lista conversaciones (ordenada `last_message_at`)
- ✅ Pantalla chat individual con historial paginado
- ✅ Offline queue (AsyncStorage) + sync automático al reconectar
- ✅ UI typing indicator ("escribiendo...")
- ✅ UI read receipts (doble check: enviado/leído)
- ✅ Badge mensajes no leídos por chat
- ✅ Compresión videos client-side (react-native-compressor, target 5MB)
- ✅ Botón "Reintentar" para mensajes fallidos

### Out of Scope

**Diferido a Fase 7 (Chat Avanzado):**
- ❌ Editar/eliminar mensajes (requiere lógica soft delete + eventos adicionales)
- ❌ Mensajes de voz (complejidad audio + transcripción)
- ❌ Videollamadas (requiere WebRTC + namespace separado)
- ❌ Multi-device sync (requiere tabla `user_sessions`)
- ❌ Encriptación E2E (Signal Protocol overkill para MVP)

**No en MVP:**
- Redis Adapter (activar solo cuando >10K usuarios concurrentes)
- Sticky sessions (1 servidor suficiente)
- Token refresh durante conexión (desconectar/reconectar cada 14min es suficiente)

---

## Approach

### Arquitectura High-Level

```
React Native App (Socket.io Client)
        ↓ WebSocket (JWT auth)
Express Server + Socket.io Server (mismo puerto HTTP upgrade)
        ↓
PostgreSQL (messages, chats) + Redis (rate limiting)
        ↓
Cloudinary (multimedia uploads directo desde cliente)
FCM (push notifications condicionales)
```

### Estrategia Socket.io

**Namespace global `/`** con rooms dinámicos:
- `user:{userId}` → Room personal para notificaciones broadcast
- `chat:{chatId}` → Room por conversación (cliente + profesional)

**Flujo típico:**
1. Cliente conecta WebSocket → JWT validado → `socket.join('user:123')`
2. Usuario abre chat ID 456 → `socket.emit('join_chat', { chatId: 456 })`
3. Backend valida pertenencia → `socket.join('chat:456')`
4. Usuario envía mensaje → `socket.emit('send_message', { chatId, text })`
5. Backend: persiste BD → `io.to('chat:456').emit('new_message', message)`
6. Destinatario recibe en tiempo real (si online en room) o push (si offline)

### Delivery Guarantee

**At-least-once** con deduplicación client-side:
- Mensajes tienen UUID v4 como PK
- Cliente envía con ACK callback
- Servidor hace `upsert` (idempotente)
- Cliente deduplica por `messageId` antes renderizar
- **Trade-off:** Casos edge pueden generar duplicados (red inestable + timeout ACK), pero UX es transparente

### Offline Support

- AsyncStorage queue (max 100 mensajes pendientes)
- Auto-envío al reconectar
- UI muestra status: "Enviando..." → "Enviado" → "Leído"
- Botón "Reintentar" si falla

---

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/socket/` | **New** | Servidor Socket.io + handlers eventos + auth middleware |
| `backend/src/routes/chats.ts` | **Modified** | Agregar endpoints: `GET /chats`, `GET /chats/:id/messages`, `POST /chats/:id/upload-signature` |
| `backend/prisma/schema.prisma` | **Modified** | Modelo `Message` (UUID PK, campos nuevos) |
| `backend/prisma/migrations/` | **New** | `20260322_create_messages_table.sql` (tabla + índices + trigger) |
| `mobile/src/hooks/useSocket.ts` | **New** | Hook Socket.io con reconexión automática + token refresh |
| `mobile/src/screens/ChatsScreen.tsx` | **New** | Lista conversaciones con badges no leídos |
| `mobile/src/screens/ChatDetailScreen.tsx` | **New** | Pantalla chat individual + typing + read receipts |
| `mobile/src/services/offlineQueue.ts` | **New** | Queue AsyncStorage para mensajes offline |
| `mobile/src/contexts/SocketContext.tsx` | **New** | Context provider socket global |

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **Mensajes duplicados** (at-least-once delivery) | BAJA | Deduplicación client-side por UUID. Testing riguroso con network throttling (Cypress). |
| **Cloudinary bandwidth excede 25GB/mes** (free tier) | MEDIA | Comprimir videos client-side (target 5MB). Límite upload 15MB. Alert >80% bandwidth. |
| **WebSocket connections leak** (memoria servidor) | BAJA | Heartbeat 25s + `pingTimeout: 120000`. Monitoring `socket.io_connections`. Alert >10K conexiones. |
| **Offline queue crece sin límite** (storage móvil) | MUY BAJA | Límite 100 mensajes en cola. Error claro + botón "Limpiar cola" en settings. |
| **Notificación push a usuario online** (falso negativo) | BAJA | Double-check: `socket.connected && socket.rooms.has('chat:X')`. Log falsos positivos para ajustar. |
| **Race condition:** Aceptar propuesta mientras se borra mensaje | MUY BAJA | Validar `proposal.status` antes de operaciones críticas. Lock optimista con `updatedAt`. |
| **Redis single point of failure** (si activamos adapter futuro) | N/A (MVP sin Redis adapter) | Documentar Redis Cluster setup (3 nodos) + fallback polling HTTP. |
| **Token expira durante sesión larga** (>15min) | GARANTIZADO | Reconexión automática cada 14min con nuevo token (reutiliza lógica Fase 1 refresh). |

---

## Rollback Plan

### Escenario 1: Socket.io rompe en producción

**Síntomas:** Conexiones fallan, mensajes no llegan, errores `ECONNREFUSED`

**Rollback:**
1. Revertir deploy backend a versión Fase 2 (tag `v0.2.0`)
2. Frontend mostrará error "Chat temporalmente no disponible"
3. Usuarios pueden seguir creando posts/propuestas (HTTP API intacta)
4. Investigar logs Sentry + Socket.io debug logs
5. Hot-fix o re-deploy corregido en <2 horas

### Escenario 2: Migración `messages` tabla falla

**Síntomas:** Error Prisma `P2002` (constraint violations), rollback automático migration

**Rollback:**
1. Migration se auto-revierte (Prisma transactional DDL)
2. No hay data loss (tabla `messages` no existía previamente)
3. Re-ejecutar migration con fix después de investigar

### Escenario 3: Cloudinary bandwidth se agota

**Síntomas:** Uploads fallan con error 402 (Payment Required)

**Rollback:**
1. Deshabilitar upload multimedia temporalmente (feature flag `ENABLE_MEDIA_UPLOAD=false`)
2. Frontend oculta botón adjuntar
3. Migrar a S3 en <24 horas (costo $0.09/GB vs Cloudinary $0.22/GB)

### Escenario 4: Rate limiting bloquea usuarios legítimos

**Síntomas:** Usuarios reportan "No puedo enviar mensajes" (>20/min)

**Rollback:**
1. Aumentar límite a 30/min via env var `RATE_LIMIT_MESSAGES=30`
2. Hot-reload servidor (sin downtime)
3. Analizar telemetría para ajustar definitivamente

---

## Dependencies

### Técnicas
- ✅ **Fase 2 completa:** Tabla `chats` debe existir con lógica auto-creation
- ✅ **PostgreSQL 15+:** UUID support (`gen_random_uuid()`)
- ✅ **Redis instance:** Para rate limiting (reutiliza cliente geocoding Fase 1)
- ✅ **Cloudinary account:** Free tier configurado
- ✅ **FCM tokens:** Usuarios con `fcm_token` registrado (Fase 1)

### NPM Packages
**Backend:** `socket.io@^4.6.0`, `@socket.io/redis-adapter@^8.2.1`, `rate-limiter-flexible@^2.4.1`, `uuid@^9.0.0`  
**Frontend:** `socket.io-client@^4.6.0`, `@react-native-async-storage/async-storage@^1.19.0`, `react-native-compressor@^1.8.0`, `lodash.throttle@^4.1.1`

### External Services
- Cloudinary API (signed uploads)
- FCM (push notifications)
- Redis (rate limiting + future adapter)

---

## Success Criteria

### Funcional
- [ ] Cliente puede enviar mensaje texto → destinatario lo recibe en <500ms (si online)
- [ ] Cliente offline puede enviar mensajes → se guardan en queue → se envían automáticamente al reconectar
- [ ] Typing indicator aparece cuando destinatario escribe, desaparece después 3s sin actividad
- [ ] Read receipts actualizan doble check: gris (enviado) → azul (leído)
- [ ] Cliente puede subir 1 imagen O 1 video (max 15MB) → aparece en chat
- [ ] Historial carga últimos 50 mensajes al abrir chat
- [ ] Lista conversaciones ordena por `last_message_at` descendente
- [ ] Badge muestra contador mensajes no leídos por chat
- [ ] Notificación push se envía SOLO si destinatario offline O en otro chat

### Performance
- [ ] Latencia mensaje enviado → recibido <500ms (red 4G estable)
- [ ] Reconexión automática <2s después de pérdida conexión
- [ ] Historial 50 mensajes carga en <1s
- [ ] Servidor soporta 1,000 conexiones concurrentes sin degradación (load test)

### Técnico
- [ ] Migration `20260322_create_messages_table` ejecuta sin errores
- [ ] 0 mensajes duplicados en testing normal (deduplicación funciona)
- [ ] Rate limiting bloquea >20 mensajes/min (testing automatizado)
- [ ] Cloudinary uploads usan <5GB/mes en primeras 2 semanas (monitoring)

### UX
- [ ] Usuario puede distinguir visualmente status mensaje: "Enviando" / "Enviado" / "Leído"
- [ ] Mensajes fallidos muestran botón "Reintentar" claramente
- [ ] Error "Demasiados mensajes pendientes" solo aparece si >100 en cola
- [ ] Typing indicator NO causa lag en input (throttle funciona)

---

## Timeline Estimate

**Total:** 14-18 días (~3 sprints cortos)

### Sprint 1: Fundamentos (5-6 días)
- Setup Socket.io servidor + auth middleware
- Migration tabla `messages` + índices + trigger
- Hook `useSocket()` frontend + reconexión automática
- Eventos básicos: `send_message`, `new_message`, `join_chat`
- Testing manual conexión + envío mensaje simple

### Sprint 2: Features Core (5-6 días)
- Typing indicator (throttle + timeout)
- Read receipts (batch updates)
- Paginación historial (cursor-based)
- Offline queue (AsyncStorage + sync)
- Lista conversaciones + badges no leídos

### Sprint 3: Multimedia + Pulido (4-6 días)
- Upload multimedia (Cloudinary signed URL)
- Compresión videos client-side
- Notificaciones push condicionales
- Rate limiting
- Testing E2E (Cypress + Detox)
- Ajustes UX (loading states, error handling)

**Contingencia:** +2 días para bugs inesperados (WebSocket timing issues típicos).

---

## Notes

- **Complejidad justificada:** Esta es la fase técnicamente más desafiante del MVP (WebSockets + concurrencia + offline), pero es el feature que diferencia QuickFixU de competidores estáticos.
- **No sobre-ingenierizar:** Redis Adapter y sticky sessions están documentados pero NO se implementan hasta >10K usuarios concurrentes (probablemente mes 6 post-launch).
- **Priorizar UX offline:** React Native + 4G inestable = queue local es crítico, no opcional.
- **Monitoreo desde día 1:** Trackear métricas `socket.io_connections`, `messages_sent`, `duplicate_messages_filtered`, `cloudinary_bandwidth_mb` desde deploy (Prometheus).

---

**Ready for:** Spec Document (scenarios Gherkin) → Design Document (componentes + diagramas secuencia) → Tasks Breakdown (sprint planning).
