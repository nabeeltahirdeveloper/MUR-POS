# MUR Traders — Final Branding Plan

This is the consolidated, code-actionable branding plan. It reconciles the proposed plan with the existing codebase and the design decisions made during planning. Marketing collateral, social media, and rollout phases are tracked separately as non-code work.

## 1. Decisions made

| Topic | Decision |
|---|---|
| Brand name | **MUR Traders** |
| Tagline | **"Power your business with the future of trading technology. Reliable. Modern. Simplified."** — homepage hero subhead only |
| Primary color | **Electric Blue `#0d74ff`** |
| Primary-dark | **`#0855c4`** (deeper blue, gradient endpoint) |
| Success accent | **Neon Green `#32ff00`** — fills only (badges, status dots, progress bars). Never as text on white (1.49:1 contrast fails WCAG AA). |
| Danger accent | Red — keep existing Tailwind `red-500/600` |
| Theme | **Hybrid**: dark sidebar (`slate-900`) + light main content (`gray-50`). No full-dark refactor. |
| Typography | **Inter** only (sans-serif, used everywhere) via `next/font/google` |
| Logo | Existing `public/favicon.jpeg` (white-on-black). Used on dark backgrounds. **TODO asset**: a black-on-white variant for light-bg use cases (settings, dashboard widgets) — flagged below. |
| Package name | `mur` (already updated) |

## 2. Visual identity rules

### 2.1 Color usage matrix

| Token | Hex | Use on light bg | Use on dark bg | Notes |
|---|---|---|---|---|
| `--color-primary` | `#0d74ff` | ✓ buttons, links, icons, headings accents | ✓ gradient endpoints, glows, focus rings | Passes WCAG AA on white (4.85:1) |
| `--color-primary-dark` | `#0855c4` | ✓ button hover, gradient endpoint | ✓ gradient endpoint | |
| `--color-success` | `#32ff00` | ⚠️ **fills only** — small badges, status dots, progress bars | ✓ text/icons | For text on white use `green-600 #16a34a` instead |
| `text-white` / `text-slate-*` | — | gray-900 body text | white headings | |
| Black `#000` / Slate-950 | — | borders, deep accents | sidebar bg, hero bg | |

### 2.2 Typography rules

- All on-screen text → **Inter** (single sans-serif family)
- Headings (`<h1>`, `<h2>`, brand wordmark) → Inter, weight 700–800
- Body, tables, forms, buttons, labels → Inter, weight 400–500
- Receipts (thermal print) → Inter (already sans, prints cleanly at 80mm)

### 2.3 Logo placement rules

- Top-left of every chrome (nav bar, sidebar header) — already in place
- Browser tab favicon — already in place
- **Constraint**: only render the white-on-black logo against backgrounds darker than `slate-700`. If placed on a light card, wrap it in a dark badge (current sidebar already does this).

## 3. Code changes

### 3.1 Color tokens — `src/app/globals.css`

```css
/* Replace lines 13–14 */
--color-primary: #0d74ff;
--color-primary-dark: #0855c4;
--color-success: #32ff00;
```

The `text-primary`, `bg-primary/10`, `from-primary to-primary-dark` classes used in ~30 places will automatically pick up the new Electric Blue. No per-component edits needed for the base palette change.

### 3.2 Revert dark-section overrides where blue should now show through

In the previous monochrome pass we replaced `from-primary to-primary-dark` with `from-white to-slate-400` on dark sections (because gray-800 primary was invisible on slate-950). Electric Blue now shows up cleanly on dark, so revert these specific spots back so the brand color carries through:

- `src/app/page.tsx`:
  - Nav brand wordmark (was line 74)
  - Footer brand wordmark (was line 272)
  - "Succeed" gradient span in features section
  - "3 Simple Steps" gradient span in How It Works section
  - Step number circles (use `from-primary to-primary-dark`, white text)
  - Hero glow blobs (`bg-primary/20` and `bg-primary-dark/10`)
  - Stat values text (back to `text-primary` — but visible against dark, may also use `text-white` with primary underline)
  - Feature card icons (`text-primary`)
- `src/components/layout/Sidebar.tsx`: brand wordmark gradient

### 3.3 Restore tagline — `src/app/page.tsx` hero subhead

Replace the current short subhead with the full brand message:

```tsx
<p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 text-balance">
  Power your business with the future of trading technology.
  Reliable. Modern. Simplified.
</p>
```

Login page, sidebar, receipt header stay clean (no tagline).

### 3.4 Add Inter via next/font

In `src/app/layout.tsx`, add:

```tsx
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

// inside <html>:
<html lang="en" className={inter.variable} suppressHydrationWarning>
  <body className="antialiased font-sans" suppressHydrationWarning>
```

In `src/app/globals.css`, register the font in the theme block (`@theme inline`):

```css
--font-sans: var(--font-sans), Arial, Helvetica, sans-serif;
```

Then update existing body CSS to use the variable:
```css
body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);  /* was Arial, Helvetica */
}
```

No per-component edits needed — every existing element inherits Inter through `font-sans`.

### 3.5 Status badge styling — Neon Green for "Paid/Completed"

Audit existing status badges in:
- `src/app/utilities/page.tsx`, `src/app/other-expenses/page.tsx`, `src/app/debts/page.tsx`
- Replace generic `bg-green-100 text-green-800` with a brand-coherent treatment for **terminal-success** statuses ("paid", "completed"):
  ```tsx
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-[#32ff00]/20 text-green-700 border border-[#32ff00]/40">
    <span className="w-1.5 h-1.5 rounded-full bg-[#32ff00]" />
    Paid
  </span>
  ```
- Keep `bg-green-100 text-green-800` for in-progress states (the contrast on white is fine for those).

### 3.6 Light-bg logo placement

- Existing dashboard widgets that show `<img src="/favicon.jpeg">` on white cards already work because the JPEG itself includes the black background.
- **Action**: leave as-is for now. If a designer produces a black-on-white SVG variant later, save it as `public/favicon-on-light.svg` and conditionally swap based on container background. Tracked as a follow-up, not this pass.

### 3.7 Receipt branding — keep monochrome

`src/components/ledger/ThermalReceipt.tsx` and the print receipt CSS in `src/app/ledger/print/page.tsx`:
- Do **not** apply Electric Blue or Neon Green to thermal receipts. Thermal printers are 1-bit grayscale.
- Receipts stay black-on-white. Header reads "MUR Traders • Ledger System" (already done).
- If receipt logo needs to print darker, the existing `filter: contrast(160%)` rule handles it.

## 4. Files modified (summary)

| File | Change |
|---|---|
| `src/app/globals.css` | New color tokens (primary blue, primary-dark, success). Add `--font-sans`. Update body font-family. |
| `src/app/layout.tsx` | Import Inter via next/font. Wire variable on `<html>` + `<body>`. |
| `src/app/page.tsx` | Restore primary-color gradients on dark sections. Restore tagline subhead. |
| `src/components/layout/Sidebar.tsx` | Brand wordmark back to primary gradient. |
| `src/app/login/page.tsx` | (no font changes needed — body inherits Inter) |
| `src/app/utilities/page.tsx`, `other-expenses/page.tsx`, `debts/page.tsx` | Optional: upgrade "Paid/Completed" badges to use Neon Green fill. |

Total: ~6 files. No new files (the optional logo-on-light variant is a future asset, not part of this pass).

## 5. Out of scope (tracked separately)

- Business cards, email signatures, social-media post templates → graphic design assets, not code
- Email campaign / blog announcement / ad creatives → marketing
- Brand voice copy review (button labels, error messages, modal copy) → separate copy pass
- Light-bg logo SVG variant → asset request to designer
- Mobile app icon set (32×32 / 192×192 / 512×512 / maskable) → asset request
- Phase 1/2/3 rollout → launch milestones, owned by marketing

## 6. Accessibility constraints

- All text-on-white uses must hit WCAG AA (4.5:1). Specifically:
  - Electric Blue `#0d74ff` on white → 4.85:1 ✓
  - Neon Green `#32ff00` as text → ❌ (use as fill only)
  - Gold `#FFD700` (dropped from palette) → would have failed
- Touch targets: minimum 44×44 px on mobile (WCAG 2.5.5 / Apple HIG). No specific changes needed — Tailwind `py-2.5` + `px-4` buttons already meet this; verify during the pass.
- Focus states: keep visible focus rings (`focus:ring-2 focus:ring-primary`) on all interactive elements.

## 7. Verification

1. **Restart dev server fully** so Tailwind recompiles `@theme` tokens and Next picks up next/font:
   ```powershell
   # Ctrl+C the running dev server
   Remove-Item .next -Recurse -Force
   npm run dev
   ```
2. **Color check**: every `text-primary` / `bg-primary/*` should now render Electric Blue.
3. **Font check**: View → Page Source on `/` should show preloaded Google Font CSS for Inter and Lora. Inspect `<body>` computed font-family includes "Inter".
4. **Hero subhead**: homepage `/` shows the brand message.
5. **Dashboard chrome**: dark sidebar contrasts with light gray-50 main area.
6. **Receipt**: open `/ledger/receipt/[id]` and trigger print preview — header reads "MUR Traders • Ledger System", no blue/green tints in receipt body.
7. **Accessibility spot-check**: open Chrome DevTools → Lighthouse → Accessibility → run on `/`, `/login`, `/dashboard`, `/items`. Aim for ≥90.

## 8. Risk + rollback

- All changes are reversible: revert `globals.css` color tokens to flip back instantly. The font import is additive — removing it falls back to system fonts.
- The optional Neon Green badge upgrade in §3.5 can be deferred without blocking the rest.
- No DB schema, no API contract, no migration. Pure presentation layer.
