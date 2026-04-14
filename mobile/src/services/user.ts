import { API_BASE_URL } from '../constants/config';
import { Category, Professional, UserBackend, ProfileUpdateData } from '../types';

export interface SearchFilters {
  category?: string;
  query?: string;
  sortBy?: 'nearest' | 'best_rated' | 'most_reviews' | 'newest';
  latitude?: number;
  longitude?: number;
  limit?: number;
  offset?: number;
}

export interface SearchProfessionalsResponse {
  professionals: Professional[];
  total: number;
  hasMore: boolean;
}

class UserService {
  private baseUrl = API_BASE_URL;

  private getAuthHeaders(token: string): HeadersInit {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

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
      throw new Error(error.message || 'Request failed');
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>('/api/categories');
  }

  /**
   * Get current user's profile
   */
  async getProfile(token: string): Promise<UserBackend> {
    return this.request<UserBackend>('/api/users/me', {
      headers: this.getAuthHeaders(token),
    });
  }

  /**
   * Update current user's profile
   */
  async updateProfile(
    data: ProfileUpdateData,
    token: string
  ): Promise<UserBackend> {
    return this.request<UserBackend>('/api/users/me', {
      method: 'PATCH',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(data),
    });
  }

  /**
   * Upload profile photo
   */
  async uploadProfilePhoto(
    uri: string,
    token: string
  ): Promise<{ profilePhotoUrl: string; message: string }> {
    const formData = new FormData();
    formData.append('photo', {
      uri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    } as any);

    const response = await fetch(`${this.baseUrl}/api/users/me/photo`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(error.message || 'Upload failed');
    }

    return response.json();
  }

  /**
   * Delete user account
   */
  async deleteAccount(token: string): Promise<void> {
    return this.request<void>('/api/users/me', {
      method: 'DELETE',
      headers: this.getAuthHeaders(token),
    });
  }

  /**
   * Search professionals
   * Defaults to Buenos Aires coords when no location is provided.
   */
  async searchProfessionals(
    filters: SearchFilters = {}
  ): Promise<SearchProfessionalsResponse> {
    const DEFAULT_LAT = -34.6037;
    const DEFAULT_LNG = -58.3816;
    const DEFAULT_RADIUS = 30;

    const lat = filters.latitude ?? DEFAULT_LAT;
    const lng = filters.longitude ?? DEFAULT_LNG;
    const radius = DEFAULT_RADIUS;

    const params = new URLSearchParams();

    params.append('lat', lat.toString());
    params.append('lng', lng.toString());
    params.append('radius', radius.toString());

    if (filters.category) params.append('category', filters.category);
    if (filters.query) params.append('q', filters.query);
    if (filters.sortBy) params.append('sort', filters.sortBy);
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.offset) params.append('offset', filters.offset.toString());

    const queryString = params.toString();
    const endpoint = queryString 
      ? `/api/professionals/search?${queryString}` 
      : '/api/professionals/search';

    return this.request<SearchProfessionalsResponse>(endpoint);
  }

  async getProfessionalById(id: string): Promise<Professional> {
    return this.request<Professional>(`/api/professionals/${id}`);
  }
}

export const userService = new UserService();
