import { type ReactNode } from 'react';
import './globals.css';

/**
 * Root layout.
 *
 * Deliberately thin: `<html>` needs a `lang`, and the locale is only known
 * inside `[locale]`, so the real document shell lives there. This exists
 * because Next requires a root layout, and because `not-found` outside a locale
 * segment has to render somewhere.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
