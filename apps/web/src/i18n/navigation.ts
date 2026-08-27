import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware replacements for `next/link` and the navigation hooks.
 *
 * Components must import `Link` from here rather than from `next/link`: these
 * keep the active locale in the href automatically, so a link written once does
 * not silently drop a visitor from `/ru` back to `/uz`.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
