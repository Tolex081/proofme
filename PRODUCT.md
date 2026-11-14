# Atesta — Product context

> Status: written from the master build brief in Milestone 0 and loaded by Impeccable's context
> command from Milestone 1 onward. The visual system that carries it is in `DESIGN.md`.

## Register

The public website is built for hackathon judges and ecosystem reviewers first, then contributors
and organisations. The one thing it must never feel like is cold or institutional: this is about
people and what they made, not a registry.

## Promise

**Your work should speak for itself. We make it verifiable.**

Build a portable record of your contributions. Get your work verified by the organisations you
contributed to. Share proof that others can check.

## What it is

A portable professional contribution and reputation platform. Contributors document specific
pieces of work with evidence. The organisation they worked with reviews each claim and, if it can
stand behind it, issues an attestation. The attestation is minted on NEAR (testnet in this build)
as an NFT that cannot be transferred and that the issuer can revoke, carrying the record's digest,
so anyone can check it without an account.

Built for the NEAR Hackathon, track 10, "NFTs That Do Something": an NFT that carries a
credential and whose status changes on-chain.

Atesta is an independent product. It is not CrewPass and shares nothing with it.

## Who it serves

| Role                   | What they need                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| Contributor            | A credible profile, a way to submit work with evidence, a clear review status, shareable proof.    |
| Organisation           | An identity, projects, a team with roles, a review queue, the ability to issue and revoke.         |
| Reviewer               | Only the requests they are allowed to review, with the evidence and a clear decision to make.      |
| Public verifier        | To open a profile or attestation without logging in and see exactly what was verified and by whom. |
| Platform administrator | To review organisations, handle reports and read the audit trail, without touching attestations.   |

One account can hold several of these roles.

## The trust rule

A person may submit a claim about their own work. They can never verify it. Only an authorised
reviewer of the relevant organisation can approve on that organisation's behalf. Platform
administrators verify organisations; they do not write or rewrite attestations.

## Issuer trust policy

An organisation can issue a recognised NFT credential only when all three hold:

1. Atesta has verified the organisation (platform status "verified"). Pending, unverified,
   rejected and suspended organisations can review claims but cannot mint.
2. An owner of the organisation proved control of its NEAR issuer account by signing a one-time
   Atesta challenge with that account's wallet (NEP-413). A typed or merely linked account is
   never treated as an issuer.
3. The contract lists that account as this organisation's active issuer.

Suspending the organisation on Atesta, or the issuer on the contract, stops new credentials at
once. The credential-gated page also stops accepting credentials from a suspended issuer.

## Contributor accounts and consent

A contributor's NEAR account is recorded only after their wallet signs a one-time challenge and
the network confirms the signing key is a full-access key of that account. Credentials go only to
such proven accounts, and after minting the server checks that the NFT is owned by exactly that
account. Approving a claim does not publish it: the contributor must agree first, and a private
contribution can never become a public credential.

## What the NFT does

- **Credential.** The organisation's endorsement of one precise claim, held in the contributor's
  own NEAR account, non-transferable.
- **Portable.** Its NEP-177 `reference` points at the public credential document on IPFS, with
  `reference_hash` its SHA-256, so any application can fetch and check it without Atesta.
- **Dynamic.** It can be revoked, or superseded by a corrected credential, on-chain. Wallets are
  told through `nft_metadata_update`, and the public page shows the full history.
- **Access right.** Holding a valid credential opens /holders: the wallet signs a challenge, and
  access is granted only for an active credential from an active, Atesta-verified issuer.

## Evidence Agent

The Evidence Agent investigates a contribution's GitHub evidence before the organisation decides.
It checks pull requests, commits, issues and repositories against GitHub itself and against the
contributor's linked GitHub account (one GitHub account per Atesta account, by GitHub's numeric
ID), flags reused and conflicting evidence and, when an AI provider is configured, explains claim
by claim what the evidence does and does not show. Its report is advice for the human reviewer.
It never approves, rejects or mints, and never presents an AI interpretation as a fact or as an
organisation's endorsement.

## What an attestation proves

That a named issuer approved a precisely described claim at a particular time, and that the
record has not been altered since. It does not prove the contributor is universally skilled, that
every detail is objectively true, or that a given verifier should trust the issuer. The interface
says this plainly wherever an attestation is shown.

## Principles

1. Evidence before status. A URL is a reference, not proof.
2. Issuer accountability. Every verified claim shows its issuer.
3. Specific claims, not vague praise.
4. Portable: checkable without a Atesta login.
5. No universal reputation score. Only counts derived from real, currently valid records.
6. Wallet optional for people until they want the NFT: a contributor needs a NEAR account to
   receive one. Organisations need a wallet for issuer actions.
7. NEAR does real work: issuer registry, a non-transferable NFT per attestation, revocation.
8. Private by default. Personal data, notes and private evidence stay off-chain.
9. Immutable history. Corrections revoke or supersede; nothing is silently edited.
10. Reputation cannot be bought. No tokens, boosts or follower counts.
11. AI may assist, never decide. The Evidence Agent advises reviewers; it cannot approve.
12. Truth over demo appearance. No fake traction, partners, quotes or statuses.

## What it is not

A social network, a CV builder, an NFT marketplace (its NFTs cannot be traded), a token launch, an automatic
GitHub-to-reputation converter (the Evidence Agent informs a human decision and awards nothing), a
single trust score, or a mandatory-wallet product. No NFT treasuries, royalties, trading,
speculation or NFT-owned sub-accounts.

## Voice

Plain, calm and exact. Say what was checked and what was not. Prefer "Northstar Protocol approved
this claim on 4 March" to "Verified!". Avoid crypto jargon where an ordinary word works; when a
NEAR term is needed (account, transaction, testnet), use it precisely. British spelling
("organisation") throughout the product.

## Scope of the first release

The full lifecycle: sign up, profile, contribution with evidence, organisation and team, review
(approve, reject, request information), immutable attestation, NEAR testnet anchor, public
profile and verification page, revocation and supersession, notifications, audit, admin review.

Added for the hackathon: wallet-proven accounts, the issuer trust policy, consent and IPFS
publication, on-chain corrections, the credential-gated page, and the GitHub Evidence Agent.

Out of scope for now: evidence sources other than GitHub, AI-issued attestations, other chains,
education credentials, recruitment marketplace, billing, tokens, mainnet.
