import { Component, inject, OnInit, signal, computed, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LeadTelecallingService, LeadItem, CallActivityItem } from '../../core/services/lead-telecalling.service';
import { UserManagementService } from '../../core/services/user-management.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-telecalling',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './telecalling.component.html',
  styleUrl: './telecalling.component.scss',
})
export class TelecallingComponent implements OnInit {
  @Input() embedded: boolean = false;

  readonly leadService = inject(LeadTelecallingService);
  readonly userService = inject(UserManagementService);
  readonly authService = inject(AuthService);

  readonly selectedLeadForCall = signal<LeadItem | null>(null);
  readonly queueFilter = signal<'MY_LEADS' | 'ALL_LEADS'>('MY_LEADS');

  readonly isAdmin = computed(() => this.authService.currentUser()?.role === 'ADMINISTRATOR');
  readonly isManager = computed(() => this.authService.currentUser()?.role === 'MARKETING_MANAGER');
  readonly isTelecaller = computed(() => this.authService.currentUser()?.role === 'TELECALLER');
  readonly canLogCalls = computed(() => {
    const role = this.authService.currentUser()?.role;
    return role === 'TELECALLER' || role === 'DIGITAL_MARKETING';
  });

  callOutcome = 'CONNECTED';
  callDuration = 120;
  callRemarks = '';
  nextAction = 'Follow-up Call Scheduled';
  followUpDate = '';

  // Dynamic Telecaller Performance breakdown per telecaller
  readonly telecallerPerformanceList = computed(() => {
    const summary = this.leadService.summary();
    if (summary && summary.telecallerMetrics && summary.telecallerMetrics.length > 0) {
      return summary.telecallerMetrics;
    }

    const allUsers = this.userService.users();
    const telecallers = allUsers.filter((u) => u.role === 'TELECALLER');
    const allLeads = this.leadService.leads();
    const allCalls = this.leadService.calls();

    const telecallerList = telecallers.length > 0 ? telecallers : [
     ];

    return telecallerList.map((tc) => {
      const assigned = allLeads.filter((l) => l.assignedTo === tc.id);
      const calls = allCalls.filter((c) => c.telecallerId === tc.id || c.telecallerName === tc.fullName);

      const attended = calls.filter((c) => ['CONNECTED', 'INTERESTED', 'QUALIFIED', 'NOT_INTERESTED'].includes(c.outcome));
      const notAttended = calls.filter((c) => ['NO_ANSWER', 'BUSY', 'WRONG_NUMBER'].includes(c.outcome));
      const interested = calls.filter((c) => ['INTERESTED', 'QUALIFIED'].includes(c.outcome));
      const notInterested = calls.filter((c) => c.outcome === 'NOT_INTERESTED');

      const totalDurationSeconds = calls.reduce((acc, c) => acc + (Number(c.durationSeconds) || 0), 0);
      const avgDurationSeconds = calls.length > 0 ? Math.round(totalDurationSeconds / calls.length) : 0;

      return {
        id: tc.id,
        fullName: tc.fullName,
        email: tc.email,
        department: tc['department'] || 'Telecalling Sales',
        assignedLeadsCount: assigned.length,
        callsLoggedCount: calls.length,
        attendedCount: attended.length,
        notAttendedCount: notAttended.length,
        interestedCount: interested.length,
        notInterestedCount: notInterested.length,
        totalDurationSeconds,
        avgDurationSeconds,
        conversionRate: assigned.length > 0 ? Math.round((interested.length / assigned.length) * 100) : (calls.length > 0 ? Math.round((interested.length / calls.length) * 100) : 0),
      };
    });
  });

  // Filter queue based on logged in telecaller / role
  readonly assignedLeads = computed(() => {
    const all = this.leadService.leads();
    const user = this.authService.currentUser();
    const filter = this.queueFilter();

    if (filter === 'ALL_LEADS' || !user || user.role === 'ADMINISTRATOR' || user.role === 'DIGITAL_MARKETING') {
      return all;
    }
    return all.filter(
      (l) =>
        (l.assignedTo && l.assignedTo === user.id) ||
        (l.assignedTo && user.email && l.assignedTo.toLowerCase() === user.email.toLowerCase()) ||
        (l.assigneeName && user.fullName && l.assigneeName.toLowerCase().includes(user.fullName.toLowerCase()))
    );
  });

  // Logged-in Telecaller statistics
  readonly myStats = computed(() => {
    const user = this.authService.currentUser();
    const calls = this.leadService.calls();
    const myLeads = this.assignedLeads();

    const myCalls = calls.filter((c) => c.telecallerId === (user?.id || 'usr_admin_01'));
    const interested = myCalls.filter((c) => c.outcome === 'INTERESTED' || c.outcome === 'QUALIFIED').length;
    const notInterested = myCalls.filter((c) => c.outcome === 'NOT_INTERESTED').length;
    const attended = myCalls.filter((c) => ['CONNECTED', 'INTERESTED', 'QUALIFIED', 'NOT_INTERESTED'].includes(c.outcome)).length;
    const notAttended = myCalls.filter((c) => ['NO_ANSWER', 'BUSY', 'WRONG_NUMBER'].includes(c.outcome)).length;

    return {
      assignedCount: myLeads.length,
      callsCount: myCalls.length,
      interestedCount: interested,
      notInterestedCount: notInterested,
      attendedCount: attended,
      notAttendedCount: notAttended,
    };
  });

  // Team Summary Statistics for Admin/Manager Top KPI Row
  readonly teamSummaryKpis = computed(() => {
    const list = this.telecallerPerformanceList();
    const calls = this.leadService.calls();
    const leads = this.leadService.leads();

    const totalCalls = calls.length;
    const interested = calls.filter((c) => c.outcome === 'INTERESTED' || c.outcome === 'QUALIFIED').length;
    const avgConv = list.length > 0 ? Math.round(list.reduce((acc, tc) => acc + tc.conversionRate, 0) / list.length) : 0;

    return {
      activeTelecallers: list.length,
      totalCalls,
      totalLeads: leads.length,
      interestedLeads: interested,
      avgConversionRate: avgConv,
    };
  });

  ngOnInit() {
    this.leadService.loadLeads().subscribe();
    this.leadService.loadCalls().subscribe();
    this.leadService.loadFollowUps().subscribe();
    this.leadService.loadSummary().subscribe();
    this.userService.loadUsersFromDatabase();

    if (this.isAdmin()) {
      this.queueFilter.set('ALL_LEADS');
    }
  }

  setDurationPreset(seconds: number) {
    this.callDuration = seconds;
  }

  openCallDrawer(lead: LeadItem) {
    if (!this.canLogCalls()) {
      alert('Access Restricted: Administrator role is in View-Only mode and cannot enter call logs.');
      return;
    }
    this.selectedLeadForCall.set(lead);
    this.callOutcome = 'CONNECTED';
    this.callDuration = 120;
    this.callRemarks = '';
    this.nextAction = 'Follow-up Call Scheduled';
    this.followUpDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  }

  closeDrawer() {
    this.selectedLeadForCall.set(null);
  }

  submitCallLog() {
    if (!this.canLogCalls()) {
      alert('Access Restricted: Administrator role is in View-Only mode and cannot enter call logs.');
      return;
    }
    const lead = this.selectedLeadForCall();
    if (!lead) return;

    this.leadService
      .logCall({
        leadId: lead.id,
        outcome: this.callOutcome,
        durationSeconds: Number(this.callDuration) || 0,
        remarks: this.callRemarks,
        nextAction: this.nextAction,
        followUpDate: this.followUpDate,
      })
      .subscribe({
        next: () => {
          this.closeDrawer();
        },
        error: (err) => {
          console.error('Failed to log call activity:', err);
        },
      });
  }
}


