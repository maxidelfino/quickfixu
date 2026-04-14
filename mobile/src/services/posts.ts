import { API_BASE_URL } from '../constants/config';

export interface CreatePostData {
  title: string;
  description: string;
  categoryId: string;
  location: string;
  preferredDate?: string;
  budget?: number;
  images?: string[];
  urgency: 'normal' | 'urgent';
}

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
  urgency: 'normal' | 'urgent';
  status: 'pending' | 'assigned' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

class PostService {
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
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

  async createPost(data: CreatePostData, token: string): Promise<Post> {
    return this.request<Post>('/api/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
  }

  async getPosts(token: string): Promise<Post[]> {
    return this.request<Post[]>('/api/posts', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async getPostById(id: string, token: string): Promise<Post> {
    return this.request<Post>(`/api/posts/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async getPostsByUser(userId: string, token: string): Promise<Post[]> {
    return this.request<Post[]>(`/api/posts/user/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async updatePostStatus(
    id: string,
    status: Post['status'],
    token: string
  ): Promise<Post> {
    return this.request<Post>(`/api/posts/${id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
  }

  async deletePost(id: string, token: string): Promise<void> {
    await this.request<void>(`/api/posts/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }
}

export const postService = new PostService();
