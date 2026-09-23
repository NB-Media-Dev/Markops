import { Component, OnInit, signal, computed, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TaskManagementService } from '../../core/services/task-management.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Task, TaskStatus, TaskPriority } from '../../core/models/task.model';

import { UserManagementService } from '../../core/services/user-management.service';
import { FIXED_PACKAGES } from '../package-works/package-works.component';

import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-designer-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './designer-dashboard.component.html',
  styleUrl: './designer-dashboard.component.scss',
})
export class DesignerDashboardComponent implements OnInit {
  @Input() packageFilter?: string;
  @Input() embedded: boolean = false;

  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);
  readonly taskService = inject(TaskManagementService);
  readonly userService = inject(UserManagementService);
  readonly authService = inject(AuthService);
  readonly notifService = inject(NotificationService);

  readonly statusFilter = signal<string>('ALL');
  readonly searchQuery = signal<string>('');
  readonly availablePackages = FIXED_PACKAGES;

  readonly canCreateTask = computed<boolean>(() => {
    const role = this.authService.currentUser()?.role;
    return role === 'ADMINISTRATOR' || role === 'MARKETING_MANAGER' || role === 'DIGITAL_MARKETING';
  });

  getPackageIcon(packageName?: string): string {
    const targetName = packageName || this.packageFilter || 'Careermate';
    const pkg = this.availablePackages.find((p) => p.name === targetName);
    return pkg?.icon || 'palette';
  }

  readonly isManager = computed<boolean>(() => {
    const role = this.authService.currentUser()?.role;
    return role === 'ADMINISTRATOR' || role === 'MARKETING_MANAGER';
  });

  readonly realDesignersList = computed(() => {
    const allUsers = this.userService.users();
    const designers = allUsers.filter((u) => u.role === 'DESIGNER');
    return designers.map((u) => ({ id: u.id, name: u.fullName }));
  });

  // Modals & Drawers
  readonly isUploadModalOpen = signal<boolean>(false);
  readonly isReviewModalOpen = signal<boolean>(false);
  readonly isCreateTaskModalOpen = signal<boolean>(false);
  readonly activeModalTaskId = signal<string | null>(null);
  readonly selectedFileObject = signal<File | null>(null);
  readonly selectedFileDataUrl = signal<string>('');
  readonly selectedFileContent = signal<string>('');
  readonly createdBriefFile = signal<File | null>(null);
  readonly createdBriefFileName = signal<string>('');
  readonly createdBriefDataUrl = signal<string>('');
  readonly createdBriefContent = signal<string>('');

  // Document Viewer Modal Signals
  readonly isDocViewerOpen = signal<boolean>(false);
  readonly activeDocName = signal<string>('');
  readonly activeDocUrl = signal<string>('');
  readonly activeDocContent = signal<string>('');

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
  <div class="doc-header"><span class="material-symbols-outlined" style="font-size:20px;">description</span> ${title}</div>
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

  readonly copySuccess = signal<string | null>(null);

  // Forms
  readonly uploadForm: FormGroup = this.fb.group({
    fileName: ['', [Validators.required]],
    changelog: ['', [Validators.required]],
    fileSizeMb: [2.0],
  });

  readonly reviewForm: FormGroup = this.fb.group({
    action: ['APPROVE', [Validators.required]],
    remark: ['', [Validators.required, Validators.minLength(5)]],
  });

  readonly createTaskForm: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    packageName: ['Careermate', [Validators.required]],
    description: [''],
    assignedTo: ['', [Validators.required]],
    priority: ['HIGH' as TaskPriority, [Validators.required]],
    dueDate: [new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], [Validators.required]],
  });

  readonly filteredTasks = computed(() => {
    const list = this.taskService.tasks();
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.statusFilter();
    const currentUser = this.authService.currentUser();
    const currentRole = currentUser?.role;
    const currentUserId = currentUser?.id || '';
    const currentUserName = (currentUser?.fullName || '').toLowerCase().trim();
    const currentUserEmail = (currentUser?.email || '').toLowerCase().trim();

    return list.filter((t) => {
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

      if (this.packageFilter) {
        const pkgLower = this.packageFilter.toLowerCase().trim();
        const tPkg = (t.packageName || '').toLowerCase().trim();
        const tTitle = (t.title || '').toLowerCase();
        const matchesPackage = tPkg === pkgLower || tPkg.includes(pkgLower) || pkgLower.includes(tPkg) || tTitle.includes(pkgLower);
        if (!matchesPackage) {
          return false;
        }
      }

      const matchesSearch =
        !query ||
        t.title.toLowerCase().includes(query) ||
        (t.campaignName || '').toLowerCase().includes(query) ||
        (t.description || '').toLowerCase().includes(query) ||
        (t.content || '').toLowerCase().includes(query);

      let matchesStatus = true;
      if (filter === 'IN_PROGRESS') {
        matchesStatus = t.status === 'IN_PROGRESS' || t.status === 'ACCEPTED';
      } else if (filter === 'REVISION_REQUIRED') {
        matchesStatus = t.status === 'REVISION_REQUIRED';
      } else if (filter === 'SUBMITTED') {
        matchesStatus = t.status === 'SUBMITTED' || t.status === 'RESUBMITTED' || t.status === 'UNDER_REVIEW';
      } else if (filter === 'COMPLETED') {
        matchesStatus = t.status === 'APPROVED' || t.status === 'PUBLISHED' || t.status === 'COMPLETED';
      }

      return matchesSearch && matchesStatus;
    });
  });

  ngOnInit(): void {
    this.taskService.loadTasks();
    this.taskService.loadDesignerMetrics();
    this.notifService.loadNotifications();
    this.userService.loadUsersFromDatabase();
  }

  copyContentToClipboard(content: string, taskId: string): void {
    if (!content) return;
    navigator.clipboard.writeText(content).then(() => {
      this.copySuccess.set(taskId);
      setTimeout(() => this.copySuccess.set(null), 3000);
    });
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

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  setFilter(filter: string): void {
    this.statusFilter.set(filter);
  }

  onFilterChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    if (val) {
      this.setFilter(val);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.selectedFileObject.set(file);
      const sizeMb = Number((file.size / (1024 * 1024)).toFixed(2));
      this.uploadForm.patchValue({
        fileName: file.name,
        fileSizeMb: sizeMb > 0 ? sizeMb : 0.5,
      });

      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.selectedFileDataUrl.set((e.target?.result as string) || '');
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
          this.selectedFileContent.set((e.target?.result as string) || '');
        };
        textReader.readAsText(file);
      } else {
        this.selectedFileContent.set(`Design File: ${file.name}\nFile Size: ${(file.size / 1024).toFixed(1)} KB\nFile Type: ${file.type || 'Binary asset'}`);
      }
    }
  }

  // Lifecycle Quick Actions
  async acceptTask(task: Task): Promise<void> {
    await this.taskService.transitionStatus(task.id, 'ACCEPTED', 'Designer accepted task and reviewed creative specs.');
  }

  async startWork(task: Task): Promise<void> {
    await this.taskService.transitionStatus(task.id, 'IN_PROGRESS', 'Designer started active canvas work.');
  }

  openUploadModal(task: Task): void {
    this.activeModalTaskId.set(task.id);
    this.selectedFileObject.set(null);
    this.selectedFileDataUrl.set('');
    this.selectedFileContent.set('');
    this.uploadForm.reset({
      fileName: `creative_version_v${(task.versions?.length || 0) + 1}.png`,
      changelog: '',
      fileSizeMb: 2.0,
    });
    this.isUploadModalOpen.set(true);
  }

  closeUploadModal(): void {
    this.isUploadModalOpen.set(false);
    this.activeModalTaskId.set(null);
    this.selectedFileObject.set(null);
    this.selectedFileDataUrl.set('');
    this.selectedFileContent.set('');
  }

  async onSubmitUpload(): Promise<void> {
    if (this.uploadForm.invalid) return;

    const taskId = this.activeModalTaskId();
    if (!taskId) return;

    const { fileName, changelog, fileSizeMb } = this.uploadForm.value;
    const dataUrl = this.selectedFileDataUrl();
    const fileContent = this.selectedFileContent();

    const success = await this.taskService.submitCreativeVersion(taskId, {
      fileName,
      changelog,
      fileSize: Math.round((fileSizeMb || 2) * 1024 * 1024),
      filePath: dataUrl || `/uploads/creatives/${fileName}`,
      fileContent: fileContent || changelog,
    });

    if (success) {
      await this.notifService.loadNotifications();
      this.closeUploadModal();
    }
  }

  openReviewModal(task: Task): void {
    this.activeModalTaskId.set(task.id);
    this.reviewForm.reset({
      action: 'APPROVE',
      remark: '',
    });
    this.isReviewModalOpen.set(true);
  }

  closeReviewModal(): void {
    this.isReviewModalOpen.set(false);
    this.activeModalTaskId.set(null);
  }

  async onSubmitReview(): Promise<void> {
    if (this.reviewForm.invalid) return;
    const taskId = this.activeModalTaskId();
    if (!taskId) return;

    const { action, remark } = this.reviewForm.value;
    const targetStatus: TaskStatus = action === 'APPROVE' ? 'APPROVED' : 'REVISION_REQUIRED';

    const success = await this.taskService.transitionStatus(taskId, targetStatus, remark);
    if (success) {
      await this.notifService.loadNotifications();
      this.closeReviewModal();
    }
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

  openCreateTaskModal(): void {
    this.createdBriefFile.set(null);
    this.createdBriefFileName.set('');
    this.createdBriefDataUrl.set('');
    this.createdBriefContent.set('');
    const firstDesigner = this.realDesignersList()[0]?.id || '';
    this.createTaskForm.reset({
      title: '',
      description: '',
      packageName: this.packageFilter || 'Careermate',
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
    const fileName = this.createdBriefFileName();
    const dataUrl = this.createdBriefDataUrl();
    const fileContent = this.createdBriefContent();

    const payload = {
      ...formVal,
      attachmentName: fileName || (this.createdBriefFile() ? this.createdBriefFile()!.name : ''),
      attachmentUrl: dataUrl || (fileName ? `/uploads/briefs/${fileName}` : ''),
      content: fileContent || formVal.description || 'Task brief document details and specifications.',
    };

    const created = await this.taskService.createTask(payload);
    if (created) {
      await this.notifService.loadNotifications();
      this.closeCreateTaskModal();
    }
  }

  getStatusBadgeClass(status: TaskStatus): string {
    switch (status) {
      case 'DRAFT': return 'badge-secondary';
      case 'ASSIGNED': return 'badge-info';
      case 'ACCEPTED': return 'badge-info';
      case 'IN_PROGRESS': return 'badge-warning';
      case 'SUBMITTED':
      case 'RESUBMITTED':
      case 'UNDER_REVIEW': return 'badge-primary';
      case 'REVISION_REQUIRED': return 'badge-danger';
      case 'APPROVED':
      case 'PUBLISHED':
      case 'COMPLETED': return 'badge-success';
      default: return 'badge-secondary';
    }
  }

  getPriorityBadgeClass(priority: TaskPriority): string {
    switch (priority) {
      case 'LOW': return 'priority-low';
      case 'MEDIUM': return 'priority-medium';
      case 'HIGH': return 'priority-high';
      case 'URGENT': return 'priority-urgent';
      default: return '';
    }
  }

  getAssigneeName(task: Task | null): string {
    if (!task) return 'Unassigned';
    if (task.assigneeName && task.assigneeName !== 'Assigned User') {
      return task.assigneeName;
    }
    if (task.assignedTo) {
      const userList = this.userService.users();
      const match = userList.find((u) => u.id === task.assignedTo);
      if (match) return match.fullName;
    }
    return task.assigneeName || 'Designer';
  }

  readonly activeDetailTab = signal<'FLOW' | 'VERSIONS' | 'HISTORY' | 'BRIEF'>('FLOW');

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

  async deleteTask(event: Event, task: Task): Promise<void> {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete task "${task.title}"? This action is permanent and cannot be undone.`)) {
      await this.taskService.deleteTask(task.id);
    }
  }
}
