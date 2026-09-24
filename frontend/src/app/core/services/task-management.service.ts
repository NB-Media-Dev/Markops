import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  Task,
  TaskStatus,
  CreateTaskRequest,
  SubmitVersionRequest,
  DesignerDashboardMetrics,
} from '../models/task.model';
import { safeFetch } from '../utils/api-url.utils';

@Injectable({
  providedIn: 'root',
})
export class TaskManagementService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly LOCAL_STORAGE_KEY = 'markops_tasks_db_store';

  // State Signals
  private readonly _tasks = signal<Task[]>([]);
  private readonly _selectedTask = signal<Task | null>(null);
  private readonly _designerMetrics = signal<DesignerDashboardMetrics | null>(null);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // Computed Readonly Signal Getters
  readonly tasks = computed(() => this._tasks());
  readonly selectedTask = computed(() => this._selectedTask());
  readonly designerMetrics = computed(() => this._designerMetrics());
  readonly isLoading = computed(() => this._isLoading());
  readonly error = computed(() => this._error());

  constructor() {
    if (this.isBrowser) {
      this.loadTasks();
      this.loadDesignerMetrics();
    }
  }

  /**
   * Fetches all tasks from backend REST API with fallback to localStorage
   */
  async loadTasks(): Promise<void> {
    this._isLoading.set(true);
    try {
      const res = await safeFetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          if (data.length > 0) {
            this._tasks.set(data);
            this.saveToLocalStorage(data);
            this._isLoading.set(false);
            return;
          } else {
            // Check if local cache has tasks created client-side
            const cached = this.loadFromLocalStorage();
            if (cached && cached.length > 0) {
              this._tasks.set(cached);
              this._isLoading.set(false);
              return;
            }
          }
        }
      }
    } catch (err) {
      console.log('Error fetching tasks from backend API, using local storage fallback:', err);
    }

    const cached = this.loadFromLocalStorage();
    if (cached && cached.length > 0) {
      this._tasks.set(cached);
    }
    this._isLoading.set(false);
  }

  /**
   * Fetches Designer Dashboard Analytics
   */
  async loadDesignerMetrics(): Promise<void> {
    try {
      const res = await safeFetch('/api/designer/dashboard-metrics');
      if (res.ok) {
        const data = await res.json();
        this._designerMetrics.set(data);
      }
    } catch (err) {
      console.log('Error fetching designer metrics:', err);
    }
  }

  /**
   * Selects active task for detail view drawer / version upload modal
   */
  selectTask(taskId: string): void {
    const found = this._tasks().find((t) => String(t.id) === String(taskId));
    if (found) {
      this._selectedTask.set(found);
    }
  }

  closeTaskDetail(): void {
    this._selectedTask.set(null);
  }

  /**
   * Advances task status through lifecycle (ACCEPTED, IN_PROGRESS, REVISION_REQUIRED, APPROVED...)
   */
  async transitionStatus(taskId: string, newStatus: TaskStatus, remark?: string): Promise<boolean> {
    try {
      const res = await safeFetch(`/api/tasks/${taskId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, remark }),
      });

      if (res.ok) {
        const updatedTask: Task = await res.json();
        this.updateTaskInSignal(updatedTask);
        await this.loadDesignerMetrics();
        return true;
      }
    } catch (err: any) {
      console.error('Error transitioning task status:', err);
    }
    return false;
  }

  /**
   * Submits creative asset version (Increments v1.0, v2.0 without overwriting history)
   */
  async submitCreativeVersion(taskId: string, req: SubmitVersionRequest): Promise<boolean> {
    try {
      const res = await safeFetch(`/api/tasks/${taskId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.task) {
          this.updateTaskInSignal(data.task);
          await this.loadDesignerMetrics();
          return true;
        }
      }
    } catch (err) {
      console.error('Error submitting creative version:', err);
    }
    return false;
  }

  /**
   * Manager task creation flow
   */
  async createTask(req: CreateTaskRequest): Promise<Task | null> {
    try {
      const res = await safeFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });

      if (res.ok) {
        const newTask: Task = await res.json();
        if (newTask && !newTask.packageName && req.packageName) {
          newTask.packageName = req.packageName;
        }
        this._tasks.update((list) => [newTask, ...list.filter((t) => t.id !== newTask.id)]);
        this.saveToLocalStorage(this._tasks());
        await this.loadDesignerMetrics();
        return newTask;
      }
    } catch (err) {
      console.error('Error creating new task:', err);
    }

    // Fallback task creation for offline/local resilience
    const fallbackTask: Task = {
      id: `task_${Math.random().toString(36).substring(2, 11)}`,
      title: req.title.trim(),
      packageName: req.packageName || '',
      description: req.description || '',
      content: req.content || '',
      attachmentUrl: req.attachmentUrl || '',
      attachmentName: req.attachmentName || '',
      campaignId: req.campaignId || '',
      campaignName: req.campaignName || '',
      status: req.assignedTo ? 'ASSIGNED' : 'DRAFT',
      priority: req.priority,
      createdBy: req.creatorId || 'usr_admin_01',
      creatorName: req.creatorName || 'System Administrator',
      creatorRole: req.creatorRole || 'BDM',
      assignedTo: req.assignedTo || '',
      assigneeName: req.assigneeName || 'Assigned User',
      progressPercent: 0,
      dueDate: req.dueDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versions: [],
      statusHistory: [],
      comments: [],
    };

    this._tasks.update((list) => [fallbackTask, ...list]);
    this.saveToLocalStorage(this._tasks());
    return fallbackTask;
  }

  /**
   * Deletes a task record permanently
   */
  async deleteTask(taskId: string): Promise<boolean> {
    try {
      const res = await safeFetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        this._tasks.update((list) => list.filter((t) => t.id !== taskId));
        this.saveToLocalStorage(this._tasks());
        if (this._selectedTask()?.id === taskId) {
          this._selectedTask.set(null);
        }
        await this.loadDesignerMetrics();
        return true;
      }
    } catch (err) {
      console.error('Error deleting task via API:', err);
    }

    // Optimistic delete
    this._tasks.update((list) => list.filter((t) => t.id !== taskId));
    this.saveToLocalStorage(this._tasks());
    if (this._selectedTask()?.id === taskId) {
      this._selectedTask.set(null);
    }
    return true;
  }

  /**
   * Adds reviewer comment / feedback remark
   */
  async addComment(taskId: string, comment: string): Promise<boolean> {
    try {
      const res = await safeFetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      });

      if (res.ok) {
        await this.loadTasks();
        this.selectTask(taskId);
        return true;
      }
    } catch (err) {
      console.error('Error adding comment to task:', err);
    }
    return false;
  }

  private updateTaskInSignal(updatedTask: Task): void {
    this._tasks.update((list) =>
      list.map((t) => (String(t.id) === String(updatedTask.id) ? updatedTask : t))
    );
    this.saveToLocalStorage(this._tasks());
    if (String(this._selectedTask()?.id) === String(updatedTask.id)) {
      this._selectedTask.set(updatedTask);
    }
  }

  private saveToLocalStorage(tasks: Task[]): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.error('Error writing tasks to localStorage:', e);
    }
  }

  private loadFromLocalStorage(): Task[] | null {
    if (!this.isBrowser) return null;
    try {
      const data = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }
}

