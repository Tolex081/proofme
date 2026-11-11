use near_sdk::serde_json::{self, Value};
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::{testing_env, AccountId, NearToken};

use super::*;

const DIGEST: &str = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
const OTHER_DIGEST: &str = "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae";
const ORGANISATION: &str = "0b5f2a52-6c0f-4b7e-9d0a-3a1d9f5e7c11";
const TOKEN: &str = "5d7c1c0e-2f4a-4d53-8f43-0a6f3f1f9b01";
const TOKEN_2: &str = "5d7c1c0e-2f4a-4d53-8f43-0a6f3f1f9b02";
const TOKEN_3: &str = "5d7c1c0e-2f4a-4d53-8f43-0a6f3f1f9b03";

const T0: u64 = 1_800_000_000_000;
const STORAGE: NearToken = NearToken::from_millinear(100);
const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);
const NOTHING: NearToken = NearToken::from_yoctonear(0);

fn account(name: &str) -> AccountId {
    name.parse().unwrap()
}
fn owner() -> AccountId {
    account("proofme.testnet")
}
fn issuer() -> AccountId {
    account("northstar.testnet")
}
fn other_issuer() -> AccountId {
    account("riverbank.testnet")
}
fn alice() -> AccountId {
    account("alice.testnet")
}
fn bob() -> AccountId {
    account("bob.testnet")
}

/// Sets who is calling, what they attached and the time (milliseconds).
fn call_as(caller: &AccountId, deposit: NearToken, at_ms: u64) {
    testing_env!(VMContextBuilder::new()
        .current_account_id(account("attestations.proofme.testnet"))
        .predecessor_account_id(caller.clone())
        .signer_account_id(caller.clone())
        .attached_deposit(deposit)
        .block_timestamp(at_ms * 1_000_000)
        .build());
}

/// A contract with one registered issuer.
fn setup() -> Contract {
    call_as(&owner(), NOTHING, T0);
    let mut contract = Contract::new(owner(), Some("https://proofme.example/verify".into()));
    call_as(&owner(), STORAGE, T0);
    contract.register_issuer(issuer(), ORGANISATION.into());
    contract
}

fn issue(contract: &mut Contract, token_id: &str, to: &AccountId, at_ms: u64) -> AttestationView {
    call_as(&issuer(), STORAGE, at_ms);
    contract.issue(token_id.into(), to.clone(), DIGEST.into())
}

fn last_event() -> Value {
    let logs = get_logs();
    let log = logs.last().expect("an event was logged");
    serde_json::from_str(log.strip_prefix("EVENT_JSON:").expect("an EVENT_JSON log")).unwrap()
}

fn events() -> Vec<Value> {
    get_logs()
        .iter()
        .map(|log| serde_json::from_str(log.strip_prefix("EVENT_JSON:").unwrap()).unwrap())
        .collect()
}

// ── Setting up ───────────────────────────────────────────────────────────────

#[test]
fn starts_empty_with_its_owner_and_metadata() {
    let contract = setup();
    assert_eq!(contract.get_owner(), owner());
    assert_eq!(contract.nft_total_supply(), U128(0));
    let metadata = contract.nft_metadata();
    assert_eq!(metadata.spec, "nft-1.0.0");
    assert_eq!(metadata.name, "ProofMe attestations");
    assert_eq!(metadata.symbol, "PROOF");
    assert_eq!(
        metadata.base_uri.as_deref(),
        Some("https://proofme.example/verify")
    );
    assert!(metadata.icon.unwrap().starts_with("data:image/svg+xml,"));
}

#[test]
#[should_panic(expected = "base_uri must be an https address")]
fn rejects_a_base_uri_that_is_not_https() {
    call_as(&owner(), NOTHING, T0);
    Contract::new(owner(), Some("http://proofme.example".into()));
}

// ── Issuer registry ──────────────────────────────────────────────────────────

#[test]
fn owner_registers_an_issuer() {
    let contract = setup();
    let registered = contract.get_issuer(issuer()).unwrap();
    assert_eq!(registered.organisation_id, ORGANISATION);
    assert_eq!(registered.status, IssuerStatus::Active);
    assert_eq!(registered.registered_at, T0);
    assert_eq!(contract.get_issuer(other_issuer()), None);

    let event = last_event();
    assert_eq!(event["standard"], "proofme");
    assert_eq!(event["event"], "issuer_registered");
    assert_eq!(event["data"][0]["issuer_id"], issuer().as_str());
    assert_eq!(event["data"][0]["organisation_id"], ORGANISATION);
}

#[test]
#[should_panic(expected = "Only the contract owner can manage issuers")]
fn nobody_else_can_register_an_issuer() {
    let mut contract = setup();
    call_as(&issuer(), STORAGE, T0);
    contract.register_issuer(other_issuer(), ORGANISATION.into());
}

#[test]
#[should_panic(expected = "already a registered issuer")]
fn an_issuer_cannot_be_registered_twice() {
    let mut contract = setup();
    call_as(&owner(), STORAGE, T0);
    contract.register_issuer(issuer(), ORGANISATION.into());
}

#[test]
#[should_panic(expected = "organisation_id must be")]
fn rejects_a_malformed_organisation_id() {
    let mut contract = setup();
    call_as(&owner(), STORAGE, T0);
    contract.register_issuer(other_issuer(), "Northstar Protocol".into());
}

#[test]
#[should_panic(expected = "to cover storage")]
fn registering_an_issuer_must_pay_for_its_storage() {
    let mut contract = setup();
    call_as(&owner(), NOTHING, T0);
    contract.register_issuer(other_issuer(), ORGANISATION.into());
}

#[test]
fn owner_suspends_and_reinstates_an_issuer() {
    let mut contract = setup();
    call_as(&owner(), ONE_YOCTO, T0);
    contract.suspend_issuer(issuer());
    assert_eq!(
        contract.get_issuer(issuer()).unwrap().status,
        IssuerStatus::Suspended
    );
    assert_eq!(last_event()["event"], "issuer_suspended");

    call_as(&owner(), ONE_YOCTO, T0);
    contract.reinstate_issuer(issuer());
    assert_eq!(
        contract.get_issuer(issuer()).unwrap().status,
        IssuerStatus::Active
    );
    assert_eq!(last_event()["event"], "issuer_reinstated");
    issue(&mut contract, TOKEN, &alice(), T0);
}

#[test]
#[should_panic(expected = "Only the contract owner can manage issuers")]
fn an_issuer_cannot_reinstate_itself() {
    let mut contract = setup();
    call_as(&owner(), ONE_YOCTO, T0);
    contract.suspend_issuer(issuer());
    call_as(&issuer(), ONE_YOCTO, T0);
    contract.reinstate_issuer(issuer());
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn suspending_needs_one_yocto() {
    let mut contract = setup();
    call_as(&owner(), NOTHING, T0);
    contract.suspend_issuer(issuer());
}

#[test]
#[should_panic(expected = "not a registered issuer")]
fn cannot_suspend_an_unknown_account() {
    let mut contract = setup();
    call_as(&owner(), ONE_YOCTO, T0);
    contract.suspend_issuer(other_issuer());
}

// ── Issuing ──────────────────────────────────────────────────────────────────

#[test]
fn an_issuer_mints_an_attestation_to_a_contributor() {
    let mut contract = setup();
    let view = issue(&mut contract, TOKEN, &alice(), T0 + 5);

    assert_eq!(
        view,
        AttestationView {
            token_id: TOKEN.into(),
            owner_id: alice(),
            issuer_id: issuer(),
            organisation_id: ORGANISATION.into(),
            issuer_status: IssuerStatus::Active,
            digest: DIGEST.into(),
            issued_at: T0 + 5,
            status: AttestationStatus::Active,
            status_changed_at: T0 + 5,
            supersedes: None,
            superseded_by: None,
        }
    );
    assert_eq!(contract.get_attestation(TOKEN.into()), Some(view));

    let event = last_event();
    assert_eq!(event["standard"], "nep171");
    assert_eq!(event["version"], "1.2.0");
    assert_eq!(event["event"], "nft_mint");
    assert_eq!(event["data"][0]["owner_id"], alice().as_str());
    assert_eq!(event["data"][0]["token_ids"][0], TOKEN);

    assert_eq!(contract.nft_total_supply(), U128(1));
    assert_eq!(contract.nft_supply_for_owner(alice()), U128(1));
    assert_eq!(contract.nft_supply_for_owner(bob()), U128(0));
}

#[test]
fn the_token_is_a_standard_nft_carrying_its_status() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    let token = contract.nft_token(TOKEN.into()).unwrap();
    assert_eq!(token.token_id, TOKEN);
    assert_eq!(token.owner_id, alice());
    assert_eq!(token.metadata.title.as_deref(), Some("ProofMe attestation"));
    assert_eq!(token.metadata.issued_at, Some(T0));
    assert_eq!(token.metadata.copies, Some(1));

    let extra: Value = serde_json::from_str(&token.metadata.extra.unwrap()).unwrap();
    assert_eq!(extra["digest"], DIGEST);
    assert_eq!(extra["issuer_id"], issuer().as_str());
    assert_eq!(extra["organisation_id"], ORGANISATION);
    assert_eq!(extra["status"], "active");
    assert_eq!(extra["transferable"], false);

    assert_eq!(contract.nft_token(TOKEN_2.into()), None);
}

#[test]
#[should_panic(expected = "Only a registered issuer can do this")]
fn an_unregistered_account_cannot_mint() {
    let mut contract = setup();
    call_as(&bob(), STORAGE, T0);
    contract.issue(TOKEN.into(), alice(), DIGEST.into());
}

#[test]
#[should_panic(expected = "Only a registered issuer can do this")]
fn the_contract_owner_cannot_mint() {
    let mut contract = setup();
    call_as(&owner(), STORAGE, T0);
    contract.issue(TOKEN.into(), alice(), DIGEST.into());
}

#[test]
#[should_panic(expected = "This issuer is suspended")]
fn a_suspended_issuer_cannot_mint() {
    let mut contract = setup();
    call_as(&owner(), ONE_YOCTO, T0);
    contract.suspend_issuer(issuer());
    issue(&mut contract, TOKEN, &alice(), T0);
}

#[test]
#[should_panic(expected = "An issuer cannot issue an attestation to itself")]
fn an_issuer_cannot_mint_to_itself() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &issuer(), T0);
}

#[test]
#[should_panic(expected = "An attestation with this ID already exists")]
fn an_attestation_id_can_be_used_once() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    issue(&mut contract, TOKEN, &bob(), T0);
}

#[test]
#[should_panic(expected = "digest must be a SHA-256 hash")]
fn rejects_an_uppercase_digest() {
    let mut contract = setup();
    call_as(&issuer(), STORAGE, T0);
    contract.issue(TOKEN.into(), alice(), DIGEST.to_uppercase());
}

#[test]
#[should_panic(expected = "digest must be a SHA-256 hash")]
fn rejects_a_short_digest() {
    let mut contract = setup();
    call_as(&issuer(), STORAGE, T0);
    contract.issue(TOKEN.into(), alice(), DIGEST[..63].into());
}

#[test]
#[should_panic(expected = "token_id must be")]
fn rejects_a_malformed_token_id() {
    let mut contract = setup();
    call_as(&issuer(), STORAGE, T0);
    contract.issue("Not An ID".into(), alice(), DIGEST.into());
}

#[test]
#[should_panic(expected = "token_id must be")]
fn rejects_an_empty_token_id() {
    let mut contract = setup();
    call_as(&issuer(), STORAGE, T0);
    contract.issue("".into(), alice(), DIGEST.into());
}

#[test]
#[should_panic(expected = "to cover storage")]
fn minting_must_pay_for_its_storage() {
    let mut contract = setup();
    call_as(&issuer(), ONE_YOCTO, T0);
    contract.issue(TOKEN.into(), alice(), DIGEST.into());
}

// ── Transfers ────────────────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "ProofMe attestations cannot be transferred")]
fn the_holder_cannot_transfer_it() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    call_as(&alice(), ONE_YOCTO, T0);
    contract.nft_transfer(bob(), TOKEN.into(), None, None);
}

#[test]
#[should_panic(expected = "ProofMe attestations cannot be transferred")]
fn the_issuer_cannot_transfer_it() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    call_as(&issuer(), ONE_YOCTO, T0);
    contract.nft_transfer(bob(), TOKEN.into(), None, None);
}

#[test]
#[should_panic(expected = "ProofMe attestations cannot be transferred")]
fn it_cannot_be_transferred_through_a_contract_call() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    call_as(&alice(), ONE_YOCTO, T0);
    contract.nft_transfer_call(bob(), TOKEN.into(), None, None, "".into());
}

// ── Revoking ─────────────────────────────────────────────────────────────────

#[test]
fn the_issuer_revokes_and_the_token_shows_it() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);

    call_as(&issuer(), ONE_YOCTO, T0 + 60_000);
    let view = contract.revoke(TOKEN.into());
    assert_eq!(view.status, AttestationStatus::Revoked);
    assert_eq!(view.issued_at, T0);
    assert_eq!(view.status_changed_at, T0 + 60_000);
    assert_eq!(view.owner_id, alice());

    let event = last_event();
    assert_eq!(event["standard"], "proofme");
    assert_eq!(event["event"], "attestation_revoked");
    assert_eq!(event["data"][0]["token_id"], TOKEN);

    // The holder keeps the token; it now reads as revoked everywhere.
    let token = contract.nft_token(TOKEN.into()).unwrap();
    assert_eq!(token.owner_id, alice());
    assert_eq!(
        token.metadata.title.as_deref(),
        Some("ProofMe attestation (revoked)")
    );
    assert_eq!(token.metadata.updated_at, Some(T0 + 60_000));
    let extra: Value = serde_json::from_str(&token.metadata.extra.unwrap()).unwrap();
    assert_eq!(extra["status"], "revoked");
    assert_eq!(contract.nft_supply_for_owner(alice()), U128(1));
}

#[test]
fn a_suspended_issuer_can_still_revoke_its_own() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    call_as(&owner(), ONE_YOCTO, T0);
    contract.suspend_issuer(issuer());
    call_as(&issuer(), ONE_YOCTO, T0 + 1);
    let view = contract.revoke(TOKEN.into());
    assert_eq!(view.status, AttestationStatus::Revoked);
    assert_eq!(view.issuer_status, IssuerStatus::Suspended);
}

#[test]
#[should_panic(expected = "Only the issuer of this attestation can do this")]
fn the_contract_owner_cannot_revoke() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    call_as(&owner(), ONE_YOCTO, T0);
    contract.revoke(TOKEN.into());
}

#[test]
#[should_panic(expected = "Only the issuer of this attestation can do this")]
fn the_holder_cannot_revoke() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    call_as(&alice(), ONE_YOCTO, T0);
    contract.revoke(TOKEN.into());
}

#[test]
#[should_panic(expected = "Only the issuer of this attestation can do this")]
fn another_issuer_cannot_revoke() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    call_as(&owner(), STORAGE, T0);
    contract.register_issuer(other_issuer(), "riverbank".into());
    call_as(&other_issuer(), ONE_YOCTO, T0);
    contract.revoke(TOKEN.into());
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn revoking_needs_one_yocto() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    call_as(&issuer(), NOTHING, T0);
    contract.revoke(TOKEN.into());
}

#[test]
#[should_panic(expected = "Only an active attestation can be revoked")]
fn cannot_revoke_twice() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    call_as(&issuer(), ONE_YOCTO, T0);
    contract.revoke(TOKEN.into());
    call_as(&issuer(), ONE_YOCTO, T0);
    contract.revoke(TOKEN.into());
}

#[test]
#[should_panic(expected = "No attestation has this ID")]
fn cannot_revoke_what_does_not_exist() {
    let mut contract = setup();
    call_as(&issuer(), ONE_YOCTO, T0);
    contract.revoke(TOKEN.into());
}

// ── Superseding ──────────────────────────────────────────────────────────────

#[test]
fn the_issuer_replaces_an_attestation_with_a_corrected_one() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);

    call_as(&issuer(), STORAGE, T0 + 9_000);
    let replacement = contract.supersede(TOKEN.into(), TOKEN_2.into(), OTHER_DIGEST.into());
    assert_eq!(replacement.owner_id, alice());
    assert_eq!(replacement.status, AttestationStatus::Active);
    assert_eq!(replacement.digest, OTHER_DIGEST);
    assert_eq!(replacement.supersedes.as_deref(), Some(TOKEN));

    let old = contract.get_attestation(TOKEN.into()).unwrap();
    assert_eq!(old.status, AttestationStatus::Superseded);
    assert_eq!(old.superseded_by.as_deref(), Some(TOKEN_2));
    assert_eq!(old.status_changed_at, T0 + 9_000);
    assert_eq!(old.digest, DIGEST);

    let logged = events();
    assert_eq!(logged[0]["event"], "nft_mint");
    assert_eq!(logged[0]["data"][0]["token_ids"][0], TOKEN_2);
    assert_eq!(logged[1]["event"], "attestation_superseded");
    assert_eq!(logged[1]["data"][0]["superseded_by"], TOKEN_2);

    assert_eq!(contract.nft_total_supply(), U128(2));
    assert_eq!(contract.nft_supply_for_owner(alice()), U128(2));
}

#[test]
#[should_panic(expected = "Only an active attestation can be superseded")]
fn a_revoked_attestation_cannot_be_superseded() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    call_as(&issuer(), ONE_YOCTO, T0);
    contract.revoke(TOKEN.into());
    call_as(&issuer(), STORAGE, T0);
    contract.supersede(TOKEN.into(), TOKEN_2.into(), OTHER_DIGEST.into());
}

#[test]
#[should_panic(expected = "Only an active attestation can be revoked")]
fn a_superseded_attestation_cannot_be_revoked() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    call_as(&issuer(), STORAGE, T0);
    contract.supersede(TOKEN.into(), TOKEN_2.into(), OTHER_DIGEST.into());
    call_as(&issuer(), ONE_YOCTO, T0);
    contract.revoke(TOKEN.into());
}

#[test]
#[should_panic(expected = "Only the issuer of this attestation can do this")]
fn another_issuer_cannot_supersede() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    call_as(&owner(), STORAGE, T0);
    contract.register_issuer(other_issuer(), "riverbank".into());
    call_as(&other_issuer(), STORAGE, T0);
    contract.supersede(TOKEN.into(), TOKEN_2.into(), OTHER_DIGEST.into());
}

#[test]
#[should_panic(expected = "This issuer is suspended")]
fn a_suspended_issuer_cannot_supersede() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    call_as(&owner(), ONE_YOCTO, T0);
    contract.suspend_issuer(issuer());
    call_as(&issuer(), STORAGE, T0);
    contract.supersede(TOKEN.into(), TOKEN_2.into(), OTHER_DIGEST.into());
}

#[test]
#[should_panic(expected = "An attestation with this ID already exists")]
fn a_replacement_needs_a_new_id() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    call_as(&issuer(), STORAGE, T0);
    contract.supersede(TOKEN.into(), TOKEN.into(), OTHER_DIGEST.into());
}

// ── Verifying ────────────────────────────────────────────────────────────────

#[test]
fn verify_reports_a_matching_active_attestation_as_valid() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    assert_eq!(
        contract.verify(TOKEN.into(), DIGEST.into()),
        Verification {
            found: true,
            digest_matches: true,
            status: Some(AttestationStatus::Active),
            issuer_id: Some(issuer()),
            issuer_status: Some(IssuerStatus::Active),
            valid: true,
        }
    );
}

#[test]
fn verify_catches_an_altered_record() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    let result = contract.verify(TOKEN.into(), OTHER_DIGEST.into());
    assert!(result.found);
    assert!(!result.digest_matches);
    assert!(!result.valid);
}

#[test]
fn verify_reports_a_revoked_attestation_as_not_valid() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    call_as(&issuer(), ONE_YOCTO, T0);
    contract.revoke(TOKEN.into());
    let result = contract.verify(TOKEN.into(), DIGEST.into());
    assert!(result.digest_matches);
    assert_eq!(result.status, Some(AttestationStatus::Revoked));
    assert!(!result.valid);
}

#[test]
fn verify_reports_an_unknown_id_as_not_found() {
    let contract = setup();
    assert_eq!(
        contract.verify(TOKEN.into(), DIGEST.into()),
        Verification {
            found: false,
            digest_matches: false,
            status: None,
            issuer_id: None,
            issuer_status: None,
            valid: false,
        }
    );
}

#[test]
fn verify_shows_when_the_issuer_was_later_suspended() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    call_as(&owner(), ONE_YOCTO, T0);
    contract.suspend_issuer(issuer());
    let result = contract.verify(TOKEN.into(), DIGEST.into());
    assert_eq!(result.issuer_status, Some(IssuerStatus::Suspended));
    // The attestation itself still stands; the reader decides what suspension means.
    assert!(result.valid);
}

// ── Listing ──────────────────────────────────────────────────────────────────

fn ids(tokens: Vec<Token>) -> Vec<String> {
    tokens.into_iter().map(|token| token.token_id).collect()
}

#[test]
fn lists_all_tokens_in_pages() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    issue(&mut contract, TOKEN_2, &bob(), T0);
    issue(&mut contract, TOKEN_3, &alice(), T0);

    assert_eq!(
        ids(contract.nft_tokens(None, None)),
        [TOKEN, TOKEN_2, TOKEN_3]
    );
    assert_eq!(ids(contract.nft_tokens(Some(U128(1)), Some(1))), [TOKEN_2]);
    assert_eq!(ids(contract.nft_tokens(Some(U128(2)), Some(10))), [TOKEN_3]);
    assert!(contract.nft_tokens(Some(U128(3)), None).is_empty());
    assert!(contract.nft_tokens(Some(U128(u128::MAX)), None).is_empty());
}

#[test]
fn lists_one_owners_tokens_in_pages() {
    let mut contract = setup();
    issue(&mut contract, TOKEN, &alice(), T0);
    issue(&mut contract, TOKEN_2, &bob(), T0);
    issue(&mut contract, TOKEN_3, &alice(), T0);

    assert_eq!(
        ids(contract.nft_tokens_for_owner(alice(), None, None)),
        [TOKEN, TOKEN_3]
    );
    assert_eq!(
        ids(contract.nft_tokens_for_owner(alice(), Some(U128(1)), Some(5))),
        [TOKEN_3]
    );
    assert_eq!(
        ids(contract.nft_tokens_for_owner(bob(), None, None)),
        [TOKEN_2]
    );
    assert!(contract
        .nft_tokens_for_owner(account("nobody.testnet"), None, None)
        .is_empty());
    assert!(contract
        .nft_tokens_for_owner(alice(), Some(U128(u128::MAX)), None)
        .is_empty());
}

#[test]
#[should_panic(expected = "limit must be greater than zero")]
fn rejects_a_zero_page_size() {
    let contract = setup();
    contract.nft_tokens(None, Some(0));
}
