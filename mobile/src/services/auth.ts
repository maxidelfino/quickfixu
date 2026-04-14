import { API_BASE_URL } from '../constants/config';
import { LoginCredentials, RegisterData, User, AuthResponse, UserBackend } from '../types';

interface BackendAuthResponse {
  user: UserBackend;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

interface BackendRegisterPayload {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  dni: string;
  address: string;
  yearsExperience?: number;
  description?: string;
  categoryIds?: number[];
}

interface ApiErrorDetailsItem {
  field: string;
  message: string;
}

interface ApiErrorPayload {
  error?: string;
  message?: string;
  details?: ApiErrorDetailsItem[];
}

export class ApiError extends Error {
  status: number;
  details?: ApiErrorDetailsItem[];
  response: {
    status: number;
    details?: ApiErrorDetailsItem[];
    message: string;
  };

  constructor(status: number, payload: ApiErrorPayload, fallbackMessage: string) {
    const message = payload.message || payload.error || fallbackMessage;
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = payload.details;
    this.response = {
      status,
      details: payload.details,
      message,
    };
  }
}

const mapBackendUserToUser = (user: UserBackend): User => ({
  id: String(user.id),
  email: user.email,
  name: user.fullName,
  phone: user.phone || undefined,
  photoUrl: user.profilePhotoUrl,
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt ?? user.createdAt,
});

export const normalizeAuthResponse = (response: BackendAuthResponse): AuthResponse => ({
  user: mapBackendUserToUser(response.user),
  token: response.tokens.accessToken,
  tokens: response.tokens,
});

const toRegisterPayload = (data: RegisterData): BackendRegisterPayload => ({
  fullName: data.name.trim(),
  email: data.email.trim(),
  password: data.password,
  phone: data.phone.trim(),
  dni: data.dni.trim(),
  address: data.address.trim(),
  yearsExperience: data.yearsExperience,
  description: data.bio?.trim() || undefined,
  categoryIds: data.categoryIds?.map((categoryId) => Number(categoryId)),
});

class AuthService {
  private baseUrl = API_BASE_URL;

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new ApiError(response.status, error, 'Request failed');
    }

    return response.json();
  }

  /**
   * OAuth methods - send token to backend and get AuthResponse
   */
  async loginWithGoogle(idToken: string): Promise<AuthResponse> {
    const response = await this.request<BackendAuthResponse>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });

    return normalizeAuthResponse(response);
  }

  async loginWithFacebook(accessToken: string): Promise<AuthResponse> {
    const response = await this.request<BackendAuthResponse>('/api/auth/facebook', {
      method: 'POST',
      body: JSON.stringify({ accessToken }),
    });

    return normalizeAuthResponse(response);
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.request<BackendAuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    return normalizeAuthResponse(response);
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await this.request<BackendAuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(toRegisterPayload(data)),
    });

    return normalizeAuthResponse(response);
  }

  async getCurrentUser(token: string): Promise<User> {
    return this.request<User>('/api/users/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async updateProfile(
    data: Partial<User>,
    token: string
  ): Promise<User> {
    return this.request<User>('/api/users/me', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
  }
}

export const authService = new AuthService();
