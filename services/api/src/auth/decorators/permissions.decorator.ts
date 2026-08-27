import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'barff:permissions';

/**
 * Requires every listed `resource:action` permission.
 *
 * ALL, not ANY: an endpoint that both reads stock and adjusts it needs both,
 * and "any of" would let a read-only user through.
 */
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
