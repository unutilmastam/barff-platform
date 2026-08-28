import { type ReactNode } from 'react';

interface ContainerProps {
  children: ReactNode;
  /** Rendered as a different element where the landmark matters. */
  as?: 'div' | 'section' | 'header' | 'footer' | 'main' | 'nav' | 'article';
  className?: string;
}

/**
 * Horizontal rhythm for every page section.
 *
 * One place decides the maximum width and the gutters, so sections cannot drift
 * apart by a few pixels. The gutter widens at `sm` rather than starting large:
 * the layout is designed at 360px first, because that is where dealers and
 * drivers actually use this.
 */
export function Container({ children, as: Element = 'div', className = '' }: ContainerProps) {
  return (
    <Element className={`mx-auto w-full max-w-[80rem] px-gutter sm:px-gutterLg ${className}`}>
      {children}
    </Element>
  );
}
