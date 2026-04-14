import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../constants/config';
import StatusBadge from '../atoms/StatusBadge';
import { Certification } from '../../types';

interface CertificationItemProps {
  certification: Certification;
  onDelete?: (id: number) => void;
  style?: ViewStyle;
}

const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const getFileName = (fileUrl: string): string => {
  const parts = fileUrl.split('/');
  const name = parts[parts.length - 1] || 'Certificación';
  // Decode URI encoded characters
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
};

const CertificationItem: React.FC<CertificationItemProps> = ({
  certification,
  onDelete,
  style,
}) => {
  const fileName = getFileName(certification.fileUrl);
  const uploadDate = formatDate(certification.uploadedAt);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.fileIconContainer}>
        <Text style={styles.fileIcon}>📄</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="tail">
          {fileName}
        </Text>
        <Text style={styles.uploadDate}>Subido el {uploadDate}</Text>
        <StatusBadge status={certification.status} style={styles.badge} />
      </View>

      {onDelete && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(certification.id)}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Text style={styles.deleteIcon}>🗑️</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  fileIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIcon: {
    fontSize: 22,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  fileName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray900,
  },
  uploadDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray500,
  },
  badge: {
    marginTop: 2,
  },
  deleteButton: {
    padding: SPACING.xs,
  },
  deleteIcon: {
    fontSize: 18,
  },
});

export default CertificationItem;
