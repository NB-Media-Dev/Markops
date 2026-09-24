import { Component, inject, OnInit, signal, computed, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CampaignService, AdItem, CampaignItem } from '../../core/services/campaign.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-ads',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ads.component.html',
  styleUrl: './ads.component.scss',
})
export class AdsComponent implements OnInit {
  @Input() packageFilter?: string;
  @Input() embedded = false;

  readonly campaignService = inject(CampaignService);
  readonly authService = inject(AuthService);

  readonly showModal = signal<boolean>(false);
  readonly isEditing = signal<boolean>(false);
  readonly editingAdId = signal<string | null>(null);

  readonly filterPlatform = signal<string>('ALL');
  readonly searchQuery = signal<string>('');
  readonly syncing = signal<boolean>(false);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  // Form Model
  formModel = {
    name: '',
    campaignId: '',
    campaignName: '',
    platform: 'Meta' as 'Meta' | 'Google Ads' | 'Instagram' | 'LinkedIn' | 'YouTube',
    status: 'ACTIVE' as 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DRAFT',
    spend: 0,
    leadsCount: 0,
    impressions: 5000,
    clicks: 150,
    ctr: 3.0,
    cpc: 5.0,
    platformAdId: '',
  };

  // Delete confirmation target
  readonly deleteConfirmTarget = signal<AdItem | null>(null);

  // Summary Metrics
  readonly totalSpend = computed(() =>
    this.filteredAds.reduce((sum, a) => sum + (a.spend || 0), 0)
  );

  readonly totalLeads = computed(() =>
    this.filteredAds.reduce((sum, a) => sum + (a.leadsCount || 0), 0)
  );

  readonly averageCpl = computed(() => {
    const leads = this.totalLeads();
    return leads > 0 ? (this.totalSpend() / leads).toFixed(2) : '0.00';
  });

  readonly averageCtr = computed(() => {
    const ads = this.filteredAds;
    if (ads.length === 0) return '0.00';
    const totalCtr = ads.reduce((sum, a) => sum + (a.ctr || 0), 0);
    return (totalCtr / ads.length).toFixed(2);
  });

  ngOnInit() {
    this.campaignService.loadAds().subscribe();
    this.campaignService.loadCampaigns().subscribe();
  }

  get computedModalCpl(): string {
    const spend = Number(this.formModel.spend) || 0;
    const leads = Number(this.formModel.leadsCount) || 0;
    return leads > 0 ? (spend / leads).toFixed(2) : '0.00';
  }

  get computedModalCtr(): string {
    const impressions = Number(this.formModel.impressions) || 0;
    const clicks = Number(this.formModel.clicks) || 0;
    if (impressions > 0 && clicks > 0) {
      return ((clicks / impressions) * 100).toFixed(2);
    }
    return Number(this.formModel.ctr || 0).toFixed(2);
  }

  onCampaignSelected(campaignId: string) {
    this.formModel.campaignId = campaignId;
    const cmp = this.campaignService.campaigns().find((c) => c.id === campaignId);
    if (cmp) {
      this.formModel.campaignName = cmp.name;
    }
  }

  openCreateModal() {
    this.isEditing.set(false);
    this.editingAdId.set(null);
    const campaigns = this.packageFilter
      ? this.campaignService.campaigns().filter((c) => c.name.toLowerCase().includes(this.packageFilter!.toLowerCase()))
      : this.campaignService.campaigns();
    const defaultCmp = campaigns.length > 0 ? campaigns[0] : (this.campaignService.campaigns()[0] || null);

    const defaultPrefix = this.packageFilter ? `${this.packageFilter} - ` : '';

    this.formModel = {
      name: defaultPrefix,
      campaignId: defaultCmp ? defaultCmp.id : '',
      campaignName: defaultCmp ? defaultCmp.name : (this.packageFilter ? `${this.packageFilter} Funnel` : 'General Digital Funnel'),
      platform: 'Meta',
      status: 'ACTIVE',
      spend: 0,
      leadsCount: 0,
      impressions: 5000,
      clicks: 150,
      ctr: 3.0,
      cpc: 5.0,
      platformAdId: `ad_ext_${Math.floor(100000 + Math.random() * 900000)}`,
    };
    this.errorMessage.set(null);
    this.showModal.set(true);
  }

  openEditModal(ad: AdItem) {
    this.isEditing.set(true);
    this.editingAdId.set(ad.id);
    this.formModel = {
      name: ad.name,
      campaignId: ad.campaignId || '',
      campaignName: ad.campaignName || '',
      platform: ad.platform as any,
      status: ad.status as any,
      spend: ad.spend || 0,
      leadsCount: ad.leadsCount || 0,
      impressions: ad.impressions || 5000,
      clicks: ad.clicks || 150,
      ctr: ad.ctr || 3.0,
      cpc: ad.cpc || 5.0,
      platformAdId: ad.platformAdId || '',
    };
    this.errorMessage.set(null);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingAdId.set(null);
    this.errorMessage.set(null);
  }

  saveAd() {
    if (!this.formModel.name || !this.formModel.name.trim()) {
      this.errorMessage.set('Ad Name is required.');
      return;
    }

    const spend = Number(this.formModel.spend) || 0;
    const leads = Number(this.formModel.leadsCount) || 0;
    const impressions = Number(this.formModel.impressions) || 5000;
    const clicks = Number(this.formModel.clicks) || 150;
    const computedCpl = leads > 0 ? Number((spend / leads).toFixed(2)) : 0;
    const computedCtr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : Number(this.formModel.ctr || 0);
    const computedCpc = clicks > 0 ? Number((spend / clicks).toFixed(2)) : Number(this.formModel.cpc || 0);

    const payload: Partial<AdItem> = {
      name: this.formModel.name.trim(),
      campaignId: this.formModel.campaignId,
      campaignName: this.formModel.campaignName || 'General Digital Funnel',
      platform: this.formModel.platform,
      status: this.formModel.status,
      spend: spend,
      leadsCount: leads,
      cpl: computedCpl,
      impressions: impressions,
      clicks: clicks,
      ctr: computedCtr,
      cpc: computedCpc,
      platformAdId: this.formModel.platformAdId,
    };

    if (this.isEditing() && this.editingAdId()) {
      this.campaignService.updateAd(this.editingAdId()!, payload).subscribe({
        next: () => {
          this.closeModal();
          this.showFlashMessage('Ad performance metrics updated successfully.');
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.error || 'Failed to update ad.');
        },
      });
    } else {
      this.campaignService.createAd(payload).subscribe({
        next: () => {
          this.closeModal();
          this.showFlashMessage('New ad metric created successfully.');
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.error || 'Failed to create ad.');
        },
      });
    }
  }

  confirmDelete(ad: AdItem) {
    this.deleteConfirmTarget.set(ad);
  }

  cancelDelete() {
    this.deleteConfirmTarget.set(null);
  }

  executeDelete() {
    const target = this.deleteConfirmTarget();
    if (!target) return;

    this.campaignService.deleteAd(target.id).subscribe({
      next: () => {
        this.deleteConfirmTarget.set(null);
        this.showFlashMessage(`Ad "${target.name}" deleted.`);
      },
      error: (err) => {
        this.deleteConfirmTarget.set(null);
        this.errorMessage.set(err?.error?.error || 'Failed to delete ad.');
      },
    });
  }

  syncAdAccounts() {
    this.syncing.set(true);
    this.campaignService.syncAds().subscribe({
      next: (res) => {
        this.syncing.set(false);
        this.showFlashMessage(res?.message || 'Ad metrics successfully synced.');
      },
      error: () => {
        this.syncing.set(false);
        this.errorMessage.set('Failed to synchronize ad accounts.');
      },
    });
  }

  showFlashMessage(msg: string) {
    this.successMessage.set(msg);
    setTimeout(() => {
      if (this.successMessage() === msg) {
        this.successMessage.set(null);
      }
    }, 4000);
  }

  get filteredAds(): AdItem[] {
    let list = this.campaignService.ads();
    const plat = this.filterPlatform();
    const q = this.searchQuery().trim().toLowerCase();
    const pkg = this.packageFilter?.trim().toLowerCase();

    if (pkg) {
      list = list.filter((a) =>
        a.name.toLowerCase().includes(pkg) ||
        (a.campaignName && a.campaignName.toLowerCase().includes(pkg)) ||
        (a.platform && a.platform.toLowerCase().includes(pkg))
      );
    }

    if (plat !== 'ALL') {
      list = list.filter((a) => a.platform === plat);
    }

    if (q) {
      list = list.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        (a.campaignName && a.campaignName.toLowerCase().includes(q)) ||
        (a.platform && a.platform.toLowerCase().includes(q))
      );
    }

    return list;
  }
}
