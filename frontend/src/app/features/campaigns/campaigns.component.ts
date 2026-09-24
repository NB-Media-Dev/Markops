import { Component, inject, OnInit, signal, computed, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CampaignService, CampaignItem } from '../../core/services/campaign.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-campaigns',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './campaigns.component.html',
  styleUrl: './campaigns.component.scss',
})
export class CampaignsComponent implements OnInit {
  @Input() packageFilter?: string;
  @Input() embedded = false;

  readonly campaignService = inject(CampaignService);
  readonly authService = inject(AuthService);

  readonly showModal = signal<boolean>(false);
  readonly isEditing = signal<boolean>(false);
  readonly editingCampaignId = signal<string | null>(null);

  readonly filterStatus = signal<string>('ALL');
  readonly searchQuery = signal<string>('');
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  // Form Model
  formModel = {
    name: '',
    status: 'ACTIVE' as 'PLANNING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED',
    objective: 'LEAD_GENERATION',
    spend: 0,
    leadsCount: 0,
    qualifiedLeads: 0,
    conversions: 0,
    budget: 50000,
    targetLeads: 300,
    targetCpl: 50,
    startDate: new Date().toISOString().split('T')[0],
  };

  // Delete confirmation modal state
  readonly deleteConfirmTarget = signal<CampaignItem | null>(null);

  // Summary Metrics
  readonly totalSpend = computed(() =>
    this.filteredCampaigns.reduce((sum, c) => sum + (c.spend || 0), 0)
  );

  readonly totalLeads = computed(() =>
    this.filteredCampaigns.reduce((sum, c) => sum + (c.leadsCount || 0), 0)
  );

  readonly totalConversions = computed(() =>
    this.filteredCampaigns.reduce((sum, c) => sum + (c.conversions || 0), 0)
  );

  readonly averageCpl = computed(() => {
    const leads = this.totalLeads();
    return leads > 0 ? (this.totalSpend() / leads).toFixed(2) : '0.00';
  });

  ngOnInit() {
    this.campaignService.loadCampaigns().subscribe();
  }

  get computedModalCpl(): string {
    const spend = Number(this.formModel.spend) || 0;
    const leads = Number(this.formModel.leadsCount) || 0;
    return leads > 0 ? (spend / leads).toFixed(2) : '0.00';
  }

  get computedModalConvRate(): string {
    const leads = Number(this.formModel.leadsCount) || 0;
    const conv = Number(this.formModel.conversions) || 0;
    return leads > 0 ? ((conv / leads) * 100).toFixed(1) : '0.0';
  }

  openCreateModal() {
    this.isEditing.set(false);
    this.editingCampaignId.set(null);
    const defaultPrefix = this.packageFilter ? `${this.packageFilter} - ` : '';
    this.formModel = {
      name: defaultPrefix,
      status: 'ACTIVE',
      objective: 'LEAD_GENERATION',
      spend: 0,
      leadsCount: 0,
      qualifiedLeads: 0,
      conversions: 0,
      budget: 50000,
      targetLeads: 300,
      targetCpl: 50,
      startDate: new Date().toISOString().split('T')[0],
    };
    this.errorMessage.set(null);
    this.showModal.set(true);
  }

  openEditModal(cmp: CampaignItem) {
    this.isEditing.set(true);
    this.editingCampaignId.set(cmp.id);
    this.formModel = {
      name: cmp.name,
      status: cmp.status as any,
      objective: cmp.objective || 'LEAD_GENERATION',
      spend: cmp.spend || 0,
      leadsCount: cmp.leadsCount || 0,
      qualifiedLeads: cmp.qualifiedLeads || 0,
      conversions: cmp.conversions || 0,
      budget: cmp.budget || 50000,
      targetLeads: cmp.targetLeads || 300,
      targetCpl: cmp.targetCpl || 50,
      startDate: cmp.startDate || new Date().toISOString().split('T')[0],
    };
    this.errorMessage.set(null);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingCampaignId.set(null);
    this.errorMessage.set(null);
  }

  saveCampaign() {
    if (!this.formModel.name || !this.formModel.name.trim()) {
      this.errorMessage.set('Campaign name is required.');
      return;
    }

    const user = this.authService.currentUser();
    const spend = Number(this.formModel.spend) || 0;
    const leads = Number(this.formModel.leadsCount) || 0;
    const conversions = Number(this.formModel.conversions) || 0;
    const qualified = Number(this.formModel.qualifiedLeads) || 0;
    const computedCpl = leads > 0 ? Number((spend / leads).toFixed(2)) : 0;
    const computedConvRate = leads > 0 ? Number(((conversions / leads) * 100).toFixed(1)) : 0;

    const payload: Partial<CampaignItem> = {
      name: this.formModel.name.trim(),
      status: this.formModel.status,
      objective: this.formModel.objective,
      spend: spend,
      leadsCount: leads,
      cpl: computedCpl,
      qualifiedLeads: qualified,
      conversions: conversions,
      convRate: computedConvRate,
      budget: Number(this.formModel.budget) || 50000,
      targetLeads: Number(this.formModel.targetLeads) || 300,
      targetCpl: Number(this.formModel.targetCpl) || 50,
      startDate: this.formModel.startDate,
      ownerId: user?.id,
      ownerName: user?.fullName,
    };

    if (this.isEditing() && this.editingCampaignId()) {
      this.campaignService.updateCampaign(this.editingCampaignId()!, payload).subscribe({
        next: () => {
          this.closeModal();
          this.showFlashMessage('Campaign updated successfully.');
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.error || 'Failed to update campaign.');
        },
      });
    } else {
      this.campaignService.createCampaign(payload).subscribe({
        next: () => {
          this.closeModal();
          this.showFlashMessage('New campaign created successfully.');
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.error || 'Failed to create campaign.');
        },
      });
    }
  }

  confirmDelete(cmp: CampaignItem) {
    this.deleteConfirmTarget.set(cmp);
  }

  cancelDelete() {
    this.deleteConfirmTarget.set(null);
  }

  executeDelete() {
    const target = this.deleteConfirmTarget();
    if (!target) return;

    this.campaignService.deleteCampaign(target.id).subscribe({
      next: () => {
        this.deleteConfirmTarget.set(null);
        this.showFlashMessage(`Campaign "${target.name}" deleted.`);
      },
      error: (err) => {
        this.deleteConfirmTarget.set(null);
        this.errorMessage.set(err?.error?.error || 'Failed to delete campaign.');
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

  get filteredCampaigns(): CampaignItem[] {
    let list = this.campaignService.campaigns();
    const st = this.filterStatus();
    const q = this.searchQuery().trim().toLowerCase();
    const pkg = this.packageFilter?.trim().toLowerCase();

    if (pkg) {
      list = list.filter((c) =>
        c.name.toLowerCase().includes(pkg) ||
        (c.objective && c.objective.toLowerCase().includes(pkg))
      );
    }

    if (st !== 'ALL') {
      list = list.filter((c) => c.status === st);
    }

    if (q) {
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        (c.objective && c.objective.toLowerCase().includes(q))
      );
    }

    return list;
  }
}
