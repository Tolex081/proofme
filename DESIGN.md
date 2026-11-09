---
name: ProofMe
description: Work credited the way films and records credit people, and checkable by anyone.
colors:
  ink: "#0f1830"
  ink-raised: "#17223d"
  ink-line: "#2f3b5c"
  on-ink: "#f5f0e6"
  on-ink-muted: "#b3bbd0"
  paper: "#f5f0e6"
  paper-deep: "#ece5d6"
  paper-line: "#d3c9b5"
  on-paper: "#141b2e"
  on-paper-muted: "#4a5166"
  teal: "#0b6e70"
  teal-bright: "#62d2c9"
  ok: "#1a6e3f"
  ok-bright: "#74d6a0"
  wait: "#855600"
  wait-bright: "#f0c267"
  bad: "#a8322b"
  bad-bright: "#ff9d91"
typography:
  display:
    fontFamily: "Jost, Century Gothic, Avenir Next, sans-serif"
    fontSize: "clamp(2.2rem, 4.3vw, 3.3rem)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.022em"
  heading:
    fontFamily: "Jost, Century Gothic, Avenir Next, sans-serif"
    fontSize: "clamp(1.7rem, 3.1vw, 2.4rem)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.016em"
  name:
    fontFamily: "Jost, Century Gothic, Avenir Next, sans-serif"
    fontSize: "clamp(1.2rem, 1.9vw, 1.6rem)"
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: "-0.012em"
  role:
    fontFamily: "Jost, Century Gothic, Avenir Next, sans-serif"
    fontSize: "0.74rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.14em"
  body:
    fontFamily: "Atkinson Hyperlegible Next, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0em"
  digest:
    fontFamily: "Atkinson Hyperlegible Mono, ui-monospace, Cascadia Mono, monospace"
    fontSize: "0.82rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.01em"
rounded:
  focus: "2px"
  control: "6px"
spacing:
  gutter: "clamp(1.25rem, 4vw, 3rem)"
  axis-gap: "clamp(1rem, 2.4vw, 2rem)"
  credit-row: "clamp(0.7rem, 1.6vh, 1.15rem)"
  section: "clamp(3.5rem, 8vw, 6rem)"
components:
  action-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "0.6rem 1.15rem"
    height: "2.75rem"
  action-primary-hover:
    backgroundColor: "{colors.teal}"
  action-primary-on-ink:
    backgroundColor: "{colors.teal-bright}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0.6rem 1.15rem"
    height: "2.75rem"
  action-primary-on-ink-hover:
    backgroundColor: "{colors.paper}"
  text-link:
    textColor: "{colors.teal}"
  text-link-on-ink:
    textColor: "{colors.teal-bright}"
  role-label:
    textColor: "{colors.on-paper-muted}"
    typography: "{typography.role}"
  role-label-on-ink:
    textColor: "{colors.on-ink-muted}"
    typography: "{typography.role}"
---

# Design System: ProofMe

Written from the built public website (Milestone 1). The values above are the ones in
`app/globals.css`; that file is the source of truth. Screens for the signed-in product are not
built yet, and the sections that will govern them are marked.

## Overview

**Creative North Star: "The Credits"**

ProofMe credits work the way films and records credit people: the role beside the name, and
beneath them who signs off. Every page is built on one vertical axis. Roles sit small, uppercase
and tracked to its left, right-aligned against it. Names and facts sit large to its right. A
visitor learns the layout once, on the first screen, and then reads every later page the same way.

The site alternates two grounds. Deep ink is the title card: every page opens on it, and the site
closes on it. Warm paper is the liner note, where the reading happens. The person using this is a
judge, a grant reviewer or a contributor at a desk in daylight, comparing many things quickly, so
reading surfaces are light and the ink is kept for openings and closings.

The system has to stay warm. Verification products drift toward registries and compliance tools;
this one is about people and what they made. Names are always the largest thing in a credit, the
grounds are warm rather than grey, and the copy says plainly what was and was not checked.

**Key Characteristics:**

- One axis on every page; role left of it, name right of it.
- Two grounds, ink and paper, owning whole regions rather than appearing as accents.
- One geometric sans for both voices, from the film title-card tradition.
- Hairlines between credit groups. Nothing is boxed.
- Teal means "you can press this". Green, amber and red mean a status and nothing else.
- Digests and transaction references in a mono face, because they are data.

## Colors

Two grounds, each with its own text, muted text and hairline. One action colour with a value for
each ground. Three reserved status colours, each with a value for each ground.

### Primary

- **Ink** (`#0f1830`): the title-card ground. Page openers, the header, the footer.
- **Paper** (`#f5f0e6`): the liner-note ground. All long reading.
- **Paper Deep** (`#ece5d6`): alternates with Paper to separate consecutive reading sections.

### Secondary

- **Teal** (`#0b6e70`) on paper and **Teal Bright** (`#62d2c9`) on ink: links, the primary action
  on ink, the current navigation item, focus rings, text selection.

### Tertiary

- **Ok** (`#1a6e3f` / `#74d6a0`): a confirmed match, a verified and anchored attestation.
- **Wait** (`#855600` / `#f0c267`): awaiting review, awaiting anchor, needs information.
- **Bad** (`#a8322b` / `#ff9d91`): no match, rejected, revoked, anchor failed, errors.

### Neutral

- **On Ink** (`#f5f0e6`) and **On Ink Muted** (`#b3bbd0`): text on ink. The muted value is tinted
  from the ink's own hue, never a neutral grey.
- **On Paper** (`#141b2e`) and **On Paper Muted** (`#4a5166`): text on paper.
- **Ink Line** (`#2f3b5c`) and **Paper Line** (`#d3c9b5`): the hairlines.

### Named Rules

**The Reserved Colours Rule.** Green, amber and red are never decoration. Each appears only when
it is reporting a status, and always with a symbol and the status written in words.

**The Two Values Rule.** Any colour that can appear on both grounds has a value for each. Use the
bright value on ink and the deep value on paper; never one value on both.

## Typography

**Display and credit face:** Jost (with Century Gothic, Avenir Next, sans-serif).
**Reading face:** Atkinson Hyperlegible Next (with Segoe UI, system-ui).
**Data face:** Atkinson Hyperlegible Mono.

**Character:** Jost is a geometric sans in the tradition of film title cards, which is where this
system's layout comes from. It carries headings, names and role labels. Atkinson Hyperlegible was
drawn for legibility and carries everything a person reads at length.

### Hierarchy

- **Display** (500, `clamp(2.2rem, 4.3vw, 3.3rem)`, 1.05): the page's one heading on a title card.
- **Heading** (500, `clamp(1.7rem, 3.1vw, 2.4rem)`, 1.1): section headings on paper.
- **Name** (500, `clamp(1.2rem, 1.9vw, 1.6rem)`, 1.12): the right-hand side of a credit. The
  contribution's own title steps up to `clamp(1.5rem, 2.7vw, 2.3rem)`.
- **Body** (400, 17px base, 1.55): reading text, held to 58–66 characters a line.
- **Role** (500, 0.74rem, tracking 0.14em, uppercase): the left-hand side of a credit.
- **Digest** (400, 0.82rem, tabular figures): hashes and transaction references only.

### Named Rules

**The Name Is Largest Rule.** In any credit, the name or fact is larger than its role, and the
contribution is the largest line in its block.

**The Data Face Rule.** The mono face is for digests, transaction hashes and account IDs. It is
never used to make something look technical.

## Layout

One content column, 74rem at most, with a fluid gutter. Inside it, `.credits` is a two-column
grid: the first column is `--axis` wide (30% of the column, never less than 5.75rem) and the
second takes the rest. Headings, paragraphs and actions start on the axis (`.from-axis`), so the
left column stays empty except for roles. That emptiness is the layout, not wasted space.

Below 40rem, headings and prose take the full width and prose pairs stack with the role above
(`.stack-sm`). Short credit pairs, such as the sample record, keep the axis at every width.

Sections are separated by a change of ground and generous vertical space, with more space above a
heading than below it. Reading sections alternate Paper and Paper Deep.

## Elevation & Depth

There is none. The system is flat: no shadows, no cards, no layered surfaces. Separation comes
from the two grounds and from hairlines.

### Named Rules

**The Nothing Is Boxed Rule.** Groups are separated by a 1px hairline or by space. Content is not
put in bordered or shadowed containers.

## Shapes

Controls have a 6px radius. Focus rings have a 2px radius, a 2px outline in the teal for that
ground and a 3px offset. Nothing else is rounded. Icons are Lucide, at a 2 to 2.25 stroke, sized
15–20px, and always accompany words.

## Components

### Buttons

- **Primary on ink:** Teal Bright ground, ink text, 6px radius, at least 2.75rem tall. Hover turns
  the ground to Paper. Pressed moves it down 1px. Disabled drops to 55% opacity with a
  not-allowed cursor.
- **Primary on paper:** Ink ground, paper text. Hover turns the ground to Teal.
- **Text link:** teal for its ground, weight 600, underlined, often with a trailing arrow. Hover
  takes the ground's text colour.

### Inputs / Fields

Built so far: the inline credit field. It is the value side of a credit made editable: transparent
ground, a dashed underline in the muted text colour, name-sized type. Hover and focus turn the
underline teal; focus makes it solid. A plain-language hint sits beneath it. Full form fields for
the signed-in product are not designed yet.

### Navigation

The header is an ink strip. The wordmark sits against the left of the axis and the links start on
it. The current page is underlined in Teal Bright. Below 48rem the links collapse behind a
"Menu" button with a text label, which opens a full-width list and closes on Escape or on choosing
a link. A skip link is the first focusable element. The footer is the end card: the site's own
credits, on the same axis.

### The Credit Block (signature component)

A `<dl>` on the `.credits` grid. Each `<dt>` is a role; each `<dd>` a name or fact. A hairline
separates the description from the digests. On the landing page the block is live: the role is
editable, and a button recomputes the record's SHA-256 digest in the browser and reports in words
whether it matches the recorded one.

### Status Line

A status is a symbol, the status in words, and one sentence saying what it means, in the reserved
colour for its ground. The seven attestation statuses are listed on the How it works page.

## Do's and Don'ts

### Do:

- **Do** start headings, paragraphs and actions on the axis.
- **Do** put the actor, role or kind of fact in the left column, and the name or fact on the right.
- **Do** open every page on an ink title card with one heading and one paragraph.
- **Do** say what a status means in words next to it.
- **Do** label sample content as a sample wherever it appears.
- **Do** keep approval and NEAR anchoring visibly separate. A record is shown as anchored only
  with a confirmed transaction.

### Don't:

- **Don't** put a small label above a heading. A role sits beside its name, never over a headline.
- **Don't** box content in cards, or add shadows, gradients, glass or glow.
- **Don't** use green, amber or red for anything that is not a status.
- **Don't** show a count, score or badge that is not derived from real, currently valid records.
- **Don't** let the page feel like a registry: no seals, stamps, shields or certificate borders.
- **Don't** hide content behind an animation. Motion moves things; it never makes them appear.

## Motion

Two authored moments, both off under reduced motion. Credit lines settle upward by about a line
height when a title card loads, staggered in pairs, with `cubic-bezier(0.16, 1, 0.3, 1)`. A
recomputed digest resolves left to right in 32 steps. Hover and press changes take 160ms.

## Status vocabulary (product truth the design must carry)

These are distinct facts and are never merged into one "verified" badge.

| Fact                           | Meaning                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| Organisation approved          | A reviewer of the issuer approved the claim (off-chain).                               |
| Awaiting NEAR anchor           | Approved; no confirmed transaction yet.                                                |
| NEAR anchor confirmed          | A confirmed transaction stores the matching digest.                                    |
| NEAR anchor failed             | The transaction failed or was rejected; approval still stands.                         |
| Revoked / superseded           | No longer valid; history stays visible.                                                |
| Platform-verified organisation | A ProofMe admin reviewed the organisation. Separate from its NEAR issuer registration. |

## Not yet designed

The signed-in product: app shell, forms, tables, queues, dialogs, notifications, empty and
permission-denied states. These are working screens, so they will use this system's tokens,
faces and status rules with a denser layout suited to tasks.
