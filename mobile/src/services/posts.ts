/**
 * Posts Service — QuickFixU V1 Marketplace Alignment
 * =============================================================================
 * API vocabulary: backend still uses `/posts`; mobile calls it `PostService` but
 * works with canonical `Request` types internally.
 *
 * During V1 migration the service boundary will rename to `/requests` and the
 * service class will become `RequestService`. Until then, `Post` / `createPost`
 * remain as legacy aliases at the API transport layer only.
 *
 * Vocabulary rules (V1 backend contracts §3):
 *   - `budget` field is a commercial reference only — V1 does NOT process payment
 *   - `proposal` is the professional's response (not modeled in this service yet)
 *   - `appointment` is the selected work record (not modeled in this service yet)
 *
 * See: docs/backend/V1BackendContracts.md §3 + §5.1
 *      docs/backend/V1MarketplaceLifecycle.md §2 + §4.1
 * =============================================================================
 */

import { API_BASE_URL } from '../constants/config';
import type { RequestStatus, UrgencyLevel } from '../types';

/** Canonical V1 creation payload — budget is a reference, not a transaction */
export interface CreateRequestData {
  title: string;
  description: string;
  categoryId: string;
  location: string;
  preferredDate?: string;
  budget?: number;           // Reference only — external payment, not stored by platform
  images?: string[];
  urgency: UrgencyLevel;
}

/** @deprecated Use `CreateRequestData` — kept for API transport compatibility */
export type CreatePostData = CreateRequestData;

/** Canonical V1 request entity */
export interface Request {
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
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
}

/** @deprecated Use `Request` — kept for API transport compatibility */
export type Post = Request;

export type RequestRecord = Request;

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
