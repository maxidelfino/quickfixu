import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, BORDER_RADIUS, SPACING } from '../../constants/config';

export interface SelectedFile {
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
}

interface FilePreviewProps {
  file: SelectedFile;
  style?: ViewStyle;
}

const getFileIcon = (mimeType?: string, name?: string): string => {
  if (mimeType === 'application/pdf' || name?.toLowerCase().endsWith('.pdf')) return '📄';
  if (mimeType?.startsWith('image/') || name?.match(/\.(jpg|jpeg|png|gif)$/i)) return '🖼️';
  return '📎';
};

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FilePreview: React.FC<FilePreviewProps> = ({ file, style }) => {
  const icon = getFileIcon(file.mimeType, file.name);
  const sizeText = formatFileSize(file.size);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1} ellipsizeMode="middle">
          {file.name}
        </Text>
        {sizeText ? (
          <Text style={styles.size}>{sizeText}</Text>
        ) : null}
      </View>
      <View style={styles.checkmark}>
        <Text style={styles.checkmarkIcon}>✓</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '10',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.gray900,
  },
  size: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray500,
    marginTop: 2,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkIcon: {
    color: COLORS.white,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
  },
});

export default FilePreview;
