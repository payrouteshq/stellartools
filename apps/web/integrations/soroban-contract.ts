import { retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { SENSITIVE_KEY_PREFIX } from "@/constant";
import { Network } from "@/db";
import { decrypt } from "@/integrations/encryption";
import { getKeeperSecret, getSubscriptionContractId, parseError } from "@/integrations/stellar-core";
import { AppError } from "@/lib/action-handler";
import * as StellarSDK from "@stellar/stellar-sdk";
import type { AssembledTransaction, ClientOptions as SubscriptionClientOptions } from "@stellar/stellar-sdk/contract";
import { Result } from "@stellartools/core";
import { Client as SubscriptionClient } from "@stellartools/subscription-contract";

export type SorobanSubscription = {
  customer: string;
  merchant: string;
  token: string;
  amount: bigint;
  maxAmount: bigint;
  periodDuration: bigint;
  periodEnd: bigint;
  status: "active" | "paused" | "canceled";
};

export type SorobanEvent = {
  topic: string;
  success: boolean;
  data: Record<string, unknown>;
};

export type SorobanTxResult = {
  hash: string;
  sourceWalletAddress: string | undefined;
  events: SorobanEvent[];
};

const getSorobanConfig = (network: Network) => {
  const isTestnet = network === "testnet";
  const rpcUrl = isTestnet ? process.env.NEXT_PUBLIC_RPC_URL_TESTNET! : process.env.NEXT_PUBLIC_RPC_URL_MAINNET!;

  return {
    passphrase: isTestnet ? StellarSDK.Networks.TESTNET : StellarSDK.Networks.PUBLIC,
    server: new StellarSDK.rpc.Server(rpcUrl),
    rpcUrl,
    contractId: getSubscriptionContractId(network),
  };
};

export const resolveMerchantSecret = async (orgId: string, network: Network, feature?: string): Promise<string> => {
  const { secret, walletStrategy } = await retrieveOrganizationIdAndSecret(orgId, network);
  if (!secret?.encrypted) {
    if (walletStrategy === "direct") {
      throw new AppError(
        "VALIDATION_ERROR",
        "Invalid wallet configuration. Contact us at support@stellartools.dev to get this resolved ASAP."
      );
    }

    throw new AppError(
      "VALIDATION_ERROR",
      `Invalid wallet configuration. Contact us at support@stellartools.dev to enable ${feature ?? "this feature"}.`
    );
  }
  return await decrypt(secret!.encrypted.replace(SENSITIVE_KEY_PREFIX, "") ?? "");
};

/** A `signTransaction` that signs locally with a keypair — for backend/operator/merchant-signed calls. */
const keypairSigner = (secret: string): NonNullable<SubscriptionClientOptions["signTransaction"]> => {
  const keypair = StellarSDK.Keypair.fromSecret(secret);
  return async (xdr, opts) => {
    const tx = StellarSDK.TransactionBuilder.fromXDR(xdr, opts?.networkPassphrase ?? StellarSDK.Networks.TESTNET);
    tx.sign(keypair);
    return { signedTxXdr: tx.toXDR(), signerAddress: keypair.publicKey() };
  };
};

/** Client for calls this backend signs and submits itself (keeper/operator by default, or a specific signer). */
const getContractClient = (network: Network, opts: { signerSecret?: string } = {}) => {
  const { passphrase, contractId, rpcUrl } = getSorobanConfig(network);
  const signerSecret = opts.signerSecret ?? getKeeperSecret(network);
  const keypair = StellarSDK.Keypair.fromSecret(signerSecret);

  return new SubscriptionClient({
    contractId,
    networkPassphrase: passphrase,
    rpcUrl,
    publicKey: keypair.publicKey(),
    signTransaction: keypairSigner(signerSecret),
  });
};

/** Client for read-only / build-only calls — no signer, just a source account to simulate against. */
const getReadOnlyClient = (network: Network, sourcePublicKey: string) => {
  const { passphrase, contractId, rpcUrl } = getSorobanConfig(network);
  return new SubscriptionClient({ contractId, networkPassphrase: passphrase, rpcUrl, publicKey: sourcePublicKey });
};

const parseContractEvent = (topics: unknown[], data: unknown): SorobanEvent => {
  const topic = String(topics[0] ?? "");
  let payload: Record<string, unknown> = {};

  if (Array.isArray(data)) {
    if (topic.includes("sub_pay") && data.length >= 2) {
      payload = { amount: data[0], periodEnd: data[1] };
    } else {
      payload = { values: data };
    }
  } else if (data && typeof data === "object") {
    payload = data as Record<string, unknown>;
  } else if (data !== undefined) {
    payload = { value: data };
  }

  return { topic, success: true, data: payload };
};

/** Protocol 23+ puts contract events on `result.events.contractEventsXdr`; older ledgers use sorobanMeta. */
const extractContractEvents = (result: StellarSDK.rpc.Api.GetSuccessfulTransactionResponse): SorobanEvent[] => {
  const events: SorobanEvent[] = [];

  for (const group of result.events?.contractEventsXdr ?? []) {
    for (const evt of group) {
      const v0 = evt.body().v0();
      events.push(
        parseContractEvent(
          v0.topics().map((t) => StellarSDK.scValToNative(t)),
          StellarSDK.scValToNative(v0.data())
        )
      );
    }
  }
  if (events.length) return events;

  if (!result.resultMetaXdr || result.resultMetaXdr.switch() !== 3) return events;

  const sorobanMeta = result.resultMetaXdr.v3().sorobanMeta();
  for (const event of sorobanMeta?.events() ?? []) {
    if (event.type().name !== "contract") continue;
    const v0 = event.body().v0();
    events.push(
      parseContractEvent(
        v0.topics().map((t) => StellarSDK.scValToNative(t)),
        StellarSDK.scValToNative(v0.data())
      )
    );
  }

  return events;
};

/** Signs (via the client's configured signer) and submits an already-simulated write call. */
const sendAssembled = async <T>(assembled: AssembledTransaction<T>, network: Network): Promise<SorobanTxResult> => {
  const { passphrase } = getSorobanConfig(network);
  const sent = await assembled.signAndSend();
  const getTx = sent.getTransactionResponse;

  if (!getTx || getTx.status !== StellarSDK.rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new AppError("STELLAR_ERROR", `Transaction not confirmed: ${getTx?.status ?? "unknown"}`);
  }

  const hash = sent.sendTransactionResponse?.hash ?? getTx.txHash;
  const sourceWalletAddress = getTx.envelopeXdr
    ? new StellarSDK.Transaction(getTx.envelopeXdr, passphrase).source
    : undefined;

  return { hash, sourceWalletAddress, events: extractContractEvents(getTx) };
};

export const verifySorobanTx = async (network: Network, hash: string) => {
  return Result.tryPromise(async () => {
    const { server } = getSorobanConfig(network);
    const result = await server.getTransaction(hash);
    if (result.status !== StellarSDK.rpc.Api.GetTransactionStatus.SUCCESS) {
      throw new AppError("STELLAR_ERROR", `Transaction not successful: ${result.status}`);
    }
    return hash;
  });
};

export const buildSubscriptionApprovalXdr = async (
  network: Network,
  params: { customerAddress: string; tokenContractId: string; amount: bigint; timeoutSeconds: number }
) => {
  return Result.tryPromise(async () => {
    const { customerAddress, tokenContractId, amount, timeoutSeconds } = params;
    const { server, passphrase, contractId } = getSorobanConfig(network);
    const latestLedger = await server.getLatestLedger();
    const expirationLedger = latestLedger.sequence + 2_628_000;

    const contract = new StellarSDK.Contract(tokenContractId);
    const operation = contract.call(
      "approve",
      StellarSDK.nativeToScVal(customerAddress, { type: "address" }),
      StellarSDK.nativeToScVal(contractId, { type: "address" }),
      StellarSDK.nativeToScVal(amount, { type: "i128" }),
      StellarSDK.nativeToScVal(expirationLedger, { type: "u32" })
    );

    const source = await server.getAccount(params.customerAddress);
    const tx = new StellarSDK.TransactionBuilder(source, { fee: StellarSDK.BASE_FEE, networkPassphrase: passphrase })
      .addOperation(operation)
      .setTimeout(timeoutSeconds)
      .build();

    const simulation = await server.simulateTransaction(tx);
    if (StellarSDK.rpc.Api.isSimulationError(simulation)) {
      throw new AppError("STELLAR_ERROR", parseError(simulation).message);
    }

    const prepared = StellarSDK.rpc.assembleTransaction(tx, simulation).build();
    const envelope = StellarSDK.xdr.TransactionEnvelope.fromXDR(prepared.toXDR(), "base64");

    envelope
      .v1()
      .tx()
      .operations()
      .forEach((op) => {
        if (op.body().switch().name !== "invokeHostFunction") return;
        const hostFnOp = op.body().invokeHostFunctionOp();
        const patchedAuth = hostFnOp.auth().map((entry) => {
          if (entry.credentials().switch().name !== "sorobanCredentialsAddress") return entry;
          return new StellarSDK.xdr.SorobanAuthorizationEntry({
            credentials: StellarSDK.xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
            rootInvocation: entry.rootInvocation(),
          });
        });
        hostFnOp.auth(patchedAuth);
      });

    return envelope.toXDR().toString("base64");
  });
};

/**
 * Builds the (unsigned) `start` invocation, source = customer. The contract
 * requires the customer's own authorization to open a subscription, so this
 * must be signed by the customer's wallet — never invoked by the backend on
 * its own, and never bundled into the approval tx (Soroban only allows one
 * invokeHostFunction operation per transaction).
 */
export const buildSubscriptionStartXdr = async (
  network: Network,
  params: {
    customerAddress: string;
    merchantAddress: string;
    tokenContractId: string;
    productId: string;
    amountRaw: bigint;
    durationMs: number;
    timeoutSeconds: number;
  }
) => {
  return Result.tryPromise(async () => {
    const durationSeconds = BigInt(Math.max(1, Math.round(params.durationMs / 1000)));
    const client = getReadOnlyClient(network, params.customerAddress);

    const assembled = await client.start(
      {
        customer: params.customerAddress,
        merchant: params.merchantAddress,
        token: params.tokenContractId,
        product_id: params.productId,
        amount: params.amountRaw,
        duration: durationSeconds,
      },
      { timeoutInSeconds: params.timeoutSeconds }
    );

    return assembled.toXDR();
  });
};

export const chargeSubscription = async (
  network: Network,
  customerAddress: string,
  merchantAddress: string,
  productId: string,
  amountRaw: bigint
) => {
  return Result.tryPromise(async () => {
    const client = getContractClient(network);
    const assembled = await client.charge(
      { customer: customerAddress, merchant: merchantAddress, product_id: productId, amount: amountRaw },
      { timeoutInSeconds: 60 }
    );
    return await sendAssembled(assembled, network);
  });
};

export const updateSubscriptionPeriod = async (
  network: Network,
  params: {
    customerAddress: string;
    merchantAddress: string;
    productId: string;
    periodDurationMs: number;
    periodEnd: Date;
    /** Pass the subscription's existing on-chain maxAmount through unchanged unless you're deliberately raising it. */
    maxAmountRaw: bigint;
  }
) => {
  return Result.tryPromise(async () => {
    const client = getContractClient(network);
    const periodDurationSeconds = BigInt(Math.max(1, Math.round(params.periodDurationMs / 1000)));
    const periodEndSeconds = BigInt(Math.floor(params.periodEnd.getTime() / 1000));

    const assembled = await client.update(
      {
        customer: params.customerAddress,
        merchant: params.merchantAddress,
        product_id: params.productId,
        status: "active",
        period_duration: periodDurationSeconds,
        period_end: periodEndSeconds,
        max_amount: params.maxAmountRaw,
      },
      { timeoutInSeconds: 60 }
    );
    return await sendAssembled(assembled, network);
  });
};

const merchantLifecycleCall = async (
  network: Network,
  merchantSecret: string,
  method: "pause" | "resume" | "cancel",
  customerAddress: string,
  productId: string
) => {
  return Result.tryPromise(async () => {
    const merchant = StellarSDK.Keypair.fromSecret(merchantSecret);
    const client = getContractClient(network, { signerSecret: merchantSecret });
    const args = {
      customer: customerAddress,
      merchant: merchant.publicKey(),
      product_id: productId,
      caller: merchant.publicKey(),
    };

    const assembled =
      method === "pause"
        ? await client.pause(args, { timeoutInSeconds: 60 })
        : method === "resume"
          ? await client.resume(args, { timeoutInSeconds: 60 })
          : await client.cancel(args, { timeoutInSeconds: 60 });

    return await sendAssembled(assembled, network);
  });
};

export const pauseSubscription = async (
  network: Network,
  merchantSecret: string,
  customerAddress: string,
  productId: string
) => merchantLifecycleCall(network, merchantSecret, "pause", customerAddress, productId);

export const resumeSubscription = async (
  network: Network,
  merchantSecret: string,
  customerAddress: string,
  productId: string
) => merchantLifecycleCall(network, merchantSecret, "resume", customerAddress, productId);

export const cancelSubscription = async (
  network: Network,
  merchantSecret: string,
  customerAddress: string,
  productId: string
) => merchantLifecycleCall(network, merchantSecret, "cancel", customerAddress, productId);

export const retrieveSubscription = async (
  network: Network,
  customerAddress: string,
  merchantAddress: string,
  productId: string
) => {
  return Result.tryPromise(async () => {
    const client = getReadOnlyClient(network, customerAddress);
    const assembled = await client.get_subscription({
      customer: customerAddress,
      merchant: merchantAddress,
      product_id: productId,
    });
    const sub = assembled.result;

    return {
      customer: sub.customer,
      merchant: sub.merchant,
      token: sub.token,
      amount: sub.amount,
      maxAmount: sub.max_amount,
      periodDuration: sub.period_duration,
      periodEnd: sub.period_end,
      status: sub.status as SorobanSubscription["status"],
    } satisfies SorobanSubscription;
  });
};

export const submitSorobanTx = async (network: Network, signedXDR: string) => {
  return Result.tryPromise(async () => {
    const { server, passphrase } = getSorobanConfig(network);
    const tx = StellarSDK.TransactionBuilder.fromXDR(signedXDR, passphrase);
    const response = await server.sendTransaction(tx);
    if (response.status !== "PENDING") throw new AppError("STELLAR_ERROR", `Submission failed: ${response.status}`);

    const result = await server.pollTransaction(response.hash, { attempts: 15 });
    if (result.status === StellarSDK.rpc.Api.GetTransactionStatus.FAILED) {
      throw new AppError("STELLAR_ERROR", `Transaction failed on-chain: ${response.hash}`);
    }

    const walletAddres =
      "envelopeXdr" in result && result.envelopeXdr
        ? new StellarSDK.Transaction(result.envelopeXdr, passphrase).source
        : undefined;

    return { hash: response.hash, sourceWalletAddress: walletAddres, events: [] };
  });
};
