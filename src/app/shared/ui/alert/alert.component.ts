import {
  Component,
  OnInit,
  OnDestroy,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

export type AlertType = 'info' | 'success' | 'warning' | 'error';

@Component({
  selector: 'ui-alert',
  standalone: true,
  template: `
    @if (visible()) {
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-2.5">
          <div class="shrink-0 mt-0.5">
            @switch (type()) {
              @case ('success') {
                <svg class="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              }
              @case ('warning') {
                <svg class="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              }
              @case ('error') {
                <svg class="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              }
              @default {
                <svg class="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            }
          </div>
          <div class="text-xs space-y-1">
            @if (title()) {
              <div class="font-semibold" [class]="titleClass()">{{ title() }}</div>
            }
            <div class="leading-relaxed" [class]="contentClass()">
              <ng-content />
            </div>
          </div>
        </div>

        @if (dismissible()) {
          <button
            type="button"
            (click)="dismiss()"
            class="shrink-0 text-slate-600 hover:text-slate-900 rounded p-1 hover:bg-black/5 transition-colors cursor-pointer"
            title="Tutup pesan"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        }
      </div>

      @if (shouldShowProgress()) {
        <!-- GARIS BERJALAN ANIMASI PENGHITUNG WAKTU MUNDUR HINGGA NOTIF MENGHILANG -->
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-black/10 overflow-hidden">
          <div
            class="h-full alert-countdown-bar"
            [class]="progressBarColorClass()"
            [style.animation-duration]="duration() + 'ms'"
            [style.animation-play-state]="isPaused() ? 'paused' : 'running'"
          ></div>
        </div>
      }
    }
  `,
  host: {
    '[class]': 'hostClasses()',
    '(mouseenter)': 'pause()',
    '(mouseleave)': 'resume()',
  },
})
export class UiAlertComponent implements OnInit, OnDestroy {
  type = input<AlertType>('info');
  title = input<string | null>(null);
  dismissible = input<boolean>(false);
  autoDismiss = input<boolean | null>(null);
  duration = input<number>(10000);
  showProgress = input<boolean | null>(null);
  dismissed = output<void>();

  visible = signal<boolean>(true);
  isFadingOut = signal<boolean>(false);
  isPaused = signal<boolean>(false);

  private timer: any = null;
  private fadeTimer: any = null;
  private startTime = 0;
  private remainingTime = 0;

  readonly shouldAutoDismiss = computed(() => {
    const custom = this.autoDismiss();
    if (custom !== null) {
      return custom;
    }
    // Default: otomatis hilang untuk notif berhasil (success), gagal (error), atau notif yang dismissible
    return this.type() === 'success' || this.type() === 'error' || this.dismissible();
  });

  readonly shouldShowProgress = computed(() => {
    const custom = this.showProgress();
    if (custom !== null) {
      return custom;
    }
    return this.shouldAutoDismiss();
  });

  hostClasses = computed(() => {
    const base = 'relative block rounded-lg border p-3.5 shadow-2xs transition-all duration-300 overflow-hidden';
    const fade = this.isFadingOut()
      ? 'opacity-0 -translate-y-1 scale-[0.99] pointer-events-none'
      : 'opacity-100 translate-y-0 scale-100';
    const hidden = !this.visible() ? 'hidden' : '';

    let colorClasses = '';
    switch (this.type()) {
      case 'success':
        colorClasses = 'bg-emerald-50/90 border-emerald-200 text-emerald-900';
        break;
      case 'warning':
        colorClasses = 'bg-amber-50/90 border-amber-200 text-amber-900';
        break;
      case 'error':
        colorClasses = 'bg-rose-50/90 border-rose-200 text-rose-900';
        break;
      default:
        colorClasses = 'bg-blue-50/90 border-blue-200 text-blue-900';
        break;
    }

    return `${base} ${colorClasses} ${fade} ${hidden}`.trim();
  });

  progressBarColorClass = computed(() => {
    switch (this.type()) {
      case 'success':
        return 'bg-emerald-500';
      case 'warning':
        return 'bg-amber-500';
      case 'error':
        return 'bg-rose-500';
      default:
        return 'bg-blue-500';
    }
  });

  titleClass = computed(() => {
    switch (this.type()) {
      case 'success':
        return 'text-emerald-900';
      case 'warning':
        return 'text-amber-900';
      case 'error':
        return 'text-rose-900';
      default:
        return 'text-blue-900';
    }
  });

  contentClass = computed(() => {
    switch (this.type()) {
      case 'success':
        return 'text-emerald-800';
      case 'warning':
        return 'text-amber-800';
      case 'error':
        return 'text-rose-800';
      default:
        return 'text-blue-800';
    }
  });

  ngOnInit(): void {
    if (this.shouldAutoDismiss()) {
      this.remainingTime = this.duration();
      this.startTime = Date.now();
      this.timer = setTimeout(() => {
        this.dismiss();
      }, this.remainingTime);
    }
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  pause(): void {
    if (!this.shouldAutoDismiss() || this.isFadingOut() || !this.visible()) {
      return;
    }
    this.isPaused.set(true);
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const elapsed = Date.now() - this.startTime;
    this.remainingTime = Math.max(0, this.remainingTime - elapsed);
  }

  resume(): void {
    if (!this.shouldAutoDismiss() || this.isFadingOut() || !this.visible()) {
      return;
    }
    if (this.remainingTime <= 0) {
      this.dismiss();
      return;
    }
    this.isPaused.set(false);
    this.startTime = Date.now();
    this.timer = setTimeout(() => {
      this.dismiss();
    }, this.remainingTime);
  }

  dismiss(): void {
    if (this.isFadingOut() || !this.visible()) {
      return;
    }
    this.clearTimers();
    this.isFadingOut.set(true);
    this.fadeTimer = setTimeout(() => {
      this.visible.set(false);
      this.dismissed.emit();
    }, 250);
  }

  private clearTimers(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
  }
}
