import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SPACING } from '../../constants/config';

export type CertificationStatus = 'pending' | 'approved' | 'rejected';

interface StatusBadgeProps {
  status: CertificationStatus;
  style?: ViewStyle;
}

const STATUS_CONFIG: Record<CertificationStatus, { label: string; bg: string; text: string; icon: string }> = {
  pending: {
    label: 'Pendiente',
    bg: '#FEF3C7',
    text: '#92400E',
    icon: '⏳',
  },
  approved: {
    label: 'Aprobado',
    bg: '#D1FAE5',
    text: '#065F46',
    icon: '✅',
  },
  rejected: {
    label: 'Rechazado',
    bg: '#FEE2E2',
    text: '#991B1B',
    icon: '❌',
  },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, style }) => {
  const config = STATUS_CONFIG[status];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bg },
        style,
      ]}
    >
      <Text style={styles.icon}>{config.icon}</Text>
      <Text style={[styles.label, { color: config.text }]}>{config.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
    alignSelf: 'flex-start',
  },
  icon: {
    fontSize: FONT_SIZE.xs,
  },
  label: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },
});

export default StatusBadge;
