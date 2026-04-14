// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  photoUrl?: string;
  role: 'client' | 'professional';
  createdAt: string;
  updatedAt: string;
}

export interface Professional extends User {
  role: 'professional';
  professional?: {
    id: string;
    userId: string;
    categories: Category[];
    bio?: string;
    rating?: number;
    reviewCount?: number;
    yearsExperience?: number;
    isVerified?: boolean;
    isAvailable?: boolean;
    location?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
  };
  distance?: number; // Distance in km from user
}

export interface Client extends User {
  role: 'client';
}

// Category Types
export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
}

// Auth Types
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone: string;
  dni: string;
  address: string;
  role: 'client' | 'professional';
  // Professional specific fields
  categoryIds?: Array<number | string>;
  yearsExperience?: number;
  bio?: string;
}

// Backend User response (full)
export interface UserBackend {
  id: number;
  email: string;
  fullName: string;
  phone: string;
  dni?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  profilePhotoUrl?: string;
  rating: number;
  ratingCount: number;
  role: 'client' | 'professional';
  professional?: ProfessionalData;
  createdAt: string;
  updatedAt?: string;
}

// Backend Professional data
export interface ProfessionalData {
  id: number;
  yearsExperience: number;
  description: string;
  categories: Category[];
  certifications: Certification[];
}

export interface Certification {
  id: number;
  fileUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  uploadedAt: string;
}

// Profile Update Types
export interface ProfileUpdateData {
  fullName?: string;
  phone?: string;
  address?: string;
  // Professional fields
  yearsExperience?: number;
  description?: string;
  categoryIds?: number[];
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
}

// Navigation Types
export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: { role?: 'client' | 'professional' } | undefined;
  RegisterProfessional: undefined;
};

export type MainStackParamList = {
  Home: undefined;
  Profile: undefined;
  EditProfile: undefined;
  Search: undefined;
  Messages: undefined;
  CreatePost: undefined;
  PostPreview: {
    title: string;
    description: string;
    category: Category;
    location: string;
    preferredDate: Date;
    budget: string;
    images: string[];
    urgency: UrgencyLevel;
  };
  CategoryDetail: { categoryId: string; categoryName: string };
  ProfessionalDetail: { professionalId: string };
};

// Post Types
export type UrgencyLevel = 'normal' | 'urgent';

export interface Post {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  location: string;
  preferredDate?: string;
  budget?: number;
  images?: string[];
  userId: string;
  urgency: UrgencyLevel;
  status: 'pending' | 'assigned' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostData {
  title: string;
  description: string;
  categoryId: string;
  location: string;
  preferredDate?: string;
  budget?: number;
  images?: string[];
  urgency: UrgencyLevel;
}

export type MainTabParamList = {
  HomeTab: undefined;
  SearchTab: undefined;
  MessagesTab: undefined;
  ProfileTab: undefined;
};
