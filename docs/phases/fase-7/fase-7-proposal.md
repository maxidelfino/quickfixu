# Proposal: Fase 7 - Push Notifications & Polish

**Change:** `fase-7-notifications-polish`  
**Date:** Marzo 2026  
**Status:** Proposed  
**Timeline:** 27 días (5-6 semanas, 1 dev)  
**Complexity:** MEDIA (10 áreas diferentes, sin complejidad individual alta)

---

## Intent

Completar el **MVP de QuickFixU** agregando el sistema de notificaciones faltantes y puliendo la experiencia de usuario. Sin esta fase:
- **Usuarios NO reciben alertas críticas** (certificación aprobada/rechazada, trabajos a punto expirar, pago liberado)
- **App se siente incompleta** (sin skeleton loaders, sin empty states coherentes, sin onboarding)
- **Riesgo de perder engagement** (sin deep linking, sin notificaciones in-app visibles)

**Problema específico:** Fases 1-6 implementaron la infraestructura base de notificaciones (FCM, tabla `notifications`, 7 tipos básicos), pero faltan **9 tipos críticos** y **todo el polish UX** que hace la diferencia entre un prototipo y un producto lanzable.

---

## Scope

### In Scope

**1. Sistema Notificaciones Completo (9 tipos nuevos):**
- Certificación profesional aprobada/rechazada
- Appointment reminder (24hs antes)
- Pago liberado (payout completado)
- Disputa resuelta
- Review reminder (3 días después completar trabajo)
- Nuevo profesional en zona (30km radio)
- Post/propuesta a punto expirar (ya existe, verificar implementación)

**2. Notificaciones In-App:**
- Centro de notificaciones con badge count
- Marcar como leída/no leída
- Deep linking (tap → navega a pantalla correcta)

**3. Preferencias de Notificaciones:**
- Tabla `notification_preferences` (usuario puede silenciar tipos específicos)
- UI toggle switches por tipo (15 tipos totales)

**4. Deep Linking:**
- iOS Universal Links + Android App Links
- React Navigation Linking config para 8+ rutas

**5. Polish UX/UI:**
- Skeleton loaders (posts list, chats, proposals)
- Pull-to-refresh (5 pantallas principales)
- Empty states + error states coherentes
- Loading states (botones, transiciones)
- Haptic feedback (tap, success, error)
- Animaciones críticas (Reanimated 2 selectivo)

**6. Onboarding:**
- Tutorial primera vez (3-5 pantallas swipeable)
- AsyncStorage flag `onboarding_completed`

**7. Performance:**
- Lazy loading imágenes (`react-native-fast-image`)
- Memoización componentes críticos (`React.memo`, `useMemo`)
- Optimistic UI (likes, follows, confirmaciones)
- React Query cache config (stale time, cache time)

**8. Accesibilidad:**
- ARIA labels/accessibilityLabel (botones, inputs)
- Contrast ratio WCAG AA (verificar Figma designs)
- Font scaling support (150% sin UI roto)
- Keyboard navigation

**9. Error Handling:**
- Retry automático (Axios interceptor 3 intentos)
- Offline banner (NetInfo)
- Fallbacks (imágenes, datos)
- Crash reporting (Sentry free tier)

**10. App Polish:**
- Splash screen + app icon
- Status bar style (dark/light)
- Confirmación acciones destructivas (eliminar post, rechazar propuesta)

### Out of Scope

- **Email notifications** (Fase 8+ — requiere Sendgrid/Mailgun)
- **SMS notifications** (costo alto, no crítico MVP)
- **Notificaciones realtime in-app** (Socket.io Fase 8, MVP usa polling 30s)
- **Shared element transitions** (delight, no crítico)
- **Advanced analytics** (tracking engagement notificaciones)
- **A/B testing onboarding** (post-launch)
- **Web app/PWA** (Fase 8+)
- **Custom notification sounds** (UX menor, iOS review riesgoso)

---

## Approach

### High-Level Strategy

**Backend (Node.js + Prisma):**
1. **Cronjobs separados** (1 archivo por tipo, no monolítico) usando `node-cron`:
   - `appointmentReminders.cron.ts` (ejecuta 1x/día 9am)
   - `expirationAlerts.cron.ts` (ejecuta 1x/día 8am)
   - `autoReleasePayment.cron.ts` (ejecuta 3x/día día 5-6-7)
   - `reviewReminders.cron.ts` (ejecuta 1x/día 10am)
2. **Event-driven notifications** (existing pattern):
   - Admin aprueba certificación → trigger `sendPushNotification(userId, ...)`
   - Pago liberado → trigger desde `paymentReleased` webhook handler
3. **Tabla `notification_preferences`** (Prisma migration):
   ```prisma
   model NotificationPreference {
     id     Int     @id @default(autoincrement())
     userId Int     @unique @map("user_id")
     // JSON con map { type: boolean } — ej: { "proposal_received": true, "chat_message": false }
     prefs  Json    @default("{}")
     user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
     @@map("notification_preferences")
   }
   ```
4. **Función `shouldSendNotification(userId, type)`** (lee `prefs` antes de enviar)

**Mobile (React Native + Expo):**
1. **Deep Linking config** (iOS `.well-known/apple-app-site-association` + Android `assetlinks.json`):
   - React Navigation `linking.config.ts` con 8 rutas (post detail, chat, proposal, payment, etc.)
2. **Notificaciones In-App**:
   - Screen `NotificationsScreen` (lista con pull-to-refresh)
   - Badge count en tab icon (React Navigation `tabBarBadge`)
   - Polling cada 30s con React Query (interval query)
3. **Polish components**:
   - `SkeletonLoader.tsx` (react-native-skeleton-placeholder)
   - `EmptyState.tsx` (Lottie animations)
   - `OfflineBanner.tsx` (NetInfo listener)
   - `ConfirmDialog.tsx` (Alert.alert wrapper)
4. **Performance optimizations**:
   - Wrap listas pesadas con `React.memo`
   - `useMemo` para cálculos costosos (ej: filtrar/ordenar arrays)
   - Fast Image con cache config

**DevOps:**
- Sentry SDK (free tier — 5K events/mes suficiente MVP)
- Splash screen + icon con `expo-splash-screen`/`expo-app-icon`

### Architecture Decisions (from Exploration)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Cronjobs | Separados por tipo | Debugging más fácil, no monolítico |
| In-app delivery | Polling 30s | Simple MVP, migrar Socket.io Fase 8 |
| Preferences | Por tipo (15 tipos) | Mayor control usuario vs categorías |
| Deep linking | Universal Links + App Links | Standard industria, mejor UX |
| Skeleton loaders | `react-native-skeleton-placeholder` | Única opción viable React Native |
| Animaciones | Reanimated 2 selectivo | 60 FPS, usar solo críticas |
| Image lazy loading | `react-native-fast-image` | Deprecado pero funcional MVP |
| Crash reporting | Sentry free tier | Crítico producción |

---

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/cron/` | **New** | 4 cronjobs nuevos (appointments, expirations, auto-release, reviews) |
| `backend/src/routes/notifications.routes.ts` | **Modified** | +3 endpoints (GET prefs, PUT prefs, PATCH mark-read) |
| `backend/prisma/schema.prisma` | **Modified** | +1 tabla `notification_preferences` |
| `backend/src/utils/notifications.ts` | **Modified** | +función `shouldSendNotification`, +9 tipos nuevos |
| `mobile/src/screens/NotificationsScreen.tsx` | **New** | Centro notificaciones in-app |
| `mobile/src/screens/OnboardingScreen.tsx` | **New** | Tutorial primera vez (3-5 pantallas) |
| `mobile/src/config/linking.config.ts` | **New** | Deep linking config (8 rutas) |
| `mobile/src/components/SkeletonLoader.tsx` | **New** | Component reutilizable skeleton |
| `mobile/src/components/EmptyState.tsx` | **New** | Empty states coherentes |
| `mobile/src/components/OfflineBanner.tsx` | **New** | Banner offline banner |
| `mobile/src/hooks/useNotifications.ts` | **New** | Hook polling notificaciones (React Query) |
| `mobile/src/hooks/useHaptics.ts` | **New** | Wrapper Haptic feedback |
| `mobile/src/navigation/TabNavigator.tsx` | **Modified** | Badge count en tab Notifications |
| `mobile/app.json` | **Modified** | iOS Universal Links + Android App Links config |
| `mobile/src/utils/sentry.ts` | **New** | Sentry init + error boundary |
| All list screens (Posts, Chats, Proposals, etc.) | **Modified** | +skeleton loaders, +pull-to-refresh, +empty states |

**Total:** ~4 new backend files, ~8 new mobile files, ~10 modified files across stack.

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **iOS Universal Links NO funcionan** (requiere domain + HTTPS) | **HIGH** | Documentar paso a paso, probar con dominio staging ANTES de producción |
| **Cronjobs no ejecutan** (node-cron requiere server siempre activo) | **MEDIUM** | Usar Railway Cron Jobs o alternativa (no Render free tier), logs exhaustivos |
| **Notificaciones spam** (usuario recibe 10+ notifs/día) | **MEDIUM** | Implementar rate limiting (max 5 notifs/día tipo no crítico), preferencias por defecto conservadoras |
| **Deep linking rompe flow** (tap notif → crash o pantalla vacía) | **MEDIUM** | Defensive checks (post existe? user autenticado?), fallback a Home screen |
| **Performance degrada** (skeleton loaders + animaciones → lag) | **LOW** | Performance budget (mantener FPS >50), usar Reanimated 2 SOLO donde crítico |
| **Onboarding molesto** (usuario salta tutorial → nunca aprende features) | **LOW** | Botón "Skip" visible, guardar flag AsyncStorage (no forzar repetir) |
| **Accesibilidad olvidada** (lanzar sin ARIA labels → quejas) | **MEDIUM** | Checklist QA manual (VoiceOver iOS, TalkBack Android), no bloqueante pero alta prioridad |
| **Sentry free tier excedido** (>5K events/mes) | **LOW** | Filtrar errores conocidos (ej: network timeouts), subir a paid tier si necesario ($26/mes) |
| **Skeleton loaders no match diseño real** (confunde usuario) | **LOW** | Diseñar en Figma ANTES de implementar, mismo layout que datos reales |
| **Offline banner tapa UI crítica** | **LOW** | Posición top con auto-hide (5s), no blocking |

---

## Rollback Plan

### If Deep Linking Breaks
1. Revert `linking.config.ts` (eliminar config)
2. Tap notificación → abre app en Home screen (degraded UX pero NO crash)
3. Fix en patch release

### If Cronjobs Spam Notificaciones
1. Emergency: Deshabilitar cronjob problemático (`// node-cron.schedule(...)`)
2. Restart server
3. Fix lógica filtrado, re-enable

### If Performance Degrada Significativamente
1. Feature flag skeleton loaders/animaciones (AsyncStorage toggle)
2. Deshabilitar selectivamente por pantalla
3. Optimizar componentes críticos

### If Sentry Causa Crashes (SDK bug)
1. Wrap Sentry.init en try-catch
2. Log error, continuar app sin crash reporting (degraded monitoring)

**Database rollback:**
- Tabla `notification_preferences` es append-only, seguro no revertir migration
- Si necesario: `prisma migrate rollback` (perder prefs usuario, no crítico)

---

## Dependencies

**External:**
- Firebase Cloud Messaging (FCM) — **already configured Fase 1**
- Sentry account (free tier) — **new signup required**
- iOS Developer Account (Universal Links `.well-known/` hosting) — **required**
- Google Play Console (App Links verification) — **required**
- Domain HTTPS (Universal Links) — **required** (ej: `quickfixu.com`)

**Internal:**
- **Fases 1-6 MUST be completed** (auth, posts, chat, payments, reviews, admin)
- Verificar si Fase 5/6 YA implementaron notificaciones certificación/review (evitar duplicar)

**Third-party packages (new):**
```json
// Mobile
"react-native-skeleton-placeholder": "^5.2.4",
"react-native-fast-image": "^8.6.3",
"react-native-reanimated": "^3.6.0", // si no existe
"lottie-react-native": "^6.4.0",
"@react-native-community/netinfo": "^11.2.0",
"@sentry/react-native": "^5.15.0"

// Backend
"node-cron": "^3.0.3"
```

---

## Success Criteria

- [ ] **15 tipos de notificaciones funcionando** (7 existentes + 9 nuevos verificados con tests E2E)
- [ ] **Deep linking funciona** (tap notificación → navega a pantalla correcta iOS + Android)
- [ ] **Centro notificaciones in-app** (badge count actualiza, marcar como leída funciona)
- [ ] **Preferencias notificaciones** (usuario puede silenciar tipos, respetado en backend)
- [ ] **Skeleton loaders en 5 pantallas principales** (posts list, chats, proposals, reviews, professionals)
- [ ] **Onboarding completa primera vez** (3-5 pantallas, skip funciona, AsyncStorage flag persiste)
- [ ] **Performance mantiene >50 FPS** (React Native Debugger, pantallas críticas)
- [ ] **Accesibilidad básica** (VoiceOver navega 5 pantallas principales, font scaling 150% OK)
- [ ] **Offline banner muestra/oculta correctamente** (NetInfo listener)
- [ ] **Sentry captura crashes** (provocar error intencional, verificar dashboard)
- [ ] **App icon + splash screen deployed** (iOS + Android)
- [ ] **Confirmación acciones destructivas** (eliminar post, rechazar propuesta muestran Alert)
- [ ] **Zero crashes críticos** (E2E tests pasan, manual QA 30min sin crashes)

**Metrics (post-launch):**
- Notification delivery rate >95% (FCM analytics)
- Deep link success rate >90% (Sentry breadcrumbs)
- Crash-free rate >99.5% (Sentry dashboard)
- Onboarding completion rate >60% (analytics)

---

## Implementation Blocks (9 bloques, 27 días estimado)

### Bloque 1: Sistema Notificaciones Backend (4 días)
- Cronjobs (appointments, expirations, auto-release, reviews)
- Tabla `notification_preferences` migration
- Función `shouldSendNotification`
- Tests unitarios cronjobs

### Bloque 2: Notificaciones In-App Mobile (3 días)
- Screen `NotificationsScreen` + lista
- Badge count tab icon
- Polling React Query (30s interval)
- Mark as read endpoint

### Bloque 3: Deep Linking (4 días)
- iOS Universal Links config (`.well-known/`)
- Android App Links config (`assetlinks.json`)
- React Navigation `linking.config.ts` (8 rutas)
- Tests E2E (tap notif → navega correcta pantalla)

### Bloque 4: Polish UX Components (3 días)
- `SkeletonLoader.tsx` component
- `EmptyState.tsx` component (Lottie)
- `OfflineBanner.tsx` component
- Apply en 5 pantallas principales

### Bloque 5: Onboarding (2 días)
- 3-5 pantallas swipeable
- AsyncStorage flag `onboarding_completed`
- UI diseño (Figma → componentes)

### Bloque 6: Performance Optimizations (3 días)
- Fast Image lazy loading
- React.memo componentes pesados
- useMemo cálculos costosos
- React Query cache config

### Bloque 7: Accesibilidad (2 días)
- ARIA labels (botones, inputs críticos)
- Contrast ratio check (Figma)
- Font scaling tests
- Keyboard navigation

### Bloque 8: Error Handling + Monitoring (3 días)
- Axios interceptor retry (3 intentos)
- Sentry init + error boundary
- Fallbacks (imágenes, datos)
- Haptic feedback

### Bloque 9: App Polish (3 días)
- Splash screen + app icon
- Status bar style
- Confirmación acciones destructivas
- Pull-to-refresh en listas
- QA final (30min manual testing iOS + Android)

**Buffer:** 0 días (timeline conservador, bloques independientes permiten paralelismo si multi-dev)

---

## Notes

- **Esta es la ÚLTIMA fase del MVP** — después de Fase 7, app es lanzable
- **Disciplina crítica:** NO dejar features a medio implementar (ej: deep linking iOS sin Android = frustrante)
- **Verificar código Fase 5/6:** Si ya implementaron notificaciones certificación/review, ajustar scope (restar 2-3 días)
- **Quick wins priorizar:** Pull-to-refresh, offline banner, haptic feedback, confirmaciones (0.5 días c/u, alto impacto)
- **Post-MVP (Fase 8+):** Email notifications, SMS, Socket.io realtime, shared element transitions

---

**READY FOR SPECS** ✅
