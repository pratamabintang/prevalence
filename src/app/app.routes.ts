import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/excel-join/excel-join.component').then((m) => m.ExcelJoinComponent),
  },
  {
    path: 'join',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    path: 'chart',
    loadComponent: () =>
      import('./features/chart-visualizer/chart-visualizer.component').then(
        (m) => m.ChartVisualizerComponent,
      ),
  },
  {
    path: 'stunting-monitoring',
    loadComponent: () =>
      import('./features/stunting-monitoring/stunting-monitoring.component').then(
        (m) => m.StuntingMonitoringComponent,
      ),
  },
  {
    path: 'stunting-dashboard',
    loadComponent: () =>
      import('./features/stunting-dashboard/stunting-dashboard.component').then(
        (m) => m.StuntingDashboardComponent,
      ),
  },
  {
    path: 'stunting-cohort',
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
