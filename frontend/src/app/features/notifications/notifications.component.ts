import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, NotificationItem } from '../../core/services/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit {
  readonly notifService = inject(NotificationService);

  ngOnInit() {
    this.notifService.loadNotifications();
  }

  onNotificationClick(item: NotificationItem): void {
    this.notifService.handleNotificationClick(item);
  }
}
