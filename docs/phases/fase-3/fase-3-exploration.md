# Exploration: Fase 3 - Chat en Tiempo Real

**Change name:** `fase-3-realtime-chat`  
**Date:** Marzo 2026  
**Status:** Exploration Complete  
**Prerequisite:** Fase 2 (Posts & Proposals) MUST be completed

---

## 1. Executive Summary

La Fase 3 implementa **mensajería en tiempo real** con WebSockets (Socket.io), convirtiendo la tabla `chats` (creada en Fase 2) en un sistema de comunicación bidireccional funcional. Sin esta fase, clientes y profesionales NO pueden negociar presupuestos, coordinar visitas ni compartir detalles técnicos del problema.

**Complejidad:** MUY ALTA — Esta es la fase técnicamente más desafiante del MVP. Involucra:
- Arquitectura distribuida (WebSockets + HTTP)
- Concurrencia y race conditions
- Manejo de offline/reconexión
- Delivery guarantees (at-least-once)
- Notificaciones push condicionales
- Upload multimedia en contexto chat

**Decisiones clave tomadas:**

| Decisión | Opción Seleccionada | Justificación |
|----------|---------------------|---------------|
| **Socket.io Architecture** | Un namespace global `/` con rooms por chat (`chat:{chatId}`) | Simplicidad MVP, todos los usuarios conectan al mismo namespace, se agrupan por rooms. Escala hasta 10K usuarios concurrentes. |
| **Servidor Socket.io** | Integrado en Express (mismo puerto HTTP/WS upgrade) | Evita CORS, simplifica deploy, mismo JWT middleware. Separar solo si >50K conexiones concurrentes. |
| **Authentication** | JWT en handshake (query param `?token=...` o auth header) | Socket.io valida JWT en `connection` event, asocia socket.data.userId. Rechaza conexión si JWT inválido/expirado. |
| **Token Refresh durante conexión** | NO — cliente desconecta/reconecta con nuevo token antes de expirar | Access tokens 15min son suficientes para sesiones chat. Cliente renueva token en background (Fase 1 refresh logic) y reconecta. |
| **Message Delivery** | At-least-once con ACKs + deduplicación client-side por `messageId` | Balance pragmático: mensajes duplicados (raros) se filtran en frontend. Exactly-once requiere distributed transactions (overkill MVP). |
| **Offline Messages** | Queue en AsyncStorage + envío automático al reconectar | UX crítico para mobile (4G inestable). Backend persiste mensajes antes de emitir, destinatario los recibe al conectarse. |
| **Typing Indicator** | Evento `typing` throttled 500ms client-side, timeout 3s server-side | Evita spam (usuario escribe rápido = 1 evento cada 500ms). Server auto-emite `stop_typing` si no recibe nuevo `typing` en 3s. |
| **Read Receipts** | Marcado automático al abrir chat + scroll hasta mensaje + evento `mark_read` batch | UX WhatsApp-like. Backend actualiza `messages.read=true` + emite evento a remitente para actualizar double-check. Batch cada 2s (evita UPDATE por mensaje). |
| **Paginación Historial** | Cursor-based descendente: últimos 50 mensajes al abrir, infinite scroll hacia arriba | Consistente con Fase 2 (posts feed). Cursor = `{ createdAt, id }`, índice compuesto `(chat_id, created_at DESC, id DESC)`. |
| **Escalabilidad Horizontal** | Redis Adapter (@socket.io/redis-adapter) preparado, NO activado en MVP | Fase 1 = 1 servidor. Redis adapter permite múltiples instancias Socket.io (broadcasting cross-server). Activar cuando >10K usuarios concurrentes. |
| **Sticky Sessions** | NO requerido MVP (1 servidor). Preparar Nginx `ip_hash` para Fase 4 | Socket.io requiere sticky sessions en multi-server. MVP 1 instancia = no necesario. Documentar setup Nginx para escalar. |
| **Multimedia Upload** | Signed upload directo desde cliente a Cloudinary + mensaje con `media_url` | Evita saturar servidor con uploads. Cliente obtiene signed URL (POST /api/chats/:id/upload-signature), sube directo, envía mensaje con URL resultante. |
| **Multimedia en Mensajes** | 1 archivo por mensaje (imagen O video, NO ambos). Texto opcional. | Simplifica MVP. Re-enviar múltiples archivos = múltiples mensajes consecutivos (UX aceptable tipo WhatsApp). |
| **Notificaciones Push Logic** | Enviar FCM solo si destinatario offline O online pero NO en el chat específico | Detectar con `socket.rooms.has('chat:${chatId}')`. Si está en el room = no push (verá mensaje en tiempo real). Si offline/otro chat = push. |
| **Error Handling** | Mensaje falla BD → rollback, emitir error a sender, guardar en AsyncStorage para retry | Cliente reintenta envío (botón "Reintentar" en UI). Servidor logea errores críticos (Sentry). |
| **Rate Limiting** | 20 mensajes/minuto por usuario (evita spam/bots) | Redis sliding window. Si excede → socket.emit('error', 'Rate limit exceeded'), mensaje rechazado. |
| **Eventos Socket.io** | 8 eventos core: `send_message`, `new_message`, `typing`, `stop_typing`, `mark_read`, `message_read`, `join_chat`, `leave_chat` | Mínimo viable para chat funcional. Agregar `edit_message`, `delete_message` en Fase 7. |

**Features a entregar:**
1. ✅ WebSocket Connection con JWT auth + reconexión automática
2. ✅ Mensajería texto (max 2000 chars) en tiempo real
3. ✅ Typing indicator ("escribiendo...") con throttling
4. ✅ Read receipts (doble check: enviado/entregado/leído)
5. ✅ Mensajería multimedia (1 imagen O 1 video por mensaje)
6. ✅ Historial de mensajes paginado (cursor-based, 50 mensajes/batch)
7. ✅ Lista de conversaciones ordenada por `last_message_at`
8. ✅ Contador mensajes no leídos (badge) por chat
9. ✅ Notificaciones push condicionales (offline/otro chat)
10. ✅ Offline support (queue + sync automático al reconectar)
11. ✅ Actualización `chats.last_message_at` en cada mensaje (trigger BD)

**Riesgos identificados:**

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| **Mensajes duplicados** (at-least-once delivery) | MEDIO — UX confuso si aparecen 2 veces | Deduplicación client-side por `messageId` (UUID v4). Frontend filtra duplicados antes de renderizar. |
| **Race condition:** Cliente acepta propuesta mientras profesional borra mensaje | BAJO — Casos edge raros | Validar status propuesta ANTES de cualquier operación crítica (accept/reject). Lock optimista con `updatedAt` timestamp. |
| **Cloudinary bandwidth** (videos en chat) | ALTO — Free tier 25GB/mes se consume rápido | Comprimir videos client-side (react-native-compressor) antes upload. Límite 15MB después compresión. Trackear bandwidth (alert >80%). |
| **WebSocket connections leak** (cliente no desconecta limpiamente) | MEDIO — Memoria servidor crece | Heartbeat cada 25s (Socket.io default). Desconectar sockets sin actividad >2min (`pingTimeout: 120000`). |
| **Offline queue crece sin límite** (AsyncStorage) | BAJO — Storage móvil limitado | Límite 100 mensajes en cola. Si excede, mostrar error "Demasiados mensajes pendientes, conecta a WiFi". |
| **Notificación push enviada a usuario online** (falso negativo detección) | MEDIO — Spam push, mala UX | Double-check: (1) socket.connected && (2) socket.rooms.has('chat:X'). Log falsos positivos para ajustar. |
| **Multiple devices** (usuario logueado en 2 celulares) | MEDIO — Read receipts inconsistentes | Fase 1 = 1 device. Multi-device requiere tabla `user_sessions` (Fase 7). MVP acepta comportamiento: el último device que lee marca todos como leídos. |
| **Redis single point of failure** (si activamos adapter) | ALTO — Todos sockets desconectan | MVP sin Redis adapter (1 servidor). Cuando escalemos: Redis Cluster (3 nodos mínimo) + fallback a polling HTTP si Redis cae. |

**Ready for proposal:** ✅ YES — Arquitectura definida, todos los trade-offs documentados, plan de escalabilidad claro.

---

## 2. Current State (Post Fase 2)

### Ya Tenemos Implementado:
✅ Tabla `chats` creada (Fase 2) con campos: `id`, `client_id`, `professional_id`, `last_message_at`  
✅ Tabla `messages` existe (schema definido) pero vacía — NO hay lógica para crear/enviar mensajes  
✅ Chat auto-creado cuando profesional envía propuesta (INSERT en `chats` si no existe)  
✅ FCM push notifications (token en `users.fcm_token`, función `sendPushNotification`)  
✅ Cloudinary integración (upload profile photos + post media)  
✅ JWT authentication (access 15min, refresh 7 días, middleware `requireAuth`)  
✅ Redis cache (geocoding, puede extenderse para rate limiting)  
✅ Prisma ORM con PostgreSQL 15 + PostGIS  

### Base de Datos Actual:
```sql
-- Tablas existentes (Fase 1 + Fase 2)
users (id, full_name, email, fcm_token, latitude, longitude, location [PostGIS], ...)
professionals (id, user_id, ...)
posts (id, user_id, title, description, status, expires_at, ...)
proposals (id, post_id, professional_id, price, status, ...)

-- Tabla creada Fase 2 pero SIN funcionalidad
chats (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES users(id),
  professional_id INTEGER NOT NULL REFERENCES users(id),
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, professional_id)  -- Solo 1 chat por par
)

-- Tabla definida Fase 2 (en DataModel.md) pero NO creada aún
messages (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES chats(id),
  sender_id INTEGER NOT NULL REFERENCES users(id),
  message_text TEXT,  -- Nullable (puede ser solo media)
  media_url VARCHAR(500),  -- Nullable
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_message_content CHECK (message_text IS NOT NULL OR media_url IS NOT NULL)
)
```

### Cambios Base de Datos (Fase 3):
```sql
-- Migration: 20260322_create_messages_table
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  message_text TEXT,
  media_url VARCHAR(500),
  media_type VARCHAR(10),  -- 'image' | 'video' | NULL
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_message_content CHECK (message_text IS NOT NULL OR media_url IS NOT NULL)
);

CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(chat_id, created_at DESC, id DESC); -- Cursor pagination
CREATE INDEX idx_messages_read ON messages(chat_id, read) WHERE read = FALSE; -- Unread count

-- Trigger: Actualizar chats.last_message_at cuando se inserta mensaje
CREATE OR REPLACE FUNCTION update_chat_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chats
  SET last_message_at = NEW.created_at,
      updated_at = NOW()
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_chat_last_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_chat_last_message();
```

**IMPORTANTE:** Tabla `notifications` (Fase 2) ya existe para push history. Reutilizar para notificaciones de mensajes nuevos.

---

## 3. Technical Options Evaluated

### 3.1 Socket.io Architecture: Namespace Strategy

**Contexto:** Socket.io permite organizar conexiones en namespaces (ej: `/chat`, `/notifications`) y rooms dentro de cada namespace. ¿Cómo estructurar para QuickFixU?

#### Opción A: Un Namespace Global `/` con Rooms por Chat ✅

**Estructura:**
```typescript
// Servidor
io.on('connection', (socket) => {
  const userId = socket.data.userId; // Extraído de JWT
  
  // Usuario se une a su room personal (para notificaciones directas)
  socket.join(`user:${userId}`);
  
  // Cuando abre un chat específico
  socket.on('join_chat', ({ chatId }) => {
    // Validar que userId pertenece al chat (client_id o professional_id)
    if (await userBelongsToChat(userId, chatId)) {
      socket.join(`chat:${chatId}`);
    }
  });
  
  // Cuando envía mensaje
  socket.on('send_message', async ({ chatId, text }) => {
    const message = await saveMessage(chatId, userId, text);
    // Broadcast a todos en el room (incluido sender para confirmación)
    io.to(`chat:${chatId}`).emit('new_message', message);
  });
});
```

**Pros:**
- ✅ **Simplicidad:** 1 solo namespace, fácil debugging
- ✅ **Escalabilidad:** Rooms son lightweight (hash map interno Socket.io)
- ✅ **Flexibilidad:** Mismo socket puede estar en múltiples rooms (`user:X` + `chat:Y` + `chat:Z`)
- ✅ **Broadcasting eficiente:** `io.to('chat:123')` solo envía a usuarios en ese chat

**Cons:**
- Todos los eventos comparten el mismo namespace (podría causar conflictos si agregamos features no-chat futuro)
- Mitigation: Prefijo claro en eventos (`chat:message`, `notif:push`) cuando agreguemos otros namespaces

**Veredicto:** ✅ **RECOMENDADO MVP** — Es el patrón estándar Socket.io para chats 1-to-1 y grupales.

---

#### Opción B: Namespace por Chat `/chat/{chatId}` 🔴

**Estructura:**
```typescript
// Cliente conecta a namespace dinámico
const socket = io(`${API_URL}/chat/${chatId}`);

// Servidor crea namespaces dinámicamente
io.of(/^\/chat\/\d+$/).on('connection', (socket) => {
  const chatId = extractChatId(socket.nsp.name); // "/chat/123" -> 123
  // ...
});
```

**Pros:**
- Aislamiento total entre chats (eventos no se cruzan)
- Fácil aplicar middleware por chat (validar permisos en namespace)

**Cons:**
- ❌ **Complejidad innecesaria:** Crear namespace dinámico por cada chat (overhead)
- ❌ **Multi-chat:** Usuario en 2 chats simultáneos = 2 conexiones WebSocket separadas (dobla consumo recursos)
- ❌ **Notificaciones:** Usuario offline no puede recibir eventos (no está conectado a ningún namespace)

**Veredicto:** ❌ Rechazado — Over-engineering para caso de uso simple.

---

#### Opción C: Namespace `/chat` + Rooms por Chat 🟡

**Estructura:**
```typescript
// Cliente
const socket = io(`${API_URL}/chat`);

// Servidor
const chatNamespace = io.of('/chat');
chatNamespace.on('connection', (socket) => {
  socket.join(`chat:${chatId}`);
});
```

**Pros:**
- Separación conceptual (namespace `/chat` solo para mensajería)
- Útil si agregamos namespace `/notifications`, `/videocall` en futuro

**Cons:**
- Complejidad adicional sin beneficio claro en MVP
- Cliente debe conectar a múltiples namespaces si agrega features

**Veredicto:** 🟡 **Fase 4+** — Migrar si agregamos features complejas (videollamadas). MVP usa Opción A.

---

### 3.2 Authentication: JWT en WebSocket Handshake

**Contexto:** Socket.io debe validar JWT antes de aceptar conexión. ¿Dónde pasar el token?

#### Opción A: Query Parameter `?token=...` ✅

**Cliente:**
```typescript
const socket = io(API_URL, {
  auth: { token: accessToken }, // Socket.io envía como query param
  transports: ['websocket'],
});
```

**Servidor:**
```typescript
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.data.userId = decoded.userId;
    next(); // Acepta conexión
  } catch (error) {
    next(new Error('Invalid token')); // Rechaza conexión
  }
});
```

**Pros:**
- ✅ **Simple:** Socket.io maneja automáticamente (`auth` object)
- ✅ **Standard:** Recomendado en docs Socket.io
- ✅ **Compatible:** Funciona con polling fallback

**Cons:**
- Token visible en URL (logs servidor, potencial leak)
- Mitigation: HTTPS + logs sanitizados (no imprimir query params)

**Veredicto:** ✅ **RECOMENDADO** — Es la práctica estándar Socket.io.

---

#### Opción B: Header `Authorization: Bearer ...` 🟡

**Cliente:**
```typescript
const socket = io(API_URL, {
  extraHeaders: {
    Authorization: `Bearer ${accessToken}`,
  },
});
```

**Servidor:**
```typescript
io.use((socket, next) => {
  const token = socket.handshake.headers.authorization?.split(' ')[1];
  // ...
});
```

**Pros:**
- Más seguro (no visible en URL)
- Consistente con HTTP API (mismo header)

**Cons:**
- ❌ **NO funciona con polling fallback** (XHR no permite custom headers en algunos browsers)
- ❌ Socket.io docs recomiendan NO usar headers para auth

**Veredicto:** 🟡 Técnicamente posible, pero peor UX. Usar Opción A.

---

#### Opción C: Cookie `httpOnly` 🔴

**Pros:**
- Más seguro (XSS no puede robar token)

**Cons:**
- ❌ **CSRF vulnerable** en WebSockets
- ❌ React Native NO soporta cookies httpOnly fácilmente (requiere WebView)
- ❌ Complejidad adicional (CSRF tokens, cookie management)

**Veredicto:** ❌ Rechazado — Mobile-first app, cookies son friction.

---

### 3.3 Token Expiration: ¿Renovar durante Conexión Larga?

**Contexto:** Access tokens expiran en 15 minutos. Usuario puede estar en chat >15min. ¿Desconectar o renovar?

#### Opción A: Desconectar y Reconectar con Nuevo Token ✅

**Flujo:**
```typescript
// Cliente (React Native)
useEffect(() => {
  const setupSocket = async () => {
    const token = await getAccessToken(); // Refresca automáticamente si expiró (Fase 1 logic)
    
    const newSocket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
    });
    
    newSocket.on('connect_error', async (err) => {
      if (err.message === 'Invalid token') {
        // Token expiró, refrescar y reconectar
        await refreshAccessToken();
        const newToken = await getAccessToken();
        newSocket.auth.token = newToken;
        newSocket.connect();
      }
    });
    
    setSocket(newSocket);
  };
  
  setupSocket();
  
  // Renovar conexión cada 14 minutos (antes de expiración 15min)
  const interval = setInterval(() => {
    socket?.disconnect();
    setupSocket();
  }, 14 * 60 * 1000);
  
  return () => clearInterval(interval);
}, []);
```

**Pros:**
- ✅ **Simple:** Reutiliza lógica refresh existente (Fase 1)
- ✅ **Seguridad:** Token nunca vive >15min
- ✅ **Sin cambios servidor:** No requiere lógica especial

**Cons:**
- Desconexión breve cada 14min (typing indicator se pierde)
- Mitigation: Reconexión rápida (<500ms), UX imperceptible

**Veredicto:** ✅ **RECOMENDADO MVP** — Simplicidad > optimización prematura.

---

#### Opción B: Socket Emit `refresh_token` con ACK 🟡

**Flujo:**
```typescript
// Cliente detecta token próximo a expirar
socket.emit('refresh_token', { refreshToken }, (ack) => {
  if (ack.newAccessToken) {
    updateAccessToken(ack.newAccessToken);
  }
});

// Servidor
socket.on('refresh_token', async (payload, callback) => {
  const newAccessToken = await refreshJWT(payload.refreshToken);
  socket.data.userId = decodeNewToken(newAccessToken);
  callback({ newAccessToken });
});
```

**Pros:**
- Sin desconexión (UX más fluida)

**Cons:**
- Complejidad adicional (lógica refresh duplicada: HTTP + WS)
- Seguridad: refresh token viaja por WebSocket (mismo riesgo que HTTP)

**Veredicto:** 🟡 **Fase 4+** — Implementar si usuarios se quejan de desconexiones (unlikely).

---

### 3.4 Message Delivery Guarantees

**Contexto:** Redes móviles son inestables. ¿Qué garantía damos de que el mensaje llega?

#### Opción A: At-Least-Once con ACKs + Deduplicación Client-Side ✅

**Flujo:**
```typescript
// Cliente envía mensaje con UUID único
const messageId = uuidv4();
const tempMessage = {
  id: messageId,
  chatId,
  text: 'Hola',
  status: 'sending', // UI muestra "enviando..."
  createdAt: new Date(),
};

socket.emit('send_message', { messageId, chatId, text }, (ack) => {
  if (ack.success) {
    updateMessageStatus(messageId, 'sent'); // Cambiar a "enviado"
  } else {
    updateMessageStatus(messageId, 'failed'); // Botón "Reintentar"
  }
});

// Servidor
socket.on('send_message', async ({ messageId, chatId, text }, callback) => {
  try {
    // Guardar en BD (idempotente si messageId ya existe)
    const message = await prisma.message.upsert({
      where: { id: messageId }, // UUID como PK (requiere migration)
      update: {}, // No actualizar si existe (mensaje duplicado)
      create: {
        id: messageId,
        chat_id: chatId,
        sender_id: socket.data.userId,
        message_text: text,
      },
    });
    
    // Broadcast a room (destinatario recibe)
    io.to(`chat:${chatId}`).emit('new_message', message);
    
    // ACK a sender
    callback({ success: true, message });
  } catch (error) {
    callback({ success: false, error: error.message });
  }
});

// Cliente recibe mensaje
socket.on('new_message', (message) => {
  // Deduplicar: si messageId ya existe en estado local, ignorar
  if (!messages.find(m => m.id === message.id)) {
    addMessage(message);
  }
});
```

**Pros:**
- ✅ **Robusto:** Si ACK se pierde (timeout red), cliente reintenta, servidor lo detecta como duplicado (upsert), no se crea 2 veces
- ✅ **Simple:** No requiere distributed transactions ni mensaje queue
- ✅ **UX aceptable:** Duplicados (raros) se filtran transparentemente

**Cons:**
- Requiere cambiar `messages.id` de SERIAL a UUID (migration)
- Mensajes duplicados viajan por red (overhead mínimo)

**Veredicto:** ✅ **RECOMENDADO** — Balance perfecto robustez vs complejidad.

---

#### Opción B: At-Most-Once (Fire and Forget) 🔴

**Flujo:**
```typescript
socket.emit('send_message', { chatId, text }); // Sin callback
```

**Pros:**
- Muy simple (menos código)

**Cons:**
- ❌ **Mensajes se pierden** si red falla durante envío
- ❌ Cliente NO sabe si mensaje llegó (mal UX)

**Veredicto:** ❌ Inaceptable para app de mensajería.

---

#### Opción C: Exactly-Once con Transaction Queue 🟡

**Flujo:**
- Cliente asigna `sequenceNumber` incremental por chat
- Servidor persiste `last_sequence_number` por chat
- Si `sequenceNumber <= last_sequence_number` → duplicado, rechazar
- Si `sequenceNumber > last_sequence_number + 1` → hueco, rechazar (pedir retry)

**Pros:**
- Exactly-once garantizado (sin duplicados)

**Cons:**
- ❌ **Complejidad extrema:** Requiere tabla `chat_sequences`, manejo de huecos, retry logic complejo
- ❌ **Latencia:** Transacciones distribuidas (lock en tabla sequences)
- ❌ **Overkill:** Chat no es transacción financiera (duplicados ocasionales son aceptables)

**Veredicto:** 🟡 **Post-PMF** — Solo si usuarios reportan duplicados frecuentes (unlikely con Opción A).

---

### 3.5 Offline Support: Queue de Mensajes Pendientes

**Contexto:** Usuario envía mensaje sin conexión (WiFi apagado, 4G débil). ¿Cómo manejarlo?

#### Opción A: Queue en AsyncStorage + Auto-Send al Reconectar ✅

**Implementación:**
```typescript
// Servicio offline queue (React Native)
const offlineQueue = {
  async add(chatId: number, text: string, mediaUrl?: string) {
    const queue = await AsyncStorage.getItem('message_queue') || '[]';
    const messages = JSON.parse(queue);
    
    const newMessage = {
      id: uuidv4(),
      chatId,
      text,
      mediaUrl,
      timestamp: Date.now(),
    };
    
    messages.push(newMessage);
    
    // Límite 100 mensajes en cola (evitar llenar storage)
    if (messages.length > 100) {
      throw new Error('Demasiados mensajes pendientes. Conecta a WiFi.');
    }
    
    await AsyncStorage.setItem('message_queue', JSON.stringify(messages));
    return newMessage;
  },
  
  async process() {
    const queue = await AsyncStorage.getItem('message_queue') || '[]';
    const messages = JSON.parse(queue);
    
    for (const msg of messages) {
      try {
        await sendMessageViaSocket(msg);
        // Remover de cola si exitoso
        messages.splice(messages.indexOf(msg), 1);
      } catch (error) {
        console.log('Failed to send queued message', error);
        // Dejar en cola para próximo intento
      }
    }
    
    await AsyncStorage.setItem('message_queue', JSON.stringify(messages));
  },
};

// Hook conexión Socket.io
socket.on('connect', async () => {
  await offlineQueue.process(); // Enviar mensajes pendientes
});

// Botón enviar mensaje
const handleSend = async () => {
  if (!socket.connected) {
    // Agregar a cola offline
    const msg = await offlineQueue.add(chatId, text);
    // Mostrar en UI como "Pendiente de envío" (icono reloj)
    addMessageToUI({ ...msg, status: 'queued' });
  } else {
    // Enviar normal
    socket.emit('send_message', { chatId, text });
  }
};
```

**Pros:**
- ✅ **UX excelente:** Usuario puede seguir enviando mensajes offline, se sincronizan automáticamente
- ✅ **Transparente:** Estado "Pendiente → Enviando → Enviado" visible en UI
- ✅ **Robusto:** Mensajes no se pierden aunque app se cierre

**Cons:**
- Complejidad adicional (manejo AsyncStorage, estados UI)
- Límite 100 mensajes (mitigación: mostrar error claro)

**Veredicto:** ✅ **RECOMENDADO** — Crítico para UX mobile de calidad.

---

#### Opción B: Mostrar Error "No hay conexión" 🔴

**Flujo:**
```typescript
if (!socket.connected) {
  alert('No hay conexión. Intenta más tarde.');
  return;
}
```

**Pros:**
- Muy simple

**Cons:**
- ❌ **UX terrible:** Usuario pierde mensajes, frustración
- ❌ **Competencia:** WhatsApp, Telegram tienen queue offline

**Veredicto:** ❌ Inaceptable para app de mensajería seria.

---

### 3.6 Typing Indicator: Throttling y Timeout

**Contexto:** Usuario escribe rápido → emitir evento `typing` por cada tecla satura red. ¿Cómo optimizar?

#### Opción A: Throttle 500ms Client-Side + Timeout 3s Server-Side ✅

**Cliente:**
```typescript
import { throttle } from 'lodash';

const emitTyping = throttle(() => {
  if (socket.connected) {
    socket.emit('typing', { chatId });
  }
}, 500); // Max 1 evento cada 500ms

// Input onChange
const handleTextChange = (text) => {
  setText(text);
  emitTyping(); // Throttled
};

// Cuando deja de escribir (timer local)
useEffect(() => {
  const timer = setTimeout(() => {
    socket.emit('stop_typing', { chatId });
  }, 3000); // 3s sin escribir
  
  return () => clearTimeout(timer);
}, [text]);
```

**Servidor:**
```typescript
// Map para trackear quién está escribiendo en cada chat
const typingUsers = new Map<number, Set<number>>(); // chatId -> Set<userId>

socket.on('typing', ({ chatId }) => {
  const userId = socket.data.userId;
  
  if (!typingUsers.has(chatId)) {
    typingUsers.set(chatId, new Set());
  }
  
  typingUsers.get(chatId).add(userId);
  
  // Broadcast a otros usuarios en el chat (NO al sender)
  socket.to(`chat:${chatId}`).emit('user_typing', { userId, chatId });
  
  // Auto-stop después 3s (por si cliente no emite stop_typing)
  setTimeout(() => {
    typingUsers.get(chatId)?.delete(userId);
    socket.to(`chat:${chatId}`).emit('user_stop_typing', { userId, chatId });
  }, 3000);
});

socket.on('stop_typing', ({ chatId }) => {
  const userId = socket.data.userId;
  typingUsers.get(chatId)?.delete(userId);
  socket.to(`chat:${chatId}`).emit('user_stop_typing', { userId, chatId });
});
```

**Pros:**
- ✅ **Eficiente:** Max 2 eventos/segundo (500ms throttle) vs 10-20 sin throttle
- ✅ **UX fluida:** 500ms es imperceptible para usuario
- ✅ **Auto-cleanup:** Timeout server-side evita "escribiendo..." colgado

**Cons:**
- Ninguno significativo

**Veredicto:** ✅ **RECOMENDADO** — Standard industry (WhatsApp, Telegram usan similar).

---

#### Opción B: Debounce 1s (Solo Emitir al Dejar de Escribir) 🔴

**Implementación:**
```typescript
const emitTyping = debounce(() => {
  socket.emit('typing', { chatId });
}, 1000); // Emite solo si pasa 1s sin escribir
```

**Pros:**
- Menos eventos (solo 1 al terminar de escribir)

**Cons:**
- ❌ **UX mala:** Indicador aparece 1s DESPUÉS de que usuario empezó a escribir (delay perceptible)

**Veredicto:** ❌ Rechazado — Throttle es superior para tiempo real.

---

### 3.7 Read Receipts: ¿Cuándo Marcar Como Leído?

**Contexto:** ¿Marcar automáticamente cuando abre chat o cuando scroll hasta el mensaje?

#### Opción A: Automático al Abrir Chat + Scroll hasta Mensaje (WhatsApp-like) ✅

**Cliente:**
```typescript
// Cuando abre chat
useEffect(() => {
  if (chatId && socket.connected) {
    socket.emit('join_chat', { chatId });
    
    // Cargar mensajes no leídos
    const unreadMessages = await fetchMessages(chatId, { unreadOnly: true });
    
    // Marcar como leídos (batch)
    if (unreadMessages.length > 0) {
      const messageIds = unreadMessages.map(m => m.id);
      socket.emit('mark_read', { chatId, messageIds });
    }
  }
}, [chatId]);

// Cuando hace scroll (infinite scroll hacia arriba)
const handleScroll = () => {
  // Detectar mensajes visibles en viewport
  const visibleMessages = getVisibleMessages();
  const unreadVisible = visibleMessages.filter(m => !m.read && m.senderId !== myUserId);
  
  if (unreadVisible.length > 0) {
    const messageIds = unreadVisible.map(m => m.id);
    socket.emit('mark_read', { chatId, messageIds });
  }
};
```

**Servidor:**
```typescript
socket.on('mark_read', async ({ chatId, messageIds }) => {
  const userId = socket.data.userId;
  
  // Validar que userId es destinatario de estos mensajes
  const updated = await prisma.message.updateMany({
    where: {
      id: { in: messageIds },
      chat_id: chatId,
      sender_id: { not: userId }, // No puede marcar sus propios mensajes
      read: false,
    },
    data: {
      read: true,
      read_at: new Date(),
    },
  });
  
  if (updated.count > 0) {
    // Obtener sender_ids únicos de mensajes marcados
    const messages = await prisma.message.findMany({
      where: { id: { in: messageIds } },
      select: { sender_id: true, id: true },
    });
    
    // Emitir evento a cada sender (para actualizar double-check)
    messages.forEach(msg => {
      io.to(`user:${msg.sender_id}`).emit('message_read', {
        messageId: msg.id,
        readAt: new Date(),
      });
    });
  }
});

// Cliente recibe confirmación lectura
socket.on('message_read', ({ messageId, readAt }) => {
  updateMessageUI(messageId, { read: true, readAt }); // Cambiar a doble check azul
});
```

**Pros:**
- ✅ **UX intuitiva:** Similar a WhatsApp (usuarios familiarizados)
- ✅ **Batch eficiente:** 1 UPDATE para múltiples mensajes (no 1 query por mensaje)
- ✅ **Preciso:** Solo marca leídos si realmente visibles

**Cons:**
- Complejidad adicional (detectar viewport)
- Mitigation: Librería `react-native-intersection-observer` simplifica detección

**Veredicto:** ✅ **RECOMENDADO** — Balance entre UX y performance.

---

#### Opción B: Solo al Abrir Chat (Marcar Todos) 🟡

**Implementación:**
```typescript
socket.emit('mark_all_read', { chatId });
```

**Pros:**
- Muy simple (1 query: UPDATE messages WHERE chat_id=X AND read=false)

**Cons:**
- Menos preciso (marca como leídos mensajes que no scrolleó aún)
- UX: Si chat tiene 200 mensajes y solo leyó los últimos 10, marca todos como leídos incorrectamente

**Veredicto:** 🟡 **MVP simplificado** — Usar si Opción A es muy compleja. Migrar después.

---

### 3.8 Multimedia Upload: ¿Vía Servidor o Directo a Cloudinary?

**Contexto:** Usuario envía imagen/video en chat. Upload puede ser 5-50MB. ¿Saturar servidor HTTP o upload directo?

#### Opción A: Signed Upload Directo a Cloudinary ✅

**Flujo:**
```typescript
// 1. Cliente solicita signed URL
const { signature, timestamp, uploadUrl } = await api.post('/api/chats/:chatId/upload-signature', {
  fileType: 'image/jpeg',
});

// 2. Cliente sube directo a Cloudinary (NO pasa por servidor QuickFixU)
const formData = new FormData();
formData.append('file', imageFile);
formData.append('signature', signature);
formData.append('timestamp', timestamp);
formData.append('api_key', CLOUDINARY_API_KEY);

const cloudinaryResponse = await fetch(uploadUrl, {
  method: 'POST',
  body: formData,
});

const { secure_url } = await cloudinaryResponse.json();

// 3. Cliente envía mensaje con media_url
socket.emit('send_message', {
  chatId,
  text: '', // Opcional
  mediaUrl: secure_url,
  mediaType: 'image',
});
```

**Servidor (generar signature):**
```typescript
// POST /api/chats/:chatId/upload-signature
router.post('/:chatId/upload-signature', requireAuth, async (req, res) => {
  const { chatId } = req.params;
  const { fileType } = req.body;
  
  // Validar que user pertenece al chat
  const chat = await prisma.chat.findFirst({
    where: {
      id: parseInt(chatId),
      OR: [
        { client_id: req.userId },
        { professional_id: req.userId },
      ],
    },
  });
  
  if (!chat) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Generar signature Cloudinary (válida 1 hora)
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder: `quickfixu/chats/${chatId}` },
    CLOUDINARY_API_SECRET
  );
  
  res.json({
    signature,
    timestamp,
    uploadUrl: `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    folder: `quickfixu/chats/${chatId}`,
  });
});
```

**Pros:**
- ✅ **Escalabilidad:** Servidor NO maneja upload pesado (ahorra bandwidth + CPU)
- ✅ **Performance:** Upload paralelo (mientras usuario sigue chateando)
- ✅ **Seguridad:** Signature expira en 1h, solo válida para folder específico

**Cons:**
- Complejidad adicional (2 steps: signature + upload + mensaje)
- Cliente debe manejar errores Cloudinary

**Veredicto:** ✅ **RECOMENDADO** — Standard para apps de escala (Instagram, WhatsApp usan similar).

---

#### Opción B: Upload vía Servidor (Multer) 🔴

**Flujo:**
```typescript
// Cliente POST a servidor con FormData
const formData = new FormData();
formData.append('file', imageFile);
formData.append('chatId', chatId);

await api.post('/api/messages/upload', formData);
```

**Servidor:**
```typescript
router.post('/upload', upload.single('file'), async (req, res) => {
  const cloudinaryUrl = await uploadToCloudinary(req.file.buffer);
  // Crear mensaje con media_url
});
```

**Pros:**
- Simple (1 request)

**Cons:**
- ❌ **Servidor se satura** con uploads concurrentes (10 usuarios subiendo 50MB = 500MB simultáneos)
- ❌ **Timeout:** Videos grandes >30MB timeout HTTP (30s limit Express)
- ❌ **No escala:** Requiere load balancer con sticky sessions

**Veredicto:** ❌ Rechazado — Antipatrón para apps de escala.

---

### 3.9 Notificaciones Push: ¿Cuándo Enviar?

**Contexto:** Usuario recibe mensaje. ¿Siempre enviar push o solo si offline?

#### Opción A: Condicional: Offline O Online pero NO en el Chat ✅

**Servidor:**
```typescript
socket.on('send_message', async ({ chatId, text }, callback) => {
  const message = await saveMessage(...);
  
  // Broadcast a room
  io.to(`chat:${chatId}`).emit('new_message', message);
  
  // Determinar destinatario
  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  const recipientId = chat.client_id === socket.data.userId 
    ? chat.professional_id 
    : chat.client_id;
  
  // Buscar socket del destinatario
  const recipientSockets = await io.in(`user:${recipientId}`).fetchSockets();
  
  let shouldSendPush = true;
  
  if (recipientSockets.length > 0) {
    // Destinatario está ONLINE, verificar si está en este chat específico
    const inThisChat = recipientSockets.some(s => s.rooms.has(`chat:${chatId}`));
    
    if (inThisChat) {
      shouldSendPush = false; // Está viendo el chat en tiempo real, NO enviar push
    }
  }
  
  if (shouldSendPush) {
    await sendPushNotification(recipientId, {
      title: `Nuevo mensaje de ${senderName}`,
      body: text.substring(0, 100), // Truncar
      data: {
        type: 'new_message',
        chatId,
        messageId: message.id,
      },
    });
  }
  
  callback({ success: true, message });
});
```

**Pros:**
- ✅ **UX excelente:** No spam push si ya está viendo el chat
- ✅ **Preciso:** Detecta presencia en room específico (`socket.rooms.has(...)`)

**Cons:**
- Lógica condicional compleja (testing riguroso)
- Edge case: Multiple devices (si tiene 2 celulares, solo 1 en el chat → ¿enviar push al otro?)

**Veredicto:** ✅ **RECOMENDADO** — Comportamiento esperado por usuarios (similar a WhatsApp).

---

#### Opción B: Siempre Enviar Push (Usuario Silencia en Settings) 🔴

**Implementación:**
```typescript
// Siempre enviar, usuario controla en ajustes de app
await sendPushNotification(recipientId, ...);
```

**Pros:**
- Muy simple (sin lógica condicional)

**Cons:**
- ❌ **Spam:** Usuario recibe push aunque esté chateando (irritante)
- ❌ **Competencia:** Ninguna app seria hace esto

**Veredicto:** ❌ Inaceptable — Mala UX.

---

### 3.10 Escalabilidad Horizontal: Redis Adapter

**Contexto:** MVP = 1 servidor. ¿Preparar para escalar a múltiples instancias?

#### Opción A: Redis Adapter Preparado, NO Activado MVP ✅

**Implementación:**
```typescript
// socket.ts (preparado pero comentado)
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

export const setupSocketIO = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: '*' },
  });
  
  // FASE 4: Activar cuando tengamos >1 servidor
  if (process.env.REDIS_ADAPTER_ENABLED === 'true') {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    
    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      console.log('Socket.io Redis adapter enabled');
    });
  }
  
  // Middleware, eventos, etc.
  return io;
};
```

**Nginx config (preparado para sticky sessions):**
```nginx
upstream quickfixu_backend {
  ip_hash; # Sticky sessions basado en IP cliente
  server 10.0.1.10:3000;
  server 10.0.1.11:3000;
  server 10.0.1.12:3000;
}

server {
  location / {
    proxy_pass http://quickfixu_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade"; # WebSocket upgrade
  }
}
```

**Pros:**
- ✅ **Preparado:** Código lista para activar con env var
- ✅ **Sin overhead MVP:** No paga costo Redis si no lo usa
- ✅ **Documentado:** Nginx config + instrucciones en README

**Cons:**
- Ninguno (es preparación, no costo actual)

**Veredicto:** ✅ **RECOMENDADO** — Arquitectura profesional preparada para crecer.

---

#### Opción B: Sin Redis, Migrar Cuando Sea Necesario 🟡

**Pros:**
- Más simple (menos dependencias)

**Cons:**
- Refactor mayor cuando escala (downtime, testing)

**Veredicto:** 🟡 Aceptable si presupuesto muy ajustado. Opción A es mejor práctica.

---

### 3.11 Rate Limiting: Prevenir Spam

**Contexto:** Usuario malicioso envía 1000 mensajes/segundo (bot, abuse). ¿Cómo limitar?

#### Opción A: Redis Sliding Window (20 Mensajes/Minuto) ✅

**Implementación:**
```typescript
import { RateLimiterRedis } from 'rate-limiter-flexible';

const messageLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'msg_limit',
  points: 20, // Máximo 20 mensajes
  duration: 60, // Por minuto
});

socket.on('send_message', async ({ chatId, text }, callback) => {
  const userId = socket.data.userId;
  
  try {
    await messageLimiter.consume(userId); // Decrementa contador
  } catch (error) {
    // Rate limit excedido
    socket.emit('error', {
      type: 'rate_limit_exceeded',
      message: 'Demasiados mensajes. Espera 1 minuto.',
    });
    callback({ success: false, error: 'Rate limit exceeded' });
    return;
  }
  
  // Procesar mensaje normal
  const message = await saveMessage(...);
  // ...
});
```

**Pros:**
- ✅ **Efectivo:** Sliding window más justo que fixed window (no reset abrupto)
- ✅ **Distribuido:** Funciona con múltiples servidores (Redis compartido)
- ✅ **Configurable:** Ajustar límite según feedback usuarios

**Cons:**
- Requiere Redis (ya lo tenemos de Fase 1)

**Veredicto:** ✅ **RECOMENDADO** — Protección esencial contra abuse.

---

#### Opción B: In-Memory Map (Solo 1 Servidor) 🔴

**Implementación:**
```typescript
const messageCounters = new Map<number, number[]>(); // userId -> timestamps[]

socket.on('send_message', (...) => {
  const now = Date.now();
  const timestamps = messageCounters.get(userId) || [];
  
  // Filtrar timestamps últimos 60s
  const recentTimestamps = timestamps.filter(t => t > now - 60000);
  
  if (recentTimestamps.length >= 20) {
    socket.emit('error', 'Rate limit exceeded');
    return;
  }
  
  recentTimestamps.push(now);
  messageCounters.set(userId, recentTimestamps);
});
```

**Pros:**
- Simple (sin dependencia externa)

**Cons:**
- ❌ NO funciona con múltiples servidores (cada instancia tiene su propio Map)
- ❌ Usuario puede bypassear conectándose a otro servidor

**Veredicto:** ❌ Rechazado — Solo sirve para MVP 1 servidor, pero migración a Redis es friction.

---

## 4. Architecture Decisions (Finales)

### AD-001: Socket.io con Namespace Global + Rooms por Chat

**Decision:** Usar 1 namespace global `/` con rooms dinámicos `chat:{chatId}` y `user:{userId}`.

**Rationale:**
- Simplicidad arquitectura MVP
- Broadcasting eficiente por chat
- Soporte multi-room (usuario puede estar en múltiples chats)
- Extensible para features futuras (videollamadas = namespace `/video`)

**Implications:**
- Cliente conecta 1 sola vez (no múltiples sockets)
- Eventos deben tener prefijo claro (`chat:`, `notif:`) si agregamos otros namespaces

---

### AD-002: JWT Authentication en Handshake (Query Param)

**Decision:** Pasar JWT en `socket.handshake.auth.token`, validar en middleware `io.use()`.

**Rationale:**
- Recomendación oficial Socket.io
- Compatible con polling fallback
- Reutiliza lógica JWT existente (Fase 1)

**Implications:**
- Token visible en logs servidor → sanitizar logs (no imprimir query params)
- HTTPS obligatorio producción

---

### AD-003: At-Least-Once Delivery con UUID Deduplicación

**Decision:** Mensajes usan UUID como PK, servidor hace `upsert`, cliente deduplica por `messageId`.

**Rationale:**
- Balance robustez vs complejidad
- Duplicados raros (solo si ACK se pierde) y transparentes para usuario
- No requiere distributed transactions

**Implications:**
- Migration: cambiar `messages.id` de SERIAL a UUID
- Frontend debe filtrar duplicados antes de renderizar

---

### AD-004: Offline Queue en AsyncStorage (Max 100 Mensajes)

**Decision:** Mensajes offline se guardan en AsyncStorage, se envían automáticamente al reconectar.

**Rationale:**
- UX crítico para mobile (4G inestable)
- Competencia (WhatsApp, Telegram) lo hace
- Límite 100 previene saturar storage

**Implications:**
- Complejidad adicional frontend (manejo cola, estados UI)
- Testing riguroso (edge cases: app cerrada, storage lleno)

---

### AD-005: Typing Indicator Throttled + Timeout

**Decision:** Cliente throttle 500ms, servidor timeout 3s auto-stop.

**Rationale:**
- Reduce eventos red 90% (vs sin throttle)
- UX fluida (500ms imperceptible)
- Auto-cleanup evita "escribiendo..." colgado

**Implications:**
- Librería `lodash.throttle` requerida
- Servidor mantiene Map en memoria (limpieza automática por timeout)

---

### AD-006: Read Receipts al Abrir + Viewport

**Decision:** Marcar como leídos mensajes visibles en viewport cuando abre chat o hace scroll.

**Rationale:**
- UX precisa (similar WhatsApp)
- Batch UPDATE eficiente (no 1 query por mensaje)

**Implications:**
- Complejidad frontend (detectar viewport)
- Librería `react-native-intersection-observer` recomendada

---

### AD-007: Signed Upload Directo a Cloudinary

**Decision:** Cliente solicita signature (POST /upload-signature), sube directo a Cloudinary, envía mensaje con URL.

**Rationale:**
- Escalabilidad (servidor no maneja uploads pesados)
- Performance (upload paralelo)
- Seguridad (signature expira 1h)

**Implications:**
- 2 steps adicionales (signature + upload + mensaje)
- Cliente debe manejar errores Cloudinary

---

### AD-008: Push Condicional (Offline O No en Chat)

**Decision:** Enviar FCM solo si destinatario offline O online pero NO en el chat específico.

**Rationale:**
- Evita spam push si usuario está viendo chat
- UX esperada (WhatsApp, Telegram)

**Implications:**
- Lógica condicional compleja (`socket.rooms.has('chat:X')`)
- Testing riguroso (edge cases múltiples devices)

---

### AD-009: Redis Adapter Preparado, NO Activado MVP

**Decision:** Código listo para Redis adapter, activar con env var `REDIS_ADAPTER_ENABLED=true`.

**Rationale:**
- MVP = 1 servidor (no necesario)
- Preparado para escalar sin refactor mayor
- Documentado en README (instrucciones Nginx sticky sessions)

**Implications:**
- Dependencia `@socket.io/redis-adapter` instalada (no usada MVP)
- Nginx config preparado (comentado)

---

### AD-010: Rate Limiting Redis Sliding Window (20 msg/min)

**Decision:** `rate-limiter-flexible` con Redis, 20 mensajes por minuto por usuario.

**Rationale:**
- Protección esencial contra bots/abuse
- Sliding window más justo que fixed
- Funciona con múltiples servidores

**Implications:**
- Redis requerido (ya lo tenemos Fase 1)
- Ajustar límite según feedback usuarios (configuración)

---

## 5. Socket.io Events Specification

### Event: `connection`

**Direction:** Server  
**Trigger:** Cliente conecta WebSocket  

**Server Handler:**
```typescript
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.data.userId = decoded.userId;
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.data.userId;
  console.log(`User ${userId} connected`);
  
  // Join personal room para notificaciones directas
  socket.join(`user:${userId}`);
  
  // Emitir evento confirmación
  socket.emit('connected', { userId });
});
```

---

### Event: `join_chat`

**Direction:** Client → Server  
**Trigger:** Usuario abre un chat específico  

**Payload:**
```typescript
{
  chatId: number
}
```

**Server Handler:**
```typescript
socket.on('join_chat', async ({ chatId }) => {
  const userId = socket.data.userId;
  
  // Validar que user pertenece al chat
  const chat = await prisma.chat.findFirst({
    where: {
      id: chatId,
      OR: [
        { client_id: userId },
        { professional_id: userId },
      ],
    },
  });
  
  if (!chat) {
    socket.emit('error', { message: 'Access denied' });
    return;
  }
  
  socket.join(`chat:${chatId}`);
  socket.emit('joined_chat', { chatId });
});
```

---

### Event: `leave_chat`

**Direction:** Client → Server  
**Trigger:** Usuario cierra el chat (navega a otra pantalla)  

**Payload:**
```typescript
{
  chatId: number
}
```

**Server Handler:**
```typescript
socket.on('leave_chat', ({ chatId }) => {
  socket.leave(`chat:${chatId}`);
  socket.emit('left_chat', { chatId });
});
```

---

### Event: `send_message`

**Direction:** Client → Server  
**Trigger:** Usuario envía mensaje (texto y/o media)  

**Payload:**
```typescript
{
  messageId: string; // UUID v4 (cliente genera)
  chatId: number;
  text?: string; // Opcional si hay media
  mediaUrl?: string; // URL Cloudinary (si subió archivo)
  mediaType?: 'image' | 'video'; // Requerido si mediaUrl presente
}
```

**Server Handler:**
```typescript
socket.on('send_message', async (payload, callback) => {
  const { messageId, chatId, text, mediaUrl, mediaType } = payload;
  const userId = socket.data.userId;
  
  try {
    // Rate limiting
    await messageLimiter.consume(userId);
    
    // Validar contenido
    if (!text && !mediaUrl) {
      throw new Error('Message must have text or media');
    }
    
    if (text && text.length > 2000) {
      throw new Error('Text exceeds 2000 characters');
    }
    
    // Guardar en BD (upsert para idempotencia)
    const message = await prisma.message.upsert({
      where: { id: messageId },
      update: {}, // No actualizar si existe (duplicado)
      create: {
        id: messageId,
        chat_id: chatId,
        sender_id: userId,
        message_text: text || null,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
      },
      include: {
        sender: {
          select: {
            id: true,
            full_name: true,
            profile_photo_url: true,
          },
        },
      },
    });
    
    // Broadcast a room (incluido sender para confirmación)
    io.to(`chat:${chatId}`).emit('new_message', message);
    
    // Notificación push condicional
    await handlePushNotification(chatId, userId, text || '[Media]');
    
    // ACK a sender
    callback({ success: true, message });
  } catch (error) {
    callback({ success: false, error: error.message });
  }
});
```

---

### Event: `new_message`

**Direction:** Server → Client  
**Trigger:** Servidor confirma mensaje guardado y lo broadcastea  

**Payload:**
```typescript
{
  id: string; // UUID
  chat_id: number;
  sender_id: number;
  message_text: string | null;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  read: boolean; // false al crearse
  read_at: string | null;
  created_at: string; // ISO 8601
  sender: {
    id: number;
    full_name: string;
    profile_photo_url: string;
  };
}
```

**Client Handler:**
```typescript
socket.on('new_message', (message) => {
  // Deduplicar
  if (messages.find(m => m.id === message.id)) {
    return; // Ya existe, ignorar
  }
  
  // Agregar a UI
  addMessage(message);
  
  // Si es chat actual y mensaje de otro usuario, marcar como leído
  if (currentChatId === message.chat_id && message.sender_id !== myUserId) {
    socket.emit('mark_read', { chatId: message.chat_id, messageIds: [message.id] });
  }
});
```

---

### Event: `typing`

**Direction:** Client → Server  
**Trigger:** Usuario escribe (throttled 500ms)  

**Payload:**
```typescript
{
  chatId: number
}
```

**Server Handler:**
```typescript
const typingTimeouts = new Map<string, NodeJS.Timeout>();

socket.on('typing', ({ chatId }) => {
  const userId = socket.data.userId;
  const key = `${chatId}:${userId}`;
  
  // Broadcast a otros en el chat (NO al sender)
  socket.to(`chat:${chatId}`).emit('user_typing', { userId, chatId });
  
  // Cancelar timeout previo
  if (typingTimeouts.has(key)) {
    clearTimeout(typingTimeouts.get(key));
  }
  
  // Auto-stop después 3s
  const timeout = setTimeout(() => {
    socket.to(`chat:${chatId}`).emit('user_stop_typing', { userId, chatId });
    typingTimeouts.delete(key);
  }, 3000);
  
  typingTimeouts.set(key, timeout);
});
```

---

### Event: `user_typing`

**Direction:** Server → Client  
**Trigger:** Otro usuario en el chat está escribiendo  

**Payload:**
```typescript
{
  userId: number;
  chatId: number;
}
```

**Client Handler:**
```typescript
socket.on('user_typing', ({ userId, chatId }) => {
  if (currentChatId === chatId) {
    setTypingUsers(prev => [...prev, userId]); // Mostrar "Juan está escribiendo..."
  }
});
```

---

### Event: `stop_typing`

**Direction:** Client → Server  
**Trigger:** Usuario deja de escribir (manual o timeout 3s)  

**Payload:**
```typescript
{
  chatId: number
}
```

**Server Handler:**
```typescript
socket.on('stop_typing', ({ chatId }) => {
  const userId = socket.data.userId;
  const key = `${chatId}:${userId}`;
  
  // Cancelar timeout auto-stop
  if (typingTimeouts.has(key)) {
    clearTimeout(typingTimeouts.get(key));
    typingTimeouts.delete(key);
  }
  
  socket.to(`chat:${chatId}`).emit('user_stop_typing', { userId, chatId });
});
```

---

### Event: `user_stop_typing`

**Direction:** Server → Client  
**Trigger:** Usuario dejó de escribir  

**Payload:**
```typescript
{
  userId: number;
  chatId: number;
}
```

**Client Handler:**
```typescript
socket.on('user_stop_typing', ({ userId, chatId }) => {
  if (currentChatId === chatId) {
    setTypingUsers(prev => prev.filter(id => id !== userId)); // Remover indicador
  }
});
```

---

### Event: `mark_read`

**Direction:** Client → Server  
**Trigger:** Usuario abre chat o scrollea hasta mensajes no leídos  

**Payload:**
```typescript
{
  chatId: number;
  messageIds: string[]; // Array de UUIDs
}
```

**Server Handler:**
```typescript
socket.on('mark_read', async ({ chatId, messageIds }) => {
  const userId = socket.data.userId;
  
  const updated = await prisma.message.updateMany({
    where: {
      id: { in: messageIds },
      chat_id: chatId,
      sender_id: { not: userId }, // No marcar propios mensajes
      read: false,
    },
    data: {
      read: true,
      read_at: new Date(),
    },
  });
  
  if (updated.count > 0) {
    // Obtener senders únicos
    const messages = await prisma.message.findMany({
      where: { id: { in: messageIds } },
      select: { id: true, sender_id: true },
    });
    
    // Emitir a cada sender
    messages.forEach(msg => {
      io.to(`user:${msg.sender_id}`).emit('message_read', {
        messageId: msg.id,
        chatId,
        readAt: new Date().toISOString(),
      });
    });
  }
});
```

---

### Event: `message_read`

**Direction:** Server → Client  
**Trigger:** Destinatario marcó mensaje como leído  

**Payload:**
```typescript
{
  messageId: string;
  chatId: number;
  readAt: string; // ISO 8601
}
```

**Client Handler:**
```typescript
socket.on('message_read', ({ messageId, chatId, readAt }) => {
  // Actualizar UI: doble check gris → azul
  updateMessage(messageId, { read: true, readAt });
});
```

---

### Event: `error`

**Direction:** Server → Client  
**Trigger:** Error en operación (rate limit, validación, etc.)  

**Payload:**
```typescript
{
  type: 'rate_limit_exceeded' | 'access_denied' | 'validation_error';
  message: string;
}
```

**Client Handler:**
```typescript
socket.on('error', ({ type, message }) => {
  if (type === 'rate_limit_exceeded') {
    showToast('Demasiados mensajes. Espera 1 minuto.');
  } else {
    showToast(message);
  }
});
```

---

## 6. Dependencies Required

### Backend:
```json
{
  "socket.io": "^4.6.0",
  "@socket.io/redis-adapter": "^8.2.1",
  "redis": "^4.6.5",
  "rate-limiter-flexible": "^2.4.1",
  "uuid": "^9.0.0",
  "@types/uuid": "^9.0.0"
}
```

### Frontend (React Native):
```json
{
  "socket.io-client": "^4.6.0",
  "@react-native-async-storage/async-storage": "^1.19.0",
  "react-native-compressor": "^1.8.0",
  "lodash.throttle": "^4.1.1",
  "@types/lodash.throttle": "^4.1.7"
}
```

### Instalación:
```bash
# Backend
cd backend
npm install socket.io @socket.io/redis-adapter redis rate-limiter-flexible uuid

# Frontend
cd ../mobile
npm install socket.io-client @react-native-async-storage/async-storage react-native-compressor lodash.throttle
```

---

## 7. Database Changes

### Migration: `20260322_create_messages_table`

```sql
-- Crear tabla messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  message_text TEXT,
  media_url VARCHAR(500),
  media_type VARCHAR(10), -- 'image' | 'video'
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_message_content CHECK (message_text IS NOT NULL OR media_url IS NOT NULL),
  CONSTRAINT chk_media_type CHECK (media_type IN ('image', 'video') OR media_type IS NULL)
);

-- Índices para performance
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_chat_created ON messages(chat_id, created_at DESC, id); -- Cursor pagination
CREATE INDEX idx_messages_unread ON messages(chat_id, read) WHERE read = FALSE; -- Partial index

-- Trigger: Actualizar chats.last_message_at
CREATE OR REPLACE FUNCTION update_chat_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chats
  SET last_message_at = NEW.created_at,
      updated_at = NOW()
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_chat_last_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_chat_last_message();

-- Agregar campo media_type a tabla (si falta)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type VARCHAR(10);
ALTER TABLE messages ADD CONSTRAINT chk_media_type CHECK (media_type IN ('image', 'video') OR media_type IS NULL);
```

**IMPORTANTE:** Cambiar tipo `id` de SERIAL (Fase 2 DataModel.md) a UUID para soportar deduplicación.

---

## 8. Risks & Mitigations

### Risk 1: Mensajes Duplicados (At-Least-Once)
**Impact:** MEDIO — UX confuso si aparecen 2 veces  
**Probability:** BAJA (solo si ACK se pierde)  
**Mitigation:**
- Deduplicación client-side por `messageId` (UUID)
- Testing riguroso: simular pérdida ACK (Cypress + network throttling)
- Monitoring: trackear duplicados (métrica `duplicate_messages_filtered`)

---

### Risk 2: Race Condition Accept Proposal + Delete Message
**Impact:** BAJO — Edge case raro  
**Probability:** MUY BAJA  
**Mitigation:**
- Validar `proposal.status` ANTES de aceptar (lock optimista con `updatedAt`)
- Transacción: `BEGIN; SELECT ... FOR UPDATE; UPDATE; COMMIT;`

---

### Risk 3: Cloudinary Bandwidth Excede Free Tier
**Impact:** ALTO — Costo $149/mes si excede 25GB  
**Probability:** MEDIA (videos consumen rápido)  
**Mitigation:**
- Comprimir videos client-side (react-native-compressor target 5MB)
- Límite upload 15MB post-compresión
- Alert cuando bandwidth >80% free tier (Cloudinary API)
- Migrar a S3 si excede ($0.09/GB = ~$2.25 por 25GB)

---

### Risk 4: WebSocket Connections Leak
**Impact:** MEDIO — Memoria servidor crece hasta crash  
**Probability:** BAJA (Socket.io maneja bien)  
**Mitigation:**
- Heartbeat cada 25s (Socket.io default `pingInterval`)
- Desconectar sockets sin actividad >2min (`pingTimeout: 120000`)
- Monitoring: trackear `socket.io_connections` (Prometheus)
- Alert si >10K conexiones en 1 servidor (escalar horizontalmente)

---

### Risk 5: Offline Queue Crece Sin Límite
**Impact:** BAJO — Storage móvil lleno  
**Probability:** MUY BAJA (requiere 100+ mensajes pendientes)  
**Mitigation:**
- Límite 100 mensajes en cola
- Error claro: "Demasiados mensajes pendientes. Conecta a WiFi."
- Botón "Limpiar cola" en settings (emergencia)

---

### Risk 6: Notificación Push a Usuario Online (Falso Negativo)
**Impact:** MEDIO — Spam push irritante  
**Probability:** BAJA (lógica condicional bien testeada)  
**Mitigation:**
- Double-check: (1) `socket.connected` && (2) `socket.rooms.has('chat:X')`
- Logging: trackear falsos positivos (`push_sent_to_online_user`)
- Ajustar lógica según feedback usuarios

---

### Risk 7: Multiple Devices (Mismo Usuario 2 Celulares)
**Impact:** MEDIO — Read receipts inconsistentes  
**Probability:** BAJA en MVP (mayoría 1 device)  
**Mitigation:**
- MVP acepta comportamiento: último device que lee marca todos
- Fase 7: tabla `user_sessions` (1 registro por device) + broadcast `message_read` a todos devices
- Documentar limitación en FAQ

---

### Risk 8: Redis Single Point of Failure (Si Activamos Adapter)
**Impact:** ALTO — Todos sockets desconectan si Redis cae  
**Probability:** BAJA (MVP sin Redis adapter)  
**Mitigation:**
- MVP: NO activar Redis adapter (1 servidor)
- Fase 4 (múltiples servidores): Redis Cluster (3 nodos mínimo)
- Fallback: si Redis cae, desactivar adapter automáticamente + polling HTTP temporal

---

## 9. Open Questions (Decisión del Usuario)

### Q1: ¿Comprimir videos automáticamente en cliente?
**Opciones:**
- A) Sí, target 5MB (reduce bandwidth Cloudinary, mejor UX upload rápido)
- B) No, dejar original (calidad máxima, usuario decide comprimir manual)

**Recomendación:** **Opción A** — Mayoría usuarios no sabe comprimir, 5MB es calidad aceptable (720p).

---

### Q2: ¿Límite caracteres mensajes: 2000 o 5000?
**Opciones:**
- A) 2000 chars (WhatsApp-like, fomenta mensajes concisos)
- B) 5000 chars (más flexibilidad, útil para presupuestos detallados)

**Recomendación:** **Opción A (2000)** — Mensajes largos son difíciles de leer en mobile. Si necesita >2000, enviar múltiples mensajes o adjuntar documento.

---

### Q3: ¿Permitir editar mensajes enviados?
**Opciones:**
- A) No (MVP), agregar Fase 7 (requiere tabla `message_edits`)
- B) Sí (complejidad adicional: evento `edit_message`, UI "editado")

**Recomendación:** **Opción A (No en MVP)** — Feature nice-to-have, no crítica. Agregar si usuarios piden mucho.

---

### Q4: ¿Permitir eliminar mensajes?
**Opciones:**
- A) No (MVP)
- B) Sí, solo para sender, marca `deleted_at` (soft delete)
- C) Sí, para ambos (elimina de BD, como WhatsApp "Eliminar para todos")

**Recomendación:** **Opción B (Soft Delete Solo Sender)** — Balance privacidad vs auditoría. Eliminar para ambos requiere lógica compleja (timeout 7 días, notificaciones).

---

### Q5: ¿Rate limit 20 mensajes/minuto es adecuado?
**Opciones:**
- A) 20 msg/min (actual)
- B) 30 msg/min (más permisivo)
- C) 10 msg/min (más restrictivo)

**Recomendación:** **Opción A (20)** — Usuario legítimo rara vez envía >20 msg/min. Ajustar según telemetría si hay falsos positivos.

---

### Q6: ¿Activar Redis Adapter en MVP?
**Opciones:**
- A) No (1 servidor, sin overhead)
- B) Sí (preparado para escalar desde día 1)

**Recomendación:** **Opción A (No)** — MVP 1 servidor suficiente. Activar cuando tengamos >5K usuarios concurrentes (estimado: mes 6 post-launch).

---

## 10. Integration with Fases 1-2

### Fase 1 Dependencies:
✅ **JWT Middleware:** Reutilizar `requireAuth` para validar token en HTTP endpoints (upload signature)  
✅ **Redis:** Extender para rate limiting (ya tenemos cliente Redis de geocoding cache)  
✅ **FCM:** Reutilizar `sendPushNotification(userId, payload)` para mensajes nuevos  
✅ **Cloudinary:** Reutilizar `uploadService.generateSignature()` para signed uploads  

### Fase 2 Dependencies:
✅ **Tabla `chats`:** Ya existe, solo necesita tabla `messages` (crear en esta fase)  
✅ **Chat auto-creation:** Lógica existente (proposal.send → INSERT chat if not exists) se mantiene  
✅ **Tabla `notifications`:** Reutilizar para guardar historial push notifications  

### Flujo Integrado (Ejemplo):
1. **Fase 2:** Profesional envía propuesta desde post → Backend crea registro en `chats`
2. **Fase 3 (nueva):** Backend emite evento `new_message` via Socket.io con mensaje template:
   ```
   📋 Nueva propuesta de $8,500
   📅 Fecha: 23/03/2026 9:00am
   [Ver detalles]
   ```
3. Cliente (online) recibe mensaje en tiempo real (WebSocket)
4. Cliente (offline) recibe push notification (FCM) + mensaje queda en BD
5. Cuando cliente se conecta, carga historial desde BD (últimos 50 mensajes)
6. Cliente responde "¿Podés a las 10am?" → Socket.io envía mensaje
7. Profesional recibe en tiempo real (si online) o push (si offline)

**Backwards Compatibility:**
- Fase 2 puede funcionar sin Fase 3 (chats existen, pero no hay mensajería)
- Fase 3 requiere Fase 2 completa (tabla `chats` debe existir)

---

## 11. Conclusión

La Fase 3 convierte QuickFixU en una **plataforma de comunicación bidireccional funcional**, eliminando friction entre clientes y profesionales. Chat en tiempo real es el feature que diferencia una app transaccional de una plataforma sticky (usuarios regresan).

**Complejidad vs Valor:**
- Complejidad: **MUY ALTA** (WebSockets, concurrencia, offline, notificaciones condicionales)
- Valor: **CRÍTICO** — Sin chat, usuarios abandonan (no pueden negociar, coordinar visitas)

**Listo para siguiente fase:**
✅ Arquitectura definida (Socket.io + rooms)  
✅ Delivery guarantees claras (at-least-once + deduplicación)  
✅ Offline support robusto (AsyncStorage queue)  
✅ Escalabilidad preparada (Redis adapter documentado)  
✅ Eventos especificados (8 eventos core)  
✅ Riesgos identificados con mitigaciones  

**Próximos pasos:**
1. **Proposal Document** (formalizar plan implementación)
2. **Spec Document** (requirements funcionales detallados con escenarios Gherkin)
3. **Design Document** (arquitectura componentes, diagramas secuencia)
4. **Tasks Breakdown** (estimación dev, sprints 2-3 semanas)

---

**Fin Exploration Fase 3 - Chat en Tiempo Real**  
*Última actualización: Marzo 2026*
