import { retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { SENSITIVE_KEY_PREFIX } from "@/constant";
import { Network } from "@/db";
import { decrypt } from "@/integrations/encryption";
import { getKeeperSecret, getSubscriptionContractId, parseError } from "@/integrations/stellar-core";
import { AppError } from "@/lib/action-handler";
import * as StellarSDK from "@stellar/stellar-sdk";
import { Result } from "@stellartools/core";

export type SorobanSubscription = {
  customer: string;
  merchant: string;
  token: string;
  amount: bigint;
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
    contractId: getSubscriptionContractId(network),
  };
};

export const resolveMerchantSecretAndWalletStrategy = async (orgId: string, network: Network) => {
  const { secret, walletStrategy } = await retrieveOrganizationIdAndSecret(orgId, network);
  if (!secret?.encrypted && walletStrategy === "managed") {
    throw new AppError("VALIDATION_ERROR", "Merchant wallet not configured");
  }
  return { secret: decrypt(secret!.encrypted.replace(SENSITIVE_KEY_PREFIX, "") ?? ""), walletStrategy };
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

  console.dir({ events }, { depth: 100 });

  return events;
};

const invokeSoroban = async <T = SorobanTxResult>(
  network: Network,
  operation: StellarSDK.xdr.Operation,
  options: { readOnly?: boolean; signerSecret?: string; sourcePublicKey?: string } = {}
): Promise<Result<T, AppError>> => {
  return Result.tryPromise({
    try: async () => {
      const { server, passphrase } = getSorobanConfig(network);
      const keypair = options.signerSecret
        ? StellarSDK.Keypair.fromSecret(options.signerSecret)
        : StellarSDK.Keypair.fromSecret(getKeeperSecret(network));
      const sourceKey = options.readOnly ? (options.sourcePublicKey ?? keypair.publicKey()) : keypair.publicKey();
      const sourceAccount = await server.getAccount(sourceKey);

      const tx = new StellarSDK.TransactionBuilder(sourceAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: passphrase,
      })
        .addOperation(operation)
        .setTimeout(30)
        .build();

      const simulation = await server.simulateTransaction(tx);

      if (StellarSDK.rpc.Api.isSimulationError(simulation)) {
        const parsed = parseError(simulation);
        throw new AppError("STELLAR_ERROR", parsed.message);
      }

      if (options.readOnly) {
        if (!simulation.result) throw new AppError("STELLAR_ERROR", "Simulation returned no result");
        return StellarSDK.scValToNative(simulation.result.retval) as T;
      }

      const assembledTx = StellarSDK.rpc.assembleTransaction(tx, simulation).build();
      assembledTx.sign(keypair);

      const response = await server.sendTransaction(assembledTx);

      if (response.status !== "PENDING") {
        throw new AppError("STELLAR_ERROR", `Submission failed: ${response.status}`);
      }

      const result = await server.pollTransaction(response.hash, { attempts: 15 });

      if (result.status === StellarSDK.rpc.Api.GetTransactionStatus.FAILED) {
        throw new AppError("STELLAR_ERROR", `Transaction failed on-chain: ${response.hash}`);
      }
      if (result.status !== StellarSDK.rpc.Api.GetTransactionStatus.SUCCESS) {
        throw new AppError("STELLAR_ERROR", `Transaction not confirmed: ${result.status}`);
      }

      const walletAddres = result.envelopeXdr
        ? new StellarSDK.Transaction(result.envelopeXdr, passphrase).source
        : undefined;

      const events = extractContractEvents(result);

      return { hash: response.hash, sourceWalletAddress: walletAddres, events } as T;
    },
    catch: (cause) =>
      cause instanceof AppError
        ? cause
        : new AppError("STELLAR_ERROR", cause instanceof Error ? cause.message : String(cause)),
  });
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

export const startSubscription = async (
  network: Network,
  params: {
    customerAddress: string;
    merchantAddress: string;
    tokenContractId: string;
    productId: string;
    amountRaw: bigint;
    durationMs: number;
  }
) => {
  const keeper = StellarSDK.Keypair.fromSecret(getKeeperSecret(network));
  const { contractId } = getSorobanConfig(network);
  const durationSeconds = Math.max(1, Math.round(params.durationMs / 1000));
  const operation = new StellarSDK.Contract(contractId).call(
    "start",
    StellarSDK.nativeToScVal(params.customerAddress, { type: "address" }),
    StellarSDK.nativeToScVal(params.merchantAddress, { type: "address" }),
    StellarSDK.nativeToScVal(params.tokenContractId, { type: "address" }),
    StellarSDK.nativeToScVal(params.productId, { type: "string" }),
    StellarSDK.nativeToScVal(params.amountRaw, { type: "i128" }),
    StellarSDK.nativeToScVal(BigInt(durationSeconds), { type: "u64" }),
    StellarSDK.nativeToScVal(keeper.publicKey(), { type: "address" })
  );

  return await invokeSoroban(network, operation);
};

export const chargeSubscription = async (
  network: Network,
  customerAddress: string,
  productId: string,
  amountRaw: bigint
) => {
  const { contractId } = getSorobanConfig(network);
  const operation = new StellarSDK.Contract(contractId).call(
    "charge",
    StellarSDK.nativeToScVal(customerAddress, { type: "address" }),
    StellarSDK.nativeToScVal(productId, { type: "string" }),
    StellarSDK.nativeToScVal(amountRaw, { type: "i128" })
  );
  return await invokeSoroban(network, operation);
};

export const updateSubscriptionPeriod = async (
  network: Network,
  params: {
    customerAddress: string;
    productId: string;
    periodDurationMs: number;
    periodEnd: Date;
  }
) => {
  const keeper = StellarSDK.Keypair.fromSecret(getKeeperSecret(network));
  const { contractId } = getSorobanConfig(network);
  const periodDurationSeconds = Math.max(1, Math.round(params.periodDurationMs / 1000));
  const periodEndSeconds = BigInt(Math.floor(params.periodEnd.getTime() / 1000));
  const operation = new StellarSDK.Contract(contractId).call(
    "update",
    StellarSDK.nativeToScVal(params.customerAddress, { type: "address" }),
    StellarSDK.nativeToScVal(params.productId, { type: "string" }),
    StellarSDK.nativeToScVal("active", { type: "string" }),
    StellarSDK.nativeToScVal(BigInt(periodDurationSeconds), { type: "u64" }),
    StellarSDK.nativeToScVal(periodEndSeconds, { type: "u64" }),
    StellarSDK.nativeToScVal(keeper.publicKey(), { type: "address" })
  );

  return await invokeSoroban(network, operation);
};

const merchantLifecycleCall = async (
  network: Network,
  merchantSecret: string,
  method: "pause" | "resume" | "cancel",
  customerAddress: string,
  productId: string
) => {
  const merchant = StellarSDK.Keypair.fromSecret(merchantSecret);
  const { contractId } = getSorobanConfig(network);
  const operation = new StellarSDK.Contract(contractId).call(
    method,
    StellarSDK.nativeToScVal(customerAddress, { type: "address" }),
    StellarSDK.nativeToScVal(productId, { type: "string" }),
    StellarSDK.nativeToScVal(merchant.publicKey(), { type: "address" })
  );
  return await invokeSoroban(network, operation, { signerSecret: merchantSecret });
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

export const retrieveSubscription = async (network: Network, customerAddress: string, productId: string) => {
  const { contractId } = getSorobanConfig(network);
  const operation = new StellarSDK.Contract(contractId).call(
    "get_subscription",
    StellarSDK.nativeToScVal(customerAddress, { type: "address" }),
    StellarSDK.nativeToScVal(productId, { type: "string" })
  );

  return await invokeSoroban<SorobanSubscription>(network, operation, {
    readOnly: true,
    sourcePublicKey: customerAddress,
  });
};
