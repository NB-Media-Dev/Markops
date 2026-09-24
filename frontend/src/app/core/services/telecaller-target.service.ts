import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from './notification.service';
import { AuthService } from './auth.service';
import { safeFetch } from '../utils/api-url.utils';

export interface CommonTargetQuota {
  dailyCallsTarget: number;
  dailyInterestedTarget: number;
  dailyDurationTargetSeconds: number;
  updatedBy: string;
  updatedAt: string;
}

export interface TelecallerTarget {
  id: string;
  telecallerId: string;
  telecallerName: string;
  telecallerEmail: string;
  dailyCallsTarget: number;
  dailyInterestedTarget: number;
  dailyDurationTargetSeconds: number;
  updatedBy: string;
  updatedAt: string;
}

export interface TargetProgressStatus {
  telecallerId: string;
  telecallerName: string;
  telecallerEmail: string;
  department: string;
  dailyCallsTarget: number;
  callsCompletedToday: number;
  callsAchievementPct: number;
  dailyInterestedTarget: number;
  interestedCompletedToday: number;
  status: 'ACHIEVED' | 'ON_TRACK' | 'BEHIND_TARGET' | 'CRITICAL_DEFICIT';
  lastEvaluatedAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class TelecallerTargetService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly http = inject(HttpClient);
  private readonly notifService = inject(NotificationService);
  private readonly authService = inject(AuthService);

  private readonly LOCAL_STORAGE_KEY = 'markops_telecaller_targets_store';
  private readonly COMMON_TARGET_KEY = 'markops_common_telecaller_target';

  private readonly DEFAULT_COMMON_TARGET: CommonTargetQuota = {
    dailyCallsTarget: 30,
    dailyInterestedTarget: 5,
    dailyDurationTargetSeconds: 3600,
    updatedBy: 'Marketing Manager',
    updatedAt: new Date().toISOString(),
  };

  private readonly DEFAULT_TARGETS: TelecallerTarget[] = [

  ];

  private readonly _commonTarget = signal<CommonTargetQuota>(this.DEFAULT_COMMON_TARGET);
  private readonly _targets = signal<TelecallerTarget[]>(this.DEFAULT_TARGETS);

  readonly commonTarget = computed(() => this._commonTarget());
  readonly targets = computed(() => this._targets());

  constructor() {
    if (this.isBrowser) {
      this.loadTargets();
    }
  }

  async loadTargets(): Promise<void> {
    if (!this.isBrowser) return;
    try {
      const res = await safeFetch('/api/telecaller-targets/common');
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.dailyCallsTarget === 'number') {
          this._commonTarget.set(data);
          this.syncTargetsWithCommon(data.dailyCallsTarget, data.dailyInterestedTarget, data.updatedBy);
          try {
            localStorage.setItem(this.COMMON_TARGET_KEY, JSON.stringify(data));
          } catch {}
          return;
        }
      }
    } catch (err) {
      console.log('Using cached telecaller targets:', err);
    }

    try {
      const cachedCommon = localStorage.getItem(this.COMMON_TARGET_KEY);
      if (cachedCommon) {
        const parsedCommon = JSON.parse(cachedCommon);
        if (parsedCommon && typeof parsedCommon.dailyCallsTarget === 'number') {
          this._commonTarget.set(parsedCommon);
        }
      }

      const cached = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const common = this._commonTarget();
          const synced = parsed.map((t) => ({
            ...t,
            dailyCallsTarget: common.dailyCallsTarget,
            dailyInterestedTarget: common.dailyInterestedTarget,
          }));
          this._targets.set(synced);
          return;
        }
      }
    } catch (err) {
      console.error('Error loading telecaller targets from storage:', err);
    }
    this.syncTargetsWithCommon(this.DEFAULT_COMMON_TARGET.dailyCallsTarget, this.DEFAULT_COMMON_TARGET.dailyInterestedTarget);
  }

  getTargetForTelecaller(telecallerId: string): TelecallerTarget {
    const common = this._commonTarget();
    const list = this._targets();
    const match = list.find((t) => t.telecallerId === telecallerId);

    return {
      id: match ? match.id : `tgt_${Math.random().toString(36).substring(2, 9)}`,
      telecallerId,
      telecallerName: match ? match.telecallerName : 'Telecaller',
      telecallerEmail: match ? match.telecallerEmail : 'telecaller@markops.io',
      dailyCallsTarget: common.dailyCallsTarget,
      dailyInterestedTarget: common.dailyInterestedTarget,
      dailyDurationTargetSeconds: common.dailyCallsTarget * 120,
      updatedBy: common.updatedBy,
      updatedAt: common.updatedAt,
    };
  }

  /**
   * Sets common target quota applicable for ALL telecallers across the system
   */
  setCommonTarget(dailyCallsTarget: number, dailyInterestedTarget: number = 5): void {
    const currentUser = this.authService.currentUser();
    const updatedBy = currentUser ? `${currentUser.fullName} (${currentUser.role})` : 'Marketing Manager';
    const callsTarget = Math.max(1, Number(dailyCallsTarget));
    const interestedTarget = Math.max(1, Number(dailyInterestedTarget));

    const updatedCommon: CommonTargetQuota = {
      dailyCallsTarget: callsTarget,
      dailyInterestedTarget: interestedTarget,
      dailyDurationTargetSeconds: callsTarget * 120,
      updatedBy,
      updatedAt: new Date().toISOString(),
    };

    this._commonTarget.set(updatedCommon);
    this.syncTargetsWithCommon(callsTarget, interestedTarget, updatedBy);

    if (this.isBrowser) {
      try {
        localStorage.setItem(this.COMMON_TARGET_KEY, JSON.stringify(updatedCommon));
      } catch (e) {
        console.error('Error saving common target to storage:', e);
      }

      safeFetch('/api/telecaller-targets/common', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCommon),
      }).catch((e) => console.log('Error syncing target to backend:', e));
    }
  }

  setTarget(
    telecallerId: string,
    dailyCallsTarget: number,
    dailyInterestedTarget: number = 5,
    telecallerName?: string,
    telecallerEmail?: string
  ): void {
    // When updating from UI, apply target commonly to all telecallers
    this.setCommonTarget(dailyCallsTarget, dailyInterestedTarget);
  }

  private syncTargetsWithCommon(callsTarget: number, interestedTarget: number, updatedBy?: string): void {
    const currentUser = this.authService.currentUser();
    const byName = updatedBy || (currentUser ? `${currentUser.fullName} (${currentUser.role})` : 'Marketing Manager');

    this._targets.update((list) => {
      if (list.length === 0) return this.DEFAULT_TARGETS;
      return list.map((t) => ({
        ...t,
        dailyCallsTarget: callsTarget,
        dailyInterestedTarget: interestedTarget,
        dailyDurationTargetSeconds: callsTarget * 120,
        updatedBy: byName,
        updatedAt: new Date().toISOString(),
      }));
    });

    this.saveToLocalStorage(this._targets());
  }

  /**
   * Scans today's logged calls and evaluates all telecallers against the common daily target quota.
   * Triggers warning notifications to Administrator and Marketing Manager for telecallers missing target.
   */
  async evaluateTargetsAndBroadcastNotifications(
    callsList: any[],
    usersList: any[]
  ): Promise<{ evaluatedCount: number; alertedCount: number; deficitTelecallers: string[] }> {
    const todayStr = new Date().toISOString().split('T')[0];
    const telecallers = usersList.filter((u) => u.role === 'TELECALLER');
    const telecallerList = telecallers.length > 0 ? telecallers : [
     ];

    const deficitTelecallers: string[] = [];
    const common = this._commonTarget();

    const adminUser = usersList.find((u) => u.role === 'ADMINISTRATOR') || { id: 'usr_admin_01' };
    const mktgManager = usersList.find((u) => u.role === 'MARKETING_MANAGER') || { id: 'usr_mktg_01' };

    for (const tc of telecallerList) {
      const todayCalls = callsList.filter((c) => {
        const isCaller = c.telecallerId === tc.id || c.telecallerName === tc.fullName;
        const isToday = c.calledAt && c.calledAt.startsWith(todayStr);
        return isCaller && isToday;
      });

      const callsCount = todayCalls.length;
      const achievementPct = Math.round((callsCount / common.dailyCallsTarget) * 100);

      if (callsCount < common.dailyCallsTarget) {
        deficitTelecallers.push(tc.fullName);

        const alertTitle = `Target Deficit Warning: ${tc.fullName}`;
        const alertMessage = `${tc.fullName} logged ${callsCount} / ${common.dailyCallsTarget} daily calls today (${achievementPct}% target achievement). Standard common goal of ${common.dailyCallsTarget} calls/day missed!`;

        const targetsToNotify = Array.from(new Set([adminUser.id, mktgManager.id]));

        for (const recipientId of targetsToNotify) {
          try {
            await safeFetch('/api/notifications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: recipientId,
                title: alertTitle,
                message: alertMessage,
                type: 'WARNING',
              }),
            });
          } catch (err) {
            console.log('API notification call fallback:', err);
          }
        }
      }
    }

    await this.notifService.loadNotifications();

    return {
      evaluatedCount: telecallerList.length,
      alertedCount: deficitTelecallers.length,
      deficitTelecallers,
    };
  }

  private saveToLocalStorage(targets: TelecallerTarget[]): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(targets));
    } catch (e) {
      console.error('Error saving telecaller targets to localStorage:', e);
    }
  }
}
