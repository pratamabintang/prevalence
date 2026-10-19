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
        return 'bg-[#4AB5B5]';
      case 'amber':
        return 'bg-amber-500';
      case 'rose':
        return 'bg-rose-500';
      case 'blue':
        return 'bg-[#4AB5B5]';
      case 'purple':
        return 'bg-[#525AFF]';
      default:
        return 'bg-[#6D8BC0]';
    }
  });

  hostClasses = computed(() => {
    const base = 'inline-flex items-center font-medium rounded-full select-none';

    const sizeClass = this.size() === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

    let variantClass = '';
    switch (this.variant()) {
      case 'emerald':
        variantClass = 'bg-emerald-50 text-teal-800 border border-[#4AB5B5]/30';
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
        variantClass = 'bg-[#EEF0FF] text-[#525AFF] border border-[#525AFF]/30';
        break;
      case 'outline':
        variantClass = 'bg-transparent text-slate-600 border border-[#6D8BC0]/40';
        break;
      default:
        variantClass = 'bg-[#F2F5FA] text-[#445D87] border border-[#6D8BC0]/30';
        break;
    }

    return `${base} ${sizeClass} ${variantClass}`;
  });
}
