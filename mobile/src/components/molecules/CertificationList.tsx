import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, FONT_SIZE } from '../../constants/config';
import CertificationItem from './CertificationItem';
import { Certification } from '../../types';

interface CertificationListProps {
  certifications: Certification[];
  onDelete?: (id: number) => void;
  style?: ViewStyle;
}

const CertificationList: React.FC<CertificationListProps> = ({
  certifications,
  onDelete,
  style,
}) => {
  if (certifications.length === 0) {
    return (
      <View style={[styles.emptyContainer, style]}>
        <Text style={styles.emptyIcon}>📂</Text>
        <Text style={styles.emptyText}>Sin certificaciones</Text>
        <Text style={styles.emptySubtext}>
          Subí tus títulos y certificados para verificar tu perfil
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {certifications.map((cert) => (
        <CertificationItem
          key={cert.id}
          certification={cert}
          onDelete={onDelete}
          style={styles.item}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
  },
  item: {
    // Each item has its own border/shadow
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.gray700,
    marginBottom: SPACING.xs,
  },
  emptySubtext: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default CertificationList;
