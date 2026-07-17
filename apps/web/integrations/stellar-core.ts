import { AssetCode, AssetIssuer, Network } from "@/constant/schema.client";
import { AppError } from "@/lib/action-handler";
import * as StellarSDK from "@stellar/stellar-sdk";
import { Result } from "@stellartools/core";

const pick = (network: Network, testnet: string | undefined, mainnet: string | undefined, name: string) => {
  const v = network === "testnet" ? testnet : mainnet;
  if (!v) throw new AppError(`${name}_${network === "testnet" ? "TESTNET" : "MAINNET"} is not configured`);
  return v;
};

export const getKeeperSecret = (network: Network) =>
  pick(network, process.env.KEEPER_SECRET_TESTNET, process.env.KEEPER_SECRET_MAINNET, "KEEPER_SECRET");

export const getChargesPublicKey = (network: Network) =>
  pick(network, process.env.CHARGES_PUBLIC_KEY_TESTNET, process.env.CHARGES_PUBLIC_KEY_MAINNET, "CHARGES_PUBLIC_KEY");

export const getChargesSecretKey = (network: Network) =>
  pick(network, process.env.CHARGES_SECRET_KEY_TESTNET, process.env.CHARGES_SECRET_KEY_MAINNET, "CHARGES_SECRET_KEY");

export const getSubscriptionContractId = (network: Network) =>
  pick(
    network,
    process.env.SUBSCRIPTION_CONTRACT_TESTNET_ID,
    process.env.SUBSCRIPTION_CONTRACT_MAINNET_ID,
    "SUBSCRIPTION_CONTRACT"
  );

/** Minimum starting balance for a new account (2 × base reserve, no subentries). */
async function getMinCreateAccountBalance(server: StellarSDK.Horizon.Server): Promise<string> {
  const { records } = await server.ledgers().order("desc").limit(1).call();
  const ledger = records[0];
  if (!ledger) return "1";
  const baseReserveXlm = Number(ledger.base_reserve_in_stroops) / 10_000_000;
  return (baseReserveXlm * 2).toFixed(7);
}

export const getStellarConfig = (network: Network) => {
  const isTestnet = network === "testnet";

  const horizonUrl = isTestnet
    ? process.env.NEXT_PUBLIC_STELLAR_HORIZON_TESTNET!
    : process.env.NEXT_PUBLIC_STELLAR_HORIZON_MAINNET!;

  return {
    passphrase: isTestnet ? StellarSDK.Networks.TESTNET : StellarSDK.Networks.PUBLIC,
    server: new StellarSDK.Horizon.Server(horizonUrl),
  };
};

export const getAsset = (code: string, issuer?: string) => {
  return code.toUpperCase() === "XLM" ? StellarSDK.Asset.native() : new StellarSDK.Asset(code, issuer!);
};

export const createAccount = async (network: Network) => {
  return Result.tryPromise(async () => {
    const { passphrase, server } = getStellarConfig(network);

    if (network === "testnet") {
      const keypair = StellarSDK.Keypair.random();
      await server.friendbot(keypair.publicKey()).call();
      const account = await server.loadAccount(keypair.publicKey());
      return { ...account, keypair };
    }

    const newKeypair = StellarSDK.Keypair.random();
    const sourceKeypair = StellarSDK.Keypair.fromSecret(getKeeperSecret(network));
    const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());
    const startingBalance = await getMinCreateAccountBalance(server);

    const tx = new StellarSDK.TransactionBuilder(sourceAccount, {
      fee: StellarSDK.BASE_FEE,
      networkPassphrase: passphrase,
    })
      .addOperation(
        StellarSDK.Operation.createAccount({
          destination: newKeypair.publicKey(),
          startingBalance,
        })
      )
      .setTimeout(30)
      .build();

    tx.sign(sourceKeypair);
    await server.submitTransaction(tx);
    const account = await server.loadAccount(newKeypair.publicKey());
    return { ...account, keypair: newKeypair };
  });
};

export const retrieveAccount = (publicKey: string, network: Network) => {
  const { server } = getStellarConfig(network);
  return Result.tryPromise(() => server.loadAccount(publicKey));
};

/**
 * Ensures the account controlled by `accountSecret` has a trustline for
 * `assetCode/assetIssuer`. No-ops if the trustline already exists.
 * Used to set up the merchant's org wallet before a customer's path payment lands there.
 */
export const ensureTrustline = async (
  accountSecret: string,
  assetCode: string,
  assetIssuer: string,
  network: Network
): Promise<void> => {
  const { server, passphrase } = getStellarConfig(network);
  const keypair = StellarSDK.Keypair.fromSecret(accountSecret);
  const account = await server.loadAccount(keypair.publicKey());

  const hasTrustline = account.balances.some(
    (b): b is StellarSDK.Horizon.HorizonApi.BalanceLineAsset =>
      "asset_code" in b && b.asset_code === assetCode && b.asset_issuer === assetIssuer
  );

  if (hasTrustline) return;

  const tx = new StellarSDK.TransactionBuilder(account, {
    fee: StellarSDK.BASE_FEE,
    networkPassphrase: passphrase,
  })
    .addOperation(StellarSDK.Operation.changeTrust({ asset: new StellarSDK.Asset(assetCode, assetIssuer) }))
    .setTimeout(30)
    .build();

  tx.sign(keypair);
  await server.submitTransaction(tx);
};

export const sendAssetPayment = async (
  sourceSecret: string,
  destination: string,
  assetCode: string,
  assetIssuer: string,
  amount: string,
  network: Network,
  memo?: string
) => {
  return Result.tryPromise(async () => {
    const { server, passphrase } = getStellarConfig(network);
    const keypair = StellarSDK.Keypair.fromSecret(sourceSecret);
    const account = await server.loadAccount(keypair.publicKey());

    const txBuilder = new StellarSDK.TransactionBuilder(account, {
      fee: StellarSDK.BASE_FEE,
      networkPassphrase: passphrase,
    }).addOperation(
      StellarSDK.Operation.payment({
        destination,
        asset: getAsset(assetCode, assetIssuer),
        amount,
      })
    );

    if (memo) txBuilder.addMemo(StellarSDK.Memo.text(memo));

    const tx = txBuilder.setTimeout(30).build();
    tx.sign(keypair);
    return await server.submitTransaction(tx);
  });
};

export const verifyPaymentByPagingToken = async (
  merchantAddress: string,
  memo: string,
  sinceToken: string,
  network: Network
) => {
  return Result.tryPromise(async () => {
    const { server } = getStellarConfig(network);
    const response = await server.transactions().forAccount(merchantAddress).cursor(sinceToken).order("asc").call();

    const match = response.records.find((tx) => tx.memo === memo);
    if (!match) return null;

    const ops = await server.payments().forTransaction(match.hash).call();
    const paymentOp = ops.records.find(
      (op): op is StellarSDK.Horizon.ServerApi.PaymentOperationRecord => op.type === "payment"
    );

    return paymentOp
      ? {
          hash: match.hash,
          amount: paymentOp.amount,
          successful: match.successful,
          from: paymentOp.from,
          assetCode: paymentOp.asset_type === "native" ? "XLM" : paymentOp.asset_code,
          assetIssuer: paymentOp.asset_type === "native" ? null : paymentOp.asset_issuer,
        }
      : null;
  });
};

export const getCustomerAssetIssuers = async (
  publicKey: string,
  assetCode: string,
  network: Network
): Promise<string[]> => {
  if (assetCode.toUpperCase() === "XLM") return [];
  const account = await retrieveAccount(publicKey, network);

  if (account.isErr()) return [];

  return account.value.balances
    .filter((b): b is StellarSDK.Horizon.HorizonApi.BalanceLineAsset => "asset_code" in b && b.asset_code === assetCode)
    .map((b) => b.asset_issuer);
};

/**
 * Builds a pre-swap transaction XDR that swaps the customer's assets into the exact
 * canonical issuer token required by a Soroban subscription contract.
 * The swap destination is the customer themselves — after signing, they hold the exact token.
 */
export const buildPreSwapXdr = async (params: {
  customerPublicKey: string;
  sendAssetCode: string;
  sendAssetIssuer: string | null;
  destAssetCode: string;
  canonicalIssuer: string;
  neededStellarAmount: string;
  sendMax: string;
  network: Network;
  timeoutSeconds: number;
}): Promise<string> => {
  const {
    customerPublicKey,
    sendAssetCode,
    sendAssetIssuer,
    destAssetCode,
    canonicalIssuer,
    neededStellarAmount,
    sendMax,
    network,
    timeoutSeconds,
  } = params;
  const { server, passphrase } = getStellarConfig(network);
  const account = await server.loadAccount(customerPublicKey);

  const sendAsset =
    sendAssetCode.toUpperCase() === "XLM"
      ? StellarSDK.Asset.native()
      : new StellarSDK.Asset(sendAssetCode, sendAssetIssuer!);

  const destAsset = new StellarSDK.Asset(destAssetCode, canonicalIssuer);

  const tx = new StellarSDK.TransactionBuilder(account, {
    fee: StellarSDK.BASE_FEE,
    networkPassphrase: passphrase,
  })
    .addOperation(
      StellarSDK.Operation.pathPaymentStrictReceive({
        sendAsset,
        sendMax,
        destination: customerPublicKey,
        destAsset,
        destAmount: neededStellarAmount,
        path: [],
      })
    )
    .setTimeout(timeoutSeconds)
    .build();

  return tx.toXDR();
};

export const getLatestPagingToken = async (publicKey: string, network: Network): Promise<string | null> => {
  const { server } = getStellarConfig(network);
  return await server
    .transactions()
    .forAccount(publicKey)
    .order("desc")
    .limit(1)
    .call()
    .then((txs) => txs.records[0]?.paging_token ?? null)
    .catch(() => null);
};

export const retrieveAssetContractId = async (assetCode: AssetCode, assetIssuer: AssetIssuer, network: Network) => {
  const { passphrase } = getStellarConfig(network);
  return getAsset(assetCode, assetIssuer).contractId(passphrase);
};

export const isValidPublicKey = (publicKey?: string): Result<boolean, Error> => {
  if (!publicKey?.trim()) return Result.err(new AppError("Public key is required"));
  if (!StellarSDK.StrKey.isValidEd25519PublicKey(publicKey)) return Result.err(new AppError("Invalid public key"));
  return Result.ok(true);
};

export const retrieveTransaction = async (transactionHash: string, network: Network) => {
  const { server } = getStellarConfig(network);

  return Result.tryPromise(async () => {
    const tx = await server.transactions().transaction(transactionHash).call();
    return tx;
  });
};

// -- RESPONSE PARSING --

export interface ParsedTxError {
  code: string;
  message: string;
}

export const SUBSCRIPTION_ALREADY_ACTIVE_MESSAGE = "You already have an active subscription for this product.";

const ERROR_MESSAGES: Record<string, string> = {
  // Transaction-level codes
  txBadSeq: "Invalid sequence number — refresh and try again",
  txBadAuth: "Failed - Please make sure you are in the correct network and try again",
  txInsufficientBalance: "Insufficient XLM balance to cover fees",
  txInsufficientFee: "Fee too low",
  txTooLate: "Transaction expired — it was submitted too late",
  txTooEarly: "Transaction submitted too early",
  txMalformed: "Transaction is malformed",
  txNoAccount: "Source account not found on the network",
  txNoSourceAccount: "Source account not found on the network",
  txSorobanInvalid: "Invalid Soroban transaction",
  txMissingOperation: "Transaction has no operations",
  // Soroban host function codes
  invokeHostFunctionTrapped: "Smart contract execution failed",
  invokeHostFunctionInsufficientRefundableFee: "Insufficient refundable fee for contract execution",
  invokeHostFunctionEntryArchived: "Required contract state entry is archived",
  invokeHostFunctionResourceLimitExceeded: "Contract resource limit exceeded",
  invokeHostFunctionMalformed: "Contract invocation is malformed",
  // Path payment (strict receive) — these occur during XLM→asset checkout swaps
  pathPaymentStrictReceiveNoTrust: "Destination account has no trustline for the destination asset",
  pathPaymentStrictReceiveSrcNoTrust: "Source account has no trustline for the source asset",
  pathPaymentStrictReceiveNotAuthorized: "Destination account is not authorized to hold the asset",
  pathPaymentStrictReceiveSrcNotAuthorized: "Source account is not authorized to hold the asset",
  pathPaymentStrictReceiveLineFull: "Destination trustline is at its limit",
  pathPaymentStrictReceiveUnderfunded: "Insufficient source asset balance",
  pathPaymentStrictReceiveTooFewOffers: "No viable conversion path found — try a different asset",
  pathPaymentStrictReceiveOfferCrossSelf: "Path payment would cross your own offer",
  pathPaymentStrictReceiveNoIssuer: "Asset issuer not found on the network",
  pathPaymentStrictReceiveMalformed: "Path payment operation is malformed",
  // Path payment (strict send)
  pathPaymentStrictSendNoTrust: "Destination account has no trustline for the destination asset",
  pathPaymentStrictSendLineFull: "Destination trustline is at its limit",
  pathPaymentStrictSendUnderfunded: "Insufficient source asset balance",
  pathPaymentStrictSendTooFewOffers: "No viable conversion path found — try a different asset",
  // Regular payment errors
  paymentNoTrust: "Destination account has no trustline for this asset",
  paymentLineFull: "Destination trustline is at its limit",
  paymentUnderfunded: "Insufficient balance",
  paymentSrcNoTrust: "Source account has no trustline for this asset",
  paymentNoIssuer: "Asset issuer not found",
  paymentNotAuthorized: "Destination account is not authorized for this asset",
};

/** Subscription contract panic strings and Soroban simulation fn+trap pairs. */
const SOROBAN_CONTRACT_MESSAGES: Record<string, string> = {
  "subscription already exists": SUBSCRIPTION_ALREADY_ACTIVE_MESSAGE,
  "subscription not found": "No subscription found for this product.",
  "subscription is not active": "This subscription is not active.",
  "subscription is not paused": "This subscription is not paused.",
  "subscription is already canceled": "This subscription is already canceled.",
  "amount must be positive": "Subscription amount must be greater than zero.",
  "duration must be positive": "Subscription billing period is invalid.",
  "billing period has not ended": "The current billing period has not ended yet.",
  "unauthorized caller": "This wallet is not allowed to perform that action.",
  "invalid status": "Invalid subscription status.",
};

const SOROBAN_SIMULATION_MESSAGES: Record<string, string> = {
  "start:UnreachableCodeReached":
    "The first subscription payment could not be completed. Check your wallet balance and try again.",
  "charge:UnreachableCodeReached":
    "The subscription renewal payment could not be completed. Check your wallet balance and allowance.",
  "approve:UnreachableCodeReached": "Token approval failed. Check your wallet balance and try again.",
};

function extractSimulationFn(raw: string): string | undefined {
  const match = raw.match(/fn_call,[^,\]]+,\s*(\w+)\]/);
  return match?.[1];
}

export function parseSorobanSimulationError(
  simulation: StellarSDK.rpc.Api.SimulateTransactionErrorResponse
): ParsedTxError {
  const raw = simulation.error ?? "";

  for (const [needle, message] of Object.entries(SOROBAN_CONTRACT_MESSAGES)) {
    if (raw.includes(needle)) {
      return { code: needle.replace(/\s+/g, "_"), message };
    }
  }

  const fn = extractSimulationFn(raw);
  const trap = raw.match(/VM call trapped:\s*([^",\]]+)/)?.[1]?.trim();

  if (fn && trap) {
    const key = `${fn}:${trap}`;
    if (SOROBAN_SIMULATION_MESSAGES[key]) {
      return { code: key, message: SOROBAN_SIMULATION_MESSAGES[key] };
    }
  }

  if (raw.includes("HostError") || raw.includes("Simulation failed")) {
    return {
      code: "sorobanSimulationFailed",
      message: "Something went wrong with the on-chain subscription call. Please try again.",
    };
  }

  return { code: "simulationError", message: "Simulation failed. Please try again." };
}

function humanize(code: string): string {
  return ERROR_MESSAGES[code] ?? code.replace(/([A-Z])/g, " $1").trim();
}

export function parseError(
  errorResponse:
    | StellarSDK.rpc.Api.GetFailedTransactionResponse
    | StellarSDK.rpc.Api.SendTransactionResponse
    | StellarSDK.rpc.Api.SimulateTransactionErrorResponse
): ParsedTxError {
  try {
    // sendTransaction (errorResult) or getTransaction (resultXdr) — same shape
    const xdrResult =
      "errorResult" in errorResponse && errorResponse.errorResult
        ? errorResponse.errorResult.result()
        : "resultXdr" in errorResponse && errorResponse.resultXdr
          ? errorResponse.resultXdr.result()
          : null;

    if (xdrResult) {
      const topCode = xdrResult.switch().name as string;

      if (topCode === "txFailed") {
        try {
          const results = xdrResult.results();
          if (results.length > 0) {
            const opResult = results[0];
            const opSwitchName = opResult.switch().name as string;

            if (opSwitchName === "opInner") {
              const tr = opResult.tr();
              const trTypeName = tr.switch().name as string; // e.g. "invokeHostFunction", "pathPaymentStrictReceive"

              if (trTypeName === "invokeHostFunction") {
                const hostCode = tr.invokeHostFunctionResult().switch().name as string;
                console.log("[parseError] soroban code:", hostCode);
                return { code: hostCode, message: humanize(hostCode) };
              }

              // For all other op types (payments, path payments, etc.) — Stellar XDR
              // always names the result accessor "{opType}Result", e.g.
              // "pathPaymentStrictReceive" → tr.pathPaymentStrictReceiveResult()
              const armName = `${trTypeName}Result`;
              const opSpecificResult = (tr as any)[armName]();
              const opResultCode = opSpecificResult.switch().name as string;
              console.log("[parseError] op result code:", trTypeName, "→", opResultCode);
              return { code: opResultCode, message: humanize(opResultCode) };
            }

            console.log("[parseError] op-level code:", opSwitchName);
            return { code: opSwitchName, message: humanize(opSwitchName) };
          }
        } catch (inner) {
          console.warn("[parseError] Could not dig into op results:", inner);
        }
        // txFailed but couldn't dig deeper
        return { code: "txFailed", message: "Transaction failed" };
      }

      console.log("[parseError] top-level tx code:", topCode);
      return { code: topCode, message: humanize(topCode) };
    }

    // Simulation error — has an "id" field and a string .error
    if ("id" in errorResponse) {
      return parseSorobanSimulationError(errorResponse);
    }
  } catch (e) {
    console.error("[parseError] Failed to parse error response:", e, errorResponse);
  }

  return { code: "unknown", message: "Transaction failed" };
}
