//! ProofMe attestations.
//!
//! Each approved contribution is issued as an NFT (NEP-171, with NEP-177
//! metadata and NEP-181 enumeration) that behaves like a credential:
//!
//! - **Only registered issuers can mint.** An issuer is the NEAR account of an
//!   organisation, registered by the contract owner.
//! - **It cannot be transferred.** The token stays with the account that
//!   earned it, so it cannot be sold or lent. `nft_transfer` always fails.
//! - **Its status changes on-chain.** The issuer that minted it can revoke it,
//!   or replace it with a corrected one (supersede). Nothing is deleted.
//! - **The owner of the contract cannot touch a token.** It manages the issuer
//!   list and nothing else.
//!
//! - **It points at its own public record.** NEP-177 `reference` holds the
//!   address of the public credential document (an `ipfs://` CID) and
//!   `reference_hash` its Base64 SHA-256, so anyone can fetch and check the
//!   credential without ProofMe.
//!
//! Privacy: the chain holds the attestation ID, the SHA-256 digest of the
//! canonical record, the two accounts, the status and the address of the
//! public credential document. No claim text, names, evidence or reasons are
//! stored or logged.

use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{
    assert_one_yocto, env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault,
    Promise,
};

pub type TokenId = String;

const NFT_METADATA_SPEC: &str = "nft-1.0.0";
const NFT_STANDARD: &str = "nep171";
const NFT_STANDARD_VERSION: &str = "1.2.0";
const PROOFME_STANDARD: &str = "proofme";
const PROOFME_STANDARD_VERSION: &str = "1.0.0";

const MAX_ID_LENGTH: usize = 64;
const MAX_REFERENCE_LENGTH: usize = 256;
/// Base64 of a 32-byte SHA-256 hash, with padding.
const REFERENCE_HASH_LENGTH: usize = 44;
const DIGEST_LENGTH: usize = 64;
const DEFAULT_PAGE: u64 = 50;
const MAX_PAGE: u64 = 100;

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
enum StorageKey {
    Issuers,
    Attestations,
    AllTokens,
    OwnerTokenCount,
    OwnerTokens,
}

#[near(serializers = [borsh, json])]
#[serde(rename_all = "snake_case")]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum IssuerStatus {
    Active,
    Suspended,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Issuer {
    /// ProofMe's identifier for the organisation this account speaks for.
    pub organisation_id: String,
    pub status: IssuerStatus,
    /// Milliseconds since the Unix epoch.
    pub registered_at: u64,
}

#[near(serializers = [borsh, json])]
#[serde(rename_all = "snake_case")]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AttestationStatus {
    Active,
    Revoked,
    Superseded,
}

impl AttestationStatus {
    fn as_str(self) -> &'static str {
        match self {
            AttestationStatus::Active => "active",
            AttestationStatus::Revoked => "revoked",
            AttestationStatus::Superseded => "superseded",
        }
    }
}

/// What is stored for each token.
#[near(serializers = [borsh])]
#[derive(Clone, Debug)]
pub struct Attestation {
    owner_id: AccountId,
    issuer_id: AccountId,
    /// Lowercase hex SHA-256 of the canonical attestation record.
    digest: String,
    issued_at: u64,
    status: AttestationStatus,
    /// Equal to `issued_at` until the status changes.
    status_changed_at: u64,
    supersedes: Option<TokenId>,
    superseded_by: Option<TokenId>,
    /// NEP-177: where the public credential document lives, and its Base64 SHA-256.
    reference: Option<String>,
    reference_hash: Option<String>,
}

/// Where a credential's public document lives (NEP-177 `reference`).
#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CredentialReference {
    /// `ipfs://` or `https://` address of the public credential JSON.
    pub reference: String,
    /// Base64-encoded SHA-256 of the exact bytes at `reference`.
    pub reference_hash: String,
}

/// The full public record of one attestation.
#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AttestationView {
    pub token_id: TokenId,
    pub owner_id: AccountId,
    pub issuer_id: AccountId,
    pub organisation_id: String,
    pub issuer_status: IssuerStatus,
    pub digest: String,
    pub issued_at: u64,
    pub status: AttestationStatus,
    pub status_changed_at: u64,
    pub supersedes: Option<TokenId>,
    pub superseded_by: Option<TokenId>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
}

/// The answer to "is this record the one that was issued, and does it still stand?"
#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Verification {
    /// An attestation with this ID exists.
    pub found: bool,
    /// The digest supplied equals the digest recorded when it was issued.
    pub digest_matches: bool,
    pub status: Option<AttestationStatus>,
    pub issuer_id: Option<AccountId>,
    pub issuer_status: Option<IssuerStatus>,
    /// True only when it was found, the digest matches and it is still active.
    pub valid: bool,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NftContractMetadata {
    pub spec: String,
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub base_uri: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TokenMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub media: Option<String>,
    pub media_hash: Option<String>,
    pub copies: Option<u64>,
    pub issued_at: Option<u64>,
    pub expires_at: Option<u64>,
    pub starts_at: Option<u64>,
    pub updated_at: Option<u64>,
    pub extra: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Token {
    pub token_id: TokenId,
    pub owner_id: AccountId,
    pub metadata: TokenMetadata,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    /// Manages the issuer list. Has no power over any token.
    owner_id: AccountId,
    /// Where the public verification pages live, e.g. `https://proofme.example/verify`.
    base_uri: Option<String>,
    issuers: LookupMap<AccountId, Issuer>,
    attestations: LookupMap<TokenId, Attestation>,
    /// Every token ID in the order issued. Tokens are never deleted.
    all_tokens: Vector<TokenId>,
    owner_token_count: LookupMap<AccountId, u64>,
    /// (owner, position) → token ID. Positions never move: tokens cannot be transferred.
    owner_tokens: LookupMap<(AccountId, u64), TokenId>,
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId, base_uri: Option<String>) -> Self {
        if let Some(uri) = &base_uri {
            require!(
                uri.starts_with("https://") && uri.len() <= 200,
                "base_uri must be an https address of at most 200 characters"
            );
        }
        Self {
            owner_id,
            base_uri,
            issuers: LookupMap::new(StorageKey::Issuers),
            attestations: LookupMap::new(StorageKey::Attestations),
            all_tokens: Vector::new(StorageKey::AllTokens),
            owner_token_count: LookupMap::new(StorageKey::OwnerTokenCount),
            owner_tokens: LookupMap::new(StorageKey::OwnerTokens),
        }
    }

    // ── Issuer registry (contract owner only) ───────────────────────────────

    /// Registers the NEAR account that speaks for an organisation.
    /// Attach enough NEAR to cover the storage; the rest is refunded.
    #[payable]
    pub fn register_issuer(&mut self, issuer_id: AccountId, organisation_id: String) -> Issuer {
        self.assert_owner();
        require_valid_id(&organisation_id, "organisation_id");
        require!(
            !self.issuers.contains_key(&issuer_id),
            "This account is already a registered issuer"
        );
        let storage_before = env::storage_usage();
        let issuer = Issuer {
            organisation_id: organisation_id.clone(),
            status: IssuerStatus::Active,
            registered_at: env::block_timestamp_ms(),
        };
        self.issuers.insert(issuer_id.clone(), issuer.clone());
        self.issuers.flush();
        settle_storage(storage_before);
        emit(
            PROOFME_STANDARD,
            PROOFME_STANDARD_VERSION,
            "issuer_registered",
            json!([{ "issuer_id": issuer_id, "organisation_id": organisation_id }]),
        );
        issuer
    }

    /// Stops an issuer minting. Tokens it already issued are untouched, and it
    /// can still revoke them. Requires 1 yoctoNEAR.
    #[payable]
    pub fn suspend_issuer(&mut self, issuer_id: AccountId) {
        self.set_issuer_status(issuer_id, IssuerStatus::Suspended, "issuer_suspended");
    }

    /// Lets a suspended issuer mint again. Requires 1 yoctoNEAR.
    #[payable]
    pub fn reinstate_issuer(&mut self, issuer_id: AccountId) {
        self.set_issuer_status(issuer_id, IssuerStatus::Active, "issuer_reinstated");
    }

    pub fn get_owner(&self) -> AccountId {
        self.owner_id.clone()
    }

    pub fn get_issuer(&self, issuer_id: AccountId) -> Option<Issuer> {
        self.issuers.get(&issuer_id).cloned()
    }

    // ── Issuing, revoking, superseding (issuers only) ───────────────────────

    /// Mints an attestation to `receiver_id`. The caller must be an active
    /// issuer and cannot issue to itself. Attach enough NEAR to cover the
    /// storage; the rest is refunded.
    #[payable]
    pub fn issue(
        &mut self,
        token_id: TokenId,
        receiver_id: AccountId,
        digest: String,
        reference: Option<CredentialReference>,
    ) -> AttestationView {
        let storage_before = env::storage_usage();
        let issuer_id = self.assert_active_issuer();
        self.internal_mint(&token_id, &receiver_id, &issuer_id, digest, None, reference);
        self.flush_tokens();
        settle_storage(storage_before);
        self.view_of(&token_id).unwrap()
    }

    /// Withdraws the issuer's word. Only the account that issued the token can
    /// do this, and it can do it even after being suspended. The token stays
    /// with its owner, marked revoked. Requires 1 yoctoNEAR.
    #[payable]
    pub fn revoke(&mut self, token_id: TokenId) -> AttestationView {
        assert_one_yocto();
        let issuer_id = env::predecessor_account_id();
        let mut attestation = self.expect_issued_by(&token_id, &issuer_id);
        require!(
            attestation.status == AttestationStatus::Active,
            "Only an active attestation can be revoked"
        );
        attestation.status = AttestationStatus::Revoked;
        attestation.status_changed_at = env::block_timestamp_ms();
        let owner_id = attestation.owner_id.clone();
        self.attestations.insert(token_id.clone(), attestation);
        emit(
            PROOFME_STANDARD,
            PROOFME_STANDARD_VERSION,
            "attestation_revoked",
            json!([{ "token_id": token_id, "owner_id": owner_id, "issuer_id": issuer_id }]),
        );
        // The token's title, description, status and updated_at have changed.
        emit_metadata_update(&[&token_id]);
        self.view_of(&token_id).unwrap()
    }

    /// Replaces an active attestation with a corrected one for the same owner.
    /// The old token is marked superseded and points at the new one. The caller
    /// must be the active issuer that issued the old token. Attach enough NEAR
    /// to cover the storage; the rest is refunded.
    #[payable]
    pub fn supersede(
        &mut self,
        old_token_id: TokenId,
        token_id: TokenId,
        digest: String,
        reference: Option<CredentialReference>,
    ) -> AttestationView {
        let storage_before = env::storage_usage();
        let issuer_id = self.assert_active_issuer();
        let mut old = self.expect_issued_by(&old_token_id, &issuer_id);
        require!(
            old.status == AttestationStatus::Active,
            "Only an active attestation can be superseded"
        );
        let owner_id = old.owner_id.clone();
        self.internal_mint(
            &token_id,
            &owner_id,
            &issuer_id,
            digest,
            Some(old_token_id.clone()),
            reference,
        );
        old.status = AttestationStatus::Superseded;
        old.status_changed_at = env::block_timestamp_ms();
        old.superseded_by = Some(token_id.clone());
        self.attestations.insert(old_token_id.clone(), old);
        self.flush_tokens();
        settle_storage(storage_before);
        emit(
            PROOFME_STANDARD,
            PROOFME_STANDARD_VERSION,
            "attestation_superseded",
            json!([{
                "token_id": old_token_id,
                "superseded_by": token_id,
                "owner_id": owner_id,
                "issuer_id": issuer_id,
            }]),
        );
        emit_metadata_update(&[&old_token_id]);
        self.view_of(&token_id).unwrap()
    }

    // ── Verification (anyone) ───────────────────────────────────────────────

    pub fn get_attestation(&self, token_id: TokenId) -> Option<AttestationView> {
        self.view_of(&token_id)
    }

    /// Checks a digest someone has recomputed from a record against the one
    /// recorded when the attestation was issued, and reports whether it stands.
    pub fn verify(&self, token_id: TokenId, digest: String) -> Verification {
        match self.view_of(&token_id) {
            None => Verification {
                found: false,
                digest_matches: false,
                status: None,
                issuer_id: None,
                issuer_status: None,
                valid: false,
            },
            Some(view) => {
                let digest_matches = view.digest == digest;
                Verification {
                    found: true,
                    digest_matches,
                    status: Some(view.status),
                    issuer_id: Some(view.issuer_id),
                    issuer_status: Some(view.issuer_status),
                    valid: digest_matches && view.status == AttestationStatus::Active,
                }
            }
        }
    }

    // ── NEP-171 core ────────────────────────────────────────────────────────

    /// Always fails: an attestation belongs to the account that earned it.
    #[payable]
    #[allow(unused_variables)]
    pub fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        env::panic_str("ProofMe attestations cannot be transferred");
    }

    /// Always fails: an attestation belongs to the account that earned it.
    #[payable]
    #[allow(unused_variables)]
    pub fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> bool {
        env::panic_str("ProofMe attestations cannot be transferred");
    }

    pub fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.view_of(&token_id).map(|view| self.token_of(view))
    }

    // ── NEP-177 metadata ────────────────────────────────────────────────────

    pub fn nft_metadata(&self) -> NftContractMetadata {
        NftContractMetadata {
            spec: NFT_METADATA_SPEC.to_string(),
            name: "ProofMe attestations".to_string(),
            symbol: "PROOF".to_string(),
            icon: Some(ICON.to_string()),
            base_uri: self.base_uri.clone(),
            reference: None,
            reference_hash: None,
        }
    }

    // ── NEP-181 enumeration ─────────────────────────────────────────────────

    pub fn nft_total_supply(&self) -> U128 {
        U128(self.all_tokens.len() as u128)
    }

    pub fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        let (start, count) = page(from_index, limit);
        (start..start.saturating_add(count))
            .map_while(|index| u32::try_from(index).ok())
            .map_while(|index| self.all_tokens.get(index))
            .filter_map(|token_id| self.view_of(token_id))
            .map(|view| self.token_of(view))
            .collect()
    }

    pub fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        U128(
            self.owner_token_count
                .get(&account_id)
                .copied()
                .unwrap_or(0) as u128,
        )
    }

    pub fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<Token> {
        let total = self
            .owner_token_count
            .get(&account_id)
            .copied()
            .unwrap_or(0);
        let (start, count) = page(from_index, limit);
        (start..start.saturating_add(count).min(total))
            .filter_map(|index| self.owner_tokens.get(&(account_id.clone(), index)))
            .filter_map(|token_id| self.view_of(token_id))
            .map(|view| self.token_of(view))
            .collect()
    }
}

// ── Internals ────────────────────────────────────────────────────────────────

impl Contract {
    fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == self.owner_id,
            "Only the contract owner can manage issuers"
        );
    }

    fn assert_active_issuer(&self) -> AccountId {
        let issuer_id = env::predecessor_account_id();
        match self.issuers.get(&issuer_id) {
            Some(issuer) if issuer.status == IssuerStatus::Active => issuer_id,
            Some(_) => env::panic_str("This issuer is suspended"),
            None => env::panic_str("Only a registered issuer can do this"),
        }
    }

    fn set_issuer_status(&mut self, issuer_id: AccountId, status: IssuerStatus, event: &str) {
        assert_one_yocto();
        self.assert_owner();
        let Some(issuer) = self.issuers.get_mut(&issuer_id) else {
            env::panic_str("This account is not a registered issuer");
        };
        require!(
            issuer.status != status,
            "The issuer already has this status"
        );
        issuer.status = status;
        emit(
            PROOFME_STANDARD,
            PROOFME_STANDARD_VERSION,
            event,
            json!([{ "issuer_id": issuer_id }]),
        );
    }

    /// The attestation behind `token_id`, if `issuer_id` is the account that issued it.
    fn expect_issued_by(&self, token_id: &TokenId, issuer_id: &AccountId) -> Attestation {
        let Some(attestation) = self.attestations.get(token_id) else {
            env::panic_str("No attestation has this ID");
        };
        require!(
            &attestation.issuer_id == issuer_id,
            "Only the issuer of this attestation can do this"
        );
        attestation.clone()
    }

    fn internal_mint(
        &mut self,
        token_id: &TokenId,
        receiver_id: &AccountId,
        issuer_id: &AccountId,
        digest: String,
        supersedes: Option<TokenId>,
        reference: Option<CredentialReference>,
    ) {
        require_valid_id(token_id, "token_id");
        require_valid_digest(&digest);
        if let Some(reference) = &reference {
            require_valid_reference(reference);
        }
        require!(
            receiver_id != issuer_id,
            "An issuer cannot issue an attestation to itself"
        );
        require!(
            !self.attestations.contains_key(token_id),
            "An attestation with this ID already exists"
        );
        let now = env::block_timestamp_ms();
        self.attestations.insert(
            token_id.clone(),
            Attestation {
                owner_id: receiver_id.clone(),
                issuer_id: issuer_id.clone(),
                digest,
                issued_at: now,
                status: AttestationStatus::Active,
                status_changed_at: now,
                supersedes,
                superseded_by: None,
                reference: reference.as_ref().map(|r| r.reference.clone()),
                reference_hash: reference.map(|r| r.reference_hash),
            },
        );
        self.all_tokens.push(token_id.clone());
        let position = self
            .owner_token_count
            .get(receiver_id)
            .copied()
            .unwrap_or(0);
        self.owner_tokens
            .insert((receiver_id.clone(), position), token_id.clone());
        self.owner_token_count
            .insert(receiver_id.clone(), position + 1);
        emit(
            NFT_STANDARD,
            NFT_STANDARD_VERSION,
            "nft_mint",
            json!([{ "owner_id": receiver_id, "token_ids": [token_id] }]),
        );
    }

    /// Writes pending changes so the storage they use can be measured and charged.
    fn flush_tokens(&mut self) {
        self.attestations.flush();
        self.all_tokens.flush();
        self.owner_tokens.flush();
        self.owner_token_count.flush();
    }

    fn view_of(&self, token_id: &TokenId) -> Option<AttestationView> {
        let attestation = self.attestations.get(token_id)?;
        // An issuer is never removed, so this lookup always succeeds.
        let issuer = self.issuers.get(&attestation.issuer_id)?;
        Some(AttestationView {
            token_id: token_id.clone(),
            owner_id: attestation.owner_id.clone(),
            issuer_id: attestation.issuer_id.clone(),
            organisation_id: issuer.organisation_id.clone(),
            issuer_status: issuer.status,
            digest: attestation.digest.clone(),
            issued_at: attestation.issued_at,
            status: attestation.status,
            status_changed_at: attestation.status_changed_at,
            supersedes: attestation.supersedes.clone(),
            superseded_by: attestation.superseded_by.clone(),
            reference: attestation.reference.clone(),
            reference_hash: attestation.reference_hash.clone(),
        })
    }

    /// The NFT a wallet sees. Built on each read, so it always shows the current status.
    fn token_of(&self, view: AttestationView) -> Token {
        let status = view.status.as_str();
        let extra = json!({
            "digest": view.digest,
            "issuer_id": view.issuer_id,
            "organisation_id": view.organisation_id,
            "status": status,
            "transferable": false,
        });
        Token {
            token_id: view.token_id.clone(),
            owner_id: view.owner_id,
            metadata: TokenMetadata {
                title: Some(match view.status {
                    AttestationStatus::Active => "ProofMe attestation".to_string(),
                    _ => format!("ProofMe attestation ({status})"),
                }),
                description: Some(format!(
                    "A work record issued by {}. Status: {}. It cannot be transferred.",
                    view.issuer_id, status
                )),
                media: Some(badge(view.status)),
                media_hash: None,
                copies: Some(1),
                issued_at: Some(view.issued_at),
                expires_at: None,
                starts_at: None,
                updated_at: Some(view.status_changed_at),
                extra: Some(extra.to_string()),
                reference: view.reference,
                reference_hash: view.reference_hash,
            },
        }
    }
}

fn page(from_index: Option<U128>, limit: Option<u64>) -> (u64, u64) {
    let start = u64::try_from(from_index.map(|value| value.0).unwrap_or(0)).unwrap_or(u64::MAX);
    let count = limit.unwrap_or(DEFAULT_PAGE).min(MAX_PAGE);
    require!(count > 0, "limit must be greater than zero");
    (start, count)
}

/// IDs are UUIDs in practice. Lowercase letters, digits and hyphens only.
fn require_valid_id(value: &str, name: &str) {
    let ok = !value.is_empty()
        && value.len() <= MAX_ID_LENGTH
        && value
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-');
    if !ok {
        env::panic_str(&format!(
            "{name} must be 1 to {MAX_ID_LENGTH} lowercase letters, digits or hyphens"
        ));
    }
}

fn require_valid_digest(digest: &str) {
    let ok = digest.len() == DIGEST_LENGTH
        && digest
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte));
    require!(
        ok,
        "digest must be a SHA-256 hash as 64 lowercase hex characters"
    );
}

/// A reference must be an `ipfs://` or `https://` address and its hash a
/// Base64 SHA-256 (44 characters ending in `=`).
fn require_valid_reference(reference: &CredentialReference) {
    let address = &reference.reference;
    require!(
        address.len() <= MAX_REFERENCE_LENGTH
            && (address.starts_with("ipfs://") || address.starts_with("https://"))
            && address.len() > 8
            && !address
                .bytes()
                .any(|byte| byte.is_ascii_whitespace() || byte.is_ascii_control()),
        "reference must be an ipfs:// or https:// address of at most 256 characters"
    );
    let hash = &reference.reference_hash;
    require!(
        hash.len() == REFERENCE_HASH_LENGTH
            && hash.ends_with('=')
            && !hash.ends_with("==")
            && hash[..REFERENCE_HASH_LENGTH - 1]
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'+' || byte == b'/'),
        "reference_hash must be the Base64 SHA-256 of the referenced document"
    );
}

/// NEP-171 1.2.0 `nft_metadata_update`: tells indexers and wallets to re-read these tokens.
fn emit_metadata_update(token_ids: &[&TokenId]) {
    emit(
        NFT_STANDARD,
        NFT_STANDARD_VERSION,
        "nft_metadata_update",
        json!([{ "token_ids": token_ids }]),
    );
}

/// Charges the caller for the storage this call added and refunds the rest.
/// Fails, undoing the call, if too little was attached.
fn settle_storage(storage_before: u64) {
    let added = env::storage_usage().saturating_sub(storage_before);
    let cost = env::storage_byte_cost().saturating_mul(u128::from(added));
    let attached = env::attached_deposit();
    if attached < cost {
        env::panic_str(&format!(
            "Attach at least {} yoctoNEAR to cover storage",
            cost.as_yoctonear()
        ));
    }
    let refund = attached.saturating_sub(cost);
    if refund > NearToken::from_yoctonear(0) {
        Promise::new(env::predecessor_account_id())
            .transfer(refund)
            .detach();
    }
}

/// Logs a NEP-297 event.
fn emit(standard: &str, version: &str, event: &str, data: near_sdk::serde_json::Value) {
    let body = json!({ "standard": standard, "version": version, "event": event, "data": data });
    env::log_str(&format!("EVENT_JSON:{body}"));
}

/// The image a wallet shows for a token: a badge in the colour of its current
/// status, built on each read, so a revoked or replaced credential looks it.
fn badge(status: AttestationStatus) -> String {
    let (fill, label, mark) = match status {
        AttestationStatus::Active => (
            "%232F54EB",
            "Verified%20work",
            "%3Cpath d='M44 66l13 13 27-29' fill='none' stroke='%23fff' stroke-width='9' stroke-linecap='round' stroke-linejoin='round'/%3E",
        ),
        AttestationStatus::Revoked => (
            "%23B42318",
            "Revoked",
            "%3Cpath d='M48 48l32 32M80 48L48 80' fill='none' stroke='%23fff' stroke-width='9' stroke-linecap='round'/%3E",
        ),
        AttestationStatus::Superseded => (
            "%236B7280",
            "Replaced",
            "%3Cpath d='M44 64h40M70 50l14 14-14 14' fill='none' stroke='%23fff' stroke-width='9' stroke-linecap='round' stroke-linejoin='round'/%3E",
        ),
    };
    format!(
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 160'%3E%3Crect width='128' height='160' rx='20' fill='{fill}'/%3E%3Ccircle cx='64' cy='64' r='38' fill='none' stroke='%23fff' stroke-opacity='.35' stroke-width='4'/%3E{mark}%3Ctext x='64' y='130' fill='%23fff' font-family='sans-serif' font-size='14' font-weight='700' text-anchor='middle'%3EProofMe%3C/text%3E%3Ctext x='64' y='148' fill='%23fff' font-family='sans-serif' font-size='11' text-anchor='middle'%3E{label}%3C/text%3E%3C/svg%3E"
    )
}

/// The ProofMe mark: a white check on a blue rounded square.
const ICON: &str = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%232F54EB'/%3E%3Cpath d='M9.5 16.5l4.2 4.2 8.8-9.4' fill='none' stroke='%23fff' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

#[cfg(test)]
mod tests;
