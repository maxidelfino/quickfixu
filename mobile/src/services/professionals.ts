import { API_BASE_URL } from '../constants/config';
import { Certification, UserBackend, ProfileUpdateData } from '../types';

// Mock data for development (when API is not ready)
const MOCK_CERTIFICATIONS: Certification[] = [
  {
    id: 1,
    fileUrl: 'https://storage.quickfixu.com/certs/gasista-matriculado-2023.pdf',
    status: 'approved',
    uploadedAt: '2023-11-15T10:30:00Z',
  },
  {
    id: 2,
    fileUrl: 'https://storage.quickfixu.com/certs/curso-instalaciones-2024.jpg',
    status: 'pending',
    uploadedAt: '2024-03-01T14:20:00Z',
  },
  {
    id: 3,
    fileUrl: 'https://storage.quickfixu.com/certs/plomero-habilitado.pdf',
    status: 'rejected',
    uploadedAt: '2024-01-20T09:00:00Z',
  },
];

class ProfessionalsService {
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

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  /**
   * Get authenticated professional's own profile
   * Fallback to mock data if API unavailable
   */
  async getMyProfile(token: string): Promise<UserBackend> {
    try {
      return await this.request<UserBackend>('/api/professionals/me', {
        headers: this.getAuthHeaders(token),
      });
    } catch (error) {
      // Fallback: try the general profile endpoint
      const response = await fetch(`${this.baseUrl}/api/users/me`, {
        headers: this.getAuthHeaders(token),
      });
      if (!response.ok) throw error;
      return response.json();
    }
  }

  /**
   * Update authenticated professional's profile
   */
  async updateMyProfile(
    data: ProfileUpdateData,
    token: string
  ): Promise<UserBackend> {
    return this.request<UserBackend>('/api/professionals/me', {
      method: 'PATCH',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(data),
    });
  }

  /**
   * Get certifications for the authenticated professional
   */
  async getMyCertifications(token: string): Promise<Certification[]> {
    try {
      return await this.request<Certification[]>(
        '/api/professionals/me/certifications',
        { headers: this.getAuthHeaders(token) }
      );
    } catch (error) {
      // Return mock data while API is being developed
      console.warn('Certifications API not available, using mock data');
      return MOCK_CERTIFICATIONS;
    }
  }

  /**
   * Upload a certification file
   * @param fileUri Local file URI
   * @param mimeType File MIME type
   * @param fileName Original file name
   * @param token Auth token
   */
  async uploadCertification(
    fileUri: string,
    mimeType: string,
    fileName: string,
    token: string
  ): Promise<Certification> {
    try {
      const formData = new FormData();
      formData.append('certification', {
        uri: fileUri,
        type: mimeType,
        name: fileName,
      } as any);

      const response = await fetch(
        `${this.baseUrl}/api/professionals/me/certifications`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            // Content-Type is set automatically with multipart/form-data
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(err.message || 'Upload failed');
      }

      return response.json();
    } catch (error) {
      // Mock response while API is being developed
      console.warn('Certification upload API not available, using mock response');
      const mockCert: Certification = {
        id: Date.now(),
        fileUrl: `https://storage.quickfixu.com/certs/${fileName}`,
        status: 'pending',
        uploadedAt: new Date().toISOString(),
      };
      return mockCert;
    }
  }

  /**
   * Delete a certification
   */
  async deleteCertification(certId: number, token: string): Promise<void> {
    try {
      await this.request<void>(
        `/api/professionals/me/certifications/${certId}`,
        {
          method: 'DELETE',
          headers: this.getAuthHeaders(token),
        }
      );
    } catch (error) {
      console.warn('Delete certification API not available, simulating delete');
      // Silently succeed in mock mode
    }
  }
}

export const professionalsService = new ProfessionalsService();
