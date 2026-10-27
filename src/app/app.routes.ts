import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'admin',
    loadComponent: () => import('./admin/admin').then((module) => module.Admin),
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./landing/landing').then((module) => module.Landing),
  },
  { path: '**', redirectTo: '' },
];
