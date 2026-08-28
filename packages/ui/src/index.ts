/**
 * BARFF design system.
 *
 * Ships TypeScript source rather than a bundle: `'use client'` directives do
 * not survive bundling reliably, and every consumer in this workspace already
 * transpiles workspace packages. This is the standard Turborepo internal-package
 * pattern, and a deliberate exception to the tsup convention the other packages
 * follow.
 *
 * No component in here contains user-facing text (§18). Anything a person reads
 * — a close button's label, pagination wording, a "not verified" marker — is a
 * required prop, supplied already translated by the consumer.
 */
export { cn } from './lib/cn';

export { Button, buttonVariants, type ButtonProps } from './primitives/button';
export { Link, linkVariants, type LinkProps } from './primitives/link';
export { Badge, badgeVariants, type BadgeProps } from './primitives/badge';
export { Field, useField, type FieldProps } from './primitives/field';
export { Input, inputClassName, type InputProps } from './primitives/input';
export { Textarea, type TextareaProps } from './primitives/textarea';
export { Checkbox, CheckboxWithLabel, type CheckboxWithLabelProps } from './primitives/checkbox';
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from './primitives/select';
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
} from './primitives/dialog';
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from './primitives/sheet';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './primitives/tabs';
export {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './primitives/accordion';
export {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './primitives/toast';
export { Skeleton, type SkeletonProps } from './primitives/skeleton';
export {
  Pagination,
  buildPageItems,
  type PaginationLabels,
  type PaginationProps,
} from './primitives/pagination';

export { GlassCard, glassCardVariants, type GlassCardProps } from './surfaces/glass-card';
export { Section, sectionVariants, type SectionProps } from './surfaces/section';
export { SectionHeader, type SectionHeaderProps } from './surfaces/section-header';
export { StatBlock, type StatBlockProps } from './surfaces/stat-block';
export { MediaFrame, mediaFrameVariants, type MediaFrameProps } from './surfaces/media-frame';
