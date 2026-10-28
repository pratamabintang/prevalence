import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { DataAuthService, DATA_AUTH_TOKEN_KEY } from './data-auth.service';

describe('DataAuthService (Token-based Backend Auth)', () => {
  let service: DataAuthService;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    sessionStorage.clear();
    originalFetch = globalThis.fetch;
    TestBed.configureTestingModule({
      providers: [DataAuthService],
    });
    service = TestBed.inject(DataAuthService);
  });

  afterEach(() => {
    sessionStorage.clear();
    globalThis.fetch = originalFetch;
  });

  it('should initialize as unauthenticated when sessionStorage is empty', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.token()).toBeNull();
  });

  it('should initialize as authenticated if sessionStorage already has a token', () => {
    sessionStorage.setItem(DATA_AUTH_TOKEN_KEY, 'mock-jwt-token-123');
    const freshService = TestBed.runInInjectionContext(() => new DataAuthService());
    expect(freshService.isAuthenticated()).toBe(true);
    expect(freshService.token()).toBe('mock-jwt-token-123');
  });

  it('should fail login and stay unauthenticated when server rejects credentials', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ success: false, error: 'ID atau Kata Sandi salah' }),
    } as unknown as Response);

    const success = await service.login('wrong', 'wrong');
    expect(success).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(DATA_AUTH_TOKEN_KEY)).toBeNull();
  });

  it('should succeed login, save token, and mark authenticated on valid credentials', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, token: 'server-issued-session-token-xyz' }),
    } as unknown as Response);

    const success = await service.login('bidangkesmas', '@Dinkes123#');
    expect(success).toBe(true);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.token()).toBe('server-issued-session-token-xyz');
    expect(sessionStorage.getItem(DATA_AUTH_TOKEN_KEY)).toBe('server-issued-session-token-xyz');
  });

  it('should clear token and sessionStorage on logout', () => {
    service.setSession('token-abc');
    expect(service.isAuthenticated()).toBe(true);

    service.logout();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.token()).toBeNull();
    expect(sessionStorage.getItem(DATA_AUTH_TOKEN_KEY)).toBeNull();
  });

  it('should return empty headers when unauthenticated and Bearer token when authenticated', () => {
    expect(service.getAuthHeaders()).toEqual({});

    service.setSession('bearer-token-999');
    const headers = service.getAuthHeaders();
    expect(headers['Authorization']).toBe('Bearer bearer-token-999');
    expect(headers['X-Admin-Token']).toBe('bearer-token-999');
  });
});
