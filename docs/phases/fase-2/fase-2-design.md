# Technical Design: Fase 2 - Posts & Proposals

**Change name:** `fase-2-posts-proposals`  
**Date:** March 22, 2026  
**Status:** Design  
**Author:** Technical Design Sub-Agent  
**Prerequisites:** Fase 1 (Auth + Profiles + PostGIS)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema Design](#2-database-schema-design)
3. [API Architecture](#3-api-architecture)
4. [Services Layer Design](#4-services-layer-design)
5. [Middleware Chain](#5-middleware-chain)
6. [Upload Flow Design](#6-upload-flow-design)
7. [Feed Algorithm](#7-feed-algorithm)
8. [Cronjob Implementation](#8-cronjob-implementation)
9. [Notification Strategy](#9-notification-strategy)
10. [Error Handling Strategy](#10-error-handling-strategy)
11. [Security Implementation](#11-security-implementation)
12. [Testing Strategy](#12-testing-strategy)
13. [Performance Optimizations](#13-performance-optimizations)
14. [Migration Plan](#14-migration-plan)

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        MobileApp[React Native App]
    end
    
    subgraph "API Layer"
        Gateway[Express Gateway]
        Auth[Auth Middleware]
        RateLimit[Rate Limiter]
        PostRoutes[Post Routes]
        ProposalRoutes[Proposal Routes]
        NotificationRoutes[Notification Routes]
    end
    
    subgraph "Service Layer"
        PostService[Post Service]
        ProposalService[Proposal Service]
        FeedService[Feed Service]
        UploadService[Upload Service]
        NotificationService[Notification Service]
        CronService[Cron Service]
    end
    
    subgraph "Data Layer"
        Prisma[Prisma ORM]
        PostgreSQL[(PostgreSQL + PostGIS)]
        Redis[(Redis Cache)]
    end
    
    subgraph "External Services"
        Cloudinary[Cloudinary Media Storage]
        FCM[Firebase Cloud Messaging]
        Nominatim[Nominatim Geocoding]
    end
    
    MobileApp -->|HTTP/JSON| Gateway
    Gateway --> Auth
    Auth --> RateLimit
    RateLimit --> PostRoutes
    RateLimit --> ProposalRoutes
    RateLimit --> NotificationRoutes
    
    PostRoutes --> PostService
    PostRoutes --> UploadService
    ProposalRoutes --> ProposalService
    NotificationRoutes --> NotificationService
    
    PostService --> FeedService
    ProposalService --> NotificationService
    
    PostService --> Prisma
    ProposalService --> Prisma
    FeedService --> Prisma
    NotificationService --> Prisma
    CronService --> Prisma
    
    Prisma --> PostgreSQL
    FeedService --> Redis
    
    UploadService --> Cloudinary
    NotificationService --> FCM
    PostService --> Nominatim
```

### 1.2 Component Responsibilities

| Component | Responsibility | Key Technologies |
|-----------|----------------|------------------|
| **Express Gateway** | HTTP routing, request parsing, error handling | Express.js, Multer |
| **Auth Middleware** | JWT validation, user context injection | jsonwebtoken |
| **Rate Limiter** | Abuse prevention (10 posts/day, 20 proposals/day) | express-rate-limit, Redis |
| **Post Service** | Post CRUD, validation, business logic | Prisma, PostGIS |
| **Proposal Service** | Proposal CRUD, acceptance workflow, transactional logic | Prisma transactions |
| **Feed Service** | Geo-filtered feed, cursor pagination | PostGIS ST_DWithin, Redis cache |
| **Upload Service** | Media upload, image resize, video validation | Multer, sharp, Cloudinary |
| **Notification Service** | FCM push, in-app notifications, event tracking | Firebase Admin SDK |
| **Cron Service** | Scheduled jobs (expiration, soft delete) | node-cron |
| **PostgreSQL + PostGIS** | Persistent storage, spatial queries | PostgreSQL 15+, PostGIS 3.3+ |
| **Redis** | Rate limiting counters, geocoding cache | Redis 7+ |

### 1.3 Data Flow Diagrams

#### Create Post with Media Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant G as Gateway
    participant M as Multer
    participant PS as PostService
    participant US as UploadService
    participant CL as Cloudinary
    participant DB as PostgreSQL
    participant NS as NotificationService
    
    C->>G: POST /api/posts (multipart/form-data)
    G->>M: Parse multipart (5 images + 2 videos)
    M->>M: Validate file types, sizes
    M->>G: Return parsed files + fields
    G->>PS: createPost(data, files)
    PS->>PS: Validate title, description, categories
    PS->>PS: Check rate limit (10 posts/day)
    
    loop For each file
        PS->>US: uploadPostMedia(file, userId, postId)
        US->>US: Resize image (if image) using sharp
        US->>CL: Upload to Cloudinary
        CL-->>US: Return media_url
    end
    
    PS->>DB: BEGIN TRANSACTION
    PS->>DB: INSERT INTO posts (...)
    PS->>DB: INSERT INTO post_categories (...)
    PS->>DB: INSERT INTO post_media (...)
    PS->>DB: COMMIT
    
    DB-->>PS: Post created with ID
    PS-->>G: Return post data
    G-->>C: 201 Created
```

#### Professional Feed Query Flow

```mermaid
sequenceDiagram
    participant P as Professional
    participant G as Gateway
    participant FS as FeedService
    participant RC as Redis Cache
    participant DB as PostgreSQL (PostGIS)
    
    P->>G: GET /api/posts?limit=20&cursor={...}
    G->>FS: getFeed(professionalId, cursor, limit)
    FS->>FS: Extract professional location (lat, lng)
    FS->>FS: Extract professional categories [1, 3]
    
    FS->>RC: Check cache key: feed:{profId}:{cursor}
    
    alt Cache HIT
        RC-->>FS: Return cached posts
    else Cache MISS
        FS->>DB: SELECT * FROM posts<br/>WHERE ST_DWithin(location, point, 30km)<br/>AND category_id IN (1, 3)<br/>AND status='open'<br/>ORDER BY created_at DESC, id DESC<br/>LIMIT 20
        DB-->>FS: Return 20 posts
        FS->>FS: Truncate lat/lng to 2 decimals
        FS->>RC: Cache result (TTL: 5 minutes)
    end
    
    FS-->>G: Return {posts, nextCursor, hasMore}
    G-->>P: 200 OK
```

#### Accept Proposal Transactional Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant G as Gateway
    participant ProS as ProposalService
    participant DB as PostgreSQL
    participant NS as NotificationService
    participant FCM as Firebase FCM
    
    C->>G: POST /api/proposals/1/accept
    G->>ProS: acceptProposal(proposalId, clientId)
    ProS->>DB: BEGIN TRANSACTION (SERIALIZABLE)
    
    ProS->>DB: SELECT * FROM posts<br/>WHERE id=postId<br/>FOR UPDATE
    DB-->>ProS: Post data (with lock)
    
    ProS->>ProS: Verify post.status='open'
    ProS->>ProS: Verify proposal.status='pending'
    
    ProS->>DB: UPDATE proposals<br/>SET status='accepted'<br/>WHERE id=proposalId
    
    ProS->>DB: UPDATE posts<br/>SET status='closed'<br/>WHERE id=postId
    
    ProS->>DB: UPDATE proposals<br/>SET status='rejected'<br/>WHERE post_id=postId<br/>AND id != proposalId<br/>AND status='pending'
    
    ProS->>DB: UPSERT chats<br/>(client_id, professional_id)
    
    ProS->>DB: COMMIT
    
    par Notify accepted professional
        ProS->>NS: sendProposalAccepted(proposalId)
        NS->>DB: INSERT INTO notifications (...)
        NS->>FCM: Send push "✅ Propuesta aceptada"
    and Notify rejected professionals
        ProS->>NS: sendProposalsRejected(rejectedIds[])
        loop For each rejected
            NS->>DB: INSERT INTO notifications (...)
            NS->>FCM: Send push "❌ Propuesta rechazada"
        end
    end
    
    ProS-->>G: Return {proposal, chat_id, rejected_count}
    G-->>C: 200 OK
```

---

## 2. Database Schema Design

### 2.1 Prisma Schema (Full Fase 2 Models)

```prisma
// prisma/schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [postgis]
}

// ============================================
// FASE 1 MODELS (Already Implemented)
// ============================================

model User {
  id                 Int            @id @default(autoincrement())
  fullName           String         @map("full_name") @db.VarChar(100)
  email              String         @unique @db.VarChar(255)
  passwordHash       String         @map("password_hash") @db.VarChar(255)
  phoneNumber        String         @map("phone_number") @db.VarChar(20)
  profilePhotoUrl    String?        @map("profile_photo_url") @db.VarChar(500)
  role               String         @db.VarChar(20) // 'client' | 'professional'
  latitude           Decimal        @db.Decimal(10, 8)
  longitude          Decimal        @db.Decimal(11, 8)
  // location GEOGRAPHY(POINT, 4326) added via raw SQL
  fcmToken           String?        @map("fcm_token") @db.VarChar(500)
  emailVerified      Boolean        @default(false) @map("email_verified")
  createdAt          DateTime       @default(now()) @map("created_at") @db.Timestamptz
  updatedAt          DateTime       @updatedAt @map("updated_at") @db.Timestamptz
  
  // Fase 1 relations
  professional       Professional?
  refreshTokens      RefreshToken[]
  
  // Fase 2 relations (NEW)
  posts              Post[]         @relation("UserPosts")
  clientChats        Chat[]         @relation("ClientChats")
  professionalChats  Chat[]         @relation("ProfessionalChats")
  notifications      Notification[]

  @@index([email])
  @@index([role])
  @@map("users")
}

model Professional {
  id              Int       @id @default(autoincrement())
  userId          Int       @unique @map("user_id")
  yearsExperience Int       @map("years_experience")
  description     String?   @db.Text
  rating          Decimal?  @db.Decimal(3, 2) // 0.00 - 5.00
  ratingCount     Int       @default(0) @map("rating_count")
  verified        Boolean   @default(false)
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  categories      ProfessionalCategory[]
  certifications  Certification[]
  
  // Fase 2 relations (NEW)
  proposals       Proposal[]

  @@index([userId])
  @@map("professionals")
}

model Category {
  id          Int       @id @default(autoincrement())
  name        String    @db.VarChar(50)
  slug        String    @unique @db.VarChar(50)
  icon        String    @db.VarChar(10) // Emoji
  description String?   @db.Text
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz
  
  professionals ProfessionalCategory[]
  
  // Fase 2 relations (NEW)
  posts         PostCategory[]

  @@map("categories")
}

model ProfessionalCategory {
  professionalId Int @map("professional_id")
  categoryId     Int @map("category_id")
  
  professional   Professional @relation(fields: [professionalId], references: [id], onDelete: Cascade)
  category       Category     @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  
  @@id([professionalId, categoryId])
  @@index([professionalId])
  @@index([categoryId])
  @@map("professional_categories")
}

// ... (RefreshToken, Certification models omitted for brevity)

// ============================================
// FASE 2 MODELS (NEW)
// ============================================

model Post {
  id          Int       @id @default(autoincrement())
  userId      Int       @map("user_id")
  title       String    @db.VarChar(100)
  description String    @db.Text
  latitude    Decimal   @db.Decimal(10, 8)
  longitude   Decimal   @db.Decimal(11, 8)
  // location GEOGRAPHY(POINT, 4326) added via raw SQL + trigger
  status      String    @db.VarChar(20) @default("open") // 'open' | 'closed' | 'expired' | 'completed'
  expiresAt   DateTime  @map("expires_at") @db.Timestamptz
  deletedAt   DateTime? @map("deleted_at") @db.Timestamptz
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  
  user        User              @relation("UserPosts", fields: [userId], references: [id], onDelete: Cascade)
  categories  PostCategory[]
  media       PostMedia[]
  proposals   Proposal[]
  
  @@index([userId])
  @@index([status, expiresAt])
  @@index([createdAt(sort: Desc), id(sort: Desc)]) // Cursor pagination
  @@index([deletedAt]) // Soft delete queries
  @@map("posts")
}

model PostCategory {
  postId     Int @map("post_id")
  categoryId Int @map("category_id")
  
  post       Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  
  @@id([postId, categoryId])
  @@index([postId])
  @@index([categoryId])
  @@map("post_categories")
}

model PostMedia {
  id        Int      @id @default(autoincrement())
  postId    Int      @map("post_id")
  mediaType String   @map("media_type") @db.VarChar(10) // 'image' | 'video'
  mediaUrl  String   @map("media_url") @db.VarChar(500)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  
  @@index([postId])
  @@map("post_media")
}

model Proposal {
  id             Int      @id @default(autoincrement())
  postId         Int      @map("post_id")
  professionalId Int      @map("professional_id")
  price          Decimal  @db.Decimal(10, 2) // ARS 500.00 - 100000.00
  description    String   @db.Text
  scheduledDate  DateTime @map("scheduled_date") @db.Date
  scheduledTime String   @map("scheduled_time") @db.VarChar(5) // "HH:MM"
  status         String   @db.VarChar(20) @default("pending") // 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled'
  expiresAt      DateTime @map("expires_at") @db.Timestamptz
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz
  
  post           Post         @relation(fields: [postId], references: [id], onDelete: Cascade)
  professional   Professional @relation(fields: [professionalId], references: [id], onDelete: Restrict)
  
  @@index([postId, status])
  @@index([professionalId, createdAt(sort: Desc)])
  @@index([status, expiresAt]) // Cronjob expiration
  @@unique([professionalId, postId], name: "unique_professional_post_proposal")
  @@map("proposals")
}

model Chat {
  id             Int       @id @default(autoincrement())
  clientId       Int       @map("client_id")
  professionalId Int       @map("professional_id")
  lastMessageAt  DateTime? @map("last_message_at") @db.Timestamptz
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  
  client         User      @relation("ClientChats", fields: [clientId], references: [id], onDelete: Cascade)
  professional   User      @relation("ProfessionalChats", fields: [professionalId], references: [id], onDelete: Cascade)
  
  @@unique([clientId, professionalId])
  @@index([clientId])
  @@index([professionalId])
  @@index([lastMessageAt(sort: Desc)])
  @@map("chats")
}

model Notification {
  id      Int      @id @default(autoincrement())
  userId  Int      @map("user_id")
  type    String   @db.VarChar(50) // 'new_proposal' | 'proposal_accepted' | 'proposal_rejected' | 'post_expiring' | 'proposal_expiring'
  title   String   @db.VarChar(100)
  body    String   @db.Text
  data    Json?    // { proposalId, postId, ... }
  read    Boolean  @default(false)
  sentAt  DateTime @default(now()) @map("sent_at") @db.Timestamptz
  
  user    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, read, sentAt(sort: Desc)]) // Fetch unread first
  @@map("notifications")
}
```

### 2.2 Raw SQL Extensions (PostGIS)

```sql
-- migrations/YYYYMMDDHHMMSS_add_post_location_postgis.sql

-- Add PostGIS GEOGRAPHY column to posts table
ALTER TABLE posts ADD COLUMN location GEOGRAPHY(POINT, 4326);

-- Create trigger function to sync location with lat/lng
CREATE OR REPLACE FUNCTION update_post_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(
    ST_MakePoint(NEW.longitude::float, NEW.latitude::float), 
    4326
  )::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update location on INSERT/UPDATE
CREATE TRIGGER trigger_update_post_location
BEFORE INSERT OR UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION update_post_location();

-- Create spatial index (GIST) on location
CREATE INDEX idx_posts_location ON posts USING GIST(location);

-- Create composite index for feed queries
CREATE INDEX idx_posts_feed_query 
ON posts(status, expires_at, created_at DESC, id DESC) 
WHERE deleted_at IS NULL;

-- Create constraint for valid post status
ALTER TABLE posts ADD CONSTRAINT chk_post_status 
CHECK (status IN ('open', 'closed', 'expired', 'completed'));

-- Create constraint for valid proposal status
ALTER TABLE proposals ADD CONSTRAINT chk_proposal_status 
CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled'));

-- Create constraint for reasonable proposal price
ALTER TABLE proposals ADD CONSTRAINT chk_proposal_price 
CHECK (price >= 500 AND price <= 100000);

-- Create constraint for valid media type
ALTER TABLE post_media ADD CONSTRAINT chk_media_type 
CHECK (media_type IN ('image', 'video'));
```

### 2.3 Database Indexes Strategy

| Index | Purpose | Impact | Query Example |
|-------|---------|--------|---------------|
| `idx_posts_location` (GIST) | Geo-queries <30km | -90% latency | `WHERE ST_DWithin(location, point, 30000)` |
| `idx_posts_feed_query` | Professional feed | -80% latency | `WHERE status='open' AND expires_at > NOW()` |
| `idx_posts_created_id` | Cursor pagination | -70% latency | `ORDER BY created_at DESC, id DESC` |
| `idx_post_categories_category` | Category filtering | -60% latency | `JOIN post_categories WHERE category_id IN (...)` |
| `idx_proposals_post_status` | Fetch post proposals | -75% latency | `WHERE post_id=1 AND status='pending'` |
| `idx_proposals_professional_created` | Professional history | -70% latency | `WHERE professional_id=1 ORDER BY created_at DESC` |
| `idx_notifications_user_read_sent` | Unread notifications | -80% latency | `WHERE user_id=1 AND read=false ORDER BY sent_at DESC` |

**Index maintenance:**
- `REINDEX INDEX idx_posts_location` weekly (spatial index fragmentation)
- `ANALYZE posts, proposals, notifications` after bulk inserts (cronjobs)

---

## 3. API Architecture

### 3.1 Folder Structure

```
src/
├── controllers/
│   ├── post.controller.ts         # Post CRUD endpoints
│   ├── proposal.controller.ts     # Proposal CRUD + accept/reject
│   └── notification.controller.ts # Notification endpoints
├── services/
│   ├── post.service.ts            # Post business logic
│   ├── proposal.service.ts        # Proposal business logic
│   ├── feed.service.ts            # Feed geo-queries + pagination
│   ├── upload.service.ts          # Media upload (extend Fase 1)
│   ├── notification.service.ts    # FCM + in-app (extend Fase 1)
│   └── cron.service.ts            # Scheduled jobs
├── middleware/
│   ├── requireAuth.ts             # JWT validation (Fase 1)
│   ├── requireClient.ts           # Only clients (NEW)
│   ├── requireProfessional.ts     # Only professionals (Fase 1, extend)
│   ├── requirePostOwnership.ts    # Only post owner (NEW)
│   ├── requireProposalOwnership.ts # Only proposal owner (NEW)
│   └── postRateLimiter.ts         # 10 posts/day (NEW)
├── routes/
│   ├── posts.routes.ts            # POST/GET/PATCH/DELETE /api/posts
│   ├── proposals.routes.ts        # POST/GET/PATCH /api/proposals
│   └── notifications.routes.ts    # GET/PATCH /api/notifications
├── validators/
│   ├── post.validator.ts          # Zod schemas for posts
│   ├── proposal.validator.ts      # Zod schemas for proposals
│   └── media.validator.ts         # File type/size validation
├── config/
│   ├── multer.config.ts           # Multer storage + limits
│   ├── cloudinary.config.ts       # Cloudinary setup (Fase 1)
│   └── constants.ts               # Price limits, rate limits, etc.
├── utils/
│   ├── cursorPagination.ts        # Cursor encode/decode
│   ├── coordinateTruncate.ts      # Privacy: truncate lat/lng
│   └── errorHandler.ts            # Global error handler (Fase 1)
└── jobs/
    ├── expirePostsAndProposals.ts # Cronjob: expire 48hs
    ├── softDeleteOldPosts.ts      # Cronjob: soft delete 90 days
    └── hardDeletePosts.ts         # Cronjob: hard delete 180 days
```

### 3.2 Route Definitions

```typescript
// src/routes/posts.routes.ts
import { Router } from 'express';
import { upload } from '@/config/multer.config';
import { requireAuth } from '@/middleware/requireAuth';
import { requireClient } from '@/middleware/requireClient';
import { requireProfessional } from '@/middleware/requireProfessional';
import { requirePostOwnership } from '@/middleware/requirePostOwnership';
import { postRateLimiter } from '@/middleware/postRateLimiter';
import * as PostController from '@/controllers/post.controller';

const router = Router();

// Professional feed (geo-filtered, paginated)
router.get(
  '/',
  requireAuth,
  requireProfessional,
  PostController.getFeed
);

// Client's own posts (history)
router.get(
  '/me',
  requireAuth,
  requireClient,
  PostController.getMyPosts
);

// Create post with media
router.post(
  '/',
  requireAuth,
  requireClient,
  postRateLimiter, // Max 10 posts/day
  upload.array('media', 7), // Max 5 images + 2 videos
  PostController.createPost
);

// Get post detail
router.get(
  '/:id',
  requireAuth,
  PostController.getPostById
);

// Update post (owner only, 0 proposals)
router.patch(
  '/:id',
  requireAuth,
  requirePostOwnership,
  PostController.updatePost
);

// Close post manually (owner only)
router.delete(
  '/:id',
  requireAuth,
  requirePostOwnership,
  PostController.closePost
);

// Get proposals for post (owner only)
router.get(
  '/:postId/proposals',
  requireAuth,
  requirePostOwnership,
  PostController.getPostProposals
);

export default router;
```

```typescript
// src/routes/proposals.routes.ts
import { Router } from 'express';
import { requireAuth } from '@/middleware/requireAuth';
import { requireProfessional } from '@/middleware/requireProfessional';
import { requireProposalOwnership } from '@/middleware/requireProposalOwnership';
import { proposalRateLimiter } from '@/middleware/proposalRateLimiter';
import * as ProposalController from '@/controllers/proposal.controller';

const router = Router();

// Professional's own proposals (history)
router.get(
  '/me',
  requireAuth,
  requireProfessional,
  ProposalController.getMyProposals
);

// Create proposal
router.post(
  '/',
  requireAuth,
  requireProfessional,
  proposalRateLimiter, // Max 20 proposals/day
  ProposalController.createProposal
);

// Get proposal detail
router.get(
  '/:id',
  requireAuth,
  ProposalController.getProposalById
);

// Update proposal (owner only, pending only)
router.patch(
  '/:id',
  requireAuth,
  requireProposalOwnership,
  ProposalController.updateProposal
);

// Accept proposal (post owner only)
router.post(
  '/:id/accept',
  requireAuth,
  ProposalController.acceptProposal
);

// Reject proposal (post owner only)
router.post(
  '/:id/reject',
  requireAuth,
  ProposalController.rejectProposal
);

export default router;
```

```typescript
// src/routes/notifications.routes.ts
import { Router } from 'express';
import { requireAuth } from '@/middleware/requireAuth';
import * as NotificationController from '@/controllers/notification.controller';

const router = Router();

// Get user's notifications (unread first)
router.get(
  '/',
  requireAuth,
  NotificationController.getNotifications
);

// Mark notification as read
router.patch(
  '/:id/read',
  requireAuth,
  NotificationController.markAsRead
);

// Mark all notifications as read
router.patch(
  '/read-all',
  requireAuth,
  NotificationController.markAllAsRead
);

export default router;
```

---

## 4. Services Layer Design

### 4.1 Post Service

```typescript
// src/services/post.service.ts
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { uploadService } from './upload.service';
import { AppError } from '@/utils/errors';

interface CreatePostData {
  title: string;
  description: string;
  categoryIds: number[];
  useProfileLocation: boolean;
  customAddress?: string;
  latitude?: number;
  longitude?: number;
}

export class PostService {
  /**
   * Create a new post with media
   */
  async createPost(
    userId: number,
    data: CreatePostData,
    files: Express.Multer.File[]
  ) {
    // Validate categories exist
    const categories = await prisma.category.findMany({
      where: { id: { in: data.categoryIds } },
    });
    
    if (categories.length !== data.categoryIds.length) {
      const invalidIds = data.categoryIds.filter(
        id => !categories.some(cat => cat.id === id)
      );
      throw new AppError(400, `Invalid category IDs: ${invalidIds.join(', ')}`);
    }
    
    // Get location (profile or custom address)
    let latitude: number, longitude: number;
    
    if (data.useProfileLocation) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { latitude: true, longitude: true },
      });
      latitude = Number(user!.latitude);
      longitude = Number(user!.longitude);
    } else {
      // Geocode custom address (reuse Fase 1 geocoding service)
      const coords = await this.geocodeAddress(data.customAddress!);
      latitude = coords.latitude;
      longitude = coords.longitude;
    }
    
    // Validate media count
    const images = files.filter(f => f.mimetype.startsWith('image/'));
    const videos = files.filter(f => f.mimetype.startsWith('video/'));
    
    if (images.length > 5) {
      throw new AppError(400, 'Maximum 5 images allowed');
    }
    if (videos.length > 2) {
      throw new AppError(400, 'Maximum 2 videos allowed');
    }
    
    // Create post in transaction
    const post = await prisma.$transaction(async (tx) => {
      // Create post
      const newPost = await tx.post.create({
        data: {
          userId,
          title: data.title,
          description: data.description,
          latitude,
          longitude,
          status: 'open',
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
        },
      });
      
      // Link categories
      await tx.postCategory.createMany({
        data: data.categoryIds.map(categoryId => ({
          postId: newPost.id,
          categoryId,
        })),
      });
      
      // Upload media sequentially (parallel would risk Cloudinary rate limit)
      const mediaUrls: { type: string; url: string }[] = [];
      
      for (const file of files) {
        const mediaType = file.mimetype.startsWith('image/') ? 'image' : 'video';
        
        try {
          const mediaUrl = await uploadService.uploadPostMedia(
            file,
            userId,
            newPost.id
          );
          
          mediaUrls.push({ type: mediaType, url: mediaUrl });
        } catch (error) {
          // If upload fails, rollback transaction
          throw new AppError(
            504,
            'Media upload timeout. Please use smaller files.'
          );
        }
      }
      
      // Create media records
      if (mediaUrls.length > 0) {
        await tx.postMedia.createMany({
          data: mediaUrls.map(({ type, url }) => ({
            postId: newPost.id,
            mediaType: type,
            mediaUrl: url,
          })),
        });
      }
      
      return newPost;
    });
    
    // Return full post with relations
    return this.getPostById(post.id, userId);
  }
  
  /**
   * Get post by ID with access control
   */
  async getPostById(postId: number, requesterId: number) {
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        deletedAt: null, // Exclude soft-deleted
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            profilePhotoUrl: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
        media: {
          orderBy: { createdAt: 'asc' },
        },
        proposals: {
          where: {
            status: { in: ['pending', 'accepted', 'rejected'] },
          },
          select: { id: true },
        },
      },
    });
    
    if (!post) {
      throw new AppError(404, 'Post not found');
    }
    
    const isOwner = post.userId === requesterId;
    
    // Check if requester has accepted proposal
    const hasAcceptedProposal = await prisma.proposal.findFirst({
      where: {
        postId: post.id,
        professional: {
          userId: requesterId,
        },
        status: 'accepted',
      },
    });
    
    // Truncate coordinates for privacy (unless owner or accepted professional)
    const showExactLocation = isOwner || !!hasAcceptedProposal;
    
    return {
      id: post.id,
      title: post.title,
      description: post.description,
      status: post.status,
      latitude: showExactLocation
        ? Number(post.latitude)
        : this.truncateCoordinate(Number(post.latitude)),
      longitude: showExactLocation
        ? Number(post.longitude)
        : this.truncateCoordinate(Number(post.longitude)),
      categories: post.categories.map(pc => pc.category),
      media: post.media,
      proposalsCount: isOwner ? post.proposals.length : undefined,
      expiresAt: post.expiresAt,
      createdAt: post.createdAt,
      owner: isOwner,
    };
  }
  
  /**
   * Update post (owner only, 0 proposals)
   */
  async updatePost(
    postId: number,
    userId: number,
    data: Partial<CreatePostData>
  ) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        proposals: {
          where: {
            status: { in: ['pending', 'accepted', 'rejected'] },
          },
        },
      },
    });
    
    if (!post) {
      throw new AppError(404, 'Post not found');
    }
    
    if (post.userId !== userId) {
      throw new AppError(403, 'You can only edit your own posts');
    }
    
    if (post.status !== 'open') {
      throw new AppError(400, 'Cannot edit closed post');
    }
    
    if (post.proposals.length > 0) {
      throw new AppError(
        400,
        'Cannot edit post with existing proposals. Close this post and create a new one.'
      );
    }
    
    // Update post
    const updated = await prisma.post.update({
      where: { id: postId },
      data: {
        title: data.title,
        description: data.description,
      },
    });
    
    // Update categories if provided
    if (data.categoryIds) {
      await prisma.postCategory.deleteMany({
        where: { postId },
      });
      
      await prisma.postCategory.createMany({
        data: data.categoryIds.map(categoryId => ({
          postId,
          categoryId,
        })),
      });
    }
    
    return this.getPostById(postId, userId);
  }
  
  /**
   * Close post manually (owner only)
   */
  async closePost(postId: number, userId: number) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });
    
    if (!post) {
      throw new AppError(404, 'Post not found');
    }
    
    if (post.userId !== userId) {
      throw new AppError(403, 'You can only close your own posts');
    }
    
    // Close post and reject pending proposals
    const result = await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: postId },
        data: { status: 'closed' },
      });
      
      const rejectedCount = await tx.proposal.updateMany({
        where: {
          postId,
          status: 'pending',
        },
        data: { status: 'rejected' },
      });
      
      return rejectedCount.count;
    });
    
    return {
      message: 'Post closed successfully',
      rejectedProposals: result,
    };
  }
  
  /**
   * Get client's own posts (history)
   */
  async getMyPosts(userId: number, cursor?: string, limit: number = 20) {
    const decodedCursor = cursor ? this.decodeCursor(cursor) : null;
    
    const posts = await prisma.post.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(decodedCursor && {
          OR: [
            { createdAt: { lt: decodedCursor.createdAt } },
            {
              createdAt: decodedCursor.createdAt,
              id: { lt: decodedCursor.id },
            },
          ],
        }),
      },
      include: {
        proposals: {
          select: { id: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1, // Fetch one extra to check if there are more
    });
    
    const hasMore = posts.length > limit;
    const results = hasMore ? posts.slice(0, -1) : posts;
    
    const nextCursor = hasMore
      ? this.encodeCursor({
          createdAt: results[results.length - 1].createdAt,
          id: results[results.length - 1].id,
        })
      : null;
    
    return {
      posts: results.map(post => ({
        id: post.id,
        title: post.title,
        status: post.status,
        proposalsCount: post.proposals.length,
        expiresAt: post.expiresAt,
        createdAt: post.createdAt,
      })),
      nextCursor,
      hasMore,
    };
  }
  
  /**
   * Truncate coordinate to 2 decimals (±1km precision)
   */
  private truncateCoordinate(coord: number): number {
    return Math.round(coord * 100) / 100;
  }
  
  /**
   * Encode cursor for pagination
   */
  private encodeCursor(data: { createdAt: Date; id: number }): string {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }
  
  /**
   * Decode cursor for pagination
   */
  private decodeCursor(cursor: string): { createdAt: Date; id: number } {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
    return {
      createdAt: new Date(decoded.createdAt),
      id: decoded.id,
    };
  }
  
  /**
   * Geocode address (reuse Fase 1 geocoding service)
   */
  private async geocodeAddress(address: string): Promise<{
    latitude: number;
    longitude: number;
  }> {
    // Implementation reuses Fase 1 GeocodingService
    // (Nominatim → Google fallback → Redis cache)
    throw new Error('Not implemented - reuse Fase 1 GeocodingService');
  }
}

export const postService = new PostService();
```

### 4.2 Proposal Service

```typescript
// src/services/proposal.service.ts
import { prisma } from '@/lib/prisma';
import { AppError } from '@/utils/errors';
import { notificationService } from './notification.service';

interface CreateProposalData {
  postId: number;
  price: number;
  description: string;
  scheduledDate: string;
  scheduledTime: string;
}

export class ProposalService {
  /**
   * Create proposal (professional only)
   */
  async createProposal(professionalId: number, data: CreateProposalData) {
    // Verify post exists and is open
    const post = await prisma.post.findFirst({
      where: {
        id: data.postId,
        status: 'open',
        deletedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: { id: true, fullName: true, fcmToken: true },
        },
      },
    });
    
    if (!post) {
      throw new AppError(400, 'Post not found, closed, or expired');
    }
    
    // Get professional data
    const professional = await prisma.professional.findFirst({
      where: {
        id: professionalId,
      },
      include: {
        user: {
          select: { id: true, fullName: true, profilePhotoUrl: true },
        },
      },
    });
    
    if (!professional) {
      throw new AppError(404, 'Professional not found');
    }
    
    // Check if professional already sent proposal
    const existingProposal = await prisma.proposal.findFirst({
      where: {
        professionalId,
        postId: data.postId,
        status: { in: ['pending', 'accepted'] },
      },
    });
    
    if (existingProposal) {
      throw new AppError(
        409,
        'You already sent a proposal to this post. Edit it in the chat.'
      );
    }
    
    // Validate scheduled date is future (>2 hours from now)
    const scheduledDateTime = new Date(`${data.scheduledDate}T${data.scheduledTime}`);
    const minScheduledTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    
    if (scheduledDateTime < minScheduledTime) {
      throw new AppError(
        400,
        'Scheduled date must be at least 2 hours in the future'
      );
    }
    
    // Create proposal + chat in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create proposal
      const proposal = await tx.proposal.create({
        data: {
          postId: data.postId,
          professionalId,
          price: data.price,
          description: data.description,
          scheduledDate: data.scheduledDate,
          scheduledTime: data.scheduledTime,
          status: 'pending',
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
        },
      });
      
      // Upsert chat (create or update last_message_at)
      await tx.chat.upsert({
        where: {
          clientId_professionalId: {
            clientId: post.user.id,
            professionalId: professional.user.id,
          },
        },
        create: {
          clientId: post.user.id,
          professionalId: professional.user.id,
          lastMessageAt: new Date(),
        },
        update: {
          lastMessageAt: new Date(),
        },
      });
      
      return proposal;
    });
    
    // Send notification to post owner (async, non-blocking)
    notificationService.sendNewProposalNotification(
      result.id,
      post.user.id,
      post.user.fullName,
      professional.user.fullName,
      data.price,
      post.user.fcmToken
    ).catch(err => {
      console.error('Failed to send new proposal notification:', err);
      // Don't fail the proposal creation if notification fails
    });
    
    return this.getProposalById(result.id, professional.user.id);
  }
  
  /**
   * Update proposal (professional owner only, pending only)
   */
  async updateProposal(
    proposalId: number,
    professionalId: number,
    data: Partial<CreateProposalData>
  ) {
    const proposal = await prisma.proposal.findFirst({
      where: {
        id: proposalId,
        professionalId,
      },
      include: {
        post: {
          include: {
            user: {
              select: { id: true, fullName: true, fcmToken: true },
            },
          },
        },
        professional: {
          include: {
            user: {
              select: { fullName: true },
            },
          },
        },
      },
    });
    
    if (!proposal) {
      throw new AppError(404, 'Proposal not found');
    }
    
    if (proposal.status !== 'pending') {
      throw new AppError(
        400,
        'Cannot update accepted or rejected proposal. Negotiate in chat.'
      );
    }
    
    // Update proposal
    const updated = await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        price: data.price,
        description: data.description,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
      },
    });
    
    // Notify post owner of update
    notificationService.sendProposalUpdatedNotification(
      proposalId,
      proposal.post.user.id,
      proposal.professional.user.fullName,
      data.price || Number(proposal.price),
      proposal.post.user.fcmToken
    ).catch(err => {
      console.error('Failed to send proposal updated notification:', err);
    });
    
    return this.getProposalById(proposalId, professionalId);
  }
  
  /**
   * Accept proposal (post owner only) - TRANSACTIONAL
   */
  async acceptProposal(proposalId: number, clientId: number) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        post: {
          include: {
            user: { select: { id: true } },
          },
        },
        professional: {
          include: {
            user: {
              select: { id: true, fullName: true, fcmToken: true },
            },
          },
        },
      },
    });
    
    if (!proposal) {
      throw new AppError(404, 'Proposal not found');
    }
    
    if (proposal.post.user.id !== clientId) {
      throw new AppError(403, 'Only post owner can accept proposals');
    }
    
    if (proposal.status !== 'pending') {
      throw new AppError(400, 'Proposal already processed');
    }
    
    if (proposal.post.status !== 'open') {
      throw new AppError(400, 'Post is already closed');
    }
    
    // Execute atomic transaction with row-level locks
    const result = await prisma.$transaction(
      async (tx) => {
        // Lock post row (prevent race conditions)
        const lockedPost = await tx.post.findUnique({
          where: { id: proposal.postId },
        });
        
        if (lockedPost!.status !== 'open') {
          throw new AppError(409, 'Post is already closed');
        }
        
        // 1. Accept proposal
        await tx.proposal.update({
          where: { id: proposalId },
          data: { status: 'accepted' },
        });
        
        // 2. Close post
        await tx.post.update({
          where: { id: proposal.postId },
          data: { status: 'closed' },
        });
        
        // 3. Reject all other pending proposals
        const rejectedResult = await tx.proposal.updateMany({
          where: {
            postId: proposal.postId,
            id: { not: proposalId },
            status: 'pending',
          },
          data: { status: 'rejected' },
        });
        
        // 4. Get chat ID (should already exist from proposal creation)
        const chat = await tx.chat.findUnique({
          where: {
            clientId_professionalId: {
              clientId: proposal.post.user.id,
              professionalId: proposal.professional.user.id,
            },
          },
        });
        
        return {
          rejectedCount: rejectedResult.count,
          chatId: chat!.id,
        };
      },
      {
        isolationLevel: 'Serializable', // Prevent race conditions
      }
    );
    
    // Send notifications (async)
    Promise.all([
      // Notify accepted professional
      notificationService.sendProposalAcceptedNotification(
        proposalId,
        proposal.professional.user.id,
        proposal.professional.user.fullName,
        proposal.professional.user.fcmToken
      ),
      
      // Notify rejected professionals
      this.notifyRejectedProposals(proposal.postId, proposalId),
    ]).catch(err => {
      console.error('Failed to send acceptance notifications:', err);
    });
    
    return {
      proposal: {
        id: proposalId,
        status: 'accepted',
        post: { id: proposal.postId, status: 'closed' },
      },
      chatId: result.chatId,
      rejectedProposals: result.rejectedCount,
    };
  }
  
  /**
   * Reject proposal (post owner only)
   */
  async rejectProposal(proposalId: number, clientId: number) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        post: {
          include: {
            user: { select: { id: true } },
          },
        },
        professional: {
          include: {
            user: {
              select: { id: true, fullName: true, fcmToken: true },
            },
          },
        },
      },
    });
    
    if (!proposal) {
      throw new AppError(404, 'Proposal not found');
    }
    
    if (proposal.post.user.id !== clientId) {
      throw new AppError(403, 'Only post owner can reject proposals');
    }
    
    if (proposal.status === 'accepted') {
      throw new AppError(
        400,
        'Cannot reject accepted proposal. Contact support to cancel job.'
      );
    }
    
    // Idempotent: if already rejected, return success
    if (proposal.status === 'rejected') {
      return { proposal: { id: proposalId, status: 'rejected' } };
    }
    
    // Reject proposal
    await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: 'rejected' },
    });
    
    // Notify professional
    notificationService.sendProposalRejectedNotification(
      proposalId,
      proposal.professional.user.id,
      proposal.professional.user.fullName,
      proposal.professional.user.fcmToken
    ).catch(err => {
      console.error('Failed to send rejection notification:', err);
    });
    
    return { proposal: { id: proposalId, status: 'rejected' } };
  }
  
  /**
   * Get proposal by ID
   */
  async getProposalById(proposalId: number, requesterId: number) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        post: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                profilePhotoUrl: true,
              },
            },
          },
        },
        professional: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                profilePhotoUrl: true,
              },
            },
          },
        },
      },
    });
    
    if (!proposal) {
      throw new AppError(404, 'Proposal not found');
    }
    
    return {
      id: proposal.id,
      postId: proposal.postId,
      post: {
        id: proposal.post.id,
        title: proposal.post.title,
        status: proposal.post.status,
        client: proposal.post.user,
      },
      professional: {
        id: proposal.professional.id,
        fullName: proposal.professional.user.fullName,
        profilePhotoUrl: proposal.professional.user.profilePhotoUrl,
        rating: proposal.professional.rating
          ? Number(proposal.professional.rating)
          : null,
        ratingCount: proposal.professional.ratingCount,
        yearsExperience: proposal.professional.yearsExperience,
      },
      price: Number(proposal.price),
      description: proposal.description,
      scheduledDate: proposal.scheduledDate,
      scheduledTime: proposal.scheduledTime,
      status: proposal.status,
      expiresAt: proposal.expiresAt,
      createdAt: proposal.createdAt,
    };
  }
  
  /**
   * Get professional's own proposals (history)
   */
  async getMyProposals(
    professionalId: number,
    cursor?: string,
    limit: number = 20
  ) {
    const decodedCursor = cursor ? this.decodeCursor(cursor) : null;
    
    const proposals = await prisma.proposal.findMany({
      where: {
        professionalId,
        ...(decodedCursor && {
          OR: [
            { createdAt: { lt: decodedCursor.createdAt } },
            {
              createdAt: decodedCursor.createdAt,
              id: { lt: decodedCursor.id },
            },
          ],
        }),
      },
      include: {
        post: {
          include: {
            user: {
              select: {
                fullName: true,
                profilePhotoUrl: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    
    const hasMore = proposals.length > limit;
    const results = hasMore ? proposals.slice(0, -1) : proposals;
    
    const nextCursor = hasMore
      ? this.encodeCursor({
          createdAt: results[results.length - 1].createdAt,
          id: results[results.length - 1].id,
        })
      : null;
    
    return {
      proposals: results.map(proposal => ({
        id: proposal.id,
        post: {
          id: proposal.post.id,
          title: proposal.post.title,
          status: proposal.post.status,
          client: proposal.post.user,
        },
        price: Number(proposal.price),
        status: proposal.status,
        scheduledDate: proposal.scheduledDate,
        createdAt: proposal.createdAt,
      })),
      nextCursor,
      hasMore,
    };
  }
  
  /**
   * Notify rejected professionals when another proposal is accepted
   */
  private async notifyRejectedProposals(postId: number, acceptedProposalId: number) {
    const rejectedProposals = await prisma.proposal.findMany({
      where: {
        postId,
        id: { not: acceptedProposalId },
        status: 'rejected',
      },
      include: {
        professional: {
          include: {
            user: {
              select: { id: true, fullName: true, fcmToken: true },
            },
          },
        },
      },
    });
    
    for (const proposal of rejectedProposals) {
      await notificationService.sendProposalRejectedNotification(
        proposal.id,
        proposal.professional.user.id,
        proposal.professional.user.fullName,
        proposal.professional.user.fcmToken
      );
    }
  }
  
  private encodeCursor(data: { createdAt: Date; id: number }): string {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }
  
  private decodeCursor(cursor: string): { createdAt: Date; id: number } {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
    return {
      createdAt: new Date(decoded.createdAt),
      id: decoded.id,
    };
  }
}

export const proposalService = new ProposalService();
```

### 4.3 Feed Service (PostGIS Geo-Queries)

```typescript
// src/services/feed.service.ts
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { redisClient } from '@/lib/redis';

interface FeedFilters {
  professionalId: number;
  latitude: number;
  longitude: number;
  categoryIds: number[];
  radiusKm?: number; // Default: 30
  cursor?: string;
  limit?: number; // Default: 20
}

export class FeedService {
  /**
   * Get geo-filtered feed for professional
   */
  async getFeed(filters: FeedFilters) {
    const radiusMeters = (filters.radiusKm || 30) * 1000; // Convert km to meters
    const limit = filters.limit || 20;
    const cursor = filters.cursor ? this.decodeCursor(filters.cursor) : null;
    
    // Check Redis cache (TTL: 5 minutes)
    const cacheKey = this.generateCacheKey(filters);
    const cached = await this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    // Build raw PostGIS query (Prisma doesn't support ST_DWithin natively)
    const query = Prisma.sql`
      SELECT 
        p.id,
        p.title,
        p.description,
        p.status,
        p.latitude,
        p.longitude,
        p.expires_at,
        p.created_at,
        ST_Distance(
          p.location,
          ST_SetSRID(ST_MakePoint(${filters.longitude}, ${filters.latitude}), 4326)::geography
        ) / 1000 AS distance_km
      FROM posts p
      WHERE p.status = 'open'
        AND p.deleted_at IS NULL
        AND p.expires_at > NOW()
        AND ST_DWithin(
          p.location,
          ST_SetSRID(ST_MakePoint(${filters.longitude}, ${filters.latitude}), 4326)::geography,
          ${radiusMeters}
        )
        AND EXISTS (
          SELECT 1 FROM post_categories pc
          WHERE pc.post_id = p.id
            AND pc.category_id = ANY(${filters.categoryIds})
        )
        ${cursor ? Prisma.sql`
          AND (
            p.created_at < ${cursor.createdAt}
            OR (p.created_at = ${cursor.createdAt} AND p.id < ${cursor.id})
          )
        ` : Prisma.empty}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ${limit + 1}
    `;
    
    const postsRaw = await prisma.$queryRaw<any[]>(query);
    
    // Fetch relations separately (categories, media)
    const hasMore = postsRaw.length > limit;
    const posts = hasMore ? postsRaw.slice(0, -1) : postsRaw;
    
    const enrichedPosts = await Promise.all(
      posts.map(async (post) => {
        const [categories, media] = await Promise.all([
          prisma.postCategory.findMany({
            where: { postId: post.id },
            include: { category: true },
          }),
          prisma.postMedia.findMany({
            where: { postId: post.id },
            orderBy: { createdAt: 'asc' },
          }),
        ]);
        
        return {
          id: post.id,
          title: post.title,
          description: post.description,
          status: post.status,
          latitude: this.truncateCoordinate(Number(post.latitude)),
          longitude: this.truncateCoordinate(Number(post.longitude)),
          distanceKm: Math.round(Number(post.distance_km) * 10) / 10, // 1 decimal
          categories: categories.map(pc => pc.category),
          media: media,
          expiresAt: post.expires_at,
          createdAt: post.created_at,
        };
      })
    );
    
    const nextCursor = hasMore
      ? this.encodeCursor({
          createdAt: posts[posts.length - 1].created_at,
          id: posts[posts.length - 1].id,
        })
      : null;
    
    const result = {
      posts: enrichedPosts,
      nextCursor,
      hasMore,
    };
    
    // Cache result (5 minutes TTL)
    await this.setCache(cacheKey, result, 300);
    
    return result;
  }
  
  /**
   * Truncate coordinate to 2 decimals (±1km precision)
   */
  private truncateCoordinate(coord: number): number {
    return Math.round(coord * 100) / 100;
  }
  
  /**
   * Generate cache key
   */
  private generateCacheKey(filters: FeedFilters): string {
    const { professionalId, latitude, longitude, categoryIds, cursor, limit } = filters;
    return `feed:${professionalId}:${latitude}:${longitude}:${categoryIds.sort().join(',')}:${cursor || 'first'}:${limit || 20}`;
  }
  
  /**
   * Get from Redis cache
   */
  private async getFromCache(key: string): Promise<any | null> {
    try {
      const cached = await redisClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Redis cache read error:', error);
      return null;
    }
  }
  
  /**
   * Set Redis cache
   */
  private async setCache(key: string, value: any, ttlSeconds: number): Promise<void> {
    try {
      await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      console.error('Redis cache write error:', error);
    }
  }
  
  private encodeCursor(data: { createdAt: Date; id: number }): string {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }
  
  private decodeCursor(cursor: string): { createdAt: Date; id: number } {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
    return {
      createdAt: new Date(decoded.createdAt),
      id: decoded.id,
    };
  }
}

export const feedService = new FeedService();
```

---

## 5. Middleware Chain

### 5.1 Middleware Implementation

```typescript
// src/middleware/requireClient.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/utils/errors';

export const requireClient = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AppError(401, 'Authentication required');
  }
  
  if (req.user.role !== 'client') {
    throw new AppError(403, 'Only clients can create posts');
  }
  
  next();
};
```

```typescript
// src/middleware/requirePostOwnership.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/utils/errors';

export const requirePostOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const postId = parseInt(req.params.id || req.params.postId);
  
  if (isNaN(postId)) {
    throw new AppError(400, 'Invalid post ID');
  }
  
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { userId: true },
  });
  
  if (!post) {
    throw new AppError(404, 'Post not found');
  }
  
  if (post.userId !== req.user!.id) {
    throw new AppError(403, 'You can only access your own posts');
  }
  
  next();
};
```

```typescript
// src/middleware/requireProposalOwnership.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/utils/errors';

export const requireProposalOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const proposalId = parseInt(req.params.id);
  
  if (isNaN(proposalId)) {
    throw new AppError(400, 'Invalid proposal ID');
  }
  
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      professional: {
        select: { userId: true },
      },
    },
  });
  
  if (!proposal) {
    throw new AppError(404, 'Proposal not found');
  }
  
  if (proposal.professional.userId !== req.user!.id) {
    throw new AppError(403, 'You can only edit your own proposals');
  }
  
  next();
};
```

```typescript
// src/middleware/postRateLimiter.ts
import rateLimit from 'express-rate-limit';
import { redisClient } from '@/lib/redis';
import RedisStore from 'rate-limit-redis';

export const postRateLimiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'ratelimit:post:create:',
  }),
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10, // Max 10 posts per day
  keyGenerator: (req) => req.user!.id.toString(),
  message: { error: 'Daily post limit reached. Maximum 10 posts per day.' },
  standardHeaders: true,
  legacyHeaders: false,
});
```

### 5.2 Middleware Execution Order

```mermaid
graph LR
    A[Request] --> B[CORS]
    B --> C[Body Parser]
    C --> D[Multer]
    D --> E[requireAuth]
    E --> F[Role Check]
    F --> G[Rate Limiter]
    G --> H[Ownership Check]
    H --> I[Controller]
    I --> J[Service]
    J --> K[Database]
    K --> L[Response]
```

---

## 6. Upload Flow Design

### 6.1 Multer Configuration

```typescript
// src/config/multer.config.ts
import multer from 'multer';
import { AppError } from '@/utils/errors';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime']; // .mov

export const upload = multer({
  storage: multer.memoryStorage(), // Store in memory buffer
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max per file
    files: 7, // Max 5 images + 2 videos
  },
  fileFilter: (req, file, cb) => {
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.mimetype);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.mimetype);
    
    if (isImage || isVideo) {
      cb(null, true);
    } else {
      cb(new AppError(
        415,
        `Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, WEBP, MP4, MOV`
      ));
    }
  },
});
```

### 6.2 Upload Service (Extend Fase 1)

```typescript
// src/services/upload.service.ts
import cloudinary from '@/config/cloudinary.config';
import sharp from 'sharp';
import { AppError } from '@/utils/errors';

export class UploadService {
  /**
   * Upload post media (image or video)
   */
  async uploadPostMedia(
    file: Express.Multer.File,
    userId: number,
    postId: number
  ): Promise<string> {
    const isVideo = file.mimetype.startsWith('video/');
    
    // Resize image before upload (if image)
    let buffer = file.buffer;
    
    if (!isVideo) {
      buffer = await sharp(file.buffer)
        .resize(1920, null, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();
    }
    
    // Upload to Cloudinary
    try {
      const result = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `quickfixu/posts/${postId}`,
            resource_type: isVideo ? 'video' : 'image',
            timeout: 30000, // 30 seconds timeout
            ...(isVideo && {
              eager: [
                {
                  format: 'mp4',
                  video_codec: 'h264', // Transcode to H.264
                },
              ],
              eager_async: false, // Wait for transcode before returning
            }),
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        );
        
        uploadStream.end(buffer);
      });
      
      return result.secure_url;
    } catch (error: any) {
      if (error.message?.includes('timeout')) {
        throw new AppError(
          504,
          'Upload timeout. Please use a smaller file (<30MB) or shorter video (<15 seconds).'
        );
      }
      
      throw new AppError(503, 'Media upload failed. Please try again.');
    }
  }
}

export const uploadService = new UploadService();
```

### 6.3 Upload Flow Diagram

```mermaid
sequenceDiagram
    participant C as Client
    participant M as Multer
    participant S as Sharp
    participant CL as Cloudinary
    participant DB as Database
    
    C->>M: Upload 5 images + 2 videos
    M->>M: Validate MIME types
    M->>M: Check file sizes (<50MB)
    
    loop For each image
        M->>S: Resize to max 1920px width
        S-->>M: Resized buffer
    end
    
    loop For each file
        M->>CL: Upload to folder quickfixu/posts/{postId}
        
        alt Is Video
            CL->>CL: Transcode to H.264 MP4 (eager)
            CL-->>M: Transcoded video URL
        else Is Image
            CL-->>M: Image URL
        end
        
        alt Upload Success (<30s)
            M->>DB: INSERT INTO post_media (...)
        else Timeout (>30s)
            M-->>C: 504 Gateway Timeout
        end
    end
    
    M-->>C: 201 Created with media URLs
```

---

## 7. Feed Algorithm

### 7.1 Query Strategy

**PostGIS Spatial Query:**
```sql
SELECT 
  p.*,
  ST_Distance(
    p.location,
    ST_SetSRID(ST_MakePoint(:prof_lng, :prof_lat), 4326)::geography
  ) / 1000 AS distance_km
FROM posts p
JOIN post_categories pc ON p.id = pc.post_id
WHERE p.status = 'open'
  AND p.deleted_at IS NULL
  AND p.expires_at > NOW()
  AND ST_DWithin(
    p.location,
    ST_SetSRID(ST_MakePoint(:prof_lng, :prof_lat), 4326)::geography,
    30000  -- 30km radius in meters
  )
  AND pc.category_id = ANY(:prof_category_ids)
  AND (
    -- Cursor-based pagination (no duplicates)
    p.created_at < :cursor_created_at
    OR (p.created_at = :cursor_created_at AND p.id < :cursor_id)
  )
ORDER BY p.created_at DESC, p.id DESC
LIMIT 20;
```

### 7.2 Index Strategy for Feed Performance

```sql
-- Spatial index (GIST) on location
CREATE INDEX idx_posts_location ON posts USING GIST(location);

-- Composite index for feed queries
CREATE INDEX idx_posts_feed_query 
ON posts(status, expires_at, created_at DESC, id DESC) 
WHERE deleted_at IS NULL;

-- Category join index
CREATE INDEX idx_post_categories_category 
ON post_categories(category_id, post_id);
```

**Performance targets:**
- 10K posts: <200ms (p95)
- 50K posts: <300ms (p95)
- 100K posts: <500ms (p95) — requires Redis Geo cache

### 7.3 Cursor Pagination Implementation

```typescript
// src/utils/cursorPagination.ts

export interface Cursor {
  createdAt: Date;
  id: number;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
}

export function decodeCursor(cursorString: string): Cursor {
  const decoded = JSON.parse(
    Buffer.from(cursorString, 'base64').toString()
  );
  
  return {
    createdAt: new Date(decoded.createdAt),
    id: decoded.id,
  };
}

export function buildCursorWhere(cursor: Cursor | null): any {
  if (!cursor) return {};
  
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      {
        createdAt: cursor.createdAt,
        id: { lt: cursor.id },
      },
    ],
  };
}
```

**Why cursor-based vs offset/limit?**

| Pagination Type | Pros | Cons |
|-----------------|------|------|
| **Offset/Limit** | Simple, can jump to page N | Duplicates when new posts inserted, slow with large offsets |
| **Cursor-based** (✅) | No duplicates, consistent performance | Cannot jump to arbitrary page |

---

## 8. Cronjob Implementation

### 8.1 Cron Service

```typescript
// src/services/cron.service.ts
import cron from 'node-cron';
import { expirePostsAndProposals } from '@/jobs/expirePostsAndProposals';
import { softDeleteOldPosts } from '@/jobs/softDeleteOldPosts';
import { hardDeletePosts } from '@/jobs/hardDeletePosts';

export class CronService {
  /**
   * Initialize all cronjobs
   */
  init() {
    // Expire posts and proposals every 1 hour
    cron.schedule('0 * * * *', async () => {
      console.log('[Cron] Running expiration job...');
      await expirePostsAndProposals();
    });
    
    // Soft delete old posts daily at 3am
    cron.schedule('0 3 * * *', async () => {
      console.log('[Cron] Running soft delete job...');
      await softDeleteOldPosts();
    });
    
    // Hard delete posts weekly on Sundays at 4am
    cron.schedule('0 4 * * 0', async () => {
      console.log('[Cron] Running hard delete job...');
      await hardDeletePosts();
    });
    
    console.log('[Cron] All jobs scheduled');
  }
}

export const cronService = new CronService();
```

### 8.2 Expiration Job

```typescript
// src/jobs/expirePostsAndProposals.ts
import { prisma } from '@/lib/prisma';
import { notificationService } from '@/services/notification.service';

export async function expirePostsAndProposals() {
  const now = new Date();
  
  try {
    // Expire open posts
    const expiredPosts = await prisma.post.updateMany({
      where: {
        status: 'open',
        expiresAt: { lt: now },
      },
      data: { status: 'expired' },
    });
    
    // Expire pending proposals
    const expiredProposals = await prisma.proposal.updateMany({
      where: {
        status: 'pending',
        expiresAt: { lt: now },
      },
      data: { status: 'expired' },
    });
    
    console.log(
      `[Cron] Expired ${expiredPosts.count} posts, ${expiredProposals.count} proposals`
    );
    
    // Send expiration warnings (24 hours before expiration)
    await sendExpirationWarnings();
  } catch (error) {
    console.error('[Cron] Expiration job failed:', error);
  }
}

async function sendExpirationWarnings() {
  const warnThreshold = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
  
  // Find posts expiring in 24 hours (that haven't been warned yet)
  const postsExpiringSoon = await prisma.post.findMany({
    where: {
      status: 'open',
      expiresAt: {
        gte: new Date(),
        lte: warnThreshold,
      },
      // Add lastWarningAt field to prevent duplicate warnings
    },
    include: {
      user: {
        select: { id: true, fullName: true, fcmToken: true },
      },
    },
  });
  
  for (const post of postsExpiringSoon) {
    await notificationService.sendPostExpiringNotification(
      post.id,
      post.user.id,
      post.title,
      post.user.fcmToken
    );
  }
  
  console.log(`[Cron] Sent ${postsExpiringSoon.length} expiration warnings`);
}
```

### 8.3 Soft Delete Job

```typescript
// src/jobs/softDeleteOldPosts.ts
import { prisma } from '@/lib/prisma';

export async function softDeleteOldPosts() {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - 90); // 90 days ago
  
  try {
    const result = await prisma.post.updateMany({
      where: {
        status: { in: ['closed', 'expired'] },
        updatedAt: { lt: threshold },
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
    
    console.log(`[Cron] Soft deleted ${result.count} old posts`);
  } catch (error) {
    console.error('[Cron] Soft delete job failed:', error);
  }
}
```

### 8.4 Hard Delete Job

```typescript
// src/jobs/hardDeletePosts.ts
import { prisma } from '@/lib/prisma';

export async function hardDeletePosts() {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - 180); // 180 days ago
  
  try {
    const result = await prisma.post.deleteMany({
      where: {
        deletedAt: {
          lt: threshold,
        },
      },
    });
    
    console.log(`[Cron] Hard deleted ${result.count} posts (cascade to media, proposals)`);
  } catch (error) {
    console.error('[Cron] Hard delete job failed:', error);
  }
}
```

---

## 9. Notification Strategy

### 9.1 Notification Service (Extend Fase 1)

```typescript
// src/services/notification.service.ts
import admin from 'firebase-admin';
import { prisma } from '@/lib/prisma';

export class NotificationService {
  /**
   * Send new proposal notification
   */
  async sendNewProposalNotification(
    proposalId: number,
    clientId: number,
    clientName: string,
    professionalName: string,
    price: number,
    fcmToken: string | null
  ) {
    const title = '🎉 Nueva propuesta';
    const body = `${professionalName} envió presupuesto: ARS $${price.toLocaleString('es-AR')}`;
    
    // Save in-app notification
    await prisma.notification.create({
      data: {
        userId: clientId,
        type: 'new_proposal',
        title,
        body,
        data: {
          proposalId,
          postId: null, // Will be fetched from proposal
        },
        read: false,
      },
    });
    
    // Send FCM push (silent failure if token invalid)
    if (fcmToken) {
      try {
        await admin.messaging().send({
          token: fcmToken,
          notification: { title, body },
          data: {
            type: 'new_proposal',
            proposalId: proposalId.toString(),
          },
        });
      } catch (error) {
        console.error('FCM send failed (new_proposal):', error);
        // Don't throw - notification saved in DB
      }
    }
  }
  
  /**
   * Send proposal accepted notification
   */
  async sendProposalAcceptedNotification(
    proposalId: number,
    professionalId: number,
    professionalName: string,
    fcmToken: string | null
  ) {
    const title = '✅ Propuesta aceptada';
    const body = 'El cliente aceptó tu presupuesto. ¡Prepárate para el trabajo!';
    
    await prisma.notification.create({
      data: {
        userId: professionalId,
        type: 'proposal_accepted',
        title,
        body,
        data: { proposalId },
        read: false,
      },
    });
    
    if (fcmToken) {
      try {
        await admin.messaging().send({
          token: fcmToken,
          notification: { title, body },
          data: {
            type: 'proposal_accepted',
            proposalId: proposalId.toString(),
          },
        });
      } catch (error) {
        console.error('FCM send failed (proposal_accepted):', error);
      }
    }
  }
  
  /**
   * Send proposal rejected notification
   */
  async sendProposalRejectedNotification(
    proposalId: number,
    professionalId: number,
    professionalName: string,
    fcmToken: string | null
  ) {
    const title = '❌ Propuesta rechazada';
    const body = 'El cliente eligió otra propuesta para este trabajo.';
    
    await prisma.notification.create({
      data: {
        userId: professionalId,
        type: 'proposal_rejected',
        title,
        body,
        data: { proposalId },
        read: false,
      },
    });
    
    if (fcmToken) {
      try {
        await admin.messaging().send({
          token: fcmToken,
          notification: { title, body },
          data: {
            type: 'proposal_rejected',
            proposalId: proposalId.toString(),
          },
        });
      } catch (error) {
        console.error('FCM send failed (proposal_rejected):', error);
      }
    }
  }
  
  /**
   * Send post expiring warning notification
   */
  async sendPostExpiringNotification(
    postId: number,
    clientId: number,
    postTitle: string,
    fcmToken: string | null
  ) {
    const title = '⏰ Post por expirar';
    const body = `Tu publicación "${postTitle}" expira en 24 horas`;
    
    await prisma.notification.create({
      data: {
        userId: clientId,
        type: 'post_expiring',
        title,
        body,
        data: { postId },
        read: false,
      },
    });
    
    if (fcmToken) {
      try {
        await admin.messaging().send({
          token: fcmToken,
          notification: { title, body },
          data: {
            type: 'post_expiring',
            postId: postId.toString(),
          },
        });
      } catch (error) {
        console.error('FCM send failed (post_expiring):', error);
      }
    }
  }
  
  /**
   * Send proposal updated notification
   */
  async sendProposalUpdatedNotification(
    proposalId: number,
    clientId: number,
    professionalName: string,
    newPrice: number,
    fcmToken: string | null
  ) {
    const title = '💬 Propuesta actualizada';
    const body = `${professionalName} actualizó su presupuesto: ARS $${newPrice.toLocaleString('es-AR')}`;
    
    await prisma.notification.create({
      data: {
        userId: clientId,
        type: 'proposal_updated',
        title,
        body,
        data: { proposalId },
        read: false,
      },
    });
    
    if (fcmToken) {
      try {
        await admin.messaging().send({
          token: fcmToken,
          notification: { title, body },
          data: {
            type: 'proposal_updated',
            proposalId: proposalId.toString(),
          },
        });
      } catch (error) {
        console.error('FCM send failed (proposal_updated):', error);
      }
    }
  }
}

export const notificationService = new NotificationService();
```

### 9.2 Notification Events Matrix

| Event | Trigger | Recipient | Title | Body Template |
|-------|---------|-----------|-------|---------------|
| `new_proposal` | Professional sends proposal | Post owner (client) | 🎉 Nueva propuesta | "{professional} envió presupuesto: ARS ${price}" |
| `proposal_accepted` | Client accepts proposal | Accepted professional | ✅ Propuesta aceptada | "El cliente aceptó tu presupuesto. ¡Prepárate!" |
| `proposal_rejected` | Client rejects or accepts another | Rejected professional | ❌ Propuesta rechazada | "El cliente eligió otra propuesta" |
| `proposal_updated` | Professional updates price/date | Post owner (client) | 💬 Propuesta actualizada | "{professional} actualizó su presupuesto: ARS ${price}" |
| `post_expiring` | Cronjob (24hs before expiration) | Post owner (client) | ⏰ Post por expirar | "Tu publicación '{title}' expira en 24 horas" |
| `proposal_expiring` | Cronjob (24hs before expiration) | Professional | ⏰ Propuesta por expirar | "Tu propuesta para '{post_title}' expira pronto" |

---

## 10. Error Handling Strategy

### 10.1 Error Classes

```typescript
// src/utils/errors.ts

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, message, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(401, message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(403, message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
    this.name = 'ConflictError';
  }
}
```

### 10.2 Global Error Handler

```typescript
// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '@/utils/errors';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('[Error]', {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    error: err.message,
    stack: err.stack,
  });
  
  // AppError (custom)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
    });
  }
  
  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return handlePrismaError(err, res);
  }
  
  // Multer errors (file upload)
  if (err.name === 'MulterError') {
    return handleMulterError(err, res);
  }
  
  // Default: 500 Internal Server Error
  return res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && {
      message: err.message,
      stack: err.stack,
    }),
  });
}

function handlePrismaError(err: Prisma.PrismaClientKnownRequestError, res: Response) {
  switch (err.code) {
    case 'P2002': // Unique constraint violation
      return res.status(409).json({
        error: 'Resource already exists',
        details: err.meta,
      });
    
    case 'P2025': // Record not found
      return res.status(404).json({
        error: 'Resource not found',
      });
    
    case 'P2003': // Foreign key constraint
      return res.status(400).json({
        error: 'Invalid reference',
        details: err.meta,
      });
    
    default:
      return res.status(500).json({
        error: 'Database error',
        code: err.code,
      });
  }
}

function handleMulterError(err: any, res: Response) {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large. Max 50MB per file.',
    });
  }
  
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      error: 'Too many files. Max 7 files (5 images + 2 videos).',
    });
  }
  
  return res.status(400).json({
    error: 'File upload error',
    message: err.message,
  });
}
```

---

## 11. Security Implementation

### 11.1 Security Checklist

| Security Concern | Implementation | Location |
|------------------|----------------|----------|
| **Authentication** | JWT validation on all endpoints | `requireAuth` middleware |
| **Authorization** | Role-based + ownership checks | `requireClient`, `requirePostOwnership` middleware |
| **Rate Limiting** | 10 posts/day, 20 proposals/day | `postRateLimiter`, `proposalRateLimiter` middleware |
| **Privacy (Location)** | Truncate lat/lng to 2 decimals for non-owners | `PostService.truncateCoordinate()` |
| **CSRF Protection** | CORS whitelist mobile app origins | `cors` middleware |
| **SQL Injection** | Parameterized queries (Prisma) | All database queries |
| **File Upload Validation** | MIME type + size checks server-side | Multer config |
| **Race Conditions** | Serializable transactions + row locks | `ProposalService.acceptProposal()` |
| **XSS** | Sanitize user input (title, description) | Input validation layer |
| **Cloudinary Security** | Signed URLs, folder isolation | Upload service |

### 11.2 Input Validation (Zod)

```typescript
// src/validators/post.validator.ts
import { z } from 'zod';

export const createPostSchema = z.object({
  title: z.string().min(10).max(100),
  description: z.string().min(20).max(500),
  category_ids: z.array(z.number().int().positive()).min(1).max(3),
  use_profile_location: z.boolean(),
  custom_address: z.string().min(10).optional(),
}).refine(
  data => {
    if (!data.use_profile_location && !data.custom_address) {
      return false;
    }
    return true;
  },
  {
    message: 'Custom address is required when not using profile location',
  }
);

export const updatePostSchema = z.object({
  title: z.string().min(10).max(100).optional(),
  description: z.string().min(20).max(500).optional(),
  category_ids: z.array(z.number().int().positive()).min(1).max(3).optional(),
});
```

```typescript
// src/validators/proposal.validator.ts
import { z } from 'zod';

export const createProposalSchema = z.object({
  post_id: z.number().int().positive(),
  price: z.number().min(500).max(100000),
  description: z.string().min(10).max(300),
  scheduled_date: z.string().refine(
    date => new Date(date) > new Date(Date.now() + 2 * 60 * 60 * 1000),
    {
      message: 'Scheduled date must be at least 2 hours in the future',
    }
  ),
  scheduled_time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
});

export const updateProposalSchema = z.object({
  price: z.number().min(500).max(100000).optional(),
  description: z.string().min(10).max(300).optional(),
  scheduled_date: z.string().optional(),
  scheduled_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});
```

---

## 12. Testing Strategy

### 12.1 Testing Pyramid

```mermaid
graph TB
    A[E2E Tests - 10%] --> B[Integration Tests - 30%]
    B --> C[Unit Tests - 60%]
    
    style A fill:#ff6b6b
    style B fill:#ffd93d
    style C fill:#6bcf7f
```

### 12.2 Test Coverage Targets

| Layer | Coverage Target | Focus |
|-------|-----------------|-------|
| **Unit Tests** | 80% | Services, validators, utils |
| **Integration Tests** | 70% | API endpoints, database queries |
| **E2E Tests** | Critical paths only | Happy path flows |

### 12.3 Integration Test Example

```typescript
// tests/integration/posts.test.ts
import request from 'supertest';
import { app } from '@/app';
import { prisma } from '@/lib/prisma';
import { generateAuthToken } from '@/utils/auth';

describe('POST /api/posts', () => {
  let clientToken: string;
  let clientId: number;
  
  beforeAll(async () => {
    // Create test client
    const client = await prisma.user.create({
      data: {
        fullName: 'Test Client',
        email: 'client@test.com',
        passwordHash: 'hash',
        phoneNumber: '+541112345678',
        role: 'client',
        latitude: -34.603722,
        longitude: -58.381592,
      },
    });
    
    clientId = client.id;
    clientToken = generateAuthToken(client);
  });
  
  afterAll(async () => {
    // Cleanup
    await prisma.post.deleteMany({ where: { userId: clientId } });
    await prisma.user.delete({ where: { id: clientId } });
  });
  
  it('should create post successfully', async () => {
    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'Fuga de agua en cocina',
        description: 'Se rompió la canilla del lavaplatos, gotea constantemente. Necesito urgente reparación.',
        category_ids: [2], // Plomero
        use_profile_location: true,
      });
    
    expect(response.status).toBe(201);
    expect(response.body.title).toBe('Fuga de agua en cocina');
    expect(response.body.status).toBe('open');
    expect(response.body.expiresAt).toBeDefined();
  });
  
  it('should reject post with invalid title (too short)', async () => {
    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'Corto', // <10 chars
        description: 'Descripción válida con más de 20 caracteres aquí.',
        category_ids: [2],
        use_profile_location: true,
      });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('title');
  });
  
  it('should enforce rate limit (10 posts/day)', async () => {
    // Create 10 posts
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          title: `Post número ${i + 1} del día`,
          description: 'Descripción válida con más de 20 caracteres.',
          category_ids: [2],
          use_profile_location: true,
        });
    }
    
    // 11th post should fail
    const response = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'Post número 11 (debe fallar)',
        description: 'Descripción válida con más de 20 caracteres.',
        category_ids: [2],
        use_profile_location: true,
      });
    
    expect(response.status).toBe(429);
    expect(response.body.error).toContain('Daily post limit');
  });
});
```

### 12.4 E2E Test (Critical Path)

```typescript
// tests/e2e/proposalFlow.test.ts
import request from 'supertest';
import { app } from '@/app';
import { prisma } from '@/lib/prisma';
import { generateAuthToken } from '@/utils/auth';

describe('E2E: Post → Proposal → Accept Flow', () => {
  let clientToken: string;
  let professionalToken: string;
  let clientId: number;
  let professionalId: number;
  let postId: number;
  let proposalId: number;
  
  beforeAll(async () => {
    // Setup client + professional
    // ...
  });
  
  it('should complete full workflow', async () => {
    // 1. Client creates post
    const postRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'Instalación toma corriente',
        description: 'Necesito instalar 3 tomas nuevos en la cocina.',
        category_ids: [1], // Electricista
        use_profile_location: true,
      });
    
    expect(postRes.status).toBe(201);
    postId = postRes.body.id;
    
    // 2. Professional views feed (should see post)
    const feedRes = await request(app)
      .get('/api/posts')
      .set('Authorization', `Bearer ${professionalToken}`);
    
    expect(feedRes.status).toBe(200);
    expect(feedRes.body.posts.some((p: any) => p.id === postId)).toBe(true);
    
    // 3. Professional sends proposal
    const proposalRes = await request(app)
      .post('/api/proposals')
      .set('Authorization', `Bearer ${professionalToken}`)
      .send({
        post_id: postId,
        price: 5000,
        description: 'Puedo ir mañana a las 10am. Tengo 5 años experiencia.',
        scheduled_date: '2026-03-25',
        scheduled_time: '10:00',
      });
    
    expect(proposalRes.status).toBe(201);
    proposalId = proposalRes.body.id;
    
    // 4. Client views proposals
    const proposalsRes = await request(app)
      .get(`/api/posts/${postId}/proposals`)
      .set('Authorization', `Bearer ${clientToken}`);
    
    expect(proposalsRes.status).toBe(200);
    expect(proposalsRes.body.length).toBe(1);
    
    // 5. Client accepts proposal
    const acceptRes = await request(app)
      .post(`/api/proposals/${proposalId}/accept`)
      .set('Authorization', `Bearer ${clientToken}`);
    
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.proposal.status).toBe('accepted');
    expect(acceptRes.body.chatId).toBeDefined();
    
    // 6. Verify post is closed
    const postCheckRes = await request(app)
      .get(`/api/posts/${postId}`)
      .set('Authorization', `Bearer ${clientToken}`);
    
    expect(postCheckRes.body.status).toBe('closed');
  });
});
```

---

## 13. Performance Optimizations

### 13.1 Database Optimizations

**Connection Pooling:**
```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
}

// .env
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=30&pool_timeout=10"
```

**Query Optimization:**
```typescript
// Bad: N+1 query problem
const posts = await prisma.post.findMany();
for (const post of posts) {
  const categories = await prisma.postCategory.findMany({
    where: { postId: post.id },
  });
}

// Good: Single query with include
const posts = await prisma.post.findMany({
  include: {
    categories: {
      include: { category: true },
    },
    media: true,
  },
});
```

### 13.2 Redis Caching Strategy

```typescript
// Cache feed results (TTL: 5 minutes)
const cacheKey = `feed:${professionalId}:${cursor || 'first'}`;
const cached = await redisClient.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const feed = await feedService.getFeed(filters);
await redisClient.setex(cacheKey, 300, JSON.stringify(feed));
return feed;
```

**Cache Invalidation:**
- **New post created:** Invalidate `feed:*` keys for affected professionals
- **Post status changed:** Invalidate `feed:*` keys
- **Category changed:** Invalidate `feed:*` keys

### 13.3 Image Optimization

```typescript
// Resize images before upload (reduce bandwidth)
const resizedBuffer = await sharp(file.buffer)
  .resize(1920, null, {
    fit: 'inside',
    withoutEnlargement: true,
  })
  .jpeg({ quality: 85 }) // 85% quality (sweet spot)
  .toBuffer();
```

**Cloudinary Transformations:**
```typescript
// Lazy-load thumbnails in feed (faster initial load)
const thumbnailUrl = cloudinary.url(publicId, {
  width: 400,
  height: 300,
  crop: 'fill',
  quality: 'auto:good',
  fetch_format: 'auto', // WebP if browser supports
});
```

### 13.4 Performance Monitoring

```typescript
// Measure query performance
const start = Date.now();
const posts = await prisma.post.findMany({...});
const duration = Date.now() - start;

console.log(`[Perf] Feed query took ${duration}ms`);

// Alert if >500ms
if (duration > 500) {
  console.warn(`[Perf] SLOW QUERY: Feed took ${duration}ms`);
}
```

---

## 14. Migration Plan

### 14.1 Migration Steps

```mermaid
graph LR
    A[Fase 1 Complete] --> B[Create Prisma Models]
    B --> C[Generate Migration]
    C --> D[Run Migration + PostGIS SQL]
    D --> E[Seed Test Data]
    E --> F[Deploy Services]
    F --> G[Deploy API Routes]
    G --> H[Integration Tests]
    H --> I[Deploy Cronjobs]
    I --> J[Monitor + Verify]
```

### 14.2 Prisma Migration Commands

```bash
# 1. Create migration
npx prisma migrate dev --name add_posts_proposals

# 2. Run PostGIS raw SQL
psql -d quickfixu -f prisma/migrations/YYYYMMDD_add_posts_proposals/postgis.sql

# 3. Verify schema
npx prisma db pull

# 4. Generate client
npx prisma generate

# 5. Seed data
npx prisma db seed
```

### 14.3 Rollback Plan

**If migration fails mid-way:**

```sql
-- Rollback posts table
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS proposals CASCADE;
DROP TABLE IF EXISTS post_media CASCADE;
DROP TABLE IF EXISTS post_categories CASCADE;
DROP TABLE IF EXISTS posts CASCADE;

-- Remove PostGIS trigger
DROP TRIGGER IF EXISTS trigger_update_post_location ON posts;
DROP FUNCTION IF EXISTS update_post_location;
```

**If deployed with bugs:**

```typescript
// Feature flags (kill switch)
export const FEATURES = {
  POSTS_ENABLED: process.env.ENABLE_POSTS === 'true',
  PROPOSALS_ENABLED: process.env.ENABLE_PROPOSALS === 'true',
};

// Middleware
if (!FEATURES.POSTS_ENABLED) {
  return res.status(503).json({
    error: 'Feature temporarily disabled for maintenance',
  });
}
```

### 14.4 Deployment Checklist

- [ ] Prisma migration applied to staging DB
- [ ] PostGIS raw SQL executed
- [ ] Seed data created (10 posts, 20 proposals)
- [ ] Integration tests passing (95%+)
- [ ] Cloudinary credentials configured
- [ ] FCM server key configured
- [ ] Redis connection verified
- [ ] Rate limiter Redis keys cleared
- [ ] Cronjobs scheduled (verified with dry-run)
- [ ] Monitoring alerts configured (slow queries, FCM failures)
- [ ] Rollback script tested
- [ ] API documentation updated

---

## End of Design Document

**Next Steps:**
1. Review this design document with Tech Lead + Backend Team
2. Approve architecture decisions (PostGIS, cursor pagination, Cloudinary)
3. Execute `sdd-tasks` to break down into implementation tasks
4. Begin Sprint 1: Database models + migrations

**Document Status:** Ready for Review  
**Estimated Implementation Time:** 16 days (3 weeks sprint)  
**Risk Level:** MEDIUM (Cloudinary bandwidth, race conditions mitigated)
