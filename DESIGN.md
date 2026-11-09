# ProofMe — Design system

> Status: **not yet designed.** This file currently records only the constraints fixed by the
> master brief. The visual direction, type system, colour tokens, spacing, components and
> responsive patterns are produced in Milestone 1 through the Impeccable greenfield workflow,
> which requires a direction-selection step before any UI code. Impeccable is not installed in
> this environment yet, so that work has not started and no UI has been designed.

## Fixed constraints (from the brief)

**Intent.** A premium professional tool that is credible to contributors, engineering teams,
DAOs, employers and grant reviewers. A serious identity and verification product, not a
speculative crypto dashboard.

**It should communicate:** trust without exaggeration, clarity over noise, human professional
identity, evidence and provenance, progress across a real work history, technical credibility
without jargon.

**Colour starting point.**

- Deep ink/navy as the anchor.
- Warm off-white or restrained neutral backgrounds.
- Considered greys for secondary information.
- A restrained blue or teal accent.
- Green only for verified/success states.
- Amber only for pending/needs-information states.
- Red only for rejected/revoked/error states.

**Avoid.** Heavy gradients, glassmorphism, neon, glowing borders, giant crypto symbols,
meaningless data visualisation, excessive animation, emoji as icons, and rows of identical
icon-heading-description cards as the default layout.

**Required qualities.**

- A consistent real icon set (Lucide or similar).
- WCAG 2.2 AA contrast; status never communicated by colour alone.
- Full keyboard operation with visible focus.
- Every state designed: hover, focus, active, disabled, loading, error, success, empty,
  permission-denied, pending, revoked.
- Mobile designed deliberately at 390px, plus 768, 1280 and 1440.
- Subtle, purposeful motion with reduced-motion support.
- Browser-native surfaces (focus rings, selection, scrollbars, inputs) treated as part of the system.

## Status vocabulary (product truth the design must carry)

These are distinct facts and must never be merged into one "verified" badge:

| Fact                           | Meaning                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| Organisation approved          | A reviewer of the issuer approved the claim (off-chain).                               |
| Awaiting NEAR anchor           | Approved; no confirmed transaction yet.                                                |
| NEAR anchor confirmed          | A confirmed transaction stores the matching digest.                                    |
| NEAR anchor failed             | The transaction failed or was rejected; approval still stands.                         |
| Revoked / superseded           | No longer valid; history stays visible.                                                |
| Platform-verified organisation | A ProofMe admin reviewed the organisation. Separate from its NEAR issuer registration. |

## To be decided in Milestone 1

Visual direction, typefaces, type scale, colour tokens, spacing scale, radii, borders, elevation,
component rules, app shell, responsive patterns, motion.
