> **Copied from** `../slot-books/docs/DESIGN_SYSTEM.md` (the Iker product repository, read-only source of truth) on 2026-11-15.
> This is a snapshot for offline reference. If it disagrees with slot-books, slot-books wins. Do not edit this copy; re-copy it instead.

# Iker Design System

Source of truth for how the web app looks. The brand kit in
[docs/design/iker-brand-kit/](design/iker-brand-kit/) (v1.0) owns every colour, radius, shadow
and type role; this file records how `apps/web` applies it. It replaces the earlier
"Modernist" system (sharp corners, brand-red primary, Archivo). Don't invent colours, radii or
status labels per page: extend the kit, then this file.

## Where things live

| What                                                                                 | File                                                                      |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Brand tokens (verbatim kit copy, do not edit)                                        | `apps/web/app/iker-tokens.css`                                            |
| Tailwind v4 theme from the kit (verbatim, do not edit)                               | `apps/web/app/iker.theme.css`                                             |
| App mapping: shadcn variables → `--iker-*` roles, status colours in dark, chart vars | `apps/web/app/globals.css`                                                |
| Fonts                                                                                | `apps/web/app/layout.tsx` (`next/font/google`)                            |
| Logo                                                                                 | `apps/web/components/brand/logo.tsx`, artwork in `apps/web/public/brand/` |
| Favicons, PWA icons, OG image                                                        | `apps/web/public/`                                                        |

## Colour rules

The product UI is black and white. Terracotta is an accent, not a theme.

- Page `--iker-bg`, cards and inputs `--iker-surface`, menus `--iker-surface-raised`, text
  `--iker-text`, secondary text `--iker-text-muted`. Never use translucent text
  (`text-foreground/60`): it fails contrast; use `text-muted-foreground`.
- **Primary buttons are ink**: `bg-primary text-primary-foreground`. Most buttons.
- **`variant="accent"`** (`--iker-accent`, `--iker-on-accent`) is for at most one button per
  screen: the money or commitment moment (Confirm booking, Save payment, Submit booking).
- **`--iker-accent-graphic`** (`bg-accent-graphic`, `text-accent-graphic`) is the exact brand
  #E05A38. Icons, progress bars, charts and the logo dot only, never behind small text.
- **Links** use `text-accent-text`. **Focus** is a 2px `--iker-focus` outline with 2px offset,
  drawn once by the global rule in `iker-tokens.css` for every interactive element. Don't add
  per-component `focus-visible:ring-*`. An element whose parent draws the ring sets
  `data-focus-ring="inner"`.
- **Status pills** (`Badge`): `success`, `warning`, `danger`, `info` variants are the role's
  text on its `-bg` tint, and always carry a word. Booking statuses map in
  `components/shared/booking-status-badge.tsx` (`confirmed`/Booked uses the primary brand color,
  `completed` uses success, `pending`/`overdue` warning, `cancelled` danger, `refunded` info).
- Charts use `var(--chart-1)` … `var(--chart-6)` in order.
- The kit ships light-only status colours for web; the dark values in `globals.css` are the
  kit's own Flutter dark palette.
- **Tenant brand colour**: a business's own colour still overrides `--primary` inside
  `[data-brand-scope]` on its public booking pages only (`components/public/brand-scope.tsx`).
  Iker chrome, dashboard and admin never use it.

Because `shadcn` names are kept, mind the one rename: `accent` is now the kit's terracotta.
The old hover-surface "accent" is `muted` (`hover:bg-muted`).

## Shape

- `--iker-radius-md` (14px, `rounded-md`) for buttons and inputs, `rounded-lg` (20px) for cards
  and dialogs, `rounded-full` only for pills, avatars and switches.
- Hairline `border-border` instead of shadows. Shadows only on menus, popovers, dialogs, sheets
  and toasts (`shadow-md` / `shadow-lg`). `--shadow-card` is `none`.
- Buttons and inputs are **52px** (`h-13`) below `md` and **40px** from `md` up. Dense dashboard
  controls use `h-10`; `size="sm"` buttons are 36px.

## Type

- **Plus Jakarta Sans** (400–800) is `font-sans` and `font-heading`; **JetBrains Mono** (400, 600) is `font-mono`, used for receipts and codes.
- The kit's scales are available as classes: `iker-web-*` for marketing pages, `iker-dash-*` for
  the dashboard. Headings use 700; 800 is for marketing display only.
- **Money** is naira (`₦45,000`, from `formatKobo` / `<MoneyDisplay>`) with tabular figures.
  `body` sets `font-variant-numeric: tabular-nums` app-wide so no amount can forget it.
- Sentence case for buttons and headings, second person ("Your bookings"), no emoji in product
  UI. Small uppercase eyebrow labels are fine; buttons and headings are never uppercase.

## Dark mode

Follows the system by default. `lib/theme/preference.ts` (inline script in `<head>`, runs before
first paint) resolves the Light/Dark/System preference and sets `data-theme="light|dark"` on
`<html>`, plus a legacy `dark` class. The kit's tokens read `data-theme` (and
`prefers-color-scheme` when it is absent); Tailwind's `dark:` variant is the kit's
`data-theme="dark"` variant. The sidebar toggle writes the preference. Storage keys
(`slotbooks-theme`) were not renamed, so existing preferences survive.

`tests/theme-contrast.test.ts` verifies every text pairing at WCAG AA in both themes, and
`tests/theme-hardcoded-colors.test.ts` fails on any hex, `rgb()` or palette class in `app/` and
`components/` without a `theme-guard-allow: <reason>` marker. Emails and PDFs cannot read CSS
variables, so they copy the light roles by value (`supabase/functions/_shared/email/layout.ts`,
`apps/web/lib/statements/pdf.ts`).

## Logo

Use `<Logo variant height surface />`. Variants: `horizontal`, `horizontal-tagline`,
`vertical-tagline`, `wordmark`, `emblem`. `surface="auto"` follows the theme; pin `light` or
`dark` on a surface that doesn't change with the theme (the auth screen's brand panel).
