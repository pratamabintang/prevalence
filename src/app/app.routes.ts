import { Routes } from '@angular/router';
import { environment } from '../environments/environment';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'data',
    loadComponent: () =>
      import('./features/excel-join/excel-join.component').then((m) => m.ExcelJoinComponent),
  },
  {
    path: 'join',
    redirectTo: 'data',
    pathMatch: 'full',
  },
  {
    path: 'excel-join',
    redirectTo: 'data',
    pathMatch: 'full',
  },
  {
    path: 'visualisasi',
    loadComponent: () =>
      import('./features/chart-visualizer/chart-visualizer.component').then(
        (m) => m.ChartVisualizerComponent,
      ),
  },
  {
    path: 'chart',
    redirectTo: 'visualisasi',
    pathMatch: 'full',
  },
  {
    path: 'capaian-intervensi',
    loadComponent: () =>
      import('./features/stunting-monitoring/stunting-monitoring.component').then(
        (m) => m.StuntingMonitoringComponent,
      ),
  },
  {
    path: 'stunting-monitoring',
    redirectTo: 'capaian-intervensi',
    pathMatch: 'full',
  },
  {
    path: 'stunting-dashboard',
    canMatch: [() => environment.enableStuntingDashboard],
    loadComponent: () =>
      import('./features/stunting-dashboard/stunting-dashboard.component').then(
        (m) => m.StuntingDashboardComponent,
      ),
  },
  {
    path: 'stunting-cohort',
    canMatch: [() => environment.enableStuntingCohort ?? false],
    loadComponent: () =>
      import('./features/stunting-cohort/stunting-cohort.component').then(
        (m) => m.StuntingCohortComponent,
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
