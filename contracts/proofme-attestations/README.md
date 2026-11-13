# proofme-attestations

The NEAR contract behind ProofMe. Each work record an organisation approves is issued as an NFT
that behaves like a credential, not a collectible.

| Behaviour                         | How the contract enforces it                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Only real issuers can mint        | `issue` succeeds only for an account the contract owner registered as an organisation's issuer       |
| Nobody can issue to themselves    | `issue` fails if the receiver is the issuer                                                          |
| It cannot be sold or lent         | `nft_transfer` and `nft_transfer_call` always fail; there is no approval mechanism                   |
| Its status changes on-chain       | `revoke` and `supersede` change the status; `nft_token` builds its metadata from the current status  |
| Only the issuer can withdraw it   | `revoke` and `supersede` work only for the account that issued that token                            |
| The platform cannot touch a token | The contract owner manages the issuer list and has no method that changes or removes a token         |
| History is never erased           | Tokens are never burned or deleted. A revoked or superseded token stays with its owner, marked as so |
| Anyone can check a record         | `verify(token_id, digest)` and `get_attestation(token_id)` are free view calls that need no account  |
| Nothing personal is on-chain      | Stored: attestation ID, SHA-256 digest, owner account, issuer account, status, timestamps. No text   |
| It points at its public record    | NEP-177 `reference` (an `ipfs://` CID) and `reference_hash` (Base64 SHA-256 of that document)        |
| Wallets see status changes        | `revoke` and `supersede` emit the NEP-171 1.2.0 `nft_metadata_update` event for the changed token    |

**Deployed on NEAR testnet:** [`proofme-attest-1113.testnet`](https://testnet.nearblocks.io/address/proofme-attest-1113.testnet), deployed 13 November 2026 from this source (wasm SHA-256 `b890f80a4aa4a7e2381745b1f274f4bda6ecec91e91d509085acc1a0570863d2`), initialised with itself as owner and `base_uri` `https://proofme-nine.vercel.app/verify`.

Standards: NEP-171 (core), NEP-177 (metadata), NEP-181 (enumeration), NEP-297 (events).

## Methods

Change methods:

| Method                                                 | Who                        | Deposit     |
| ------------------------------------------------------ | -------------------------- | ----------- |
| `new(owner_id, base_uri)`                              | Once, at deployment        | none        |
| `register_issuer(issuer_id, organisation_id)`          | Contract owner             | storage     |
| `suspend_issuer(issuer_id)`                            | Contract owner             | 1 yoctoNEAR |
| `reinstate_issuer(issuer_id)`                          | Contract owner             | 1 yoctoNEAR |
| `issue(token_id, receiver_id, digest, reference)`      | Active issuer              | storage     |
| `revoke(token_id)`                                     | The token's issuer         | 1 yoctoNEAR |
| `supersede(old_token_id, token_id, digest, reference)` | The token's issuer, active | storage     |

`reference` is optional: `{"reference": "ipfs://<cid>", "reference_hash": "<Base64 SHA-256>"}`.
It must be an `ipfs://` or `https://` address of at most 256 characters, with a 44-character
Base64 SHA-256. ProofMe always sets it: the referenced document is the canonical attestation
record, so its SHA-256 equals `digest` and `reference_hash` is that same hash in Base64.

"Storage" means attach a little NEAR (0.01 is ample); the contract keeps what the new bytes cost
and refunds the rest. A call that attaches too little fails and changes nothing.

View methods: `get_owner`, `get_issuer`, `get_attestation`, `verify`, `nft_token`, `nft_metadata`,
`nft_total_supply`, `nft_tokens`, `nft_supply_for_owner`, `nft_tokens_for_owner`.

`token_id` is the ProofMe attestation ID (a UUID). `digest` is the SHA-256 of the canonical
attestation record as 64 lowercase hex characters. `organisation_id` is ProofMe's ID for the
organisation.

Events: `nft_mint` and `nft_metadata_update` under `nep171` version 1.2.0; `issuer_registered`,
`issuer_suspended`, `issuer_reinstated`, `attestation_revoked` and `attestation_superseded` under
the `proofme` standard. Revoking logs `attestation_revoked` then `nft_metadata_update`; superseding
logs `nft_mint` (the new token), `attestation_superseded`, then `nft_metadata_update` (the old one).

## Checking a credential without ProofMe

1. `get_attestation(token_id)` or `nft_token(token_id)`: owner, issuer, status, digest, reference.
2. Fetch the document at `reference` (any IPFS gateway for `ipfs://`), hash its exact bytes with
   SHA-256, and compare with `reference_hash` (Base64) and `digest` (hex).
3. `get_issuer(issuer_id)`: whether the issuer is still active.
4. `verify(token_id, digest)` returns `valid: true` only for a matching, active token.

## Build and test

Needs Rust 1.95 (pinned in `rust-toolchain.toml`; rustup installs it on first use).

```sh
cargo test                                             # 54 unit tests
cargo clippy --all-targets -- -D warnings
cargo near build non-reproducible-wasm --no-abi         # the contract binary, in target/near/
```

`--no-abi` is needed on Windows, where the interface file cannot be generated; leave it off on
Linux and macOS. `cargo near` comes from `npm install cargo-near` or the installer in its README.

Run `cargo test` and see `test result: ok. 54 passed; 0 failed`.

## Threats considered

| Threat                                              | Answer                                                                                             |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Someone mints themselves a credential               | Minting needs a registered issuer account, and an issuer cannot be its own receiver                |
| A credential is sold or moved to another person     | Transfers always fail                                                                              |
| The record shown off-chain is edited after approval | Its recomputed digest no longer matches the one on-chain; `verify` reports `digest_matches: false` |
| An issuer's key is stolen                           | The owner suspends the issuer: no new tokens. Existing ones are flagged through `issuer_status`    |
| The platform rewrites or removes someone's record   | No owner method reaches a token                                                                    |
| A holder hides a revocation                         | The holder cannot change status or burn the token                                                  |
| An attestation ID is issued twice                   | Duplicate IDs are rejected                                                                         |
| Storage is filled at the contract's expense         | Every call that adds data must pay for its bytes                                                   |
| Guessing a private record from its digest           | The off-chain record carries a 128-bit random nonce, so the digest cannot be reconstructed         |

Known limits: the owner account is fixed at deployment (no handover method); there is no upgrade
or migration path; `issuer_status` is reported but a suspended issuer's existing tokens still
verify as valid, leaving that judgement to the reader. Tests are unit tests against the SDK's mock
runtime; it is deployed on testnet (above).
