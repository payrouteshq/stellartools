# @stellartools/subscription-contract

Typed TypeScript client for the `subscription-engine` Soroban contract
(`apps/web/soroban/subscription-engine`). Generated directly from the compiled
contract wasm via the Stellar CLI, so the method signatures, argument types,
and the `Subscription` struct shape always match the deployed contract.

`src/index.ts` is generated — **do not hand-edit it**. Regenerate it after any
change to the contract's public interface:

```bash
cd apps/web/soroban
stellar contract build
cd ../../..
stellar contract bindings typescript \
  --wasm apps/web/soroban/target/wasm32v1-none/release/subscription_engine.wasm \
  --output-dir packages/subscription-contract \
  --overwrite
```

Regenerating overwrites `src/index.ts`, `package.json`, `tsconfig.json`,
`.gitignore`, this README, and **deletes `tsup.config.ts`** — re-apply the
monorepo-specific tweaks (package name/version, `tsup` build, `.gitignore`,
the `u64`/`i128`-only type import trim below) from git history after running
it, or diff before committing.

`src/index.ts`'s type import needs one manual trim after every regeneration:
the generator always emits `u32/i32/u64/i64/u128/i128/u256/i256/Option/
Timepoint/Duration/Result/Address` regardless of what the contract actually
uses, but some of those aren't exported by the `@stellar/stellar-sdk` version
pinned in this monorepo (14.1.1), which fails the `dts` build. Trim the import
down to only the types this contract's spec actually uses (currently just
`u64`/`i128` — grep the regenerated file for each type name to confirm before
trimming).

## Usage

```ts
import { Client } from "@stellartools/subscription-contract";

const client = new Client({
  contractId: SUBSCRIPTION_CONTRACT_ID,
  networkPassphrase: Networks.TESTNET,
  rpcUrl: RPC_URL,
});

// Read-only call — no signing required.
const tx = await client.get_subscription({
  customer: customerAddress,
  merchant: merchantAddress,
  product_id: productId,
});
const subscription = tx.result;
```

For a state-changing call, provide `publicKey` and `signTransaction` in the
`Client` options (a wallet's `signTransaction`, or a server-side signer backed
by a `Keypair`), then call `.signAndSend()` on the returned
`AssembledTransaction`. See `@stellar/stellar-sdk/contract`'s
`AssembledTransaction` docs for the full lifecycle (simulate → sign → send →
poll).

## Build

```bash
pnpm --filter @stellartools/subscription-contract build
```
