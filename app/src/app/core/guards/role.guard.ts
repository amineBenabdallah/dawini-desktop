import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard = (allowedRoles: string[]): boolean => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const role = auth.role();
  if (role && allowedRoles.includes(role)) return true;

  void router.navigate(['/dashboard']);
  return false;
};
