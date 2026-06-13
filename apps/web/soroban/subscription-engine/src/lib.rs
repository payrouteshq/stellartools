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

fn status_active(e: &Env) -> String {
    String::from_str(e, "active")
}

fn status_paused(e: &Env) -> String {
    String::from_str(e, "paused")
}

fn status_canceled(e: &Env) -> String {
    String::from_str(e, "canceled")
}

fn require_allowed_status(e: &Env, s: &String) {
    let ok = s == &status_active(e) || s == &status_paused(e) || s == &status_canceled(e);
    if !ok {
        panic!("Invalid status");
    }
}

#[contract]
pub struct SubscriptionEngine;

#[contractimpl]
impl SubscriptionEngine {
    /// Initial signature by Customer.
    /// Bundles Approval + Start + First Payment.
    pub fn start(e: Env, customer: Address, merchant: Address, token: Address, product_id: String, amount: i128, duration: u64, caller: Address) {
        caller.require_auth();

        // Transfer first payment immediately
        token::Client::new(&e, &token).transfer_from(&e.current_contract_address(), &customer, &merchant, &amount);

        let sub = Subscription {
            customer: customer.clone(),
            merchant,
            token,
            amount,
            period_duration: duration,
            period_end: e.ledger().timestamp() + duration,
            status: status_active(&e),
        };

        e.storage().persistent().set(&(customer.clone(), product_id.clone()), &sub);

        // Emit event for backend indexing
        e.events().publish((symbol_short!("sub_start"), customer, product_id), amount);
    }

    /// Backend/Cron calls this.
    /// If this returns without error, the payment WAS successful.
    pub fn charge(e: Env, customer: Address, product_id: String) {
        let key = (customer.clone(), product_id.clone());
        let mut sub: Subscription = e.storage().persistent().get(&key).expect("Sub not found");

        if sub.status != status_active(&e) {
            panic!("Inactive sub");
        }
        if e.ledger().timestamp() < sub.period_end { panic!("Period not ended"); }

        // Execute transfer. If user has no funds, this line PANICS.
        // If it panics, the lines below (updating period_end) NEVER run.
        token::Client::new(&e, &sub.token).transfer_from(&e.current_contract_address(), &sub.customer, &sub.merchant, &sub.amount);

        // Success! Update state
        sub.period_end += sub.period_duration;
        e.storage().persistent().set(&key, &sub);

        // This is what your Webhook system listens for
        e.events().publish((symbol_short!("sub_pay"), customer, product_id), (sub.amount, sub.period_end));
    }

    pub fn resume(e: Env, customer: Address, product_id: String, caller: Address) {
        caller.require_auth();

        let key = (customer.clone(), product_id.clone());
        let mut sub: Subscription = e.storage().persistent().get(&key).unwrap();

        if e.ledger().timestamp() > sub.period_end { panic!("Period ended"); }

        sub.status = status_active(&e);
        e.storage().persistent().set(&key, &sub);
        e.events().publish((symbol_short!("sub_res"), customer, product_id), ());
    }

    pub fn pause(e: Env, customer: Address, product_id: String, caller: Address) {
        caller.require_auth();

        let key = (customer.clone(), product_id.clone());
        let mut sub: Subscription = e.storage().persistent().get(&key).unwrap();

        sub.status = status_paused(&e);
        e.storage().persistent().set(&key, &sub);
        e.events().publish((symbol_short!("sub_pau"), customer, product_id), ());
    }

    pub fn cancel(e: Env, customer: Address, product_id: String, caller: Address) {
        caller.require_auth();

        let key = (customer.clone(), product_id.clone());
        let mut sub: Subscription = e.storage().persistent().get(&key).unwrap();

        sub.status = status_canceled(&e);
        e.storage().persistent().set(&key, &sub);
        e.events().publish((symbol_short!("sub_can"), customer, product_id), ());
    }

    pub fn update(e: Env, customer: Address, product_id: String, status: String, period_duration: u64, period_end: u64, caller: Address) {
        caller.require_auth();

        require_allowed_status(&e, &status);

        let key = (customer.clone(), product_id.clone());
        let mut sub: Subscription = e.storage().persistent().get(&key).unwrap();

        sub.status = status;
        sub.period_duration = period_duration;
        sub.period_end = period_end;
        e.storage().persistent().set(&key, &sub);
        e.events().publish((symbol_short!("sub_upd"), customer, product_id), (sub.status.clone(), period_duration, period_end));
    }

    pub fn get_subscription(e: Env, customer: Address, product_id: String) -> Subscription {
        e.storage().persistent().get(&(customer, product_id)).expect("Sub not found")
    }
}
