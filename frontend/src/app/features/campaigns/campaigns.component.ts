import { Component, inject, OnInit, signal } from '@angular/core';
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
  readonly campaignService = inject(CampaignService);
  readonly authService = inject(AuthService);

  readonly showModal = signal<boolean>(false);
  readonly filterStatus = signal<string>('ALL');

  newCmpName = '';
  newCmpObjective = 'LEAD_GENERATION';
  newCmpBudget = 10000;
  newCmpTargetLeads = 300;
  newCmpTargetCpl = 33.33;

  ngOnInit() {
    this.campaignService.loadCampaigns().subscribe();
  }

  openModal() {
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  createCampaign() {
    if (!this.newCmpName) return;
    const user = this.authService.currentUser();
    this.campaignService
      .createCampaign({
        name: this.newCmpName,
        objective: this.newCmpObjective,
        budget: this.newCmpBudget,
        targetLeads: this.newCmpTargetLeads,
        targetCpl: this.newCmpTargetCpl,
        ownerId: user?.id,
        ownerName: user?.fullName,
      } as any)
      .subscribe(() => {
        this.closeModal();
        this.newCmpName = '';
      });
  }

  get filteredCampaigns(): CampaignItem[] {
    const list = this.campaignService.campaigns();
    const st = this.filterStatus();
    if (st === 'ALL') return list;
    return list.filter((c) => c.status === st);
  }
}
