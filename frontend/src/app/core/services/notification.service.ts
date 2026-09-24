import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { io, Socket } from 'socket.io-client';
import { AuthService } from './auth.service';
import { safeFetch, getBackendBaseUrl } from '../utils/api-url.utils';

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT';
  isRead: boolean;
  createdAt: string;
  targetRoute?: string;
  link?: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private socket: Socket | null = null;

  readonly notifications = signal<NotificationItem[]>([]);
  readonly activeToast = signal<NotificationItem | null>(null);
  readonly unreadCount = computed(() => this.notifications().filter((n) => !n.isRead).length);

  constructor() {
    if (this.isBrowser) {
      this.loadNotifications();
      this.initRealtimeSocket();
    }
  }

  private initRealtimeSocket(): void {
    try {
      const backendUrl = getBackendBaseUrl();
      this.socket = io(backendUrl, {
        transports: ['polling', 'websocket'],
        reconnectionAttempts: 5,
        timeout: 10000,
      });

      this.socket.on('connect_error', () => {
        // Silent connection retry notice
      });

      this.socket.on('notification:created', (notif: NotificationItem) => {
        const currentUserId = this.authService.currentUser()?.id;
        // User interaction check: ONLY show notification if it is for current user (or broadcast)
        if (!notif.userId || notif.userId === currentUserId) {
          this.notifications.update((list) => {
            if (list.some((n) => n.id === notif.id)) return list;
            return [notif, ...list];
          });
          if (!notif.isRead) {
            this.triggerToast(notif);
          }
        }
      });
    } catch (e) {
      console.log('[NotificationService] Socket.IO connection notice:', e);
    }
  }

  triggerToast(notif: NotificationItem): void {
    this.activeToast.set(notif);
    setTimeout(() => {
      if (this.activeToast()?.id === notif.id) {
        this.activeToast.set(null);
      }
    }, 6000);
  }

  closeToast(): void {
    this.activeToast.set(null);
  }

  async loadNotifications(): Promise<void> {
    try {
      const currentUserId = this.authService.currentUser()?.id || 'usr_admin_01';
      const res = await safeFetch(`/api/notifications?userId=${encodeURIComponent(currentUserId)}`, {
        headers: {
          'x-user-id': currentUserId,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          this.notifications.set(data);
        }
      }
    } catch (err) {
      console.log('Error loading notifications:', err);
    }
  }

  async markAsRead(id: string): Promise<void> {
    // Optimistically mark as read immediately in local state
    this.notifications.update((list) =>
      list.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );

    try {
      const currentUserId = this.authService.currentUser()?.id || 'usr_admin_01';
      await safeFetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
      });
    } catch (err) {
      console.log('Error marking notification read:', err);
    }
  }

  async markAllAsRead(): Promise<void> {
    // Optimistically mark all as read immediately in local state
    this.notifications.update((list) =>
      list.map((n) => ({ ...n, isRead: true }))
    );

    try {
      const currentUserId = this.authService.currentUser()?.id || 'usr_admin_01';
      await safeFetch(`/api/notifications/read-all`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
      });
    } catch (err) {
      console.log('Error marking all notifications read:', err);
    }
  }

  getNotificationTargetRoute(notif: NotificationItem): string {
    if (notif.targetRoute) return notif.targetRoute;
    if (notif.link) return notif.link;

    const currentRole = this.authService.currentUser()?.role || '';
    const text = `${notif.title || ''} ${notif.message || ''}`.toLowerCase();

    // 1. Task / Creative Design / Revision / Submissions
    if (
      text.includes('task') ||
      text.includes('creative') ||
      text.includes('design') ||
      text.includes('revision') ||
      text.includes('version') ||
      text.includes('submission') ||
      text.includes('canvas') ||
      text.includes('brief')
    ) {
      if (currentRole === 'DESIGNER') {
        if (text.includes('revision')) return '/revisions';
        if (text.includes('submission') || text.includes('approved')) return '/submissions';
        return '/designer-tasks';
      }
      if (currentRole === 'BDM') {
        return '/package-works';
      }
      if (currentRole === 'DIGITAL_MARKETING') {
        return '/package-works';
      }
      return '/tasks';
    }

    // 2. Package Works
    if (
      text.includes('package') ||
      text.includes('careermate') ||
      text.includes('brandmate') ||
      text.includes('growthmate') ||
      text.includes('marketmate') ||
      text.includes('launchmate')
    ) {
      return '/package-works';
    }

    // 3. Telecalling / Call Targets / Deficit / Qualification / Outcome
    if (
      text.includes('telecaller') ||
      text.includes('call') ||
      text.includes('follow-up') ||
      text.includes('qualification') ||
      text.includes('deficit') ||
      text.includes('target') ||
      text.includes('quota')
    ) {
      if (currentRole === 'TELECALLER') {
        if (text.includes('follow-up')) return '/follow-ups';
        if (text.includes('qualification')) return '/qualification';
        if (text.includes('outcome')) return '/outcomes';
        return '/calls';
      }
      if (text.includes('target') || text.includes('deficit') || text.includes('quota') || text.includes('evaluat')) {
        return '/targets';
      }
      return '/telecalling';
    }

    // 4. Leads & Lead Upload
    if (text.includes('lead')) {
      if (currentRole === 'TELECALLER') {
        return '/assigned-leads';
      }
      if (text.includes('source')) {
        return '/lead-source';
      }
      return '/leads';
    }

    // 5. Campaigns & Ads
    if (
      text.includes('campaign') ||
      text.includes('ad ') ||
      text.includes('ads') ||
      text.includes('meta') ||
      text.includes('creative ad') ||
      text.includes('cpc') ||
      text.includes('ctr')
    ) {
      if (text.includes('metric') || text.includes('ctr') || text.includes('cpc')) {
        return '/ad-metrics';
      }
      if (text.includes('ad ') || text.includes('ads')) {
        return '/ads';
      }
      return '/campaigns';
    }

    // 6. Transactions / Conversions / Revenue
    if (
      text.includes('transaction') ||
      text.includes('conversion') ||
      text.includes('revenue') ||
      text.includes('payment')
    ) {
      return '/transactions';
    }

    // 7. Performance & Achievements
    if (text.includes('achievement') || text.includes('reward')) {
      return currentRole === 'DESIGNER' ? '/achievements' : '/performance';
    }
    if (text.includes('performance') || text.includes('analytics') || text.includes('report')) {
      return '/reports';
    }

    // 8. Users & Roles
    if (text.includes('user') || text.includes('role') || text.includes('permission')) {
      return currentRole === 'ADMINISTRATOR' ? '/users-roles' : '/dashboard';
    }

    // 9. Audit Logs
    if (text.includes('audit') || text.includes('security') || text.includes('log')) {
      return '/audit-logs';
    }

    // Default fallback
    if (currentRole === 'DESIGNER') return '/designer-tasks';
    if (currentRole === 'TELECALLER') return '/assigned-leads';
    if (currentRole === 'BDM') return '/package-works';
    return '/dashboard';
  }

  handleNotificationClick(notif: NotificationItem): void {
    this.markAsRead(notif.id);
    this.closeToast();
    const route = this.getNotificationTargetRoute(notif);
    if (route) {
      this.router.navigateByUrl(route);
    }
  }
}
