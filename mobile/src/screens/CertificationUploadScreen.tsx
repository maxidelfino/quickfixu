import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../stores/authStore';
import { professionalsService } from '../services/professionals';
import { MainStackParamList } from '../types';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE, FONT_WEIGHT } from '../constants/config';
import FilePreview, { SelectedFile } from '../components/atoms/FilePreview';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

type UploadState = 'idle' | 'picked' | 'uploading' | 'success' | 'error';

const ACCEPTED_TYPES = ['PDF', 'JPEG', 'JPG', 'PNG'];

/**
 * Mock document picker — simulates expo-document-picker behavior.
 * Replace with real expo-document-picker when installed:
 *   import * as DocumentPicker from 'expo-document-picker';
 *   const result = await DocumentPicker.getDocumentAsync({ type: [...], copyToCacheDirectory: true });
 */
const mockPickDocument = async (): Promise<SelectedFile | null> => {
  // Simulate picking a file (mock implementation)
  const mockFiles: SelectedFile[] = [
    {
      name: 'certificado-gasista-2024.pdf',
      uri: 'file:///mock/path/certificado-gasista-2024.pdf',
      mimeType: 'application/pdf',
      size: 245000,
    },
    {
      name: 'diploma-plomeria.jpg',
      uri: 'file:///mock/path/diploma-plomeria.jpg',
      mimeType: 'image/jpeg',
      size: 780000,
    },
    {
      name: 'habilitacion-municipal.png',
      uri: 'file:///mock/path/habilitacion-municipal.png',
      mimeType: 'image/png',
      size: 512000,
    },
  ];
  // Return a random mock file to simulate selection
  return mockFiles[Math.floor(Math.random() * mockFiles.length)];
};

const CertificationUploadScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { token } = useAuthStore();

  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handlePickFile = useCallback(async () => {
    try {
      // In production: use expo-document-picker
      // import * as DocumentPicker from 'expo-document-picker';
      // const result = await DocumentPicker.getDocumentAsync({
      //   type: ['application/pdf', 'image/jpeg', 'image/png'],
      //   copyToCacheDirectory: true,
      // });
      // if (!result.canceled) {
      //   const asset = result.assets[0];
      //   setSelectedFile({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType, size: asset.size });
      //   setUploadState('picked');
      // }

      const file = await mockPickDocument();
      if (file) {
        setSelectedFile(file);
        setUploadState('picked');
        setErrorMessage('');
      }
    } catch (error) {
      console.error('File picker error:', error);
      Alert.alert('Error', 'No se pudo abrir el selector de archivos');
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !token) return;

    setUploadState('uploading');
    setErrorMessage('');

    try {
      await professionalsService.uploadCertification(
        selectedFile.uri,
        selectedFile.mimeType || 'application/octet-stream',
        selectedFile.name,
        token
      );
      setUploadState('success');
    } catch (error: any) {
      console.error('Upload failed:', error);
      setUploadState('error');
      setErrorMessage(error?.message || 'No se pudo subir el archivo. Intentá de nuevo.');
    }
  }, [selectedFile, token]);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setUploadState('idle');
    setErrorMessage('');
  }, []);

  const handleDone = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Success State
  if (uploadState === 'success') {
    return (
      <View style={styles.fullScreenCenter}>
        <View style={styles.successCard}>
          <View style={styles.successIconContainer}>
            <Text style={styles.successIcon}>✅</Text>
          </View>
          <Text style={styles.successTitle}>¡Certificación enviada!</Text>
          <Text style={styles.successSubtitle}>
            Tu certificación fue enviada y está siendo revisada por nuestro equipo.
            Te notificaremos cuando sea aprobada.
          </Text>
          <View style={styles.successInfo}>
            <Text style={styles.successInfoIcon}>⏱️</Text>
            <Text style={styles.successInfoText}>El proceso de revisión tarda 1-3 días hábiles</Text>
          </View>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={handleDone}
            activeOpacity={0.8}
          >
            <Text style={styles.doneButtonText}>Volver al perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.uploadAnotherButton}
            onPress={handleReset}
            activeOpacity={0.7}
          >
            <Text style={styles.uploadAnotherText}>Subir otra certificación</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subir Certificación</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Explanation */}
      <View style={styles.explanationCard}>
        <Text style={styles.explanationIcon}>🎓</Text>
        <Text style={styles.explanationTitle}>Verificá tu perfil profesional</Text>
        <Text style={styles.explanationText}>
          Subí tus títulos, habilitaciones y certificados profesionales para verificar
          tu identidad y aumentar la confianza de los clientes.
        </Text>
      </View>

      {/* Accepted Types */}
      <View style={styles.typesSection}>
        <Text style={styles.typesSectionTitle}>Formatos aceptados</Text>
        <View style={styles.typesList}>
          {ACCEPTED_TYPES.map((type) => (
            <View key={type} style={styles.typeChip}>
              <Text style={styles.typeChipText}>{type}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.typesHint}>Tamaño máximo: 10 MB por archivo</Text>
      </View>

      {/* File Picker Area */}
      {uploadState === 'idle' && (
        <TouchableOpacity
          style={styles.pickerArea}
          onPress={handlePickFile}
          activeOpacity={0.7}
        >
          <Text style={styles.pickerIcon}>📎</Text>
          <Text style={styles.pickerTitle}>Seleccionar archivo</Text>
          <Text style={styles.pickerSubtitle}>PDF, JPEG o PNG · Máx. 10 MB</Text>
        </TouchableOpacity>
      )}

      {/* File Preview */}
      {selectedFile && (uploadState === 'picked' || uploadState === 'error') && (
        <View style={styles.previewSection}>
          <Text style={styles.previewLabel}>Archivo seleccionado</Text>
          <FilePreview file={selectedFile} style={styles.filePreview} />

          {/* Change file */}
          <TouchableOpacity
            style={styles.changeFileButton}
            onPress={handlePickFile}
            activeOpacity={0.7}
          >
            <Text style={styles.changeFileText}>📁 Cambiar archivo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Error State */}
      {uploadState === 'error' && errorMessage ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerIcon}>⚠️</Text>
          <Text style={styles.errorBannerText}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* Upload Button */}
      {(uploadState === 'picked' || uploadState === 'uploading' || uploadState === 'error') && (
        <TouchableOpacity
          style={[
            styles.uploadButton,
            uploadState === 'uploading' && styles.uploadButtonDisabled,
          ]}
          onPress={handleUpload}
          disabled={uploadState === 'uploading'}
          activeOpacity={0.8}
        >
          {uploadState === 'uploading' ? (
            <View style={styles.uploadingRow}>
              <ActivityIndicator size="small" color={COLORS.white} />
              <Text style={styles.uploadButtonText}>Subiendo...</Text>
            </View>
          ) : (
            <Text style={styles.uploadButtonText}>
              {uploadState === 'error' ? '🔄 Reintentar' : '⬆️ Subir certificación'}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {/* Tips */}
      <View style={styles.tipsSection}>
        <Text style={styles.tipsSectionTitle}>Consejos</Text>
        {[
          '📄 Los archivos PDF son ideales para títulos y habilitaciones',
          '🖼️ Las imágenes deben ser claras y legibles',
          '✅ Los documentos deben estar vigentes',
          '🔒 Tus archivos están protegidos y son confidenciales',
        ].map((tip, i) => (
          <View key={i} style={styles.tip}>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray50,
  },
  contentContainer: {
    paddingBottom: SPACING.xxl,
  },
  fullScreenCenter: {
    flex: 1,
    backgroundColor: COLORS.gray50,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl + SPACING.md,
    paddingBottom: SPACING.lg,
  },
  backButton: {
    minWidth: 60,
  },
  backButtonText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.white,
    fontWeight: FONT_WEIGHT.medium,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.white,
  },
  headerPlaceholder: {
    minWidth: 60,
  },
  explanationCard: {
    backgroundColor: COLORS.card,
    margin: SPACING.lg,
    marginBottom: SPACING.sm,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  explanationIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  explanationTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gray900,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  explanationText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray600,
    textAlign: 'center',
    lineHeight: 22,
  },
  typesSection: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  typesSectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray700,
    marginBottom: SPACING.sm,
  },
  typesList: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  typeChip: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  typeChipText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  typesHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray400,
  },
  pickerArea: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 2,
    borderColor: COLORS.primary + '40',
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  pickerIcon: {
    fontSize: 44,
  },
  pickerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.primary,
  },
  pickerSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray500,
  },
  previewSection: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  previewLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.gray700,
    marginBottom: SPACING.sm,
  },
  filePreview: {
    // Inherits FilePreview styles
  },
  changeFileButton: {
    marginTop: SPACING.sm,
    alignSelf: 'flex-end',
  },
  changeFileText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.error + '10',
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.error,
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  errorBannerIcon: {
    fontSize: FONT_SIZE.md,
  },
  errorBannerText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.error,
    lineHeight: 20,
  },
  uploadButton: {
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    paddingVertical: SPACING.md + 2,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadButtonDisabled: {
    opacity: 0.7,
    shadowOpacity: 0,
    elevation: 0,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  uploadButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.white,
  },
  tipsSection: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.sm,
  },
  tipsSectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gray900,
    marginBottom: SPACING.xs,
  },
  tip: {
    // Each tip line
  },
  tipText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray600,
    lineHeight: 20,
  },
  spacer: {
    height: SPACING.xl,
  },
  // Success screen
  successCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    gap: SPACING.md,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.success + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  successIcon: {
    fontSize: 40,
  },
  successTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.gray900,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray600,
    textAlign: 'center',
    lineHeight: 22,
  },
  successInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '15',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
    width: '100%',
  },
  successInfoIcon: {
    fontSize: FONT_SIZE.md,
  },
  successInfoText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray700,
    lineHeight: 18,
  },
  doneButton: {
    backgroundColor: COLORS.primary,
    width: '100%',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.white,
  },
  uploadAnotherButton: {
    paddingVertical: SPACING.sm,
  },
  uploadAnotherText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
  },
});

export default CertificationUploadScreen;
