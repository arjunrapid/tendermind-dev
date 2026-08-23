'use client';

/**
 * Shared TenderMind design primitives.
 *
 * The design leans on hairline rules and 1px-gap grids instead of borders and
 * shadows: a "card" is really a cell of a grid whose background shows through
 * as the dividing line. These helpers keep that consistent so screens don't
 * drift into hand-tuned spacing.
 */

import Link from 'next/link';
import { ReactNode, useEffect } from 'react';

export function MicroLabel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`micro ${className}`}>{children}</div>;
}

/** Sample data carries this chip so demo content is never mistaken for real. */
export function SampleChip({ label = 'sample' }: { label?: string }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-45 border border-line px-1.5 py-0.5">
      {label}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  meta,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-line pb-6 mb-8">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          {eyebrow ? <MicroLabel className="mb-2">{eyebrow}</MicroLabel> : null}
          <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.03em]">{title}</h1>
          {meta ? <div className="mt-3 font-mono text-[12px] text-ink-60">{meta}</div> : null}
        </div>
        {actions ? <div className="flex items-center gap-3 shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}

type BtnVariant = 'accent' | 'ink' | 'outline';

const BTN_VARIANTS: Record<BtnVariant, string> = {
  accent: 'bg-accent text-cream hover:bg-ink',
  ink: 'bg-ink text-cream hover:bg-accent',
  outline: 'border border-line-strong text-ink hover:bg-ink hover:text-cream hover:border-ink',
};

export function Btn({
  children,
  onClick,
  href,
  variant = 'outline',
  type = 'button',
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: BtnVariant;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  const classes = `inline-flex items-center justify-center px-4 py-2.5 text-[13px] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${BTN_VARIANTS[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}

/**
 * Stat tiles sit in a grid whose 1px gaps expose the line-coloured background,
 * producing the hairline separators without per-cell borders.
 */
export function StatTileGrid({
  children,
  cols = 3,
  className = '',
}: {
  children: ReactNode;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={`grid gap-px bg-line border border-line ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  caption,
  tone = 'ink',
  mono = true,
}: {
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  tone?: 'ink' | 'accent' | 'ok' | 'warn' | 'danger';
  mono?: boolean;
}) {
  const toneClass = {
    ink: 'text-ink',
    accent: 'text-accent',
    ok: 'text-ok',
    warn: 'text-warn',
    danger: 'text-danger',
  }[tone];

  return (
    <div className="bg-panel px-5 py-4">
      <div className="text-[11px] text-ink-60">{label}</div>
      <div
        className={`mt-2 text-[26px] leading-tight ${mono ? 'font-mono' : 'font-semibold'} ${toneClass}`}
      >
        {value}
      </div>
      {caption ? <div className="mt-1.5 text-[11px] text-ink-45">{caption}</div> : null}
    </div>
  );
}

export function riskTone(level?: string | null): 'ok' | 'warn' | 'danger' | 'ink' {
  const l = (level || '').toUpperCase();
  if (l === 'LOW') return 'ok';
  if (l === 'MEDIUM') return 'warn';
  if (l === 'HIGH') return 'danger';
  return 'ink';
}

export function riskTextClass(level?: string | null): string {
  return {
    ok: 'text-ok',
    warn: 'text-warn',
    danger: 'text-danger',
    ink: 'text-ink-45',
  }[riskTone(level)];
}

/** Decision chip with the 2px left rule used throughout the pipeline views. */
export function DecisionChip({ decision }: { decision?: string | null }) {
  const d = (decision || '').toUpperCase();
  const map: Record<string, { label: string; cls: string }> = {
    YES: { label: 'Bid', cls: 'border-ok text-ok' },
    NO: { label: 'No bid', cls: 'border-danger text-danger' },
    MANUAL_REVIEW: { label: 'Review', cls: 'border-accent text-accent' },
  };
  const item = map[d] || { label: '—', cls: 'border-line-strong text-ink-45' };

  return (
    <span className={`inline-block border-l-2 pl-2 text-[12px] font-medium ${item.cls}`}>
      {item.label}
    </span>
  );
}

/** Paragraph with a left rule — the design's way of marking an assessment. */
export function RuledNote({
  children,
  tone = 'line',
}: {
  children: ReactNode;
  tone?: 'line' | 'accent' | 'danger';
}) {
  const border = {
    line: 'border-line-strong',
    accent: 'border-accent',
    danger: 'border-danger',
  }[tone];

  return (
    <div className={`border-l-2 ${border} pl-4 text-[13px] leading-[1.65] text-ink-72`}>
      {children}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  width = 720,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(23,23,20,.32)' }}
      onClick={onClose}
    >
      <div
        className="tm-in bg-cream border border-line-strong w-full max-h-[88vh] overflow-y-auto"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-7 py-5 border-b border-line">
          <div>
            {eyebrow ? <MicroLabel className="mb-1.5">{eyebrow}</MicroLabel> : null}
            {title ? (
              <div className="text-[20px] font-semibold tracking-[-0.02em]">{title}</div>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-ink-45 hover:text-ink text-[18px] leading-none"
          >
            ×
          </button>
        </div>
        <div className="px-7 py-6">{children}</div>
      </div>
    </div>
  );
}

/** Marketing chrome shared by /welcome, /pricing and /login. */
export function MarketingShell({
  children,
  ctaHref = '/login',
  ctaLabel = 'Open workspace',
}: {
  children: ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="min-h-screen bg-cream text-ink flex flex-col">
      <header className="border-b border-line">
        <div className="max-w-[1180px] mx-auto px-8 h-[68px] flex items-center justify-between gap-6">
          <Link href="/welcome" className="flex items-center gap-2">
            <span className="text-[17px] font-semibold tracking-[-0.02em]">TenderMind</span>
            <span className="h-1.5 w-1.5 rounded-full bg-accent inline-block" />
          </Link>
          <nav className="flex items-center gap-7 text-[13px]">
            <Link href="/welcome" className="text-ink-60 hover:text-ink">
              Product
            </Link>
            <Link href="/pricing" className="text-ink-60 hover:text-ink">
              Pricing
            </Link>
            <Link href="/login" className="text-ink-60 hover:text-ink">
              Sign in
            </Link>
            <Btn href={ctaHref} variant="outline" className="!py-2 !px-3.5">
              {ctaLabel}
            </Btn>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line mt-24">
        <div className="max-w-[1180px] mx-auto px-8 py-10 flex items-center justify-between gap-6 flex-wrap">
          <div className="micro">TenderMind · Tender intelligence</div>
          <div className="text-[12px] text-ink-45">
            Your documents are never used to train models.
          </div>
        </div>
      </footer>
    </div>
  );
}
