import React from 'react';
import {
  View,
  Text,
  Modal as RNModal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../../constants/config';

export type ModalType = 'info' | 'success' | 'error' | 'warning' | 'coming-soon';

export interface ModalButton {
  label: string;
  onPress: () => void;
}

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  type?: ModalType;
  primaryButton?: ModalButton;
  secondaryButton?: ModalButton;
  children?: React.ReactNode;
  // Legacy props (backward compatibility)
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
  showConfirm?: boolean;
}

const TYPE_CONFIG: Record<ModalType, {
  icon: string;
  iconColor: string;
  buttonColor: string;
}> = {
  success: {
    icon: '✅',
    iconColor: '#16A34A',
    buttonColor: '#16A34A',
  },
  error: {
    icon: '❌',
    iconColor: '#EF4444',
    buttonColor: '#EF4444',
  },
  info: {
    icon: 'ℹ️',
    iconColor: '#1E40AF',
    buttonColor: '#1E40AF',
  },
  warning: {
    icon: '⚠️',
    iconColor: '#F59E0B',
    buttonColor: '#F59E0B',
  },
  'coming-soon': {
    icon: '🚀',
    iconColor: '#F97316',
    buttonColor: '#F97316',
  },
};

const COMING_SOON_MESSAGE = 'Esta funcionalidad estará disponible muy pronto';

const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  message,
  type = 'info',
  primaryButton,
  secondaryButton,
  children,
  // Legacy props
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  showCancel = false,
  showConfirm = true,
}) => {
  const config = TYPE_CONFIG[type];

  // Resolve the displayed message
  const resolvedMessage = message ?? (type === 'coming-soon' ? COMING_SOON_MESSAGE : undefined);

  // Resolve primary button: new API takes precedence over legacy
  const handlePrimaryPress = () => {
    if (primaryButton) {
      primaryButton.onPress();
    } else {
      onConfirm?.();
      onClose();
    }
  };

  const handleSecondaryPress = () => {
    if (secondaryButton) {
      secondaryButton.onPress();
    } else {
      onCancel?.();
      onClose();
    }
  };

  // Determine whether to show buttons
  const hasPrimaryButton = primaryButton !== undefined || showConfirm;
  const hasSecondaryButton = secondaryButton !== undefined || showCancel;

  const primaryLabel = primaryButton?.label ?? confirmText;
  const secondaryLabel = secondaryButton?.label ?? cancelText;

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayTouch} onPress={onClose} activeOpacity={1}>
          <View style={styles.container}>
            {/* Close button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>

            {/* Icon */}
            <View style={[styles.iconContainer, { backgroundColor: config.iconColor + '15' }]}>
              <Text style={styles.icon}>{config.icon}</Text>
            </View>

            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Message */}
            {resolvedMessage ? (
              <Text style={styles.message}>{resolvedMessage}</Text>
            ) : null}

            {/* Custom content */}
            {children ? <View style={styles.content}>{children}</View> : null}

            {/* Buttons */}
            {(hasPrimaryButton || hasSecondaryButton) && (
              <View style={styles.buttonContainer}>
                {hasSecondaryButton && (
                  <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={handleSecondaryPress}
                  >
                    <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
                  </TouchableOpacity>
                )}
                {hasPrimaryButton && (
                  <TouchableOpacity
                    style={[styles.button, styles.primaryButton, { backgroundColor: config.buttonColor }]}
                    onPress={handlePrimaryPress}
                  >
                    <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  overlayTouch: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.gray500,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray900,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  message: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray500,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  content: {
    width: '100%',
    marginBottom: SPACING.lg,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    width: '100%',
    marginTop: SPACING.sm,
  },
  button: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: COLORS.gray100,
  },
  secondaryButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.gray700,
  },
  primaryButton: {},
  primaryButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.white,
  },
});

export default Modal;
