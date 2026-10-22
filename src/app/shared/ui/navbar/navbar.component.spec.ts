import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppNavbarComponent } from './navbar.component';

describe('AppNavbarComponent', () => {
  let fixture: ComponentFixture<AppNavbarComponent>;
  let component: AppNavbarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppNavbarComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AppNavbarComponent);
    component = fixture.componentInstance;
    component.enableStuntingDashboard.set(false);
    fixture.detectChanges();
  });

  it('should create the navbar', () => {
    expect(component).toBeTruthy();
  });

  it('should render 4 module links when enableStuntingDashboard is false', () => {
    const el = fixture.nativeElement as HTMLElement;
    const desktopNav = el.querySelector('nav[aria-label="Navigasi Modul"]');
    expect(desktopNav).toBeTruthy();

    const links = desktopNav?.querySelectorAll('a');
    expect(links?.length).toBe(4);

    expect(desktopNav?.textContent).toContain('Excel Join');
    expect(desktopNav?.textContent).toContain('Visualisasi Grafik');
    expect(desktopNav?.textContent).toContain('Pemantauan Stunting');
    expect(desktopNav?.textContent).toContain('Kohort Stunting');
    expect(desktopNav?.textContent).not.toContain('Dashboard Stunting');
  });

  it('should render all 5 module links when enableStuntingDashboard is true', () => {
    component.enableStuntingDashboard.set(true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const desktopNav = el.querySelector('nav[aria-label="Navigasi Modul"]');
    expect(desktopNav).toBeTruthy();

    const links = desktopNav?.querySelectorAll('a');
    expect(links?.length).toBe(5);

    expect(desktopNav?.textContent).toContain('Dashboard Stunting');
    expect(component.navItems()[4]).toEqual({
      id: 5,
      label: 'Dashboard Stunting',
      shortLabel: 'Dashboard',
      route: '/stunting-dashboard',
      exact: false,
    });
  });

  it('should have exact route match for Excel Join at root', () => {
    const firstItem = component.navItems()[0];
    expect(firstItem.route).toBe('/');
    expect(firstItem.exact).toBe(true);
  });

  it('should order Kohort Stunting consecutively at #4 when Dashboard Stunting is disabled', () => {
    expect(component.navItems()[3]).toEqual({
      id: 4,
      label: 'Kohort Stunting',
      shortLabel: 'Kohort',
      route: '/stunting-cohort',
      exact: false,
    });
  });

  it('should render the brand logo image', () => {
    const el = fixture.nativeElement as HTMLElement;
    const logoImg = el.querySelector('img[src="logo.png"]') as HTMLImageElement;
    expect(logoImg).toBeTruthy();
    expect(logoImg.getAttribute('alt')).toBe('Logo Dinkes');
  });

  it('should display Server SQLite status badge and update when backendStorage.isConnected changes', () => {
    const el = fixture.nativeElement as HTMLElement;
    const badge = el.querySelector('[data-testid="server-status-badge"]') as HTMLButtonElement;
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('Mode Cloud / Lokal');

    component.backendStorage.isConnected.set(true);
    fixture.detectChanges();

    expect(badge.textContent).toContain('Server SQLite');
  });
});
