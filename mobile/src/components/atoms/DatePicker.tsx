import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE } from '../../constants/config';

interface DatePickerProps {
  label?: string;
  value?: Date;
  onChange?: (date: Date) => void;
  error?: string;
  placeholder?: string;
  minimumDate?: Date;
}

const DatePicker: React.FC<DatePickerProps> = ({
  label,
  value,
  onChange,
  error,
  placeholder = 'Seleccionar fecha',
  minimumDate,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(value);

  const formatDate = (date?: Date): string => {
    if (!date) return '';
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (date) {
      setSelectedDate(date);
      onChange?.(date);
    }
  };

  const today = new Date();
  const displayDate = selectedDate || value;

  // Simple date selection for demo (in production use @react-native-community/datetimepicker)
  const DateSelector = () => {
    const [viewDate, setViewDate] = useState(
      selectedDate || value || today
    );

    const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const days = new Date(year, month + 1, 0).getDate();
      return Array.from({ length: days }, (_, i) => {
        const d = new Date(year, month, i + 1);
        return {
          date: d,
          day: i + 1,
          isCurrentMonth: true,
        };
      });
    };

    const days = getDaysInMonth(viewDate);
    const monthName = viewDate.toLocaleDateString('es-AR', { month: 'long' });
    const year = viewDate.getFullYear();

    const selectDate = (date: Date) => {
      setSelectedDate(date);
      onChange?.(date);
      setShowPicker(false);
    };

    const isSelected = (date: Date) => {
      if (!displayDate) return false;
      return (
        date.getDate() === displayDate.getDate() &&
        date.getMonth() === displayDate.getMonth() &&
        date.getFullYear() === displayDate.getFullYear()
      );
    };

    const isDisabled = (date: Date) => {
      if (minimumDate) {
        const minDate = new Date(minimumDate);
        minDate.setHours(0, 0, 0, 0);
        return date < minDate;
      }
      return date < today;
    };

    return (
      <View style={styles.pickerContainer}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity
            onPress={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))}
            style={styles.pickerNavButton}
          >
            <Text style={styles.pickerNavText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.pickerMonthYear}>
            {monthName} {year}
          </Text>
          <TouchableOpacity
            onPress={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))}
            style={styles.pickerNavButton}
          >
            <Text style={styles.pickerNavText}>›</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.daysGrid}>
          {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((day, i) => (
            <View key={i} style={styles.dayHeaderCell}>
              <Text style={styles.dayHeaderText}>{day}</Text>
            </View>
          ))}
          {Array(viewDate.getDay()).fill(null).map((_, i) => (
            <View key={`empty-${i}`} style={styles.dayCell} />
          ))}
          {days.map(({ date, day }) => {
            const disabled = isDisabled(date);
            const selected = isSelected(date);
            return (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayCell,
                  selected && styles.selectedDay,
                  disabled && styles.disabledDay,
                ]}
                onPress={() => !disabled && selectDate(date)}
                disabled={disabled}
              >
                <Text
                  style={[
                    styles.dayText,
                    selected && styles.selectedDayText,
                    disabled && styles.disabledDayText,
                  ]}
                >
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={() => setShowPicker(false)}
        >
          <Text style={styles.confirmButtonText}>Confirmar</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.input, error && styles.inputError]}
        onPress={() => setShowPicker(true)}
      >
        <Text style={[styles.inputText, !displayDate && styles.placeholder]}>
          {displayDate ? formatDate(displayDate) : placeholder}
        </Text>
        <Text style={styles.icon}>📅</Text>
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
          <View style={styles.modalContent}>
            <DateSelector />
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
    maxWidth: 340,
  },
  pickerContainer: {
    padding: SPACING.sm,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  pickerNavButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerNavText: {
    fontSize: 24,
    color: COLORS.gray700,
    fontWeight: '300',
  },
  pickerMonthYear: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.gray900,
    textTransform: 'capitalize',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayHeaderCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayHeaderText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.gray500,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.full,
  },
  selectedDay: {
    backgroundColor: COLORS.primary,
  },
  disabledDay: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray900,
  },
  selectedDayText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  disabledDayText: {
    color: COLORS.gray400,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  confirmButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
  },
});

export default DatePicker;
