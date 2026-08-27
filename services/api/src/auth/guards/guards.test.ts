import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { Role } from '@barff/types';
import { PermissionsGuard } from './permissions.guard.js';
import { RolesGuard } from './roles.guard.js';
import { type AuthenticatedUser } from '../types.js';

function contextFor(user: AuthenticatedUser | undefined) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as never;
}

function reflectorReturning(value: unknown): Reflector {
  const reflector = new Reflector();
  reflector.getAllAndOverride = (() => value) as never;
  return reflector;
}

const dealer: AuthenticatedUser = {
  id: 'user-1',
  email: 'dealer@barff.uz',
  roles: [Role.DEALER],
  permissions: ['orders:read_own', 'orders:create', 'products:read'],
  sessionId: 'session-1',
};

describe('RolesGuard', () => {
  it('allows a route with no @Roles()', () => {
    const guard = new RolesGuard(reflectorReturning(undefined));
    expect(guard.canActivate(contextFor(dealer))).toBe(true);
  });

  it('allows a user holding one of the required roles', () => {
    const guard = new RolesGuard(reflectorReturning([Role.ADMIN, Role.DEALER]));
    expect(guard.canActivate(contextFor(dealer))).toBe(true);
  });

  it('rejects a user without any required role', () => {
    const guard = new RolesGuard(reflectorReturning([Role.ADMIN, Role.WAREHOUSE]));
    expect(() => guard.canActivate(contextFor(dealer))).toThrow(ForbiddenException);
  });

  it('fails closed when a route requires a role but has no authenticated user', () => {
    const guard = new RolesGuard(reflectorReturning([Role.ADMIN]));
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
  });

  it('does not leak which role was required', () => {
    const guard = new RolesGuard(reflectorReturning([Role.ADMIN]));
    try {
      guard.canActivate(contextFor(dealer));
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain('ADMIN');
    }
  });
});

describe('PermissionsGuard', () => {
  it('allows a route with no @Permissions()', () => {
    const guard = new PermissionsGuard(reflectorReturning([]));
    expect(guard.canActivate(contextFor(dealer))).toBe(true);
  });

  it('allows a user holding every required permission', () => {
    const guard = new PermissionsGuard(reflectorReturning(['orders:read_own', 'products:read']));
    expect(guard.canActivate(contextFor(dealer))).toBe(true);
  });

  it('requires ALL listed permissions, not any', () => {
    // A read-only user must not reach an endpoint that also adjusts stock.
    const guard = new PermissionsGuard(reflectorReturning(['products:read', 'warehouse:adjust']));
    expect(() => guard.canActivate(contextFor(dealer))).toThrow(ForbiddenException);
  });

  it('rejects when the user holds none of them', () => {
    const guard = new PermissionsGuard(reflectorReturning(['settings:update']));
    expect(() => guard.canActivate(contextFor(dealer))).toThrow(ForbiddenException);
  });

  it('does not disclose which permission was missing', () => {
    // Otherwise probing endpoints yields a map of the permission model.
    const guard = new PermissionsGuard(reflectorReturning(['settings:update']));
    try {
      guard.canActivate(contextFor(dealer));
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain('settings:update');
    }
  });

  it('fails closed without an authenticated user', () => {
    const guard = new PermissionsGuard(reflectorReturning(['products:read']));
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
  });
});
