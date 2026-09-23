import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';

export interface CampaignItem {
  id: string;
  name: string;
  objective: string;
  status: 'PLANNING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  startDate: string;
  endDate?: string | null;
  budget: number;
  targetLeads: number;
  targetCpl: number;
  targetQualifiedPct: number;
  targetConversionPct: number;
  leadsCount: number;
  spend: number;
  cpl: number;
  qualifiedLeads: number;
  conversions: number;
  revenue: number;
  ownerId: string;
  ownerName: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class CampaignService {
  private readonly http = inject(HttpClient);

  readonly campaigns = signal<CampaignItem[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  loadCampaigns() {
    this.loading.set(true);
    return this.http.get<CampaignItem[]>('/api/campaigns').pipe(
      tap({
        next: (data) => {
          this.campaigns.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to load campaigns.');
          this.loading.set(false);
        },
      })
    );
  }

  createCampaign(payload: Partial<CampaignItem>) {
    this.loading.set(true);
    return this.http.post<CampaignItem>('/api/campaigns', payload).pipe(
      tap({
        next: (newCmp) => {
          this.campaigns.update((list) => [newCmp, ...list]);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to create campaign.');
          this.loading.set(false);
        },
      })
    );
  }
}
