/**
 * Application roles — `CLAUDE.md` §3.
 *
 * Authorization is always enforced server-side (§12). These values exist so the
 * API, the apps and the Prisma seed agree on the spelling; a role present in a
 * JWT is never by itself proof of permission.
 */
export const Role = {
  ADMIN: 'ADMIN',
  SALES: 'SALES',
  WAREHOUSE: 'WAREHOUSE',
  LOGISTICS: 'LOGISTICS',
  DRIVER: 'DRIVER',
  DEALER: 'DEALER',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ROLES = Object.values(Role);

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
