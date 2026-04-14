import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
} from 'react-native';
import { Category } from '../../types';
import { userService } from '../../services';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE } from '../../constants/config';

interface CategoryPickerProps {
  label?: string;
  value?: Category;
  onChange?: (category: Category) => void;
  error?: string;
  placeholder?: string;
}

const CategoryPicker: React.FC<CategoryPickerProps> = ({
  label,
  value,
  onChange,
  error,
  placeholder = 'Seleccionar categoría',
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await userService.getCategories();
      setCategories(data);
    } catch (err) {
      // Fallback categories if API fails
      setCategories([
        { id: '1', name: 'Electricista', slug: 'electricidad', icon: '⚡' },
        { id: '2', name: 'Plomero', slug: 'plomeria', icon: '🔧' },
        { id: '3', name: 'Gasista', slug: 'gas', icon: '🔥' },
        { id: '4', name: 'Carpintero', slug: 'carpinteria', icon: '🪵' },
        { id: '5', name: 'Pintor', slug: 'pintura', icon: '🎨' },
        { id: '6', name: 'Jardinero', slug: 'jardineria', icon: '🌿' },
        { id: '7', name: 'Limpeza', slug: 'limpieza', icon: '🧹' },
        { id: '8', name: 'Aire Acondicionado', slug: 'aire-acondicionado', icon: '❄️' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (category: Category) => {
    onChange?.(category);
    setShowPicker(false);
  };

  const getCategoryIcon = (slug: string): string => {
    const iconMap: Record<string, string> = {
      electricidad: '⚡',
      plomeria: '🔧',
      gas: '🔥',
      carpinteria: '🪵',
      pintura: '🎨',
      jardineria: '🌿',
      limpieza: '🧹',
      'aire-acondicionado': '❄️',
    };
    return iconMap[slug] || '🔨';
  };

  const renderCategory = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={[
        styles.categoryItem,
        value?.id === item.id && styles.selectedCategory,
      ]}
      onPress={() => handleSelect(item)}
    >
      <Text style={styles.categoryIcon}>
        {item.icon || getCategoryIcon(item.slug)}
      </Text>
      <View style={styles.categoryInfo}>
        <Text
          style={[
            styles.categoryName,
            value?.id === item.id && styles.selectedCategoryName,
          ]}
        >
          {item.name}
        </Text>
        {item.description && (
          <Text style={styles.categoryDescription}>{item.description}</Text>
        )}
      </View>
      {value?.id === item.id && (
        <Text style={styles.checkmark}>✓</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.input, error && styles.inputError]}
        onPress={() => setShowPicker(true)}
      >
        {value ? (
          <View style={styles.selectedValue}>
            <Text style={styles.selectedIcon}>
              {value.icon || getCategoryIcon(value.slug)}
            </Text>
            <Text style={styles.selectedText}>{value.name}</Text>
          </View>
        ) : (
          <Text style={styles.placeholder}>{placeholder}</Text>
        )}
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Categoría</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowPicker(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Cargando...</Text>
              </View>
            ) : (
              <FlatList
                data={categories}
                renderItem={renderCategory}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
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
  selectedValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  selectedText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray900,
    fontWeight: '500',
  },
  placeholder: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray400,
  },
  chevron: {
    fontSize: 20,
    color: COLORS.gray400,
    transform: [{ rotate: '90deg' }],
  },
  errorText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '80%',
    paddingBottom: SPACING.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.gray900,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: COLORS.gray600,
  },
  listContent: {
    padding: SPACING.md,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.gray50,
  },
  selectedCategory: {
    backgroundColor: COLORS.primary + '15',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  categoryIcon: {
    fontSize: 28,
    marginRight: SPACING.md,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
    color: COLORS.gray900,
  },
  selectedCategoryName: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  categoryDescription: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray500,
    marginTop: 2,
  },
  checkmark: {
    fontSize: 18,
    color: COLORS.primary,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.gray500,
  },
});

export default CategoryPicker;
