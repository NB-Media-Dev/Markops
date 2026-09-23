export type TaskStatus =
  | 'DRAFT'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'REVISION_REQUIRED'
  | 'RESUBMITTED'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'COMPLETED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TaskVersion {
  id: string;
  taskId: string;
  versionNumber: number;
  submittedBy: string;
  submittedByName?: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType?: string;
  changelog?: string;
  fileContent?: string;
  createdAt: string;
}

export interface TaskStatusHistory {
  id: string;
  taskId: string;
  actorId: string;
  actorName?: string;
  actorRole?: string;
  previousStatus: TaskStatus | null;
  newStatus: TaskStatus;
  remark?: string;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userRole?: string;
  comment: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  packageName?: string;
  description?: string;
  content?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  reviewerFeedback?: string;
  campaignId?: string;
  campaignName?: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdBy: string;
  creatorName?: string;
  assignedTo?: string;
  assigneeName?: string;
  dueDate?: string;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
  versions?: TaskVersion[];
  statusHistory?: TaskStatusHistory[];
  comments?: TaskComment[];
}

export interface CreateTaskRequest {
  title: string;
  packageName?: string;
  description?: string;
  content?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  campaignId?: string;
  campaignName?: string;
  priority: TaskPriority;
  assignedTo: string;
  dueDate?: string;
  creatorId?: string;
  creatorName?: string;
  assigneeName?: string;
}

export interface TransitionTaskStatusRequest {
  status: TaskStatus;
  remark?: string;
}

export interface SubmitVersionRequest {
  fileName: string;
  changelog?: string;
  fileSize?: number;
  filePath?: string;
  fileContent?: string;
}

export interface DesignerDashboardMetrics {
  assignedTodayCount: number;
  inProgressCount: number;
  dueTodayCount: number;
  overdueCount: number;
  submittedWaitingReviewCount: number;
  revisionRequiredCount: number;
  completedThisMonthCount: number;
  avgCompletionHours: number;
  approvalRatePct: number;
  totalRevisionsCount: number;
  activityTimeline: Array<{
    id: string;
    action: string;
    taskTitle: string;
    actorName: string;
    timestamp: string;
  }>;
  recentSubmissions: Array<{
    id: string;
    taskTitle: string;
    versionNumber: number;
    fileName: string;
    submittedAt: string;
    status: TaskStatus;
    reviewerRemark?: string;
  }>;
}
