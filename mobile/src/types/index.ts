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

// Review Types - aligned with backend GET /api/professionals/:id/reviews
export interface Review {
  id: number;
  appointmentId: number;
  reviewerUserId: number;
  reviewerFullName: string;
  reviewerProfilePhotoUrl: string | null;
  reviewedUserId: number;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface ReviewsResponse {
  professionalId: number;
  reviews: Review[];
  total: number;
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

// =============================================================================
// REQUEST / POST VOCABULARY — QuickFixU V1 Marketplace Alignment
// =============================================================================
//
// Canonical V1 term:  `Request`  — client-published marketplace need
// Legacy mobile term: `Post`    — kept as alias during migration only
//
// Both types are identical. `Post` will be removed once backend/routes migrate
// from `/posts` to `/requests`. Until then, the code uses `Request` internally
// and `Post` at the service boundary for API compatibility.
//
// V1 lifecycle states (canonical):
//   draft → published → receiving_proposals → in_coordination → completed/closed/expired
//
// See: docs/backend/V1BackendContracts.md §3 + §5.1
//      docs/backend/V1MarketplaceLifecycle.md §2 + §4.1
// =============================================================================

export type UrgencyLevel = 'normal' | 'urgent';

/** Canonical V1 request status — matches backend RequestStatus enum */
export type RequestStatus =
  | 'draft'
  | 'published'
  | 'receiving_proposals'
  | 'in_coordination'
  | 'closed'
  | 'completed'
  | 'expired';

/**
 * Canonical V1 entity: represents a client need published to the marketplace.
 * Professionals respond with Proposals; the client selects one → creates Appointment.
 */
export interface Request {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  location: string;
  preferredDate?: string;
  budget?: number;           // Reference only — not a transaction, not stored by the platform
  images?: string[];
  userId: string;
  urgency: UrgencyLevel;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Legacy mobile alias — will be removed after backend migrates /posts → /requests.
 * All new code should import `Request` instead.
 * @deprecated Use `Request` — alias kept for API compatibility during migration
 */
export type Post = Request;

/** Legacy alias for `CreatePostData` — prefer `CreateRequestData` in new code */
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

/**
 * Canonical creation payload for a V1 request.
 * `budget` is a commercial reference only — V1 does not process payment.
 */
export interface CreateRequestData {
  title: string;
  description: string;
  categoryId: string;
  location: string;
  preferredDate?: string;
  budget?: number;           // Reference/estimate — payment is agreed externally
  images?: string[];
  urgency: UrgencyLevel;
}

export type MainTabParamList = {
  HomeTab: undefined;
  SearchTab: undefined;
  MessagesTab: undefined;
  ProfileTab: undefined;
};
