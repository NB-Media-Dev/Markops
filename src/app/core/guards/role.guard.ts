import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, ROLE_DEFAULT_ROUTES } from '../services/auth.service';
import { UserRole } from '../models/auth.model';

/**
 * Functional Angular Route Guard enforcing role-specific navigation permissions.
 */
export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const currentUser = authService.currentUser();
  if (!currentUser) {
    return router.createUrlTree(['/login']);
  }

  const allowedRoles = route.data?.['roles'] as UserRole[] | undefined;

  // If no specific roles required, allow access
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  // Check if user role matches allowed roles
  if (allowedRoles.includes(currentUser.role)) {
    return true;
  }

  // If role is unauthorized, redirect to their role default dashboard
  const fallbackRoute = ROLE_DEFAULT_ROUTES[currentUser.role] || '/dashboard';
  return router.createUrlTree([fallbackRoute]);
};
