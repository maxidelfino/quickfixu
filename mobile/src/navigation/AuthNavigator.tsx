import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../types';
import { COLORS } from '../constants/config';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import RegisterProfessionalScreen from '../screens/RegisterProfessionalScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.white,
        },
        headerTintColor: COLORS.primary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          title: 'Crear Cuenta',
          headerBackTitle: 'Atrás',
        }}
      />
      <Stack.Screen
        name="RegisterProfessional"
        component={RegisterProfessionalScreen}
        options={{
          title: 'Registrar Profesional',
          headerBackTitle: 'Atrás',
        }}
      />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
