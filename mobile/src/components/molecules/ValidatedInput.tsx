import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Input, Text } from '../atoms';
import { COLORS, SPACING } from '../../constants/config';

type ValidationState = 'default' | 'focused' | 'error' | 'success';

interface ValidatedInputProps {
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
  // Validation props
  validateOnBlur?: boolean;
  validateOnChange?: boolean;
  customValidation?: (value: string) => string | undefined;
}

const ValidatedInput: React.FC<ValidatedInputProps> = ({
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
  validateOnBlur = true,
  validateOnChange = false,
  customValidation,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [localError, setLocalError] = useState<string | undefined>(error);
  const [touched, setTouched] = useState(false);

  // Sync external error
  useEffect(() => {
    if (error) {
      setLocalError(error);
    }
  }, [error]);

  const validate = (text: string): string | undefined => {
    if (customValidation) {
      return customValidation(text);
    }
    return undefined;
  };

  const handleChangeText = (text: string) => {
    onChangeText(text);
    
    if (validateOnChange && touched) {
      const validationError = validate(text);
      setLocalError(validationError);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    setTouched(true);
    
    if (validateOnBlur) {
      const validationError = validate(value);
      setLocalError(validationError);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Clear error on focus
    if (localError) {
      setLocalError(undefined);
    }
  };

  const getState = (): ValidationState => {
    if (localError) return 'error';
    if (isFocused) return 'focused';
    if (touched && value.length > 0) return 'success';
    return 'default';
  };

  const state = getState();

  return (
    <View style={[styles.container, containerStyle]}>
      <Text variant="label">
        {label}
        {required && <Text color="error"> *</Text>}
      </Text>
      <Input
        value={value}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        error={localError}
        hint={hint}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        numberOfLines={numberOfLines}
        editable={editable}
        maxLength={maxLength}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.sm,
  },
});

export default ValidatedInput;
