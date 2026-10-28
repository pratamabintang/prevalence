import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'ui-page-header',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="border-b border-slate-200 bg-white" [class.sticky]="sticky()" [class.top-0]="sticky()" [class.z-30]="sticky()">
      <div class="w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <!-- BRANDING & BREADCRUMB / TITLE -->
        <div class="flex items-center gap-3 min-w-0">
          @if (backRoute()) {
            <a
              [routerLink]="backRoute()"
              class="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-700 hover:text-[#4348E6] hover:border-[#525AFF]/40 hover:bg-[#EEF0FF] transition-all border border-slate-300 bg-white shadow-2xs shrink-0"
              [title]="'Kembali ke ' + backLabel()"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </a>
          }
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h1 class="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-tight">
                {{ title() }}
              </h1>
              @if (badge()) {
                <span class="rounded-md bg-[#F0FAFE] px-2.5 py-0.5 text-xs font-semibold text-[#1E3A8A] border border-[#8FD9FB]/60 shrink-0 tabular-nums">
                  {{ badge() }}
                </span>
              }
            </div>
            @if (subtitle()) {
              <p class="text-xs sm:text-sm text-slate-600 mt-0.5 leading-snug">
                {{ subtitle() }}
              </p>
            }
          </div>
        </div>

        <!-- ACTIONS & TOOLBAR SLOT -->
        <div class="flex items-center gap-2 shrink-0 flex-wrap">
          <ng-content select="[actions]" />
        </div>
      </div>
    </div>
  `,
  host: {
    class: 'block w-full',
  },
})
export class UiPageHeaderComponent {
  title = input.required<string>();
  subtitle = input<string | null>(null);
  backRoute = input<string | null>(null);
  backLabel = input<string>('Beranda');
  badge = input<string | null>(null);
  sticky = input<boolean>(false);
}
