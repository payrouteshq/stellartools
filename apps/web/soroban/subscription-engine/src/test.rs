#![cfg(test)]

use crate::{SubscriptionEngine, SubscriptionEngineClient};
use soroban_sdk::{
    testutils::{storage::Persistent as _, Address as _, Events, Ledger},
    token, Address, Env, IntoVal, TryFromVal, Val, String, Symbol,
};

/// Event topics are a `Vec<Val>`, not a single `Val` — decode element-wise.
fn topic_at<T: TryFromVal<Env, Val>>(env: &Env, topics: &soroban_sdk::Vec<Val>, idx: u32) -> T {
    T::try_from_val(env, &topics.get(idx).unwrap()).unwrap()
}

struct Setup<'a> {
    env: Env,
    client: SubscriptionEngineClient<'a>,
    admin: Address,
    customer: Address,
    merchant: Address,
    token: Address,
}

fn setup() -> Setup<'static> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000_000);

    let admin = Address::generate(&env);
    let customer = Address::generate(&env);
    let merchant = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);
    token_admin_client.mint(&customer, &1_000_000_000);

    let contract_id = env.register(SubscriptionEngine, (admin.clone(),));
    let client = SubscriptionEngineClient::new(&env, &contract_id);

    // Customer approves the subscription contract as spender, like the app does
    // (roughly 200x the subscription cost, held for months).
    let token_client = token::TokenClient::new(&env, &token_address);
    token_client.approve(&customer, &contract_id, &1_000_000_000, &(env.ledger().sequence() + 1_000_000));

    Setup { env, client, admin, customer, merchant, token: token_address }
}

fn product(e: &Env) -> String {
    String::from_str(e, "prod_premium")
}

// ---------------------------------------------------------------------
// start() — must require the customer's own authorization
// ---------------------------------------------------------------------

#[test]
fn start_succeeds_with_customer_auth() {
    let s = setup();
    s.client.start(&s.customer, &s.merchant, &s.token, &product(&s.env), &1_000, &86_400);

    let sub = s.client.get_subscription(&s.customer, &s.merchant, &product(&s.env));
    assert_eq!(sub.amount, 1_000);
    assert_eq!(sub.period_duration, 86_400);
    assert_eq!(sub.status, String::from_str(&s.env, "active"));
}

#[test]
fn start_fails_without_any_customer_authorization() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000_000);

    let admin = Address::generate(&env);
    let customer = Address::generate(&env);
    let attacker = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_contract.address();

    let contract_id = env.register(SubscriptionEngine, (admin.clone(),));
    let client = SubscriptionEngineClient::new(&env, &contract_id);

    // Reproduces the reported exploit: an attacker (not the customer) tries to
    // open a subscription naming a victim customer and themselves as merchant,
    // mocking only their OWN authorization, never the customer's.
    env.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &attacker,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &contract_id,
            fn_name: "start",
            args: (
                &customer,
                &attacker,
                &token_address,
                product(&env),
                1_000i128,
                86_400u64,
            )
                .into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_start(&customer, &attacker, &token_address, &product(&env), &1_000, &86_400);
    assert!(result.is_err(), "start() must reject a caller who is not the customer");
}

#[test]
fn start_rejects_zero_amount_and_zero_duration() {
    let s = setup();
    assert!(s.client.try_start(&s.customer, &s.merchant, &s.token, &product(&s.env), &0, &86_400).is_err());
    assert!(s.client.try_start(&s.customer, &s.merchant, &s.token, &product(&s.env), &1_000, &0).is_err());
}

#[test]
fn start_rejects_customer_equal_to_merchant() {
    let s = setup();
    assert!(s
        .client
        .try_start(&s.customer, &s.customer, &s.token, &product(&s.env), &1_000, &86_400)
        .is_err());
}

#[test]
fn start_rejects_duplicate_active_subscription() {
    let s = setup();
    s.client.start(&s.customer, &s.merchant, &s.token, &product(&s.env), &1_000, &86_400);
    let result = s.client.try_start(&s.customer, &s.merchant, &s.token, &product(&s.env), &1_000, &86_400);
    assert!(result.is_err());
}

#[test]
fn start_emits_sub_start_event() {
    let s = setup();
    s.client.start(&s.customer, &s.merchant, &s.token, &product(&s.env), &1_000, &86_400);

    let events = s.env.events().all();
    let published = events.last().unwrap();
    let topic0: Symbol = topic_at(&s.env, &published.1, 0);
    let topic1: Address = topic_at(&s.env, &published.1, 1);
    assert_eq!(topic0, Symbol::new(&s.env, "sub_start"));
    assert_eq!(topic1, s.customer);

    let data: i128 = soroban_sdk::TryFromVal::try_from_val(&s.env, &published.2).unwrap();
    assert_eq!(data, 1_000);
}

// ---------------------------------------------------------------------
// charge() — must require the stored operator's authorization, and only
// the operator's; the amount arg alone is not evidence of legitimacy.
// ---------------------------------------------------------------------

#[test]
fn charge_succeeds_with_operator_auth_after_period_end() {
    let s = setup();
    s.client.start(&s.customer, &s.merchant, &s.token, &product(&s.env), &1_000, &86_400);

    s.env.ledger().set_timestamp(1_000_000 + 86_400);
    s.client.charge(&s.customer, &s.merchant, &product(&s.env), &1_100);

    let auths = s.env.auths();
    assert!(auths.iter().any(|(addr, _)| addr == &s.admin));

    let sub = s.client.get_subscription(&s.customer, &s.merchant, &product(&s.env));
    assert_eq!(sub.amount, 1_100);
    assert_eq!(sub.period_end, 1_000_000 + 86_400 + 86_400);
}

#[test]
fn charge_fails_when_caller_is_not_the_operator() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000_000);

    let admin = Address::generate(&env);
    let customer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let attacker = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_contract.address();
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);
    token_admin_client.mock_all_auths().mint(&customer, &1_000_000_000);

    let contract_id = env.register(SubscriptionEngine, (admin.clone(),));
    let client = SubscriptionEngineClient::new(&env, &contract_id);

    let token_client = token::TokenClient::new(&env, &token_address);
    token_client
        .mock_all_auths()
        .approve(&customer, &contract_id, &1_000_000_000, &(env.ledger().sequence() + 1_000_000));

    client.mock_all_auths().start(&customer, &merchant, &token_address, &product(&env), &1_000, &86_400);
    env.ledger().set_timestamp(1_000_000 + 86_400);

    // Reproduces the reported "anybody can call charge()" bug: an attacker
    // (not the stored admin) authorizes themselves and tries to drain funds
    // via a self-chosen amount.
    env.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &attacker,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &contract_id,
            fn_name: "charge",
            args: (&customer, &merchant, product(&env), 999_999_999i128).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_charge(&customer, &merchant, &product(&env), &999_999_999);
    assert!(result.is_err(), "charge() must reject a caller who is not the stored operator");
}

#[test]
fn charge_fails_before_period_end() {
    let s = setup();
    s.client.start(&s.customer, &s.merchant, &s.token, &product(&s.env), &1_000, &86_400);
    let result = s.client.try_charge(&s.customer, &s.merchant, &product(&s.env), &1_000);
    assert!(result.is_err());
}

#[test]
fn charge_fails_on_paused_or_canceled_subscription() {
    let s = setup();
    s.client.start(&s.customer, &s.merchant, &s.token, &product(&s.env), &1_000, &86_400);
    s.client.pause(&s.customer, &s.merchant, &product(&s.env), &s.customer);
    s.env.ledger().set_timestamp(1_000_000 + 86_400);
    assert!(s.client.try_charge(&s.customer, &s.merchant, &product(&s.env), &1_000).is_err());

    s.client.cancel(&s.customer, &s.merchant, &product(&s.env), &s.customer);
    assert!(s.client.try_charge(&s.customer, &s.merchant, &product(&s.env), &1_000).is_err());
}

#[test]
fn charge_emits_sub_pay_event_with_amount_and_next_period_end() {
    let s = setup();
    s.client.start(&s.customer, &s.merchant, &s.token, &product(&s.env), &1_000, &86_400);
    s.env.ledger().set_timestamp(1_000_000 + 86_400);
    s.client.charge(&s.customer, &s.merchant, &product(&s.env), &1_500);

    let events = s.env.events().all();
    let published = events.last().unwrap();
    let topic0: Symbol = topic_at(&s.env, &published.1, 0);
    assert_eq!(topic0, Symbol::new(&s.env, "sub_pay"));

    let data: (i128, u64) = soroban_sdk::TryFromVal::try_from_val(&s.env, &published.2).unwrap();
    assert_eq!(data.0, 1_500);
    assert_eq!(data.1, 1_000_000 + 86_400 + 86_400);
}

#[test]
fn start_sets_max_amount_to_two_times_the_agreed_price() {
    let s = setup();
    s.client.start(&s.customer, &s.merchant, &s.token, &product(&s.env), &1_000, &86_400);

    let sub = s.client.get_subscription(&s.customer, &s.merchant, &product(&s.env));
    assert_eq!(sub.max_amount, 2_000);
}

#[test]
fn charge_fails_when_amount_exceeds_max_amount() {
    let s = setup();
    s.client.start(&s.customer, &s.merchant, &s.token, &product(&s.env), &1_000, &86_400);
    s.env.ledger().set_timestamp(1_000_000 + 86_400);

    // max_amount is 2x the agreed 1_000, so 2_001 must be rejected even
    // though the operator is fully authorized and the allowance can cover it.
    let result = s.client.try_charge(&s.customer, &s.merchant, &product(&s.env), &2_001);
    assert!(result.is_err(), "charge() must reject an amount above the subscription's ceiling");

    // Exactly at the ceiling still succeeds.
    s.client.charge(&s.customer, &s.merchant, &product(&s.env), &2_000);
    let sub = s.client.get_subscription(&s.customer, &s.merchant, &product(&s.env));
    assert_eq!(sub.amount, 2_000);
}

#[test]
fn update_can_raise_the_ceiling_for_a_legitimate_price_change() {
    let s = setup();
    s.client.start(&s.customer, &s.merchant, &s.token, &product(&s.env), &1_000, &86_400);
    s.env.ledger().set_timestamp(1_000_000 + 86_400);

    // Above the original 2_000 ceiling — rejected until the operator raises it.
    assert!(s.client.try_charge(&s.customer, &s.merchant, &product(&s.env), &4_000).is_err());

    s.client.update(
        &s.customer,
        &s.merchant,
        &product(&s.env),
        &String::from_str(&s.env, "active"),
        &86_400,
        &(1_000_000 + 86_400),
        &10_000,
    );

    s.client.charge(&s.customer, &s.merchant, &product(&s.env), &4_000);
    let sub = s.client.get_subscription(&s.customer, &s.merchant, &product(&s.env));
    assert_eq!(sub.amount, 4_000);
}

// ---------------------------------------------------------------------
// update() — same operator-only gate as charge()
// ---------------------------------------------------------------------

#[test]
fn update_succeeds_with_operator_auth() {
    let s = setup();
    s.client.start(&s.customer, &s.merchant, &s.token, &product(&s.env), &1_000, &86_400);

    s.client.update(
        &s.customer,
        &s.merchant,
        &product(&s.env),
        &String::from_str(&s.env, "paused"),
        &3_600,
        &2_000_000,
        &5_000,
    );

    let sub = s.client.get_subscription(&s.customer, &s.merchant, &product(&s.env));
    assert_eq!(sub.status, String::from_str(&s.env, "paused"));
    assert_eq!(sub.period_duration, 3_600);
    assert_eq!(sub.period_end, 2_000_000);
    assert_eq!(sub.max_amount, 5_000);
}

#[test]
fn update_fails_when_caller_is_not_the_operator() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000_000);

    let admin = Address::generate(&env);
    let customer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let attacker = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_contract.address();
    token::StellarAssetClient::new(&env, &token_address)
        .mock_all_auths()
        .mint(&customer, &1_000_000_000);

    let contract_id = env.register(SubscriptionEngine, (admin.clone(),));
    let client = SubscriptionEngineClient::new(&env, &contract_id);

    token::TokenClient::new(&env, &token_address).mock_all_auths().approve(
        &customer,
        &contract_id,
        &1_000_000_000,
        &(env.ledger().sequence() + 1_000_000),
    );
    client.mock_all_auths().start(&customer, &merchant, &token_address, &product(&env), &1_000, &86_400);

    // Reproduces "update() is a public backdoor": an attacker tries to
    // reactivate/rewrite a subscription's billing period by self-authorizing.
    env.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &attacker,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &contract_id,
            fn_name: "update",
            args: (&customer, &merchant, product(&env), String::from_str(&env, "active"), 1u64, 0u64, 1_000i128)
                .into_val(&env),
            sub_invokes: &[],
        },
    }]);

    let result = client.try_update(
        &customer,
        &merchant,
        &product(&env),
        &String::from_str(&env, "active"),
        &1,
        &0,
        &1_000,
    );
    assert!(result.is_err(), "update() must reject a caller who is not the stored operator");
}

#[test]
fn update_rejects_invalid_status_zero_duration_and_bad_max_amount() {
    let s = setup();
    s.client.start(&s.customer, &s.merchant, &s.token, &product(&s.env), &1_000, &86_400);

    assert!(s
        .client
        .try_update(
            &s.customer,
            &s.merchant,
            &product(&s.env),
            &String::from_str(&s.env, "bogus"),
            &3_600,
            &2_000_000,
            &5_000
        )
        .is_err());
    assert!(s
        .client
        .try_update(
            &s.customer,
            &s.merchant,
            &product(&s.env),
            &String::from_str(&s.env, "active"),
            &0,
            &2_000_000,
            &5_000
        )
        .is_err());
    assert!(s
        .client
        .try_update(
            &s.customer,
            &s.merchant,
            &product(&s.env),
            &String::from_str(&s.env, "active"),
            &3_600,
            &2_000_000,
            &0
        )
        .is_err());
}

// ---------------------------------------------------------------------
// pause / resume / cancel — customer or merchant only (unchanged, locked in)
// ---------------------------------------------------------------------

#[test]
fn pause_resume_cycle_by_customer_and_merchant() {
    let s = setup();
    s.client.start(&s.customer, &s.merchant, &s.token, &product(&s.env), &1_000, &86_400);

    s.client.pause(&s.customer, &s.merchant, &product(&s.env), &s.customer);
    let sub = s.client.get_subscription(&s.customer, &s.merchant, &product(&s.env));
    assert_eq!(sub.status, String::from_str(&s.env, "paused"));

    s.client.resume(&s.customer, &s.merchant, &product(&s.env), &s.merchant);
    let sub = s.client.get_subscription(&s.customer, &s.merchant, &product(&s.env));
    assert_eq!(sub.status, String::from_str(&s.env, "active"));
}

#[test]
fn resume_after_expiry_resets_period_from_now() {
    let s = setup();
    s.client.start(&s.customer, &s.merchant, &s.token, &product(&s.env), &1_000, &86_400);
    s.client.pause(&s.customer, &s.merchant, &product(&s.env), &s.customer);

    s.env.ledger().set_timestamp(1_000_000 + 200_000);
    s.client.resume(&s.customer, &s.merchant, &product(&s.env), &s.customer);

    let sub = s.client.get_subscription(&s.customer, &s.merchant, &product(&s.env));
    assert_eq!(sub.period_end, 1_000_000 + 200_000 + 86_400);
}

#[test]
fn pause_fails_for_unrelated_caller() {
    let env = Env::default();
    env.ledger().set_timestamp(1_000_000);
    let admin = Address::generate(&env);
    let customer = Address::generate(&env);
    let merchant = Address::generate(&env);
    let stranger = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_contract.address();
    token::StellarAssetClient::new(&env, &token_address).mock_all_auths().mint(&customer, &1_000_000_000);

    let contract_id = env.register(SubscriptionEngine, (admin.clone(),));
    let client = SubscriptionEngineClient::new(&env, &contract_id);
    token::TokenClient::new(&env, &token_address).mock_all_auths().approve(
        &customer,
        &contract_id,
        &1_000_000_000,
        &(env.ledger().sequence() + 1_000_000),
    );
    client.mock_all_auths().start(&customer, &merchant, &token_address, &product(&env), &1_000, &86_400);

    env.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &stranger,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &contract_id,
            fn_name: "pause",
            args: (&customer, &merchant, product(&env), &stranger).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    assert!(client.try_pause(&customer, &merchant, &product(&env), &stranger).is_err());
}

#[test]
fn cancel_emits_sub_can_event() {
    let s = setup();
    s.client.start(&s.customer, &s.merchant, &s.token, &product(&s.env), &1_000, &86_400);
    s.client.cancel(&s.customer, &s.merchant, &product(&s.env), &s.customer);

    let events = s.env.events().all();
    let published = events.last().unwrap();
    let topic0: Symbol = topic_at(&s.env, &published.1, 0);
    assert_eq!(topic0, Symbol::new(&s.env, "sub_can"));

    let sub = s.client.get_subscription(&s.customer, &s.merchant, &product(&s.env));
    assert_eq!(sub.status, String::from_str(&s.env, "canceled"));
}

// ---------------------------------------------------------------------
// storage key — merchant is now part of the key, no cross-merchant collision
// ---------------------------------------------------------------------

#[test]
fn same_customer_and_product_id_different_merchants_do_not_collide() {
    let s = setup();
    let other_merchant = Address::generate(&s.env);

    s.client.start(&s.customer, &s.merchant, &s.token, &product(&s.env), &1_000, &86_400);
    s.client.start(&s.customer, &other_merchant, &s.token, &product(&s.env), &2_000, &43_200);

    let sub_a = s.client.get_subscription(&s.customer, &s.merchant, &product(&s.env));
    let sub_b = s.client.get_subscription(&s.customer, &other_merchant, &product(&s.env));

    assert_eq!(sub_a.amount, 1_000);
    assert_eq!(sub_b.amount, 2_000);
    assert_eq!(sub_a.merchant, s.merchant);
    assert_eq!(sub_b.merchant, other_merchant);
}

// ---------------------------------------------------------------------
// admin rotation
// ---------------------------------------------------------------------

#[test]
fn set_admin_rotates_operator_and_old_operator_loses_access() {
    let s = setup();
    let new_admin = Address::generate(&s.env);

    s.client.set_admin(&new_admin);

    s.client.start(&s.customer, &s.merchant, &s.token, &product(&s.env), &1_000, &86_400);
    s.env.ledger().set_timestamp(1_000_000 + 86_400);

    // With mock_all_auths this call succeeds regardless of which address the
    // contract asks for auth from; what we assert is *which* address was
    // actually required.
    s.client.charge(&s.customer, &s.merchant, &product(&s.env), &1_000);
    let auths = s.env.auths();
    assert!(auths.iter().any(|(addr, _)| addr == &new_admin));
    assert!(!auths.iter().any(|(addr, _)| addr == &s.admin));
}

// ---------------------------------------------------------------------
// ttl — must scale with the billing period, not a fixed window, or an
// annual subscription would be archived long before its next charge.
// ---------------------------------------------------------------------

fn sub_ttl(s: &Setup, product_id: String) -> u32 {
    let key = crate::sub_key(s.customer.clone(), s.merchant.clone(), product_id);
    let contract_id = s.client.address.clone();
    s.env
        .as_contract(&contract_id, || s.env.storage().persistent().get_ttl(&key))
}

#[test]
fn ttl_scales_with_period_duration_instead_of_a_fixed_window() {
    let one_day: u64 = 86_400;
    let one_year: u64 = 365 * 86_400;

    let short = setup();
    short.client.start(&short.customer, &short.merchant, &short.token, &product(&short.env), &1_000, &one_day);
    let short_ttl = sub_ttl(&short, product(&short.env));

    let long = setup();
    long.client.start(&long.customer, &long.merchant, &long.token, &product(&long.env), &1_000, &one_year);
    let long_ttl = sub_ttl(&long, product(&long.env));

    // A one-day period only needs a small bump; a one-year period needs one
    // ~365 days (in ~5s ledgers) — the fixed 90-day bump this replaced would
    // have given both subscriptions the same TTL and left the annual one
    // archived roughly 9 months before its first renewal charge.
    assert!(short_ttl < 200_000, "short-period ttl should stay modest, got {short_ttl}");
    assert!(long_ttl > 6_000_000, "year-long period should get a ttl covering the full cycle, got {long_ttl}");
}
