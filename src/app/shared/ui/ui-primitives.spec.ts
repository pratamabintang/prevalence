import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import {
  UiAlertComponent,
  UiBadgeComponent,
  UiButtonComponent,
  UiCardComponent,
  UiPageHeaderComponent,
} from './index';

@Component({
  standalone: true,
  imports: [
    UiButtonComponent,
    UiBadgeComponent,
    UiCardComponent,
    UiAlertComponent,
    UiPageHeaderComponent,
  ],
  template: `
    <ui-page-header
      title="Uji Judul"
      subtitle="Subjudul Pengujian"
      backRoute="/"
      backLabel="Beranda"
      badge="Resmi"
    >
      <div actions>
        <button uiButton variant="primary">Aksi Utama</button>
      </div>
    </ui-page-header>

    <ui-card title="Kartu Uji">
      <p>Konten kartu</p>
    </ui-card>

    <ui-alert type="success" title="Sukses" [dismissible]="true">
      Operasi berhasil diselesaikan.
    </ui-alert>

    <ui-badge variant="emerald" [dot]="true">Aktif</ui-badge>
  `,
})
class TestHostComponent {}

describe('Design System UI Primitives', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('should render page header with title, subtitle, badge and back route', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Uji Judul');
    expect(el.textContent).toContain('Subjudul Pengujian');
    expect(el.textContent).toContain('Resmi');
    expect(el.textContent).toContain('Aksi Utama');

    const backLink = el.querySelector('a[title="Kembali ke Beranda"]');
    expect(backLink).toBeTruthy();
  });

  it('should render card with title and content', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Kartu Uji');
    expect(el.textContent).toContain('Konten kartu');
  });

  it('should render alert with title and content', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Sukses');
    expect(el.textContent).toContain('Operasi berhasil diselesaikan.');
  });

  it('should render badge with dot and text', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Aktif');
    const badgeEl = el.querySelector('ui-badge');
    expect(badgeEl?.classList.contains('bg-emerald-50')).toBe(true);
  });
});
