import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../constants/config';
import CertificationList from '../molecules/CertificationList';
import { Certification } from '../../types';

interface CertificationsSectionProps {
  certifications: Certification[];
  onUpload: () => void;
  onDelete?: (id: number) => void;
  loading?: boolean;
  style?: ViewStyle;
}

const CertificationsSection: React.FC<CertificationsSectionProps> = ({
  certifications,
  onUpload,
  onDelete,
  loading = false,
  style,
}) => {
  const approvedCount = certifications.filter(c => c.status === 'approved').length;
  const pendingCount = certifications.filter(c => c.status === 'pending').length;

  return (
    <View style={[styles.container, style]}>
      {/* Section Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Certificaciones</Text>
          {certifications.length > 0 && (
            <Text style={styles.summary}>
              {approvedCount} aprobada{approvedCount !== 1 ? 's' : ''}
              {pendingCount > 0 ? ` · ${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}` : ''}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={onUpload}
          activeOpacity={0.8}
        >
          <Text style={styles.uploadButtonIcon}>📎</Text>
          <Text style={styles.uploadButtonText}>Subir</Text>
        </TouchableOpacity>
      </View>

      {/* Info banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerIcon}>ℹ️</Text>
        <Text style={styles.infoBannerText}>
          Las certificaciones verificadas aumentan tu confianza ante los clientes
        </Text>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : (
        <CertificationList
          certifications={certifications}
          onDelete={onDelete}
        />
      )}

      {/* Upload CTA if empty */}
      {!loading && certifications.length === 0 && (
        <TouchableOpacity
          style={styles.uploadCta}
          onPress={onUpload}
          activeOpacity={0.8}
        >
          <Text style={styles.uploadCtaIcon}>⬆️</Text>
          <Text style={styles.uploadCtaText}>Subir primera certificación</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gray900,
  },
  summary: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray500,
    marginTop: 2,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  uploadButtonIcon: {
    fontSize: 14,
  },
  uploadButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.white,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.info + '10',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  infoBannerIcon: {
    fontSize: FONT_SIZE.sm,
  },
  infoBannerText: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.info,
    lineHeight: 18,
  },
  loadingContainer: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  uploadCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary + '10',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
    borderStyle: 'dashed',
    padding: SPACING.md,
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  uploadCtaIcon: {
    fontSize: FONT_SIZE.lg,
  },
  uploadCtaText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.primary,
  },
});

export default CertificationsSection;
