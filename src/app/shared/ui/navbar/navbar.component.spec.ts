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
    component.enableStuntingCohort.set(false);
    fixture.detectChanges();
  });

  it('should create the navbar and be closed by default', () => {
    expect(component).toBeTruthy();
    expect(component.isOpen()).toBe(false);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="left-navbar"]')).toBeNull();
    expect(el.querySelector('[data-testid="show-navbar-btn"]')).toBeTruthy();
  });

  it('should render 2 module items without "Modul Aplikasi" heading or numbering badges, with Visualisasi, Kohort Stunting and Capaian Intervensi hidden', () => {
    component.showNavbar();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const desktopNav = el.querySelector('nav[aria-label="Navigasi Modul"]');
    expect(desktopNav).toBeTruthy();

    const links = desktopNav?.querySelectorAll('a');
    expect(links?.length).toBe(2);

    const disabledBtn = desktopNav?.querySelector('[data-testid="nav-disabled-kohort"]');
    expect(disabledBtn).toBeNull();

    expect(desktopNav?.textContent).toContain('Beranda');
    expect(desktopNav?.textContent).toContain('Kelola Data');
    expect(desktopNav?.textContent).not.toContain('Visualisasi');
    expect(desktopNav?.textContent).not.toContain('Capaian Intervensi');
    expect(desktopNav?.textContent).not.toContain('Kohort Stunting');
    expect(desktopNav?.textContent).not.toContain('Dashboard Stunting');

    // Verify "Modul Aplikasi" heading is removed
    expect(desktopNav?.textContent).not.toContain('Modul Aplikasi');

    // Verify numbering badges (1., 2., etc.) are removed from link text
    const firstLink = links?.[0];
    expect(firstLink?.textContent?.trim()).toBe('Beranda');
    const secondLink = links?.[1];
    expect(secondLink?.textContent?.trim()).toBe('Kelola Data');
  });

  it('should render 3 active links when enableStuntingDashboard is true and Kohort is hidden', () => {
    component.showNavbar();
    component.enableStuntingDashboard.set(true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const desktopNav = el.querySelector('nav[aria-label="Navigasi Modul"]');
    expect(desktopNav).toBeTruthy();

    const links = desktopNav?.querySelectorAll('a');
    expect(links?.length).toBe(3);

    expect(desktopNav?.textContent).toContain('Dashboard Stunting');
    expect(desktopNav?.textContent).not.toContain('Kohort Stunting');
    expect(desktopNav?.textContent).not.toContain('Capaian Intervensi');
    expect(component.navItems()[2]).toEqual({
      id: 3,
      label: 'Dashboard Stunting',
      shortLabel: 'Dashboard',
      route: '/stunting-dashboard',
      exact: false,
      disabled: false,
    });
  });

  it('should enable Kohort Stunting as an active route link when enableStuntingCohort is true', () => {
    component.showNavbar();
    component.enableStuntingCohort.set(true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const desktopNav = el.querySelector('nav[aria-label="Navigasi Modul"]');
    expect(desktopNav).toBeTruthy();

    const disabledBtn = desktopNav?.querySelector('[data-testid="nav-disabled-kohort"]');
    expect(disabledBtn).toBeNull();

    const kohortLink = desktopNav?.querySelector('a[href="/stunting-cohort"]');
    expect(kohortLink).toBeTruthy();
    expect(kohortLink?.textContent).toContain('Kohort Stunting');
  });

  it('should have exact route match for Beranda at root', () => {
    const firstItem = component.navItems()[0];
    expect(firstItem.route).toBe('/');
    expect(firstItem.exact).toBe(true);
    expect(firstItem.label).toBe('Beranda');
  });

  it('should route Kelola Data to /data', () => {
    const secondItem = component.navItems()[1];
    expect(secondItem.route).toBe('/data');
    expect(secondItem.label).toBe('Kelola Data');
  });

  it('should hide Visualisasi from the navbar', () => {
    const visualisasiItem = component.navItems().find(
      (item) => item.route === '/visualisasi',
    );
    expect(visualisasiItem).toBeUndefined();
  });

  it('should hide Capaian Intervensi from the navbar', () => {
    const capaianItem = component.navItems().find(
      (item) => item.route === '/capaian-intervensi',
    );
    expect(capaianItem).toBeUndefined();
  });

  it('should order Kohort Stunting after Kelola Data when enabled and Dashboard Stunting is disabled', () => {
    component.enableStuntingCohort.set(true);
    expect(component.navItems()[2]).toEqual({
      id: 3,
      label: 'Kohort Stunting',
      shortLabel: 'Kohort',
      route: '/stunting-cohort',
      exact: false,
      disabled: false,
    });
  });

  it('should truly hide Kohort Stunting from navbar when disabled in environment', () => {
    component.showNavbar();
    component.enableStuntingCohort.set(false);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const kohortBtn = el.querySelector('[data-testid="nav-disabled-kohort"]');
    expect(kohortBtn).toBeNull();
    const kohortLink = el.querySelector('a[href="/stunting-cohort"]');
    expect(kohortLink).toBeNull();
    expect(el.textContent).not.toContain('Kohort Stunting');
  });

  it('should render the brand logo image', () => {
    component.showNavbar();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const logoImg = el.querySelector('img[src="logo.png"]') as HTMLImageElement;
    expect(logoImg).toBeTruthy();
    expect(logoImg.getAttribute('alt')).toBe('Logo Dinkes');
  });

  it('should display server status badge without exposing database details', () => {
    component.showNavbar();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const badge = el.querySelector('[data-testid="server-status-badge"]') as HTMLButtonElement;
    expect(badge).toBeTruthy();
    expect(el.textContent).not.toContain('Server SQLite');
    expect(el.textContent).not.toContain('SQLite');
    expect(el.textContent).not.toContain('Google Drive');
    expect(badge.textContent?.trim()).toBe(''); // Dot only, no text

    // Check title/aria-label updates
    expect(badge.getAttribute('title')).toContain('offline');
    expect(badge.getAttribute('title')).not.toContain('SQLite');
    expect(badge.getAttribute('title')).not.toContain('Google Drive');

    component.backendStorage.isConnected.set(true);
    fixture.detectChanges();

    expect(badge.getAttribute('title')).toContain('Terhubung ke server');
    expect(badge.getAttribute('title')).not.toContain('SQLite');
    expect(badge.getAttribute('title')).not.toContain('Google Drive');
    expect(el.textContent).not.toContain('Server SQLite');
  });

  it('should hide the navbar when hide button is clicked and display the bottom-left show button without the word Menu', () => {
    component.showNavbar();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const hideBtn = el.querySelector('[data-testid="hide-navbar-btn"]') as HTMLButtonElement;
    expect(hideBtn).toBeTruthy();

    hideBtn.click();
    fixture.detectChanges();

    expect(component.isOpen()).toBe(false);
    expect(el.querySelector('[data-testid="left-navbar"]')).toBeNull();

    const showBtn = el.querySelector('[data-testid="show-navbar-btn"]') as HTMLButtonElement;
    expect(showBtn).toBeTruthy();
    expect(showBtn.classList.contains('bottom-4')).toBe(true);
    expect(showBtn.classList.contains('left-4')).toBe(true);
    expect(showBtn.textContent?.trim()).toBe(''); // No word "Menu", only the SVG icon
    expect(showBtn.querySelector('svg')).toBeTruthy();
  });

  it('should open the navbar when show button is clicked', () => {
    const el = fixture.nativeElement as HTMLElement;
    const showBtn = el.querySelector('[data-testid="show-navbar-btn"]') as HTMLButtonElement;
    expect(showBtn).toBeTruthy();

    showBtn.click();
    fixture.detectChanges();

    expect(component.isOpen()).toBe(true);
    expect(el.querySelector('[data-testid="left-navbar"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="show-navbar-btn"]')).toBeNull();
  });
});
