---
name: ProofMe
description: Your work, confirmed by the people who saw it.
colors:
  canvas: "#fbf8f3"
  surface: "#ffffff"
  surface-2: "#f4f0e8"
  line: "#e9e3d8"
  line-strong: "#d9d1c3"
  ink: "#1b1a2e"
  muted: "#5a5770"
  faint: "#8a8799"
  brand: "#2f54eb"
  link: "#2f54eb"
  highlight: "#c9f4e6"
  highlight-ink: "#0b6b57"
  ok: "#d9f7ec"
  ok-ink: "#0b6b57"
  wait: "#ffefcc"
  wait-ink: "#7a5300"
  bad: "#ffe3df"
  bad-ink: "#a3241b"
  dark-canvas: "#12121f"
  dark-surface: "#1a1a2b"
  dark-surface-2: "#232338"
  dark-ink: "#f3f0ea"
  dark-muted: "#aaa7bf"
  dark-link: "#93a8ff"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 6.2vw, 4.75rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.045em"
  heading:
    fontFamily: "Bricolage Grotesque, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Bricolage Grotesque, Segoe UI, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Figtree, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0em"
  label:
    fontFamily: "Figtree, Segoe UI, system-ui, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0em"
  digest:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0em"
rounded:
  card: "28px"
  well: "16px"
  input: "14px"
  mark: "12px"
  pill: "999px"
spacing:
  gutter: "clamp(1.25rem, 4vw, 4rem)"
  section: "clamp(5rem, 8vw, 7rem)"
  card-pad: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "0.7rem 1.4rem"
    height: "2.875rem"
  button-primary-hover:
    backgroundColor: "{colors.brand}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.7rem 1.4rem"
    height: "2.875rem"
  chip-ok:
    backgroundColor: "{colors.ok}"
    textColor: "{colors.ok-ink}"
    rounded: "{rounded.pill}"
  chip-wait:
    backgroundColor: "{colors.wait}"
    textColor: "{colors.wait-ink}"
    rounded: "{rounded.pill}"
  chip-bad:
    backgroundColor: "{colors.bad}"
    textColor: "{colors.bad-ink}"
    rounded: "{rounded.pill}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    height: "2.875rem"
---

# Design System: ProofMe

Written from the built public site. `app/globals.css` is the source of truth for values. This
replaces the first design ("The Credits"), which the user rejected; the replacement was chosen
by the user after Dribbble research, from three full-colour options.

## Overview

**Creative North Star: "People first"**

ProofMe is about people and the work they did, so the interface leads with people and work:
names, organisation marks, timelines and records, shown as real product cards rather than
described in paragraphs. It should feel warm, friendly and modern, closer to a well-made
portfolio product than to a registry or a crypto dashboard.

Light theme is a warm off-white canvas with white cards. Dark theme is a deep blue-black with
raised navy cards. Both use the same tokens; dark follows the system setting unless the visitor
chooses with the theme switch, and the choice is remembered on that device.

**Key Characteristics:**

- Show the product: every major section contains a working or realistic piece of the product.
- Soft white cards with large radii and a gentle shadow on a warm canvas.
- A bold, friendly grotesque for headlines, with one highlighted word in mint.
- Colourful organisation marks (rounded squares with an initial) give records personality.
- Pill-shaped buttons and status chips.
- Status is always a symbol plus words in a reserved colour.

## Colors

### Primary

- **Ink** (`#1b1a2e`; dark: `#f3f0ea`): text and the primary button.
- **Canvas** (`#fbf8f3`; dark: `#12121f`) and **Surface** (`#ffffff`; dark: `#1a1a2b`): the page
  and its cards. **Surface 2** (`#f4f0e8`; dark: `#232338`) for wells, inset areas and
  alternating sections.

### Secondary

- **Brand blue** (`#2f54eb`): the logo mark, the hover state of primary buttons, icon tiles.
- **Link** (`#2f54eb`; dark: `#93a8ff`): links and focus rings.

### Tertiary

- **Highlight mint** (`#c9f4e6` with `#0b6b57` text; dark: `#143f35` with `#84e6c6`): the one
  highlighted word in a headline, icon tiles, numbered markers, text selection.
- **Organisation marks** use any saturated colour (sample records use `#4c6ef5`, `#e8590c`,
  `#0f8b72`). They identify an organisation and never mean a status.

### Status (reserved)

- **Ok** (`#d9f7ec` / `#0b6b57`): verified, confirmed, matched.
- **Wait** (`#ffefcc` / `#7a5300`): in review, awaiting anchor, needs information.
- **Bad** (`#ffe3df` / `#a3241b`): no match, rejected, revoked, failed.
  Each has a dark-theme pair in `globals.css`.

### Named Rules

**The Reserved Colours Rule.** Ok, wait and bad fills appear only on statuses, always with a
symbol and words. Mint highlight is not a status colour and never sits on a status.

**The One Highlight Rule.** At most one highlighted word per headline, and not on every page.

## Typography

**Display:** Bricolage Grotesque, 700–800, tight tracking (−0.03em to −0.045em).
**Body:** Figtree, 400–700.
**Data:** Geist Mono, for digests, transaction hashes and account IDs only.

### Hierarchy

- **Display** (800, `clamp(2.6rem, 6.2vw, 4.75rem)`, 0.98): page heroes.
- **Heading** (700, `clamp(2rem, 4vw, 3rem)`, 1.04): section headings.
- **Title** (700, 1.25rem): card and step titles.
- **Body** (400, 1rem, 1.55); lead paragraphs at 1.08–1.15rem in the muted colour.
- **Label** (600, 0.82rem, muted or faint): field and data labels. Never set above a heading.

## Layout

One centred column, 76rem at most. Heroes split text and product side by side on large screens
and stack on small ones. Sections are separated by generous space and, where useful, by an
alternating Surface 2 band. Reading pages put the section heading on the left and its content
card on the right.

## Elevation & Depth

Cards have a 1px line border and one soft, offset shadow (`--shadow-card`). Wells inside cards
are flat Surface 2 with no border or shadow. Nothing is nested more than card → well.

## Shapes

Cards 28px, wells 16px, inputs 14px, organisation marks and icon tiles 12–16px, buttons and chips
fully round.

## Components

### Logo

A white check on a blue (`#2f54eb`) rounded square, followed by the wordmark "ProofMe" in
Bricolage Grotesque 800. The mark alone is the favicon (`app/icon.svg`).

### Buttons

- **Primary:** Ink pill with canvas text; hover turns it brand blue. In dark theme it inverts.
- **Secondary:** Surface pill with a 1.5px strong line; hover darkens the border.
- Pressed moves 1px down. Disabled is 55% opacity with a not-allowed cursor.

### Status chips

Pill, 0.8rem bold, a Lucide icon plus words, reserved colour.

### Inputs

Surface fill, 1.5px strong border, 14px radius, 2.875rem tall. Focus shows a 2.5px link-coloured
ring. Errors turn the border bad-ink and show an icon and message beneath, tied to the field.

### Navigation

A light header: logo, three links, theme switch, Sign in (secondary) and Start your record
(primary). Below 1024px the links move into a menu card; below 640px the account buttons move
into it too.

### Signature components

- **Sample timeline:** a profile card with a vertical timeline of records, each with an
  organisation mark and a status chip.
- **Record check:** a record card whose digest the visitor recomputes in the browser; editing
  the role turns the result from Match to No match.

## Motion

Hero content rises 1rem into place once on load. A recomputed digest wipes in left to right and
its result chip pops in. Hover changes take 180ms. All of it is off under reduced motion, and
nothing is ever hidden while it animates.

## Do's and Don'ts

### Do:

- **Do** show a real or realistic piece of the product in every major section.
- **Do** label sample people, organisations and records as samples wherever they appear.
- **Do** keep approval and NEAR anchoring visibly separate.
- **Do** check every screen in both themes.

### Don't:

- **Don't** put a small label above a heading.
- **Don't** show avatars, logos, counts or quotes that imply users or partners who do not exist.
- **Don't** use neon, purple glow, glassmorphism or gradient text.
- **Don't** use status colours for decoration.

## Status vocabulary (product truth the design must carry)

| Fact                           | Meaning                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| Organisation approved          | A reviewer of the issuer approved the claim (off-chain).                               |
| Awaiting NEAR anchor           | Approved; no confirmed transaction yet.                                                |
| NEAR anchor confirmed          | A confirmed transaction stores the matching digest.                                    |
| NEAR anchor failed             | The transaction failed or was rejected; approval still stands.                         |
| Revoked / superseded           | No longer valid; history stays visible.                                                |
| Platform-verified organisation | A ProofMe admin reviewed the organisation. Separate from its NEAR issuer registration. |

## Not yet designed

The signed-in workspace. Its layout was chosen by the user (a top bar with side navigation) and
will be built in this system in Milestone 2.
