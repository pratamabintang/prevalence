import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UiAlertComponent } from './alert.component';

describe('UiAlertComponent Auto-Dismiss & Running Line Animation', () => {
  let fixture: ComponentFixture<UiAlertComponent>;
  let component: UiAlertComponent;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [UiAlertComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UiAlertComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should enable autoDismiss and render countdown progress line for success alert', () => {
    fixture.componentRef.setInput('type', 'success');
    fixture.componentRef.setInput('dismissible', true);
    fixture.detectChanges();

    expect(component.shouldAutoDismiss()).toBe(true);
    expect(component.shouldShowProgress()).toBe(true);

    const el = fixture.nativeElement as HTMLElement;
    const progressBar = el.querySelector('.bg-emerald-500');
    expect(progressBar).toBeTruthy();
  });

  it('should enable autoDismiss and render countdown progress line for error alert', () => {
    fixture.componentRef.setInput('type', 'error');
    fixture.detectChanges();

    expect(component.shouldAutoDismiss()).toBe(true);
    expect(component.shouldShowProgress()).toBe(true);

    const el = fixture.nativeElement as HTMLElement;
    const progressBar = el.querySelector('.bg-rose-500');
    expect(progressBar).toBeTruthy();
  });

  it('should have default duration of 10000ms (10 seconds)', () => {
    expect(component.duration()).toBe(10000);
  });

  it('should auto-dismiss and emit dismissed event when timer expires', () => {
    let dismissedFired = false;
    component.dismissed.subscribe(() => {
      dismissedFired = true;
    });

    fixture.componentRef.setInput('type', 'success');
    fixture.componentRef.setInput('duration', 3000);
    fixture.detectChanges();

    expect(component.visible()).toBe(true);

    // Fast forward to duration (3000ms)
    vi.advanceTimersByTime(3000);
    expect(component.isFadingOut()).toBe(true);

    // Fast forward fade-out transition (250ms)
    vi.advanceTimersByTime(250);
    expect(dismissedFired).toBe(true);
    expect(component.visible()).toBe(false);
  });

  it('should pause timer and animation on pause() and resume on resume()', () => {
    fixture.componentRef.setInput('type', 'success');
    fixture.componentRef.setInput('duration', 5000);
    fixture.detectChanges();

    // Advance 2000ms
    vi.advanceTimersByTime(2000);
    expect(component.isPaused()).toBe(false);

    // Trigger pause (simulate mouseenter)
    component.pause();
    expect(component.isPaused()).toBe(true);

    // Advance while paused - should not dismiss
    vi.advanceTimersByTime(4000);
    expect(component.isFadingOut()).toBe(false);

    // Trigger resume (simulate mouseleave)
    component.resume();
    expect(component.isPaused()).toBe(false);

    // Advance remaining time (~3000ms) + fadeout (250ms)
    vi.advanceTimersByTime(3000 + 250);
    expect(component.visible()).toBe(false);
  });

  it('should not auto-dismiss if autoDismiss is set to false', () => {
    let dismissedFired = false;
    component.dismissed.subscribe(() => {
      dismissedFired = true;
    });

    fixture.componentRef.setInput('type', 'success');
    fixture.componentRef.setInput('autoDismiss', false);
    fixture.detectChanges();

    expect(component.shouldAutoDismiss()).toBe(false);
    expect(component.shouldShowProgress()).toBe(false);

    vi.advanceTimersByTime(10000);
    expect(dismissedFired).toBe(false);
    expect(component.visible()).toBe(true);
  });
});
