"use client";

import * as React from "react";

import { Network as StellarToolsNetwork } from "@/constant/schema.client";
import { parseError } from "@/integrations/stellar-core";
import { AppError } from "@/lib/error-handler";
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

    console.log("signedTxXdr", signedTxXdr);

    setTxStatus(TxStatus.SUBMITTING);
    const signedTx = new Transaction(signedTxXdr, network);

    console.log("signedTx", signedTx);
    let send_tx_response = await stellarRpc.sendTransaction(signedTx);
    let curr_time = Date.now();

    while (send_tx_response.status !== "PENDING" && Date.now() - curr_time < 5000) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      send_tx_response = await stellarRpc.sendTransaction(signedTx);
    }

    console.log("send_tx_response", send_tx_response);

    if (send_tx_response.status !== "PENDING") {
      setError("Failed to send transaction");
      console.error("Failed to send transaction: ", send_tx_response.hash, error);
      setTxStatus(TxStatus.FAIL);
      return { txHash: null, status: "FAIL", message: "Failed to send transaction" };
    }

    curr_time = Date.now();
    let get_tx_response = await stellarRpc.getTransaction(send_tx_response.hash);
    while (get_tx_response.status === "NOT_FOUND" && Date.now() - curr_time < 30000) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      get_tx_response = await stellarRpc.getTransaction(send_tx_response.hash);
    }

    console.log("get_tx_response", get_tx_response);

    if (get_tx_response.status === "NOT_FOUND") {
      setError("Unable to validate transaction success");
      console.error("Unable to validate transaction success: ", get_tx_response.txHash);
      setTxStatus(TxStatus.FAIL);
      return { txHash: get_tx_response.txHash, status: "FAIL", message: "Unable to validate transaction success" };
    }

    let hash = signedTx.hash().toString("hex");

    console.log("hash", hash);

    setTxHash(hash);

    if (get_tx_response.status === "SUCCESS") {
      console.log("Successfully submitted transaction: ", hash);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setTxStatus(TxStatus.SUCCESS);
      return { txHash: hash, status: "SUCCESS" };
    } else {
      const txHash = get_tx_response.txHash ?? hash;
      let parsedError = parseError(get_tx_response);
      console.error(`Transaction failed: `, txHash, parsedError);
      setTxStatus(TxStatus.FAIL);
      return { txHash, status: "FAIL", message: parsedError.message };
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
