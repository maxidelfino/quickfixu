# Design: Fase 3 - Chat en Tiempo Real

**Change name:** `fase-3-chat-realtime`  
**Date:** Marzo 2026  
**Status:** Design Complete  
**Prerequisite:** Fase 2 (Posts & Proposals) completada

---

## 1. Technical Approach

### Resumen Ejecutivo

Implementar **mensajería en tiempo real bidireccional** usando **Socket.io** integrado en el servidor Express existente (mismo puerto, HTTP upgrade a WebSocket). Arquitectura basada en **rooms dinámicos** (`chat:{chatId}`, `user:{userId}`), con **at-least-once delivery** (ACKs + deduplicación UUID client-side), **offline queue** (AsyncStorage), y **notificaciones push condicionales** (solo si destinatario offline/fuera del chat).

**Decisión clave:** NO separar servidor WebSocket. Misma instancia Express maneja HTTP + WS (simplifica JWT auth, CORS, deploy). Separar solo si >50K conexiones concurrentes (fuera de alcance MVP).

**Escalabilidad:** Redis Adapter preparado (código comentado, activar con env var), Nginx sticky sessions documentado. MVP = 1 servidor (hasta 10K usuarios concurrentes).

**Referencia:** Arquitectura basada en exploration `docs/phases/fase-3-exploration.md` (decisiones AD-001 a AD-010).

---

## 2. Architecture Overview

### 2.1 Sistema General

```mermaid
graph TB
    subgraph "Mobile Client (React Native)"
        A[Socket.io Client]
        B[AsyncStorage Queue]
        C[UI Components]
        D[Media Upload]
    end
    
    subgraph "Backend (Express + Socket.io)"
        E[HTTP Server :3000]
        F[Socket.io Server]
        G[JWT Middleware]
        H[Rate Limiter Redis]
        I[Message Handler]
        J[Push Notification]
    end
    
    subgraph "Storage"
        K[(PostgreSQL)]
        L[(Redis)]
        M[Cloudinary]
    end
    
    A -->|WebSocket Upgrade| F
    F --> G
    G --> I
    I --> H
    I --> K
    I --> J
    B -->|Auto-sync on reconnect| A
    D -->|Signed Upload| M
    D -->|Media URL| I
    J --> A
    H --> L
```

### 2.2 Socket.io Architecture

**Namespace Strategy:** Un namespace global `/` con rooms dinámicos.

```typescript
// Estructura rooms
io.on('connection', (socket) => {
  const userId = socket.data.userId; // Extraído de JWT

  // Room personal (notificaciones directas)
  socket.join(`user:${userId}`);

  // Rooms de chats (dinámico al abrir chat)
  socket.on('join_chat', ({ chatId }) => {
    socket.join(`chat:${chatId}`);
  });
});
```

**Ventajas:**
- Usuario conecta **1 sola vez** (no múltiples sockets)
- Puede estar en múltiples rooms simultáneamente (`user:X` + `chat:Y` + `chat:Z`)
- Broadcasting eficiente (`io.to('chat:123').emit(...)` solo envía a usuarios en ese chat)

---

## 3. Architecture Decisions

### AD-001: Socket.io Integrado en Express (Mismo Puerto)

**Choice:** Socket.io corre en misma instancia Express, puerto 3000 (HTTP → WS upgrade automático).

**Alternatives considered:**
- Servidor Socket.io separado (puerto 3001)
- AWS AppSync (GraphQL Subscriptions)
- Server-Sent Events (SSE)

**Rationale:**
- **Simplicidad deploy:** 1 proceso, 1 puerto, misma configuración CORS
- **JWT auth reutilizado:** Middleware `requireAuth` funciona en HTTP endpoints (upload signature)
- **Sin overhead:** Separar servidores solo justificado si >50K conexiones concurrentes (fuera MVP)
- **Alternativa rechazada (AppSync):** Lock-in AWS, costo $1.00 por millón de mensajes (MVP incierto)
- **Alternativa rechazada (SSE):** Unidireccional (server → client), requiere polling para client → server

**Implications:**
- Mismo certificado SSL para HTTP + WS
- Si servidor cae, HTTP y WS caen juntos (aceptable MVP, monitoreo con health check)

**Referencias:**
- Socket.io docs: https://socket.io/docs/v4/server-installation/#with-express
- Exploration Fase 3, sección 3.1

---

### AD-002: At-Least-Once Delivery con UUID Deduplicación

**Choice:** Mensajes usan **UUID v4** como PK, servidor hace `upsert` idempotente, cliente deduplica por `messageId`.

**Alternatives considered:**
- At-most-once (fire-and-forget, sin ACK)
- Exactly-once (sequence numbers + distributed transactions)

**Rationale:**
- **Balance pragmático:** Duplicados raros (solo si ACK se pierde por timeout red) y transparentes (cliente filtra antes renderizar)
- **Exactly-once rechazado:** Requiere tabla `chat_sequences` + locks distribuidos + manejo huecos (overkill para chat no-financiero)
- **At-most-once rechazado:** Mensajes se pierden, inaceptable para app mensajería

**Implications:**
- **Migration BD:** Cambiar `messages.id` de `SERIAL` a `UUID` (`id UUID PRIMARY KEY DEFAULT gen_random_uuid()`)
- **Cliente genera UUID:** Librería `uuid` v4 antes de emitir evento
- **Frontend deduplica:** Filtro `messages.find(m => m.id === incomingMessage.id)` antes de agregar a UI

**Trade-offs:**
| Opción | Duplicados | Pérdidas | Complejidad | Decisión |
|--------|-----------|----------|-------------|----------|
| At-most-once | No | Sí ❌ | Baja | Rechazado |
| **At-least-once** | Raros ✅ | No ✅ | Media ✅ | **Seleccionado** |
| Exactly-once | No ✅ | No ✅ | Muy Alta ❌ | Overkill MVP |

**Referencias:**
- Exploration Fase 3, AD-003
- UUID RFC: https://datatracker.ietf.org/doc/html/rfc4122

---

### AD-003: Offline Queue en AsyncStorage (Max 100 Mensajes)

**Choice:** Mensajes enviados sin conexión se guardan en AsyncStorage, se envían automáticamente al reconectar.

**Alternatives considered:**
- Mostrar error "No hay conexión" sin queue
- IndexedDB (web) / SQLite (mobile)

**Rationale:**
- **UX crítico mobile:** 4G inestable en Argentina (túneles, subtes, áreas rurales)
- **Competencia lo hace:** WhatsApp, Telegram, Messenger tienen offline queue
- **AsyncStorage suficiente:** 100 mensajes ~200KB (límite 6MB AsyncStorage)
- **SQLite rechazado:** Complejidad adicional (ORM mobile, migrations) sin beneficio claro MVP

**Implications:**
- **Límite 100 mensajes:** Si excede, error "Demasiados mensajes pendientes. Conecta a WiFi."
- **Estados UI:** `sending` (enviando ahora) / `queued` (offline, pendiente) / `sent` (confirmado servidor) / `failed` (reintentar)
- **Testing riguroso:** Simular offline (Airplane mode), app killed durante envío

**Edge cases:**
- App cerrada con mensajes en cola → Al abrir, auto-enviar
- Usuario borra app → Mensajes en cola se pierden (aceptable, no son críticos vs pérdida durante envío)

**Referencias:**
- Exploration Fase 3, AD-004
- AsyncStorage docs: https://react-native-async-storage.github.io/async-storage/

---

### AD-004: Typing Indicator Throttled (500ms Client) + Timeout (3s Server)

**Choice:** Cliente throttle eventos `typing` cada 500ms max, servidor auto-emite `stop_typing` si no recibe nuevo evento en 3s.

**Alternatives considered:**
- Debounce 1s (emitir solo al dejar de escribir)
- Sin throttling (emitir por cada tecla)

**Rationale:**
- **Eficiencia red:** Reduce eventos 90% (de 10-20/seg a 2/seg)
- **UX fluida:** 500ms imperceptible para usuario
- **Auto-cleanup server:** Evita "escribiendo..." colgado si cliente pierde conexión sin emitir `stop_typing`

**Implications:**
- **Librería `lodash.throttle`** requerida (frontend)
- **Map en memoria server:** `Map<chatId:userId, timeout>` (limpieza automática por timeout)
- **Trade-off:** Si usuario escribe <500ms y deja de escribir, receptor puede no ver indicador (aceptable, edge case raro)

**Benchmark:**
- Sin throttle: 10 teclas/seg × 100 usuarios = 1000 eventos/seg
- Con throttle 500ms: 2 eventos/seg × 100 usuarios = 200 eventos/seg (**80% reducción**)

**Referencias:**
- Exploration Fase 3, AD-005
- Lodash throttle: https://lodash.com/docs/4.17.15#throttle

---

### AD-005: Read Receipts al Abrir Chat + Viewport Scroll

**Choice:** Marcar como leídos mensajes visibles en viewport cuando usuario abre chat o scrollea (batch UPDATE).

**Alternatives considered:**
- Marcar todos como leídos al abrir chat (sin viewport detection)
- Marcar como leído solo al hacer tap individual en mensaje

**Rationale:**
- **UX precisa:** Similar WhatsApp (usuarios familiarizados)
- **Performance:** Batch UPDATE (1 query para múltiples mensajes) vs 1 query por mensaje
- **Alternativa simple rechazada:** Marca como leídos mensajes que no scrolleó (impreciso)

**Implications:**
- **Complejidad frontend:** Detectar mensajes en viewport (`react-native-intersection-observer` o `onViewableItemsChanged` FlatList)
- **Evento batch:** `socket.emit('mark_read', { chatId, messageIds: [uuid1, uuid2, ...] })`
- **Server update:** `prisma.message.updateMany({ where: { id: { in: messageIds } }, data: { read: true, read_at: NOW() } })`

**Edge case:**
- Usuario scrollea rápido → Muchos mensajes visibles breve tiempo → Marcar solo si visible >500ms (evitar falsos positivos)

**Referencias:**
- Exploration Fase 3, AD-006
- FlatList onViewableItemsChanged: https://reactnative.dev/docs/flatlist#onviewableitemschanged

---

### AD-006: Signed Upload Directo a Cloudinary (No Via Servidor)

**Choice:** Cliente solicita signature (POST `/api/chats/:id/upload-signature`), sube directo a Cloudinary, envía mensaje con `media_url`.

**Alternatives considered:**
- Upload vía servidor Express (Multer middleware)
- Supabase Storage

**Rationale:**
- **Escalabilidad:** Servidor NO maneja uploads pesados (10 usuarios × 50MB = 500MB simultáneos saturan servidor)
- **Performance:** Upload paralelo (usuario sigue chateando mientras sube video)
- **Seguridad:** Signature expira 1h, solo válida para folder `quickfixu/chats/{chatId}`
- **Supabase rechazado:** Requiere SDK adicional, free tier 1GB (Cloudinary 25GB)

**Implications:**
- **3 pasos en cliente:**
  1. POST `/api/chats/:chatId/upload-signature` → `{ signature, timestamp, uploadUrl }`
  2. FormData directo a Cloudinary → `{ secure_url }`
  3. `socket.emit('send_message', { mediaUrl: secure_url, mediaType: 'image' })`
- **Cliente maneja errores Cloudinary:** Timeout (30s), file too large (>15MB post-compress)

**Flujo:**
```mermaid
sequenceDiagram
    participant C as Cliente
    participant S as Backend
    participant CL as Cloudinary
    
    C->>S: POST /api/chats/123/upload-signature
    S->>S: Validar userId en chat
    S->>S: Generar signature (api_sign_request)
    S-->>C: { signature, timestamp, uploadUrl }
    C->>CL: POST uploadUrl + file + signature
    CL-->>C: { secure_url }
    C->>S: socket.emit('send_message', { mediaUrl })
    S->>S: Guardar mensaje en BD
    S-->>C: socket.emit('new_message', message)
```

**Referencias:**
- Exploration Fase 3, AD-007
- Cloudinary signed upload: https://cloudinary.com/documentation/upload_images#signed_uploads

---

### AD-007: Push Condicional (Solo si Offline O Fuera del Chat)

**Choice:** Enviar FCM solo si destinatario **offline** O **online pero NO en el chat específico** (detectar con `socket.rooms.has('chat:${chatId}')`).

**Alternatives considered:**
- Siempre enviar push (usuario silencia en settings)
- Solo enviar si offline (no enviar si online en otro chat)

**Rationale:**
- **Evita spam:** Si usuario está viendo el chat, NO necesita push (verá mensaje en tiempo real)
- **UX esperada:** WhatsApp, Telegram hacen esto (standard industry)
- **Alternativa siempre-push rechazada:** Irritante (recibe notificación aunque esté chateando)

**Implications:**
- **Lógica condicional compleja:**
  ```typescript
  const recipientSockets = await io.in(`user:${recipientId}`).fetchSockets();
  const inThisChat = recipientSockets.some(s => s.rooms.has(`chat:${chatId}`));
  if (!recipientSockets.length || !inThisChat) {
    await sendPushNotification(recipientId, ...);
  }
  ```
- **Testing riguroso:** Edge cases múltiples devices (usuario con 2 celulares, 1 en chat, 1 no → enviar push al segundo)

**Edge case - Multiple devices:**
- MVP: Si **al menos 1 device** está en el chat → NO enviar push a ninguno (simplificación)
- Fase 7: Enviar push solo a devices fuera del chat (requiere tabla `user_sessions`)

**Referencias:**
- Exploration Fase 3, AD-008
- Socket.io fetchSockets: https://socket.io/docs/v4/server-api/#namespacefetchsockets

---

### AD-008: Redis Adapter Preparado, NO Activado MVP

**Choice:** Código listo para `@socket.io/redis-adapter`, activar con env var `REDIS_ADAPTER_ENABLED=true`.

**Alternatives considered:**
- No preparar Redis adapter (migrar cuando sea necesario)
- Activar Redis adapter desde MVP

**Rationale:**
- **MVP = 1 servidor:** Hasta 10K usuarios concurrentes (estimado: 6 meses post-launch)
- **Preparado sin overhead:** Dependencia instalada pero no usada (0 costo performance)
- **Arquitectura profesional:** Documentado en README (instrucciones Nginx sticky sessions)

**Implications:**
- **Activar cuando escalemos:**
  ```bash
  REDIS_ADAPTER_ENABLED=true
  REDIS_URL=redis://10.0.1.20:6379
  ```
- **Nginx config preparado** (comentado en `docs/nginx-socketio.conf`):
  ```nginx
  upstream quickfixu {
    ip_hash; # Sticky sessions
    server 10.0.1.10:3000;
    server 10.0.1.11:3000;
  }
  ```

**¿Cuándo activar?**
- Métricas: `socket.io_connections > 8000` concurrentes sostenidos
- Síntomas: CPU >80% en servidor único, latencia mensajes >500ms

**Referencias:**
- Exploration Fase 3, AD-009
- Redis adapter docs: https://socket.io/docs/v4/redis-adapter/

---

### AD-009: Rate Limiting Redis Sliding Window (20 msg/min)

**Choice:** `rate-limiter-flexible` con Redis, 20 mensajes por minuto por usuario.

**Alternatives considered:**
- In-memory Map (solo 1 servidor)
- Fixed window (reseteo cada 60s)

**Rationale:**
- **Protección esencial:** Previene bots/spam/abuse
- **Sliding window más justo:** Fixed window permite burst (usuario envía 20 msg en seg 59, otros 20 en seg 1 del siguiente minuto = 40 msg en 2s)
- **Distribuido:** Funciona con múltiples servidores (Redis compartido)

**Implications:**
- **Redis requerido:** Ya lo tenemos (Fase 1 geocoding cache)
- **Error handling:** `socket.emit('error', { type: 'rate_limit_exceeded', message: 'Espera 1 minuto' })`
- **Configurable:** Ajustar límite según feedback (`RATE_LIMIT_MESSAGES=20` en `.env`)

**¿20 msg/min es adecuado?**
- Usuario legítimo conversación rápida: ~10-15 msg/min
- Profesional enviando presupuesto detallado: ~5-8 msg/min
- Bot malicioso: 100+ msg/min

**Benchmark:**
- Overhead Redis: ~2-5ms por llamada `consume()`
- Acceptable (vs 200-500ms guardar mensaje en BD)

**Referencias:**
- Exploration Fase 3, AD-010
- rate-limiter-flexible: https://github.com/animir/node-rate-limiter-flexible

---

## 4. Data Flow Diagrams

### 4.1 Enviar Mensaje (Texto)

```mermaid
sequenceDiagram
    participant C as Cliente
    participant S as Socket.io Server
    participant RL as Rate Limiter
    participant DB as PostgreSQL
    participant R as Recipient

    C->>C: Generar messageId (UUID v4)
    C->>S: emit('send_message', { messageId, chatId, text })
    S->>RL: consume(userId)
    alt Rate limit OK
        RL-->>S: OK
        S->>DB: upsert mensaje (idempotente)
        DB-->>S: message object
        S->>S: Broadcast a room 'chat:{chatId}'
        S-->>C: ACK { success: true, message }
        S-->>R: emit('new_message', message)
        S->>S: Verificar destinatario online/en-chat
        alt Offline o fuera del chat
            S->>FCM: sendPushNotification(recipientId)
        end
    else Rate limit excedido
        RL-->>S: Error
        S-->>C: ACK { success: false, error: 'Rate limit' }
        S-->>C: emit('error', { type: 'rate_limit_exceeded' })
    end
```

### 4.2 Enviar Mensaje (Multimedia)

```mermaid
sequenceDiagram
    participant C as Cliente
    participant S as Backend
    participant CL as Cloudinary
    participant WS as Socket.io

    C->>C: Usuario selecciona imagen/video
    C->>C: Comprimir (react-native-compressor)
    C->>S: POST /api/chats/:id/upload-signature
    S->>S: Validar userId en chat
    S-->>C: { signature, timestamp, uploadUrl }
    C->>CL: POST multipart/form-data
    CL-->>C: { secure_url, public_id }
    C->>WS: emit('send_message', { mediaUrl, mediaType })
    WS->>DB: Guardar mensaje con media_url
    WS-->>C: emit('new_message', message)
```

### 4.3 Typing Indicator

```mermaid
sequenceDiagram
    participant C1 as Cliente 1
    participant S as Server
    participant C2 as Cliente 2

    C1->>C1: Usuario escribe (onChange throttled 500ms)
    C1->>S: emit('typing', { chatId })
    S->>S: Set timeout 3s auto-stop
    S-->>C2: emit('user_typing', { userId, chatId })
    C2->>C2: Mostrar "Cliente está escribiendo..."
    
    alt Usuario sigue escribiendo
        Note over C1,S: Cada 500ms renew timeout
    else Usuario para (3s sin eventos)
        S->>S: Timeout ejecuta
        S-->>C2: emit('user_stop_typing', { userId })
        C2->>C2: Ocultar indicador
    end
```

### 4.4 Read Receipts

```mermaid
sequenceDiagram
    participant C as Cliente (Recipient)
    participant S as Server
    participant DB as PostgreSQL
    participant SE as Sender

    C->>S: emit('join_chat', { chatId })
    C->>C: Detectar mensajes visibles (viewport)
    C->>S: emit('mark_read', { chatId, messageIds: [...] })
    S->>DB: UPDATE messages SET read=true, read_at=NOW()
    DB-->>S: { count: 5 }
    S->>DB: SELECT sender_id FROM messages WHERE id IN (...)
    DB-->>S: [{ sender_id: 42 }, ...]
    loop Para cada sender único
        S-->>SE: emit('message_read', { messageId, readAt })
        SE->>SE: Actualizar UI (doble check azul)
    end
```

### 4.5 Offline Queue (Reconexión)

```mermaid
sequenceDiagram
    participant C as Cliente
    participant AS as AsyncStorage
    participant S as Socket.io Server

    Note over C: Usuario sin conexión
    C->>C: Usuario envía mensaje
    C->>AS: queue.add({ messageId, chatId, text })
    C->>C: Mostrar mensaje como 'queued'
    
    Note over C: Conexión restaurada
    C->>S: connect
    S-->>C: emit('connected')
    C->>AS: queue.getAll()
    AS-->>C: [mensaje1, mensaje2, ...]
    loop Para cada mensaje en cola
        C->>S: emit('send_message', { messageId, ... })
        S-->>C: ACK { success: true }
        C->>AS: queue.remove(messageId)
        C->>C: Actualizar UI 'queued' → 'sent'
    end
```

---

## 5. Socket.io Server Setup

### 5.1 Estructura de Archivos

```
backend/src/
├── server.ts              # Express + Socket.io bootstrap
├── socket/
│   ├── index.ts           # Socket.io setup + middleware
│   ├── handlers/
│   │   ├── chatHandler.ts       # send_message, join_chat, leave_chat
│   │   ├── typingHandler.ts     # typing, stop_typing
│   │   ├── readReceiptHandler.ts # mark_read
│   │   └── index.ts             # Export all handlers
│   ├── middleware/
│   │   ├── authMiddleware.ts    # JWT validation
│   │   └── rateLimiter.ts       # Rate limiting
│   └── utils/
│       ├── roomManager.ts       # Room join/leave logic
│       └── pushNotification.ts  # Conditional push logic
├── routes/
│   └── chatRoutes.ts      # HTTP /api/chats/:id/upload-signature
└── prisma/
    └── schema.prisma      # messages table schema
```

### 5.2 Código Base Socket.io

**`backend/src/socket/index.ts`**

```typescript
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import http from 'http';
import { authMiddleware } from './middleware/authMiddleware';
import { attachHandlers } from './handlers';

export const setupSocketIO = (httpServer: http.Server) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'], // Fallback a polling si WS falla
    pingTimeout: 120000, // 2min (desconectar si no responde ping)
    pingInterval: 25000, // Heartbeat cada 25s
  });

  // REDIS ADAPTER (preparado, activar con env var)
  if (process.env.REDIS_ADAPTER_ENABLED === 'true') {
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      console.log('[Socket.io] Redis adapter enabled');
    });
  }

  // MIDDLEWARE: JWT Authentication
  io.use(authMiddleware);

  // CONNECTION HANDLER
  io.on('connection', (socket) => {
    const userId = socket.data.userId; // Inyectado por authMiddleware
    console.log(`[Socket.io] User ${userId} connected (socket: ${socket.id})`);

    // Join personal room
    socket.join(`user:${userId}`);

    // Attach event handlers
    attachHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] User ${userId} disconnected: ${reason}`);
    });
  });

  return io;
};
```

**`backend/src/socket/middleware/authMiddleware.ts`**

```typescript
import jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';

export const authMiddleware = async (socket: Socket, next: Function) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Authentication token missing'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    socket.data.userId = decoded.userId;
    next();
  } catch (error) {
    console.error('[Socket.io] JWT verification failed:', error);
    next(new Error('Invalid token'));
  }
};
```

### 5.3 Namespaces y Rooms

**Namespace:** `/` (global, default)

**Rooms dinámicos:**
- `user:{userId}` → Notificaciones directas a usuario (ej: push fallback, message_read)
- `chat:{chatId}` → Usuarios actualmente en el chat específico

**Join/Leave Logic:**

```typescript
// backend/src/socket/utils/roomManager.ts
import { Socket } from 'socket.io';
import { prisma } from '../../db';

export const joinChatRoom = async (socket: Socket, chatId: number): Promise<boolean> => {
  const userId = socket.data.userId;

  // Validar que usuario pertenece al chat
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
    return false; // Access denied
  }

  socket.join(`chat:${chatId}`);
  return true;
};

export const leaveChatRoom = (socket: Socket, chatId: number) => {
  socket.leave(`chat:${chatId}`);
};
```

---

## 6. Socket.io Client Setup (React Native)

### 6.1 Estructura de Archivos

```
mobile/src/
├── services/
│   ├── socket/
│   │   ├── SocketService.ts       # Singleton socket.io client
│   │   ├── offlineQueue.ts        # AsyncStorage queue
│   │   ├── messageHandlers.ts     # Event listeners
│   │   └── typingManager.ts       # Throttle typing events
│   └── api/
│       └── chatApi.ts             # HTTP /upload-signature
├── hooks/
│   ├── useSocket.ts               # React hook para socket connection
│   ├── useChat.ts                 # Hook para chat específico
│   └── useTypingIndicator.ts     # Hook typing state
└── screens/
    └── ChatScreen.tsx             # UI chat
```

### 6.2 Código Base Socket Client

**`mobile/src/services/socket/SocketService.ts`**

```typescript
import io, { Socket } from 'socket.io-client';
import { getAccessToken, refreshAccessToken } from '../auth';
import { offlineQueue } from './offlineQueue';

class SocketService {
  private socket: Socket | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;

  async connect() {
    const token = await getAccessToken();

    this.socket = io(process.env.API_URL!, {
      auth: { token },
      transports: ['websocket'], // Preferir WS (polling fallback automático)
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', this.handleConnect);
    this.socket.on('connect_error', this.handleConnectError);
    this.socket.on('disconnect', this.handleDisconnect);

    // Token refresh cada 14 minutos (antes de expirar 15min)
    this.reconnectInterval = setInterval(async () => {
      await this.refreshConnection();
    }, 14 * 60 * 1000);
  }

  private handleConnect = async () => {
    console.log('[Socket] Connected');
    // Procesar mensajes offline pendientes
    await offlineQueue.process(this.socket!);
  };

  private handleConnectError = async (error: Error) => {
    console.error('[Socket] Connection error:', error.message);
    
    if (error.message === 'Invalid token') {
      // Token expiró, refrescar y reconectar
      await refreshAccessToken();
      const newToken = await getAccessToken();
      this.socket!.auth = { token: newToken };
      this.socket!.connect();
    }
  };

  private handleDisconnect = (reason: string) => {
    console.log('[Socket] Disconnected:', reason);
  };

  private async refreshConnection() {
    if (!this.socket) return;
    
    const newToken = await getAccessToken(); // Auto-refresh si expirado
    this.socket.disconnect();
    this.socket.auth = { token: newToken };
    this.socket.connect();
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const socketService = new SocketService();
```

### 6.3 Offline Queue

**`mobile/src/services/socket/offlineQueue.ts`**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

const QUEUE_KEY = 'message_queue';
const MAX_QUEUE_SIZE = 100;

interface QueuedMessage {
  id: string;
  chatId: number;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  timestamp: number;
}

export const offlineQueue = {
  async add(chatId: number, text?: string, mediaUrl?: string, mediaType?: 'image' | 'video'): Promise<QueuedMessage> {
    const queueStr = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: QueuedMessage[] = queueStr ? JSON.parse(queueStr) : [];

    if (queue.length >= MAX_QUEUE_SIZE) {
      throw new Error('Demasiados mensajes pendientes. Conecta a WiFi.');
    }

    const message: QueuedMessage = {
      id: uuidv4(),
      chatId,
      text,
      mediaUrl,
      mediaType,
      timestamp: Date.now(),
    };

    queue.push(message);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return message;
  },

  async process(socket: Socket) {
    const queueStr = await AsyncStorage.getItem(QUEUE_KEY);
    if (!queueStr) return;

    const queue: QueuedMessage[] = JSON.parse(queueStr);
    const remaining: QueuedMessage[] = [];

    for (const msg of queue) {
      try {
        await new Promise<void>((resolve, reject) => {
          socket.emit('send_message', {
            messageId: msg.id,
            chatId: msg.chatId,
            text: msg.text,
            mediaUrl: msg.mediaUrl,
            mediaType: msg.mediaType,
          }, (ack: { success: boolean; error?: string }) => {
            if (ack.success) {
              console.log('[Queue] Message sent:', msg.id);
              resolve();
            } else {
              console.error('[Queue] Failed to send:', ack.error);
              reject(new Error(ack.error));
            }
          });
        });
      } catch (error) {
        console.error('[Queue] Error sending message:', error);
        remaining.push(msg); // Reintenta después
      }
    }

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  },

  async clear() {
    await AsyncStorage.removeItem(QUEUE_KEY);
  },
};
```

### 6.4 Reconexión Automática

**Configuración Socket.io Client:**

```typescript
{
  reconnection: true,
  reconnectionAttempts: Infinity, // Intentar siempre
  reconnectionDelay: 1000,        // 1s delay inicial
  reconnectionDelayMax: 5000,     // Max 5s entre intentos
  timeout: 20000,                 // 20s timeout handshake
}
```

**Indicador UI:**

```tsx
// mobile/src/hooks/useSocket.ts
import { useState, useEffect } from 'react';
import { socketService } from '../services/socket/SocketService';

export const useSocket = () => {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  return { connected };
};
```

---

## 7. Database Schema & Triggers

### 7.1 Migration: Create Messages Table

**`backend/prisma/migrations/20260322_create_messages_table.sql`**

```sql
-- Extensión UUID (si no existe)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  message_text TEXT,
  media_url VARCHAR(500),
  media_type VARCHAR(10),
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_message_content CHECK (message_text IS NOT NULL OR media_url IS NOT NULL),
  CONSTRAINT chk_media_type CHECK (media_type IN ('image', 'video') OR media_type IS NULL),
  CONSTRAINT chk_text_length CHECK (message_text IS NULL OR LENGTH(message_text) <= 2000)
);

-- Índices
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_chat_created ON messages(chat_id, created_at DESC, id);
CREATE INDEX idx_messages_unread ON messages(chat_id, read) WHERE read = FALSE;

-- Comentarios
COMMENT ON TABLE messages IS 'Mensajes de chat en tiempo real (Fase 3)';
COMMENT ON COLUMN messages.id IS 'UUID v4 generado por cliente (deduplicación)';
COMMENT ON COLUMN messages.media_type IS 'image | video | NULL';
COMMENT ON COLUMN messages.read IS 'Marcado al abrir chat + scroll viewport';
```

### 7.2 Trigger: Update last_message_at

```sql
-- Función trigger
CREATE OR REPLACE FUNCTION update_chat_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chats
  SET 
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.chat_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger AFTER INSERT
CREATE TRIGGER trigger_update_chat_last_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_chat_last_message();

-- Comentario
COMMENT ON FUNCTION update_chat_last_message IS 'Actualiza chats.last_message_at para ordenar lista conversaciones';
```

### 7.3 Prisma Schema

**`backend/prisma/schema.prisma`**

```prisma
model Message {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  chatId       Int       @map("chat_id")
  senderId     Int       @map("sender_id")
  messageText  String?   @map("message_text") @db.Text
  mediaUrl     String?   @map("media_url") @db.VarChar(500)
  mediaType    String?   @map("media_type") @db.VarChar(10)
  read         Boolean   @default(false)
  readAt       DateTime? @map("read_at") @db.Timestamp
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamp

  chat   Chat @relation(fields: [chatId], references: [id], onDelete: Cascade)
  sender User @relation(fields: [senderId], references: [id], onDelete: Restrict)

  @@index([chatId])
  @@index([senderId])
  @@index([chatId, createdAt(sort: Desc), id])
  @@index([chatId, read], where: "read = false")
  @@map("messages")
}
```

---

## 8. Push Notification Integration

### 8.1 Lógica Condicional

**`backend/src/socket/utils/pushNotification.ts`**

```typescript
import { Server } from 'socket.io';
import { sendPushNotification } from '../../services/fcm';
import { prisma } from '../../db';

export const handleConditionalPush = async (
  io: Server,
  chatId: number,
  senderId: number,
  messageText: string
) => {
  // Obtener destinatario
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      client: { select: { id: true, full_name: true } },
      professional: { select: { id: true, full_name: true } },
    },
  });

  if (!chat) return;

  const recipient = chat.client_id === senderId ? chat.professional : chat.client;
  const sender = chat.client_id === senderId ? chat.client : chat.professional;

  // Buscar sockets del destinatario
  const recipientSockets = await io.in(`user:${recipient.id}`).fetchSockets();

  let shouldSendPush = true;

  if (recipientSockets.length > 0) {
    // Destinatario ONLINE, verificar si está en este chat
    const inThisChat = recipientSockets.some((s) => s.rooms.has(`chat:${chatId}`));

    if (inThisChat) {
      shouldSendPush = false; // Está viendo el chat en tiempo real
    }
  }

  if (shouldSendPush) {
    await sendPushNotification(recipient.id, {
      title: `Nuevo mensaje de ${sender.full_name}`,
      body: messageText.substring(0, 100), // Truncar
      data: {
        type: 'new_message',
        chatId: chatId.toString(),
      },
    });

    // Log para tracking
    console.log(`[Push] Sent to user ${recipient.id} (offline or not in chat)`);
  } else {
    console.log(`[Push] Skipped for user ${recipient.id} (online in chat)`);
  }
};
```

### 8.2 FCM Service

**`backend/src/services/fcm.ts`**

```typescript
import admin from 'firebase-admin';
import { prisma } from '../db';

// Inicializar Firebase Admin (Fase 1)
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)),
});

export const sendPushNotification = async (
  userId: number,
  payload: {
    title: string;
    body: string;
    data: Record<string, string>;
  }
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fcm_token: true },
  });

  if (!user?.fcm_token) {
    console.warn(`[FCM] User ${userId} has no FCM token`);
    return;
  }

  try {
    await admin.messaging().send({
      token: user.fcm_token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'messages',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    });

    // Guardar en tabla notifications (historial)
    await prisma.notification.create({
      data: {
        user_id: userId,
        type: 'new_message',
        title: payload.title,
        body: payload.body,
        data: JSON.stringify(payload.data),
      },
    });

    console.log(`[FCM] Notification sent to user ${userId}`);
  } catch (error) {
    console.error(`[FCM] Error sending notification:`, error);
  }
};
```

---

## 9. Rate Limiting Implementation

### 9.1 Redis Sliding Window

**`backend/src/socket/middleware/rateLimiter.ts`**

```typescript
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redisClient } from '../../db/redis';

export const messageLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'msg_limit',
  points: parseInt(process.env.RATE_LIMIT_MESSAGES || '20'), // Default 20
  duration: 60, // Por minuto
  blockDuration: 60, // Bloquear 1 min si excede
});

export const checkRateLimit = async (userId: number): Promise<boolean> => {
  try {
    await messageLimiter.consume(userId);
    return true; // OK
  } catch (error) {
    return false; // Rate limit excedido
  }
};
```

### 9.2 Integración en Handler

**`backend/src/socket/handlers/chatHandler.ts`**

```typescript
import { checkRateLimit } from '../middleware/rateLimiter';

socket.on('send_message', async (payload, callback) => {
  const userId = socket.data.userId;

  // Rate limiting
  const allowed = await checkRateLimit(userId);
  if (!allowed) {
    socket.emit('error', {
      type: 'rate_limit_exceeded',
      message: 'Demasiados mensajes. Espera 1 minuto.',
    });
    return callback({ success: false, error: 'Rate limit exceeded' });
  }

  // Procesar mensaje...
});
```

---

## 10. Testing Strategy

### 10.1 Unit Tests (Backend)

**`backend/tests/socket/messageHandler.test.ts`**

```typescript
import { setupTestSocketServer, createTestSocket } from '../helpers/socketTestHelper';
import { prisma } from '../../src/db';

describe('Message Handler', () => {
  let io, clientSocket;

  beforeAll(async () => {
    io = await setupTestSocketServer();
    clientSocket = await createTestSocket('valid-jwt-token');
  });

  afterAll(() => {
    io.close();
    clientSocket.disconnect();
  });

  it('should save message and broadcast to room', (done) => {
    const messageId = 'uuid-test-123';
    const chatId = 1;
    const text = 'Hola, necesito electricista';

    clientSocket.emit('send_message', { messageId, chatId, text }, (ack) => {
      expect(ack.success).toBe(true);
      expect(ack.message.id).toBe(messageId);
      expect(ack.message.message_text).toBe(text);
      done();
    });
  });

  it('should reject message if rate limit exceeded', async () => {
    // Enviar 21 mensajes (límite 20/min)
    for (let i = 0; i < 21; i++) {
      const ack = await emitMessage(clientSocket, { text: `Message ${i}` });
      if (i < 20) {
        expect(ack.success).toBe(true);
      } else {
        expect(ack.success).toBe(false);
        expect(ack.error).toBe('Rate limit exceeded');
      }
    }
  });

  it('should deduplicate messages with same messageId', async () => {
    const messageId = 'uuid-duplicate-test';
    
    // Enviar 2 veces
    await emitMessage(clientSocket, { messageId, text: 'Test' });
    await emitMessage(clientSocket, { messageId, text: 'Test' });

    // Verificar solo 1 registro en BD
    const messages = await prisma.message.findMany({ where: { id: messageId } });
    expect(messages.length).toBe(1);
  });
});
```

### 10.2 Integration Tests (Frontend)

**`mobile/__tests__/offlineQueue.test.ts`**

```typescript
import { offlineQueue } from '../src/services/socket/offlineQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('Offline Queue', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('should add message to queue', async () => {
    const msg = await offlineQueue.add(1, 'Test message');
    expect(msg.chatId).toBe(1);
    expect(msg.text).toBe('Test message');

    const queueStr = await AsyncStorage.getItem('message_queue');
    const queue = JSON.parse(queueStr!);
    expect(queue.length).toBe(1);
  });

  it('should reject if queue exceeds 100 messages', async () => {
    // Llenar 100 mensajes
    for (let i = 0; i < 100; i++) {
      await offlineQueue.add(1, `Message ${i}`);
    }

    // 101° mensaje debe fallar
    await expect(offlineQueue.add(1, 'Overflow')).rejects.toThrow(
      'Demasiados mensajes pendientes'
    );
  });

  it('should process queue on reconnect', async () => {
    await offlineQueue.add(1, 'Queued message 1');
    await offlineQueue.add(1, 'Queued message 2');

    const mockSocket = {
      emit: jest.fn((event, payload, callback) => {
        callback({ success: true });
      }),
    };

    await offlineQueue.process(mockSocket as any);

    expect(mockSocket.emit).toHaveBeenCalledTimes(2);
    
    // Queue debe estar vacía
    const queueStr = await AsyncStorage.getItem('message_queue');
    const queue = JSON.parse(queueStr!);
    expect(queue.length).toBe(0);
  });
});
```

### 10.3 E2E Tests (Detox)

**`mobile/e2e/chat.e2e.ts`**

```typescript
describe('Chat Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
    await loginAsClient(); // Helper function
  });

  it('should send text message', async () => {
    await navigateToChat(1); // chatId 1
    await element(by.id('message-input')).typeText('Hola profesional');
    await element(by.id('send-button')).tap();
    
    // Verificar mensaje aparece en UI
    await expect(element(by.text('Hola profesional'))).toBeVisible();
    
    // Verificar status 'sent' (doble check)
    await expect(element(by.id('message-status-sent'))).toBeVisible();
  });

  it('should queue message when offline', async () => {
    await device.disableSynchronization(); // Simular offline
    await element(by.id('message-input')).typeText('Mensaje offline');
    await element(by.id('send-button')).tap();
    
    // Verificar status 'queued' (reloj)
    await expect(element(by.id('message-status-queued'))).toBeVisible();
    
    await device.enableSynchronization(); // Restaurar conexión
    
    // Esperar auto-envío
    await waitFor(element(by.id('message-status-sent')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should show typing indicator', async () => {
    await navigateToChat(1);
    await element(by.id('message-input')).typeText('Escribiendo...');
    
    // Verificar indicador en otro dispositivo (requiere mock socket)
    // Este test requiere 2 instancias app (complejo, opcional MVP)
  });
});
```

### 10.4 Performance Tests

**Load Testing con Artillery:**

**`tests/artillery/chat-load.yml`**

```yaml
config:
  target: "http://localhost:3000"
  socketio:
    transports: ["websocket"]
  phases:
    - duration: 60
      arrivalRate: 50 # 50 usuarios/seg
      name: "Ramp up"
    - duration: 300
      arrivalRate: 100 # 100 usuarios/seg
      name: "Sustained load"
  variables:
    jwtToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." # Valid JWT

scenarios:
  - name: "Send messages"
    engine: "socketio"
    flow:
      - emit:
          channel: "send_message"
          data:
            messageId: "{{ $uuid }}"
            chatId: 1
            text: "Load test message {{ $randomNumber(1, 1000) }}"
          acknowledge:
            match:
              json: "$.success"
              value: true
      - think: 2 # 2s entre mensajes
```

**Ejecutar:**

```bash
npm install -g artillery
artillery run tests/artillery/chat-load.yml
```

**Métricas esperadas (MVP 1 servidor):**
- Throughput: >200 mensajes/seg
- Latencia p95: <500ms
- Error rate: <1%
- Conexiones concurrentes: 10,000+

---

## 11. Performance Optimizations

### 11.1 Database Indexes (Críticos)

```sql
-- Cursor pagination (created_at DESC, id DESC)
CREATE INDEX idx_messages_chat_created ON messages(chat_id, created_at DESC, id DESC);

-- Unread count (partial index)
CREATE INDEX idx_messages_unread ON messages(chat_id, read) WHERE read = FALSE;

-- Sender lookup (para mark_read)
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- Chat last_message_at ordering
CREATE INDEX idx_chats_last_message ON chats(last_message_at DESC);
```

**Impacto:**
- Query mensajes chat (50 últimos): ~5ms (sin índice: 200ms+)
- Count mensajes no leídos: ~2ms (sin partial index: 50ms)

### 11.2 Redis Caching

**Cache typing indicator state:**

```typescript
// Backend: cache typing state en Redis (evitar Map en memoria)
await redisClient.setex(`typing:${chatId}:${userId}`, 3, 'true');

// Verificar antes de emitir
const isTyping = await redisClient.get(`typing:${chatId}:${userId}`);
if (!isTyping) {
  io.to(`chat:${chatId}`).emit('user_typing', { userId });
}
```

**Beneficio:** Typing state compartido entre múltiples servidores (cuando activemos Redis adapter).

### 11.3 Message Batching (Read Receipts)

**Frontend:**

```typescript
// Batch mark_read cada 2s (evitar 1 request por mensaje)
let pendingReadMessages: string[] = [];
let batchTimer: NodeJS.Timeout | null = null;

const markMessageRead = (messageId: string) => {
  pendingReadMessages.push(messageId);

  if (batchTimer) clearTimeout(batchTimer);

  batchTimer = setTimeout(() => {
    if (pendingReadMessages.length > 0) {
      socket.emit('mark_read', { chatId, messageIds: pendingReadMessages });
      pendingReadMessages = [];
    }
  }, 2000);
};
```

**Impacto:**
- Reducción queries: 10 mensajes visibles = 1 UPDATE (antes: 10 UPDATEs)
- Latencia UX aceptable (2s delay imperceptible)

### 11.4 Connection Pooling (PostgreSQL)

**`backend/src/db/prisma.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

// Connection pool config (DATABASE_URL params)
// postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10
```

**Recomendación producción:**
- `connection_limit=20` (1 servidor Socket.io)
- Si escalamos a 3 servidores: `connection_limit=10` cada uno (total 30 conexiones DB)

---

## 12. Migration Plan

### 12.1 Pre-Migration Checklist

- [ ] Redis running (rate limiting + cache)
- [ ] PostgreSQL 15+ con extensión `pgcrypto` (UUID)
- [ ] Cloudinary account configured (signed uploads)
- [ ] FCM project setup (push notifications)
- [ ] `.env` variables:
  ```bash
  JWT_SECRET=...
  DATABASE_URL=...
  REDIS_URL=...
  CLOUDINARY_CLOUD_NAME=...
  CLOUDINARY_API_KEY=...
  CLOUDINARY_API_SECRET=...
  FIREBASE_SERVICE_ACCOUNT=...
  RATE_LIMIT_MESSAGES=20
  ```

### 12.2 Migration Steps

**Backend:**

```bash
# 1. Instalar dependencias
npm install socket.io @socket.io/redis-adapter redis rate-limiter-flexible uuid

# 2. Ejecutar migration BD
npx prisma migrate dev --name create_messages_table

# 3. Generar Prisma client
npx prisma generate

# 4. Correr tests
npm test -- --testPathPattern=socket

# 5. Iniciar servidor dev
npm run dev
```

**Frontend (React Native):**

```bash
# 1. Instalar dependencias
npm install socket.io-client @react-native-async-storage/async-storage react-native-compressor lodash.throttle uuid

# 2. iOS: pod install
cd ios && pod install && cd ..

# 3. Correr tests
npm test -- --testPathPattern=socket

# 4. Iniciar dev
npm start
```

### 12.3 Rollback Plan

**Si algo falla en producción:**

1. **Desactivar Socket.io:** Comentar `setupSocketIO(httpServer)` en `server.ts`
2. **Fallback HTTP polling:** Cliente usa POST `/api/messages` (crear endpoint simple)
3. **Rollback migration:** `npx prisma migrate resolve --rolled-back 20260322_create_messages_table`
4. **Investigar logs:** Sentry, Cloudwatch, o logs servidor

**Rollback automático (health check):**

```typescript
// backend/src/health.ts
app.get('/health', async (req, res) => {
  try {
    // Verificar DB
    await prisma.$queryRaw`SELECT 1`;
    
    // Verificar Redis
    await redisClient.ping();
    
    // Verificar Socket.io
    const socketsCount = io.sockets.sockets.size;
    
    res.json({ status: 'ok', socketsCount });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});
```

**Monitoreo post-deploy (primeras 24h):**
- Métricas: `socket.io_connections`, `messages_sent_per_min`, `rate_limit_errors`
- Alertas: Error rate >5%, latencia p95 >1s, Redis memory >80%

---

## 13. Open Questions

### Q1: ¿Comprimir videos automáticamente?

**Decision needed:** Sí, target 5MB (calidad 720p).

**Rationale:** Free tier Cloudinary 25GB/mes, videos sin comprimir 50-200MB consumirían rápido. Usuario promedio NO sabe comprimir.

**Implementation:** `react-native-compressor` con config:
```typescript
await Video.compress(videoUri, {
  compressionMethod: 'auto',
  maxSize: 1280, // 720p
  bitrate: 1000000, // 1 Mbps
});
```

---

### Q2: ¿Límite caracteres mensajes: 2000 o 5000?

**Decision needed:** 2000 chars (WhatsApp-like).

**Rationale:** Mensajes largos difíciles leer en mobile. Si necesita >2000, enviar múltiples o adjuntar documento.

**Enforcement:** Backend constraint `CHECK (LENGTH(message_text) <= 2000)`, frontend validación antes enviar.

---

### Q3: ¿Permitir editar/eliminar mensajes en MVP?

**Decision needed:** NO en MVP (Fase 7).

**Rationale:**
- Editar requiere: tabla `message_edits`, evento `edit_message`, UI "editado", timestamp edit
- Eliminar requiere: soft delete `deleted_at`, evento `delete_message`, UI "[Mensaje eliminado]"
- Complejidad adicional sin ser feature crítica MVP

**Future:** Agregar si usuarios piden frecuentemente (backlog Fase 7).

---

## 14. File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `backend/src/server.ts` | Modify | Agregar `setupSocketIO(httpServer)` |
| `backend/src/socket/index.ts` | Create | Socket.io setup + Redis adapter |
| `backend/src/socket/middleware/authMiddleware.ts` | Create | JWT validation handshake |
| `backend/src/socket/middleware/rateLimiter.ts` | Create | Rate limiting Redis sliding window |
| `backend/src/socket/handlers/chatHandler.ts` | Create | `send_message`, `join_chat`, `leave_chat` |
| `backend/src/socket/handlers/typingHandler.ts` | Create | `typing`, `stop_typing` |
| `backend/src/socket/handlers/readReceiptHandler.ts` | Create | `mark_read` |
| `backend/src/socket/utils/pushNotification.ts` | Create | Conditional push logic |
| `backend/src/routes/chatRoutes.ts` | Create | POST `/api/chats/:id/upload-signature` |
| `backend/prisma/schema.prisma` | Modify | Agregar model `Message` |
| `backend/prisma/migrations/20260322_create_messages_table.sql` | Create | Migration tabla + trigger |
| `mobile/src/services/socket/SocketService.ts` | Create | Singleton socket.io client |
| `mobile/src/services/socket/offlineQueue.ts` | Create | AsyncStorage queue |
| `mobile/src/services/socket/messageHandlers.ts` | Create | Event listeners (`new_message`, `message_read`) |
| `mobile/src/services/socket/typingManager.ts` | Create | Throttle typing events |
| `mobile/src/hooks/useSocket.ts` | Create | React hook connection state |
| `mobile/src/hooks/useChat.ts` | Create | Hook mensajes chat específico |
| `mobile/src/screens/ChatScreen.tsx` | Create | UI chat (input, messages FlatList, typing indicator) |
| `mobile/src/screens/ChatListScreen.tsx` | Modify | Agregar badge mensajes no leídos |
| `docs/nginx-socketio.conf` | Create | Nginx sticky sessions config (preparado) |
| `README.md` | Modify | Sección "Chat en Tiempo Real" con setup |

---

## 15. Dependencies

**Backend:**

```json
{
  "dependencies": {
    "socket.io": "^4.6.1",
    "@socket.io/redis-adapter": "^8.2.1",
    "redis": "^4.6.7",
    "rate-limiter-flexible": "^2.4.2",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/uuid": "^9.0.2"
  }
}
```

**Frontend:**

```json
{
  "dependencies": {
    "socket.io-client": "^4.6.1",
    "@react-native-async-storage/async-storage": "^1.19.3",
    "react-native-compressor": "^1.8.24",
    "lodash.throttle": "^4.1.1",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/lodash.throttle": "^4.1.7",
    "@types/uuid": "^9.0.2"
  }
}
```

---

## 16. Success Metrics (Post-Deploy)

**Performance:**
- Latencia envío mensaje (p95): <500ms
- Conexiones concurrentes estables: 10,000+
- Throughput: >200 mensajes/seg
- Offline queue success rate: >99%

**Reliability:**
- Uptime Socket.io: >99.9%
- Message delivery rate: >99.9% (at-least-once)
- Rate limit false positives: <0.1%

**UX:**
- Typing indicator latency: <500ms
- Read receipt update: <2s
- Offline message auto-send: <5s después reconectar

**Business:**
- % chats con >5 mensajes: >60% (engagement)
- Avg mensajes por chat: >10 (profundidad conversación)
- % usuarios vuelven al chat: >70% (retention)

---

**Design Complete. Ready for Tasks Breakdown (sdd-tasks).**
