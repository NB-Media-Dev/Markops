import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/auth.model';
import { SYSTEM_ROLES_METADATA } from '../models/user-management.model';

export interface NavMenuItem {
  label: string;
  route: string;
  icon: string;
  badge?: string;
  badgeType?: string;
}

export const ROLE_SIDEBAR_MENU: Record<UserRole, NavMenuItem[]> = {
  ADMINISTRATOR: [
    { label: 'Dashboard', route: '/dashboard', icon: 'dashboard' },
    { label: 'Targets', route: '/targets', icon: 'track_changes' },
    { label: 'Tasks', route: '/tasks', icon: 'tasks' },
    { label: 'Designers', route: '/designers', icon: 'designers' },
    { label: 'Campaigns', route: '/campaigns', icon: 'campaigns' },
    { label: 'Ads', route: '/ads', icon: 'ads' },
    { label: 'Leads', route: '/leads', icon: 'leads' },
    { label: 'Telecalling', route: '/telecalling', icon: 'telecalling' },
    { label: 'Transactions', route: '/transactions', icon: 'transactions' },
    { label: 'Reports', route: '/reports', icon: 'reports' },
    { label: 'Users & Roles', route: '/users-roles', icon: 'users-roles', badge: 'Admin', badgeType: 'primary' },
    { label: 'Audit Logs', route: '/audit-logs', icon: 'audit-logs' },
    { label: 'Downloads', route: '/downloads', icon: 'downloads' },
    { label: 'Notifications', route: '/notifications', icon: 'notifications' },
    { label: 'Settings', route: '/settings', icon: 'settings' },
  ],
  MARKETING_MANAGER: [
    { label: 'Dashboard', route: '/dashboard', icon: 'dashboard' },
    { label: 'Targets', route: '/targets', icon: 'track_changes' },
    { label: 'Campaigns', route: '/campaigns', icon: 'campaigns' },
    { label: 'Tasks', route: '/tasks', icon: 'tasks' },
    { label: 'Leads', route: '/leads', icon: 'leads' },
    { label: 'Reports', route: '/reports', icon: 'reports' },
    { label: 'Performance', route: '/performance', icon: 'performance' },
    { label: 'Downloads', route: '/downloads', icon: 'downloads' },
  ],
  DIGITAL_MARKETING: [
    { label: 'Dashboard', route: '/dashboard', icon: 'dashboard' },
    { label: 'Package Works', route: '/package-works', icon: 'inventory_2' },
    { label: 'Lead Upload & Assign', route: '/leads', icon: 'leads', badge: 'Excel', badgeType: 'primary' },
    { label: 'Telecalling Overview', route: '/telecalling', icon: 'telecalling' },
    { label: 'Campaigns', route: '/campaigns', icon: 'campaigns' },
    { label: 'Ads', route: '/ads', icon: 'ads' },
    { label: 'Ad Metrics', route: '/ad-metrics', icon: 'ad-metrics' },
    { label: 'Lead Source', route: '/lead-source', icon: 'lead-source' },
  ],
  DESIGNER: [
    { label: 'Own Tasks', route: '/designer-tasks', icon: 'tasks' },
    { label: 'Submissions', route: '/submissions', icon: 'submissions' },
    { label: 'Revisions', route: '/revisions', icon: 'revisions' },
    { label: 'Comments', route: '/comments', icon: 'comments' },
    { label: 'Files', route: '/files', icon: 'files' },
    { label: 'Achievements', route: '/achievements', icon: 'achievements', badge: 'Rewards', badgeType: 'warning' },
  ],
  TELECALLER: [
    { label: 'Assigned Leads', route: '/assigned-leads', icon: 'assigned-leads' },
    { label: 'Calls', route: '/calls', icon: 'telecalling' },
    { label: 'Follow-ups', route: '/follow-ups', icon: 'follow-ups' },
    { label: 'Qualification', route: '/qualification', icon: 'qualification' },
    { label: 'Outcomes', route: '/outcomes', icon: 'outcomes' },
  ],
  BDM: [
    { label: 'Package Works', route: '/package-works', icon: 'inventory_2' },
    { label: 'Tasks', route: '/tasks', icon: 'tasks' },
    { label: 'Designers', route: '/designers', icon: 'designers' },
    { label: 'Notifications', route: '/notifications', icon: 'notifications' },
  ],
};

import { NotificationService } from '../services/notification.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
  readonly authService = inject(AuthService);
  readonly notifService = inject(NotificationService);
  private readonly router = inject(Router);

  readonly sidebarCollapsed = signal<boolean>(false);
  readonly isMobileMenuOpen = signal<boolean>(false);
  readonly isNotificationFlyoutOpen = signal<boolean>(false);

  readonly activeRole = computed<UserRole>(() => {
    return this.authService.currentUser()?.role || 'ADMINISTRATOR';
  });

  readonly roleDisplayLabel = computed<string>(() => {
    const role = this.activeRole();
    const meta = SYSTEM_ROLES_METADATA.find((r) => r.code === role);
    return meta ? meta.label : role;
  });

  readonly menuItems = computed<NavMenuItem[]>(() => {
    const role = this.activeRole();
    return ROLE_SIDEBAR_MENU[role] || ROLE_SIDEBAR_MENU.ADMINISTRATOR;
  });


  toggleSidebar(): void {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      this.isMobileMenuOpen.update((val) => !val);
    } else {
      this.sidebarCollapsed.update((val) => !val);
    }
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  toggleNotificationFlyout(): void {
    this.isNotificationFlyoutOpen.update((val) => !val);
  }

  closeNotificationFlyout(): void {
    this.isNotificationFlyoutOpen.set(false);
  }

  onNotificationClick(item: any): void {
    this.closeNotificationFlyout();
    this.notifService.handleNotificationClick(item);
  }

  onToastClick(toast: any): void {
    this.notifService.handleNotificationClick(toast);
  }

  onToastClose(event: Event): void {
    event.stopPropagation();
    this.notifService.closeToast();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
