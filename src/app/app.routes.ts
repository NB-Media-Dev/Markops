import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./core/layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        data: { title: 'Dashboard', icon: 'dashboard' },
      },
      {
        path: 'package-works',
        loadComponent: () =>
          import('./features/package-works/package-works.component').then((m) => m.PackageWorksComponent),
        data: { title: 'Package Works', icon: 'inventory_2' },
      },
      {
        path: 'tasks',
        loadComponent: () =>
          import('./features/designer/designer-dashboard.component').then((m) => m.DesignerDashboardComponent),
        data: { title: 'Tasks', icon: 'tasks' },
      },
      {
        path: 'designers',
        loadComponent: () =>
          import('./features/performance/performance.component').then((m) => m.PerformanceComponent),
        data: { title: 'Designers', icon: 'designers' },
      },
      {
        path: 'campaigns',
        loadComponent: () =>
          import('./features/campaigns/campaigns.component').then((m) => m.CampaignsComponent),
        data: { title: 'Campaigns', icon: 'campaigns' },
      },
      {
        path: 'targets',
        loadComponent: () =>
          import('./features/targets/targets.component').then((m) => m.TargetsComponent),
        data: { title: 'Targets', icon: 'targets' },
      },
      {
        path: 'ads',
        loadComponent: () =>
          import('./features/ads/ads.component').then((m) => m.AdsComponent),
        data: { title: 'Ads', icon: 'ads' },
      },
      {
        path: 'ad-metrics',
        loadComponent: () =>
          import('./features/ads/ads.component').then((m) => m.AdsComponent),
        data: { title: 'Ad Metrics', icon: 'ad-metrics' },
      },
      {
        path: 'leads',
        loadComponent: () =>
          import('./features/leads/leads.component').then((m) => m.LeadsComponent),
        data: { title: 'Leads', icon: 'leads' },
      },
      {
        path: 'lead-source',
        loadComponent: () =>
          import('./features/leads/leads.component').then((m) => m.LeadsComponent),
        data: { title: 'Lead Source', icon: 'lead-source' },
      },
      {
        path: 'assigned-leads',
        loadComponent: () =>
          import('./features/leads/leads.component').then((m) => m.LeadsComponent),
        data: { title: 'Assigned Leads', icon: 'assigned-leads' },
      },
      {
        path: 'telecalling',
        loadComponent: () =>
          import('./features/telecalling/telecalling.component').then((m) => m.TelecallingComponent),
        data: { title: 'Telecalling', icon: 'telecalling' },
      },
      {
        path: 'calls',
        loadComponent: () =>
          import('./features/telecalling/telecalling.component').then((m) => m.TelecallingComponent),
        data: { title: 'Calls', icon: 'telecalling' },
      },
      {
        path: 'follow-ups',
        loadComponent: () =>
          import('./features/telecalling/telecalling.component').then((m) => m.TelecallingComponent),
        data: { title: 'Follow-ups', icon: 'follow-ups' },
      },
      {
        path: 'qualification',
        loadComponent: () =>
          import('./features/telecalling/telecalling.component').then((m) => m.TelecallingComponent),
        data: { title: 'Qualification', icon: 'qualification' },
      },
      {
        path: 'outcomes',
        loadComponent: () =>
          import('./features/telecalling/telecalling.component').then((m) => m.TelecallingComponent),
        data: { title: 'Outcomes', icon: 'outcomes' },
      },

      {
        path: 'transactions',
        loadComponent: () =>
          import('./features/transactions/transactions.component').then((m) => m.TransactionsComponent),
        data: { title: 'Transactions', icon: 'transactions' },
      },
      {
        path: 'transaction-workflow',
        loadComponent: () =>
          import('./features/transactions/transactions.component').then((m) => m.TransactionsComponent),
        data: { title: 'Transaction Workflow', icon: 'transactions' },
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/reports/reports.component').then((m) => m.ReportsComponent),
        data: { title: 'Reports', icon: 'reports' },
      },
      {
        path: 'performance',
        loadComponent: () =>
          import('./features/performance/performance.component').then((m) => m.PerformanceComponent),
        data: { title: 'Performance', icon: 'performance' },
      },
      {
        path: 'achievements',
        loadComponent: () =>
          import('./features/performance/performance.component').then((m) => m.PerformanceComponent),
        data: { title: 'Achievements', icon: 'achievements' },
      },
      {
        path: 'users-roles',
        canActivate: [roleGuard],
        data: { roles: ['ADMINISTRATOR'] },
        loadComponent: () =>
          import('./features/users-roles/users-roles.component').then((m) => m.UsersRolesComponent),
      },
      {
        path: 'audit-logs',
        canActivate: [roleGuard],
        data: { title: 'Audit Logs', icon: 'audit-logs', roles: ['ADMINISTRATOR', 'MARKETING_MANAGER'] },
        loadComponent: () =>
          import('./features/audit-logs/audit-logs.component').then((m) => m.AuditLogsComponent),
      },
      {
        path: 'downloads',
        loadComponent: () =>
          import('./features/downloads/downloads.component').then((m) => m.DownloadsComponent),
        data: { title: 'Downloads', icon: 'downloads' },
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications.component').then((m) => m.NotificationsComponent),
        data: { title: 'Notifications', icon: 'notifications' },
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then((m) => m.SettingsComponent),
        data: { title: 'Settings', icon: 'settings' },
      },
      {
        path: 'integrations',
        loadComponent: () =>
          import('./features/settings/settings.component').then((m) => m.SettingsComponent),
        data: { title: 'Integrations', icon: 'integrations' },
      },
      {
        path: 'designer-tasks',
        loadComponent: () =>
          import('./features/designer/designer-dashboard.component').then((m) => m.DesignerDashboardComponent),
        data: { title: 'Own Tasks', icon: 'tasks' },
      },
      {
        path: 'submissions',
        loadComponent: () =>
          import('./features/designer/designer-dashboard.component').then((m) => m.DesignerDashboardComponent),
        data: { title: 'Submissions', icon: 'submissions' },
      },
      {
        path: 'revisions',
        loadComponent: () =>
          import('./features/designer/designer-dashboard.component').then((m) => m.DesignerDashboardComponent),
        data: { title: 'Revisions', icon: 'revisions' },
      },
      {
        path: 'comments',
        loadComponent: () =>
          import('./features/designer/designer-dashboard.component').then((m) => m.DesignerDashboardComponent),
        data: { title: 'Comments', icon: 'comments' },
      },
      {
        path: 'files',
        loadComponent: () =>
          import('./features/designer/designer-dashboard.component').then((m) => m.DesignerDashboardComponent),
        data: { title: 'Files', icon: 'files' },
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
