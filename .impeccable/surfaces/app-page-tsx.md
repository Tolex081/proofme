---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: []
---

# Landing page and public website

**Scope:** `/` and the public explanatory pages (`/how-it-works`, `/for-contributors`, `/for-organisations`, `/privacy`, `/terms`), with the shared header and footer.
**Mode:** Persuade for `/`, `/for-contributors`, `/for-organisations`; Read for `/how-it-works`, `/privacy`, `/terms`.

**Audience:** hackathon judges and ecosystem reviewers first; contributors and organisations second.
**Job:** understand in seconds what ProofMe credits and who stands behind it, then check a record themselves.
**Action:** run the digest check on the sample record; then read how it works.
**Proof:** a working in-browser check on a clearly labelled sample record. No partners, statistics, testimonials or real attestations exist yet, and none are shown.
**Constraints:** British spelling; nothing may read as cold or institutional; no status shown by colour alone; green only for a confirmed or verified state, amber only for pending, red only for rejected, revoked or failed; no account calls to action until sign-up exists.

**Memorable moment:** change one word of the sample claim and watch the digest stop matching.

**Unresolved:** account calls to action (added with authentication); a link from the landing page to a real testnet attestation (added once one exists).

## Direction contract

THESIS: Work is credited the way films and records credit people: the role beside the name, and beneath them who signs off. The page refuses the category arrangement of a headline beside a product screenshot above three feature cards.

OWN-WORLD: Deep ink title-card fields alternating with warm paper liner-note fields. One vertical axis runs down every credit block: roles set small, uppercase and tracked, right-aligned against it; names and facts set large, left-aligned from it. A geometric sans from the film title-card tradition carries both voices. Hairline rules separate credit groups; nothing is boxed. Teal marks what can be pressed. Digests and transaction references are set in a mono face because they are data.

STORY: The visitor understands that an organisation puts its name to one specific piece of someone's work; believes the record can be checked without trusting ProofMe; runs the check, breaks it by editing a word, and goes on to read how it works.

FIRST VIEWPORT: A full-height ink field. The promise is the heading, set large on the left of the axis line's column. Under it, one sample contribution as a credit block on the axis: contribution, credited to, role, confirmed by, issued. Directly beneath, the working check: an editable role, a primary button that recomputes the digest in the browser, and the recorded and recomputed digests side by side with a worded result. A visible label says the record is a sample.

SIGNATURE INTERACTION AND MOTION: the digest check, with the recomputed digest resolving character by character; credit lines settle upward once on load, like the first card of a credit roll. Both stand still under reduced motion.

FORM: The Credits, position 1 on the ordered list; seed:d0cfdbddbd372df5

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
