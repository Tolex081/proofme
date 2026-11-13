# ProofMe

**Contribution credentials as NFTs that do something.** A contributor documents a piece of work;
the organisation they did it for reviews it, helped by an evidence agent that checks the GitHub
evidence against GitHub itself; the organisation issues a non-transferable credential NFT on NEAR
that anyone can verify without ProofMe, that the issuer can revoke or correct on-chain, and that
opens doors in other applications.

Built for the **NEAR HACKATHON, track 10 "NFTs That Do Something"** (track id `nfts`).

| What                     | Where                                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live app                 | https://proofme-nine.vercel.app (NEAR testnet, fictional demo data)                                                                                                   |
| Contract (testnet)       | [`proofme-attest-1113.testnet`](https://testnet.nearblocks.io/address/proofme-attest-1113.testnet)                                                                    |
| A real minted credential | https://proofme-nine.vercel.app/verify/11cd86ff-7936-4ee1-9927-2e1cf4e027ca                                                                                           |
| Its mint transaction     | [`9bC4wzTq3DDFMCUATxMUfaRn26yvWeej6Qia8GW2DvBW`](https://testnet.nearblocks.io/txns/9bC4wzTq3DDFMCUATxMUfaRn26yvWeej6Qia8GW2DvBW)                                     |
| Its public document      | [`ipfs://bafkreihena7xm2hr2fm2gi2e7jzau762hi66d6l23sasnu76h3ypyyoxym`](https://gateway.pinata.cloud/ipfs/bafkreihena7xm2hr2fm2gi2e7jzau762hi66d6l23sasnu76h3ypyyoxym) |
| Licence                  | MIT ([LICENSE](LICENSE))                                                                                                                                              |

## The problem

Work on open projects is scattered across repositories, chats and forums, and anyone can claim
anything. Checking a claim means chasing people down; a CV line or a GitHub link proves nothing
about who did the work. Organisations that could vouch have no portable, checkable way to do it.

## What the NFT does

| Behaviour                      | How                                                                                                                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Carries a credential**       | Each NFT is one organisation's endorsement of one precise claim. Only a registered issuer can mint; it cannot be transferred, sold or lent.                                              |
| **Is independently checkable** | NEP-177 `reference` points at the credential document on IPFS; `reference_hash` is its SHA-256, which equals the digest stored on-chain. No ProofMe account or database needed.          |
| **Changes on-chain**           | The issuer can revoke it, or supersede it with a corrected credential. The token's status, title, description and image follow, and `nft_metadata_update` (NEP-171 1.2.0) tells wallets. |
| **Grants access**              | `/holders` opens only for a wallet that signs a challenge and holds an active credential from an active, ProofMe-verified issuer. Revoked or replaced ones do not count.                 |
| **Shows up in wallets**        | A status badge image (`media` + `media_hash`): blue "Verified work", red "Revoked", grey "Replaced". Seen in Meteor wallet under NFTs.                                                   |

## Try it (do X, see Y)

Demo accounts (fictional people and organisation, testnet only). All use the password
**`Proofme123456`**:

| Account                           | Role                                 | NEAR account (proven by wallet signature) |
| --------------------------------- | ------------------------------------ | ----------------------------------------- |
| `daniel.okafor@demo.proofme.test` | Contributor                          | `crewpass-carol.testnet`                  |
| `sam.adeyemi@demo.proofme.test`   | Owner of Northstar Protocol (issuer) | issuer `crewpass-creator.testnet`         |
| `priya.raman@demo.proofme.test`   | Reviewer at Northstar Protocol       | –                                         |

You can also create your own account with any real email: you get a 6-digit code to confirm it.

1. **Check a real credential, no account needed.** Open
   https://proofme-nine.vercel.app/verify/11cd86ff-7936-4ee1-9927-2e1cf4e027ca → see "The record
   hashes to its digest: yes", "The contract on NEAR holds the same digest: yes", held by
   `crewpass-carol.testnet`, the IPFS document, and the history.
2. **Check it without ProofMe at all.**
   ```bash
   near contract call-function as-read-only proofme-attest-1113.testnet nft_token json-args '{"token_id":"11cd86ff-7936-4ee1-9927-2e1cf4e027ca"}' network-config testnet now
   ```
   → see owner, status `active`, `reference` (ipfs://…) and `reference_hash`. Then
   ```bash
   curl -s https://gateway.pinata.cloud/ipfs/bafkreihena7xm2hr2fm2gi2e7jzau762hi66d6l23sasnu76h3ypyyoxym | sha256sum
   ```
   → see `e4683f7668f1d159a32344fa720a7fda3a3de1f97adc8126d3fe3ef0fc61d7c3`, the same digest the
   contract holds (`verify` with that token ID and digest returns `valid: true`).
3. **Investigate evidence.** Sign in (your own account is best, so you can link your GitHub under
   Identity) → Contributions → New → add a public GitHub pull request, commit or issue link → save
   → **Investigate with ProofMe** → see source checks (who opened, authored, committed, reviewed)
   against your linked GitHub account, duplicate and conflict flags, and, separately, the AI
   analysis claim by claim. Without a linked GitHub account the report says attribution could not
   be checked.
4. **Review as the organisation.** Sign in as Daniel → Contributions → New → add a public claim
   with a link → **Send for review** to Northstar. Sign in as Priya → Northstar Protocol → Review
   queue → open it → see the Evidence Agent report beside the claim → **Approve**.
5. **Consent and publish.** Sign in as Daniel → open the approved contribution → **I agree:
   publish as a credential** → see the `ipfs://` address of the public document.
6. **Issue on NEAR.** Sign in as Sam → Northstar Protocol → Attestations → see the issuer policy
   checks and **Issue on NEAR**. Minting needs the issuer's wallet (`crewpass-creator.testnet`), so
   a judge sees the button and the checks, and the result in step 1, but cannot sign as Sam.
7. **Correct a credential.** As Sam, on an issued record → **Correct this record** → see a new
   record linked to the old one; once issued, the contract's `supersede` marks the old token
   "Replaced" and the verify page shows both links and the history.
8. **Credential-gated access.** Open https://proofme-nine.vercel.app/holders → **Connect wallet and
   sign** with a testnet wallet → access is refused unless the wallet holds an active credential
   from a verified issuer (`crewpass-carol.testnet` does).

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
- **Issuer trust policy.** Minting is allowed only for an organisation ProofMe has verified, whose
  owner proved control of the issuer account, and that the contract lists as an active issuer.

## The Evidence Agent

Contributors link GitHub by OAuth (no scopes; identity = GitHub's numeric user ID, unique across
ProofMe and never released). The agent parses GitHub links (it never fetches a user-supplied URL),
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

## Documents

[PRODUCT.md](PRODUCT.md) (what and why, issuer policy) ·
[ARCHITECTURE.md](ARCHITECTURE.md) · [DATA_MODEL.md](DATA_MODEL.md) ·
[SECURITY.md](SECURITY.md) · [DECISIONS.md](DECISIONS.md) · [TEST_PLAN.md](TEST_PLAN.md) ·
[BUILD_STATUS.md](BUILD_STATUS.md) · [contract README](contracts/proofme-attestations/README.md)

ProofMe is independent. It has no partnership with NEAR or with any organisation in its sample
records, all of which are fictional.
