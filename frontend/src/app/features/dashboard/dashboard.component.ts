import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TaskManagementService } from '../../core/services/task-management.service';
import { CampaignService } from '../../core/services/campaign.service';
import { LeadTelecallingService } from '../../core/services/lead-telecalling.service';
import { ConversionTransactionService } from '../../core/services/conversion-transaction.service';

import { DesignerDashboardComponent } from '../designer/designer-dashboard.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, DesignerDashboardComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly taskService = inject(TaskManagementService);
  readonly campaignService = inject(CampaignService);
  readonly leadService = inject(LeadTelecallingService);
  readonly txnService = inject(ConversionTransactionService);

  readonly userRole = computed(() => this.authService.currentUser()?.role || 'ADMINISTRATOR');

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    let timeGreeting = 'Good morning';
    if (hour >= 12 && hour < 17) {
      timeGreeting = 'Good afternoon';
    } else if (hour >= 17 || hour < 5) {
      timeGreeting = 'Good evening';
    }
    const user = this.authService.currentUser();
    const name = user?.fullName || 'User';
    return `${timeGreeting}, ${name}`;
  });

  readonly activeCampaignsCount = computed(() =>
    this.campaignService.campaigns().filter((c) => c.status === 'ACTIVE').length
  );

  readonly totalLeadsCount = computed(() => this.leadService.leads().length);

  readonly totalRevenue = computed(() =>
    this.txnService.transactions().reduce((sum, t) => sum + Number(t.amount || 0), 0)
  );

  readonly qualificationRate = computed(() => {
    const leads = this.leadService.leads();
    const qualified = leads.filter((l) => l.status === 'QUALIFIED').length;
    return leads.length > 0 ? Number(((qualified / leads.length) * 100).toFixed(1)) : 0;
  });

  // DESIGNER Metrics
  readonly designerAssignedTasks = computed(() => {
    const tasks = this.taskService.tasks();
    const user = this.authService.currentUser();
    const userId = String(user?.id || '');
    const userName = String(user?.fullName || '').toLowerCase().trim();
    const userEmail = String(user?.email || '').toLowerCase().trim();

    return tasks.filter((t) =>
      (t.assignedTo && String(t.assignedTo) === userId) ||
      (t.assignedTo && userEmail && String(t.assignedTo).toLowerCase() === userEmail) ||
      (t.assigneeName && userName && String(t.assigneeName).toLowerCase().includes(userName))
    );
  });

  readonly designerInProgressCount = computed(() =>
    this.designerAssignedTasks().filter((t) => t.status === 'IN_PROGRESS' || t.status === 'ACCEPTED').length
  );

  readonly designerRevisionCount = computed(() =>
    this.designerAssignedTasks().filter((t) => t.status === 'REVISION_REQUIRED').length
  );

  readonly designerApprovedCount = computed(() =>
    this.designerAssignedTasks().filter((t) => t.status === 'APPROVED' || t.status === 'PUBLISHED' || t.status === 'COMPLETED').length
  );

  // TELECALLER Metrics
  readonly telecallerAssignedLeads = computed(() => {
    const leads = this.leadService.leads();
    const user = this.authService.currentUser();
    const userId = String(user?.id || '');
    const userName = String(user?.fullName || '').toLowerCase().trim();

    return leads.filter((l) =>
      (l.assignedTo && String(l.assignedTo) === userId) ||
      (l.assigneeName && userName && String(l.assigneeName).toLowerCase().includes(userName))
    );
  });

  readonly telecallerPendingCallsCount = computed(() =>
    this.telecallerAssignedLeads().filter((l) => (l.status as string) === 'NEW' || (l.status as string) === 'CONTACTED' || (l.status as string) === 'INTERESTED' || !l.status).length
  );

  readonly telecallerQualifiedCount = computed(() =>
    this.telecallerAssignedLeads().filter((l) => l.status === 'QUALIFIED').length
  );

  readonly totalCallsLoggedCount = computed(() => this.leadService.calls().length);

  // BDM Metrics
  readonly bdmCreatedTasks = computed(() => {
    const tasks = this.taskService.tasks();
    const user = this.authService.currentUser();
    const userId = String(user?.id || '');
    const userEmail = String(user?.email || '').toLowerCase().trim();
    const userName = String(user?.fullName || '').toLowerCase().trim();

    return tasks.filter((t) =>
      t.creatorRole === 'BDM' ||
      (t.createdBy && String(t.createdBy) === userId) ||
      (userEmail && t.createdBy && String(t.createdBy).toLowerCase() === userEmail) ||
      (userName && t.creatorName && String(t.creatorName).toLowerCase().includes(userName))
    );
  });

  readonly bdmInProgressCount = computed(() =>
    this.bdmCreatedTasks().filter((t) => t.status === 'IN_PROGRESS' || t.status === 'ACCEPTED' || t.status === 'SUBMITTED' || t.status === 'RESUBMITTED' || t.status === 'UNDER_REVIEW').length
  );

  readonly bdmApprovedCount = computed(() =>
    this.bdmCreatedTasks().filter((t) => t.status === 'APPROVED' || t.status === 'PUBLISHED' || t.status === 'COMPLETED').length
  );

  readonly bdmRevisionCount = computed(() =>
    this.bdmCreatedTasks().filter((t) => t.status === 'REVISION_REQUIRED').length
  );

  // BDM-to-Designer Flow Monitor (for Admin & Digital Manager)
  readonly bdmDesignerFlowTasks = computed(() => {
    const tasks = this.taskService.tasks();
    return tasks.filter((t) =>
      t.creatorRole === 'BDM' ||
      (t.createdBy && String(t.createdBy).toLowerCase().includes('bdm')) ||
      (t.creatorName && String(t.creatorName).toLowerCase().includes('bdm'))
    );
  });

  readonly recentCampaigns = computed(() =>
    this.campaignService.campaigns().map((cmp) => ({
      id: cmp.id,
      name: cmp.name,
      status: cmp.status,
      leads: cmp.leadsCount || 0,
      spend: `₹${(cmp.spend || 0).toLocaleString()}`,
      cpl: `₹${(cmp.cpl || 0).toFixed(2)}`,
    }))
  );

  readonly fixedPackages = computed(() => {
    const tasks = this.taskService.tasks();
    const campaigns = this.campaignService.campaigns();
    const leads = this.leadService.leads();

    const packages = [
      {
        id: 'pkg_careermate',
        name: 'Careermate',
        icon: 'business_center',
        badge: 'Active Package',
        badgeClass: 'badge-blue',
      },
      {
        id: 'pkg_classmate',
        name: 'Classmate',
        icon: 'school',
        badge: 'Active Package',
        badgeClass: 'badge-emerald',
      },
      {
        id: 'pkg_jesus_messanger',
        name: 'Jesus the messanger',
        icon: 'campaign',
        badge: 'Active Package',
        badgeClass: 'badge-purple',
      },
    ];

    return packages.map((pkg) => {
      const key = pkg.name.toLowerCase();
      const pkgTasks = tasks.filter((t) => {
        const matchTitle = t.title.toLowerCase().includes(key);
        const matchDesc = (t.description || '').toLowerCase().includes(key);
        const matchCmp = (t.campaignName || '').toLowerCase().includes(key);
        let matchKeyword = false;
        if (key.includes('careermate')) matchKeyword = t.title.toLowerCase().includes('career');
        if (key.includes('classmate')) matchKeyword = t.title.toLowerCase().includes('class');
        if (key.includes('jesus')) matchKeyword = t.title.toLowerCase().includes('jesus') || (t.campaignName || '').toLowerCase().includes('outreach');

        return matchTitle || matchDesc || matchCmp || matchKeyword;
      });

      const pkgCmps = campaigns.filter((c) => c.name.toLowerCase().includes(key));
      const pkgLeads = leads.filter((l) => (l.campaignName || '').toLowerCase().includes(key) || (l.source || '').toLowerCase().includes(key));

      return {
        ...pkg,
        taskCount: pkgTasks.length,
        campaignCount: pkgCmps.length,
        leadCount: pkgLeads.length,
      };
    });
  });

  ngOnInit(): void {
    this.taskService.loadTasks();
    this.taskService.loadDesignerMetrics();
    this.campaignService.loadCampaigns().subscribe();
    this.leadService.loadLeads().subscribe();
    this.txnService.loadTransactions().subscribe();
  }
}

