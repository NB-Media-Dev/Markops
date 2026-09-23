import { Component, OnInit, signal, computed, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TelecallerTargetService, TelecallerTarget, TargetProgressStatus } from '../../core/services/telecaller-target.service';
import { LeadTelecallingService } from '../../core/services/lead-telecalling.service';
import { UserManagementService } from '../../core/services/user-management.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-targets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './targets.component.html',
  styleUrl: './targets.component.scss',
})
export class TargetsComponent implements OnInit {
  @Input() embedded: boolean = false;

  readonly targetService = inject(TelecallerTargetService);
  readonly leadService = inject(LeadTelecallingService);
  readonly userService = inject(UserManagementService);
  readonly authService = inject(AuthService);
  readonly notifService = inject(NotificationService);

  readonly searchQuery = signal<string>('');
  readonly statusFilter = signal<string>('ALL');

  // Modal / Drawer signals
  readonly isEditModalOpen = signal<boolean>(false);
  readonly editingTelecallerId = signal<string | null>(null);
  readonly editingTelecallerName = signal<string>('');
  readonly editingTelecallerEmail = signal<string>('');

  targetInputCalls = 30;
  targetInputInterested = 5;

  readonly isEvaluating = signal<boolean>(false);
  readonly lastEvaluationSummary = signal<{ alertedCount: number; deficitTelecallers: string[] } | null>(null);

  readonly isManagerOrAdmin = computed(() => {
    const role = this.authService.currentUser()?.role;
    return role === 'ADMINISTRATOR' || role === 'MARKETING_MANAGER';
  });

  // Calculate real-time target status for each telecaller
  readonly telecallerProgressList = computed<TargetProgressStatus[]>(() => {
    const users = this.userService.users();
    const telecallers = users.filter((u) => u.role === 'TELECALLER');
    const allCalls = this.leadService.calls();
    const todayStr = new Date().toISOString().split('T')[0];

    const telecallerList = telecallers.length > 0 ? telecallers : [
      ];

    return telecallerList.map((tc) => {
      const target = this.targetService.getTargetForTelecaller(tc.id);

      const todayCalls = allCalls.filter((c) => {
        const isCaller = c.telecallerId === tc.id || c.telecallerName === tc.fullName;
        const isToday = c.calledAt && c.calledAt.startsWith(todayStr);
        return isCaller && isToday;
      });

      const callsCompletedToday = todayCalls.length;
      const interestedCompletedToday = todayCalls.filter((c) => c.outcome === 'INTERESTED' || c.outcome === 'QUALIFIED').length;

      const callsAchievementPct = Math.min(100, Math.round((callsCompletedToday / target.dailyCallsTarget) * 100));
      const interestedAchievementPct = Math.min(100, Math.round((interestedCompletedToday / target.dailyInterestedTarget) * 100));

      let status: 'ACHIEVED' | 'ON_TRACK' | 'BEHIND_TARGET' | 'CRITICAL_DEFICIT' = 'BEHIND_TARGET';

      if (callsCompletedToday >= target.dailyCallsTarget) {
        status = 'ACHIEVED';
      } else if (callsAchievementPct >= 70) {
        status = 'ON_TRACK';
      } else if (callsAchievementPct >= 40) {
        status = 'BEHIND_TARGET';
      } else {
        status = 'CRITICAL_DEFICIT';
      }

      return {
        telecallerId: tc.id,
        telecallerName: tc.fullName,
        telecallerEmail: tc.email,
        department: tc['department'] || 'Telecalling Operations',
        dailyCallsTarget: target.dailyCallsTarget,
        callsCompletedToday,
        callsAchievementPct,
        dailyInterestedTarget: target.dailyInterestedTarget,
        interestedCompletedToday,
        status,
        lastEvaluatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    });
  });

  // Single Target Progress for Logged-In Telecaller
  readonly myTargetProgress = computed(() => {
    const list = this.telecallerProgressList();
    const user = this.authService.currentUser();
    if (!user) return list[0] || null;
    return list.find((item) => item.telecallerId === user.id || item.telecallerEmail?.toLowerCase() === user.email?.toLowerCase()) || list[0] || null;
  });

  readonly filteredProgressList = computed(() => {
    const list = this.telecallerProgressList();
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.statusFilter();

    return list.filter((item) => {
      const matchesSearch =
        !query ||
        item.telecallerName.toLowerCase().includes(query) ||
        item.telecallerEmail.toLowerCase().includes(query) ||
        item.department.toLowerCase().includes(query);

      let matchesStatus = true;
      if (filter !== 'ALL') {
        matchesStatus = item.status === filter;
      }

      return matchesSearch && matchesStatus;
    });
  });

  // Summary Metrics
  readonly summaryKpis = computed(() => {
    const list = this.telecallerProgressList();
    const total = list.length;
    const achieved = list.filter((item) => item.status === 'ACHIEVED').length;
    const onTrack = list.filter((item) => item.status === 'ON_TRACK').length;
    const behind = list.filter((item) => item.status === 'BEHIND_TARGET' || item.status === 'CRITICAL_DEFICIT').length;

    const avgAchievement = total > 0 ? Math.round(list.reduce((acc, curr) => acc + curr.callsAchievementPct, 0) / total) : 0;

    return {
      totalTelecallers: total,
      achievedCount: achieved,
      onTrackCount: onTrack,
      deficitCount: behind,
      overallComplianceRatePct: avgAchievement,
    };
  });

  ngOnInit(): void {
    this.leadService.loadCalls().subscribe();
    this.userService.loadUsersFromDatabase();
    this.targetService.loadTargets();
  }

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  setFilter(filter: string): void {
    this.statusFilter.set(filter);
  }

  setPreset(calls: number): void {
    this.targetInputCalls = calls;
    this.targetInputInterested = Math.max(2, Math.round(calls * 0.15));
  }

  openCommonModal(): void {
    const common = this.targetService.commonTarget();
    this.targetInputCalls = common.dailyCallsTarget;
    this.targetInputInterested = common.dailyInterestedTarget;
    this.isEditModalOpen.set(true);
  }

  openEditModal(item?: TargetProgressStatus): void {
    this.openCommonModal();
  }

  closeEditModal(): void {
    this.isEditModalOpen.set(false);
  }

  saveTarget(): void {
    this.targetService.setCommonTarget(
      this.targetInputCalls,
      this.targetInputInterested
    );
    this.closeEditModal();
  }

  async runTargetComplianceCheck(): Promise<void> {
    this.isEvaluating.set(true);
    const calls = this.leadService.calls();
    const users = this.userService.users();

    const res = await this.targetService.evaluateTargetsAndBroadcastNotifications(calls, users);
    this.lastEvaluationSummary.set({
      alertedCount: res.alertedCount,
      deficitTelecallers: res.deficitTelecallers,
    });
    this.isEvaluating.set(false);
  }
}
