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
import { Asset, Networks, Operation, Transaction, TransactionBuilder, rpc } from "@stellar/stellar-sdk";

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

let walletConnectModule: WalletConnectModule | undefined;
let walletKit: StellarWalletsKit | undefined;

function getWalletKit(network: Networks): StellarWalletsKit {
  if (!walletKit) {
    const swkNetwork = network === Networks.PUBLIC ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET;

    walletConnectModule = new WalletConnectModule({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
      method: WalletConnectAllowedMethods.SIGN,
      url: process.env.NEXT_PUBLIC_APP_URL!,
      name: "Stellar Tools",
      description: "Stellar checkout payments",
      icons: [`${process.env.NEXT_PUBLIC_APP_URL}/favicon.ico`],
      network: swkNetwork,
    });

    walletKit = new StellarWalletsKit({
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
  }
  return walletKit;
}

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connected, setConnected] = React.useState(false);
  const [walletAddress, setWalletAddress] = React.useState("");
  const [txStatus, setTxStatus] = React.useState<TxStatus>(TxStatus.NONE);
  const [txHash, setTxHash] = React.useState<string | undefined>();
  const [error, setError] = React.useState<string | undefined>();
  const [isLoading, setIsLoading] = React.useState(false);
  const [environment, setEnvironment] = React.useState<StellarToolsNetwork>("testnet");

  const rpcUrl = React.useMemo(() => {
    if (environment === "testnet") return process.env.NEXT_PUBLIC_RPC_URL_TESTNET!;
    else return process.env.NEXT_PUBLIC_RPC_URL_MAINNET!;
  }, []);

  const network = React.useMemo(() => {
    if (environment === "testnet") return Networks.TESTNET;
    else return Networks.PUBLIC;
  }, [environment]);

  const stellarRpc = new rpc.Server(rpcUrl);

  async function handleSetWalletAddress(): Promise<boolean> {
    try {
      const { address: publicKey } = await getWalletKit(network).getAddress();
      if (publicKey === "" || publicKey == undefined) {
        console.error("Unable to load wallet key: ", publicKey);
        return false;
      }
      setWalletAddress(publicKey);
      setConnected(true);
      return true;
    } catch (e: any) {
      console.error("Unable to load wallet information: ", e);
      return false;
    }
  }

  const connect = async (handleSuccess: (success: boolean) => void) => {
    try {
      setIsLoading(true);
      const kit = getWalletKit(network);

      await kit.openModal({
        onWalletSelected: async (option: ISupportedWallet) => {
          if (option.id === WALLET_CONNECT_ID && walletConnectModule) {
            try {
              await walletConnectModule.disconnect();
            } catch (e) {
              console.error(e);
            }
          }

          kit.setWallet(option.id);
          let result = await handleSetWalletAddress();
          handleSuccess(result);
        },
      });
    } catch (e: any) {
      setError(e.message);
      handleSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = async () => {
    getWalletKit(network).disconnect();
    setConnected(false);
    setWalletAddress("");
  };

  const signAndSubmit = async (
    input: Transaction | TransactionBuilder
  ): Promise<{ txHash: string | null; status: "SUCCESS" | "FAIL"; message?: string }> => {
    setTxStatus(TxStatus.SIGNING);

    const network = input instanceof Transaction ? input.networkPassphrase : (input as any).networkPassphrase;
    const xdr = input instanceof Transaction ? input.toXDR() : input.build().toXDR();

    const { signedTxXdr } = await getWalletKit(network as Networks).signTransaction(xdr, {
      address: walletAddress,
      networkPassphrase: network,
    });
    console.log("[wallet] step 1 — signedTxXdr:", signedTxXdr);

    setTxStatus(TxStatus.SUBMITTING);
    const signedTx = new Transaction(signedTxXdr, network);
    const txHash = signedTx.hash().toString("hex");
    console.log("[wallet] step 2 — built tx, hash:", txHash, "ops:", signedTx.operations.length);

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

  return (
    <WalletContext.Provider
      value={{
        connected,
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
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = React.use(WalletContext);
  if (!context) throw new AppError("useWallet must be used within WalletProvider");
  return context;
};
