import { TestBed } from '@angular/core/testing';
import { DataAuthService } from './data-auth.service';

describe('DataAuthService', () => {
  let service: DataAuthService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [DataAuthService],
    });
    service = TestBed.inject(DataAuthService);
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should initialize as unauthenticated when sessionStorage is empty', () => {
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should initialize as authenticated if sessionStorage already has valid session flag', () => {
    sessionStorage.setItem('dinkes_data_auth', '1');
    const freshService = TestBed.runInInjectionContext(() => new DataAuthService());
    expect(freshService.isAuthenticated()).toBe(true);
  });

  it('should fail login and stay unauthenticated with incorrect ID or password', () => {
    const successWrongId = service.login('wrong-user', '@Dinkes123#');
    expect(successWrongId).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem('dinkes_data_auth')).toBeNull();

    const successWrongPw = service.login('bidangkesmas', 'wrong-password');
    expect(successWrongPw).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should succeed login and set sessionStorage flag with valid ID and password', () => {
    const success = service.login('bidangkesmas', '@Dinkes123#');
    expect(success).toBe(true);
    expect(service.isAuthenticated()).toBe(true);
    expect(sessionStorage.getItem('dinkes_data_auth')).toBe('1');
  });

  it('should clear authentication state and sessionStorage on logout', () => {
    service.login('bidangkesmas', '@Dinkes123#');
    expect(service.isAuthenticated()).toBe(true);

    service.logout();
    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem('dinkes_data_auth')).toBeNull();
  });

  it('should return empty headers when unauthenticated and admin credentials when authenticated', () => {
    expect(service.getAuthHeaders()).toEqual({});

    service.login('bidangkesmas', '@Dinkes123#');
    const headers = service.getAuthHeaders();
    expect(headers['X-Admin-Id']).toBe('bidangkesmas');
    expect(headers['X-Admin-Password']).toBe('@Dinkes123#');
    expect(headers['Authorization']).toContain('Basic ');
  });
});
