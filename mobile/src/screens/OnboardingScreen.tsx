import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import OnboardingCarousel, { OnboardingData } from '../components/organisms/OnboardingCarousel';
import { RootStackParamList } from '../types';
import { COLORS } from '../constants/config';

type OnboardingNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

interface OnboardingScreenProps {
  navigation: OnboardingNavigationProp;
}

const ONBOARDING_DATA: OnboardingData[] = [
  {
    title: 'Bienvenido a QuickFixU',
    subtitle: 'La app que conecta clientes con profesionales cerca de ti',
    icon: '🏠',
    backgroundColor: COLORS.primary,
  },
  {
    title: 'Publicá lo que necesitás',
    subtitle: 'Describe tu problema y recibí presupuestos de profesionales verificados',
    icon: '📝',
    backgroundColor: COLORS.primaryLight,
  },
  {
    title: 'Hacé crecer tu negocio',
    subtitle: 'Encontrá clientes que necesitan tus servicios y construí tu reputación',
    icon: '💼',
    backgroundColor: COLORS.accent,
  },
];

const STORAGE_KEY = '@quickfixu:onboarding_completed';

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ navigation }) => {
  const handleComplete = async (role: 'client' | 'professional') => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
      // Navigate to Auth - the role will be selected on the Register screen
      navigation.replace('Auth');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  };

  const handleSkip = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
      navigation.replace('Auth');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <OnboardingCarousel
        data={ONBOARDING_DATA}
        onComplete={handleComplete}
        onSkip={handleSkip}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
});

export default OnboardingScreen;
