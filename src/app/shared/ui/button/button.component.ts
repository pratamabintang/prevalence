import { Component, computed, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'success' | 'danger' | 'ghost';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

@Component({
  selector: 'button[uiButton], a[uiButton], ui-button',
  standalone: true,
  template: `
    @if (loading()) {
      <svg class="animate-spin -ml-0.5 mr-1.5 h-3.5 w-3.5 text-current" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    }
    <ng-content />
  `,
  host: {
    '[class]': 'hostClasses()',
    '[attr.disabled]': 'disabled() || loading() ? true : null',
    '[attr.aria-disabled]': 'disabled() || loading() ? true : null',
  },
})
export class UiButtonComponent {
  variant = input<ButtonVariant>('secondary');
  size = input<ButtonSize>('sm');
  disabled = input<boolean>(false);
  loading = input<boolean>(false);

  hostClasses = computed(() => {
    const base =
      'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none';

    // Size variants
    let sizeClass = '';
    switch (this.size()) {
      case 'xs':
        sizeClass = 'px-2 py-1 text-xs gap-1';
        break;
      case 'sm':
        sizeClass = 'px-3 py-1.5 text-xs gap-1.5';
        break;
      case 'md':
        sizeClass = 'px-4 py-2 text-sm gap-2';
        break;
      case 'lg':
        sizeClass = 'px-5 py-2.5 text-base gap-2';
        break;
    }

    // Color variants
    let variantClass = '';
    switch (this.variant()) {
      case 'primary':
        variantClass = 'bg-slate-900 text-white hover:bg-slate-800 border border-slate-900 shadow-xs';
        break;
      case 'secondary':
        variantClass = 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 shadow-xs';
        break;
      case 'outline':
        variantClass = 'bg-transparent text-slate-700 hover:bg-slate-100 border border-slate-200';
        break;
      case 'success':
        variantClass = 'bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600 shadow-xs';
        break;
      case 'danger':
        variantClass = 'bg-rose-600 text-white hover:bg-rose-700 border border-rose-600 shadow-xs';
        break;
      case 'ghost':
        variantClass = 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent';
        break;
    }

    return `${base} ${sizeClass} ${variantClass}`;
  });
}
