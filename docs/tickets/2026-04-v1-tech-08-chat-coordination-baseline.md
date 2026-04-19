# Ticket: Chat and coordination baseline — schema, HTTP endpoints, and real-time prep

- **Date:** 2026-04-19
- **Status:** Future / Ready to implement after tech-06
- **Type:** Implementation / Backend + Infrastructure
- **Priority:** P1

## Context

The chat/coordinated communication between client and professional is a core V1 requirement. Currently `chats` and `messages` tables are in `docs/database/DataModel.md` but not in Prisma. This ticket covers the baseline: database schema, HTTP endpoints for chat list and message history, and preparing the infrastructure for real-time WebSocket messaging.

This is the most complex remaining piece of V1 infrastructure.

## Goal

Establish the chat/coordinated communication foundation so client and professional can exchange messages through the platform after a proposal is accepted. This is needed before V1 feels like a real coordination tool.

## Scope

### Phase A: Schema and HTTP endpoints (this ticket)

1. **Prisma additions**
   - `chats` — `client_id`, `professional_id`, `last_message_at`
   - `messages` — `chat_id`, `sender_id`, `message_text`, `media_url`, `media_type`, `read`, `read_at`

2. **HTTP endpoints**
   - `GET /chats` — user's chat list, sorted by `last_message_at` DESC
   - `GET /chats/:chatId/messages` — paginated message history (cursor-based, 50 per page)
   - `POST /chats/:chatId/messages` — send text message (media stub later)
   - `PATCH /chats/:chatId/messages/read` — mark messages as read

3. **Chat auto-creation**
   - When a proposal is accepted, automatically create (or ensure existing) chat record linking the client and professional

4. **Read receipts (basic)**
   - `messages.read` boolean and `messages.read_at` timestamp
   - Batch mark-as-read endpoint

### Phase B: WebSocket real-time (future ticket — not this one)

Socket.io setup, `new_message` broadcast, typing indicators, and push notification coupling are a meaningful additional complexity and should be a separate follow-up ticket.

### Constraints

- No payment coupling — chat is purely coordination
- Message media (image/video upload) can be stubbed in this ticket — focus on text first
- Webhook/push transport for notifications is separate

## Out of Scope

- WebSocket / Socket.io implementation
- Typing indicators
- Multimedia message upload (stub the `media_url` field but don't wire Cloudinary yet)
- Push notification coupling
- Offline message queue
- Message search
- Message reactions or edits

## Suggested Files / Areas

- `backend/prisma/schema.prisma` — `chats` and `messages` models
- `backend/src/routes/chats.ts`
- `backend/src/routes/messages.ts`
- `backend/src/services/chatService.ts`
- `backend/src/services/messageService.ts`

## Acceptance Criteria

1. `chats` and `messages` tables exist in Prisma with proper indexes
2. Client or professional can fetch their chat list (`GET /chats`)
3. Chat list shows the other party's name/photo and `last_message_at`
4. User can fetch message history for a chat they belong to (`GET /chats/:id/messages`)
5. User can send a text message to a chat they belong to (`POST /chats/:id/messages`)
6. User can mark messages as read (`PATCH /chats/:id/messages/read`)
7. Chat auto-created when proposal is accepted (verify by checking a chat exists after accepting a proposal)
8. User cannot access a chat they are not a participant of (403)
9. Message send is rate-limited (max 20 messages per minute per user — use in-memory for now, Redis later if needed)

## Technical Notes

### Indexes required

```sql
-- chats
CREATE INDEX idx_chats_client_id ON chats(client_id);
CREATE INDEX idx_chats_professional_id ON chats(professional_id);
CREATE INDEX idx_chats_last_message_at ON chats(last_message_at DESC);
CREATE UNIQUE INDEX idx_chats_unique_pair ON chats(client_id, professional_id);

-- messages
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(chat_id, created_at DESC);
CREATE INDEX idx_messages_unread ON messages(chat_id, read) WHERE read = FALSE;
```

### Rate limiting stub

For now, an in-memory rate limiter is acceptable. Document that Redis-based sliding window needs to be added before production.

## Reference

- `docs/database/DataModel.md` — Sections 3.9 (chats) and 3.10 (messages)
- `docs/phases/fase-3/fase-3-spec.md` — historical reference for full WebSocket spec (do NOT implement payment-coupled features from this doc)
