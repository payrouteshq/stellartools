import { Network } from "@/db";
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

export type SorobanTxResult = {
  hash: string;
  events: { topic: string; topics: string[]; data: any; success: boolean }[];
  customerWalletAddress: string | undefined;
};

const getSorobanConfig = (network: Network) => {
  const isTestnet = network === "testnet";
  const rpcUrl = isTestnet ? process.env.NEXT_PUBLIC_RPC_URL_TESTNET! : process.env.NEXT_PUBLIC_RPC_URL_MAINNET!;

  return {
    passphrase: isTestnet ? StellarSDK.Networks.TESTNET : StellarSDK.Networks.PUBLIC,
    server: new StellarSDK.rpc.Server(rpcUrl),
    contractId: process.env.SUBSCRIPTION_CONTRACT_ID!,
  };
};

const pollSorobanTx = async (
  hash: string,
  network: Network,
  attempts = 10
): Promise<Result<SorobanTxResult, Error>> => {
  const { server, passphrase } = getSorobanConfig(network);

  for (let i = 0; i < attempts; i++) {
    const res = await server.getTransaction(hash);

    if (res.status === StellarSDK.rpc.Api.GetTransactionStatus.SUCCESS) {
      const rawEvents = res.events?.contractEventsXdr?.flat() ?? [];
      const parsedEvents = rawEvents.map((eventXdr) => {
        const event =
          typeof eventXdr === "string" ? StellarSDK.xdr.ContractEvent.fromXDR(eventXdr, "base64") : eventXdr;

        const topics = event
          .body()
          .v0()
          .topics()
          .map((t) => StellarSDK.scValToNative(t));
        const data = StellarSDK.scValToNative(event.body().v0().data());

        return { topic: topics[0], topics, data, success: true };
      });

      let customerWalletAddress: string | undefined;
      if (res.envelopeXdr) {
        const tx = new StellarSDK.Transaction(res.envelopeXdr, passphrase);
        customerWalletAddress = tx.source;
      }

      return Result.ok({ hash, events: parsedEvents, customerWalletAddress });
    }

    if (res.status === StellarSDK.rpc.Api.GetTransactionStatus.FAILED) {
      return Result.err(new AppError(`Transaction failed on-chain: ${hash}`));
    }

    await new Promise((r) => setTimeout(r, 10000));
  }

  return Result.err(new AppError("Transaction polling timed out"));
};

const invokeSoroban = async <T = SorobanTxResult>(
  network: Network,
  publicKey: string,
  operation: StellarSDK.xdr.Operation,
  options: { readOnly?: boolean } = {}
): Promise<Result<T, Error>> => {
  return Result.tryPromise(async () => {
    const { server, passphrase } = getSorobanConfig(network);
    const keypair = StellarSDK.Keypair.fromPublicKey(publicKey);
    const sourceAccount = await server.getAccount(keypair.publicKey());

    let txBuilder = new StellarSDK.TransactionBuilder(sourceAccount, {
      fee: StellarSDK.BASE_FEE,
      networkPassphrase: passphrase,
    })
      .addOperation(operation)
      .setTimeout(30);

    const tx = txBuilder.build();
    const simulation = await server.simulateTransaction(tx);

    if (StellarSDK.rpc.Api.isSimulationError(simulation)) {
      throw new AppError(`Simulation failed: ${simulation.error}`);
    }

    // --- READ FLOW ---
    if (options.readOnly) {
      if (!simulation.result) throw new AppError("Simulation returned no result");
      // Converts ScVal return value to native TS types (e.g. SorobanSubscription)
      return StellarSDK.scValToNative(simulation.result.retval) as T;
    }

    // --- WRITE FLOW ---
    const assembledTx = StellarSDK.rpc.assembleTransaction(tx, simulation).build();
    assembledTx.sign(keypair);

    const response = await server.sendTransaction(assembledTx);

    if (response.status !== "PENDING") {
      throw new AppError(`Submission failed: ${response.status}`);
    }

    const pollResult = await pollSorobanTx(response.hash, network);

    if (pollResult.isErr()) throw pollResult.error;

    return pollResult.value as unknown as T;
  });
};

export const buildSubscriptionApprovalXdr = async (
  network: Network,
  params: { customerAddress: string; tokenContractId: string; amount: bigint }
) => {
  return Result.tryPromise(async () => {
    const { server, passphrase, contractId } = getSorobanConfig(network);
    const latestLedger = await server.getLatestLedger();
    const expirationLedger = latestLedger.sequence + 2_628_000;

    const contract = new StellarSDK.Contract(params.tokenContractId);
    const operation = contract.call(
      "approve",
      StellarSDK.nativeToScVal(params.customerAddress, { type: "address" }),
      StellarSDK.nativeToScVal(contractId, { type: "address" }),
      StellarSDK.nativeToScVal(params.amount, { type: "i128" }),
      StellarSDK.nativeToScVal(expirationLedger, { type: "u32" })
    );

    const source = await server.getAccount(params.customerAddress);
    const tx = new StellarSDK.TransactionBuilder(source, { fee: StellarSDK.BASE_FEE, networkPassphrase: passphrase })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    const simulation = await server.simulateTransaction(tx);
    if (StellarSDK.rpc.Api.isSimulationError(simulation)) throw new AppError(simulation.error);

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
    if (response.status !== "PENDING") throw new AppError(`Submission failed: ${response.status}`);

    const pollResult = await pollSorobanTx(response.hash, network);
    if (pollResult.isErr()) throw pollResult.error;

    return { hash: response.hash };
  });
};

export const startSubscription = async (
  network: Network,
  publicKey: string,
  params: {
    customerAddress: string;
    merchantAddress: string;
    tokenContractId: string;
    productId: string;
    amountStroops: bigint;
    durationSeconds: number;
  }
) => {
  const { contractId } = getSorobanConfig(network);
  const contract = new StellarSDK.Contract(contractId);

  const operation = contract.call(
    "start",
    StellarSDK.nativeToScVal(params.customerAddress, { type: "address" }),
    StellarSDK.nativeToScVal(params.merchantAddress, { type: "address" }),
    StellarSDK.nativeToScVal(params.tokenContractId, { type: "address" }),
    StellarSDK.nativeToScVal(params.productId, { type: "string" }),
    StellarSDK.nativeToScVal(params.amountStroops, { type: "i128" }),
    StellarSDK.nativeToScVal(BigInt(params.durationSeconds), { type: "u64" }),
    StellarSDK.nativeToScVal(publicKey, { type: "address" })
  );

  return await invokeSoroban(network, publicKey, operation);
};

export const chargeSubscription = async (network: Network, publicKey: string, customer: string, productId: string) => {
  const { contractId } = getSorobanConfig(network);
  const operation = new StellarSDK.Contract(contractId).call(
    "charge",
    StellarSDK.nativeToScVal(customer, { type: "address" }),
    StellarSDK.nativeToScVal(productId, { type: "string" })
  );
  return await invokeSoroban(network, publicKey, operation);
};

export const cancelSubscription = async (network: Network, publicKey: string, customer: string, productId: string) => {
  const { contractId } = getSorobanConfig(network);
  const operation = new StellarSDK.Contract(contractId).call(
    "cancel",
    StellarSDK.nativeToScVal(customer, { type: "address" }),
    StellarSDK.nativeToScVal(productId, { type: "string" }),
    StellarSDK.nativeToScVal(publicKey, { type: "address" })
  );
  return await invokeSoroban(network, publicKey, operation);
};

export const pauseSubscription = async (network: Network, publicKey: string, customer: string, productId: string) => {
  const { contractId } = getSorobanConfig(network);
  const operation = new StellarSDK.Contract(contractId).call(
    "pause",
    StellarSDK.nativeToScVal(customer, { type: "address" }),
    StellarSDK.nativeToScVal(productId, { type: "string" }),
    StellarSDK.nativeToScVal(publicKey, { type: "address" })
  );
  return await invokeSoroban(network, publicKey, operation);
};

export const resumeSubscription = async (network: Network, publicKey: string, customer: string, productId: string) => {
  const { contractId } = getSorobanConfig(network);
  const operation = new StellarSDK.Contract(contractId).call(
    "resume",
    StellarSDK.nativeToScVal(customer, { type: "address" }),
    StellarSDK.nativeToScVal(productId, { type: "string" }),
    StellarSDK.nativeToScVal(publicKey, { type: "address" })
  );
  return await invokeSoroban(network, publicKey, operation);
};

export const retrieveSubscription = async (network: Network, publicKey: string, productId: string) => {
  const { contractId } = getSorobanConfig(network);
  const operation = new StellarSDK.Contract(contractId).call(
    "get_subscription",
    StellarSDK.nativeToScVal(publicKey, { type: "address" }),
    StellarSDK.nativeToScVal(productId, { type: "string" })
  );

  return await invokeSoroban<SorobanSubscription>(network, publicKey, operation, { readOnly: true });
};
