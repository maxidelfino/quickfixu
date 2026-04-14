import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../constants/config';

export type UserRole = 'client' | 'professional';

interface RoleSelectorProps {
  value: UserRole;
  onChange: (role: UserRole) => void;
  style?: ViewStyle;
}

const ROLES = [
  {
    value: 'client' as UserRole,
    icon: '👤',
    title: 'Cliente',
    description: 'Busco servicios profesionales',
  },
  {
    value: 'professional' as UserRole,
    icon: '🔧',
    title: 'Profesional',
    description: 'Ofrezco mis servicios',
  },
];

const RoleSelector: React.FC<RoleSelectorProps> = ({ value, onChange, style }) => {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>¿Qué tipo de usuario sos?</Text>
      <View style={styles.roles}>
        {ROLES.map((role) => (
          <TouchableOpacity
            key={role.value}
            style={[
              styles.roleButton,
              value === role.value && styles.roleButtonActive,
            ]}
            onPress={() => onChange(role.value)}
            activeOpacity={0.7}
          >
            <Text style={styles.roleIcon}>{role.icon}</Text>
            <Text
              style={[
                styles.roleTitle,
                value === role.value && styles.roleTitleActive,
              ]}
            >
              {role.title}
            </Text>
            <Text style={styles.roleDescription}>{role.description}</Text>
            {value === role.value && (
              <View style={styles.checkmark}>
                <Text style={styles.checkmarkText}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.gray700,
    marginBottom: SPACING.sm,
  },
  roles: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  roleButton: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    position: 'relative',
  },
  roleButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '08',
  },
  roleIcon: {
    fontSize: 32,
    marginBottom: SPACING.xs,
  },
  roleTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray700,
    marginBottom: SPACING.xs,
  },
  roleTitleActive: {
    color: COLORS.primary,
  },
  roleDescription: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray500,
    textAlign: 'center',
  },
  checkmark: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: FONT_WEIGHT.bold,
  },
});

export default RoleSelector;
