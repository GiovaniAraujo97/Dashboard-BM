import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { LoginGuard } from './guards/login.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent),
    canActivate: [LoginGuard]
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'clientes',
    loadComponent: () => import('./components/clientes/clientes.component').then(m => m.ClientesComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'emprestimos',
    loadComponent: () => import('./components/emprestimos/emprestimos.component').then(m => m.EmprestimosComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'pagamentos',
    loadComponent: () => import('./components/pagamentos/pagamentos.component').then(m => m.PagamentosComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'cobranca',
    loadComponent: () => import('./components/cobranca/cobranca.component').then(m => m.CobrancaComponent),
    canActivate: [AuthGuard]
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
