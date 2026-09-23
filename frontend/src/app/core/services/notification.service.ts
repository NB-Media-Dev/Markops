import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly authService = inject(AuthService);
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
    }, 5000);
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
}
