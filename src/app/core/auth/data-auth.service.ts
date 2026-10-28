import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

export const DATA_AUTH_STORAGE_KEY = 'dinkes_data_auth';

@Injectable({
  providedIn: 'root',
})
export class DataAuthService {
  readonly isAuthenticated = signal<boolean>(this.checkInitialSession());

  private checkInitialSession(): boolean {
    try {
      return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(DATA_AUTH_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  login(id: string, password: string): boolean {
    const configuredId = environment.dataAdminId ?? 'bidangkesmas';
    const configuredPw = environment.dataAdminPassword ?? '@Dinkes123#';

    if (id === configuredId && password === configuredPw) {
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(DATA_AUTH_STORAGE_KEY, '1');
        }
      } catch {
        // Abaikan kegagalan storage
      }
      this.isAuthenticated.set(true);
      return true;
    }

    return false;
  }

  logout(): void {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(DATA_AUTH_STORAGE_KEY);
      }
    } catch {
      // Abaikan
    }
    this.isAuthenticated.set(false);
  }

  getAuthHeaders(): Record<string, string> {
    const configuredId = environment.dataAdminId ?? 'bidangkesmas';
    const configuredPw = environment.dataAdminPassword ?? '@Dinkes123#';
    const basicToken = btoa(`${configuredId}:${configuredPw}`);

    return {
      'X-Admin-Id': configuredId,
      'X-Admin-Password': configuredPw,
      Authorization: `Basic ${basicToken}`,
    };
  }
}
