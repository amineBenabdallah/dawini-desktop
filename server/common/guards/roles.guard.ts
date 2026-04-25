import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Role } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator → allow all authenticated users
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const { user } = req;
    if (!user) {
      console.log('[RolesGuard] 403 — no user on request for', req.method, req.url);
      return false;
    }

    const allowed = requiredRoles.includes(user.role);
    if (!allowed) {
      console.log(
        '[RolesGuard] 403 — role mismatch for', req.method, req.url,
        '| user.role =', JSON.stringify(user.role),
        '| required =', JSON.stringify(requiredRoles),
      );
    }
    return allowed;
  }
}
