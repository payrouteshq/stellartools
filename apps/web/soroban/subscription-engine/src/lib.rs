#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, String, symbol_short
};

#[contracttype]
#[derive(Clone, Debug)]
pub struct Subscription {
    pub customer: Address,
    pub merchant: Address,
    pub token: Address,
    pub amount: i128,
    pub period_duration: u64,
    pub period_end: u64,
    pub status: String,
}

fn status_active(e: &Env) -> String { String::from_str(e, "active") }
fn status_paused(e: &Env) -> String { String::from_str(e, "paused") }
fn status_canceled(e: &Env) -> String { String::from_str(e, "canceled") }

fn require_active(e: &Env, sub: &Subscription) {
    if sub.status != status_active(e) {
        panic!("subscription is not active");
    }
}

fn require_paused(e: &Env, sub: &Subscription) {
    if sub.status != status_paused(e) {
        panic!("subscription is not paused");
    }
}

fn require_not_canceled(e: &Env, sub: &Subscription) {
    if sub.status == status_canceled(e) {
        panic!("subscription is already canceled");
    }
}

fn require_allowed_status(e: &Env, s: &String) {
    let ok = s == &status_active(e) || s == &status_paused(e) || s == &status_canceled(e);
    if !ok {
        panic!("invalid status");
    }
}

#[contract]
pub struct SubscriptionEngine;

#[contractimpl]
impl SubscriptionEngine {
    /// Initial call by customer. Bundles approval + first payment + subscription creation.
    /// `duration` is in seconds (e.g. 86400 = 1 day, 3600 = 1 hour for custom periods).
    pub fn start(
        e: Env,
        customer: Address,
        merchant: Address,
        token: Address,
        product_id: String,
        amount: i128,
        duration: u64,
        caller: Address,
    ) {
        caller.require_auth();

        if amount <= 0 {
            panic!("amount must be positive");
        }
        if duration == 0 {
            panic!("duration must be positive");
        }

        // Prevent duplicate active subscription for same (customer, product)
        let key = (customer.clone(), product_id.clone());
        if e.storage().persistent().has(&key) {
            let existing: Subscription = e.storage().persistent().get(&key).unwrap();
            if existing.status == status_active(&e) || existing.status == status_paused(&e) {
                panic!("subscription already exists");
            }
        }

        token::Client::new(&e, &token).transfer_from(
            &e.current_contract_address(),
            &customer,
            &merchant,
            &amount,
        );

        let sub = Subscription {
            customer: customer.clone(),
            merchant,
            token,
            amount,
            period_duration: duration,
            period_end: e.ledger().timestamp() + duration,
            status: status_active(&e),
        };

        e.storage().persistent().set(&key, &sub);
        e.events().publish((symbol_short!("sub_start"), customer, product_id), amount);
    }

    /// Called by backend/cron when the billing period ends.
    /// Panics on insufficient funds — period_end is NOT advanced on failure.
    pub fn charge(e: Env, customer: Address, product_id: String) {
        let key = (customer.clone(), product_id.clone());
        let mut sub: Subscription = e.storage().persistent().get(&key).expect("subscription not found");

        require_active(&e, &sub);

        if e.ledger().timestamp() < sub.period_end {
            panic!("billing period has not ended");
        }

        // Transfer first — if it panics, state below never runs (atomic)
        token::Client::new(&e, &sub.token).transfer_from(
            &e.current_contract_address(),
            &sub.customer,
            &sub.merchant,
            &sub.amount,
        );

        sub.period_end += sub.period_duration;
        e.storage().persistent().set(&key, &sub);
        e.events().publish(
            (symbol_short!("sub_pay"), customer, product_id),
            (sub.amount, sub.period_end),
        );
    }

    pub fn pause(e: Env, customer: Address, product_id: String, caller: Address) {
        caller.require_auth();

        let key = (customer.clone(), product_id.clone());
        let mut sub: Subscription = e.storage().persistent().get(&key).expect("subscription not found");

        require_active(&e, &sub);

        sub.status = status_paused(&e);
        e.storage().persistent().set(&key, &sub);
        e.events().publish((symbol_short!("sub_pau"), customer, product_id), ());
    }

    /// Resume a paused subscription.
    /// If the paused period already expired, resets period_end from now so the
    /// customer gets a full cycle without immediately triggering charge.
    pub fn resume(e: Env, customer: Address, product_id: String, caller: Address) {
        caller.require_auth();

        let key = (customer.clone(), product_id.clone());
        let mut sub: Subscription = e.storage().persistent().get(&key).expect("subscription not found");

        require_paused(&e, &sub);

        let now = e.ledger().timestamp();
        // If the period expired while paused, reset it from now
        if now >= sub.period_end {
            sub.period_end = now + sub.period_duration;
        }

        sub.status = status_active(&e);
        e.storage().persistent().set(&key, &sub);
        e.events().publish((symbol_short!("sub_res"), customer, product_id), sub.period_end);
    }

    pub fn cancel(e: Env, customer: Address, product_id: String, caller: Address) {
        caller.require_auth();

        let key = (customer.clone(), product_id.clone());
        let mut sub: Subscription = e.storage().persistent().get(&key).expect("subscription not found");

        require_not_canceled(&e, &sub);

        sub.status = status_canceled(&e);
        e.storage().persistent().set(&key, &sub);
        e.events().publish((symbol_short!("sub_can"), customer, product_id), ());
    }

    /// Admin / backend override. Validates status and guards against zero duration.
    pub fn update(
        e: Env,
        customer: Address,
        product_id: String,
        status: String,
        period_duration: u64,
        period_end: u64,
        caller: Address,
    ) {
        caller.require_auth();

        require_allowed_status(&e, &status);

        if period_duration == 0 {
            panic!("period_duration must be positive");
        }

        let key = (customer.clone(), product_id.clone());
        let mut sub: Subscription = e.storage().persistent().get(&key).expect("subscription not found");

        sub.status = status.clone();
        sub.period_duration = period_duration;
        sub.period_end = period_end;
        e.storage().persistent().set(&key, &sub);
        e.events().publish(
            (symbol_short!("sub_upd"), customer, product_id),
            (status, period_duration, period_end),
        );
    }

    pub fn get_subscription(e: Env, customer: Address, product_id: String) -> Subscription {
        e.storage().persistent().get(&(customer, product_id)).expect("subscription not found")
    }
}
