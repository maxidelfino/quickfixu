# Specification: Fase 3 - Chat en Tiempo Real

## 1. Introduction

This specification defines the functional and non-functional requirements for **Fase 3: Chat en Tiempo Real** of QuickFixU. It is derived from the approved exploration document and serves as the binding contract between backend and frontend teams.

**Change name:** `fase-3-realtime-chat`  
**Persistence mode:** Engram  
**Prerequisite:** Fase 2 (Posts & Proposals) MUST be completed  
**Base proposal:** Real-time messaging with WebSockets (Socket.io), typing indicators, read receipts, multimedia upload, offline support

**Features in scope:**
1. WebSocket Connection with JWT authentication + auto-reconnect
2. Text Messaging (max 2000 chars) in real-time
3. Typing Indicator ("escribiendo...") with throttling
4. Read Receipts (doble check: enviado/entregado/leído)
5. Multimedia Messaging (1 image OR 1 video per message)
6. Message History Paginated (cursor-based, 50 messages/batch)
7. Chat List sorted by `last_message_at`
8. Unread Message Counter (badge) per chat
9. Conditional Push Notifications (offline/other chat)
10. Offline Support (queue + auto-sync on reconnect)
11. Auto-update `chats.last_message_at` on new message (DB trigger)

---

## 2. Functional Requirements

### FR-001: WebSocket Connection with JWT Authentication

**Description:**  
A user MUST be able to establish a WebSocket connection to the server using Socket.io, authenticated via JWT token in the handshake. The system MUST validate the token, associate the socket with the user ID, and auto-join the user to their personal room for direct notifications.

**Requirements:**
- System MUST accept JWT token in `socket.handshake.auth.token`
- System MUST validate JWT using same secret as HTTP API
- System MUST extract `userId` from decoded JWT payload
- System MUST store `userId` in `socket.data.userId` for subsequent events
- System MUST reject connection if JWT is invalid/expired (emit `connect_error`)
- System MUST auto-join user to `user:{userId}` room upon connection
- System MUST emit `connected` event with `userId` to confirm connection
- System MUST support auto-reconnect with fresh token (client-side refresh logic)
- System MUST use WebSocket transport (polling fallback disabled for performance)

**Scenarios:**

```gherkin
Scenario: Successful WebSocket connection
  Given the user "juan@example.com" has valid JWT token "eyJhbGciOi..."
  When the client establishes Socket.io connection with:
    - URL: wss://api.quickfixu.com
    - auth: { token: "eyJhbGciOi..." }
    - transports: ['websocket']
  Then the server validates JWT (success)
  And extracts userId=1 from token payload
  And stores userId in socket.data.userId
  And joins socket to room "user:1"
  And emits event "connected" with payload: { userId: 1 }
  And connection is established

Scenario: Connection rejected (invalid JWT)
  Given the client sends expired JWT token
  When the client attempts WebSocket connection
  Then the server validates JWT (fails: token expired)
  And emits "connect_error" with message: "Invalid token"
  And connection is rejected

Scenario: Connection rejected (missing token)
  Given the client sends NO token in auth object
  When the client attempts connection
  Then the server rejects with "connect_error": "No token provided"

Scenario: Auto-reconnect after token expiration
  Given the user is connected with JWT expiring in 30 seconds
  And client has refresh token logic running
  When JWT expires (15 minutes later)
  Then client refreshes access token via POST /api/auth/refresh
  And disconnects current socket
  And reconnects with new JWT token
  And server accepts new connection
  And user experiences <500ms reconnection time (imperceptible)
```

---

### FR-002: Join Chat Room

**Description:**  
When a user opens a specific chat, the client MUST emit a `join_chat` event. The system MUST validate the user belongs to the chat (is client_id OR professional_id), then join the socket to the chat room for real-time message broadcasting.

**Requirements:**
- System MUST receive `chatId` in event payload
- System MUST query `chats` table to verify user is client_id OR professional_id
- System MUST return 403 error if user does NOT belong to chat
- System MUST join socket to room `chat:{chatId}` if authorized
- System MUST emit `joined_chat` confirmation event to sender
- System MUST support user joining multiple chat rooms simultaneously (different tabs/chats)

**Scenarios:**

```gherkin
Scenario: User joins own chat successfully
  Given the user "juan@example.com" (userId=1) is connected via WebSocket
  And chat ID 5 exists with client_id=1, professional_id=2
  When the client emits "join_chat" with payload: { chatId: 5 }
  Then the server validates user belongs to chat (client_id=1 matches)
  And joins socket to room "chat:5"
  And emits "joined_chat" with payload: { chatId: 5 }

Scenario: User attempts to join unauthorized chat
  Given the user userId=1 is connected
  And chat ID 10 exists with client_id=5, professional_id=8 (user 1 NOT involved)
  When the client emits "join_chat" with { chatId: 10 }
  Then the server queries chat (userId NOT in client_id/professional_id)
  And emits "error" event: { message: "Access denied" }
  And does NOT join socket to room "chat:10"

Scenario: User joins non-existent chat
  Given chat ID 999 does NOT exist in database
  When the client emits "join_chat" with { chatId: 999 }
  Then the server returns error: "Chat not found"

Scenario: User joins multiple chats (multi-tab support)
  Given the user has 3 active chats (IDs 1, 2, 3)
  When the client emits "join_chat" for chatId=1
  And then emits "join_chat" for chatId=2
  Then the socket is in rooms: ["user:1", "chat:1", "chat:2"]
  And receives messages from both chats simultaneously
```

---

### FR-003: Send Text Message

**Description:**  
A user MUST be able to send a text message to a chat. The system MUST validate content, apply rate limiting, persist to database with UUID (idempotent), broadcast to chat room, and conditionally send push notification to recipient.

**Requirements:**
- System MUST receive: `messageId` (UUID v4 client-generated), `chatId`, `text`
- System MUST validate `text` is 1-2000 characters
- System MUST validate user belongs to chat (query `chats` table)
- System MUST apply rate limit: 20 messages per minute per user (Redis sliding window)
- System MUST save message to `messages` table using `upsert` (idempotent by `messageId`)
- System MUST set `sender_id`, `chat_id`, `message_text`, `read=false`, `created_at=NOW()`
- System MUST broadcast `new_message` event to room `chat:{chatId}` (includes sender)
- System MUST conditionally send FCM push notification (see FR-009)
- System MUST return ACK callback: `{ success: true, message }` on success
- System MUST return ACK callback: `{ success: false, error }` on failure
- System MUST NOT duplicate message if `messageId` already exists (upsert behavior)

**Scenarios:**

```gherkin
Scenario: Successful text message send
  Given the user "juan@example.com" (userId=1) is in chat ID 5
  And has sent 5 messages in last minute (below 20 rate limit)
  When the client emits "send_message" with:
    {
      "messageId": "550e8400-e29b-41d4-a716-446655440000",
      "chatId": 5,
      "text": "Hola, ¿cuándo puedes venir?"
    }
  Then the server validates text length (success: 26 chars)
  And validates user belongs to chat (success)
  And checks rate limit (5/20, allowed)
  And upserts message to database:
    INSERT INTO messages (id, chat_id, sender_id, message_text, read, created_at)
    VALUES ('550e8400...', 5, 1, 'Hola, ¿cuándo...', false, NOW())
    ON CONFLICT (id) DO NOTHING
  And broadcasts "new_message" event to room "chat:5" with payload:
    {
      "id": "550e8400...",
      "chat_id": 5,
      "sender_id": 1,
      "message_text": "Hola, ¿cuándo puedes venir?",
      "media_url": null,
      "media_type": null,
      "read": false,
      "read_at": null,
      "created_at": "2026-03-22T15:30:00.000Z",
      "sender": {
        "id": 1,
        "full_name": "Juan Perez",
        "profile_photo_url": "https://..."
      }
    }
  And sends ACK callback: { success: true, message: {...} }
  And conditionally sends push notification to recipient (see FR-009)

Scenario: Rate limit exceeded
  Given the user has sent 20 messages in last 60 seconds
  When the user tries to send 21st message
  Then the server checks rate limit (20/20, EXCEEDED)
  And emits "error" event: { type: "rate_limit_exceeded", message: "Demasiados mensajes. Espera 1 minuto." }
  And sends ACK callback: { success: false, error: "Rate limit exceeded" }
  And does NOT save message to database

Scenario: Text exceeds max length (2000 chars)
  Given the client sends text with 2100 characters
  When the client emits "send_message"
  Then the server validates text length (fails: >2000)
  And sends ACK callback: { success: false, error: "Text exceeds 2000 characters" }

Scenario: Duplicate message (network retry)
  Given the user sent messageId "550e8400..." successfully
  And network timeout prevented ACK from reaching client
  When the client retries same "send_message" with same messageId
  Then the server executes upsert (ON CONFLICT DO NOTHING)
  And message is NOT duplicated in database
  And broadcasts "new_message" again (idempotent)
  And sends ACK callback: { success: true, message }
  And client deduplicates on receive (see FR-004)

Scenario: Send message to chat user doesn't belong to
  Given the user userId=1 attempts to send message to chatId=10
  And chat 10 has client_id=5, professional_id=8 (user 1 NOT involved)
  When the client emits "send_message" for chatId=10
  Then the server validates user belongs to chat (fails)
  And sends ACK callback: { success: false, error: "Access denied" }

Scenario: Database error (connection lost)
  Given the database connection is temporarily unavailable
  When the client emits "send_message"
  Then the server catches database error
  And sends ACK callback: { success: false, error: "Database error. Please retry." }
  And client stores message in offline queue (see FR-010)
```

---

### FR-004: Receive Message (Client-Side Deduplication)

**Description:**  
When a user receives a `new_message` event, the client MUST deduplicate by `messageId` before adding to UI state. If the user is currently viewing the chat, the client MUST emit `mark_read` event to update read receipts.

**Requirements:**
- Client MUST listen for `new_message` event from server
- Client MUST check if `message.id` already exists in local state
- Client MUST ignore message if duplicate (same `messageId`)
- Client MUST add message to UI state if NOT duplicate
- Client MUST check if message is from current chat AND from other user
- Client MUST emit `mark_read` event if conditions met (see FR-006)
- Client MUST update chat list `last_message_at` timestamp
- Client MUST increment unread badge if message is from other chat

**Scenarios:**

```gherkin
Scenario: Receive new message in current chat
  Given the user is viewing chatId=5
  And local state has 10 messages (IDs: msg1...msg10)
  When the server broadcasts "new_message" with:
    { "id": "msg11", "chat_id": 5, "sender_id": 2, "message_text": "Puedo ir mañana", ... }
  Then the client checks messageId "msg11" in local state (NOT found)
  And adds message to UI (renders in chat window)
  And checks: currentChatId === 5 (YES) AND senderId !== myUserId (YES)
  And emits "mark_read" event: { chatId: 5, messageIds: ["msg11"] }

Scenario: Receive duplicate message (deduplication)
  Given local state has message with id "msg11"
  When the server broadcasts "new_message" with id "msg11" (duplicate due to retry)
  Then the client finds "msg11" in local state (DUPLICATE)
  And ignores message (does NOT add to UI)
  And does NOT emit "mark_read" (already processed)

Scenario: Receive message from another chat (background)
  Given the user is viewing chatId=5
  When the server broadcasts "new_message" from chatId=8
  Then the client checks currentChatId === 8 (NO)
  And does NOT add to current UI view
  And increments unread badge for chatId=8 in chat list
  And plays notification sound (if enabled)

Scenario: Receive own message (echo confirmation)
  Given the user sent messageId "msg11" from their device
  When the server broadcasts "new_message" with sender_id=myUserId
  Then the client finds "msg11" in local state (already added as "sending")
  And updates message status from "sending" to "sent" (shows single checkmark)
  And does NOT emit "mark_read" (own messages not marked)
```

---

### FR-005: Typing Indicator (Send)

**Description:**  
When a user is typing in a chat, the client MUST emit a throttled `typing` event (max 1 every 500ms) to notify the other user. When the user stops typing for 3 seconds, the client MUST emit `stop_typing` event.

**Requirements:**
- Client MUST throttle `typing` event to max 1 per 500ms (using lodash.throttle)
- Client MUST emit `typing` with payload: `{ chatId }`
- Server MUST broadcast `user_typing` event to OTHER users in room (NOT sender)
- Server MUST auto-emit `user_stop_typing` after 3s if no new `typing` received (timeout cleanup)
- Client MUST emit `stop_typing` when user stops typing for 3s (local timer)
- Client MUST emit `stop_typing` when user sends message (typing finished)
- Client MUST emit `stop_typing` when user leaves chat (navigation)

**Scenarios:**

```gherkin
Scenario: User starts typing (throttled)
  Given the user is in chatId=5
  And types "H" "o" "l" "a" rapidly (4 chars in 400ms)
  When the client onChange handler fires 4 times
  Then throttle logic emits "typing" event ONCE (at 0ms, next allowed at 500ms)
  And server receives 1 "typing" event with { chatId: 5 }
  And server broadcasts "user_typing" to other user in chat:5
    Payload: { userId: 1, chatId: 5 }
  And recipient client shows "Juan está escribiendo..."

Scenario: User types continuously (throttle prevents spam)
  Given the user types 20 characters in 2 seconds (100ms per char)
  When throttle is set to 500ms
  Then client emits "typing" at: 0ms, 500ms, 1000ms, 1500ms, 2000ms
  And server receives ONLY 5 events (instead of 20 without throttle)

Scenario: User stops typing (auto-stop after 3s)
  Given the user emitted "typing" at T=0
  And stops typing (no new input)
  When 3000ms elapse with no new typing event
  Then client emits "stop_typing" with { chatId: 5 }
  And server broadcasts "user_stop_typing" to other user
  And recipient client hides "está escribiendo..." indicator

Scenario: Server auto-cleanup (client doesn't send stop_typing)
  Given the user emitted "typing" at T=0
  And client crashes before sending "stop_typing"
  When server receives NO new "typing" event for 3000ms
  Then server timeout expires
  And server auto-broadcasts "user_stop_typing" to room
  And clears typing state from memory Map

Scenario: User sends message (implicit stop typing)
  Given the user is typing (indicator visible to recipient)
  When the user clicks "Send" button
  Then client emits "send_message" event
  And client emits "stop_typing" event (before send)
  And server broadcasts "user_stop_typing"
  And recipient sees indicator disappear + message appears
```

---

### FR-006: Read Receipts (Mark as Read)

**Description:**  
When a user opens a chat or scrolls to view unread messages, the client MUST emit a `mark_read` event with the list of visible unread message IDs. The system MUST update the database (batch UPDATE), emit `message_read` events to the sender(s), and update UI with double-check icons.

**Requirements:**
- Client MUST detect unread messages visible in viewport when:
  - User opens chat (initial load)
  - User scrolls through chat history (infinite scroll)
- Client MUST batch messageIds (max every 2s to avoid spamming)
- Client MUST emit `mark_read` with payload: `{ chatId, messageIds: [id1, id2, ...] }`
- Server MUST validate user is recipient (NOT sender) of messages
- Server MUST execute batch UPDATE: `messages.read=true, read_at=NOW()` WHERE id IN (...)
- Server MUST emit `message_read` event to SENDER(S) of marked messages
- Sender client MUST update UI: single check → double check (delivered → read)
- System MUST NOT mark own messages as read (sender cannot mark their own)

**Scenarios:**

```gherkin
Scenario: User opens chat with unread messages
  Given the user "juan@example.com" (userId=1) opens chatId=5
  And chat has 5 unread messages from userId=2 (professional):
    - msg1, msg2, msg3, msg4, msg5 (all read=false)
  When the client loads chat history
  Then client detects 5 unread messages in viewport
  And emits "mark_read" with { chatId: 5, messageIds: ["msg1", "msg2", "msg3", "msg4", "msg5"] }
  And server validates userId=1 is recipient (sender_id=2 for all messages)
  And executes batch UPDATE:
    UPDATE messages
    SET read=true, read_at='2026-03-22T15:35:00.000Z'
    WHERE id IN ('msg1', 'msg2', 'msg3', 'msg4', 'msg5')
    AND sender_id != 1
  And emits "message_read" event to room "user:2" (sender):
    { messageId: "msg1", readAt: "2026-03-22T15:35:00.000Z" }
    { messageId: "msg2", readAt: "..." }
    ... (5 events)
  And professional's client (userId=2) updates UI:
    - Single checkmark (✓) changes to double blue checkmark (✓✓)

Scenario: User scrolls to older unread messages
  Given the chat has 100 messages
  And user initially loaded last 50 messages (messages 51-100)
  And messages 1-30 are unread (from other user)
  When the user scrolls up (infinite scroll)
  Then client loads messages 31-50
  And detects messages 31-50 are visible in viewport
  And filters unread messages from other user (assume 10 messages)
  And emits "mark_read" with 10 messageIds
  And server marks them as read + notifies sender

Scenario: Batch throttling (avoid spam)
  Given the user scrolls rapidly through 100 unread messages
  When viewport changes every 100ms (showing different messages)
  Then client throttles "mark_read" event to max 1 every 2 seconds
  And batches all visible messageIds into single event
  And server receives 1 UPDATE query (not 100)

Scenario: Attempt to mark own messages as read (rejected)
  Given the user userId=1 sends messageId "msg10"
  When the client accidentally emits "mark_read" with messageIds: ["msg10"]
  Then the server validates sender_id=1 (same as requester)
  And WHERE clause filters out own messages: sender_id != 1
  And UPDATE affects 0 rows (no change)
  And no "message_read" event emitted

Scenario: Mark read for non-existent message IDs
  Given the client emits "mark_read" with messageIds: ["invalid-uuid"]
  When the server executes UPDATE
  Then WHERE id IN ('invalid-uuid') matches 0 rows
  And operation completes silently (no error)

Scenario: Sender receives multiple message_read events (batch)
  Given the sender sent 5 messages (msg1-msg5)
  When the recipient marks all 5 as read simultaneously
  Then server emits 5 "message_read" events to sender's room
  And sender client batches UI updates (single re-render)
```

---

### FR-007: Send Multimedia Message (Image or Video)

**Description:**  
A user MUST be able to send a multimedia message (1 image OR 1 video, NOT both). The system MUST use signed upload to Cloudinary (client uploads directly), then send message with `media_url` + `media_type`. Text is optional.

**Requirements:**
- System MUST provide endpoint: POST /api/chats/:chatId/upload-signature
- System MUST validate user belongs to chat before issuing signature
- System MUST generate Cloudinary signed URL valid for 1 hour
- System MUST return: `{ signature, timestamp, uploadUrl, folder }`
- Client MUST upload file directly to Cloudinary (NOT via QuickFixU server)
- Client MUST compress videos before upload (react-native-compressor, max 15MB after compression)
- Client MUST emit `send_message` with: `{ messageId, chatId, text?, mediaUrl, mediaType }`
- System MUST validate `mediaType` is "image" OR "video"
- System MUST validate message has `text` OR `mediaUrl` (at least one)
- System MUST save message with `media_url` and `media_type` fields
- System MUST broadcast message with media URL to chat room

**Scenarios:**

```gherkin
Scenario: User sends image message
  Given the user is in chatId=5
  And selects image file "photo.jpg" (2.5MB, JPEG)
  When the client requests POST /api/chats/5/upload-signature with:
    { fileType: "image/jpeg" }
  Then the server validates user belongs to chat 5 (success)
  And generates Cloudinary signature:
    - timestamp: 1679493600
    - folder: "quickfixu/chats/5"
    - signature: "abc123..." (HMAC-SHA256)
  And returns 200 OK:
    {
      "signature": "abc123...",
      "timestamp": 1679493600,
      "uploadUrl": "https://api.cloudinary.com/v1_1/quickfixu/image/upload",
      "folder": "quickfixu/chats/5"
    }
  And client uploads image directly to Cloudinary with:
    - file: photo.jpg
    - signature, timestamp, api_key, folder
  And Cloudinary returns: { "secure_url": "https://res.cloudinary.com/.../photo.jpg" }
  And client emits "send_message" with:
    {
      "messageId": "msg20",
      "chatId": 5,
      "text": "",
      "mediaUrl": "https://res.cloudinary.com/.../photo.jpg",
      "mediaType": "image"
    }
  And server saves message with media_url + media_type
  And broadcasts "new_message" with media payload
  And recipient renders image in chat

Scenario: User sends video message (compressed)
  Given the user selects video file "repair.mp4" (45MB, raw)
  When the client compresses video using react-native-compressor
  Then video is reduced to 12MB (below 15MB limit)
  And client requests upload signature with fileType: "video/mp4"
  And uploads compressed video to Cloudinary
  And sends message with mediaType: "video"

Scenario: Video exceeds 15MB after compression
  Given the user selects 4K video (200MB raw)
  When the client compresses video
  And compressed size is 18MB (still >15MB limit)
  Then client shows error: "Video demasiado grande. Usa un video más corto (<30 segundos)."
  And does NOT attempt upload

Scenario: User sends image with optional text
  Given the user uploads image "before.jpg"
  And types text: "Así está el problema ahora"
  When the client sends message
  Then message has BOTH message_text AND media_url
  And renders in chat as: [Image] + "Así está el problema ahora"

Scenario: Cloudinary upload fails (network error)
  Given the client requests signature (success)
  And starts uploading image to Cloudinary
  When Cloudinary returns 503 Service Unavailable
  Then client catches error
  And shows error: "Error subiendo imagen. Intenta de nuevo."
  And does NOT emit "send_message" (no partial state)

Scenario: Signature expired (user took >1 hour to upload)
  Given the client requested signature at T=0 (valid until T=3600s)
  And user's phone locked, upload paused
  When the client resumes upload at T=3700s (expired)
  Then Cloudinary rejects upload: "Signature expired"
  And client requests NEW signature
  And retries upload with fresh signature

Scenario: Unauthorized signature request
  Given the user userId=1 requests signature for chatId=10
  And chat 10 has client_id=5, professional_id=8 (user NOT involved)
  When POST /api/chats/10/upload-signature
  Then the server validates user belongs to chat (fails)
  And returns 403 Forbidden: { "error": "Access denied" }
```

---

### FR-008: Get Chat Message History (Paginated)

**Description:**  
When a user opens a chat, the client MUST fetch the last 50 messages sorted by `created_at DESC` (newest first). The user can infinite-scroll upwards to load older messages using cursor-based pagination.

**Requirements:**
- System MUST provide endpoint: GET /api/chats/:chatId/messages
- System MUST validate user belongs to chat (client_id OR professional_id)
- System MUST return max 50 messages per page (default limit)
- System MUST sort by `created_at DESC, id DESC` (newest first, cursor-based)
- System MUST accept `cursor` query param: `{ createdAt, id }` (JSON string)
- System MUST return: `{ messages, nextCursor, hasMore }`
- System MUST include sender profile: `{ id, full_name, profile_photo_url }`
- System MUST use indexed query: `idx_messages_created_at(chat_id, created_at DESC, id DESC)`

**Scenarios:**

```gherkin
Scenario: Load initial messages (first page)
  Given the user opens chatId=5
  And chat has 120 messages total
  When the client sends GET /api/chats/5/messages?limit=50
  Then the server validates user belongs to chat (success)
  And executes query:
    SELECT * FROM messages
    WHERE chat_id=5
    ORDER BY created_at DESC, id DESC
    LIMIT 50
  And returns 200 OK with:
    {
      "messages": [
        {
          "id": "msg120",
          "chat_id": 5,
          "sender_id": 2,
          "message_text": "Perfecto, nos vemos mañana",
          "media_url": null,
          "media_type": null,
          "read": true,
          "read_at": "2026-03-22T15:30:00Z",
          "created_at": "2026-03-22T15:25:00Z",
          "sender": {
            "id": 2,
            "full_name": "Carlos Lopez",
            "profile_photo_url": "https://..."
          }
        },
        // ... 49 more messages (msg119 down to msg71)
      ],
      "nextCursor": { "createdAt": "2026-03-20T10:00:00Z", "id": "msg71" },
      "hasMore": true
    }

Scenario: Load older messages (second page with cursor)
  Given the user scrolled to top of chat (infinite scroll)
  And received nextCursor: { "createdAt": "2026-03-20T10:00:00Z", "id": "msg71" }
  When the client sends GET /api/chats/5/messages?cursor={"createdAt":"2026-03-20T10:00:00Z","id":"msg71"}&limit=50
  Then the server parses cursor
  And executes query:
    SELECT * FROM messages
    WHERE chat_id=5
    AND (created_at < '2026-03-20T10:00:00Z'
      OR (created_at = '2026-03-20T10:00:00Z' AND id < 'msg71'))
    ORDER BY created_at DESC, id DESC
    LIMIT 50
  And returns messages msg70 down to msg21
  And returns nextCursor for msg21 (if hasMore=true)

Scenario: Last page (no more messages)
  Given the chat has 120 messages total
  And user already loaded 100 messages (2 pages)
  When the client requests 3rd page (limit=50)
  Then the server returns ONLY 20 messages (msg20 to msg1)
  And returns:
    {
      "messages": [ /* 20 messages */ ],
      "nextCursor": null,
      "hasMore": false
    }

Scenario: Empty chat (no messages)
  Given chatId=5 has 0 messages (newly created chat)
  When the client sends GET /api/chats/5/messages
  Then the server returns:
    {
      "messages": [],
      "nextCursor": null,
      "hasMore": false
    }

Scenario: Unauthorized access (user not in chat)
  Given the user userId=1 requests messages for chatId=10
  And chat 10 has client_id=5, professional_id=8
  When GET /api/chats/10/messages
  Then the server returns 403 Forbidden: { "error": "Access denied" }
```

---

### FR-009: Conditional Push Notifications

**Description:**  
When a user receives a new message, the system MUST send a FCM push notification ONLY if the recipient is OFFLINE or ONLINE but NOT currently viewing the specific chat. This prevents spam notifications while user is actively chatting.

**Requirements:**
- System MUST check recipient's connection status after saving message
- System MUST query Socket.io for recipient's active sockets: `io.in('user:{recipientId}').fetchSockets()`
- System MUST iterate sockets to check if ANY socket is in room `chat:{chatId}`
- System MUST NOT send push if `socket.rooms.has('chat:{chatId}')` for ANY socket
- System MUST send FCM push if recipient is offline (no sockets) OR online but in different chat
- System MUST include in push notification: sender name, message preview (first 100 chars), chatId
- System MUST create in-app notification record in `notifications` table
- System MUST handle FCM failures silently (log error, do NOT block message send)

**Scenarios:**

```gherkin
Scenario: Recipient is offline (send push)
  Given the user "juan@example.com" (userId=1) sends message to chatId=5
  And recipient "carlos@example.com" (userId=2) is OFFLINE (no WebSocket connection)
  When the server saves message and checks recipient status
  Then io.in('user:2').fetchSockets() returns empty array (no sockets)
  And shouldSendPush = true
  And sends FCM notification to userId=2:
    {
      "token": "<carlos_fcm_token>",
      "notification": {
        "title": "Nuevo mensaje de Juan Perez",
        "body": "Hola, ¿cuándo puedes venir?"
      },
      "data": {
        "type": "new_message",
        "chatId": "5",
        "messageId": "msg20"
      }
    }
  And creates notification in database:
    INSERT INTO notifications (user_id, type, title, body, data, read, sent_at)
    VALUES (2, 'new_message', '...', '...', '{"chatId":5}', false, NOW())

Scenario: Recipient is online but in DIFFERENT chat (send push)
  Given the recipient userId=2 is ONLINE (WebSocket connected)
  And recipient is viewing chatId=8 (joined room "chat:8")
  When the sender sends message to chatId=5
  Then server checks recipient sockets:
    - socket1.rooms = ["user:2", "chat:8"] (NOT in "chat:5")
  And shouldSendPush = true (not in target chat)
  And sends FCM push notification

Scenario: Recipient is online AND viewing THIS chat (NO push)
  Given the recipient userId=2 is ONLINE
  And recipient is viewing chatId=5 (joined room "chat:5")
  When the sender sends message to chatId=5
  Then server checks recipient sockets:
    - socket1.rooms = ["user:2", "chat:5"] (FOUND)
  And shouldSendPush = false (already seeing messages in real-time)
  And SKIPS FCM push notification
  And still creates in-app notification (for history)

Scenario: Recipient has multiple devices (1 viewing chat, 1 not)
  Given the recipient has 2 devices connected:
    - Device A: socket1.rooms = ["user:2", "chat:5"] (viewing chat)
    - Device B: socket2.rooms = ["user:2", "chat:8"] (different chat)
  When the sender sends message to chatId=5
  Then server finds socket1 is in "chat:5" (ANY socket matches)
  And shouldSendPush = false (at least one device is viewing)
  And skips push (Device A sees message in real-time)

Scenario: FCM token missing (silent failure)
  Given the recipient userId=2 has fcm_token=NULL (notifications disabled)
  When the server tries to send push
  Then FCM send is skipped (no token available)
  And logs warning: "No FCM token for user 2"
  And does NOT throw error (message send still succeeds)
  And creates in-app notification normally

Scenario: FCM send fails (token invalid/expired)
  Given the recipient has fcm_token="expired_token"
  When the server sends FCM notification
  Then FCM API returns error: "InvalidRegistration"
  And server logs error: "FCM failed for user 2: InvalidRegistration"
  And server updates users.fcm_token=NULL (mark as invalid)
  And message send still succeeds (push failure is non-critical)
```

---

### FR-010: Offline Message Queue (Client-Side)

**Description:**  
When a user sends a message while offline, the client MUST store it in AsyncStorage queue (max 100 messages). When the socket reconnects, the client MUST automatically send all queued messages in order.

**Requirements:**
- Client MUST detect `socket.connected === false` before sending
- Client MUST add message to AsyncStorage queue: `message_queue` key
- Client MUST enforce max 100 messages in queue (show error if exceeded)
- Client MUST add message to UI with status "queued" (clock icon)
- Client MUST listen for `connect` event (reconnection)
- Client MUST process queue on reconnect: iterate and emit `send_message` for each
- Client MUST remove message from queue after successful ACK
- Client MUST preserve queue if send fails (retry on next reconnect)
- Client MUST show "Pending messages" indicator in chat

**Scenarios:**

```gherkin
Scenario: Send message while offline (add to queue)
  Given the user is in chatId=5
  And socket.connected === false (WiFi disabled)
  When the user types "Hola" and clicks Send
  Then client detects offline status
  And generates messageId: "msg50"
  And adds to AsyncStorage:
    queue = [
      {
        "id": "msg50",
        "chatId": 5,
        "text": "Hola",
        "timestamp": 1679493600000
      }
    ]
  And adds to UI with status: "queued" (shows clock icon ⏱️)
  And shows banner: "Sin conexión. Mensaje se enviará cuando te conectes."

Scenario: User sends multiple messages offline
  Given the user is offline
  When the user sends 5 messages
  Then client adds all 5 to queue (order preserved)
  And queue = [ msg1, msg2, msg3, msg4, msg5 ]
  And all show "queued" status in UI

Scenario: Auto-send on reconnect (success)
  Given the queue has 3 messages: [msg1, msg2, msg3]
  When socket reconnects (WiFi enabled)
  Then client emits "connect" event listener triggers
  And client iterates queue:
    - emit "send_message" for msg1, wait for ACK
    - ACK success → remove msg1 from queue, update UI to "sent"
    - emit "send_message" for msg2, wait for ACK
    - ACK success → remove msg2 from queue
    - emit "send_message" for msg3, wait for ACK
    - ACK success → remove msg3 from queue
  And queue becomes empty: []
  And hides "Pending messages" banner

Scenario: Queue exceeds 100 messages (error)
  Given the user is offline for 2 hours
  And has queued 100 messages
  When the user tries to send 101st message
  Then client checks queue length (100, limit reached)
  And shows error: "Demasiados mensajes pendientes. Conecta a WiFi para enviarlos."
  And does NOT add message to queue

Scenario: Queued message fails to send on reconnect
  Given the queue has msg1
  When socket reconnects
  And client emits "send_message" for msg1
  And server returns ACK: { success: false, error: "Database error" }
  Then client keeps msg1 in queue (NOT removed)
  And updates UI status to "failed" (red exclamation icon ❗)
  And shows "Retry" button in UI
  And will retry on next reconnect OR manual retry

Scenario: User closes app with queued messages
  Given the queue has 3 messages in AsyncStorage
  When the user force-closes the app
  And reopens app 1 hour later
  Then client loads queue from AsyncStorage (persisted)
  And restores 3 "queued" messages in UI
  And auto-sends when socket connects

Scenario: Multimedia message in queue
  Given the user uploads image while offline
  And image is already uploaded to Cloudinary (mediaUrl exists)
  When client adds message to queue
  Then queue stores: { id, chatId, text: "", mediaUrl, mediaType: "image" }
  And on reconnect, sends message with mediaUrl normally
```

---

### FR-011: Get Chat List (Sorted by last_message_at)

**Description:**  
A user MUST be able to view a list of all their active chats, sorted by `last_message_at DESC` (most recent first), showing: other user's name/photo, last message preview, unread count badge, and timestamp.

**Requirements:**
- System MUST provide endpoint: GET /api/chats
- System MUST filter chats WHERE `client_id=userId OR professional_id=userId`
- System MUST sort by `last_message_at DESC, id DESC`
- System MUST include other user profile: `{ id, full_name, profile_photo_url, role }`
- System MUST calculate unread count per chat: COUNT messages WHERE `chat_id=X AND read=false AND sender_id!=userId`
- System MUST return last message preview (first 100 chars of `message_text` or "[Media]")
- System MUST use cursor-based pagination (limit 20 chats per page)
- System MUST complete query <200ms (indexed on `last_message_at`)

**Scenarios:**

```gherkin
Scenario: User views chat list (first page)
  Given the user "juan@example.com" (userId=1, role=client) has 5 chats:
    - Chat 1: with professional userId=2, last_message_at='2026-03-22T15:00:00Z', 3 unread
    - Chat 2: with professional userId=3, last_message_at='2026-03-22T14:00:00Z', 0 unread
    - Chat 3: with professional userId=4, last_message_at='2026-03-21T10:00:00Z', 1 unread
    - Chat 4: with professional userId=5, last_message_at='2026-03-20T08:00:00Z', 0 unread
    - Chat 5: with professional userId=6, last_message_at='2026-03-19T12:00:00Z', 5 unread
  When the user sends GET /api/chats?limit=20
  Then the server executes query:
    SELECT c.*, u.full_name, u.profile_photo_url, u.role,
      (SELECT COUNT(*) FROM messages m
       WHERE m.chat_id=c.id AND m.read=false AND m.sender_id!=1) AS unread_count,
      (SELECT message_text FROM messages m
       WHERE m.chat_id=c.id ORDER BY created_at DESC LIMIT 1) AS last_message_preview
    FROM chats c
    JOIN users u ON (CASE WHEN c.client_id=1 THEN c.professional_id ELSE c.client_id END) = u.id
    WHERE c.client_id=1 OR c.professional_id=1
    ORDER BY c.last_message_at DESC, c.id DESC
    LIMIT 20
  And returns 200 OK:
    {
      "chats": [
        {
          "id": 1,
          "other_user": {
            "id": 2,
            "full_name": "Carlos Lopez",
            "profile_photo_url": "https://...",
            "role": "professional"
          },
          "last_message_at": "2026-03-22T15:00:00Z",
          "last_message_preview": "Perfecto, nos vemos mañana",
          "unread_count": 3
        },
        {
          "id": 2,
          "other_user": { "id": 3, "full_name": "Pedro Martinez", ... },
          "last_message_at": "2026-03-22T14:00:00Z",
          "last_message_preview": "Gracias por aceptar",
          "unread_count": 0
        },
        // ... chats 3, 4, 5 in order
      ],
      "nextCursor": null,
      "hasMore": false
    }

Scenario: Chat list with multimedia last message
  Given the last message in chatId=1 is an image (message_text=null, media_url="...")
  When the user requests chat list
  Then last_message_preview = "[Imagen]"
  And shows camera icon 📷 in UI

Scenario: Empty chat list (new user)
  Given the user has 0 chats (never messaged anyone)
  When GET /api/chats
  Then returns:
    {
      "chats": [],
      "nextCursor": null,
      "hasMore": false
    }

Scenario: Chat list updates in real-time (new message received)
  Given the user is viewing chat list screen
  And receives new message in chatId=3 via WebSocket
  When "new_message" event fires
  Then client updates local state:
    - Move chatId=3 to top of list (last_message_at updated)
    - Increment unread_count for chatId=3
    - Update last_message_preview with new message text
  And re-sorts chat list client-side (no API call needed)
```

---

## 3. Socket.io Events Specification

### Event: `connection`

**Direction:** Server  
**Trigger:** Client establishes WebSocket connection  
**Payload:** None (handled by middleware)  
**Response:** `connected` event with `{ userId }`

---

### Event: `join_chat`

**Direction:** Client → Server  
**Payload:**
```typescript
{
  chatId: number
}
```
**Response:** `joined_chat` event OR `error` event  
**Server Action:** Validate user belongs to chat, join socket to room `chat:{chatId}`

---

### Event: `leave_chat`

**Direction:** Client → Server  
**Payload:**
```typescript
{
  chatId: number
}
```
**Response:** `left_chat` event  
**Server Action:** Remove socket from room `chat:{chatId}`

---

### Event: `send_message`

**Direction:** Client → Server  
**Payload:**
```typescript
{
  messageId: string;      // UUID v4 (client-generated)
  chatId: number;
  text?: string;          // Optional if mediaUrl present
  mediaUrl?: string;      // Cloudinary URL (optional)
  mediaType?: 'image' | 'video';  // Required if mediaUrl present
}
```
**Response:** ACK callback `{ success: boolean, message?, error? }`  
**Broadcast:** `new_message` event to room `chat:{chatId}`  
**Server Action:** Validate, rate limit, save to DB, broadcast, conditional push notification

---

### Event: `new_message`

**Direction:** Server → Client  
**Trigger:** Message saved and broadcasted to chat room  
**Payload:**
```typescript
{
  id: string;             // UUID
  chat_id: number;
  sender_id: number;
  message_text: string | null;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  read: boolean;
  read_at: string | null;
  created_at: string;     // ISO 8601
  sender: {
    id: number;
    full_name: string;
    profile_photo_url: string;
  };
}
```
**Client Action:** Deduplicate by `id`, add to UI, emit `mark_read` if applicable

---

### Event: `typing`

**Direction:** Client → Server  
**Payload:**
```typescript
{
  chatId: number
}
```
**Broadcast:** `user_typing` event to OTHER users in room `chat:{chatId}`  
**Server Action:** Store typing state, set 3s timeout to auto-emit `user_stop_typing`

---

### Event: `user_typing`

**Direction:** Server → Client  
**Payload:**
```typescript
{
  userId: number;
  chatId: number;
}
```
**Client Action:** Show "X está escribiendo..." indicator

---

### Event: `stop_typing`

**Direction:** Client → Server  
**Payload:**
```typescript
{
  chatId: number
}
```
**Broadcast:** `user_stop_typing` event to OTHER users  
**Server Action:** Clear typing state, cancel timeout

---

### Event: `user_stop_typing`

**Direction:** Server → Client  
**Payload:**
```typescript
{
  userId: number;
  chatId: number;
}
```
**Client Action:** Hide "está escribiendo..." indicator

---

### Event: `mark_read`

**Direction:** Client → Server  
**Payload:**
```typescript
{
  chatId: number;
  messageIds: string[];   // Array of UUIDs
}
```
**Response:** None (fire-and-forget)  
**Server Action:** Batch UPDATE `messages.read=true`, emit `message_read` to senders  
**Broadcast:** `message_read` event to sender(s)

---

### Event: `message_read`

**Direction:** Server → Client  
**Payload:**
```typescript
{
  messageId: string;
  readAt: string;         // ISO 8601
}
```
**Client Action:** Update UI (single check → double blue check)

---

## 4. Non-Functional Requirements

### NFR-001: Performance

| Operation | p50 Latency | p95 Latency | Max Acceptable |
|-----------|-------------|-------------|----------------|
| WebSocket handshake (JWT validation) | <100ms | <200ms | 500ms |
| send_message event (text only) | <50ms | <150ms | 300ms |
| send_message event (with media) | <200ms | <500ms | 1s |
| new_message broadcast | <20ms | <50ms | 100ms |
| mark_read batch (10 messages) | <100ms | <200ms | 500ms |
| GET /api/chats (chat list) | <150ms | <300ms | 500ms |
| GET /api/chats/:id/messages (50 msgs) | <100ms | <250ms | 500ms |
| Typing indicator propagation | <50ms | <100ms | 200ms |

- Message delivery (sender emit → recipient receive) MUST complete <300ms (p95)
- Offline queue processing MUST send 100 messages in <10 seconds
- Cloudinary signature generation MUST complete <50ms
- Read receipt UI update (double check) MUST appear <500ms after mark_read

### NFR-002: Scalability

- System SHOULD handle 500 concurrent WebSocket connections (MVP)
- System SHOULD support 10,000 messages per day (initial load)
- Database SHOULD handle 100,000 messages with <200ms query time (indexed)
- Redis rate limiter SHOULD process 1000 requests/second
- Single Socket.io server SHOULD handle 10,000 connections before Redis adapter needed
- Offline queue MUST NOT exceed 100 messages per user (storage constraint)

### NFR-003: Reliability

- Message delivery guarantee: At-least-once (duplicates handled client-side)
- WebSocket reconnection MUST be automatic with exponential backoff
- Offline queue MUST persist in AsyncStorage (survive app restarts)
- Database trigger MUST update `chats.last_message_at` atomically (no race conditions)
- Rate limit MUST use Redis sliding window (distributed across servers)
- Push notification failures MUST NOT block message send (silent failure)

### NFR-004: Security

- JWT token MUST be validated on EVERY WebSocket connection
- User MUST be validated for chat membership before joining room
- User CANNOT mark other users' messages as read (sender_id check)
- User CANNOT send messages to chats they don't belong to
- Cloudinary upload signatures MUST expire in 1 hour
- Rate limit MUST prevent spam: 20 messages/minute per user
- Media URLs MUST be signed Cloudinary URLs (prevent hotlinking)

### NFR-005: Observability

- All Socket.io errors MUST log: timestamp, userId, event, error message
- Message send failures MUST log: messageId, chatId, error, ACK status
- Rate limit exceeded MUST log: userId, timestamp, message count
- Typing indicator spam MUST alert if >5 events/second from single user
- Push notification failures MUST log: userId, FCM error code, token validity
- Offline queue size MUST be tracked per user (alert if >50 messages)
- Database trigger failures MUST log: chatId, messageId, error

---

## 5. Database Schema Changes

### Migration: `20260322_create_messages_table`

```sql
-- Create messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  message_text TEXT,
  media_url VARCHAR(500),
  media_type VARCHAR(10),  -- 'image' | 'video' | NULL
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_message_content CHECK (message_text IS NOT NULL OR media_url IS NOT NULL),
  CONSTRAINT chk_media_type CHECK (media_type IN ('image', 'video', NULL))
);

-- Indexes for performance
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(chat_id, created_at DESC, id DESC);
CREATE INDEX idx_messages_unread ON messages(chat_id, read) WHERE read = FALSE;

-- Trigger: Auto-update chats.last_message_at
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

---

## 6. API Contract (HTTP Endpoints)

### POST /api/chats/:chatId/upload-signature

**Description:** Generate signed Cloudinary upload URL for multimedia

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>
Content-Type: application/json

// Body
{
  fileType: string;  // "image/jpeg" | "video/mp4" | etc.
}
```

**Response 200 OK:**
```typescript
{
  signature: string;      // HMAC-SHA256 signature
  timestamp: number;      // Unix timestamp
  uploadUrl: string;      // Cloudinary API URL
  folder: string;         // "quickfixu/chats/{chatId}"
}
```

**Response 403 Forbidden:**
```typescript
{
  error: "Access denied";
}
```

---

### GET /api/chats/:chatId/messages

**Description:** Get paginated message history for a chat

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>

// Query params
limit?: number;     // default 50, max 100
cursor?: string;    // JSON: {"createdAt":"...","id":"..."}
```

**Response 200 OK:**
```typescript
{
  messages: Array<{
    id: string;
    chat_id: number;
    sender_id: number;
    message_text: string | null;
    media_url: string | null;
    media_type: 'image' | 'video' | null;
    read: boolean;
    read_at: string | null;
    created_at: string;
    sender: {
      id: number;
      full_name: string;
      profile_photo_url: string;
    };
  }>;
  nextCursor: { createdAt: string; id: string } | null;
  hasMore: boolean;
}
```

---

### GET /api/chats

**Description:** Get user's chat list sorted by last activity

**Request:**
```typescript
// Headers
Authorization: Bearer <access_token>

// Query params
limit?: number;     // default 20
cursor?: string;
```

**Response 200 OK:**
```typescript
{
  chats: Array<{
    id: number;
    other_user: {
      id: number;
      full_name: string;
      profile_photo_url: string;
      role: 'client' | 'professional';
    };
    last_message_at: string;
    last_message_preview: string;
    unread_count: number;
  }>;
  nextCursor: { lastMessageAt: string; id: number } | null;
  hasMore: boolean;
}
```

---

## 7. End-to-End Scenarios

### Scenario: Complete Chat Flow (Happy Path)

```gherkin
Given client "Juan" and professional "Carlos" have an accepted proposal (chat exists)
When Juan opens the QuickFixU app
Then app establishes WebSocket connection with JWT token
And server emits "connected" event
And Juan navigates to "Mis Chats" screen
And app fetches GET /api/chats
And displays chat with Carlos at the top (sorted by last_message_at)
And shows unread badge: 2 messages

When Juan taps on Carlos's chat
Then app emits "join_chat" with chatId=5
And server emits "joined_chat" confirmation
And app fetches GET /api/chats/5/messages?limit=50
And displays last 50 messages in chat UI
And client emits "mark_read" for 2 unread messages
And server updates messages.read=true
And server emits "message_read" to Carlos's device
And Carlos sees double blue checkmarks on his messages

When Juan types "Hola Carlos, ¿puedes venir mañana?"
Then app emits throttled "typing" event (max 1/500ms)
And server broadcasts "user_typing" to Carlos
And Carlos sees "Juan está escribiendo..." indicator

When Juan clicks "Send"
Then client generates messageId (UUID)
And client emits "stop_typing"
And client emits "send_message" with { messageId, chatId: 5, text: "..." }
And server validates, saves message, broadcasts "new_message"
And Juan sees message with single checkmark ✓ (sent)
And Carlos receives "new_message" event in real-time
And Carlos's UI shows message instantly
And Carlos's device does NOT receive push (viewing the chat)

When Carlos types response and sends
Then same flow executes (roles reversed)
And Juan receives message in real-time
And server auto-updates chats.last_message_at via DB trigger

When Juan closes app (goes offline)
And Carlos sends another message
Then server detects Juan is offline (no WebSocket connection)
And sends FCM push notification to Juan's device
And Juan receives push: "Nuevo mensaje de Carlos Lopez"
```

---

## 8. Acceptance Criteria Summary

✅ **DONE when:**

1. User can connect via WebSocket with JWT authentication
2. User can send/receive text messages in real-time (<300ms latency)
3. User can see "está escribiendo..." indicator (throttled, auto-timeout)
4. User can see read receipts (double check) when recipient reads message
5. User can send images/videos (direct Cloudinary upload)
6. User can load message history with infinite scroll (cursor pagination)
7. User can view chat list sorted by recent activity with unread badges
8. User receives push notifications ONLY when offline or in different chat
9. User can send messages offline (queue in AsyncStorage, auto-sync on reconnect)
10. System enforces rate limit (20 messages/minute)
11. Database trigger auto-updates `chats.last_message_at` on new message

**NOT in scope (Fase 7):**
- Edit/delete messages
- Message reactions (emoji)
- Voice messages
- Group chats
- Multi-device sync (session management)
- End-to-end encryption
- Message search
- Delivery receipts (sent vs delivered vs read — simplified to read-only)

---

**END OF SPECIFICATION**
