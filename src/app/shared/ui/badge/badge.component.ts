import { Component, computed, input } from '@angular/core';

export type BadgeVariant = 'slate' | 'emerald' | 'amber' | 'rose' | 'blue' | 'purple' | 'outline';
export type BadgeSize = 'sm' | 'md';

@Component({
  selector: 'ui-badge, span[uiBadge]',
  standalone: true,
  template: `
    @if (dot()) {
      <span class="w-1.5 h-1.5 rounded-full mr-1.5 shrink-0" [class]="dotClass()"></span>
    }
    <ng-content />
  `,
  host: {
    '[class]': 'hostClasses()',
  },
})
export class UiBadgeComponent {
  variant = input<BadgeVariant>('slate');
  size = input<BadgeSize>('sm');
  dot = input<boolean>(false);

  dotClass = computed(() => {
    switch (this.variant()) {
      case 'emerald':
        return 'bg-[#0F766E]';
      case 'amber':
        return 'bg-amber-600';
      case 'rose':
        return 'bg-rose-600';
      case 'blue':
        return 'bg-[#1E3A8A]';
      case 'purple':
        return 'bg-[#525AFF]';
      default:
        return 'bg-slate-600';
    }
  });

  hostClasses = computed(() => {
    const base = 'inline-flex items-center font-semibold rounded-md select-none tabular-nums';

    const sizeClass = this.size() === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

    let variantClass = '';
    switch (this.variant()) {
      case 'emerald':
        variantClass = 'bg-emerald-50 text-emerald-800 border border-emerald-200';
        break;
      case 'amber':
        variantClass = 'bg-amber-50 text-amber-800 border border-amber-200';
        break;
      case 'rose':
        variantClass = 'bg-rose-50 text-rose-800 border border-rose-200';
        break;
      case 'blue':
        variantClass = 'bg-[#F0FAFE] text-[#1E3A8A] border border-[#8FD9FB]/60';
        break;
      case 'purple':
        variantClass = 'bg-[#EEF0FF] text-[#3730A3] border border-[#525AFF]/30';
        break;
      case 'outline':
        variantClass = 'bg-transparent text-slate-700 border border-slate-300';
        break;
      default:
        variantClass = 'bg-slate-100 text-slate-700 border border-slate-200';
        break;
    }

    return `${base} ${sizeClass} ${variantClass}`;
  });
}
