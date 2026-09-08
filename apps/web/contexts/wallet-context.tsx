"use client";

import * as React from "react";

import { Network as StellarToolsNetwork } from "@/constant/schema.client";
import { parseError } from "@/integrations/stellar-core";
import { AppError } from "@/lib/action-handler";
import {
  AlbedoModule,
  FreighterModule,
  HanaModule,
  HotWalletModule,
  ISupportedWallet,
  LobstrModule,
  StellarWalletsKit,
  WalletNetwork,
  XBULL_ID,
  xBullModule,
} from "@creit.tech/stellar-wallets-kit";
import {
  WALLET_CONNECT_ID,
  WalletConnectAllowedMethods,
  WalletConnectModule,
} from "@creit.tech/stellar-wallets-kit/modules/walletconnect.module";
import { SorokitProvider } from "@sorokit/provider";
import { WalletAdapter, WalletConnector, useWallet as useSorokitWallet } from "@sorokit/wallet-adapter";
import { Asset, Networks, Operation, Transaction, TransactionBuilder, rpc } from "@stellar/stellar-sdk";
import { useQueryClient } from "@tanstack/react-query";

export enum TxStatus {
  NONE,
  BUILDING,
  SIGNING,
  SUBMITTING,
  SUCCESS,
  FAIL,
}

export interface IWalletContext {
  connected: boolean;
  walletAddress: string;
  txStatus: TxStatus;
  lastTxHash: string | undefined;
  error: string | undefined;
  isLoading: boolean;
  connect: (handleSuccess: (success: boolean) => void) => Promise<void>;
  disconnect: () => void;
  signAndSubmit: (
    tx: Transaction | TransactionBuilder
  ) => Promise<{ txHash: string | null; status: "SUCCESS" | "FAIL"; message?: string }>;
  createTrustlines: (assets: Asset[], network: Networks) => Promise<void>;
  setTxStatus: (status: TxStatus) => void;
  setError: (err: string | undefined) => void;
  setEnvironment: (environment: StellarToolsNetwork) => void;
}

const WalletContext = React.createContext<IWalletContext | undefined>(undefined);

/**
 * Sorokit's prebuilt `stellarWalletsKit()` connector targets the kit's v2
 * static API (`StellarWalletsKit.init()`, `.authModal()`), but this app runs
 * `@creit.tech/stellar-wallets-kit@1.9.5`'s instance API. This hand-rolled
 * WalletAdapter wraps the existing v1.9.5 kit (same modules/WalletConnect
 * config as before) so it plugs into SorokitProvider/useWallet without
 * bumping the signing SDK.
 */
function createKitConnector(): WalletConnector {
  const stateListeners = new Set<(state: { address: string | undefined; network: string | undefined }) => void>();
  const disconnectListeners = new Set<() => void>();

  let kit: StellarWalletsKit | undefined;
  let kitNetwork: WalletNetwork | undefined;
  let walletConnectModule: WalletConnectModule | undefined;

  function ensureKit(networkPassphrase: string): StellarWalletsKit {
    const swkNetwork = networkPassphrase === Networks.PUBLIC ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET;

    if (!kit || kitNetwork !== swkNetwork) {
      walletConnectModule = new WalletConnectModule({
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
        method: WalletConnectAllowedMethods.SIGN,
        url: process.env.NEXT_PUBLIC_APP_URL!,
        name: "Stellar Tools",
        description: "Stellar checkout payments",
        icons: [`${process.env.NEXT_PUBLIC_APP_URL}/favicon.ico`],
        network: swkNetwork,
      });

      kit = new StellarWalletsKit({
        network: swkNetwork,
        selectedWalletId: XBULL_ID,
        modules: [
          new xBullModule(),
          new FreighterModule(),
          new LobstrModule(),
          new AlbedoModule(),
          new HanaModule(),
          new HotWalletModule(),
          walletConnectModule,
        ],
      });
      kitNetwork = swkNetwork;
    }

    return kit;
  }

  const adapter: WalletAdapter = {
    init(networkPassphrase) {
      ensureKit(networkPassphrase);
    },
    connect: () =>
      new Promise((resolve, reject) => {
        const activeKit = kit;
        if (!activeKit) {
          reject(new AppError("INTERNAL_ERROR", "Wallet kit not initialized"));
          return;
        }

        activeKit
          .openModal({
            onWalletSelected: async (option: ISupportedWallet) => {
              try {
                if (option.id === WALLET_CONNECT_ID && walletConnectModule) {
                  try {
                    await walletConnectModule.disconnect();
                  } catch (e) {
                    console.error(e);
                  }
                }

                activeKit.setWallet(option.id);
                const { address } = await activeKit.getAddress();
                if (!address) {
                  reject(new AppError("INTERNAL_ERROR", "Unable to load wallet address"));
                  return;
                }

                const network = kitNetwork === WalletNetwork.PUBLIC ? Networks.PUBLIC : Networks.TESTNET;
                stateListeners.forEach((listener) => listener({ address, network }));
                resolve({ address });
              } catch (e) {
                reject(e);
              }
            },
            onClosed: () => reject(new AppError("VALIDATION_ERROR", "Wallet selection cancelled")),
          })
          .catch(reject);
      }),
    disconnect: async () => {
      await kit?.disconnect();
      disconnectListeners.forEach((listener) => listener());
    },
    signTransaction: (xdr, opts) => {
      if (!kit) throw new AppError("INTERNAL_ERROR", "Wallet kit not initialized");
      return kit.signTransaction(xdr, opts);
    },
    signAuthEntry: (authEntry, opts) => {
      if (!kit) throw new AppError("INTERNAL_ERROR", "Wallet kit not initialized");
      return kit.signAuthEntry(authEntry, opts);
    },
    onStateChange(listener) {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },
    onDisconnect(listener) {
      disconnectListeners.add(listener);
      return () => disconnectListeners.delete(listener);
    },
  };

  return { useAdapter: () => adapter };
}

// Constructed once at module scope — Sorokit tears down and resubscribes its
// listeners whenever it sees a new connector reference.
const kitConnector = createKitConnector();

const WalletBridge: React.FC<{
  environment: StellarToolsNetwork;
  setEnvironment: (environment: StellarToolsNetwork) => void;
  children: React.ReactNode;
}> = ({ environment, setEnvironment, children }) => {
  const sorokitWallet = useSorokitWallet();

  const [txStatus, setTxStatus] = React.useState<TxStatus>(TxStatus.NONE);
  const [txHash, setTxHash] = React.useState<string | undefined>();
  const [error, setError] = React.useState<string | undefined>();
  const [isLoading, setIsLoading] = React.useState(false);

  const walletAddress = sorokitWallet.address ?? "";

  const rpcUrl = React.useMemo(() => {
    if (environment === "testnet") return process.env.NEXT_PUBLIC_RPC_URL_TESTNET!;
    else return process.env.NEXT_PUBLIC_RPC_URL_MAINNET!;
  }, [environment]);

  const stellarRpc = React.useMemo(() => (rpcUrl ? new rpc.Server(rpcUrl) : null), [rpcUrl]);

  const connect = async (handleSuccess: (success: boolean) => void) => {
    try {
      setIsLoading(true);
      await sorokitWallet.connect();
      handleSuccess(true);
    } catch (e: any) {
      setError(e.message);
      handleSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = () => {
    void sorokitWallet.disconnect();
  };

  const signAndSubmit = async (
    input: Transaction | TransactionBuilder
  ): Promise<{ txHash: string | null; status: "SUCCESS" | "FAIL"; message?: string }> => {
    setTxStatus(TxStatus.SIGNING);

    const network = input instanceof Transaction ? input.networkPassphrase : (input as any).networkPassphrase;
    const xdr = input instanceof Transaction ? input.toXDR() : input.build().toXDR();

    const { signedTxXdr } = await sorokitWallet.signTransaction(xdr, {
      address: walletAddress,
      networkPassphrase: network,
    });
    console.log("[wallet] step 1 — signedTxXdr:", signedTxXdr);

    setTxStatus(TxStatus.SUBMITTING);
    const signedTx = new Transaction(signedTxXdr, network);
    const txHash = signedTx.hash().toString("hex");
    console.log("[wallet] step 2 — built tx, hash:", txHash, "ops:", signedTx.operations.length);

    if (!stellarRpc) throw new AppError("INTERNAL_ERROR", "RPC not configured");
    let send_tx_response = await stellarRpc.sendTransaction(signedTx);
    let curr_time = Date.now();
    console.log(
      "[wallet] step 3 — sendTransaction initial status:",
      send_tx_response.status,
      "hash:",
      send_tx_response.hash
    );

    // Only retry on TRY_AGAIN_LATER (transient RPC congestion).
    // ERROR = hard rejection by the network — retrying the same signed tx never helps.
    // DUPLICATE = already queued from a prior attempt — proceed to poll.
    while (send_tx_response.status === "TRY_AGAIN_LATER" && Date.now() - curr_time < 10_000) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      send_tx_response = await stellarRpc.sendTransaction(signedTx);
      console.log("[wallet] step 3 — retry status:", send_tx_response.status);
    }

    console.log("[wallet] step 4 — final send status:", send_tx_response.status, send_tx_response);

    if (send_tx_response.status === "ERROR") {
      const parsed = parseError(send_tx_response);
      console.error("[wallet] step 4 ERROR — code:", parsed.code, "message:", parsed.message, "raw:", send_tx_response);
      setTxStatus(TxStatus.FAIL);
      return { txHash: send_tx_response.hash ?? null, status: "FAIL", message: parsed.message };
    }

    if (send_tx_response.status !== "PENDING" && send_tx_response.status !== "DUPLICATE") {
      console.error("[wallet] step 4 — unexpected status:", send_tx_response.status);
      setError("Failed to send transaction");
      setTxStatus(TxStatus.FAIL);
      return { txHash: null, status: "FAIL", message: "Failed to send transaction" };
    }

    console.log("[wallet] step 5 — polling for confirmation, hash:", send_tx_response.hash);
    curr_time = Date.now();
    let get_tx_response = await stellarRpc.getTransaction(send_tx_response.hash);
    while (get_tx_response.status === "NOT_FOUND" && Date.now() - curr_time < 30000) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      get_tx_response = await stellarRpc.getTransaction(send_tx_response.hash);
    }

    console.log("[wallet] step 6 — getTransaction result:", get_tx_response.status, get_tx_response);

    if (get_tx_response.status === "NOT_FOUND") {
      console.error("[wallet] step 6 — tx not found after 30s, hash:", send_tx_response.hash);
      setError("Unable to validate transaction success");
      setTxStatus(TxStatus.FAIL);
      return { txHash: get_tx_response.txHash, status: "FAIL", message: "Unable to validate transaction success" };
    }

    setTxHash(txHash);

    if (get_tx_response.status === "SUCCESS") {
      console.log("[wallet] step 7 — SUCCESS, hash:", txHash);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setTxStatus(TxStatus.SUCCESS);
      return { txHash, status: "SUCCESS" };
    } else {
      const parsed = parseError(get_tx_response);
      console.error(
        "[wallet] step 7 — FAILED, code:",
        parsed.code,
        "message:",
        parsed.message,
        "raw:",
        get_tx_response
      );
      setTxStatus(TxStatus.FAIL);
      return { txHash: get_tx_response.txHash ?? txHash, status: "FAIL", message: parsed.message };
    }
  };

  const createTrustlines = async (assets: Asset[], network: Networks) => {
    setTxStatus(TxStatus.BUILDING);
    try {
      if (!stellarRpc) throw new AppError("INTERNAL_ERROR", "RPC not configured");
      const account = await stellarRpc.getAccount(walletAddress);
      const builder = new TransactionBuilder(account, {
        fee: "1000",
        networkPassphrase: network,
      });

      assets.forEach((asset) => builder.addOperation(Operation.changeTrust({ asset })));

      await signAndSubmit(builder);
    } catch (e: any) {
      setError(e.message);
      setTxStatus(TxStatus.FAIL);
    }
  };

  const value: IWalletContext = {
    connected: sorokitWallet.isConnected,
    walletAddress,
    txStatus,
    lastTxHash: txHash,
    error,
    isLoading,
    connect,
    disconnect,
    signAndSubmit,
    createTrustlines,
    setTxStatus,
    setError,
    setEnvironment,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [environment, setEnvironment] = React.useState<StellarToolsNetwork>("testnet");

  const network = environment === "testnet" ? "TESTNET" : "PUBLIC";
  const rpcUrl =
    environment === "testnet" ? process.env.NEXT_PUBLIC_RPC_URL_TESTNET : process.env.NEXT_PUBLIC_RPC_URL_MAINNET;
  const horizonUrl =
    environment === "testnet"
      ? process.env.NEXT_PUBLIC_STELLAR_HORIZON_TESTNET
      : process.env.NEXT_PUBLIC_STELLAR_HORIZON_MAINNET;

  return (
    <SorokitProvider
      devtools
      network={network}
      rpcUrl={rpcUrl}
      horizonUrl={horizonUrl}
      wallet={kitConnector}
      queryClient={queryClient}
    >
      <WalletBridge environment={environment} setEnvironment={setEnvironment}>
        {children}
      </WalletBridge>
    </SorokitProvider>
  );
};

export const useWallet = () => {
  const context = React.use(WalletContext);
  if (!context) throw new AppError("NOT_FOUND", "useWallet must be used within WalletProvider");
  return context;
};
