import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Functional HTTP Interceptor attaching Authorization header and enabling HTTP-only cookies.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.currentUser() ? localStorage.getItem('markops_token') || sessionStorage.getItem('markops_token') : null;

  let authReq = req.clone({
    withCredentials: true, // Enables sending HTTP-only cookies like refreshToken
  });

  if (token) {
    authReq = authReq.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(authReq);
};
