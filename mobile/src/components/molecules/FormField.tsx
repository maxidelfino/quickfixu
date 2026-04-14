import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Input, Text } from '../atoms';
import { COLORS, SPACING } from '../../constants/config';

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric' | 'visible-password';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  secureTextEntry?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  maxLength?: number;
  containerStyle?: ViewStyle;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  required = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = false,
  secureTextEntry = false,
  multiline = false,
  numberOfLines = 1,
  editable = true,
  maxLength,
  containerStyle,
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      <Text variant="label">
        {label}
        {required && <Text color="error"> *</Text>}
      </Text>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        error={error}
        hint={hint}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        numberOfLines={numberOfLines}
        editable={editable}
        maxLength={maxLength}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.sm,
  },
});

export default FormField;
