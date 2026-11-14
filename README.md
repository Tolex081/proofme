# Atesta

**Contribution credentials as NFTs that do something.** A contributor documents a piece of work;
the organisation they did it for reviews it, helped by an evidence agent that checks the GitHub
evidence against GitHub itself; the organisation issues a non-transferable credential NFT on NEAR
that anyone can verify without Atesta, that the issuer can revoke or correct on-chain, and that
opens doors in other applications.

Built for the **NEAR HACKATHON, track 10 "NFTs That Do Something"** (track id `nfts`).

Atesta is the team's NEAR HACKATHON project. The team is also submitting [**Crewpass**](https://github.com/Tolex081/crewpass), a separate project with its own [live demo](https://crewpass-steel.vercel.app/); the two projects are independent and are disclosed here because one team member is submitting both.

| What                     | Where                                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live app                 | https://atesta-near.vercel.app (NEAR testnet, fictional demo data)                                                                                                    |
| Contract (testnet)       | [`proofme-attest-1113.testnet`](https://testnet.nearblocks.io/address/proofme-attest-1113.testnet)                                                                    |
| Minted testnet demo credential | https://atesta-near.vercel.app/verify/11cd86ff-7936-4ee1-9927-2e1cf4e027ca (sample identity and issuer; token and mint transaction are real) |
| Its mint transaction     | [`9bC4wzTq3DDFMCUATxMUfaRn26yvWeej6Qia8GW2DvBW`](https://testnet.nearblocks.io/txns/9bC4wzTq3DDFMCUATxMUfaRn26yvWeej6Qia8GW2DvBW)                                     |
| Its public document      | [`ipfs://bafkreihena7xm2hr2fm2gi2e7jzau762hi66d6l23sasnu76h3ypyyoxym`](https://gateway.pinata.cloud/ipfs/bafkreihena7xm2hr2fm2gi2e7jzau762hi66d6l23sasnu76h3ypyyoxym) |
| Licence                  | MIT ([LICENSE](LICENSE))                                                                                                                                              |

### Rebrand and NEAR contract

ProofMe is the project's former name. The product and this submission are now **Atesta**. The
Vercel project is named `atesta`; its public address is `atesta-near.vercel.app` because
`atesta.vercel.app` was unavailable. The earlier `proofme-nine.vercel.app` address used the
former name. The NEAR testnet contract (`proofme-attest-1113.testnet`) also retains the former
name because NEAR account addresses cannot be renamed in place. The contract is already deployed
and holds the credential linked above; Atesta is continuing that deployment, not claiming it was
originally deployed under the new name. The old contract address is shown here so judges can
independently verify the mint.

## The problem

Work on open projects is scattered across repositories, chats and forums, and anyone can claim
anything. Checking a claim means chasing people down; a CV line or a GitHub link proves nothing
about who did the work. Organisations that could vouch have no portable, checkable way to do it.

## Who Atesta is for

Atesta fits work where the evidence is a public GitHub contribution and an organisation can review
the work before endorsing it. Its likely first users are:

- **Open-source contributors:** volunteer maintainers, first-time contributors, freelance
  developers, students, and people completing funded issues who want a portable record of a
  specific pull request or project contribution.
- **Open-source project teams and foundations:** maintainers or programme staff who review
  contributions and want to issue a verifiable endorsement. Examples of the kind of ecosystem
  include the [Eclipse Foundation](https://www.eclipse.org/), [Drupal Association](https://www.drupal.org/association),
  and [FOSSASIA](https://fossasia.org/), which appear in the [Open Source Initiative's affiliate
  network](https://opensource.org/affiliates). A project would use Atesta only for contributions
  its authorised reviewers can assess.
- **Open-source grant and bounty programmes:** programme operators that assess GitHub-based
  deliverables and want to give a participant a durable proof of accepted work. [Gitcoin Grants](https://support.gitcoin.co/gitcoin-knowledge-base/gitcoin-grants)
  and [IssueHunt](https://oss.issuehunt.io/) illustrate this type of funding or bounty workflow;
  Atesta is not integrated with either service and does not distribute grants or bounty payments.
- **Builders of developer products:** teams making developer portfolios, open-source contribution
  directories, grant portals or talent tools could link to Atesta's public verification page so
  users can inspect an organisation's endorsement. Such an integration would need to be built; it
  is not a feature currently shipped by Atesta.
- **People checking work claims:** open-source maintainers, grant reviewers, ecosystem funders or
  hiring teams can inspect what a named issuer endorsed and whether the record still matches NEAR.
  A credential supports review of that specific contribution; it does not make a hiring or funding
  decision for them.

**Accountants, gyms and most organisations are not Atesta's target users by default.** A gym could
fit only if it runs a software or open-source programme and needs to verify public GitHub work.
Accountants could use it for their own software contributions, but Atesta does not verify
bookkeeping, audits, financial records or accounting qualifications. The current Evidence Agent
checks GitHub evidence, so work that cannot be shown through public GitHub activity is outside the
main use case.

The named organisations and products above are examples of possible fit, not Atesta customers,
partners or endorsements. Atesta records one claim and its issuer; it does not create an automatic
reputation score or guarantee a person's overall skill or suitability.

## What the NFT does

| Behaviour                      | How                                                                                                                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Carries a credential**       | Each NFT is one organisation's endorsement of one precise claim. Only a registered issuer can mint; it cannot be transferred, sold or lent.                                              |
| **Is independently checkable** | NEP-177 `reference` points at the credential document on IPFS; `reference_hash` is its SHA-256, which equals the digest stored on-chain. No Atesta account or database needed.           |
| **Changes on-chain**           | The issuer can revoke it, or supersede it with a corrected credential. The token's status, title, description and image follow, and `nft_metadata_update` (NEP-171 1.2.0) tells wallets. |
| **Grants access**              | `/holders` opens only for a wallet that signs a challenge and holds an active credential from an active, Atesta-verified issuer. Revoked or replaced ones do not count.                  |
| **Shows up in wallets**        | A status badge image (`media` + `media_hash`): blue "Verified work", red "Revoked", grey "Replaced". Seen in Meteor wallet under NFTs.                                                   |

## Judge walkthrough (do X, see Y)

Start with the first route; it takes no account or wallet and proves the demo token is live on NEAR testnet. The longer route shows how a claim is reviewed before it can become a credential.

Demo accounts and the organisation are fictional (testnet only). The linked credential is a sample record: its claimant and issuer are not a real third-party endorsement, although the NFT and mint transaction are real testnet events. All accounts use the password **`Proofme123456`**:

| Account | Role | NEAR account (proven by wallet signature) |
| --- | --- | --- |
| `daniel.okafor@demo.proofme.test` | Contributor | `crewpass-carol.testnet` |
| `sam.adeyemi@demo.proofme.test` | Owner of Northstar Protocol (issuer) | issuer `crewpass-creator.testnet` |
| `priya.raman@demo.proofme.test` | Reviewer at Northstar Protocol | – |

You can also create your own account with any real email: you get a 6-digit code to confirm it.

### Quick route: independently check a minted credential (no login)

1. Open [this minted Atesta sample credential](https://atesta-near.vercel.app/verify/11cd86ff-7936-4ee1-9927-2e1cf4e027ca).
2. See the named claim and issuer, the owner `crewpass-carol.testnet`, and the history.
3. See **“The record hashes to its digest: yes”** and **“The contract on NEAR holds the same digest: yes”**. The page reads the credential document and the NEAR testnet contract so you can compare them without trusting an Atesta login.
4. Open the linked [mint transaction](https://testnet.nearblocks.io/txns/9bC4wzTq3DDFMCUATxMUfaRn26yvWeej6Qia8GW2DvBW) to inspect the on-chain mint. Open the linked IPFS document to inspect the public credential.

### Longer route: follow a claim through review

The sample accounts represent a contributor, an organisation owner and a separate reviewer. Use the same fictional sample names shown in the interface.

1. **Investigate a contributor's GitHub evidence.** Sign in as Daniel → **Identity** → link a GitHub account → **Contributions** → **New** → enter a specific claim and a public pull request, commit or issue URL → save → **Investigate with Atesta**. See GitHub source checks for who opened, authored, committed or reviewed the evidence, any duplicate or conflict flags, and the AI's claim-by-claim analysis separately. If GitHub is not linked or reachable, the report says attribution could not be checked rather than treating that as proof of fraud.
2. **Send the claim for an organisation's review.** As Daniel → open the contribution → choose Northstar Protocol / Open Grants Portal → **Send for review**. See the submitted status; the claim is now in the organisation's review queue.
3. **Review it as a different person.** Sign out, then sign in as Priya → **Northstar Protocol** → **Review queue** → open the claim. See Daniel's evidence and the Evidence Agent report beside the claim → **Approve** (or request information / reject). The reviewer, not the contributor or the AI, makes this decision.
4. **Give publication consent.** Sign back in as Daniel → open the approved contribution → **I agree: publish as a credential**. See the public `ipfs://` document address. Approval alone does not publish the contributor's record.
5. **Inspect the issuer step and a real issued result.** Sign in as Sam → **Northstar Protocol** → **Attestations**. See the issuer-policy checks and **Issue on NEAR** action. The action needs the issuer's own wallet, `crewpass-creator.testnet`, so a judge cannot sign as Sam. To inspect the already-minted result instead, follow the Quick route above; its live testnet token and mint transaction are public.
6. **Check credential-gated access.** Open [the holders page](https://atesta-near.vercel.app/holders) → **Connect wallet and sign** with a testnet wallet. A wallet holding an active credential from an active, Atesta-verified issuer (`crewpass-carol.testnet` does) is granted access; an ineligible wallet is refused.

### Verify the credential without Atesta

Run the read-only NEAR contract call and fetch the IPFS document:

```bash
near contract call-function as-read-only proofme-attest-1113.testnet nft_token json-args '{"token_id":"11cd86ff-7936-4ee1-9927-2e1cf4e027ca"}' network-config testnet now
```

→ See owner, status `active`, `reference` (`ipfs://…`) and `reference_hash`. Then:

```bash
curl -s https://gateway.pinata.cloud/ipfs/bafkreihena7xm2hr2fm2gi2e7jzau762hi66d6l23sasnu76h3ypyyoxym | sha256sum
```

→ See `e4683f7668f1d159a32344fa720a7fda3a3de1f97adc8126d3fe3ef0fc61d7c3`, the same digest the contract holds (`verify` with that token ID and digest returns `valid: true`).

For a focused recording plan and the exact post requirements, see [the demo video guide](submission/demo-video-guide.md).

## How NEAR is used

- **Contract** `contracts/proofme-attestations` (Rust, near-sdk 5.30.1): NEP-171 core, NEP-177
  metadata (`reference`, `reference_hash`, `media`, `media_hash`), NEP-181 enumeration, NEP-297
  events. Issuer registry, `issue`, `revoke`, `supersede`, `verify`. Transfers always fail. 55 unit
  tests. Deployed and upgraded in place on testnet.
- **NEP-413 signed messages** prove control of accounts: a contributor's receiving account, an
  organisation's issuer account, and a holder at `/holders`. The server checks the signature and
  that the key is a full-access key of the account (RPC `view_access_key`). A typed account is
  never trusted.
- **The server holds no key.** Wallets (NEAR Connect: Meteor, MyNearWallet, HOT…) sign every
  transaction. The server reads the chain to confirm the exact transaction arguments and the token
  as it now stands before recording anything.
- **Issuer trust policy.** Minting is allowed only for an organisation Atesta has verified, whose
  owner proved control of the issuer account, and that the contract lists as an active issuer.

## The Evidence Agent

Contributors link GitHub by OAuth (no scopes; identity = GitHub's numeric user ID, unique across
Atesta and never released). The agent parses GitHub links (it never fetches a user-supplied URL),
reads pull requests, commits, issues and repositories from `api.github.com`, and keeps opening,
authoring, committing, reviewing, merging and assignment apart. It flags reuse of the same
evidence and conflicting authorship without penalising genuine collaboration, and treats GitHub
errors as "could not be checked", never as fraud. With NEAR AI Cloud configured, a model then
analyses the claim against those facts; GitHub text is passed as untrusted data and the output is
schema-validated (it can never confirm a source or approve). Reports are versioned and cited from
the credential by ID and digest. **The organisation's human reviewer always decides.**

## Run it locally

Needs Node.js 22+, and Rust only for the contract.

```bash
npm install
cp .env.example .env.local      # then set BETTER_AUTH_SECRET (32+ random characters)
npm run db:seed                 # fictional demo data; prints the shared password
npm run dev                     # http://localhost:3000
```

Locally the database is an embedded PostgreSQL (no setup); NEAR, IPFS, GitHub, NEAR AI and email
are optional and each degrades clearly when not configured (see `.env.example`).

## Checks

```bash
npm run check                   # format, lint, types, build, unit and integration tests (450)
npm run test:e2e                # Playwright, desktop and phone (32), incl. accessibility and CSP
cd contracts/proofme-attestations && cargo test   # 55 contract tests
```

The integration tests include the briefs' acceptance tests: one GitHub identity per account,
concurrent linking, false authorship, collaboration, duplicate evidence, author vs committer,
unavailable sources, prompt injection, and that only a human reviewer can approve.

## Built with

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Better Auth (email and password, 6-digit email
codes), Drizzle ORM on PostgreSQL (Neon) / PGlite, Zod, NEAR Connect (`@hot-labs/near-connect`),
near-sdk (Rust), Pinata (IPFS), NEAR AI Cloud, Brevo (email), Vercel. Code was written with AI
assistance (Claude Code). The whole repository was created during the hackathon window: the first
commit is 9 November 2026.

## Photography credits

The homepage uses documentary-style photographs to connect contribution, endorsement and
checkable records. Photos are used under the [Unsplash License](https://unsplash.com/license);
attribution is included here in appreciation.

- Hero, craftsperson at a workbench — [GN Group on Unsplash](https://unsplash.com/photos/a-woman-working-with-tools-at-a-workbench-rYLgVzL8G24)
- Issuer's mark, stamped travel document — [Global Residence Index on Unsplash](https://unsplash.com/photos/a-close-up-of-a-piece-of-paper-with-stamps-on-it-yMhTgr2zdVM)
- Signature, hand signing a document — [Shutter Speed on Unsplash](https://unsplash.com/photos/hand-writing-with-a-fountain-pen-on-paper-rz_0EzMAmis)

## Documents

[PRODUCT.md](PRODUCT.md) (what and why, issuer policy) ·
[ARCHITECTURE.md](ARCHITECTURE.md) · [DATA_MODEL.md](DATA_MODEL.md) ·
[SECURITY.md](SECURITY.md) · [DECISIONS.md](DECISIONS.md) · [TEST_PLAN.md](TEST_PLAN.md) ·
[BUILD_STATUS.md](BUILD_STATUS.md) · [demo video guide](submission/demo-video-guide.md) ·
[recording notes](submission/recording-notes.md) · [contract README](contracts/proofme-attestations/README.md)

Atesta is independent. It has no partnership with NEAR or with any organisation in its sample
records, all of which are fictional.
