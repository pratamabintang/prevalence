import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { BackendStorageService } from '../../../core/storage/backend-storage.service';

export interface NavItem {
  id: number;
  label: string;
  route: string;
  exact: boolean;
  shortLabel?: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <!-- FLOATING SHOW NAVBAR BUTTON (POSITIONED AT BOTTOM-LEFT) -->
    @if (!isOpen()) {
      <button
        type="button"
        data-testid="show-navbar-btn"
        (click)="showNavbar()"
        class="fixed bottom-4 left-4 z-50 flex items-center justify-center w-11 h-11 rounded-xl border border-slate-300 bg-white text-slate-700 shadow-md hover:bg-[#EEF0FF] hover:text-[#4348E6] hover:border-[#525AFF]/40 focus-visible:ring-2 focus-visible:ring-[#525AFF] transition cursor-pointer"
        title="Tampilkan Navbar"
        aria-label="Tampilkan Navbar"
      >
        <svg
          class="w-5 h-5 text-slate-700 hover:text-[#4348E6] transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
    }

    @if (isOpen()) {
      <!-- LEFT SIDEBAR NAVBAR (OPEN BY DEFAULT) -->
      <aside
        data-testid="left-navbar"
        class="w-60 sm:w-64 shrink-0 h-screen sticky top-0 z-40 bg-white border-r border-slate-200 flex flex-col justify-between shadow-2xs select-none"
      >
        <!-- TOP ACCENT COLOR RIBBON (IDENTITY MOTIF) -->
        <div class="h-1 w-full bg-gradient-to-r from-[#8FD9FB] via-[#0F766E] to-[#525AFF] shrink-0"></div>

        <!-- SIDEBAR HEADER (BRANDING) -->
        <div class="p-4 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <a
            routerLink="/"
            class="flex items-center gap-2.5 text-slate-900 hover:text-[#4348E6] transition-colors group truncate rounded-lg focus-visible:ring-2 focus-visible:ring-[#525AFF]"
            title="Dinkes Data Tools - Halaman Awal"
          >
            <img
              src="logo.png"
              alt="Logo Dinkes"
              class="w-8 h-8 object-contain shrink-0 transition-transform group-hover:scale-105"
            />
            <div class="flex flex-col truncate">
              <span class="font-bold text-sm leading-tight text-slate-900 group-hover:text-[#4348E6] transition-colors truncate">
                Tools
              </span>
              <span class="text-xs text-slate-600 font-medium leading-tight truncate">
                Dinkes Prov. Jateng
              </span>
            </div>
          </a>
        </div>

        <!-- MODULE NAVIGATION (VERTICAL LIST WITHOUT NUMBERING OR HEADER TEXT) -->
        <nav
          class="flex-1 overflow-y-auto p-3 space-y-1.5"
          aria-label="Navigasi Modul"
        >
          @for (nav of navItems(); track nav.route) {
            @if (nav.disabled) {
              <button
                type="button"
                disabled
                aria-disabled="true"
                data-testid="nav-disabled-kohort"
                class="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs sm:text-sm font-medium text-slate-600 bg-slate-100 rounded-xl border border-slate-200 cursor-not-allowed select-none"
                title="Modul masih dalam tahap pengembangan (Segera Hadir)"
              >
                <span class="truncate">{{ nav.label }}</span>
                <span class="text-[11px] font-semibold text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Dev
                </span>
              </button>
            } @else {
              <a
                [routerLink]="nav.route"
                [routerLinkActiveOptions]="nav.exact ? { exact: true } : { exact: false }"
                routerLinkActive="bg-[#EEF0FF] text-[#3730A3] border-[#525AFF]/40 font-semibold shadow-2xs"
                class="flex items-center gap-2.5 px-3 py-2.5 text-xs sm:text-sm font-medium text-slate-700 hover:text-[#4348E6] hover:bg-[#F2F5FA] rounded-xl border border-transparent transition-all focus-visible:ring-2 focus-visible:ring-[#525AFF]"
              >
                <span class="truncate">{{ nav.label }}</span>
              </a>
            }
          }
        </nav>

        <!-- SIDEBAR FOOTER (HIDE BUTTON & STATUS INDICATOR AT BOTTOM-LEFT) -->
        <div class="p-3 border-t border-slate-200 shrink-0 flex items-center justify-between bg-slate-50/50">
          <!-- HIDE BUTTON AT BOTTOM-LEFT WITH THREE-LINE ICON -->
          <button
            type="button"
            data-testid="hide-navbar-btn"
            (click)="hideNavbar()"
            class="flex items-center justify-center w-10 h-10 rounded-xl border border-slate-300 bg-white hover:bg-[#EEF0FF] text-slate-700 hover:text-[#4348E6] hover:border-[#525AFF]/40 focus-visible:ring-2 focus-visible:ring-[#525AFF] transition cursor-pointer"
            title="Sembunyikan Navbar"
            aria-label="Sembunyikan Navbar"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <!-- SERVER STATUS INDICATOR (DOT ONLY) -->
          <button
            type="button"
            data-testid="server-status-badge"
            (click)="checkServerConnection()"
            [disabled]="isCheckingServer()"
            class="flex items-center justify-center w-10 h-10 rounded-xl border transition cursor-pointer select-none shadow-2xs focus-visible:ring-2 focus-visible:ring-[#525AFF]"
            [class.border-emerald-300]="backendStorage.isConnected()"
            [class.bg-emerald-50]="backendStorage.isConnected()"
            [class.border-slate-300]="!backendStorage.isConnected()"
            [class.bg-white]="!backendStorage.isConnected()"
            [title]="
              backendStorage.isConnected()
                ? 'Terhubung ke server. Klik untuk cek ulang.'
                : 'Mode offline / mandiri. Klik untuk mencoba menghubungkan kembali.'
            "
            [attr.aria-label]="backendStorage.isConnected() ? 'Server Terhubung' : 'Mode Mandiri'"
          >
            <span
              class="h-2.5 w-2.5 rounded-full shrink-0"
              [class.bg-[#0F766E]]="backendStorage.isConnected()"
              [class.animate-pulse]="isCheckingServer()"
              [class.bg-amber-600]="!backendStorage.isConnected()"
            ></span>
          </button>
        </div>
      </aside>
    }
  `,
})
export class AppNavbarComponent implements OnInit {
  readonly backendStorage = inject(BackendStorageService);
  readonly isCheckingServer = signal(false);
  readonly enableStuntingDashboard = signal(environment.enableStuntingDashboard);
  readonly enableStuntingCohort = signal(environment.enableStuntingCohort ?? false);
  readonly isOpen = signal(true);

  readonly allNavItems: NavItem[] = [
    { id: 1, label: 'Beranda', shortLabel: 'Beranda', route: '/', exact: true },
    { id: 2, label: 'Data', shortLabel: 'Data', route: '/data', exact: false },
    { id: 3, label: 'Visualisasi', shortLabel: 'Visualisasi', route: '/visualisasi', exact: false },
    { id: 4, label: 'Capaian Intervensi', shortLabel: 'Intervensi', route: '/capaian-intervensi', exact: false },
    { id: 5, label: 'Kohort Stunting', shortLabel: 'Kohort', route: '/stunting-cohort', exact: false, disabled: true },
    { id: 6, label: 'Dashboard Stunting', shortLabel: 'Dashboard', route: '/stunting-dashboard', exact: false },
  ];

  readonly navItems = computed<NavItem[]>(() => {
    const isDashboardEnabled = this.enableStuntingDashboard();
    const isCohortEnabled = this.enableStuntingCohort();
    return this.allNavItems
      .filter((nav) => nav.route !== '/stunting-dashboard' || isDashboardEnabled)
      .map((item, index) => {
        if (item.route === '/stunting-cohort') {
          return {
            ...item,
            id: index + 1,
            disabled: !isCohortEnabled,
          };
        }
        return {
          ...item,
          id: index + 1,
        };
      });
  });

  ngOnInit(): void {
    void this.checkServerConnection();
  }

  toggleNavbar(): void {
    this.isOpen.update((v) => !v);
  }

  showNavbar(): void {
    this.isOpen.set(true);
  }

  hideNavbar(): void {
    this.isOpen.set(false);
  }

  async checkServerConnection(): Promise<void> {
    if (this.isCheckingServer()) return;
    this.isCheckingServer.set(true);
    try {
      await this.backendStorage.pingServer();
    } finally {
      this.isCheckingServer.set(false);
    }
  }
}
