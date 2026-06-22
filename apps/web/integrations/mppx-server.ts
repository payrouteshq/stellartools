import "server-only";

import { Network } from "@/db";
import { getChannelState as mppState, stellar } from "@stellar/mpp/channel/server";
import { Keypair } from "@stellar/stellar-sdk";
import { createHmac } from "crypto";
import { Mppx, Store } from "mppx/server";

/**
 * THE KEY GENERATOR
 * Derives the "Managed Stamp" for a specific balance ID.
 * This key signs the vouchers.
 */
export const deriveMeteringKeypair = (balanceId: string) => {
  const seed = createHmac("sha256", process.env.MPP_SERVER_SECRET!).update(balanceId).digest();
  return Keypair.fromRawEd25519Seed(seed);
};

/**
 * THE VERIFIER
 * Sets up the engine to check if the incoming 'Payment' header is valid.
 */
export const getMppxEngine = (params: { channelAddress: string; commitmentPublicKey: string; network: Network }) => {
  return Mppx.create({
    // System secret used to sign the 402 challenge itself
    secretKey: process.env.MPP_SERVER_SECRET!,
    methods: [
      stellar.channel({
        channel: params.channelAddress,
        commitmentKey: params.commitmentPublicKey,
        store: Store.memory(),
        network: params.network === "mainnet" ? "stellar:pubnet" : "stellar:testnet",
        checkOnChainState: true,
      }),
    ],
  });
};

export async function getLeanBalanceInfo(params: {
  channelAddress: string;
  network: Network;
  unsettledAmount: number; // This comes from credit_balance.latest_cumulative_amount
}) {
  // 1. Convert StellarTools network format to MPP SDK format
  const networkId = params.network === "mainnet" ? "stellar:pubnet" : "stellar:testnet";

  // 2. Query the Smart Contract on-chain (using the SDK function you provided)
  // This calls the 'balance()' and 'status()' functions via simulation (no fees)
  const chainState = await mppState({
    channel: params.channelAddress,
    network: networkId,
  });

  // chainState.balance is a BigInt from the contract
  const onChainBalance = Number(chainState.balance);

  // 3. The Math: Chain (The Vault) - Unsettled (The IOUs)
  const availableToSpend = onChainBalance - params.unsettledAmount;

  return {
    onChainBalance,
    unsettledAmount: params.unsettledAmount,
    availableBalance: Math.max(0, availableToSpend),
    isClosing: chainState.closeEffectiveAtLedger !== null,
    currentLedger: chainState.currentLedger,
  };
}
