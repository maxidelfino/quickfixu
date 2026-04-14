import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, FONT_SIZE } from '../../constants/config';

interface DividerProps {
  label?: string;
  style?: ViewStyle;
}

const Divider: React.FC<DividerProps> = ({ label, style }) => {
  if (label) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.line} />
        <Text style={styles.label}>{label}</Text>
        <View style={styles.line} />
      </View>
    );
  }

  return <View style={[styles.simpleLine, style]} />;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  label: {
    paddingHorizontal: SPACING.md,
    color: COLORS.gray400,
    fontSize: FONT_SIZE.sm,
  },
  simpleLine: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
});

export default Divider;
