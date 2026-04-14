import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE } from '../../constants/config';

interface ImagePickerProps {
  label?: string;
  images?: string[];
  onImagesChange?: (images: string[]) => void;
  maxImages?: number;
  error?: string;
}

const ImagePicker: React.FC<ImagePickerProps> = ({
  label,
  images = [],
  onImagesChange,
  maxImages = 3,
  error,
}) => {
  const handleAddImage = () => {
    // Placeholder for image picker functionality
    // In production, use expo-image-picker or react-native-image-picker
    console.log('Image picker not implemented - requires expo-image-picker');
    // Placeholder: add a demo image
    if (images.length < maxImages) {
      const placeholderImages = [
        'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400',
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
        'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400',
      ];
      const newImage = placeholderImages[images.length % placeholderImages.length];
      onImagesChange?.([...images, newImage]);
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange?.(newImages);
  };

  const canAddMore = images.length < maxImages;

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.imagesContainer}>
        {images.map((image, index) => (
          <View key={index} style={styles.imageWrapper}>
            <Image source={{ uri: image }} style={styles.image} />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveImage(index)}
            >
              <Text style={styles.removeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        {canAddMore && (
          <TouchableOpacity style={styles.addButton} onPress={handleAddImage}>
            <Text style={styles.addButtonIcon}>📷</Text>
            <Text style={styles.addButtonText}>Agregar</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.helperText}>
        {images.length}/{maxImages} fotos • Toca para agregar
      </Text>
      {error && <Text style={styles.errorText}>{error}</Text>}
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
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  imageWrapper: {
    position: 'relative',
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.gray100,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  addButton: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.gray50,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonIcon: {
    fontSize: 28,
    marginBottom: SPACING.xs,
  },
  addButtonText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray500,
    fontWeight: '500',
  },
  helperText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray500,
    marginTop: SPACING.sm,
  },
  errorText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
});

export default ImagePicker;
