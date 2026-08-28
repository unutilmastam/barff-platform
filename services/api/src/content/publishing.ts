/**
 * Publish/draft semantics, shared by every content type.
 *
 * The same three columns as `Product`: `isActive` decides whether the public
 * API will return the row, `publishedAt` records when it first went live, and
 * `deletedAt` retires it without destroying it. One vocabulary across the CMS
 * means an editor learns it once and a reviewer can check any public query
 * against a single rule.
 */

export const PublishTransition = {
  PUBLISHED: 'published',
  UNPUBLISHED: 'unpublished',
  UPDATED: 'updated',
} as const;
export type PublishTransition = (typeof PublishTransition)[keyof typeof PublishTransition];

/**
 * What an update does to the publication state.
 *
 * `publishedAt` is stamped once, on the transition into published. Re-saving a
 * live article must not move its date — that date is shown to readers and used
 * for ordering, so a typo fix would otherwise jump the article back to the top
 * of the news list.
 */
export function publishPatch(
  next: boolean | undefined,
  current: boolean,
): { isActive?: boolean; publishedAt?: Date } {
  if (next === undefined) return {};
  if (next && !current) return { isActive: true, publishedAt: new Date() };
  return { isActive: next };
}

export function publishTransition(next: boolean | undefined, current: boolean): PublishTransition {
  if (next === true && !current) return PublishTransition.PUBLISHED;
  if (next === false && current) return PublishTransition.UNPUBLISHED;
  return PublishTransition.UPDATED;
}

/** Every public content query filters on exactly this. */
export const PUBLIC_FILTER = { isActive: true, deletedAt: null } as const;

/** For the models that are configuration rather than content, and never deleted. */
export const PUBLIC_FILTER_NO_DELETE = { isActive: true } as const;
