import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ManagedUser, CreateUserRequest } from '../models/user-management.model';
import { UserRole } from '../models/auth.model';
import { safeFetch } from '../utils/api-url.utils';

@Injectable({
  providedIn: 'root',
})
export class UserManagementService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly LOCAL_STORAGE_KEY = 'markops_users_db_store';

  private readonly PRIMARY_ADMIN: ManagedUser = {
    id: 'usr_admin_01',
    email: 'admin@markops.io',
    fullName: 'System Administrator',
    role: 'ADMINISTRATOR',
    department: 'Executive Operations',
    isActive: true,
    lastLoginAt: 'Just now',
    createdAt: '2026-01-10',
  };

  private readonly DEFAULT_TELECALLERS: ManagedUser[] = [
  ];

  private readonly INITIAL_SEED_USERS: ManagedUser[] = [this.PRIMARY_ADMIN, ...this.DEFAULT_TELECALLERS];

  private readonly _users = signal<ManagedUser[]>(this.INITIAL_SEED_USERS);

  readonly users = computed(() => this._users());
  readonly activeUsersCount = computed(() => this._users().filter((u) => u.isActive).length);
  readonly totalUsersCount = computed(() => this._users().length);

  constructor() {
    if (this.isBrowser) {
      this.loadUsersFromDatabase();
    }
  }

  /**
   * Loads users from backend REST API (/api/users) with fallback to localStorage
   */
  async loadUsersFromDatabase(): Promise<void> {
    try {
      const res = await safeFetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          this._users.set(data);
          this.saveToLocalStorage(data);
          return;
        }
      }
    } catch (err) {
      console.log('Database user sync check fallback to local storage:', err);
    }

    // Fallback to localStorage if available
    const cachedUsers = this.loadFromLocalStorage();
    if (cachedUsers && cachedUsers.length > 0) {
      this._users.set(cachedUsers);
    } else {
      this._users.set([this.PRIMARY_ADMIN]);
      this.saveToLocalStorage([this.PRIMARY_ADMIN]);
    }
  }

  /**
   * Creates a new user record in the database store
   */
  createUser(req: CreateUserRequest): ManagedUser {
    const newUser: ManagedUser = {
      id: `usr_${Math.random().toString(36).substring(2, 11)}`,
      email: req.email.toLowerCase().trim(),
      fullName: req.fullName.trim(),
      role: req.role,
      department: req.department.trim() || 'General Operations',
      isActive: req.isActive !== undefined ? req.isActive : true,
      lastLoginAt: 'Never',
      createdAt: new Date().toISOString().split('T')[0],
    };

    // Optimistic state update in Angular signal
    this._users.update((list) => [newUser, ...list]);
    this.saveToLocalStorage(this._users());

    // Persist to backend database API asynchronously
    if (this.isBrowser) {
      safeFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newUser, password: req.password }),
      }).catch((err) => console.error('Failed to sync newly created user to backend database:', err));
    }

    return newUser;
  }

  /**
   * Toggles active status in database store
   */
  toggleUserStatus(userId: string): void {
    this._users.update((list) =>
      list.map((u) => (u.id === userId ? { ...u, isActive: !u.isActive } : u))
    );
    this.saveToLocalStorage(this._users());

    if (this.isBrowser) {
      safeFetch(`/api/users/${userId}/status`, { method: 'PATCH' }).catch((err) =>
        console.error('Failed to update user status in backend database:', err)
      );
    }
  }

  /**
   * Updates user role in database store
   */
  updateUserRole(userId: string, newRole: UserRole): void {
    this._users.update((list) =>
      list.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
    this.saveToLocalStorage(this._users());
  }

  /**
   * Updates an existing user record in the database store
   */
  updateUser(userId: string, updatedData: Partial<CreateUserRequest>): ManagedUser | null {
    let updatedUser: ManagedUser | null = null;

    this._users.update((list) =>
      list.map((user) => {
        if (user.id === userId) {
          updatedUser = {
            ...user,
            fullName: updatedData.fullName ? updatedData.fullName.trim() : user.fullName,
            email: updatedData.email ? updatedData.email.toLowerCase().trim() : user.email,
            role: updatedData.role || user.role,
            department: updatedData.department ? updatedData.department.trim() : user.department,
            isActive: updatedData.isActive !== undefined ? updatedData.isActive : user.isActive,
          };
          return updatedUser;
        }
        return user;
      })
    );

    this.saveToLocalStorage(this._users());

    if (this.isBrowser && updatedUser) {
      safeFetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(updatedUser as ManagedUser), password: updatedData.password }),
      }).catch((err) => console.error('Failed to sync updated user to backend database:', err));
    }

    return updatedUser;
  }

  /**
   * Deletes a user record from the database store
   */
  deleteUser(userId: string): void {
    if (userId === 'usr_admin_01') {
      alert('System Administrator account (usr_admin_01) is protected and cannot be deleted.');
      return;
    }

    // Optimistic removal from Angular signal
    this._users.update((list) => list.filter((u) => u.id !== userId));
    this.saveToLocalStorage(this._users());

    // Persist deletion to backend database API asynchronously
    if (this.isBrowser) {
      safeFetch(`/api/users/${userId}`, { method: 'DELETE' }).catch((err) =>
        console.error('Failed to delete user from backend database:', err)
      );
    }
  }

  private saveToLocalStorage(users: ManagedUser[]): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('Error writing to localStorage:', e);
    }
  }

  private loadFromLocalStorage(): ManagedUser[] | null {
    if (!this.isBrowser) return null;
    try {
      const data = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }
}

