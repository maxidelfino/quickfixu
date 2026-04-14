# Specification: Fase 7 - Push Notifications & Polish

**Change:** `fase-7-notifications-polish`  
**Date:** Marzo 2026  
**Type:** FULL SPEC (New Domain)  
**Prerequisite:** Fases 1-6 MUST be completed

---

## Purpose

Esta especificación define el sistema completo de notificaciones push (9 tipos nuevos), centro in-app, preferencias granulares por tipo, deep linking universal, y polish UX/UI (skeleton loaders, pull-to-refresh, empty/error states, animaciones, onboarding, performance, accesibilidad, error recovery).

---

## Requirements

### REQ-1: Sistema Notificaciones Completo (9 Tipos Nuevos)

El sistema **MUST** enviar notificaciones push para los siguientes 9 tipos de eventos:

| Tipo | Disparador | Destinatario | Data |
|------|-----------|--------------|------|
| `appointment_reminder` | 24hs antes appointment | Cliente + Profesional | `appointmentId` |
| `payment_released` | Payout completado | Profesional | `appointmentId` |
| `dispute_resolved` | Admin resuelve disputa | Cliente + Profesional | `appointmentId`, `resolution` |
| `new_professional_in_area` | Profesional aprobado en radio 30km | Clientes con post activo | `professionalId`, `distance` |
| `review_reminder` | 3 días después completar trabajo | Cliente + Profesional | `appointmentId` |
| `certification_approved` | Admin aprueba certificación | Profesional | `userId` |
| `certification_rejected` | Admin rechaza certificación | Profesional | `userId`, `reason` |
| `post_expiring` | 24hs antes expiración | Cliente | `postId` |
| `proposal_expiring` | 24hs antes expiración | Profesional | `proposalId` |

**Implementación:**
- Backend: Cronjobs separados por tipo (frecuencias personalizadas)
- Lógica: `notificationService.sendPushNotification(userId, type, title, body, data)`
- Filtrado: Verificar preferencias usuario ANTES de enviar (ver REQ-3)

#### Scenario: Appointment reminder 24hs antes

- GIVEN un appointment con `scheduledDate = tomorrow` y `status = 'scheduled'`
- WHEN el cronjob ejecuta a las 9am
- THEN el sistema MUST enviar push a cliente y profesional
- AND guardar notificación in-app (tabla `notifications`)
- AND incluir deep link `quickfixu://appointments/{appointmentId}`

#### Scenario: Payment released después confirmación

- GIVEN un appointment con `status = 'completed'` y `payoutStatus = 'completed'`
- WHEN el cronjob de payout verifica confirmación dual
- THEN el sistema MUST enviar push al profesional
- AND el push MUST incluir monto liberado en el body

#### Scenario: New professional in area (cliente con post activo)

- GIVEN un profesional con `certificationStatus = 'approved'` recién aprobado
- AND un cliente con post `status = 'open'` en radio 30km
- WHEN el cronjob detecta nueva aprobación
- THEN el sistema MUST enviar push al cliente
- AND el body MUST incluir `distance` (ej: "A 5km de tu ubicación")

#### Scenario: Review reminder 3 días después

- GIVEN un appointment `completedAt = 3 days ago`
- AND NO existe review del cliente para ese appointment
- WHEN el cronjob ejecuta
- THEN el sistema MUST enviar push al cliente
- AND incluir deep link a `quickfixu://reviews/{appointmentId}`

#### Scenario: Usuario deshabilitó tipo notificación

- GIVEN un usuario con `notification_preferences.review_reminder.enabled = false`
- WHEN el sistema intenta enviar push tipo `review_reminder`
- THEN el sistema MUST NOT enviar push FCM
- BUT el sistema MUST guardar notificación in-app (disponible si usuario cambia preferencia)

---

### REQ-2: Centro de Notificaciones In-App

La app **MUST** incluir pantalla `/notifications` con lista paginada de todas las notificaciones del usuario.

**Funcionalidades:**
1. **Lista ordenada:** `sentAt DESC`, paginación 50 items
2. **Badge count:** Contador notificaciones no leídas (campo `read = false`)
3. **Marcar como leída:** Tap notificación → `read = true` + navegación deep link
4. **Mark all as read:** Button "Marcar todas leídas" → actualiza todas con `read = false`
5. **Delete notification:** Swipe left → delete (opcional, solo UI)
6. **Refetch automático:** Polling 30s (React Query `refetchInterval`)

#### Scenario: Usuario accede a centro notificaciones

- GIVEN un usuario autenticado
- WHEN navega a `/notifications`
- THEN la app MUST cargar notificaciones del endpoint `GET /api/notifications?limit=50`
- AND mostrar badge count en tab bar con total `read = false`
- AND ordenar por `sentAt DESC`

#### Scenario: Usuario tapa notificación (marcar leída + deep link)

- GIVEN una notificación con `read = false` y `type = 'new_proposal'`
- WHEN el usuario tapa la notificación
- THEN la app MUST enviar `PATCH /api/notifications/{id}/read`
- AND navegar a `quickfixu://chats/{chatId}` (deep link desde `data.chatId`)
- AND actualizar badge count `-1`

#### Scenario: Mark all as read

- GIVEN 5 notificaciones con `read = false`
- WHEN el usuario tapa button "Marcar todas leídas"
- THEN la app MUST enviar `PATCH /api/notifications/read-all`
- AND actualizar badge count a `0`
- AND todas notificaciones mostrar como leídas (UI gray)

#### Scenario: Empty state (sin notificaciones)

- GIVEN un usuario sin notificaciones
- WHEN accede a `/notifications`
- THEN la app MUST mostrar empty state con mensaje "No tienes notificaciones"
- AND NO mostrar badge count en tab bar

---

### REQ-3: Preferencias de Notificaciones (Granularidad por Tipo)

El sistema **MUST** permitir al usuario configurar qué tipos de notificaciones recibe (15 tipos totales).

**Tabla `notification_preferences`:**
```prisma
model NotificationPreference {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  type      String   @db.VarChar(50)
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, type])
  @@index([userId])
  @@map("notification_preferences")
}
```

**15 tipos configurables:**
- `new_proposal`, `proposal_accepted`, `proposal_rejected`
- `new_message`
- `payment_confirmed`, `payment_released`
- `work_completed`, `review_reminder`
- `appointment_reminder`, `post_expiring`, `proposal_expiring`
- `certification_approved`, `certification_rejected`
- `dispute_resolved`
- `new_professional_in_area`

**Defaults (al crear usuario):**
```typescript
// Críticas (ON por defecto)
payment_confirmed: true
payment_released: true
certification_approved: true
certification_rejected: true
dispute_resolved: true

// Engagement (ON por defecto)
new_proposal: true
proposal_accepted: true
new_message: true
work_completed: true
appointment_reminder: true

// Marketing (OFF por defecto)
review_reminder: false
new_professional_in_area: false
post_expiring: false
proposal_expiring: false
```

#### Scenario: Usuario deshabilita tipo notificación

- GIVEN un usuario en `/settings/notifications`
- WHEN deshabilita switch "Recordatorios reviews" (`review_reminder`)
- THEN la app MUST enviar `PATCH /api/notifications/preferences` con `{ type: 'review_reminder', enabled: false }`
- AND el backend MUST actualizar `notification_preferences` tabla
- AND el backend MUST NOT enviar push FCM para `review_reminder` (pero SÍ guardar in-app)

#### Scenario: Seed defaults para usuario nuevo

- GIVEN un usuario recién creado
- WHEN el sistema ejecuta seed
- THEN MUST crear 15 rows en `notification_preferences` con defaults arriba
- AND constraint `UNIQUE [userId, type]` MUST prevenir duplicados

#### Scenario: Usuario habilita tipo deshabilitado

- GIVEN un usuario con `new_professional_in_area.enabled = false`
- WHEN activa switch
- THEN el sistema MUST empezar a enviar push para ese tipo
- AND notificaciones in-app anteriores (guardadas) MUST aparecer en centro notificaciones

---

### REQ-4: Deep Linking (Universal Links + App Links)

La app **MUST** configurar deep linking para navegar desde notificación push a pantalla específica.

**React Navigation Linking Config:**
```typescript
linkingConfig = {
  prefixes: [
    'quickfixu://',
    'https://quickfixu.com',
    'https://*.quickfixu.com',
  ],
  config: {
    screens: {
      Main: {
        screens: {
          Home: 'home',
          Chats: {
            path: 'chats',
            screens: {
              ChatScreen: 'chats/:chatId',
            },
          },
          Notifications: 'notifications',
          Profile: 'profile',
        },
      },
      PostDetail: 'posts/:postId',
      AppointmentDetail: 'appointments/:appointmentId',
      LeaveReview: 'reviews/:appointmentId',
    },
  },
}
```

**iOS Universal Links:**
- File: `backend/public/.well-known/apple-app-site-association`
- Paths: `/chats/*`, `/posts/*`, `/appointments/*`, `/reviews/*`
- Entitlements: `com.apple.developer.associated-domains` con `applinks:quickfixu.com`

**Android App Links:**
- File: `backend/public/.well-known/assetlinks.json`
- `android:autoVerify="true"` en `AndroidManifest.xml`
- Paths: `/chats`, `/posts`, `/appointments`, `/reviews`

#### Scenario: Deep link desde notificación (app cerrada)

- GIVEN una notificación push con `data.deepLink = "quickfixu://chats/123"`
- AND la app está cerrada (killed)
- WHEN el usuario tapa la notificación
- THEN la app MUST abrir y navegar a `ChatScreen` con `chatId = 123`
- AND marcar notificación como leída

#### Scenario: Deep link con Universal Link (iOS)

- GIVEN un push con `data.webLink = "https://quickfixu.com/appointments/456"`
- AND iOS Universal Links configurado correctamente
- WHEN el usuario tapa notificación
- THEN iOS MUST abrir app directamente (NO mostrar diálogo "Abrir con...")
- AND la app MUST navegar a `AppointmentDetail` con `appointmentId = 456`

#### Scenario: Fallback custom scheme si Universal Link falla

- GIVEN un push con ambos `webLink` (Universal Link) y `deepLink` (custom scheme)
- AND Universal Links NO configurado (ej: desarrollo local)
- WHEN el usuario tapa notificación
- THEN la app MUST intentar `quickfixu://` como fallback
- AND navegar correctamente

#### Scenario: Deep link type-based navigation (sin URL explícita)

- GIVEN un push con `type = 'review_reminder'` y `appointmentId = 789`
- AND NO incluye `deepLink` (legacy)
- WHEN el usuario tapa notificación
- THEN la app MUST navegar a `LeaveReview` con `appointmentId = 789` (fallback manual)

---

### REQ-5: Skeleton Loaders

La app **MUST** mostrar skeleton placeholders mientras carga contenido (listas posts, chats, propuestas, notificaciones).

**Librería:** `react-native-skeleton-placeholder`

**Componentes a crear:**
- `SkeletonPostCard` (3 items mientras carga feed)
- `SkeletonChatList` (5 items mientras carga chats)
- `SkeletonProposalCard` (2 items mientras carga propuestas)
- `SkeletonNotificationCard` (5 items mientras carga notificaciones)

#### Scenario: Skeleton loader en PostFeedScreen

- GIVEN un usuario accede a feed posts
- AND la query está en estado `isLoading = true`
- WHEN se renderiza el screen
- THEN la app MUST mostrar 3 `<SkeletonPostCard />` con animación shimmer
- AND NO mostrar spinner ni texto "Loading..."

#### Scenario: Transición skeleton → contenido real

- GIVEN skeleton visible
- WHEN la query completa con éxito
- THEN la app MUST reemplazar skeleton con `<FlatList data={posts} />`
- AND transición SHOULD ser suave (sin flash/flicker)

---

### REQ-6: Pull-to-Refresh

La app **MUST** implementar pull-to-refresh en todas las listas (posts, chats, propuestas, notificaciones).

**Implementación:** `RefreshControl` nativo React Native

#### Scenario: Pull-to-refresh en lista posts

- GIVEN un usuario en feed posts con data cached
- WHEN el usuario arrastra hacia abajo (pull gesture)
- THEN la app MUST mostrar spinner refresh nativo
- AND llamar `refetch()` de React Query
- AND invalidar cache anterior
- AND ocultar spinner cuando query completa

#### Scenario: Pull-to-refresh con error de red

- GIVEN pull-to-refresh iniciado
- AND request falla con network error
- WHEN el refresh completa
- THEN la app MUST mostrar toast "Error al actualizar"
- AND mantener data cached (NO borrar lista)

---

### REQ-7: Empty States

La app **MUST** mostrar empty states cuando listas están vacías (posts, chats, notificaciones).

**Componente reutilizable:** `<EmptyState icon title subtitle actionLabel onActionPress />`

**Librería opcional:** Lottie animations (`lottie-react-native`)

#### Scenario: Empty state en lista posts

- GIVEN un usuario sin posts en su área
- WHEN accede a feed
- THEN la app MUST mostrar `<EmptyState>` con:
  - Icon: Lottie animation "empty box"
  - Title: "No hay posts activos"
  - Subtitle: "Sé el primero en publicar un trabajo"
  - Action Button: "Crear Post" → navega a `CreatePostScreen`

#### Scenario: Empty state sin acción (notificaciones)

- GIVEN un usuario sin notificaciones
- WHEN accede a `/notifications`
- THEN la app MUST mostrar empty state con:
  - Title: "No tienes notificaciones"
  - Subtitle: null
  - Action Button: null (solo informativo)

---

### REQ-8: Error States

La app **MUST** mostrar error states cuando requests fallan (network error, 500 server error).

**Componente reutilizable:** `<ErrorState error onRetry />`

#### Scenario: Error state con network error

- GIVEN una query en estado `isError = true` con `error.message = "Network Error"`
- WHEN se renderiza el screen
- THEN la app MUST mostrar `<ErrorState>` con:
  - Icon: "wifi-off"
  - Title: "Sin conexión"
  - Subtitle: error.message
  - Button: "Reintentar" → llama `refetch()`

#### Scenario: Error state con server error (500)

- GIVEN una query con error 500
- THEN la app MUST mostrar icon "alert-circle"
- AND title "Algo salió mal"
- AND button "Reintentar"

---

### REQ-9: Animaciones (Reanimated)

La app **SHOULD** incluir animaciones suaves en transiciones críticas (screen transitions, swipe actions).

**Librería:** `react-native-reanimated` v2 (para animaciones complejas), `Animated` API nativo (para fade/scale simples)

**Ejemplos:**
- Fade in al renderizar cards (`FadeIn.duration(500)`)
- Swipe to delete notificaciones (`PanGestureHandler`)

#### Scenario: Fade in animation en lista posts

- GIVEN una lista posts cargando
- WHEN la query completa
- THEN cada `<PostCard>` SHOULD aparecer con fade in (500ms)
- AND animaciones MUST correr a 60 FPS (UI thread)

#### Scenario: Swipe to delete notificación

- GIVEN una notificación en lista
- WHEN el usuario swipea hacia izquierda
- THEN la notificación MUST deslizarse con gesture nativo
- AND al soltar, MUST desaparecer con fade out
- AND enviar DELETE request al backend

---

### REQ-10: Onboarding Tutorial (Primera Vez)

La app **MUST** mostrar onboarding tutorial la primera vez que el usuario abre la app (después registro/login).

**Librería:** `react-native-onboarding-swiper`

**Páginas:**
1. "Encuentra profesionales certificados cerca tuyo"
2. "Recibe propuestas en minutos"
3. "Paga seguro — Tu dinero protegido"

**Diferenciación por rol:**
- Cliente: 3 páginas arriba
- Profesional: Agregar página 4 "Recibe trabajos constantes sin comisión"

**Persistencia:** `AsyncStorage.setItem('onboarding_completed', 'true')`

#### Scenario: Primera vez usuario abre app

- GIVEN un usuario recién registrado
- AND `AsyncStorage.getItem('onboarding_completed') = null`
- WHEN la app inicia
- THEN la app MUST mostrar `OnboardingScreen` con 3 páginas swipeable
- AND botón "Saltar" visible en todas las páginas
- AND botón "Siguiente" en páginas 1-2, botón "Empezar" en página 3

#### Scenario: Usuario completa onboarding

- GIVEN usuario en última página onboarding
- WHEN tapa button "Empezar"
- THEN la app MUST guardar `onboarding_completed = true` en AsyncStorage
- AND navegar a `MainNavigator` (tab bar)
- AND NO volver a mostrar onboarding en próximos inicios

#### Scenario: Usuario salta onboarding

- GIVEN usuario en página 1
- WHEN tapa "Saltar"
- THEN la app MUST guardar `onboarding_completed = true`
- AND navegar a `MainNavigator`

---

### REQ-11: Performance Optimization

La app **MUST** implementar optimizaciones de performance:

1. **Lazy loading imágenes:** `react-native-fast-image` (cache nativo)
2. **Memoización:** `React.memo` en list items (`PostCard`, `ChatCard`, `NotificationCard`)
3. **Optimistic UI:** React Query mutations con rollback (aceptar propuesta, marcar leída)
4. **Cache strategy:** React Query `staleTime` configurado por endpoint (feed 2min, profile 30min)

#### Scenario: Fast image con cache

- GIVEN un post con `imageUrl`
- WHEN se renderiza `<PostCard>`
- THEN la app MUST usar `<FastImage source={{ uri, cache: 'immutable' }} />`
- AND cargar desde cache nativo si disponible (NO re-download)

#### Scenario: React.memo en PostCard

- GIVEN una lista con 50 posts
- WHEN un post individual actualiza (ej: like)
- THEN SOLO ese `<PostCard>` MUST re-render
- AND otros 49 cards MUST usar memoized version (NO re-render)

#### Scenario: Optimistic update al aceptar propuesta

- GIVEN una propuesta con `status = 'pending'`
- WHEN el usuario tapa "Aceptar"
- THEN la app MUST actualizar UI inmediatamente a `status = 'accepted'` (optimistic)
- AND enviar `PATCH /api/proposals/{id}/accept`
- AND si request falla, rollback a `status = 'pending'`

---

### REQ-12: Accesibilidad (WCAG AA)

La app **MUST** cumplir WCAG AA:

1. **Screen reader support:** `accessibilityLabel`, `accessibilityRole`, `accessibilityHint` en todos los touchables
2. **Contrast ratio:** Mínimo 4.5:1 para texto, 3:1 para UI components
3. **Font scaling:** Respetar ajustes sistema con `allowFontScaling={true}` y límite `maxFontSizeMultiplier={1.5}`

#### Scenario: Screen reader en NotificationCard

- GIVEN un usuario con VoiceOver (iOS) activado
- WHEN navega a lista notificaciones
- THEN VoiceOver MUST leer:
  - "Nueva propuesta. Juan envió una propuesta. No leída. Botón."
  - "Pago confirmado. Cliente confirmó pago de $5000. Leída. Botón."

#### Scenario: Contrast ratio validation

- GIVEN colores theme:
  - `primary = '#0066CC'` (sobre blanco)
  - `text = '#1A1A1A'` (sobre blanco)
- THEN contrast ratios MUST ser:
  - Primary: ≥ 4.5:1 (WCAG AA) ✅
  - Text: ≥ 7:1 (WCAG AAA) ✅

#### Scenario: Font scaling 150%

- GIVEN un usuario con font size sistema = 150%
- WHEN abre app
- THEN todo texto body MUST escalar a 150%
- AND buttons/tabs MUST escalar máximo 130% (`maxFontSizeMultiplier={1.3}`)
- AND UI MUST NOT romperse (overflow)

---

### REQ-13: Error Recovery (Exponential Backoff)

El sistema **MUST** implementar retry automático con exponential backoff para errores 5xx.

**React Query config:**
```typescript
retry: (failureCount, error) => {
  if (error.response?.status >= 400 && error.response?.status < 500) {
    return false; // NO retry 4xx (client error)
  }
  return failureCount < 3; // Max 3 retries
},
retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // 1s, 2s, 4s, max 30s
```

#### Scenario: Retry automático con error 500

- GIVEN una query falla con status 500
- WHEN React Query detecta error
- THEN MUST reintentar después 1 segundo
- AND si falla otra vez, reintentar después 2 segundos
- AND si falla 3 veces, mostrar `<ErrorState>` al usuario

#### Scenario: NO retry con error 404

- GIVEN una query falla con status 404 (post no existe)
- WHEN React Query detecta error
- THEN MUST NOT reintentar
- AND mostrar error state inmediatamente

---

### REQ-14: Crash Reporting (Sentry)

La app **MUST** integrar Sentry para reportar crashes y errores no manejados.

**Instalación:** `@sentry/react-native`

**Configuración:**
```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  enableAutoSessionTracking: true,
  tracesSampleRate: 0.2, // 20% transactions
});
```

#### Scenario: Crash no manejado enviado a Sentry

- GIVEN la app en producción
- WHEN ocurre un error no capturado (ej: null pointer)
- THEN Sentry MUST capturar error con stack trace
- AND enviar a dashboard Sentry
- AND incluir contexto: `userId`, `platform`, `appVersion`

#### Scenario: Error boundary con Sentry

- GIVEN un error en componente React (render error)
- WHEN error boundary captura error
- THEN MUST enviar error a Sentry
- AND mostrar fallback UI al usuario ("Algo salió mal")
- AND NOT crashear toda la app

---

### REQ-15: Haptic Feedback

La app **SHOULD** incluir haptic feedback en acciones críticas (éxito, error, warning).

**Librería:** `react-native-haptic-feedback`

**Cuándo usar:**
- ✅ Success: Propuesta aceptada, pago confirmado, review enviada
- ✅ Warning: Post a punto expirar
- ✅ Error: Pago fallido, validación error
- ❌ NO usar: Eventos frecuentes (scroll, typing)

#### Scenario: Haptic feedback al aceptar propuesta

- GIVEN una propuesta en estado `pending`
- WHEN el usuario tapa "Aceptar"
- THEN la app MUST disparar `haptics.success()` (vibración sutil)
- AND el usuario MUST sentir feedback táctil (iOS Taptic Engine o Android vibration)

#### Scenario: Haptic feedback al fallar pago

- GIVEN un intent pago con MercadoPago
- WHEN el pago falla (ej: tarjeta rechazada)
- THEN la app MUST disparar `haptics.error()` (vibración distinta)
- AND mostrar toast "Error al procesar pago"

---

## Data Schema

### NotificationPreference (Nueva Tabla)

```prisma
model NotificationPreference {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  type      String   @db.VarChar(50) // Enum NotificationType (15 tipos)
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, type])
  @@index([userId])
  @@map("notification_preferences")
}
```

**Enum NotificationType:**
```typescript
enum NotificationType {
  // Fase 2
  NEW_PROPOSAL = 'new_proposal',
  PROPOSAL_ACCEPTED = 'proposal_accepted',
  PROPOSAL_REJECTED = 'proposal_rejected',
  POST_EXPIRING = 'post_expiring',
  PROPOSAL_EXPIRING = 'proposal_expiring',
  
  // Fase 3
  NEW_MESSAGE = 'new_message',
  
  // Fase 4
  PAYMENT_CONFIRMED = 'payment_confirmed',
  WORK_COMPLETED = 'work_completed',
  
  // Fase 5
  REVIEW_REMINDER = 'review_reminder',
  
  // Fase 6
  CERTIFICATION_APPROVED = 'certification_approved',
  CERTIFICATION_REJECTED = 'certification_rejected',
  DISPUTE_RESOLVED = 'dispute_resolved',
  
  // Fase 7 (nuevos)
  APPOINTMENT_REMINDER = 'appointment_reminder',
  PAYMENT_RELEASED = 'payment_released',
  NEW_PROFESSIONAL_IN_AREA = 'new_professional_in_area',
}
```

### Notification (Tabla Existente — Sin Cambios)

```prisma
model Notification {
  id      Int      @id @default(autoincrement())
  userId  Int      @map("user_id")
  type    String   @db.VarChar(50)
  title   String   @db.VarChar(100)
  body    String   @db.Text
  data    Json?    // { proposalId, postId, chatId, appointmentId, deepLink, webLink }
  read    Boolean  @default(false)
  sentAt  DateTime @default(now()) @map("sent_at") @db.Timestamptz
  
  user    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, read, sentAt(sort: Desc)])
  @@map("notifications")
}
```

---

## Deep Linking Configuration

### React Navigation Linking

**File:** `mobile/src/navigation/linking.ts`

```typescript
import { LinkingOptions } from '@react-navigation/native';

export const linkingConfig: LinkingOptions<any> = {
  prefixes: [
    'quickfixu://',
    'https://quickfixu.com',
    'https://*.quickfixu.com',
  ],
  config: {
    screens: {
      Main: {
        screens: {
          Home: 'home',
          Chats: {
            path: 'chats',
            screens: {
              ChatScreen: 'chats/:chatId',
            },
          },
          Notifications: 'notifications',
          Profile: 'profile',
        },
      },
      PostDetail: 'posts/:postId',
      AppointmentDetail: 'appointments/:appointmentId',
      LeaveReview: 'reviews/:appointmentId',
    },
  },
};
```

### iOS Universal Links

**File:** `backend/public/.well-known/apple-app-site-association`

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.quickfixu.app",
        "paths": ["/chats/*", "/posts/*", "/appointments/*", "/reviews/*"]
      }
    ]
  }
}
```

**Entitlements:** `mobile/ios/QuickFixU/QuickFixU.entitlements`

```xml
<key>com.apple.developer.associated-domains</key>
<array>
  <string>applinks:quickfixu.com</string>
  <string>applinks:app.quickfixu.com</string>
</array>
```

### Android App Links

**File:** `backend/public/.well-known/assetlinks.json`

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.quickfixu.app",
      "sha256_cert_fingerprints": ["XX:XX:XX:..."]
    }
  }
]
```

**AndroidManifest:** `mobile/android/app/src/main/AndroidManifest.xml`

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data
    android:scheme="https"
    android:host="quickfixu.com"
    android:pathPrefix="/chats" />
  <data android:pathPrefix="/posts" />
  <data android:pathPrefix="/appointments" />
  <data android:pathPrefix="/reviews" />
</intent-filter>
```

---

## Edge Cases

### Edge Case: Usuario desinstala y reinstala app (pierde onboarding flag)

**Scenario:**
- GIVEN un usuario completó onboarding
- AND desinstala app (pierde AsyncStorage)
- WHEN reinstala y hace login
- THEN la app MUST mostrar onboarding otra vez (acceptable UX)
- OR backend MAY trackear `onboarding_completed` en tabla `users` (futuro)

### Edge Case: Deep link con appointment eliminado

**Scenario:**
- GIVEN una notificación con `deepLink = "quickfixu://appointments/999"`
- AND el appointment fue eliminado (404)
- WHEN el usuario tapa notificación
- THEN la app MUST navegar a screen
- AND el screen MUST detectar 404 y mostrar error state "Appointment no encontrado"
- AND NO crashear

### Edge Case: Push notification con FCM token expirado

**Scenario:**
- GIVEN un usuario con `fcm_token` expirado o revocado
- WHEN el backend intenta enviar push
- THEN Firebase MUST retornar error `InvalidRegistration`
- AND el backend MUST eliminar token de tabla `users` (cleanup)
- AND NO reintentar envío (fail silenciosamente)

### Edge Case: Skeleton loader sin Internet (cache React Query)

**Scenario:**
- GIVEN un usuario sin conexión
- AND React Query tiene data cached
- WHEN accede a feed posts
- THEN la app MUST NOT mostrar skeleton
- AND MUST mostrar data cached inmediatamente
- AND mostrar banner offline en top

---

## Non-Functional Requirements

### Performance

- Skeleton loaders MUST aparecer en < 100ms después abrir screen
- Animaciones MUST correr a ≥ 55 FPS (target 60 FPS)
- Deep link navigation MUST completar en < 500ms
- Imágenes MUST cargar progresivamente (blur placeholder → full image)

### Accesibilidad

- Contrast ratio ≥ 4.5:1 para texto (WCAG AA)
- Screen reader support en 100% de touchables
- Font scaling hasta 150% sin romper UI

### Reliability

- Retry automático con exponential backoff para errores transitorios
- Crash reporting con Sentry (≥ 99.5% crash-free sessions)
- Offline banner visible cuando sin conexión

---

## Out of Scope (Fase 8+)

- ❌ Notificaciones in-app realtime (Socket.io) — Fase 7 usa polling 30s
- ❌ Rich notifications (imágenes en push) — Solo texto
- ❌ Notification grouping (Android) — Individual notifications
- ❌ Custom sounds per tipo notificación — Default system sound
- ❌ Scheduled local notifications (ej: reminder hoy a las 5pm) — Solo server-driven

---

## Acceptance Criteria

- ✅ Backend envía 9 tipos nuevos notificaciones push correctamente
- ✅ Centro notificaciones in-app muestra lista paginada con badge count
- ✅ Usuario puede configurar 15 tipos en `/settings/notifications`
- ✅ Deep linking funciona para todos los paths (iOS + Android)
- ✅ Skeleton loaders visible en 5+ screens
- ✅ Pull-to-refresh funciona en todas las listas
- ✅ Empty states en 5+ screens
- ✅ Error states con retry en todas las queries
- ✅ Onboarding tutorial primera vez (3 páginas)
- ✅ Performance: React.memo + fast-image + cache React Query
- ✅ Accesibilidad: Screen reader + contrast ratio WCAG AA
- ✅ Crash reporting Sentry configurado
- ✅ Haptic feedback en 5+ acciones críticas

---

## Dependencies

**Backend:**
- Fases 1-6 completadas (notificaciones base, payments, reviews, admin)
- Node.js cronjobs configurados (node-cron)
- Firebase Admin SDK para FCM
- Tabla `notifications` existente

**Mobile:**
- React Navigation 6 configurado
- React Query configurado
- `@react-native-firebase/messaging` instalado
- Socket.io client (Fase 3)

**External:**
- Firebase Cloud Messaging (FCM)
- Sentry account + DSN

---

**END OF SPECIFICATION**
