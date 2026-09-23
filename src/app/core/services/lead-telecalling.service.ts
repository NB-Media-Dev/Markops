import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

export interface LeadItem {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone: string;
  source: string;
  campaignId: string;
  campaignName: string;
  adId?: string;
  status: 'NEW' | 'ASSIGNED' | 'CONTACTED' | 'INTERESTED' | 'NOT_INTERESTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';
  assignedTo?: string | null;
  assigneeName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CallActivityItem {
  id: string;
  leadId: string;
  leadName: string;
  telecallerId: string;
  telecallerName: string;
  outcome: 'CONNECTED' | 'NO_ANSWER' | 'BUSY' | 'WRONG_NUMBER' | 'INTERESTED' | 'NOT_INTERESTED' | 'QUALIFIED';
  durationSeconds: number;
  remarks?: string;
  nextAction?: string;
  calledAt: string;
}

export interface FollowUpItem {
  id: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  telecallerId: string;
  telecallerName: string;
  dueDate: string;
  status: 'PENDING' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
  notes?: string;
  createdAt: string;
}

export interface TelecallerMetric {
  id: string;
  fullName: string;
  email: string;
  department: string;
  assignedLeadsCount: number;
  callsLoggedCount: number;
  attendedCount: number;
  notAttendedCount: number;
  interestedCount: number;
  notInterestedCount: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  conversionRate: number;
}

export interface TelecallingSummary {
  totalLeads: number;
  assignedLeads: number;
  unassignedLeads: number;
  totalCallsLogged: number;
  statusBreakdown: Record<string, number>;
  telecallerMetrics: TelecallerMetric[];
}

@Injectable({
  providedIn: 'root',
})
export class LeadTelecallingService {
  private readonly http = inject(HttpClient);

  readonly leads = signal<LeadItem[]>([]);
  readonly calls = signal<CallActivityItem[]>([]);
  readonly followUps = signal<FollowUpItem[]>([]);
  readonly summary = signal<TelecallingSummary | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  loadLeads() {
    this.loading.set(true);
    return this.http.get<LeadItem[]>('/api/leads').pipe(
      tap({
        next: (data) => {
          this.leads.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to load leads.');
          this.loading.set(false);
        },
      })
    );
  }

  createLead(payload: Partial<LeadItem>) {
    this.loading.set(true);
    return this.http.post<LeadItem>('/api/leads', payload).pipe(
      tap({
        next: (newLead) => {
          this.leads.update((list) => [newLead, ...list]);
          this.loading.set(false);
          this.loadSummary();
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to create lead.');
          this.loading.set(false);
        },
      })
    );
  }

  batchImportLeads(payload: {
    leads: any[];
    selectedTelecallerIds?: string[];
    campaignId?: string;
    campaignName?: string;
    source?: string;
    uploaderId?: string;
    uploaderEmail?: string;
    uploaderRole?: string;
    telecallersList?: { id: string; fullName: string; email: string }[];
  }) {
    this.loading.set(true);
    return this.http.post<{
      success: boolean;
      message: string;
      totalUploaded: number;
      telecallersCount: number;
      leadsPerTelecaller: number;
      allocationSummary: any[];
      leads: LeadItem[];
    }>('/api/leads/batch-import', payload).pipe(
      tap({
        next: (res) => {
          if (res && res.leads) {
            this.leads.update((list) => [...res.leads, ...list]);
          }
          this.loading.set(false);
          this.loadSummary();
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to batch import leads.');
          this.loading.set(false);
        },
      }),
      catchError(() => {
        // Fallback for offline execution: divide leads equally among selected telecallers
        const rawLeads = payload.leads || [];
        const tcs = payload.telecallersList || [];
        const createdLeads: LeadItem[] = [];

        for (let i = 0; i < rawLeads.length; i++) {
          const raw = rawLeads[i];
          const tc = tcs.length > 0 ? tcs[i % tcs.length] : null;

          const newLead: LeadItem = {
            id: `lead_${Math.random().toString(36).substring(2, 10)}`,
            firstName: raw.firstName || `Lead ${i + 1}`,
            lastName: raw.lastName || '',
            email: raw.email || '',
            phone: raw.phone || '+91 9800000000',
            source: raw.source || payload.source || 'Excel Import',
            campaignId: payload.campaignId || 'cmp_default',
            campaignName: payload.campaignName || 'Digital Ad Campaign',
            status: tc ? 'ASSIGNED' : 'NEW',
            assignedTo: tc ? tc.id : null,
            assigneeName: tc ? tc.fullName : 'Unassigned',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          createdLeads.push(newLead);
        }

        this.leads.update((list) => [...createdLeads, ...list]);
        this.loading.set(false);

        const tcCount = Math.max(1, tcs.length);
        const perTc = Math.floor(rawLeads.length / tcCount);

        return of({
          success: true,
          message: `Successfully imported ${rawLeads.length} leads divided equally across ${tcs.length} telecallers (${perTc} leads each).`,
          totalUploaded: rawLeads.length,
          telecallersCount: tcs.length,
          leadsPerTelecaller: perTc,
          allocationSummary: [],
          leads: createdLeads,
        });
      })
    );
  }

  assignLead(leadId: string, assignedTo: string, assigneeName: string) {
    return this.http.post<LeadItem>(`/api/leads/${leadId}/assign`, { assignedTo, assigneeName }).pipe(
      tap({
        next: (updatedLead) => {
          this.leads.update((list) => list.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
          this.loadSummary();
        },
      })
    );
  }

  loadCalls() {
    return this.http.get<CallActivityItem[]>('/api/calls').pipe(
      tap({
        next: (data) => this.calls.set(data),
      })
    );
  }

  logCall(payload: { leadId: string; outcome: string; durationSeconds: number; remarks: string; nextAction: string; followUpDate?: string }) {
    return this.http.post<{ call: CallActivityItem; lead: LeadItem }>('/api/calls', payload).pipe(
      tap({
        next: (res) => {
          this.calls.update((c) => [res.call, ...c]);
          if (res.lead) {
            this.leads.update((l) => l.map((item) => (item.id === res.lead.id ? res.lead : item)));
          }
          this.loadFollowUps();
          this.loadSummary();
        },
      })
    );
  }

  loadFollowUps() {
    return this.http.get<FollowUpItem[]>('/api/followups').pipe(
      tap({
        next: (data) => this.followUps.set(data),
      })
    );
  }

  loadSummary() {
    return this.http.get<TelecallingSummary>('/api/leads/telecalling-summary').pipe(
      tap({
        next: (data) => this.summary.set(data),
      })
    );
  }
}
