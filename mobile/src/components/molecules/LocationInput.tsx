import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE } from '../../constants/config';

interface LocationSuggestion {
  description: string;
  place_id: string;
}

interface LocationInputProps {
  label?: string;
  value?: string;
  onChange?: (address: string) => void;
  error?: string;
  placeholder?: string;
}

const LocationInput: React.FC<LocationInputProps> = ({
  label,
  value,
  onChange,
  error,
  placeholder = 'Ingresa tu dirección',
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  // Mock suggestions for demo (in production use Google Places API)
  const mockSuggestions: LocationSuggestion[] = [
    { description: 'Av. Corrientes 1234, Buenos Aires', place_id: '1' },
    { description: 'Av. Santa Fe 2200, Buenos Aires', place_id: '2' },
    { description: 'Calle Florida 500, Buenos Aires', place_id: '3' },
    { description: 'Av. Rivadavia 4500, Buenos Aires', place_id: '4' },
    { description: 'Av. Libertador 1500, Buenos Aires', place_id: '5' },
  ];

  const handleInputChange = (text: string) => {
    onChange?.(text);

    if (text.length > 2) {
      setLoading(true);
      // Simulate API call for suggestions
      setTimeout(() => {
        const filtered = mockSuggestions.filter((s) =>
          s.description.toLowerCase().includes(text.toLowerCase())
        );
        setSuggestions(filtered.length > 0 ? filtered : mockSuggestions);
        setShowSuggestions(true);
        setLoading(false);
      }, 300);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (suggestion: LocationSuggestion) => {
    onChange?.(suggestion.description);
    setShowSuggestions(false);
  };

  const handleUseCurrentLocation = () => {
    // Placeholder for geolocation
    console.log('Use current location - requires expo-location');
    onChange?.('Av. Corrientes 1234, Buenos Aires (Ubicación actual)');
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, error && styles.inputError]}
          value={value}
          onChangeText={handleInputChange}
          placeholder={placeholder}
          placeholderTextColor={COLORS.gray400}
          onFocus={() => value && setShowSuggestions(true)}
        />
        <TouchableOpacity
          style={styles.locationButton}
          onPress={handleUseCurrentLocation}
        >
          <Text style={styles.locationIcon}>📍</Text>
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {showSuggestions && (
        <View style={styles.suggestionsContainer}>
          <TouchableOpacity
            style={styles.useCurrentLocation}
            onPress={handleUseCurrentLocation}
          >
            <Text style={styles.currentLocationIcon}>🎯</Text>
            <Text style={styles.currentLocationText}>Usar ubicación actual</Text>
          </TouchableOpacity>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Buscando...</Text>
            </View>
          ) : (
            <FlatList
              data={suggestions}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestionItem}
                  onPress={() => handleSelectSuggestion(item)}
                >
                  <Text style={styles.suggestionIcon}>📍</Text>
                  <Text style={styles.suggestionText}>{item.description}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.place_id}
              style={styles.suggestionsList}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      )}

      {/* Backdrop to close suggestions */}
      {showSuggestions && (
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={0}
          onPress={() => setShowSuggestions(false)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
    zIndex: 1000,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.gray700,
    marginBottom: SPACING.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.gray900,
  },
  inputError: {
    borderColor: COLORS.error,
    backgroundColor: '#FEF2F2',
  },
  locationButton: {
    position: 'absolute',
    right: SPACING.sm,
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationIcon: {
    fontSize: 18,
  },
  errorText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1001,
    maxHeight: 300,
  },
  useCurrentLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  currentLocationIcon: {
    fontSize: 18,
    marginRight: SPACING.sm,
  },
  currentLocationText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    fontWeight: '500',
  },
  suggestionsList: {
    maxHeight: 220,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray50,
  },
  suggestionIcon: {
    fontSize: 16,
    marginRight: SPACING.sm,
    color: COLORS.gray500,
  },
  suggestionText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray800,
  },
  loadingContainer: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray500,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
});

export default LocationInput;
