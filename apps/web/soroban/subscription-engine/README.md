# subscription-engine

Soroban contract for recurring subscription billing. Pulls payments from a
customer's pre-approved token allowance on a schedule, without requiring the
customer to sign every billing cycle.

## Roles

- **customer** — signs `start` to open a subscription and authorize the first
  payment. Can `pause`/`resume`/`cancel` their own subscription.
- **merchant** — the payment recipient, set at `start` and immutable after
  (it's part of the storage key). Can also `pause`/`resume`/`cancel`.
- **operator** — the address stored via `__constructor`/`set_admin`. The only
  address that can call `charge` or `update`. In practice this is the
  backend/cron key, since customers don't sign every renewal.

## Storage

- Instance: `Admin` — the operator address.
- Persistent: `Sub(customer, merchant, product_id) -> Subscription`. Merchant
  is part of the key so two merchants reusing the same `product_id` for the
  same customer can never collide on the same record.

## TTL

Persistent entries are bumped on every write, sized from `period_duration`
(`ttl_for_period`) rather than a fixed window — a subscription only gets
touched once per billing cycle, so a fixed TTL would archive a long-period
subscription (e.g. annual) before its next charge. `MAX_TTL_LEDGERS` sits
just under the network's observed ~365-day entry TTL ceiling. A custom period
longer than that still can't be fully covered by any single bump; that edge
case needs an explicit footprint restore from the caller before charging,
which is outside what the contract can do for itself.

## Charge ceiling

`start` sets `max_amount` to `MAX_CHARGE_MULTIPLIER` (2x) the agreed price.
`charge` can never be asked for more than that, even with a fully valid
operator signature — bounds the blast radius of a compromised or buggy
operator key to a small multiple of the subscription's price instead of the
customer's entire remaining allowance. `update` can raise it later for a
legitimate price change.

## Known open questions (not yet decided in code)

- Single operator key controls `charge`/`update`/`set_admin` — no multisig,
  timelock, or independent pause switch.
- No contract upgrade path — a future fix needs a redeploy.
- `resume` resets `period_end` to a fresh cycle if the paused period already
  expired — a customer can defer billing indefinitely by pausing before each
  charge and resuming later.
