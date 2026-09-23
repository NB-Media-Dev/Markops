import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

export interface AdItem {
  id: string;
  campaignId: string;
  campaignName: string;
  name: string;
  platform: string;
  status: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leadsCount: number;
  cpl: number;
  platformAdId: string;
  lastSyncedAt: string;
}

@Component({
  selector: 'app-ads',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ads.component.html',
  styleUrl: './ads.component.scss',
})
export class AdsComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly ads = signal<AdItem[]>([]);
  readonly syncing = signal<boolean>(false);
  readonly syncMessage = signal<string | null>(null);

  ngOnInit() {
    this.loadAds();
  }

  loadAds() {
    this.http.get<AdItem[]>('/api/ads').subscribe((data) => this.ads.set(data));
  }

  refreshAds() {
    this.syncing.set(true);
    this.http.get<AdItem[]>('/api/ads').subscribe({
      next: (data) => {
        this.ads.set(data);
        this.syncing.set(false);
        this.syncMessage.set('Ad performance data refreshed successfully.');
        setTimeout(() => this.syncMessage.set(null), 4000);
      },
      error: () => this.syncing.set(false),
    });
  }
}
