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
    pub max_amount: i128,
    pub period_duration: u64,
    pub period_end: u64,
    pub status: String,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Sub(Address, Address, String),
}

fn sub_key(customer: Address, merchant: Address, product_id: String) -> DataKey {
    DataKey::Sub(customer, merchant, product_id)
}

const BUMP_THRESHOLD: u32 = 17_280;
const BUMP_AMOUNT: u32 = 1_555_200;
const LEDGER_SECONDS: u64 = 5;
const SUB_TTL_BUFFER_LEDGERS: u64 = 17_280;
const MAX_TTL_LEDGERS: u64 = 6_311_900;
const MAX_CHARGE_MULTIPLIER: i128 = 2;

fn ttl_for_period(period_duration: u64) -> u32 {
    let ledgers = period_duration / LEDGER_SECONDS;
    let with_buffer = ledgers.saturating_add(SUB_TTL_BUFFER_LEDGERS);
    with_buffer.min(MAX_TTL_LEDGERS) as u32
}

fn bump_sub_ttl(e: &Env, key: &DataKey, period_duration: u64) {
    let extend_to = ttl_for_period(period_duration);
    e.storage().persistent().extend_ttl(key, BUMP_THRESHOLD, extend_to);
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

fn require_customer_or_merchant(sub: &Subscription, caller: &Address) {
    caller.require_auth();
    if caller != &sub.customer && caller != &sub.merchant {
        panic!("unauthorized caller");
    }
}

fn require_allowed_status(e: &Env, s: &String) {
    let ok = s == &status_active(e) || s == &status_paused(e) || s == &status_canceled(e);
    if !ok {
        panic!("invalid status");
    }
}

fn require_admin(e: &Env) {
    let admin: Address = e.storage().instance().get(&DataKey::Admin).expect("not initialized");
    admin.require_auth();
}

#[contract]
pub struct SubscriptionEngine;

#[contractimpl]
impl SubscriptionEngine {
    pub fn __constructor(e: Env, admin: Address) {
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
    }

    pub fn set_admin(e: Env, new_admin: Address) {
        require_admin(&e);
        e.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    pub fn start(
        e: Env,
        customer: Address,
        merchant: Address,
        token: Address,
        product_id: String,
        amount: i128,
        duration: u64,
    ) {
        customer.require_auth();

        if customer == merchant {
            panic!("customer and merchant must differ");
        }
        if amount <= 0 {
            panic!("amount must be positive");
        }
        if duration == 0 {
            panic!("duration must be positive");
        }

        let key = sub_key(customer.clone(), merchant.clone(), product_id.clone());
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

        let max_amount = amount.checked_mul(MAX_CHARGE_MULTIPLIER).expect("max_amount overflow");

        let sub = Subscription {
            customer: customer.clone(),
            merchant,
            token,
            amount,
            max_amount,
            period_duration: duration,
            period_end: e.ledger().timestamp() + duration,
            status: status_active(&e),
        };

        e.storage().persistent().set(&key, &sub);
        bump_sub_ttl(&e, &key, duration);
        e.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
        e.events().publish((symbol_short!("sub_start"), customer, product_id), amount);
    }

    pub fn charge(e: Env, customer: Address, merchant: Address, product_id: String, amount: i128) {
        require_admin(&e);

        if amount <= 0 {
            panic!("amount must be positive");
        }

        let key = sub_key(customer.clone(), merchant.clone(), product_id.clone());
        let mut sub: Subscription = e.storage().persistent().get(&key).expect("subscription not found");

        require_active(&e, &sub);

        if e.ledger().timestamp() < sub.period_end {
            panic!("billing period has not ended");
        }
        if amount > sub.max_amount {
            panic!("amount exceeds subscription ceiling");
        }

        token::Client::new(&e, &sub.token).transfer_from(
            &e.current_contract_address(),
            &sub.customer,
            &sub.merchant,
            &amount,
        );

        sub.amount = amount;
        sub.period_end += sub.period_duration;
        e.storage().persistent().set(&key, &sub);
        bump_sub_ttl(&e, &key, sub.period_duration);
        e.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_AMOUNT);
        e.events().publish(
            (symbol_short!("sub_pay"), customer, product_id),
            (amount, sub.period_end),
        );
    }

    pub fn pause(e: Env, customer: Address, merchant: Address, product_id: String, caller: Address) {
        let key = sub_key(customer.clone(), merchant.clone(), product_id.clone());
        let mut sub: Subscription = e.storage().persistent().get(&key).expect("subscription not found");

        require_customer_or_merchant(&sub, &caller);
        require_active(&e, &sub);

        sub.status = status_paused(&e);
        e.storage().persistent().set(&key, &sub);
        bump_sub_ttl(&e, &key, sub.period_duration);
        e.events().publish((symbol_short!("sub_pau"), customer, product_id), ());
    }

    pub fn resume(e: Env, customer: Address, merchant: Address, product_id: String, caller: Address) {
        let key = sub_key(customer.clone(), merchant.clone(), product_id.clone());
        let mut sub: Subscription = e.storage().persistent().get(&key).expect("subscription not found");

        require_customer_or_merchant(&sub, &caller);
        require_paused(&e, &sub);

        let now = e.ledger().timestamp();
        if now >= sub.period_end {
            sub.period_end = now + sub.period_duration;
        }

        sub.status = status_active(&e);
        e.storage().persistent().set(&key, &sub);
        bump_sub_ttl(&e, &key, sub.period_duration);
        e.events().publish((symbol_short!("sub_res"), customer, product_id), sub.period_end);
    }

    pub fn cancel(e: Env, customer: Address, merchant: Address, product_id: String, caller: Address) {
        let key = sub_key(customer.clone(), merchant.clone(), product_id.clone());
        let mut sub: Subscription = e.storage().persistent().get(&key).expect("subscription not found");

        require_customer_or_merchant(&sub, &caller);
        require_not_canceled(&e, &sub);

        sub.status = status_canceled(&e);
        e.storage().persistent().set(&key, &sub);
        bump_sub_ttl(&e, &key, sub.period_duration);
        e.events().publish((symbol_short!("sub_can"), customer, product_id), ());
    }

    pub fn update(
        e: Env,
        customer: Address,
        merchant: Address,
        product_id: String,
        status: String,
        period_duration: u64,
        period_end: u64,
        max_amount: i128,
    ) {
        require_admin(&e);

        require_allowed_status(&e, &status);

        if period_duration == 0 {
            panic!("period_duration must be positive");
        }
        if max_amount <= 0 {
            panic!("max_amount must be positive");
        }

        let key = sub_key(customer.clone(), merchant.clone(), product_id.clone());
        let mut sub: Subscription = e.storage().persistent().get(&key).expect("subscription not found");

        sub.status = status.clone();
        sub.period_duration = period_duration;
        sub.period_end = period_end;
        sub.max_amount = max_amount;
        e.storage().persistent().set(&key, &sub);
        bump_sub_ttl(&e, &key, period_duration);
        e.events().publish(
            (symbol_short!("sub_upd"), customer, product_id),
            (status, period_duration, period_end),
        );
    }

    pub fn get_subscription(e: Env, customer: Address, merchant: Address, product_id: String) -> Subscription {
        e.storage().persistent().get(&sub_key(customer, merchant, product_id)).expect("subscription not found")
    }
}

#[cfg(test)]
mod test;
