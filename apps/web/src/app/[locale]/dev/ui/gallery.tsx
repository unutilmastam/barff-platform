'use client';

import { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Checkbox,
  CheckboxWithLabel,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  GlassCard,
  Input,
  Link,
  MediaFrame,
  Pagination,
  Section,
  SectionHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  StatBlock,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@barff/ui';

/**
 * Every primitive and surface, rendered once.
 *
 * This page is a developer tool and is never served in production, so its
 * labels are plain English rather than translation keys — the §18 rule exists
 * so the public site can be localized, and this is not part of it. The
 * hard-coded-string test in `src/i18n` skips this directory for that reason.
 */
function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-8">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-content-muted">
        {title}
      </h2>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

export function DevUiGallery() {
  const [page, setPage] = useState(4);
  const [toastOpen, setToastOpen] = useState(false);

  return (
    <ToastProvider>
      <SectionHeader
        as="h1"
        eyebrow="S07"
        title="BARFF design system"
        description="Every primitive and surface, on the real theme. Not served in production."
      />

      <Row title="Button">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <Button disabled>Disabled</Button>
      </Row>

      <Row title="Link">
        <Link href="#">Default link</Link>
        <Link href="#" variant="subtle">
          Subtle link
        </Link>
        <Link href="#" variant="brand">
          Brand link
        </Link>
        <Link href="https://example.com" external>
          External link
        </Link>
      </Row>

      <Row title="Badge">
        <Badge>Neutral</Badge>
        <Badge variant="brand">Brand</Badge>
        <Badge variant="success" srLabel="Order delivered">
          Delivered
        </Badge>
        <Badge variant="warning" srLabel="Stock low">
          Low stock
        </Badge>
        <Badge variant="danger" srLabel="Order cancelled">
          Cancelled
        </Badge>
      </Row>

      <Row title="Form controls">
        <div className="grid w-full gap-4 sm:max-w-md">
          <Field label="Email" required requiredLabel="required">
            <Input type="email" placeholder="dealer@barff.uz" />
          </Field>

          <Field label="Phone" description="Uzbek number, e.g. +998 90 123 45 67">
            <Input type="tel" placeholder="+998" />
          </Field>

          <Field label="Region" error="Please choose a region">
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Choose a region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tashkent">Toshkent</SelectItem>
                <SelectItem value="samarkand">Samarqand</SelectItem>
                <SelectItem value="bukhara">Buxoro</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Message">
            <Textarea placeholder="How can we help?" />
          </Field>

          <div className="flex flex-col gap-2">
            <CheckboxWithLabel label="Subscribe to updates" />
            <div className="flex items-center gap-2">
              <Checkbox defaultChecked id="checked-demo" />
              <label htmlFor="checked-demo" className="text-sm text-content-secondary">
                Checked
              </label>
            </div>
          </div>
        </div>
      </Row>

      <Row title="Dialog and Sheet">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Open dialog</Button>
          </DialogTrigger>
          <DialogContent closeLabel="Close">
            <DialogHeader>
              <DialogTitle>Confirm order</DialogTitle>
              <DialogDescription>
                Focus is trapped here, Escape closes, and focus returns to the trigger.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost">Cancel</Button>
              <Button>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary">Open sheet</Button>
          </SheetTrigger>
          <SheetContent side="right" closeLabel="Close">
            <SheetTitle>Filters</SheetTitle>
            <p className="text-sm text-content-secondary">
              Same modal behaviour as Dialog, positioned at an edge.
            </p>
          </SheetContent>
        </Sheet>
      </Row>

      <Row title="Tabs">
        <Tabs defaultValue="uz" className="w-full">
          <TabsList>
            <TabsTrigger value="uz">UZ</TabsTrigger>
            <TabsTrigger value="ru">RU</TabsTrigger>
            <TabsTrigger value="en">EN</TabsTrigger>
          </TabsList>
          <TabsContent value="uz">
            <p className="text-sm text-content-secondary">Arrow keys move between tabs.</p>
          </TabsContent>
          <TabsContent value="ru">
            <p className="text-sm text-content-secondary">Only the active tab is tabbable.</p>
          </TabsContent>
          <TabsContent value="en">
            <p className="text-sm text-content-secondary">Home and End jump to the ends.</p>
          </TabsContent>
        </Tabs>
      </Row>

      <Row title="Accordion">
        <Accordion type="single" collapsible className="w-full sm:max-w-lg">
          <AccordionItem value="one">
            <AccordionTrigger>Raw material intake</AccordionTrigger>
            <AccordionContent>
              Collapsed panels stay out of the accessibility tree.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="two">
            <AccordionTrigger>Quality control</AccordionTrigger>
            <AccordionContent>aria-expanded and aria-controls are wired by Radix.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </Row>

      <Row title="Toast">
        <Button variant="secondary" onClick={() => setToastOpen(true)}>
          Show toast
        </Button>
        <Toast open={toastOpen} onOpenChange={setToastOpen} variant="success">
          <div className="flex flex-col gap-1">
            <ToastTitle>Order submitted</ToastTitle>
            <ToastDescription>Announced in a live region, not just shown.</ToastDescription>
          </div>
        </Toast>
        <ToastViewport />
      </Row>

      <Row title="Skeleton">
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-8 w-2/3" srLabel="Loading" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </Row>

      <Row title="Pagination">
        <Pagination
          page={page}
          totalPages={20}
          onPageChange={setPage}
          labels={{
            navigation: 'Pagination',
            previous: 'Previous page',
            next: 'Next page',
            page: (n) => `Page ${n}`,
            status: (p, total) => `Page ${p} of ${total}`,
          }}
        />
      </Row>

      <Row title="Surfaces">
        <div className="grid w-full gap-4 sm:grid-cols-3">
          <GlassCard>
            <h3 className="font-semibold text-content-primary">GlassCard — glass</h3>
            <p className="mt-2 text-sm text-content-secondary">Translucent, thin border.</p>
          </GlassCard>
          <GlassCard tone="solid">
            <h3 className="font-semibold text-content-primary">GlassCard — solid</h3>
            <p className="mt-2 text-sm text-content-secondary">Opaque raised surface.</p>
          </GlassCard>
          <GlassCard tone="accent">
            <h3 className="font-semibold text-content-primary">GlassCard — accent</h3>
            <p className="mt-2 text-sm text-content-secondary">The one restrained gradient.</p>
          </GlassCard>
        </div>
      </Row>

      <Row title="StatBlock">
        <div className="grid w-full gap-8 sm:grid-cols-3">
          <StatBlock value="2019" label="Founded" unverified unverifiedLabel="Not verified" />
          <StatBlock value="12" unit="SKU" label="Products" />
          <StatBlock value="—" label="Daily capacity" unverified unverifiedLabel="Awaiting BARFF" />
        </div>
      </Row>

      <Row title="MediaFrame">
        <div className="grid w-full gap-4 sm:grid-cols-3">
          <MediaFrame ratio="square" caption="Product render — 1254×1254" plate>
            <div className="flex size-full items-center justify-center text-xs text-content-inverse">
              square
            </div>
          </MediaFrame>
          <MediaFrame ratio="video">
            <div className="flex size-full items-center justify-center text-xs text-content-muted">
              16:9
            </div>
          </MediaFrame>
          <MediaFrame ratio="wide">
            <div className="flex size-full items-center justify-center text-xs text-content-muted">
              21:9 hero
            </div>
          </MediaFrame>
        </div>
      </Row>

      <Section spacing="sm" tone="bordered">
        <SectionHeader
          as="h2"
          title="Section and SectionHeader"
          description="Standard vertical rhythm and heading block."
          action={<Button variant="secondary">Action</Button>}
        />
      </Section>
    </ToastProvider>
  );
}
