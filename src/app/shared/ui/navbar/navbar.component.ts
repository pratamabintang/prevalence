import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface NavItem {
  id: number;
  label: string;
  route: string;
  exact: boolean;
  shortLabel?: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="border-b border-slate-200 bg-white sticky top-0 z-40 shadow-2xs">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="relative flex h-14 sm:h-16 items-center justify-between gap-2">
          <!-- BRANDING & LOGO (LEFT) -->
          <a
            routerLink="/"
            class="flex items-center gap-2.5 text-slate-900 hover:text-emerald-700 transition-colors shrink-0 group select-none"
            title="Dinkes Data Tools - Halaman Awal"
          >
            <img
              src="logo.png"
              alt="Logo Dinkes"
              class="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0 transition-transform group-hover:scale-105"
            />
            <div class="flex flex-col">
              <span class="font-bold text-sm leading-tight text-slate-900 group-hover:text-emerald-700 transition-colors">
                Tools
              </span>
              <span class="text-[11px] text-slate-500 leading-tight hidden xl:block">
                Dinas Kesehatan Prov. Jawa Tengah
              </span>
            </div>
          </a>

          <!-- MODULE NAVIGATION (CENTER) -->
          <nav
            class="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center justify-center gap-1 lg:gap-1.5"
            aria-label="Navigasi Modul"
          >
            @for (nav of navItems; track nav.route) {
              <a
                [routerLink]="nav.route"
                [routerLinkActiveOptions]="nav.exact ? { exact: true } : { exact: false }"
                routerLinkActive="bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold shadow-2xs"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs lg:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-transparent transition-all whitespace-nowrap"
              >
                <span class="w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center bg-slate-200/90 text-slate-700">
                  {{ nav.id }}
                </span>
                <span>{{ nav.label }}</span>
              </a>
            }
          </nav>
        </div>

        <!-- MOBILE SUB-NAV (ALIGN CENTER) -->
        <nav
          class="flex md:hidden items-center justify-center gap-1 py-2 border-t border-slate-100 overflow-x-auto"
          aria-label="Navigasi Modul Mobile"
        >
          @for (nav of navItems; track nav.route) {
            <a
              [routerLink]="nav.route"
              [routerLinkActiveOptions]="nav.exact ? { exact: true } : { exact: false }"
              routerLinkActive="bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold shadow-2xs"
              class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md border border-transparent transition-all whitespace-nowrap"
            >
              <span class="text-[10px] font-bold text-slate-500">{{ nav.id }}.</span>
              <span>{{ nav.shortLabel || nav.label }}</span>
            </a>
          }
        </nav>
      </div>
    </header>
  `,
})
export class AppNavbarComponent {
  readonly navItems: NavItem[] = [
    { id: 1, label: 'Excel Join', shortLabel: 'Excel Join', route: '/', exact: true },
    { id: 2, label: 'Visualisasi Grafik', shortLabel: 'Grafik', route: '/chart', exact: false },
    { id: 3, label: 'Pemantauan Stunting', shortLabel: 'Monitoring', route: '/stunting-monitoring', exact: false },
    { id: 4, label: 'Dashboard Stunting', shortLabel: 'Dashboard', route: '/stunting-dashboard', exact: false },
    { id: 5, label: 'Kohort Stunting', shortLabel: 'Kohort', route: '/stunting-cohort', exact: false },
  ];
}

