import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE } from '../../constants/config';

interface TimePickerProps {
  label?: string;
  value?: Date;
  onChange?: (date: Date) => void;
  error?: string;
  placeholder?: string;
  minHour?: number;
  maxHour?: number;
}

const TimePicker: React.FC<TimePickerProps> = ({
  label,
  value,
  onChange,
  error,
  placeholder = 'Seleccionar hora',
  minHour = 8,
  maxHour = 20,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState<{ hours: number; minutes: number } | undefined>(
    value ? { hours: value.getHours(), minutes: value.getMinutes() } : undefined
  );

  const formatTime = (hours: number, minutes: number): string => {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const formatDisplayTime = (hours: number, minutes: number): string => {
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const handleTimeChange = (hours: number, minutes: number) => {
    const time = { hours, minutes };
    setSelectedTime(time);

    const newDate = new Date();
    newDate.setHours(hours, minutes, 0, 0);
    onChange?.(newDate);
  };

  const hours = Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);
  const minutes = [0, 15, 30, 45];

  const displayTime = value
    ? formatDisplayTime(value.getHours(), value.getMinutes())
    : selectedTime
    ? formatDisplayTime(selectedTime.hours, selectedTime.minutes)
    : null;

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.input, error && styles.inputError]}
        onPress={() => setShowPicker(true)}
      >
        <Text style={[styles.inputText, !displayTime && styles.placeholder]}>
          {displayTime || placeholder}
        </Text>
        <Text style={styles.icon}>🕐</Text>
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={showPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPicker(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Seleccionar Hora</Text>

            <View style={styles.pickerColumns}>
              <View style={styles.pickerColumn}>
                <Text style={styles.columnLabel}>Hora</Text>
                <ScrollView
                  style={styles.scrollColumn}
                  showsVerticalScrollIndicator={false}
                >
                  {hours.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[
                        styles.timeOption,
                        selectedTime?.hours === h && styles.selectedOption,
                      ]}
                      onPress={() => handleTimeChange(h, selectedTime?.minutes || 0)}
                    >
                      <Text
                        style={[
                          styles.timeOptionText,
                          selectedTime?.hours === h && styles.selectedOptionText,
                        ]}
                      >
                        {formatTime(h, 0)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.pickerColumn}>
                <Text style={styles.columnLabel}>Minutos</Text>
                <ScrollView
                  style={styles.scrollColumn}
                  showsVerticalScrollIndicator={false}
                >
                  {minutes.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.timeOption,
                        selectedTime?.minutes === m && styles.selectedOption,
                      ]}
                      onPress={() => handleTimeChange(selectedTime?.hours || minHour, m)}
                    >
                      <Text
                        style={[
                          styles.timeOptionText,
                          selectedTime?.minutes === m && styles.selectedOptionText,
                        ]}
                      >
                        {formatTime(0, m)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => setShowPicker(false)}
            >
              <Text style={styles.confirmButtonText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.gray700,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputError: {
    borderColor: COLORS.error,
    backgroundColor: '#FEF2F2',
  },
  inputText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray900,
  },
  placeholder: {
    color: COLORS.gray400,
  },
  icon: {
    fontSize: 18,
  },
  errorText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 320,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.gray900,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  pickerColumns: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  pickerColumn: {
    flex: 1,
  },
  columnLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.gray600,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  scrollColumn: {
    maxHeight: 200,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.gray50,
  },
  timeOption: {
    padding: SPACING.md,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
  },
  selectedOption: {
    backgroundColor: COLORS.primaryLight + '20',
  },
  timeOptionText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray800,
  },
  selectedOptionText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  confirmButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
});

export default TimePicker;
