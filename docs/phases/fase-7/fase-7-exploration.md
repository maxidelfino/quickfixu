# Exploration: Fase 7 - Push Notifications & Polish

**Change name:** `fase-7-notifications-polish`  
**Date:** Marzo 2026  
**Status:** Exploration Complete  
**Prerequisite:** Fases 1-6 (Auth, Posts, Chat, Payments, Reviews, Admin) MUST be completed

---

## 1. Executive Summary

La Fase 7 es la **última fase del MVP** — completa el sistema de notificaciones y pule la experiencia de usuario. Sin esta fase, los usuarios NO reciben alertas críticas (certificación aprobada/rechazada, trabajos a punto expirar, pago liberado), la app se siente "incompleta" (sin skeleton loaders, sin empty states, sin onboarding), y hay riesgo de perder engagement (sin deep linking, sin notificaciones in-app).

**Complejidad:** MEDIA — Es la fase con mayor **cantidad de features pequeños** distribuidos en toda la app, pero sin complejidad individual alta. Requiere disciplina para **no dejar features a medio implementar** (ej: agregar deep linking pero olvidar configurar iOS Universal Links = frustrante cuando no funciona).

**Características clave:**

1. **Sistema Notificaciones Completo:** Agregar 9 tipos de notificaciones que faltan (certificación aprobada/rechazada, expiración posts/propuestas, review reminder, etc.)
2. **Notificaciones In-App:** Centro de notificaciones con badge count, marcar como leída, deep linking
3. **Preferencias de Notificaciones:** Usuario puede silenciar tipos específicos (tabla `notification_preferences`)
4. **Deep Linking:** Tap notificación → navega a pantalla correcta (React Navigation Linking)
5. **Polish UX/UI:** Skeleton loaders, pull-to-refresh, empty/error states, animaciones, haptic feedback
6. **Onboarding:** Tutorial primera vez (3-5 pantallas swipeable)
7. **Performance:** Lazy loading imágenes, memoización, optimistic UI, cache React Query
8. **Accesibilidad:** ARIA labels, contrast ratio WCAG AA, font scaling, keyboard navigation
9. **Error Handling:** Retry automático, offline banner, fallbacks, crash reporting (Sentry)
10. **App Polish:** Splash screen, app icon, statusbar style, confirmación acciones destructivas

---

## 2. Current State

### 2.1 Notificaciones Ya Implementadas (Fases 1-4)

**Fase 2 (Posts & Proposals):**
- ✅ Nueva propuesta recibida
- ✅ Propuesta aceptada
- ✅ Propuesta rechazada
- ✅ Post a punto expirar (24hs antes)
- ✅ Propuesta a punto expirar (24hs antes)

**Fase 3 (Chat):**
- ✅ Nuevo mensaje (condicional: solo si destinatario offline O online en otro chat)

**Fase 4 (Payments):**
- ✅ Pago confirmado (cliente pagó)
- ✅ Recordatorio confirmar trabajo (profesional o cliente)

**Tabla `notifications` existente:**
```prisma
model Notification {
  id      Int      @id @default(autoincrement())
  userId  Int      @map("user_id")
  type    String   @db.VarChar(50)
  title   String   @db.VarChar(100)
  body    String   @db.Text
  data    Json?    // { proposalId, postId, chatId, appointmentId, ... }
  read    Boolean  @default(false)
  sentAt  DateTime @default(now()) @map("sent_at") @db.Timestamptz
  
  user    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, read, sentAt(sort: Desc)])
  @@map("notifications")
}
```

**FCM Infrastructure:**
- ✅ Firebase Admin SDK configurado (Fase 1)
- ✅ Función `sendPushNotification(userId, title, body, data)` (Fase 2)
- ✅ Registro `fcm_token` en tabla `users` (Fase 1)
- ✅ Validación firma HMAC webhooks (Fase 4)

### 2.2 Notificaciones Faltantes (9 tipos nuevos)

**Fase 5 (Reviews) — implementadas pero no listadas arriba:**
- ⚠️ Review reminder 3 días después completar trabajo (puede estar o no, verificar)

**Fase 6 (Admin) — implementadas:**
- ⚠️ Profesional aprobado (certificación approved)
- ⚠️ Profesional rechazado (certificación rejected)

**Fase 7 (nuevas):**
- ❌ Appointment mañana (reminder 24hs antes)
- ❌ Pago liberado (cuando ambos confirman + payout completado)
- ❌ Disputa resuelta (admin tomó decisión — Fase 6)
- ❌ Nuevo profesional en zona (cliente con post abierto + profesional recién aprobado en radio 30km)

**Total:** 9 tipos nuevos (asumiendo Fase 5 y 6 NO implementaron las suyas).

### 2.3 UI/UX Estado Actual

**Implementado (Fases 1-4):**
- ✅ Loading spinners básicos (ActivityIndicator React Native)
- ✅ Error toasts (react-native-toast-message o similar)
- ✅ Bottom tab navigation (React Navigation)
- ✅ Modal confirmaciones (Alert.alert)

**Faltante:**
- ❌ Skeleton loaders (mientras cargan listas posts, chats, propuestas)
- ❌ Pull-to-refresh (RefreshControl)
- ❌ Empty states (sin posts, sin chats, sin notificaciones)
- ❌ Error states (network error, 500 server error)
- ❌ Animaciones transiciones (Reanimated)
- ❌ Haptic feedback (Haptics API)
- ❌ Onboarding tutorial primera vez
- ❌ Deep linking configurado (iOS Universal Links + Android App Links)
- ❌ Centro notificaciones in-app (pantalla `/notifications`)
- ❌ Preferencias notificaciones (pantalla `/settings/notifications`)

### 2.4 Stack Tecnológico (Fases 1-4)

**Frontend:**
- React Native (bare workflow, NO Expo managed)
- React Navigation 6 (stack + bottom tabs)
- Zustand (state management)
- React Query (API cache)
- Socket.io Client (chat real-time)
- @react-native-firebase/messaging (FCM)
- react-native-toast-message (toasts)
- @react-native-async-storage/async-storage (local storage)

**Backend:**
- Node.js + TypeScript + Express
- Prisma ORM + PostgreSQL 15 + PostGIS
- Socket.io Server
- node-cron (scheduled tasks)
- Firebase Admin SDK (FCM server)
- Redis (cache + rate limiting)

**External:**
- Firebase Cloud Messaging (push notifications)
- Cloudinary (media storage)
- MercadoPago (payments)
- Nominatim (geocoding)

---

## 3. Affected Areas

### 3.1 Backend (Node.js + TypeScript)

**Archivos a crear:**
- `backend/src/services/notificationPreferences.service.ts` — Lógica preferencias usuario
- `backend/src/controllers/notificationPreferences.controller.ts` — Endpoints preferencias
- `backend/src/routes/notificationPreferences.routes.ts` — Rutas `/api/notifications/preferences`
- `backend/src/cron/appointmentReminders.cron.ts` — Cronjob recordatorio 24hs antes appointment
- `backend/src/cron/payoutReleaseNotifications.cron.ts` — Notificar payout liberado
- `backend/src/cron/reviewReminders.cron.ts` — Reminder review 3 días después
- `backend/src/services/deepLinking.service.ts` — Generar URLs deep links

**Archivos a modificar:**
- `backend/src/services/notification.service.ts` — Agregar 9 tipos nuevos notificaciones, filtrar por preferencias
- `backend/src/cron/index.ts` — Registrar nuevos cronjobs
- `backend/prisma/schema.prisma` — Agregar tabla `notification_preferences`
- `backend/src/controllers/notification.controller.ts` — Endpoint mark all as read, delete notification
- `backend/src/services/professional.service.ts` — Enviar notif cuando certificación approved/rejected
- `backend/src/services/appointment.service.ts` — Enviar notif pago liberado

### 3.2 Mobile App (React Native)

**Archivos a crear:**
- `mobile/src/screens/NotificationsScreen.tsx` — Centro notificaciones in-app
- `mobile/src/screens/NotificationPreferencesScreen.tsx` — Configurar qué notificaciones recibir
- `mobile/src/screens/OnboardingScreen.tsx` — Tutorial primera vez (3-5 pantallas swipeable)
- `mobile/src/components/SkeletonPostCard.tsx` — Skeleton loader post feed
- `mobile/src/components/SkeletonChatList.tsx` — Skeleton loader lista chats
- `mobile/src/components/SkeletonProposalCard.tsx` — Skeleton loader propuestas
- `mobile/src/components/EmptyState.tsx` — Componente reutilizable empty state
- `mobile/src/components/ErrorState.tsx` — Componente reutilizable error state
- `mobile/src/navigation/linking.ts` — React Navigation Linking config
- `mobile/src/utils/deepLinking.ts` — Parsear URLs, navegar a pantalla correcta
- `mobile/src/utils/haptics.ts` — Wrapper Haptics API
- `mobile/src/hooks/usePullToRefresh.ts` — Hook reutilizable RefreshControl
- `mobile/src/hooks/useNotifications.ts` — Hook manejo notificaciones FCM + in-app

**Archivos a modificar:**
- `mobile/src/navigation/index.tsx` — Configurar deep linking
- `mobile/src/App.tsx` — Detectar primer uso (onboarding), configurar deep linking, Sentry
- `mobile/src/screens/PostFeedScreen.tsx` — Skeleton + pull-to-refresh + empty state
- `mobile/src/screens/ChatsScreen.tsx` — Skeleton + pull-to-refresh + empty state
- `mobile/src/screens/ProposalsScreen.tsx` — Skeleton + pull-to-refresh + empty state
- `mobile/src/screens/SettingsScreen.tsx` — Link a preferencias notificaciones
- `mobile/android/app/src/main/AndroidManifest.xml` — Android App Links config
- `mobile/ios/QuickFixU/Info.plist` — iOS Universal Links config
- `mobile/ios/QuickFixU/AppDelegate.m` — Deep link handler iOS
- `mobile/android/app/src/main/java/.../MainActivity.java` — Deep link handler Android

### 3.3 Database (PostgreSQL + Prisma)

**Nueva tabla:**
```prisma
model NotificationPreference {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  type      String   @db.VarChar(50) // 'new_proposal', 'message', 'payment', etc.
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, type])
  @@index([userId])
  @@map("notification_preferences")
}
```

**Migraciones:**
1. Crear tabla `notification_preferences`
2. Seed defaults para usuarios existentes (todos types `enabled=true`)
3. Agregar constraints UNIQUE `[userId, type]`

---

## 4. Approaches

### 4.1 Approach: Sistema Notificaciones Completo

#### Opción A: Cronjobs Separados por Tipo (RECOMENDADO)

**Arquitectura:**
```typescript
// backend/src/cron/appointmentReminders.cron.ts
export const scheduleAppointmentReminders = () => {
  cron.schedule('0 9 * * *', async () => { // Ejecuta 9am todos los días
    const tomorrow = addDays(new Date(), 1);
    const appointments = await prisma.appointment.findMany({
      where: {
        scheduledDate: tomorrow,
        status: 'scheduled',
      },
      include: { client: true, professional: true },
    });

    for (const apt of appointments) {
      // Notificar cliente
      await notificationService.sendAppointmentReminderNotification(
        apt.clientId,
        apt.professionalId,
        apt.scheduledTime
      );
      // Notificar profesional
      await notificationService.sendAppointmentReminderNotification(
        apt.professionalId,
        apt.clientId,
        apt.scheduledTime
      );
    }
  });
};
```

**Pros:**
- ✅ **Separación responsabilidades:** Un cronjob por tipo evento (SOLID Single Responsibility)
- ✅ **Fácil debug:** Logs aislados por tipo notificación
- ✅ **Escalable:** Puedo cambiar frecuencia por tipo (ej: appointment reminders 1x/día, payout checks 1x/hora)
- ✅ **Testing simple:** Test unitario por cronjob

**Cons:**
- ⚠️ **Más archivos:** 4-5 archivos cronjob (vs 1 monolítico)
- ⚠️ **Duplicación código:** Lógica similar de query + loop + send notification (mitigable con helper `notificationBatchSend`)

**Effort:** MEDIO (2-3 días backend — 5 cronjobs nuevos + refactor `notification.service.ts`)

---

#### Opción B: Cronjob Monolítico con Switch Statement

**Arquitectura:**
```typescript
// backend/src/cron/allNotifications.cron.ts
export const scheduleAllNotifications = () => {
  cron.schedule('*/10 * * * *', async () => { // Cada 10 minutos
    const now = new Date();
    
    // Appointment reminders (24hs antes)
    const appointments = await prisma.appointment.findMany({
      where: { scheduledDate: addDays(now, 1), status: 'scheduled' },
    });
    appointments.forEach(apt => sendAppointmentReminder(apt));
    
    // Review reminders (3 días después completado)
    const completedAppointments = await prisma.appointment.findMany({
      where: { completedAt: subDays(now, 3), reviewSent: false },
    });
    completedAppointments.forEach(apt => sendReviewReminder(apt));
    
    // ... otros tipos
  });
};
```

**Pros:**
- ✅ **Menos archivos:** 1 solo cronjob
- ✅ **Sincronización garantizada:** Todas notificaciones se procesan en mismo ciclo

**Cons:**
- ❌ **Violación SRP:** Un cronjob hace 5 cosas distintas
- ❌ **Hard to test:** Tests mixtos (mock múltiples queries)
- ❌ **Frecuencia única:** Todas notificaciones cada 10 min (ineficiente — appointment reminders solo necesitan 1x/día)
- ❌ **Logs mezclados:** Difícil ver errores por tipo

**Effort:** MEDIO (2 días backend)

**Decisión:** ✅ **Opción A (Cronjobs Separados)** — Mejor arquitectura, debugging más fácil, frecuencias personalizadas.

---

### 4.2 Approach: Notificaciones In-App (Centro de Notificaciones)

#### Opción A: Tabla `notifications` Existente + Endpoint `/api/notifications` (RECOMENDADO)

**Arquitectura:**
```typescript
// backend/src/controllers/notification.controller.ts
export const getUserNotifications = async (req: Request, res: Response) => {
  const { userId } = req.user;
  const { limit = 50, offset = 0 } = req.query;
  
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { sentAt: 'desc' },
    take: Number(limit),
    skip: Number(offset),
  });
  
  const unreadCount = await prisma.notification.count({
    where: { userId, read: false },
  });
  
  res.json({ notifications, unreadCount });
};

export const markAsRead = async (req: Request, res: Response) => {
  const { notificationId } = req.params;
  const { userId } = req.user;
  
  await prisma.notification.updateMany({
    where: { id: Number(notificationId), userId },
    data: { read: true },
  });
  
  res.json({ success: true });
};

export const markAllAsRead = async (req: Request, res: Response) => {
  const { userId } = req.user;
  
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  
  res.json({ success: true });
};
```

**Mobile App:**
```tsx
// mobile/src/screens/NotificationsScreen.tsx
export const NotificationsScreen = () => {
  const { data, isLoading, refetch } = useQuery(
    ['notifications'],
    () => api.get('/api/notifications?limit=50'),
    { refetchInterval: 30000 } // Refetch cada 30s
  );
  
  const markAsReadMutation = useMutation(
    (notificationId: number) => api.patch(`/api/notifications/${notificationId}/read`),
    { onSuccess: () => queryClient.invalidateQueries(['notifications']) }
  );
  
  const handleNotificationPress = async (notification: Notification) => {
    await markAsReadMutation.mutateAsync(notification.id);
    navigateToDeepLink(notification.data); // Deep linking
  };
  
  return (
    <FlatList
      data={data?.notifications}
      renderItem={({ item }) => (
        <NotificationCard
          notification={item}
          onPress={() => handleNotificationPress(item)}
        />
      )}
      ListEmptyComponent={<EmptyState message="No tienes notificaciones" />}
    />
  );
};
```

**Pros:**
- ✅ **Reutiliza tabla existente:** No nueva tabla, campo `read` ya existe
- ✅ **Simple:** CRUD básico (GET, PATCH)
- ✅ **React Query cache:** Optimistic UI + auto-refetch
- ✅ **Badge count:** Query separado `count WHERE read=false`

**Cons:**
- ⚠️ **Polling:** Refetch cada 30s (puede ser suboptimal — mitigable con Socket.io realtime)

**Effort:** BAJO (1 día backend + 1 día mobile)

---

#### Opción B: Notificaciones In-App Realtime (Socket.io)

**Arquitectura:**
```typescript
// backend/src/socket/handlers/notifications.handler.ts
export const notificationHandlers = (socket: Socket) => {
  socket.on('notifications:subscribe', async () => {
    const userId = socket.data.userId;
    socket.join(`notifications:${userId}`);
  });
};

// backend/src/services/notification.service.ts
async sendPushNotification(userId: number, title: string, body: string, data: any) {
  // ... FCM send (igual que antes)
  
  // NUEVO: Broadcast via Socket.io
  io.to(`notifications:${userId}`).emit('notification:new', {
    id: notification.id,
    title,
    body,
    data,
    sentAt: new Date(),
  });
}
```

**Mobile App:**
```tsx
// mobile/src/hooks/useNotifications.ts
export const useNotifications = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const socket = useSocket();
  
  useEffect(() => {
    socket.emit('notifications:subscribe');
    
    socket.on('notification:new', (notification) => {
      setUnreadCount(prev => prev + 1);
      queryClient.setQueryData(['notifications'], (old: any) => ({
        ...old,
        notifications: [notification, ...old.notifications],
      }));
    });
    
    return () => socket.off('notification:new');
  }, []);
  
  return { unreadCount };
};
```

**Pros:**
- ✅ **Realtime:** Badge count actualiza instantáneamente sin polling
- ✅ **Eficiente:** Socket.io reutiliza conexión existente (Fase 3 chat)

**Cons:**
- ⚠️ **Complejidad adicional:** Requiere handler Socket.io + client subscription
- ⚠️ **Edge case:** Si app cerrada → NO recibe evento (solo push FCM) → necesita refetch al abrir

**Effort:** MEDIO (2 días backend + mobile)

**Decisión:** ✅ **Opción A (Polling 30s)** para MVP — Más simple, suficiente para notificaciones (no son tan críticas como mensajes chat). Migrar a Socket.io en Fase 8 si UX lo requiere.

---

### 4.3 Approach: Preferencias de Notificaciones

#### Opción A: Granularidad por Tipo (RECOMENDADO)

**Tipos de notificaciones:**
```typescript
enum NotificationType {
  NEW_PROPOSAL = 'new_proposal',
  PROPOSAL_ACCEPTED = 'proposal_accepted',
  PROPOSAL_REJECTED = 'proposal_rejected',
  NEW_MESSAGE = 'new_message',
  PAYMENT_CONFIRMED = 'payment_confirmed',
  PAYMENT_RELEASED = 'payment_released',
  WORK_COMPLETED = 'work_completed',
  REVIEW_REMINDER = 'review_reminder',
  APPOINTMENT_REMINDER = 'appointment_reminder',
  POST_EXPIRING = 'post_expiring',
  PROPOSAL_EXPIRING = 'proposal_expiring',
  CERTIFICATION_APPROVED = 'certification_approved',
  CERTIFICATION_REJECTED = 'certification_rejected',
  DISPUTE_RESOLVED = 'dispute_resolved',
  NEW_PROFESSIONAL_IN_AREA = 'new_professional_in_area',
}
```

**Defaults (al crear usuario):**
```typescript
const DEFAULT_PREFERENCES = [
  // Críticas (siempre ON por defecto)
  { type: 'payment_confirmed', enabled: true },
  { type: 'payment_released', enabled: true },
  { type: 'certification_approved', enabled: true },
  { type: 'certification_rejected', enabled: true },
  { type: 'dispute_resolved', enabled: true },
  
  // Engagement (ON por defecto)
  { type: 'new_proposal', enabled: true },
  { type: 'proposal_accepted', enabled: true },
  { type: 'new_message', enabled: true },
  
  // Marketing (OFF por defecto)
  { type: 'review_reminder', enabled: false },
  { type: 'new_professional_in_area', enabled: false },
];
```

**Lógica filtrado (antes de enviar push):**
```typescript
// backend/src/services/notification.service.ts
async sendPushNotification(userId: number, type: NotificationType, title: string, body: string, data: any) {
  // Check preferencias usuario
  const preference = await prisma.notificationPreference.findUnique({
    where: { userId_type: { userId, type } },
  });
  
  if (preference && !preference.enabled) {
    console.log(`[Notification] Skipped (user disabled): ${type} for user ${userId}`);
    return; // Usuario silenció este tipo
  }
  
  // Enviar push + guardar in-app
  // ... (lógica existente)
}
```

**UI Settings:**
```tsx
// mobile/src/screens/NotificationPreferencesScreen.tsx
export const NotificationPreferencesScreen = () => {
  const { data: preferences, isLoading } = useQuery(['notification-preferences']);
  const updateMutation = useMutation(
    ({ type, enabled }: { type: string; enabled: boolean }) =>
      api.patch('/api/notifications/preferences', { type, enabled })
  );
  
  return (
    <ScrollView>
      <Text style={styles.sectionHeader}>Críticas</Text>
      <SwitchRow label="Pagos confirmados" value={preferences.payment_confirmed} />
      <SwitchRow label="Pagos liberados" value={preferences.payment_released} />
      
      <Text style={styles.sectionHeader}>Engagement</Text>
      <SwitchRow label="Nuevas propuestas" value={preferences.new_proposal} />
      <SwitchRow label="Mensajes" value={preferences.new_message} />
      
      <Text style={styles.sectionHeader}>Marketing</Text>
      <SwitchRow label="Recordatorios reviews" value={preferences.review_reminder} />
      <SwitchRow label="Nuevos profesionales en zona" value={preferences.new_professional_in_area} />
    </ScrollView>
  );
};
```

**Pros:**
- ✅ **Control granular:** Usuario elige qué recibir
- ✅ **Mejor UX:** Reduce notifications fatigue
- ✅ **Compliance:** Muchos países requieren opt-out (GDPR, CCPA)

**Cons:**
- ⚠️ **15 tipos:** Tabla puede crecer (mitigable: unique constraint `[userId, type]`)
- ⚠️ **Seed migration:** Usuarios existentes necesitan defaults (1-time migration)

**Effort:** MEDIO (2 días backend + 1 día mobile)

---

#### Opción B: Granularidad por Categoría

**Categorías:**
```typescript
enum NotificationCategory {
  TRANSACTIONAL = 'transactional', // Pagos, certificación
  ENGAGEMENT = 'engagement',        // Propuestas, mensajes
  MARKETING = 'marketing',          // Reminders, profesionales nuevos
}
```

**Menos granularidad:**
- Usuario puede silenciar "Marketing" pero NO puede silenciar "Review reminders" específicamente

**Pros:**
- ✅ **Menos opciones:** UI más simple (3 toggles vs 15)

**Cons:**
- ❌ **Menos control:** Usuario no puede personalizar finamente (ej: quiere appointment reminders pero NO review reminders — en esta opción no puede)

**Effort:** BAJO (1 día backend + mobile)

**Decisión:** ✅ **Opción A (Granularidad por Tipo)** — Mayor control usuario, mejor UX, estándar industria.

---

### 4.4 Approach: Deep Linking

#### Opción A: React Navigation Linking Config + Universal Links/App Links (RECOMENDADO)

**React Navigation Linking:**
```typescript
// mobile/src/navigation/linking.ts
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

// mobile/src/App.tsx
import { NavigationContainer } from '@react-navigation/native';
import { linkingConfig } from './navigation/linking';

export default function App() {
  return (
    <NavigationContainer linking={linkingConfig}>
      <RootNavigator />
    </NavigationContainer>
  );
}
```

**iOS Universal Links:**
```xml
<!-- mobile/ios/QuickFixU/QuickFixU.entitlements -->
<key>com.apple.developer.associated-domains</key>
<array>
  <string>applinks:quickfixu.com</string>
  <string>applinks:app.quickfixu.com</string>
</array>
```

**Backend:** Servir `apple-app-site-association` file
```json
// backend/public/.well-known/apple-app-site-association
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

**Android App Links:**
```xml
<!-- mobile/android/app/src/main/AndroidManifest.xml -->
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
</intent-filter>
```

**Backend:** Servir `assetlinks.json`
```json
// backend/public/.well-known/assetlinks.json
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

**Notificación con deep link:**
```typescript
// backend/src/services/notification.service.ts
async sendNewProposalNotification(userId: number, proposalId: number, clientName: string) {
  const title = 'Nueva propuesta';
  const body = `${clientName} envió una propuesta`;
  const data = {
    type: 'new_proposal',
    proposalId,
    deepLink: `quickfixu://chats/${proposalId}`, // Custom scheme fallback
    webLink: `https://quickfixu.com/chats/${proposalId}`, // Universal/App Link
  };
  
  await this.sendPushNotification(userId, title, body, data);
}
```

**Mobile app handling:**
```tsx
// mobile/src/hooks/useDeepLinking.ts
import messaging from '@react-native-firebase/messaging';
import { useNavigation } from '@react-navigation/native';

export const useDeepLinking = () => {
  const navigation = useNavigation();
  
  useEffect(() => {
    // Handle notification tap (app closed/background)
    messaging().onNotificationOpenedApp(remoteMessage => {
      const { deepLink, type, proposalId, chatId, appointmentId } = remoteMessage.data;
      
      if (deepLink) {
        Linking.openURL(deepLink); // React Navigation auto-handles
      } else {
        // Fallback manual navigation
        switch (type) {
          case 'new_proposal':
          case 'new_message':
            navigation.navigate('ChatScreen', { chatId });
            break;
          case 'payment_released':
            navigation.navigate('AppointmentDetail', { appointmentId });
            break;
          case 'review_reminder':
            navigation.navigate('LeaveReview', { appointmentId });
            break;
        }
      }
    });
    
    // Handle notification received while app open
    messaging().onMessage(async remoteMessage => {
      // Show in-app banner (react-native-notifee)
      notifee.displayNotification({
        title: remoteMessage.notification.title,
        body: remoteMessage.notification.body,
        data: remoteMessage.data,
      });
    });
  }, []);
};
```

**Pros:**
- ✅ **Standard industry:** Universal Links (iOS) + App Links (Android) = mejor UX (no pide "Abrir con...")
- ✅ **Integración nativa React Navigation:** `linking` prop auto-maneja URLs
- ✅ **Fallback custom scheme:** `quickfixu://` si Universal Links falla
- ✅ **Web fallback:** Si app no instalada → abre web (futuro)

**Cons:**
- ⚠️ **Setup iOS/Android:** Requiere configurar entitlements, signing, assetlinks (1-time)
- ⚠️ **Backend files:** Servir `.well-known/` files (simple static middleware)

**Effort:** MEDIO (1 día setup iOS/Android + 1 día integración React Navigation)

---

#### Opción B: Solo Custom Scheme (quickfixu://)

**No configurar Universal Links:**
```typescript
const linkingConfig = {
  prefixes: ['quickfixu://'],
  config: { /* mismo que arriba */ },
};
```

**Pros:**
- ✅ **Setup más simple:** No necesita `.well-known/` files

**Cons:**
- ❌ **UX peor:** Usuario ve diálogo "Abrir con QuickFixU?" cada vez
- ❌ **No fallback web:** Si app no instalada → error

**Effort:** BAJO (1 día)

**Decisión:** ✅ **Opción A (Universal Links + App Links)** — Standard industria, mejor UX, prepara para web app futuro.

---

### 4.5 Approach: Polish UX/UI

#### 4.5.1 Skeleton Loaders

**Opción A: react-native-skeleton-placeholder (RECOMENDADO)**

**Instalación:**
```bash
npm install react-native-skeleton-placeholder
```

**Uso:**
```tsx
// mobile/src/components/SkeletonPostCard.tsx
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';

export const SkeletonPostCard = () => (
  <SkeletonPlaceholder>
    <SkeletonPlaceholder.Item flexDirection="row" padding={16}>
      <SkeletonPlaceholder.Item width={50} height={50} borderRadius={25} />
      <SkeletonPlaceholder.Item marginLeft={16} flex={1}>
        <SkeletonPlaceholder.Item width="80%" height={20} />
        <SkeletonPlaceholder.Item width="60%" height={16} marginTop={8} />
      </SkeletonPlaceholder.Item>
    </SkeletonPlaceholder.Item>
  </SkeletonPlaceholder>
);

// mobile/src/screens/PostFeedScreen.tsx
export const PostFeedScreen = () => {
  const { data, isLoading } = useQuery(['posts']);
  
  if (isLoading) {
    return (
      <>
        <SkeletonPostCard />
        <SkeletonPostCard />
        <SkeletonPostCard />
      </>
    );
  }
  
  return <FlatList data={data} ... />;
};
```

**Pros:**
- ✅ **Librería popular:** 2.3k stars, mantenida
- ✅ **Animación shimmer incluida:** Efecto wave automático
- ✅ **Simple API:** `<SkeletonPlaceholder.Item>` replica layout

**Cons:**
- ⚠️ **Bundle size:** +20KB (mitigable con tree-shaking)

**Effort:** BAJO (1 día — crear 5-6 skeleton components)

---

**Opción B: react-content-loader (Web-focused)**

NO compatible con React Native nativo (usa SVG web).

**Effort:** N/A

**Decisión:** ✅ **Opción A (react-native-skeleton-placeholder)** — Única opción viable React Native.

---

#### 4.5.2 Pull-to-Refresh

**Implementación nativa:**
```tsx
// mobile/src/hooks/usePullToRefresh.ts
import { useState } from 'react';
import { RefreshControl } from 'react-native';

export const usePullToRefresh = (refetchFn: () => Promise<void>) => {
  const [refreshing, setRefreshing] = useState(false);
  
  const onRefresh = async () => {
    setRefreshing(true);
    await refetchFn();
    setRefreshing(false);
  };
  
  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
  );
  
  return { refreshControl };
};

// mobile/src/screens/PostFeedScreen.tsx
export const PostFeedScreen = () => {
  const { data, refetch } = useQuery(['posts']);
  const { refreshControl } = usePullToRefresh(refetch);
  
  return (
    <FlatList
      data={data}
      refreshControl={refreshControl}
      ...
    />
  );
};
```

**Pros:**
- ✅ **Nativo React Native:** `RefreshControl` built-in
- ✅ **React Query integración:** `refetch()` invalida cache

**Cons:**
- Ninguno

**Effort:** BAJO (0.5 días — aplicar en 5-6 pantallas)

**Decisión:** ✅ **Usar RefreshControl nativo** — Standard, cero dependencias.

---

#### 4.5.3 Empty States

**Componente reutilizable:**
```tsx
// mobile/src/components/EmptyState.tsx
import LottieView from 'lottie-react-native';

interface EmptyStateProps {
  icon?: string; // Lottie animation URL
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  subtitle,
  actionLabel,
  onActionPress,
}) => (
  <View style={styles.container}>
    {icon && <LottieView source={icon} autoPlay loop style={styles.lottie} />}
    <Text style={styles.title}>{title}</Text>
    {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    {actionLabel && (
      <Button title={actionLabel} onPress={onActionPress} />
    )}
  </View>
);

// Uso:
<FlatList
  data={posts}
  ListEmptyComponent={
    <EmptyState
      icon={require('./assets/empty-box.json')}
      title="No hay posts activos"
      subtitle="Sé el primero en publicar un trabajo"
      actionLabel="Crear Post"
      onActionPress={() => navigation.navigate('CreatePost')}
    />
  }
/>
```

**Lottie animations:**
- Free: LottieFiles community (CC license)
- Alternative: Iconos SVG estáticos (react-native-svg)

**Pros:**
- ✅ **Reutilizable:** Un componente para toda la app
- ✅ **Animations delight:** Lottie mejora UX
- ✅ **CTA integrado:** Botón acción (opcional)

**Effort:** BAJO (1 día — componente + aplicar en 5-6 pantallas)

**Decisión:** ✅ **Componente EmptyState reutilizable con Lottie opcional** — Balance delight vs complejidad.

---

#### 4.5.4 Error States

**Componente reutilizable:**
```tsx
// mobile/src/components/ErrorState.tsx
export const ErrorState: React.FC<{
  error: Error;
  onRetry: () => void;
}> = ({ error, onRetry }) => {
  const isNetworkError = error.message.includes('Network');
  
  return (
    <View style={styles.container}>
      <Icon name={isNetworkError ? 'wifi-off' : 'alert-circle'} size={64} color="red" />
      <Text style={styles.title}>
        {isNetworkError ? 'Sin conexión' : 'Algo salió mal'}
      </Text>
      <Text style={styles.subtitle}>{error.message}</Text>
      <Button title="Reintentar" onPress={onRetry} />
    </View>
  );
};

// Uso:
const { data, error, refetch } = useQuery(['posts']);

if (error) {
  return <ErrorState error={error} onRetry={refetch} />;
}
```

**Pros:**
- ✅ **Manejo errores consistente:** Mismo UI en toda app
- ✅ **Retry automático:** React Query exponential backoff (config)

**Effort:** BAJO (0.5 días)

**Decisión:** ✅ **Componente ErrorState reutilizable** — Standard pattern.

---

#### 4.5.5 Animaciones (Reanimated)

**Opción A: react-native-reanimated 2 (RECOMENDADO)**

**Instalación:**
```bash
npm install react-native-reanimated
```

**Ejemplos:**
```tsx
// Fade in animation
import Animated, { FadeIn } from 'react-native-reanimated';

<Animated.View entering={FadeIn.duration(500)}>
  <PostCard post={post} />
</Animated.View>

// Swipe to delete
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';

const translateX = useSharedValue(0);

const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: translateX.value }],
}));

<PanGestureHandler onGestureEvent={...}>
  <Animated.View style={animatedStyle}>
    <NotificationCard />
  </Animated.View>
</PanGestureHandler>
```

**Pros:**
- ✅ **60 FPS:** Runs on UI thread (no JS bridge)
- ✅ **Built-in presets:** `FadeIn`, `SlideInLeft`, etc.
- ✅ **Gesture handling:** Integra con `react-native-gesture-handler`

**Cons:**
- ⚠️ **Bundle size:** +150KB
- ⚠️ **Setup:** Requiere Babel plugin

**Effort:** MEDIO (2 días — setup + aplicar en 5-6 pantallas)

---

**Opción B: Animated API nativa**

```tsx
import { Animated } from 'react-native';

const fadeAnim = useRef(new Animated.Value(0)).current;

useEffect(() => {
  Animated.timing(fadeAnim, {
    toValue: 1,
    duration: 500,
    useNativeDriver: true,
  }).start();
}, []);

<Animated.View style={{ opacity: fadeAnim }}>
  <PostCard />
</Animated.View>
```

**Pros:**
- ✅ **Nativo:** No dependencias

**Cons:**
- ⚠️ **Menos performant:** Runs on JS thread (puede drop frames)
- ⚠️ **Verboso:** Más código para animaciones complejas

**Effort:** BAJO (1 día)

**Decisión:** ✅ **Opción A (Reanimated 2)** para transiciones críticas (swipe, shared elements). Usar Animated API nativo para fade/scale simple (evitar over-engineering).

---

#### 4.5.6 Haptic Feedback

**Implementación:**
```typescript
// mobile/src/utils/haptics.ts
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const options = {
  enableVibrateFallback: true, // Android fallback
  ignoreAndroidSystemSettings: false,
};

export const haptics = {
  success: () => ReactNativeHapticFeedback.trigger('notificationSuccess', options),
  warning: () => ReactNativeHapticFeedback.trigger('notificationWarning', options),
  error: () => ReactNativeHapticFeedback.trigger('notificationError', options),
  light: () => ReactNativeHapticFeedback.trigger('impactLight', options),
  medium: () => ReactNativeHapticFeedback.trigger('impactMedium', options),
  heavy: () => ReactNativeHapticFeedback.trigger('impactHeavy', options),
};

// Uso:
import { haptics } from '@/utils/haptics';

const handleAcceptProposal = async () => {
  await acceptProposal(proposalId);
  haptics.success(); // Vibración sutil
};
```

**Cuándo usar:**
- ✅ Success: Propuesta aceptada, pago confirmado, review enviado
- ✅ Warning: Post a punto expirar, reprogramación límite
- ✅ Error: Pago fallido, validación error
- ✅ Light: Button press (opcional, no todas)
- ❌ NO usar en eventos frecuentes (scroll, typing)

**Pros:**
- ✅ **UX delight:** Feedback táctil mejora perceived performance
- ✅ **Librería madura:** react-native-haptic-feedback

**Cons:**
- ⚠️ **iOS vs Android:** Diferentes patterns (iOS Taptic Engine más rico)

**Effort:** BAJO (0.5 días — aplicar en 10-15 acciones críticas)

**Decisión:** ✅ **Agregar haptics en acciones críticas** — Delight con esfuerzo mínimo.

---

### 4.6 Approach: Onboarding

#### Opción A: react-native-onboarding-swiper (RECOMENDADO)

**Instalación:**
```bash
npm install react-native-onboarding-swiper
```

**Implementación:**
```tsx
// mobile/src/screens/OnboardingScreen.tsx
import Onboarding from 'react-native-onboarding-swiper';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const OnboardingScreen = ({ navigation }) => {
  const handleDone = async () => {
    await AsyncStorage.setItem('onboarding_completed', 'true');
    navigation.replace('Main');
  };
  
  return (
    <Onboarding
      onDone={handleDone}
      onSkip={handleDone}
      pages={[
        {
          backgroundColor: '#fff',
          image: <Image source={require('./assets/onboarding-1.png')} />,
          title: 'Encuentra profesionales certificados',
          subtitle: 'Electricistas, plomeros y gasistas verificados cerca tuyo',
        },
        {
          backgroundColor: '#fff',
          image: <Image source={require('./assets/onboarding-2.png')} />,
          title: 'Recibe propuestas en minutos',
          subtitle: 'Compara precios y elige el mejor profesional',
        },
        {
          backgroundColor: '#fff',
          image: <Image source={require('./assets/onboarding-3.png')} />,
          title: 'Paga seguro',
          subtitle: 'Tu dinero protegido hasta confirmar el trabajo',
        },
      ]}
    />
  );
};

// mobile/src/App.tsx
export default function App() {
  const [onboardingCompleted, setOnboardingCompleted] = useState(null);
  
  useEffect(() => {
    AsyncStorage.getItem('onboarding_completed').then(value => {
      setOnboardingCompleted(value === 'true');
    });
  }, []);
  
  if (onboardingCompleted === null) return <SplashScreen />;
  
  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!onboardingCompleted && (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        )}
        <Stack.Screen name="Main" component={MainNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

**Contenido páginas:**
1. **Página 1 (Cliente):** "Encuentra profesionales certificados"
2. **Página 2 (Cliente):** "Recibe propuestas en minutos"
3. **Página 3 (Ambos):** "Paga seguro — Tu dinero protegido"
4. **Página 4 (Profesional):** "Recibe trabajos constantes sin comisión" (solo si `role=professional`)

**Diferenciación por rol:**
```tsx
const isProfessional = useAuthStore(state => state.user?.role === 'professional');

const pages = isProfessional ? PROFESSIONAL_PAGES : CLIENT_PAGES;
```

**Pros:**
- ✅ **Librería popular:** 1.8k stars
- ✅ **Skip incluido:** Botón "Saltar" siempre visible
- ✅ **Swipeable:** Gesture nativo iOS/Android

**Cons:**
- ⚠️ **Personalización limitada:** UI fija (mitigable con custom components)

**Effort:** BAJO (1 día — diseñar 3-4 páginas + copy)

---

**Opción B: Custom Onboarding (FlatList paginated)**

**Implementación:**
```tsx
const [currentPage, setCurrentPage] = useState(0);
const flatListRef = useRef<FlatList>(null);

const handleNext = () => {
  if (currentPage < pages.length - 1) {
    flatListRef.current?.scrollToIndex({ index: currentPage + 1 });
    setCurrentPage(currentPage + 1);
  } else {
    handleDone();
  }
};

<FlatList
  ref={flatListRef}
  data={pages}
  horizontal
  pagingEnabled
  showsHorizontalScrollIndicator={false}
  renderItem={({ item }) => <OnboardingPage page={item} />}
/>
```

**Pros:**
- ✅ **Control total:** Custom UI/animations

**Cons:**
- ⚠️ **Más código:** Manejar scroll, dots indicator, skip logic

**Effort:** MEDIO (2 días)

**Decisión:** ✅ **Opción A (react-native-onboarding-swiper)** — MVP no necesita customización extrema.

---

### 4.7 Approach: Performance Optimization

#### 4.7.1 Lazy Loading Imágenes

**Opción A: react-native-fast-image (RECOMENDADO)**

**Instalación:**
```bash
npm install react-native-fast-image
```

**Uso:**
```tsx
import FastImage from 'react-native-fast-image';

<FastImage
  source={{
    uri: post.imageUrl,
    priority: FastImage.priority.normal,
    cache: FastImage.cacheControl.immutable,
  }}
  style={{ width: 100, height: 100 }}
  resizeMode={FastImage.resizeMode.cover}
/>
```

**Pros:**
- ✅ **Cache nativo:** SDWebImage (iOS) + Glide (Android)
- ✅ **Preload:** `FastImage.preload([{ uri: '...' }])`
- ✅ **Placeholder:** `defaultSource` prop

**Cons:**
- ⚠️ **Deprecated:** No updates desde 2021 (pero funcional)

**Effort:** BAJO (1 día — reemplazar `<Image>` en toda app)

---

**Opción B: expo-image (Si usas Expo)**

QuickFixU usa **bare workflow** (no Expo managed), pero `expo-image` funciona con `npx install-expo-modules`.

**Instalación:**
```bash
npx install-expo-modules
npm install expo-image
```

**Uso:**
```tsx
import { Image } from 'expo-image';

<Image
  source={{ uri: post.imageUrl }}
  placeholder={require('./assets/placeholder.png')}
  contentFit="cover"
  transition={200}
/>
```

**Pros:**
- ✅ **Mantenido activamente:** Expo team
- ✅ **Blur hash:** Placeholder progressive
- ✅ **Cache control:** Similar a fast-image

**Cons:**
- ⚠️ **Requiere Expo modules:** Agrega dependencia Expo

**Effort:** MEDIO (2 días — setup expo-modules + migrar)

**Decisión:** ✅ **Opción A (react-native-fast-image)** — Menos dependencias, suficiente para MVP.

---

#### 4.7.2 Memoización React

**Uso estratégico:**
```tsx
// mobile/src/components/PostCard.tsx
import { memo } from 'react';

export const PostCard = memo<PostCardProps>(({ post, onPress }) => (
  <TouchableOpacity onPress={onPress}>
    <Text>{post.title}</Text>
    <Text>{post.description}</Text>
  </TouchableOpacity>
), (prevProps, nextProps) => {
  // Custom comparison: solo re-render si post.id cambió
  return prevProps.post.id === nextProps.post.id;
});

// mobile/src/screens/PostFeedScreen.tsx
const renderItem = useCallback(({ item }: { item: Post }) => (
  <PostCard post={item} onPress={() => handlePress(item)} />
), [handlePress]);

<FlatList
  data={posts}
  renderItem={renderItem}
  keyExtractor={item => item.id.toString()}
/>
```

**Cuándo usar:**
- ✅ List items (PostCard, ChatCard, NotificationCard)
- ✅ Componentes pesados (modals, forms complejos)
- ❌ NO usar en componentes pequeños (overhead > beneficio)

**Pros:**
- ✅ **React.memo gratis:** Built-in
- ✅ **FlatList optimization:** `keyExtractor` + `getItemLayout`

**Effort:** BAJO (1 día — aplicar en 5-6 componentes críticos)

**Decisión:** ✅ **Usar React.memo selectivamente** — No premature optimization.

---

#### 4.7.3 Optimistic UI

**React Query optimistic updates:**
```tsx
// mobile/src/hooks/useAcceptProposal.ts
import { useMutation, useQueryClient } from 'react-query';

export const useAcceptProposal = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    (proposalId: number) => api.patch(`/api/proposals/${proposalId}/accept`),
    {
      onMutate: async (proposalId) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries(['proposals']);
        
        // Snapshot current data
        const previousProposals = queryClient.getQueryData(['proposals']);
        
        // Optimistically update
        queryClient.setQueryData(['proposals'], (old: any) =>
          old.map((p: Proposal) =>
            p.id === proposalId ? { ...p, status: 'accepted' } : p
          )
        );
        
        return { previousProposals };
      },
      onError: (err, variables, context) => {
        // Rollback on error
        queryClient.setQueryData(['proposals'], context.previousProposals);
      },
      onSettled: () => {
        // Refetch to sync
        queryClient.invalidateQueries(['proposals']);
      },
    }
  );
};
```

**Cuándo usar:**
- ✅ Acciones rápidas: aceptar propuesta, marcar notificación leída, like
- ❌ NO usar en pagos (dinero real → esperar confirmación servidor)

**Effort:** BAJO (1 día — aplicar en 5-6 mutations críticas)

**Decisión:** ✅ **Usar optimistic updates en acciones no-críticas** — Mejora perceived performance.

---

#### 4.7.4 Cache React Query

**Configuración global:**
```tsx
// mobile/src/App.tsx
import { QueryClient, QueryClientProvider } from 'react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      cacheTime: 10 * 60 * 1000, // 10 minutos
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>...</NavigationContainer>
    </QueryClientProvider>
  );
}
```

**Cache granular:**
```tsx
// mobile/src/hooks/usePosts.ts
export const usePosts = () => {
  return useQuery(['posts'], fetchPosts, {
    staleTime: 2 * 60 * 1000, // 2 minutos (feed cambia rápido)
  });
};

export const useUserProfile = (userId: number) => {
  return useQuery(['user', userId], () => fetchUser(userId), {
    staleTime: 30 * 60 * 1000, // 30 minutos (perfil cambia lento)
  });
};
```

**Pros:**
- ✅ **Reduce requests:** Cache inteligente
- ✅ **Offline-first:** Retorna cache mientras refetch en background

**Effort:** BAJO (0.5 días — config global + ajustar queries)

**Decisión:** ✅ **Configurar React Query cache strategy** — Low-hanging fruit.

---

### 4.8 Approach: Accesibilidad

#### 4.8.1 Screen Reader Support

**Implementación:**
```tsx
// mobile/src/components/PostCard.tsx
<TouchableOpacity
  accessible={true}
  accessibilityLabel={`Post: ${post.title}`}
  accessibilityHint="Toca dos veces para ver detalles"
  accessibilityRole="button"
  onPress={onPress}
>
  <Text>{post.title}</Text>
</TouchableOpacity>

// mobile/src/screens/NotificationsScreen.tsx
<Text accessibilityRole="header" accessibilityLevel={1}>
  Notificaciones
</Text>

<FlatList
  data={notifications}
  accessibilityLabel="Lista de notificaciones"
  renderItem={({ item }) => (
    <NotificationCard
      notification={item}
      accessibilityLabel={`${item.title}. ${item.body}. ${item.read ? 'Leída' : 'No leída'}`}
    />
  )}
/>
```

**Cuándo usar:**
- ✅ Todos los buttons: `accessibilityRole="button"`
- ✅ Headings: `accessibilityRole="header"`
- ✅ Images: `accessibilityLabel="Foto perfil de Juan"`
- ✅ Forms: `accessibilityLabel` en inputs

**Testing:**
- iOS: VoiceOver (Settings > Accessibility)
- Android: TalkBack (Settings > Accessibility)

**Effort:** MEDIO (2 días — aplicar en toda app)

**Decisión:** ✅ **Agregar accessibility props en componentes críticos** — WCAG AA compliance.

---

#### 4.8.2 Contrast Ratio (WCAG AA)

**Guideline:**
- Text: **4.5:1** contrast ratio mínimo
- Large text (18pt+): **3:1** mínimo
- UI components: **3:1** mínimo

**Tools:**
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- Figma plugin: "Contrast" by Stark

**Ejemplos:**
```typescript
// mobile/src/theme/colors.ts
export const colors = {
  primary: '#0066CC',      // WCAG AA: 5.2:1 (✅)
  text: '#1A1A1A',         // WCAG AAA: 17.5:1 (✅)
  textSecondary: '#6B6B6B', // WCAG AA: 5.7:1 (✅)
  error: '#D32F2F',        // WCAG AA: 5.1:1 (✅)
  background: '#FFFFFF',
};
```

**Audit:**
```bash
# React Native no tiene herramienta automática (manual review)
# Web: Lighthouse Accessibility score
npx lighthouse https://quickfixu.com --only-categories=accessibility
```

**Effort:** BAJO (1 día — audit + ajustar colores)

**Decisión:** ✅ **Validar contrast ratios en design system** — Compliance + mejor UX.

---

#### 4.8.3 Font Scaling (Dynamic Type)

**Implementación:**
```tsx
// mobile/src/components/Text.tsx
import { Text as RNText, TextProps } from 'react-native';

export const Text: React.FC<TextProps> = ({ style, ...props }) => (
  <RNText
    {...props}
    style={[style, { includeFontPadding: false }]} // Android fix
    allowFontScaling={true} // Respetar ajustes sistema
    maxFontSizeMultiplier={1.5} // Límite 150% (evitar UI roto)
  />
);
```

**Testing:**
- iOS: Settings > Display & Brightness > Text Size
- Android: Settings > Display > Font size

**Cuándo limitar:**
- ✅ UI crítico (buttons, tabs): `maxFontSizeMultiplier={1.3}`
- ❌ Body text: Sin límite (accesibilidad > estética)

**Effort:** BAJO (0.5 días — configurar componente Text)

**Decisión:** ✅ **Habilitar font scaling con límite 150%** — Balance accesibilidad vs UI.

---

### 4.9 Approach: Error Handling & Recovery

#### 4.9.1 Retry Automático (Exponential Backoff)

**React Query config:**
```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // No retry en errores 4xx (client error)
        if (error.response?.status >= 400 && error.response?.status < 500) {
          return false;
        }
        // Max 3 retries
        return failureCount < 3;
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
  },
});
```

**Backend retry (fetch):**
```typescript
// mobile/src/utils/api.ts
export const fetchWithRetry = async (url: string, options = {}, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** i)); // Exponential backoff
    }
  }
};
```

**Pros:**
- ✅ **Resiliencia red:** Maneja timeouts transitorios
- ✅ **Backoff inteligente:** Evita DDoS accidental

**Effort:** BAJO (0.5 días — config React Query)

**Decisión:** ✅ **Exponential backoff para errores 5xx** — Standard pattern.

---

#### 4.9.2 Offline Banner

**Implementación:**
```tsx
// mobile/src/components/OfflineBanner.tsx
import NetInfo from '@react-native-community/netinfo';

export const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(false);
  
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    return unsubscribe;
  }, []);
  
  if (!isOffline) return null;
  
  return (
    <View style={styles.banner}>
      <Icon name="wifi-off" size={16} color="white" />
      <Text style={styles.text}>Sin conexión a internet</Text>
    </View>
  );
};

// mobile/src/App.tsx
<SafeAreaView>
  <OfflineBanner />
  <NavigationContainer>...</NavigationContainer>
</SafeAreaView>
```

**Pros:**
- ✅ **Feedback inmediato:** Usuario sabe por qué no carga
- ✅ **Librería confiable:** @react-native-community/netinfo

**Effort:** BAJO (0.5 días)

**Decisión:** ✅ **Agregar offline banner** — UX crítico.

---

#### 4.9.3 Crash Reporting (Sentry)

**Instalación:**
```bash
npm install @sentry/react-native
npx @sentry/wizard -i reactNative -p ios android
```

**Configuración:**
```tsx
// mobile/src/App.tsx
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://xxx@sentry.io/xxx',
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: 0.2, // 20% transactions (performance monitoring)
  beforeSend: (event) => {
    // No enviar en development
    if (__DEV__) return null;
    return event;
  },
});

export default Sentry.wrap(App);
```

**Backend:**
```typescript
// backend/src/index.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

**Sentry Free Tier:**
- 5,000 events/month
- 10,000 performance units/month
- 1 proyecto
- Suficiente para MVP

**Pros:**
- ✅ **Crash tracking:** Stack traces automáticos
- ✅ **Source maps:** Desminify producción
- ✅ **Breadcrumbs:** User actions antes del crash

**Cons:**
- ⚠️ **Privacy:** Evitar capturar PII (emails, tokens)

**Effort:** BAJO (1 día setup + config)

**Decisión:** ✅ **Integrar Sentry free tier** — Crítico para detectar bugs post-release.

---

### 4.10 Approach: App Polish

#### 4.10.1 Splash Screen

**Expo Splash Screen (funciona en bare workflow):**
```bash
npm install expo-splash-screen
```

**Configuración:**
```tsx
// mobile/src/App.tsx
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appReady, setAppReady] = useState(false);
  
  useEffect(() => {
    async function prepare() {
      try {
        // Load fonts, check auth, etc.
        await Promise.all([
          loadFonts(),
          checkAuth(),
        ]);
      } catch (e) {
        console.warn(e);
      } finally {
        setAppReady(true);
      }
    }
    prepare();
  }, []);
  
  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      await SplashScreen.hideAsync();
    }
  }, [appReady]);
  
  if (!appReady) return null;
  
  return (
    <View onLayout={onLayoutRootView}>
      <NavigationContainer>...</NavigationContainer>
    </View>
  );
}
```

**Assets:**
- `mobile/assets/splash.png` (1242x2688 @3x iOS)
- `mobile/android/app/src/main/res/drawable/splash.png` (Android)

**Effort:** BAJO (1 día — diseño + integración)

**Decisión:** ✅ **expo-splash-screen** — Simple, funciona en bare workflow.

---

#### 4.10.2 App Icon

**Generación:**
- Tool: https://icon.kitchen (genera todos los tamaños iOS/Android)
- Input: PNG 1024x1024 (sin transparencia iOS, con transparencia Android)

**Assets:**
- iOS: `mobile/ios/QuickFixU/Images.xcassets/AppIcon.appiconset/`
- Android: `mobile/android/app/src/main/res/mipmap-*/ic_launcher.png`

**Effort:** BAJO (0.5 días — diseño + export)

**Decisión:** ✅ **Generar app icon con icon.kitchen** — Standard.

---

#### 4.10.3 Status Bar Style

**Configuración:**
```tsx
// mobile/src/App.tsx
import { StatusBar } from 'react-native';

export default function App() {
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <NavigationContainer>...</NavigationContainer>
    </>
  );
}

// Per-screen override
// mobile/src/screens/PostDetailScreen.tsx
import { useFocusEffect } from '@react-navigation/native';

export const PostDetailScreen = () => {
  useFocusEffect(() => {
    StatusBar.setBarStyle('light-content'); // White text on dark header
    return () => StatusBar.setBarStyle('dark-content'); // Reset
  });
  
  return <View>...</View>;
};
```

**Effort:** BAJO (0.5 días)

**Decisión:** ✅ **Configurar status bar style** — Detalles importan.

---

#### 4.10.4 Confirmación Acciones Destructivas

**Implementación:**
```tsx
// mobile/src/screens/PostDetailScreen.tsx
import { Alert } from 'react-native';

const handleDeletePost = () => {
  Alert.alert(
    '¿Eliminar post?',
    'Esta acción no se puede deshacer',
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deletePost(postId);
          navigation.goBack();
        },
      },
    ]
  );
};

<Button title="Eliminar post" onPress={handleDeletePost} />
```

**Cuándo usar:**
- ✅ Delete post, cancel appointment, reject proposal, logout
- ❌ NO usar en acciones reversibles (mark as read, like)

**Effort:** BAJO (0.5 días — aplicar en 5-6 acciones)

**Decisión:** ✅ **Confirmar acciones destructivas** — Evita errores usuario.

---

## 5. Risks & Challenges

### 5.1 Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| **Deep linking no funciona en producción** (config iOS/Android incorrecto) | MEDIA | ALTO | Testing exhaustivo con TestFlight + APK release. Validar `.well-known/` files servidos correctamente (curl test). Documentar troubleshooting. |
| **FCM tokens expirados** (notificaciones no llegan) | MEDIA | MEDIO | Cronjob limpiar tokens inválidos (detectar `InvalidRegistration` error FCM). Retry re-registro token al abrir app. |
| **Notificaciones duplicadas** (mismo evento enviado 2 veces) | BAJA | BAJO | Idempotencia en cronjobs (usar `WHERE sent_notification=false` + UPDATE `sent_notification=true` en transaction). |
| **Performance degradación** (animaciones Reanimated drop frames) | BAJA | MEDIO | Profiling con React Native Debugger. Usar `useNativeDriver: true` siempre. Limitar animaciones complejas en listas largas. |
| **Sentry quota exceeded** (>5K events/mes) | BAJA | BAJO | Configurar `sampleRate` + `beforeSend` filter (excluir errores conocidos). Monitor usage en dashboard Sentry. |
| **Onboarding se muestra 2 veces** (AsyncStorage falla) | BAJA | BAJO | Fallback: `onboarding_completed=false` default. Nunca forzar onboarding si usuario ya hizo acciones (ej: creó post). |
| **Skeleton loaders no coinciden con layout real** (jarring transition) | MEDIA | BAJO | Diseñar skeletons con diseñador (Figma). Medir dimensions reales en código. |
| **Preferencias notificaciones NO respetadas** (bug lógica filtrado) | MEDIA | ALTO | Tests E2E: silenciar `new_message` → enviar mensaje → assert NO recibe push. Logging exhaustivo en `notificationService.sendPushNotification`. |

### 5.2 Riesgos UX/Producto

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| **Notification fatigue** (usuarios silencian TODAS notificaciones) | MEDIA | ALTO | Defaults inteligentes (marketing OFF). Permitir granularidad. Monitorear opt-out rates (analytics). |
| **Onboarding skip rate alto** (usuarios no completan tutorial) | MEDIA | MEDIO | Mantener 3 páginas MAX (no 5). Copy claro y visual. Skip siempre disponible (no forzar). |
| **Deep linking confuso** (usuario no entiende qué pasó) | BAJA | BAJO | Toast: "Abriendo chat..." al navegar. Highlight item relevante (ej: nueva propuesta con border amarillo 2s). |
| **Empty states genéricos** (no actionable) | MEDIA | BAJO | Siempre incluir CTA (ej: "Crear post" en feed vacío). Copy empático (no "No hay datos"). |
| **Animaciones molestas** (slow down UX) | BAJA | MEDIO | Durations cortas (<300ms). Permitir disable animations en settings (accessibility). User testing. |

### 5.3 Riesgos Operacionales

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| **Cronjobs fallan silenciosamente** (no envían notificaciones) | MEDIA | ALTO | Logging exhaustivo en cada cronjob (timestamp, cuántos registros procesados). Sentry alerts en errors. Dead man's switch (healthcheck endpoint que falla si cronjob no corrió en X horas). |
| **Sentry no captura crashes iOS** (config incorrecta) | BAJA | ALTO | Testing manual con crash intencional (throw error). Validar en Sentry dashboard. Documentar troubleshooting. |
| **Bundle size explota** (>20MB app) | BAJA | MEDIO | Monitorear con `react-native-bundle-visualizer`. Tree-shaking Reanimated. Lazy load Lottie animations. |

---

## 6. Dependencies & Prerequisites

### 6.1 Fases Completadas (MUST)

- ✅ **Fase 1:** Auth (JWT, OAuth, FCM token registration)
- ✅ **Fase 2:** Posts & Proposals (tabla `notifications`, tipos básicos)
- ✅ **Fase 3:** Chat (Socket.io, notificaciones condicionales mensajes)
- ✅ **Fase 4:** Payments (appointments, confirmación mutua, cronjobs base)
- ✅ **Fase 5:** Reviews (tabla `reviews`, reminder logic — VERIFICAR si notif implementada)
- ✅ **Fase 6:** Admin (certificación approval/rejection — VERIFICAR si notif implementada)

### 6.2 NPM Packages Nuevos

**Mobile:**
```json
{
  "react-native-skeleton-placeholder": "^5.2.4",
  "react-native-onboarding-swiper": "^1.2.0",
  "react-native-fast-image": "^8.6.3",
  "react-native-reanimated": "^3.6.0",
  "react-native-gesture-handler": "^2.14.0",
  "react-native-haptic-feedback": "^2.2.0",
  "@sentry/react-native": "^5.15.0",
  "@react-native-community/netinfo": "^11.1.0",
  "lottie-react-native": "^6.4.1"
}
```

**Backend:**
```json
{
  "@sentry/node": "^7.91.0"
}
```

### 6.3 External Services

- ✅ Firebase Cloud Messaging (ya configurado)
- ✅ Sentry (free tier — 5K events/mes)
- ✅ Cloudinary (media storage — ya configurado)

### 6.4 Infrastructure

**Backend:**
- ✅ Node.js cronjobs (node-cron ya instalado)
- ✅ Redis (cache + rate limiting — ya configurado)
- ✅ PostgreSQL (tabla nueva `notification_preferences`)

**Static files:**
- ⚠️ Servir `.well-known/apple-app-site-association` (iOS Universal Links)
- ⚠️ Servir `.well-known/assetlinks.json` (Android App Links)

---

## 7. Success Metrics

### 7.1 Notificaciones

- ✅ **Coverage:** 100% eventos críticos con notificación (15 tipos total)
- ✅ **Delivery rate:** >95% notificaciones entregadas en <10s (FCM analytics)
- ✅ **Opt-out rate:** <20% usuarios silencian notificaciones (target healthy)
- ✅ **Deep link success:** >90% taps navegan correctamente (track analytics)

### 7.2 UX/UI Polish

- ✅ **Skeleton loaders:** 0 pantallas con spinner genérico (all replaced)
- ✅ **Empty states:** 100% listas con empty state custom
- ✅ **Error recovery:** <5% usuarios abandonan app después error (Sentry tracking)
- ✅ **Onboarding completion:** >70% usuarios completan (o skip intencionalmente)

### 7.3 Performance

- ✅ **Crash-free rate:** >99.5% (Sentry)
- ✅ **App size:** <15MB (iOS/Android)
- ✅ **Time to Interactive:** <2s desde splash screen
- ✅ **FPS:** >55 FPS en scroll listas (React Native Performance Monitor)

### 7.4 Accesibilidad

- ✅ **Screen reader:** 100% pantallas navegables con VoiceOver/TalkBack
- ✅ **Contrast ratio:** WCAG AA compliance (4.5:1 text, 3:1 UI)
- ✅ **Font scaling:** No UI rota con 150% font size

---

## 8. Implementation Plan (High-Level)

### Bloque 1: Notificaciones Completo (5 días)
1. ✅ Tabla `notification_preferences` (migration + seed)
2. ✅ Refactor `notification.service.ts` (filtrar por preferencias)
3. ✅ Agregar 9 tipos nuevos notificaciones
4. ✅ Cronjobs: appointment reminders, review reminders, payout release notifications
5. ✅ Endpoint `/api/notifications/preferences` (GET, PATCH)
6. ✅ Pantalla `NotificationPreferencesScreen` (mobile)

### Bloque 2: Notificaciones In-App (3 días)
7. ✅ Endpoint `/api/notifications` (GET con pagination, mark as read, mark all as read)
8. ✅ Pantalla `NotificationsScreen` (mobile)
9. ✅ Badge count (tab bar + app icon)
10. ✅ Deep linking handler (React Navigation Linking config)
11. ✅ Testing deep links (iOS/Android)

### Bloque 3: Deep Linking Completo (3 días)
12. ✅ iOS Universal Links config (entitlements + apple-app-site-association)
13. ✅ Android App Links config (intent-filter + assetlinks.json)
14. ✅ Backend servir `.well-known/` files
15. ✅ Testing producción (TestFlight + APK release)

### Bloque 4: Polish UX/UI (5 días)
16. ✅ Skeleton loaders (5-6 componentes)
17. ✅ Pull-to-refresh (5-6 pantallas)
18. ✅ Empty states (componente reutilizable + aplicar)
19. ✅ Error states (componente reutilizable + retry logic)
20. ✅ Animaciones (Reanimated en 3-4 transiciones críticas)
21. ✅ Haptic feedback (10-15 acciones)

### Bloque 5: Onboarding (2 días)
22. ✅ Diseñar 3 páginas onboarding (copy + visuals)
23. ✅ Implementar `OnboardingScreen` (react-native-onboarding-swiper)
24. ✅ AsyncStorage flag `onboarding_completed`
25. ✅ Testing flow (first-time user)

### Bloque 6: Performance (3 días)
26. ✅ react-native-fast-image (reemplazar `<Image>`)
27. ✅ React.memo en componentes críticos
28. ✅ Optimistic UI (5-6 mutations)
29. ✅ React Query cache config
30. ✅ Bundle size analysis (react-native-bundle-visualizer)

### Bloque 7: Accesibilidad (2 días)
31. ✅ Accessibility props (labels, roles, hints)
32. ✅ Contrast ratio audit (ajustar colores)
33. ✅ Font scaling config (`allowFontScaling`, `maxFontSizeMultiplier`)
34. ✅ Testing con VoiceOver/TalkBack

### Bloque 8: Error Handling (2 días)
35. ✅ Exponential backoff (React Query + fetch)
36. ✅ Offline banner (@react-native-community/netinfo)
37. ✅ Sentry setup (mobile + backend)
38. ✅ Crash testing (intentional errors)

### Bloque 9: App Polish Final (2 días)
39. ✅ Splash screen (expo-splash-screen)
40. ✅ App icon (icon.kitchen)
41. ✅ Status bar style
42. ✅ Confirmación acciones destructivas (Alert.alert)
43. ✅ QA final (testing checklist)

**Total estimado:** 27 días (~5-6 semanas con 1 developer full-time)

---

## 9. Testing Strategy

### 9.1 Notificaciones

**Unit Tests:**
```typescript
// backend/tests/services/notification.service.test.ts
describe('NotificationService', () => {
  it('should NOT send push if user disabled notification type', async () => {
    await prisma.notificationPreference.create({
      data: { userId: 1, type: 'new_message', enabled: false },
    });
    
    await notificationService.sendNewMessageNotification(1, 2, 'Hola');
    
    expect(fcmAdmin.messaging().send).not.toHaveBeenCalled();
  });
  
  it('should send push if no preference set (default enabled)', async () => {
    await notificationService.sendNewMessageNotification(1, 2, 'Hola');
    
    expect(fcmAdmin.messaging().send).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'fcm_token_user_1' })
    );
  });
});
```

**E2E Tests:**
```typescript
// mobile/e2e/notifications.e2e.ts
describe('Notifications In-App', () => {
  it('should navigate to chat on notification tap', async () => {
    await device.launchApp({ newInstance: true });
    await device.sendUserNotification({
      trigger: { type: 'push' },
      title: 'Nuevo mensaje',
      body: 'Juan: Hola',
      payload: { type: 'new_message', chatId: '123' },
    });
    
    await expect(element(by.id('chat-screen'))).toBeVisible();
    await expect(element(by.id('chat-header'))).toHaveText('Chat con Juan');
  });
});
```

### 9.2 Deep Linking

**Manual Testing Checklist:**
- [ ] iOS: Tap notificación → navega correctamente (TestFlight)
- [ ] Android: Tap notificación → navega correctamente (APK)
- [ ] iOS: Universal Link desde Safari → abre app (no browser)
- [ ] Android: App Link desde Chrome → abre app (no browser)
- [ ] Custom scheme `quickfixu://` → fallback funciona

### 9.3 Performance

**Metrics Monitoring:**
```bash
# React Native Performance Monitor (dev mode)
# FPS, JS thread usage, RAM

# Bundle size
npx react-native-bundle-visualizer

# Sentry dashboard
# Crash-free rate, error trends
```

### 9.4 Accesibilidad

**Manual Testing:**
- [ ] iOS VoiceOver: Navegar app completa (5 pantallas principales)
- [ ] Android TalkBack: Navegar app completa
- [ ] Font scaling 150%: No UI roto (iOS + Android)
- [ ] Contrast ratio: WebAIM tool en Figma designs

---

## 10. Recommendations

### 10.1 Decisiones Clave

1. ✅ **Cronjobs separados por tipo** — Mejor arquitectura, debugging más fácil
2. ✅ **Notificaciones in-app con polling 30s** — Simple para MVP (migrar Socket.io Fase 8 si necesario)
3. ✅ **Preferencias por tipo (15 tipos)** — Mayor control usuario vs categorías
4. ✅ **Deep linking con Universal Links + App Links** — Standard industria, mejor UX
5. ✅ **react-native-skeleton-placeholder** — Única opción viable React Native
6. ✅ **Reanimated 2 para animaciones críticas** — Performance 60 FPS, usar selectivamente
7. ✅ **react-native-fast-image** — Lazy loading imágenes (deprecado pero funcional)
8. ✅ **Sentry free tier** — Crash reporting crítico para MVP

### 10.2 Quick Wins (Low Effort, High Impact)

- ✅ Pull-to-refresh (0.5 días, mejora perceived freshness)
- ✅ Offline banner (0.5 días, reduce confusión usuario)
- ✅ Haptic feedback (0.5 días, delight con esfuerzo mínimo)
- ✅ Confirmación acciones destructivas (0.5 días, evita errores)
- ✅ React Query cache config (0.5 días, reduce requests)

### 10.3 Post-MVP (Fase 8+)

- Email notifications (Sendgrid/Mailgun)
- SMS notifications (Twilio — costo alto)
- Notificaciones realtime in-app (Socket.io, eliminar polling)
- Shared element transitions (Reanimated)
- Advanced analytics (track notification engagement)
- A/B testing onboarding (cual convierte mejor)
- Web app (PWA con push notifications web)

---

## 11. Ready for Proposal?

✅ **YES** — Esta exploración cubre:

1. ✅ **Current state:** Qué notificaciones existen, qué falta, tabla `notifications` actual
2. ✅ **Approaches:** 10 decisiones de arquitectura con pros/cons (cronjobs, deep linking, skeleton loaders, animaciones, etc.)
3. ✅ **Recommendations:** Decisiones clave seleccionadas con justificación
4. ✅ **Risks:** 15+ riesgos técnicos/UX/operacionales con mitigaciones
5. ✅ **Implementation plan:** 9 bloques (27 días estimado)
6. ✅ **Testing strategy:** Unit tests, E2E, manual checklists

**Next steps:**
1. Orquestador crea **Proposal** (con esta exploration como input)
2. Proposal → **Spec** (functional requirements detallados para 15 tipos notificaciones)
3. Spec → **Design** (arquitectura backend cronjobs, mobile app deep linking flow)
4. Design → **Tasks** (breakdown 40-50 tasks)
5. Tasks → **Apply** (implementación código)

**Preguntas sin responder (resolver en Spec):**
- ¿Fases 5 y 6 YA implementaron notificaciones certificación/review? (verificar código)
- ¿Frecuencia cronjob appointment reminders? (1x/día 9am vs 2x/día 9am+18hs)
- ¿Notificaciones día 5-6-7 timeout auto-release o más frecuente? (1x/día vs 3x/día)
- ¿Copy exacto notificaciones? (ej: "Tu certificación fue aprobada" vs "¡Felicitaciones! Ya podés recibir trabajos")
- ¿Animaciones cuáles pantallas? (priorizar top 3-4 transiciones más importantes)
- ¿Lottie animations cuáles empty states? (diseñar con diseñador o usar LottieFiles community)

---

**EXPLORATION COMPLETE** ✅
