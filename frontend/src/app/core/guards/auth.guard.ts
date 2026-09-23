import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Functional Angular Route Guard protecting UI navigation from unauthenticated access.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    const user = authService.currentUser();
    if (user && user.isActive === false) {
      authService.logout();
      return router.createUrlTree(['/login'], { queryParams: { error: 'inactive' } });
    }
    return true;
  }

  // Redirect to login page with returnUrl query parameter
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
