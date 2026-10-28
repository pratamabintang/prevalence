import { Injectable, computed, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

export const DATA_AUTH_TOKEN_KEY = 'dinkes_data_token';

export interface LoginResult {
  success: boolean;
  token?: string;
  user?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class DataAuthService {
  readonly token = signal<string | null>(this.getInitialToken());
  readonly isAuthenticated = computed<boolean>(() => Boolean(this.token()));

  private getInitialToken(): string | null {
    try {
      if (typeof sessionStorage !== 'undefined') {
        return sessionStorage.getItem(DATA_AUTH_TOKEN_KEY);
      }
    } catch {
      // Abaikan kegagalan storage
    }
    return null;
  }

  private getBaseUrl(): string {
    const raw = (environment as unknown as { backendApiUrl?: string }).backendApiUrl;
    if (typeof raw === 'string') {
      return raw.trim().replace(/\/+$/, '');
    }
    return '/api';
  }

  async login(id: string, password: string): Promise<boolean> {
    const baseUrl = this.getBaseUrl();

    try {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ id, password }),
      });

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as LoginResult;
      if (data && data.success && data.token) {
        this.setSession(data.token);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  setSession(token: string): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(DATA_AUTH_TOKEN_KEY, token);
      }
    } catch {
      // Abaikan
    }
    this.token.set(token);
  }

  logout(): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(DATA_AUTH_TOKEN_KEY);
      }
    } catch {
      // Abaikan
    }
    this.token.set(null);
  }

  getAuthHeaders(): Record<string, string> {
    const activeToken = this.token();
    if (!activeToken) {
      return {};
    }

    return {
      Authorization: `Bearer ${activeToken}`,
      'X-Admin-Token': activeToken,
    };
  }
}
