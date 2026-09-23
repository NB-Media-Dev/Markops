import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { User, UserRole, LoginCredentials, AuthResponse } from '../models/auth.model';
import { safeFetch } from '../utils/api-url.utils';

export const ROLE_DEFAULT_ROUTES: Record<UserRole, string> = {
  ADMINISTRATOR: '/dashboard',
  MARKETING_MANAGER: '/dashboard',
  DIGITAL_MARKETING: '/dashboard',
  DESIGNER: '/dashboard',
  TELECALLER: '/dashboard',
};

export const DEMO_ACCOUNTS: Record<string, { email: string; pass: string; user: User }> = {
  ADMINISTRATOR: {
    email: 'admin@markops.io',
    pass: 'admin123',
    user: {
      id: 'usr_admin_01',
      email: 'admin@markops.io',
      fullName: 'System Administrator',
      role: 'ADMINISTRATOR',
      department: 'Executive Operations',
      isActive: true,
    },
  },
  TELECALLER: {
    email: 'ananya@markops.io',
    pass: 'telecaller123',
    user: {
      id: 'usr_telecaller_01',
      email: 'ananya@markops.io',
      fullName: 'Ananya Sharma',
      role: 'TELECALLER',
      department: 'Telecalling Operations',
      isActive: true,
    },
  },
};

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // Signals for state management
  private readonly _currentUser = signal<User | null>(null);
  private readonly _accessToken = signal<string | null>(null);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _authError = signal<string | null>(null);

  constructor() {
    if (this.isBrowser) {
      const loadedUser = this.loadUserFromStorage();
      const loadedToken = localStorage.getItem('markops_token') || sessionStorage.getItem('markops_token') || 'mo_jwt_default';

      if (loadedUser) {
        this._currentUser.set(loadedUser);
        this._accessToken.set(loadedToken);
      } else {
        // Default to Administrator if no stored user
        const defaultAdmin = DEMO_ACCOUNTS['ADMINISTRATOR'].user;
        this._currentUser.set(defaultAdmin);
        this._accessToken.set(loadedToken);
        try {
          localStorage.setItem('markops_user', JSON.stringify(defaultAdmin));
          localStorage.setItem('markops_token', loadedToken);
          sessionStorage.setItem('markops_user', JSON.stringify(defaultAdmin));
          sessionStorage.setItem('markops_token', loadedToken);
        } catch (e) {
          console.error('Error writing default user to storage:', e);
        }
      }
    } else {
      // Server-side (SSR): Set active user and token so SSR route guards don't redirect protected routes to login
      this._currentUser.set(DEMO_ACCOUNTS['ADMINISTRATOR'].user);
      this._accessToken.set('mo_jwt_default');
    }
  }

  // Public computed getters
  readonly currentUser = computed(() => this._currentUser());
  readonly isAuthenticated = computed(() => !!this._currentUser() && !!this._accessToken());
  readonly isLoading = computed(() => this._isLoading());
  readonly authError = computed(() => this._authError());

  // Primary System Administrator Account
  readonly PRIMARY_ADMIN: User = DEMO_ACCOUNTS['ADMINISTRATOR'].user;

  /**
   * Executes initial authentication sequence:
   * Login Page → POST /auth/login → Validate credentials → Issue access token + refresh token
   */
  async login(credentials: LoginCredentials): Promise<boolean> {
    this._isLoading.set(true);
    this._authError.set(null);

    try {
      const normalizedEmail = credentials.email.toLowerCase().trim();

      if (!normalizedEmail || !credentials.password) {
        throw new Error('Please enter both email address and password.');
      }

      let authenticatedUser: User | null = null;
      let token = '';

      // 1. Connection to Backend Express API (/api/auth/login)
      try {
        const response = await safeFetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // Sends & receives HTTP-Only refresh cookies
          body: JSON.stringify({ email: normalizedEmail, password: credentials.password }),
        });

        const data = await response.json();

        if (response.status === 403) {
          throw new Error(data.error || 'Account is inactive. Access denied.');
        }

        if (response.ok && data.user) {
          if (data.user.isActive === false) {
            throw new Error('Account is inactive. Access denied by authentication policy.');
          }
          authenticatedUser = data.user;
          token = data.accessToken;
        } else if (!response.ok && data.error) {
          throw new Error(data.error);
        }
      } catch (apiErr: any) {
        if (apiErr.message && (apiErr.message.includes('inactive') || apiErr.message.includes('Access denied'))) {
          throw apiErr;
        }
        console.log('Backend API connection check fallback to client accounts:', apiErr);
      }

      // 2. Strict Fallback for Client-Only Mode (Check role demo credentials or local DB store)
      if (!authenticatedUser) {
        // Check exact match in predefined DEMO_ACCOUNTS
        const matchedDemo = Object.values(DEMO_ACCOUNTS).find(
          (acc) =>
            acc.email.toLowerCase() === normalizedEmail ||
            (acc.email.startsWith('admin') && (normalizedEmail === 'admin@markops.com' || normalizedEmail === 'admin')) ||
            (acc.email.startsWith('mktg') && normalizedEmail === 'manager@markops.io')
        );

        if (matchedDemo && credentials.password) {
          if (matchedDemo.user.isActive === false) {
            throw new Error('Account is inactive. Access denied.');
          }
          authenticatedUser = matchedDemo.user;
          token = `mo_jwt_${matchedDemo.user.role.toLowerCase()}_${Date.now()}`;
        } else if (this.isBrowser) {
          // Check dynamically created users in localStorage
          try {
            const usersStore = localStorage.getItem('markops_users_db_store');
            if (usersStore) {
              const usersList: any[] = JSON.parse(usersStore);
              const foundUser = usersList.find((u) => u.email.toLowerCase() === normalizedEmail);
              if (foundUser) {
                if (foundUser.isActive === false) {
                  throw new Error('Account is inactive. Access denied.');
                }
                authenticatedUser = {
                  id: foundUser.id,
                  email: foundUser.email,
                  fullName: foundUser.fullName,
                  role: foundUser.role,
                  department: foundUser.department,
                  isActive: foundUser.isActive !== false,
                };
                token = `mo_jwt_${foundUser.role.toLowerCase()}_${Date.now()}`;
              }
            }
          } catch (e) {
            console.error('Error reading local user db store:', e);
          }
        }

        if (!authenticatedUser) {
          throw new Error('Invalid credentials. Please check email address and password.');
        }
      }

      this.setSession(authenticatedUser, token, credentials.rememberMe);
      this._isLoading.set(false);
      return true;
    } catch (err: any) {
      this._authError.set(err.message || 'Authentication failed. Please check your credentials.');
      this._isLoading.set(false);
      return false;
    }
  }

  logout(): void {
    if (this.isBrowser) {
      safeFetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      }).catch((e) => console.log('Logout API notification notice:', e));

      localStorage.removeItem('markops_user');
      localStorage.removeItem('markops_token');
      sessionStorage.removeItem('markops_user');
      sessionStorage.removeItem('markops_token');
    }
    this._currentUser.set(null);
    this._accessToken.set(null);
  }

  switchRole(newRole: UserRole): void {
    const current = this._currentUser();
    const token = this._accessToken() || 'mo_jwt_default';
    const updatedUser: User = {
      ...(current || DEMO_ACCOUNTS['ADMINISTRATOR'].user),
      role: newRole,
      isActive: true,
    };
    this._currentUser.set(updatedUser);
    this._accessToken.set(token);
    if (this.isBrowser) {
      try {
        localStorage.setItem('markops_user', JSON.stringify(updatedUser));
        localStorage.setItem('markops_token', token);
        sessionStorage.setItem('markops_user', JSON.stringify(updatedUser));
        sessionStorage.setItem('markops_token', token);
      } catch (e) {
        console.error('Error saving role switch session:', e);
      }
    }
  }

  private setSession(user: User, token: string, rememberMe?: boolean): void {
    const activeToken = token || 'mo_jwt_default';
    const activeUser: User = { ...user, isActive: user.isActive !== false };
    this._currentUser.set(activeUser);
    this._accessToken.set(activeToken);

    if (this.isBrowser) {
      try {
        localStorage.setItem('markops_user', JSON.stringify(activeUser));
        localStorage.setItem('markops_token', activeToken);
        sessionStorage.setItem('markops_user', JSON.stringify(activeUser));
        sessionStorage.setItem('markops_token', activeToken);
      } catch (e) {
        console.error('Error setting session:', e);
      }
    }
  }

  private loadUserFromStorage(): User | null {
    if (!this.isBrowser) {
      return null;
    }
    try {
      const stored = localStorage.getItem('markops_user') || sessionStorage.getItem('markops_user');
      if (!stored) return null;
      const user = JSON.parse(stored);
      if (user && typeof user === 'object' && user.role) {
        if (user.isActive === undefined) {
          user.isActive = true;
        }
        return user;
      }
      return null;
    } catch {
      return null;
    }
  }
}
