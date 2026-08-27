import { SetMetadata } from '@nestjs/common';
import { type Role } from '@barff/types';

export const ROLES_KEY = 'barff:roles';

/**
 * Requires the caller to hold at least one of these roles.
 *
 * Prefer `@Permissions()`. Roles are coarse and change shape as the business
 * grows; permissions describe what the endpoint actually needs, so adding a
 * role later is a data change rather than an edit to every controller.
 * `@Roles()` is for the cases where the role genuinely is the requirement.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
