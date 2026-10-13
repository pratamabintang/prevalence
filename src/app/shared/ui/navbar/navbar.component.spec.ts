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
    fixture.detectChanges();
  });

  it('should create the navbar', () => {
    expect(component).toBeTruthy();
  });

  it('should render all 5 module links in the centered nav', () => {
    const el = fixture.nativeElement as HTMLElement;
    const desktopNav = el.querySelector('nav[aria-label="Navigasi Modul"]');
    expect(desktopNav).toBeTruthy();

    const links = desktopNav?.querySelectorAll('a');
    expect(links?.length).toBe(5);

    expect(desktopNav?.textContent).toContain('Excel Join');
    expect(desktopNav?.textContent).toContain('Visualisasi Grafik');
    expect(desktopNav?.textContent).toContain('Pemantauan Stunting');
    expect(desktopNav?.textContent).toContain('Dashboard Stunting');
    expect(desktopNav?.textContent).toContain('Kohort Stunting');
  });

  it('should have exact route match for Excel Join at root', () => {
    const firstItem = component.navItems[0];
    expect(firstItem.route).toBe('/');
    expect(firstItem.exact).toBe(true);
  });

  it('should render the brand logo image', () => {
    const el = fixture.nativeElement as HTMLElement;
    const logoImg = el.querySelector('img[src="logo.png"]') as HTMLImageElement;
    expect(logoImg).toBeTruthy();
    expect(logoImg.getAttribute('alt')).toBe('Logo Dinkes');
  });
});
