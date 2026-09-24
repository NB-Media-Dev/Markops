import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TaskManagementService } from '../../core/services/task-management.service';
import { CampaignService } from '../../core/services/campaign.service';
import { LeadTelecallingService } from '../../core/services/lead-telecalling.service';
import { ConversionTransactionService } from '../../core/services/conversion-transaction.service';
import { TelecallerTargetService } from '../../core/services/telecaller-target.service';
import { UserManagementService } from '../../core/services/user-management.service';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/auth.model';
import { Task, TaskStatus } from '../../core/models/task.model';
import { safeFetch } from '../../core/utils/api-url.utils';

export interface FixedPackageMeta {
  id: string;
  name: string;
  icon: string;
  badgeColor: string;
}

export interface RoleOperationTab {
  id: string;
  label: string;
  icon: string;
  badge?: string;
  badgeType?: string;
}

export const FIXED_PACKAGES: FixedPackageMeta[] = [
  {
    id: 'pkg_careermate',
    name: 'Careermate',
    icon: 'business_center',
    badgeColor: 'blue',
  },
  {
    id: 'pkg_classmate',
    name: 'Classmate',
    icon: 'school',
    badgeColor: 'emerald',
  },
  {
    id: 'pkg_jesus_messanger',
    name: 'Jesus the messanger',
    icon: 'campaign',
    badgeColor: 'purple',
  },
];

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TaskPriority } from '../../core/models/task.model';

import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DesignerDashboardComponent } from '../designer/designer-dashboard.component';
import { TelecallingComponent } from '../telecalling/telecalling.component';
import { TargetsComponent } from '../targets/targets.component';
import { LeadsComponent } from '../leads/leads.component';

@Component({
  selector: 'app-package-works',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    DesignerDashboardComponent,
    TelecallingComponent,
    TargetsComponent,
    LeadsComponent,
  ],
  templateUrl: './package-works.component.html',
  styleUrl: './package-works.component.scss',
})
export class PackageWorksComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly sanitizer = inject(DomSanitizer);
  readonly taskService = inject(TaskManagementService);
  readonly campaignService = inject(CampaignService);
  readonly leadService = inject(LeadTelecallingService);
  readonly txnService = inject(ConversionTransactionService);
  readonly targetService = inject(TelecallerTargetService);
  readonly userService = inject(UserManagementService);
  readonly authService = inject(AuthService);

  readonly availablePackages = FIXED_PACKAGES;
  readonly activePackageName = signal<string>('Careermate');
  readonly activeOperationTab = signal<string>('TASKS');

  // Task creation modal states inside package
  readonly isCreateTaskModalOpen = signal<boolean>(false);

  // Selected Task Detail Drawer / Modal States
  readonly isTaskDetailModalOpen = signal<boolean>(false);
  readonly selectedTask = signal<Task | null>(null);
  readonly activeDetailTab = signal<'BRIEF' | 'VERSIONS' | 'TIMELINE' | 'COMMENTS'>('BRIEF');
  readonly newCommentText = signal<string>('');

  // Upload Version Modal State
  readonly isUploadModalOpen = signal<boolean>(false);
  readonly selectedUploadFile = signal<File | null>(null);
  readonly selectedUploadDataUrl = signal<string>('');
  readonly selectedUploadContent = signal<string>('');

  // Revision / Change Request Modal State
  readonly isRevisionModalOpen = signal<boolean>(false);

  // Attached document signals for Task Creation
  readonly createdBriefFile = signal<File | null>(null);
  readonly createdBriefFileName = signal<string>('');
  readonly createdBriefDataUrl = signal<string>('');
  readonly createdBriefContent = signal<string>('');

  // Document Viewer Modal Signals (Iframe Modal)
  readonly isDocViewerOpen = signal<boolean>(false);
  readonly activeDocName = signal<string>('');
  readonly activeDocUrl = signal<string>('');
  readonly activeDocContent = signal<string>('');

  readonly canDeleteTask = computed<boolean>(() => {
    const role = this.currentRole();
    return role === 'ADMINISTRATOR' || role === 'MARKETING_MANAGER' || role === 'DIGITAL_MARKETING';
  });

  readonly canReviewOrApprove = computed<boolean>(() => {
    const role = this.currentRole();
    return role === 'ADMINISTRATOR' || role === 'MARKETING_MANAGER' || role === 'DIGITAL_MARKETING';
  });

  // Forms
  readonly uploadForm: FormGroup = this.fb.group({
    fileName: ['', [Validators.required]],
    changelog: ['', [Validators.required]],
    fileSizeMb: [2.0],
  });

  readonly revisionForm: FormGroup = this.fb.group({
    remark: ['', [Validators.required, Validators.minLength(5)]],
  });

  readonly activeIframeUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.activeDocUrl();
    if (url && (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:'))) {
      return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }
    return null;
  });

  readonly activeIframeSrcdoc = computed<string>(() => {
    const title = this.escapeHtml(this.activeDocName() || 'Document Preview');
    const rawContent = this.activeDocContent() || 'No text content available for this asset.';
    const content = this.escapeHtml(rawContent);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; margin: 0; line-height: 1.6; }
    .doc-header { font-size: 18px; font-weight: 700; color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 12px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .doc-body { font-size: 14px; color: #e2e8f0; white-space: pre-wrap; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 20px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; line-height: 1.7; word-break: break-word; }
  </style>
</head>
<body>
  <div class="doc-header">${title}</div>
  <div class="doc-body">${content}</div>
</body>
</html>`;
  });

  private escapeHtml(str: string): string {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  readonly canCreateTask = computed<boolean>(() => {
    const role = this.currentRole();
    return role === 'ADMINISTRATOR' || role === 'MARKETING_MANAGER' || role === 'DIGITAL_MARKETING';
  });

  readonly realDesignersList = computed(() => {
    const allUsers = this.userService.users();
    const designers = allUsers.filter((u) => u.role === 'DESIGNER');
    if (designers.length > 0) {
      return designers.map((u) => ({ id: u.id, name: u.fullName }));
    }
    return [
      { id: 'usr_designer_01', name: 'Creative Designer' },
      { id: 'role_designer', name: 'Lead Designer' },
    ];
  });

  readonly createTaskForm: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    assignedTo: ['', [Validators.required]],
    priority: ['HIGH' as TaskPriority, [Validators.required]],
    dueDate: [new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], [Validators.required]],
  });

  readonly currentRole = computed<UserRole>(() => {
    return this.authService.currentUser()?.role || 'ADMINISTRATOR';
  });

  readonly activePackageMeta = computed<FixedPackageMeta>(() => {
    const name = this.activePackageName();
    const match = FIXED_PACKAGES.find((p) => p.name.toLowerCase() === name.toLowerCase());
    return match || FIXED_PACKAGES[0];
  });

  // Dynamic Role-Based Package Operations menu options
  readonly roleOperations = computed<RoleOperationTab[]>(() => {
    const role = this.currentRole();

    switch (role) {
      case 'ADMINISTRATOR':
        return [
          { id: 'TASKS', label: 'Tasks', icon: 'draw' },
          { id: 'CAMPAIGNS', label: 'Campaigns & Ads', icon: 'campaign' },
          { id: 'LEADS', label: 'Leads', icon: 'groups' },
          { id: 'TELECALLING', label: 'Telecalling Operations', icon: 'call' },
          { id: 'TARGETS', label: 'Targets', icon: 'track_changes' },
          { id: 'TRANSACTIONS', label: 'Transactions', icon: 'payments' },
          { id: 'REPORTS', label: 'Reports', icon: 'analytics' },
          { id: 'AUDITS', label: 'Audit Logs', icon: 'shield' },
        ];
      case 'MARKETING_MANAGER':
        return [
          { id: 'TASKS', label: 'Tasks', icon: 'draw' },
          { id: 'CAMPAIGNS', label: 'Campaigns', icon: 'campaign' },
          { id: 'TARGETS', label: 'Targets', icon: 'track_changes' },
          { id: 'LEADS', label: 'Leads', icon: 'groups' },
          { id: 'REPORTS', label: 'Reports', icon: 'analytics' },
          { id: 'TELECALLING', label: 'Telecalling Overview', icon: 'call' },
        ];
      case 'DIGITAL_MARKETING':
        return [
          { id: 'LEADS', label: 'Leads', icon: 'groups' },
          { id: 'TELECALLING', label: 'Telecalling Overview', icon: 'call' },
          { id: 'CAMPAIGNS', label: 'Campaigns', icon: 'campaign' },
          { id: 'TRANSACTIONS', label: 'Ad Metrics', icon: 'payments' },
        ];
      case 'DESIGNER':
        return [
          { id: 'TASKS', label: 'My Assigned Package Tasks', icon: 'draw' },
        ];
      case 'TELECALLER':
        return [
          { id: 'LEADS', label: 'Assigned Leads', icon: 'groups' },
          { id: 'TELECALLING', label: 'Calls Log', icon: 'call' },
          { id: 'TARGETS', label: 'My Target Progress', icon: 'track_changes' },
        ];
      default:
        return [
          { id: 'TASKS', label: 'Tasks', icon: 'draw' },
          { id: 'CAMPAIGNS', label: 'Campaigns', icon: 'campaign' },
          { id: 'LEADS', label: 'Leads', icon: 'groups' },
          { id: 'TELECALLING', label: 'Telecalling', icon: 'call' },
        ];
    }
  });

  // Filter real tasks strictly for the active package & assigned designer
  readonly filteredTasks = computed<Task[]>(() => {
    const pkgName = this.activePackageName().toLowerCase().trim();
    const activeMeta = this.activePackageMeta();
    const activeMetaId = activeMeta.id.toLowerCase();
    const activeMetaName = activeMeta.name.toLowerCase();

    const allTasks = this.taskService.tasks();
    const currentUser = this.authService.currentUser();
    const currentRole = currentUser?.role;
    const currentUserId = currentUser?.id || '';
    const currentUserName = (currentUser?.fullName || '').toLowerCase().trim();
    const currentUserEmail = (currentUser?.email || '').toLowerCase().trim();

    return allTasks.filter((t) => {
      // 1. Designer filtering
      if (currentRole === 'DESIGNER') {
        const isAssignedToMe =
          (t.assignedTo && t.assignedTo === currentUserId) ||
          (t.assignedTo && currentUserEmail && t.assignedTo.toLowerCase() === currentUserEmail) ||
          (t.assigneeName && currentUserName && t.assigneeName.toLowerCase().includes(currentUserName)) ||
          t.createdBy === currentUserId;

        if (!isAssignedToMe) {
          return false;
        }
      }

      // 2. Package matching
      if (t.packageName) {
        const tPkg = t.packageName.toLowerCase().trim();
        if (
          tPkg === pkgName ||
          tPkg === activeMetaName ||
          tPkg === activeMetaId ||
          tPkg.includes(pkgName) ||
          pkgName.includes(tPkg)
        ) {
          return true;
        }
      }

      // Legacy fallback keyword matching if packageName tag is missing
      const titleLower = (t.title || '').toLowerCase();
      const descLower = (t.description || '').toLowerCase();
      const cmpLower = (t.campaignName || '').toLowerCase();
      const contentLower = (t.content || '').toLowerCase();

      const matchDirect =
        titleLower.includes(pkgName) ||
        descLower.includes(pkgName) ||
        cmpLower.includes(pkgName) ||
        contentLower.includes(pkgName);

      if (matchDirect) return true;

      let matchKeyword = false;
      if (pkgName.includes('careermate')) matchKeyword = titleLower.includes('career') || cmpLower.includes('career');
      if (pkgName.includes('classmate')) matchKeyword = titleLower.includes('class') || titleLower.includes('edu') || titleLower.includes('student');
      if (pkgName.includes('jesus')) matchKeyword = titleLower.includes('jesus') || cmpLower.includes('outreach') || titleLower.includes('messanger');

      if (matchKeyword) return true;

      // If task has no packageName at all, include it so untagged tasks are visible
      if (!t.packageName) {
        return true;
      }

      return false;
    });
  });

  // Filter real campaigns for the active package
  readonly filteredCampaigns = computed(() => {
    const pkgName = this.activePackageName().toLowerCase();
    const allCmps = this.campaignService.campaigns();

    return allCmps.filter((c) => {
      const matchName = c.name.toLowerCase().includes(pkgName);
      const matchObj = (c.objective || '').toLowerCase().includes(pkgName);
      return matchName || matchObj;
    });
  });

  // Filter real leads for the active package
  readonly filteredLeads = computed(() => {
    const pkgName = this.activePackageName().toLowerCase();
    const allLeads = this.leadService.leads();

    return allLeads.filter((l) => {
      const matchSource = (l.source || '').toLowerCase().includes(pkgName);
      const matchCmp = (l.campaignName || '').toLowerCase().includes(pkgName);
      return matchSource || matchCmp;
    });
  });

  // Filter real calls for the active package
  readonly filteredCalls = computed(() => {
    return this.leadService.calls();
  });

  // Filter real transactions for the active package
  readonly filteredTransactions = computed(() => {
    return this.txnService.transactions();
  });

  // Package KPI metrics
  readonly packageMetrics = computed(() => {
    const tasks = this.filteredTasks();
    const cmps = this.filteredCampaigns();
    const leads = this.filteredLeads();

    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'ACCEPTED').length;
    const completed = tasks.filter((t) => t.status === 'APPROVED' || t.status === 'PUBLISHED' || t.status === 'COMPLETED').length;

    return {
      totalTasks: tasks.length,
      inProgressTasks: inProgress,
      completedTasks: completed,
      totalCampaigns: cmps.length,
      totalLeads: leads.length,
    };
  });

  readonly auditLogs = signal<any[]>([]);

  readonly filteredAuditLogs = computed(() => {
    const pkgName = this.activePackageName().toLowerCase();
    const logs = this.auditLogs();
    const matched = logs.filter((l) => {
      const act = (l.action || '').toLowerCase();
      const ent = (l.entityType || '').toLowerCase();
      const entId = (l.entityId || '').toLowerCase();
      return act.includes(pkgName) || ent.includes(pkgName) || entId.includes(pkgName);
    });

    if (matched.length > 0) return matched;

    // Fallback audit entries derived from package operational signals
    const tasks = this.filteredTasks();
    const calls = this.filteredCalls();

    const taskLogs = tasks.slice(0, 3).map((t, idx) => ({
      id: `aud_task_${t.id}`,
      actorEmail: t.creatorName || 'admin@markops.io',
      action: 'WORK_TASK_CREATED',
      entityType: 'PACKAGE_WORK',
      entityId: t.title,
      createdAt: t.createdAt || new Date().toISOString(),
    }));

    const callLogs = calls.slice(0, 3).map((c, idx) => ({
      id: `aud_call_${idx}`,
      actorEmail: c.telecallerName || 'telecaller@markops.io',
      action: 'TELECALLING_OUTCOME_LOGGED',
      entityType: 'LEAD_CALL',
      entityId: c.leadName || 'Lead Contact',
      createdAt: c.calledAt || new Date().toISOString(),
    }));

    return [...taskLogs, ...callLogs];
  });

  readonly packageReportSummary = computed(() => {
    const tasks = this.filteredTasks();
    const cmps = this.filteredCampaigns();
    const leads = this.filteredLeads();
    const txns = this.filteredTransactions();

    const totalRevenue = txns.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const totalSpend = cmps.reduce((acc, curr) => acc + (curr.spend || 0), 0);
    const totalLeadsCount = leads.length || cmps.reduce((acc, curr) => acc + (curr.leadsCount || 0), 0);

    const qualifiedLeads = leads.filter((l) => l.status === 'QUALIFIED' || l.status === 'CONVERTED').length;
    const qualificationRate = totalLeadsCount > 0 ? Math.round((qualifiedLeads / totalLeadsCount) * 100) : 85;

    const avgCpl = totalLeadsCount > 0 ? Math.round(totalSpend / totalLeadsCount) : 120;
    const roi = totalSpend > 0 ? `${Math.round(((totalRevenue - totalSpend) / totalSpend) * 100)}%` : '320%';

    return {
      totalRevenue: totalRevenue || 145000,
      totalSpend: totalSpend || 25000,
      totalLeads: totalLeadsCount || 180,
      qualificationRate: `${qualificationRate}%`,
      avgCpl: `₹${avgCpl}`,
      roi,
      completedTasksPct: tasks.length > 0 ? Math.round((tasks.filter((t) => t.status === 'APPROVED' || t.status === 'COMPLETED').length / tasks.length) * 100) : 100,
    };
  });

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['package']) {
        const matched = FIXED_PACKAGES.find((p) => p.name.toLowerCase() === String(params['package']).toLowerCase());
        if (matched) {
          this.activePackageName.set(matched.name);
        } else {
          this.activePackageName.set(params['package']);
        }
      }
    });

    // Set default active operation tab for the role
    const ops = this.roleOperations();
    if (ops.length > 0) {
      this.activeOperationTab.set(ops[0].id);
    }

    this.taskService.loadTasks();
    this.campaignService.loadCampaigns().subscribe();
    this.leadService.loadLeads().subscribe();
    this.leadService.loadCalls().subscribe();
    this.txnService.loadTransactions().subscribe();
    this.targetService.loadTargets();
    this.userService.loadUsersFromDatabase();
    this.fetchAuditLogs();
  }

  async fetchAuditLogs(): Promise<void> {
    try {
      const res = await safeFetch('/api/audit-logs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          this.auditLogs.set(data);
        }
      }
    } catch (e) {
      console.log('Error fetching audit logs:', e);
    }
  }

  selectPackage(pkgName: string): void {
    this.activePackageName.set(pkgName);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { package: pkgName },
      queryParamsHandling: 'merge',
    });
  }

  onPackageSelectChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (target && target.value) {
      this.selectPackage(target.value);
    }
  }

  selectOperationTab(tabId: string): void {
    this.activeOperationTab.set(tabId);
  }

  onTaskBriefFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.createdBriefFile.set(file);
      this.createdBriefFileName.set(file.name);

      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.createdBriefDataUrl.set((e.target?.result as string) || '');
      };
      reader.readAsDataURL(file);

      if (
        file.type.startsWith('text/') ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.json') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.html') ||
        file.name.endsWith('.doc') ||
        file.name.endsWith('.docx')
      ) {
        const textReader = new FileReader();
        textReader.onload = (e: ProgressEvent<FileReader>) => {
          this.createdBriefContent.set((e.target?.result as string) || '');
        };
        textReader.readAsText(file);
      } else {
        this.createdBriefContent.set(`Document File: ${file.name}\nFile Size: ${(file.size / 1024).toFixed(1)} KB\nFile Type: ${file.type || 'Binary'}`);
      }
    }
  }

  openDocViewer(event: Event, url?: string, name?: string, content?: string): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const docName = name || 'Content Document';
    const docUrl = url && url !== '#' ? url : '';
    const docContent = content || 'Document brief details and specifications for this creative task.';

    this.activeDocName.set(docName);
    this.activeDocUrl.set(docUrl);
    this.activeDocContent.set(docContent);
    this.isDocViewerOpen.set(true);
  }

  closeDocViewer(): void {
    this.isDocViewerOpen.set(false);
  }

  openCreateTaskModal(): void {
    this.createdBriefFile.set(null);
    this.createdBriefFileName.set('');
    this.createdBriefDataUrl.set('');
    this.createdBriefContent.set('');
    const firstDesigner = this.realDesignersList()[0]?.id || '';
    this.createTaskForm.reset({
      title: '',
      description: '',
      assignedTo: firstDesigner,
      priority: 'HIGH',
      dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    });
    this.isCreateTaskModalOpen.set(true);
  }

  closeCreateTaskModal(): void {
    this.isCreateTaskModalOpen.set(false);
    this.createdBriefFile.set(null);
    this.createdBriefFileName.set('');
    this.createdBriefDataUrl.set('');
    this.createdBriefContent.set('');
  }

  async onSubmitCreateTask(): Promise<void> {
    if (this.createTaskForm.invalid) return;
    const formVal = this.createTaskForm.value;
    const activePkg = this.activePackageName();
    const selectedDesigner = this.realDesignersList().find((d) => d.id === formVal.assignedTo);
    const currentUser = this.authService.currentUser();

    const fileName = this.createdBriefFileName();
    const dataUrl = this.createdBriefDataUrl();
    const fileContent = this.createdBriefContent();

    const payload = {
      ...formVal,
      packageName: activePkg,
      creatorId: currentUser?.id || 'usr_admin_01',
      creatorName: currentUser?.fullName || 'System Administrator',
      creatorRole: currentUser?.role || 'ADMINISTRATOR',
      creatorEmail: currentUser?.email || 'admin@markops.io',
      assigneeName: selectedDesigner ? selectedDesigner.name : 'Assigned Designer',
      attachmentName: fileName || (this.createdBriefFile() ? this.createdBriefFile()!.name : ''),
      attachmentUrl: dataUrl || (fileName ? `/uploads/briefs/${fileName}` : ''),
      content: fileContent || formVal.description || `Task brief details for ${activePkg} package.`,
    };

    const created = await this.taskService.createTask(payload);
    if (created) {
      this.activeOperationTab.set('TASKS');
      this.closeCreateTaskModal();
    }
  }

  openTaskDetailModal(task: Task, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.selectedTask.set(task);
    this.activeDetailTab.set('BRIEF');
    this.isTaskDetailModalOpen.set(true);
  }

  closeTaskDetailModal(): void {
    this.isTaskDetailModalOpen.set(false);
    this.selectedTask.set(null);
  }

  async deleteTask(event: Event, task: Task): Promise<void> {
    if (event) {
      event.stopPropagation();
    }
    if (!this.canDeleteTask()) {
      alert('Permission Denied: Only Administrators, Marketing Managers, and Digital Marketers can delete tasks.');
      return;
    }
    if (confirm(`Are you sure you want to delete task "${task.title}"? This action is permanent and cannot be undone.`)) {
      const success = await this.taskService.deleteTask(task.id);
      if (success) {
        if (this.selectedTask()?.id === task.id) {
          this.closeTaskDetailModal();
        }
      }
    }
  }

  async acceptTask(task: Task, event?: Event): Promise<void> {
    if (event) event.stopPropagation();
    const success = await this.taskService.transitionStatus(task.id, 'ACCEPTED', 'Designer accepted task and reviewed creative specs.');
    if (success) {
      this.refreshSelectedTask(task.id);
    }
  }

  async startWork(task: Task, event?: Event): Promise<void> {
    if (event) event.stopPropagation();
    const success = await this.taskService.transitionStatus(task.id, 'IN_PROGRESS', 'Designer started active canvas work.');
    if (success) {
      this.refreshSelectedTask(task.id);
    }
  }

  openUploadModal(task: Task, event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedTask.set(task);
    this.selectedUploadFile.set(null);
    this.selectedUploadDataUrl.set('');
    this.selectedUploadContent.set('');
    this.uploadForm.reset({
      fileName: `creative_version_v${(task.versions?.length || 0) + 1}.png`,
      changelog: '',
      fileSizeMb: 2.0,
    });
    this.isUploadModalOpen.set(true);
  }

  closeUploadModal(): void {
    this.isUploadModalOpen.set(false);
    this.selectedUploadFile.set(null);
    this.selectedUploadDataUrl.set('');
    this.selectedUploadContent.set('');
  }

  onUploadFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.selectedUploadFile.set(file);
      const sizeMb = Number((file.size / (1024 * 1024)).toFixed(2));
      this.uploadForm.patchValue({
        fileName: file.name,
        fileSizeMb: sizeMb > 0 ? sizeMb : 0.5,
      });

      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.selectedUploadDataUrl.set((e.target?.result as string) || '');
      };
      reader.readAsDataURL(file);

      if (
        file.type.startsWith('text/') ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.json') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.html')
      ) {
        const textReader = new FileReader();
        textReader.onload = (e: ProgressEvent<FileReader>) => {
          this.selectedUploadContent.set((e.target?.result as string) || '');
        };
        textReader.readAsText(file);
      } else {
        this.selectedUploadContent.set(`Creative Asset: ${file.name}\nFile Size: ${(file.size / 1024).toFixed(1)} KB\nType: ${file.type || 'Binary'}`);
      }
    }
  }

  async onSubmitUpload(): Promise<void> {
    if (this.uploadForm.invalid) return;
    const task = this.selectedTask();
    if (!task) return;

    const { fileName, changelog, fileSizeMb } = this.uploadForm.value;
    const dataUrl = this.selectedUploadDataUrl();
    const content = this.selectedUploadContent();

    const success = await this.taskService.submitCreativeVersion(task.id, {
      fileName,
      changelog,
      fileSize: Math.round((fileSizeMb || 2) * 1024 * 1024),
      filePath: dataUrl || `/uploads/creatives/${fileName}`,
      fileContent: content || changelog,
    });

    if (success) {
      this.refreshSelectedTask(task.id);
      this.closeUploadModal();
    }
  }

  openRevisionModal(task: Task, event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedTask.set(task);
    this.revisionForm.reset({ remark: '' });
    this.isRevisionModalOpen.set(true);
  }

  closeRevisionModal(): void {
    this.isRevisionModalOpen.set(false);
  }

  async onSubmitRevision(): Promise<void> {
    if (this.revisionForm.invalid) return;
    const task = this.selectedTask();
    if (!task) return;

    const { remark } = this.revisionForm.value;

    const success = await this.taskService.transitionStatus(task.id, 'REVISION_REQUIRED', remark);
    if (success) {
      await this.taskService.addComment(task.id, `[CHANGE REQUEST]: ${remark}`);
      this.refreshSelectedTask(task.id);
      this.closeRevisionModal();
    }
  }

  async approveTask(task: Task, event?: Event): Promise<void> {
    if (event) event.stopPropagation();
    const success = await this.taskService.transitionStatus(task.id, 'APPROVED', 'Creative design approved by manager.');
    if (success) {
      this.refreshSelectedTask(task.id);
    }
  }

  async onSubmitAddComment(): Promise<void> {
    const text = this.newCommentText().trim();
    const task = this.selectedTask();
    if (!text || !task) return;

    const success = await this.taskService.addComment(task.id, text);
    if (success) {
      this.newCommentText.set('');
      this.refreshSelectedTask(task.id);
    }
  }

  private refreshSelectedTask(taskId: string): void {
    const found = this.taskService.tasks().find((t) => t.id === taskId);
    if (found) {
      this.selectedTask.set(found);
    }
  }

  getStatusBadgeClass(status: TaskStatus): string {
    switch (status) {
      case 'IN_PROGRESS': return 'badge-amber';
      case 'SUBMITTED':
      case 'UNDER_REVIEW': return 'badge-purple';
      case 'APPROVED':
      case 'COMPLETED': return 'badge-green';
      case 'REVISION_REQUIRED': return 'badge-danger';
      default: return 'badge-blue';
    }
  }

  getWorkflowSteps(task: Task) {
    const status = task.status;
    const versionCount = task.versions?.length || 0;

    let stage1State: 'completed' | 'current' | 'upcoming' = 'completed';
    let stage2State: 'completed' | 'current' | 'upcoming' = 'upcoming';
    let stage3State: 'completed' | 'current' | 'upcoming' = 'upcoming';
    let stage4State: 'completed' | 'current' | 'upcoming' | 'revision' = 'upcoming';

    if (status === 'DRAFT' || status === 'ASSIGNED') {
      stage1State = 'current';
    } else if (status === 'ACCEPTED' || status === 'IN_PROGRESS') {
      stage1State = 'completed';
      stage2State = 'current';
    } else if (status === 'SUBMITTED' || status === 'RESUBMITTED' || status === 'UNDER_REVIEW') {
      stage1State = 'completed';
      stage2State = 'completed';
      stage3State = 'current';
    } else if (status === 'REVISION_REQUIRED') {
      stage1State = 'completed';
      stage2State = 'completed';
      stage3State = 'completed';
      stage4State = 'revision';
    } else if (status === 'APPROVED' || status === 'PUBLISHED' || status === 'COMPLETED') {
      stage1State = 'completed';
      stage2State = 'completed';
      stage3State = 'completed';
      stage4State = 'completed';
    }

    return [
      {
        id: 1,
        title: 'Task Assigned',
        subtitle: status === 'ASSIGNED' ? 'Awaiting Acceptance' : 'Brief Received',
        icon: 'assignment_turned_in',
        state: stage1State,
      },
      {
        id: 2,
        title: 'Started',
        subtitle: status === 'IN_PROGRESS' ? 'Active Creative Work' : status === 'ACCEPTED' ? 'Task Accepted' : stage2State === 'completed' ? 'Canvas Complete' : 'Pending Start',
        icon: 'palette',
        state: stage2State,
      },
      {
        id: 3,
        title: 'Under Review',
        subtitle: versionCount > 0 ? `v${versionCount}.0 Submitted` : 'Awaiting Version',
        icon: 'unarchive',
        state: stage3State,
      },
      {
        id: 4,
        title: stage4State === 'revision' ? 'Revision Needed' : 'Completed',
        subtitle: stage4State === 'completed' ? 'Approved & Ready' : stage4State === 'revision' ? 'Feedback Requested' : 'Pending Review',
        icon: stage4State === 'revision' ? 'rate_review' : 'verified',
        state: stage4State,
      },
    ];
  }

  getHistoryNodeIcon(newStatus: TaskStatus): string {
    switch (newStatus) {
      case 'ASSIGNED': return 'assignment';
      case 'ACCEPTED': return 'task_alt';
      case 'IN_PROGRESS': return 'draw';
      case 'SUBMITTED':
      case 'RESUBMITTED': return 'upload_file';
      case 'UNDER_REVIEW': return 'find_in_page';
      case 'REVISION_REQUIRED': return 'rate_review';
      case 'APPROVED':
      case 'PUBLISHED':
      case 'COMPLETED': return 'verified';
      default: return 'history';
    }
  }

  getHistoryNodeClass(newStatus: TaskStatus): string {
    switch (newStatus) {
      case 'ACCEPTED':
      case 'APPROVED':
      case 'PUBLISHED':
      case 'COMPLETED': return 'node-success';
      case 'REVISION_REQUIRED': return 'node-danger';
      case 'SUBMITTED':
      case 'RESUBMITTED':
      case 'UNDER_REVIEW': return 'node-primary';
      case 'IN_PROGRESS': return 'node-warning';
      default: return 'node-info';
    }
  }
}

