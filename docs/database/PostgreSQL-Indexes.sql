-- ============================================
-- QuickFixU - Índices PostgreSQL Críticos
-- ============================================
-- Versión: 2.0
-- Fecha: Marzo 2026
-- Base de datos: PostgreSQL 15+ con PostGIS
-- ============================================

-- IMPORTANTE: Ejecutar DESPUÉS de crear todas las tablas
-- Orden de ejecución: Schema -> Constraints -> Índices -> Triggers

-- ============================================
-- EXTENSIONES REQUERIDAS
-- ============================================

-- PostGIS para geolocalización
CREATE EXTENSION IF NOT EXISTS postgis;

-- pg_trgm para búsquedas full-text (Fase 2)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- ÍNDICES: users
-- ============================================

-- Login rápido por email
CREATE INDEX idx_users_email ON users(email);

-- Geolocalización (CRÍTICO para búsquedas profesionales)
-- GIST = Generalized Search Tree (óptimo para queries espaciales)
CREATE INDEX idx_users_location ON users 
USING GIST(ST_MakePoint(longitude, latitude)::geography);

-- Filtrar usuarios activos (evitar baneados en queries)
CREATE INDEX idx_users_is_active ON users(is_active) 
WHERE is_active = TRUE;

-- FCM token para envío notificaciones
CREATE INDEX idx_users_fcm_token ON users(fcm_token) 
WHERE fcm_token IS NOT NULL;

COMMENT ON INDEX idx_users_location IS 'Índice espacial PostGIS para búsquedas en radio (ST_DWithin). Performance crítica.';

-- ============================================
-- ÍNDICES: professionals
-- ============================================

-- Relación con users (JOIN frecuente)
CREATE INDEX idx_professionals_user_id ON professionals(user_id);

-- Filtrar solo verificados (certificaciones aprobadas)
CREATE INDEX idx_professionals_is_verified ON professionals(is_verified) 
WHERE is_verified = TRUE;

-- Ordenar por tarifa (búsquedas "más barato primero")
CREATE INDEX idx_professionals_hourly_rate ON professionals(hourly_rate);

-- Índice compuesto para búsqueda completa
-- (verificado + ordenar por precio)
CREATE INDEX idx_professionals_verified_rate ON professionals(is_verified, hourly_rate) 
WHERE is_verified = TRUE;

-- ============================================
-- ÍNDICES: categories
-- ============================================

-- Búsqueda por slug (URLs amigables)
CREATE INDEX idx_categories_slug ON categories(slug);

-- ============================================
-- ÍNDICES: professional_categories
-- ============================================

-- Búsquedas bidireccionales
CREATE INDEX idx_prof_cat_professional ON professional_categories(professional_id);
CREATE INDEX idx_prof_cat_category ON professional_categories(category_id);

-- Índice compuesto para queries "profesionales de categoría X"
CREATE INDEX idx_prof_cat_composite ON professional_categories(category_id, professional_id);

-- ============================================
-- ÍNDICES: certifications
-- ============================================

-- Listar certificaciones por profesional
CREATE INDEX idx_cert_professional ON certifications(professional_id);

-- Admin panel: filtrar por status
CREATE INDEX idx_cert_status ON certifications(status);

-- Queue pendientes de aprobación (ordenado por antigüedad)
CREATE INDEX idx_cert_pending_queue ON certifications(created_at) 
WHERE status = 'pending';

-- ============================================
-- ÍNDICES: posts
-- ============================================

-- Posts por usuario (historial cliente)
CREATE INDEX idx_posts_user_id ON posts(user_id);

-- Filtrar por status (feed solo muestra "open")
CREATE INDEX idx_posts_status ON posts(status);

-- Geolocalización posts (profesionales buscan en su radio)
CREATE INDEX idx_posts_location ON posts 
USING GIST(ST_MakePoint(longitude, latitude)::geography);

-- Cronjob expiración (cada 1 hora marca expires_at < NOW())
CREATE INDEX idx_posts_expires_at ON posts(expires_at) 
WHERE status = 'open';

-- Soft delete (filtrar deleted_at IS NULL)
CREATE INDEX idx_posts_deleted_at ON posts(deleted_at) 
WHERE deleted_at IS NULL;

-- Feed ordenado por reciente (DESC)
CREATE INDEX idx_posts_created_at ON posts(created_at DESC) 
WHERE status = 'open' AND deleted_at IS NULL;

-- Índice compuesto para feed completo (status + no borrado + reciente)
CREATE INDEX idx_posts_feed ON posts(status, created_at DESC) 
WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_posts_location IS 'Índice espacial para feed geolocalizado profesionales.';
COMMENT ON INDEX idx_posts_feed IS 'Índice compuesto óptimo para query feed principal.';

-- ============================================
-- ÍNDICES: post_categories
-- ============================================

CREATE INDEX idx_post_cat_post ON post_categories(post_id);
CREATE INDEX idx_post_cat_category ON post_categories(category_id);

-- Búsqueda inversa: "posts de categoría X en mi radio"
CREATE INDEX idx_post_cat_composite ON post_categories(category_id, post_id);

-- ============================================
-- ÍNDICES: post_media
-- ============================================

-- Cargar media de un post
CREATE INDEX idx_post_media_post_id ON post_media(post_id);

-- ============================================
-- ÍNDICES: proposals
-- ============================================

-- Propuestas de un post (contador "3 propuestas recibidas")
CREATE INDEX idx_proposals_post_id ON proposals(post_id);

-- Propuestas enviadas por profesional (historial)
CREATE INDEX idx_proposals_professional_id ON proposals(professional_id);

-- Filtrar por status
CREATE INDEX idx_proposals_status ON proposals(status);

-- Cronjob expiración propuestas
CREATE INDEX idx_proposals_expires_at ON proposals(expires_at) 
WHERE status = 'pending';

-- Índice compuesto: propuestas pendientes de un post
CREATE INDEX idx_proposals_post_pending ON proposals(post_id, status) 
WHERE status = 'pending';

-- ============================================
-- ÍNDICES: appointments
-- ============================================

-- Relación 1-to-1 con proposal (UNIQUE ya crea índice automático)
-- CREATE UNIQUE INDEX idx_appointments_proposal_id ON appointments(proposal_id);

-- Filtrar por status (calendario solo muestra scheduled + in_progress)
CREATE INDEX idx_appointments_status ON appointments(status);

-- Calendario: trabajos por fecha
CREATE INDEX idx_appointments_scheduled_date ON appointments(scheduled_date);

-- Calendario profesional: fecha + hora ordenado
CREATE INDEX idx_appointments_professional_schedule ON appointments(scheduled_date, scheduled_time);

-- Recordatorios: trabajos próximos (24hs y 1h antes)
CREATE INDEX idx_appointments_reminders ON appointments(scheduled_date, scheduled_time, status) 
WHERE status IN ('scheduled', 'in_progress');

-- ============================================
-- ÍNDICES: chats
-- ============================================

-- Listar chats de un cliente
CREATE INDEX idx_chats_client_id ON chats(client_id);

-- Listar chats de un profesional
CREATE INDEX idx_chats_professional_id ON chats(professional_id);

-- Ordenar lista chats por último mensaje (DESC)
CREATE INDEX idx_chats_last_message_at ON chats(last_message_at DESC NULLS LAST);

-- Constraint único: solo 1 chat por par cliente-profesional
CREATE UNIQUE INDEX idx_chats_unique_pair ON chats(
  LEAST(client_id, professional_id),
  GREATEST(client_id, professional_id)
);

COMMENT ON INDEX idx_chats_unique_pair IS 'Evita duplicados chat (A→B y B→A son mismo chat).';

-- ============================================
-- ÍNDICES: messages
-- ============================================

-- Mensajes de un chat (query más frecuente)
CREATE INDEX idx_messages_chat_id ON messages(chat_id);

-- Mensajes enviados por un usuario (historial)
CREATE INDEX idx_messages_sender_id ON messages(sender_id);

-- Ordenar mensajes por timestamp (DESC para scroll infinito)
CREATE INDEX idx_messages_created_at ON messages(chat_id, created_at DESC);

-- Partial index: solo mensajes NO leídos (contador badge)
CREATE INDEX idx_messages_unread ON messages(chat_id, read) 
WHERE read = FALSE;

-- Índice compuesto óptimo: chat + timestamp DESC
CREATE INDEX idx_messages_chat_timeline ON messages(chat_id, created_at DESC);

COMMENT ON INDEX idx_messages_unread IS 'Partial index para contador mensajes no leídos (performance).';

-- ============================================
-- ÍNDICES: payments
-- ============================================

-- Relación con proposal
CREATE INDEX idx_payments_proposal_id ON payments(proposal_id);

-- Relación con appointment
CREATE INDEX idx_payments_appointment_id ON payments(appointment_id);

-- Pagos de un cliente (historial)
CREATE INDEX idx_payments_client_id ON payments(client_id);

-- Pagos a un profesional (historial + cálculos ingresos)
CREATE INDEX idx_payments_professional_id ON payments(professional_id);

-- Filtrar por status
CREATE INDEX idx_payments_status ON payments(status);

-- Tracking MercadoPago (webhooks)
CREATE INDEX idx_payments_mp_payment_id ON payments(mercadopago_payment_id) 
WHERE mercadopago_payment_id IS NOT NULL;

-- Reportes: pagos completados por fecha
CREATE INDEX idx_payments_completed_date ON payments(created_at) 
WHERE status = 'completed';

-- Índice compuesto: pagos profesional + status
CREATE INDEX idx_payments_professional_status ON payments(professional_id, status);

-- ============================================
-- ÍNDICES: reviews
-- ============================================

-- Reviews de un appointment
CREATE INDEX idx_reviews_appointment_id ON reviews(appointment_id);

-- Reviews escritas por un usuario
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);

-- Reviews recibidas por un usuario (para calcular rating)
CREATE INDEX idx_reviews_reviewed_id ON reviews(reviewed_id);

-- Constraint único: 1 review por appointment por usuario
CREATE UNIQUE INDEX idx_reviews_unique_per_user ON reviews(appointment_id, reviewer_id);

-- Índice para cálculo rating promedio
CREATE INDEX idx_reviews_rating_calc ON reviews(reviewed_id, rating);

-- ============================================
-- ÍNDICES: balances
-- ============================================

-- Relación 1-to-1 con professional (UNIQUE ya crea índice)
-- CREATE UNIQUE INDEX idx_balances_professional_id ON balances(professional_id);

-- Partial index: solo deudas (balance < 0) para cronjob
CREATE INDEX idx_balances_negative ON balances(balance) 
WHERE balance < 0;

COMMENT ON INDEX idx_balances_negative IS 'Partial index para cronjob cobro deudas fin de mes.';

-- ============================================
-- ÍNDICES: bonuses (FASE 2)
-- ============================================

-- Bonos por profesional
CREATE INDEX idx_bonuses_professional_id ON bonuses(professional_id);

-- Filtrar por status (pending para payout)
CREATE INDEX idx_bonuses_status ON bonuses(status);

-- Bonos pendientes de pago
CREATE INDEX idx_bonuses_pending ON bonuses(status, created_at) 
WHERE status = 'pending';

-- ============================================
-- ÍNDICES: notifications
-- ============================================

-- Notificaciones de un usuario
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- Filtrar por tipo (analytics)
CREATE INDEX idx_notifications_type ON notifications(type);

-- Partial index: solo no leídas (badge contador)
CREATE INDEX idx_notifications_unread ON notifications(user_id, read) 
WHERE read = FALSE;

-- Ordenar por reciente
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at DESC);

-- Índice compuesto: notificaciones usuario ordenadas
CREATE INDEX idx_notifications_user_timeline ON notifications(user_id, sent_at DESC);

-- ============================================
-- ÍNDICES FULL-TEXT SEARCH (Fase 2)
-- ============================================

-- Búsqueda en títulos/descripciones posts (GIN trigram index)
-- Descomentar cuando se implemente búsqueda:
-- CREATE INDEX idx_posts_fulltext ON posts 
-- USING GIN(to_tsvector('spanish', title || ' ' || description));

-- Búsqueda en nombres profesionales
-- CREATE INDEX idx_users_fulltext ON users 
-- USING GIN(to_tsvector('spanish', full_name));

-- ============================================
-- TRIGGERS
-- ============================================

-- Actualizar users.rating después de INSERT review
CREATE OR REPLACE FUNCTION update_user_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET 
    rating = (
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM reviews
      WHERE reviewed_id = NEW.reviewed_id
    ),
    updated_at = NOW()
  WHERE id = NEW.reviewed_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_rating
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_user_rating();

COMMENT ON FUNCTION update_user_rating() IS 'Recalcula rating promedio usuario después de cada review.';

-- ============================================

-- Actualizar chats.last_message_at después de INSERT message
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

CREATE TRIGGER trigger_update_chat_last_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_chat_last_message();

COMMENT ON FUNCTION update_chat_last_message() IS 'Actualiza timestamp último mensaje en chat (para ordenar lista).';

-- ============================================

-- Validar que professional pertenece a user antes de INSERT professional
CREATE OR REPLACE FUNCTION validate_professional_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar que user_id existe en users
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id) THEN
    RAISE EXCEPTION 'user_id % no existe en tabla users', NEW.user_id;
  END IF;
  
  -- Verificar que user_id no tiene ya un registro professional
  IF EXISTS (SELECT 1 FROM professionals WHERE user_id = NEW.user_id AND id != NEW.id) THEN
    RAISE EXCEPTION 'user_id % ya tiene un registro en professionals', NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_professional_user
BEFORE INSERT OR UPDATE ON professionals
FOR EACH ROW
EXECUTE FUNCTION validate_professional_user();

-- ============================================

-- Auto-marcar professionals.is_verified cuando tiene certificación approved
CREATE OR REPLACE FUNCTION auto_verify_professional()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    UPDATE professionals
    SET 
      is_verified = TRUE,
      updated_at = NOW()
    WHERE id = NEW.professional_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_verify_professional
AFTER INSERT OR UPDATE OF status ON certifications
FOR EACH ROW
WHEN (NEW.status = 'approved')
EXECUTE FUNCTION auto_verify_professional();

COMMENT ON FUNCTION auto_verify_professional() IS 'Marca professional como verificado cuando primera certificación aprobada.';

-- ============================================

-- Validar que appointment.rescheduled_count <= 2
CREATE OR REPLACE FUNCTION validate_reschedule_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rescheduled_count > 2 THEN
    RAISE EXCEPTION 'Límite de reprogramaciones alcanzado (max 2)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_reschedule_limit
BEFORE INSERT OR UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION validate_reschedule_limit();

-- ============================================

-- Auto-actualizar updated_at en tablas críticas
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a todas las tablas con campo updated_at
CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_professionals_updated_at
BEFORE UPDATE ON professionals
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_posts_updated_at
BEFORE UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_proposals_updated_at
BEFORE UPDATE ON proposals
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_appointments_updated_at
BEFORE UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_chats_updated_at
BEFORE UPDATE ON chats
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_balances_updated_at
BEFORE UPDATE ON balances
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CONSTRAINTS ADICIONALES
-- ============================================

-- users: rating debe estar entre 0 y 5
ALTER TABLE users ADD CONSTRAINT chk_users_rating 
CHECK (rating >= 0 AND rating <= 5);

-- users: oauth_provider y oauth_id deben ser ambos NULL o ambos NOT NULL
ALTER TABLE users ADD CONSTRAINT chk_users_oauth 
CHECK (
  (oauth_provider IS NULL AND oauth_id IS NULL) OR 
  (oauth_provider IS NOT NULL AND oauth_id IS NOT NULL)
);

-- professionals: hourly_rate debe ser positivo
ALTER TABLE professionals ADD CONSTRAINT chk_professionals_hourly_rate 
CHECK (hourly_rate > 0);

-- certifications: status debe ser válido
ALTER TABLE certifications ADD CONSTRAINT chk_cert_status 
CHECK (status IN ('pending', 'approved', 'rejected'));

-- certifications: si status != pending, debe tener reviewed_by
ALTER TABLE certifications ADD CONSTRAINT chk_cert_reviewed 
CHECK (
  (status = 'pending' AND reviewed_by IS NULL) OR
  (status IN ('approved', 'rejected') AND reviewed_by IS NOT NULL)
);

-- posts: status debe ser válido
ALTER TABLE posts ADD CONSTRAINT chk_post_status 
CHECK (status IN ('open', 'closed', 'expired', 'completed'));

-- post_media: media_type debe ser válido
ALTER TABLE post_media ADD CONSTRAINT chk_media_type 
CHECK (media_type IN ('image', 'video'));

-- proposals: status debe ser válido
ALTER TABLE proposals ADD CONSTRAINT chk_proposal_status 
CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled'));

-- proposals: price debe ser positivo
ALTER TABLE proposals ADD CONSTRAINT chk_proposal_price 
CHECK (price > 0);

-- appointments: status debe ser válido
ALTER TABLE appointments ADD CONSTRAINT chk_appt_status 
CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled_by_client', 'cancelled_by_professional'));

-- appointments: rescheduled_count máximo 2
ALTER TABLE appointments ADD CONSTRAINT chk_appt_rescheduled 
CHECK (rescheduled_count <= 2);

-- appointments: si cancelled, debe tener cancelled_by y cancellation_reason
ALTER TABLE appointments ADD CONSTRAINT chk_appt_cancelled 
CHECK (
  (status LIKE 'cancelled%' AND cancelled_by IS NOT NULL AND cancellation_reason IS NOT NULL) OR
  (status NOT LIKE 'cancelled%' AND cancelled_by IS NULL)
);

-- messages: debe tener al menos texto o media
ALTER TABLE messages ADD CONSTRAINT chk_message_content 
CHECK (message_text IS NOT NULL OR media_url IS NOT NULL);

-- payments: amounts deben ser válidos
ALTER TABLE payments ADD CONSTRAINT chk_payment_amounts 
CHECK (
  amount > 0 AND 
  commission_amount >= 0 AND 
  net_amount >= 0 AND 
  penalty_amount >= 0
);

-- payments: status debe ser válido
ALTER TABLE payments ADD CONSTRAINT chk_payment_status 
CHECK (status IN ('pending', 'completed', 'refunded', 'failed'));

-- payments: payment_method debe ser válido
ALTER TABLE payments ADD CONSTRAINT chk_payment_method 
CHECK (payment_method IN ('mercadopago', 'cash'));

-- reviews: rating debe estar entre 1 y 5
ALTER TABLE reviews ADD CONSTRAINT chk_review_rating 
CHECK (rating >= 1 AND rating <= 5);

-- bonuses: bonus_amount debe ser positivo
ALTER TABLE bonuses ADD CONSTRAINT chk_bonus_amount 
CHECK (bonus_amount > 0);

-- bonuses: status debe ser válido
ALTER TABLE bonuses ADD CONSTRAINT chk_bonus_status 
CHECK (status IN ('pending', 'paid'));

-- ============================================
-- ANÁLISIS Y MANTENIMIENTO
-- ============================================

-- Actualizar estadísticas después de crear índices (mejora query planner)
ANALYZE users;
ANALYZE professionals;
ANALYZE categories;
ANALYZE professional_categories;
ANALYZE certifications;
ANALYZE posts;
ANALYZE post_categories;
ANALYZE post_media;
ANALYZE proposals;
ANALYZE appointments;
ANALYZE chats;
ANALYZE messages;
ANALYZE payments;
ANALYZE reviews;
ANALYZE balances;
ANALYZE bonuses;
ANALYZE notifications;

-- ============================================
-- COMENTARIOS FINALES
-- ============================================

COMMENT ON DATABASE quickfixu IS 'QuickFixU - Marketplace bidireccional servicios profesionales';

-- Tamaño estimado índices (con 10K usuarios, 5K posts, 20K mensajes):
-- idx_users_location: ~2MB (GIST)
-- idx_posts_location: ~1MB (GIST)
-- idx_messages_chat_timeline: ~5MB (B-tree)
-- Total índices: ~50-80MB (aceptable para MVP)

-- Performance esperado con índices:
-- Búsqueda geolocalizada profesionales: <100ms
-- Feed posts profesional: <200ms
-- Historial chat (50 mensajes): <50ms
-- Cálculo rating promedio: <10ms (trigger + índice)

-- Monitoreo recomendado (pg_stat_user_indexes):
-- SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public' ORDER BY idx_scan DESC;
-- Índices con idx_scan = 0 después de 1 mes → candidatos a eliminar

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
