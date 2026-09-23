import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  autoSyncIntervalMinutes = 15;
  retentionDays = 90;

  readonly savedMessage = signal<string | null>(null);

  saveSettings() {
    this.savedMessage.set('System configuration saved successfully.');
    setTimeout(() => this.savedMessage.set(null), 3000);
  }
}
