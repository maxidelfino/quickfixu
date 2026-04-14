import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainStackParamList, MainTabParamList } from '../types';
import { COLORS } from '../constants/config';

import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import SearchScreen from '../screens/SearchScreen';
import MessagesScreen from '../screens/MessagesScreen';
import CategoryListScreen from '../screens/CategoryListScreen';
import CategoryDetailScreen from '../screens/CategoryDetailScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import PostPreviewScreen from '../screens/PostPreviewScreen';
import ProfessionalDetailScreen from '../screens/ProfessionalDetailScreen';

// Placeholder screens for now
const SearchStack = createNativeStackNavigator<MainStackParamList>();
const HomeStack = createNativeStackNavigator<MainStackParamList>();
const ProfileStack = createNativeStackNavigator<MainStackParamList>();

const Tab = createBottomTabNavigator<MainTabParamList>();

const HomeStackNavigator = () => {
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'QuickFixU', headerShown: false }}
      />
      <HomeStack.Screen
        name="CategoryList"
        component={CategoryListScreen}
        options={{ title: 'Categorías' }}
      />
      <HomeStack.Screen
        name="CreatePost"
        component={CreatePostScreen}
        options={{ title: 'Nueva Solicitud' }}
      />
      <HomeStack.Screen
        name="PostPreview"
        component={PostPreviewScreen}
        options={{ title: 'Vista Previa' }}
      />
      <HomeStack.Screen
        name="CategoryDetail"
        component={CategoryDetailScreen}
        options={({ route }) => ({
          title: route.params?.categoryName || 'Categoría',
        })}
      />
    </HomeStack.Navigator>
  );
};

const SearchStackNavigator = () => {
  return (
    <SearchStack.Navigator>
      <SearchStack.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: 'Buscar' }}
      />
      <SearchStack.Screen
        name="CategoryList"
        component={CategoryListScreen}
        options={{ title: 'Categorías' }}
      />
      <SearchStack.Screen
        name="CategoryDetail"
        component={CategoryDetailScreen}
        options={({ route }) => ({
          title: route.params?.categoryName || 'Categoría',
        })}
      />
      <SearchStack.Screen
        name="ProfessionalDetail"
        component={ProfessionalDetailScreen}
        options={{ title: 'Perfil Profesional' }}
      />
    </SearchStack.Navigator>
  );
};

const ProfileStackNavigator = () => {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Mi Perfil', headerShown: false }}
      />
      <ProfileStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Editar Perfil', headerShown: false }}
      />
    </ProfileStack.Navigator>
  );
};

const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray400,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: COLORS.white,
        },
        headerTintColor: COLORS.gray900,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: 'Inicio',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <HomeIcon color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchStackNavigator}
        options={{
          title: 'Buscar',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <SearchIcon color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="MessagesTab"
        component={MessagesScreen}
        options={{
          title: 'Mensajes',
          tabBarIcon: ({ color, size }) => (
            <MessagesIcon color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: 'Perfil',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <ProfileIcon color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

// Simple icon components using Unicode/Emoji
const HomeIcon = ({ color, size }: { color: string; size: number }) => (
  <React.Fragment>🏠</React.Fragment>
);

const SearchIcon = ({ color, size }: { color: string; size: number }) => (
  <React.Fragment>🔍</React.Fragment>
);

const MessagesIcon = ({ color, size }: { color: string; size: number }) => (
  <React.Fragment>💬</React.Fragment>
);

const ProfileIcon = ({ color, size }: { color: string; size: number }) => (
  <React.Fragment>👤</React.Fragment>
);

export default MainNavigator;
