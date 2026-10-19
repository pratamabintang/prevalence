import { Component, computed, input } from '@angular/core';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

@Component({
  selector: 'ui-card',
  standalone: true,
  template: `
    @if (title()) {
      <div class="border-b border-[#6D8BC0]/15 bg-gradient-to-r from-white via-[#F8FAFD] to-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-slate-900">{{ title() }}</h3>
          @if (subtitle()) {
            <p class="text-xs text-slate-500 mt-0.5">{{ subtitle() }}</p>
          }
        </div>
        <div class="flex items-center gap-2">
          <ng-content select="[card-actions]" />
        </div>
      </div>
    }
    <div [class]="bodyClasses()">
      <ng-content />
    </div>
  `,
  host: {
    '[class]': 'hostClasses()',
  },
})
export class UiCardComponent {
  title = input<string | null>(null);
  subtitle = input<string | null>(null);
  padding = input<CardPadding>('md');
  bordered = input<boolean>(true);

  hostClasses = computed(() => {
    const border = this.bordered() ? 'border border-[#6D8BC0]/20 hover:border-[#6D8BC0]/35 transition-colors' : '';
    return `block bg-white rounded-xl ${border} shadow-2xs overflow-hidden`;
  });

  bodyClasses = computed(() => {
    switch (this.padding()) {
      case 'none':
        return '';
      case 'sm':
        return 'p-3.5 sm:p-4';
      case 'lg':
        return 'p-6 sm:p-8';
      case 'md':
      default:
        return 'p-5 sm:p-6';
    }
  });
}
