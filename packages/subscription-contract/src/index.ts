import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  Spec as ContractSpec,
  MethodOptions,
} from "@stellar/stellar-sdk/contract";
import type { i128, u64 } from "@stellar/stellar-sdk/contract";
import { Buffer } from "buffer";

export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}

export type DataKey = { tag: "Admin"; values: void } | { tag: "Sub"; values: readonly [string, string, string] };

export interface Subscription {
  amount: i128;
  customer: string;
  max_amount: i128;
  merchant: string;
  period_duration: u64;
  period_end: u64;
  status: string;
  token: string;
}

export interface Client {
  pause: (
    {
      customer,
      merchant,
      product_id,
      caller,
    }: { customer: string; merchant: string; product_id: string; caller: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  start: (
    {
      customer,
      merchant,
      token,
      product_id,
      amount,
      duration,
    }: { customer: string; merchant: string; token: string; product_id: string; amount: i128; duration: u64 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  cancel: (
    {
      customer,
      merchant,
      product_id,
      caller,
    }: { customer: string; merchant: string; product_id: string; caller: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  charge: (
    {
      customer,
      merchant,
      product_id,
      amount,
    }: { customer: string; merchant: string; product_id: string; amount: i128 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  resume: (
    {
      customer,
      merchant,
      product_id,
      caller,
    }: { customer: string; merchant: string; product_id: string; caller: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  update: (
    {
      customer,
      merchant,
      product_id,
      status,
      period_duration,
      period_end,
      max_amount,
    }: {
      customer: string;
      merchant: string;
      product_id: string;
      status: string;
      period_duration: u64;
      period_end: u64;
      max_amount: i128;
    },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  set_admin: ({ new_admin }: { new_admin: string }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;

  get_subscription: (
    { customer, merchant, product_id }: { customer: string; merchant: string; product_id: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Subscription>>;
}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    { admin }: { admin: string },
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        wasmHash: Buffer | string;
        salt?: Buffer | Uint8Array;
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({ admin }, options);
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([
        "AAAAAAAAAAAAAAAFcGF1c2UAAAAAAAAEAAAAAAAAAAhjdXN0b21lcgAAABMAAAAAAAAACG1lcmNoYW50AAAAEwAAAAAAAAAKcHJvZHVjdF9pZAAAAAAAEAAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAARRPcGVucyBhIHN1YnNjcmlwdGlvbiBhbmQgcHVsbHMgdGhlIGZpcnN0IHBheW1lbnQuIFJlcXVpcmVzIHRoZQpjdXN0b21lcidzIG93biBhdXRob3JpemF0aW9uIOKAlCBub2JvZHkgZWxzZSBjYW4gb3BlbiBhIHN1YnNjcmlwdGlvbgooYW5kIHB1bGwgZnJvbSB0aGUgY3VzdG9tZXIncyB0b2tlbiBhbGxvd2FuY2UpIG9uIHRoZWlyIGJlaGFsZi4KYGR1cmF0aW9uYCBpcyBpbiBzZWNvbmRzIChlLmcuIDg2NDAwID0gMSBkYXksIDM2MDAgPSAxIGhvdXIgZm9yIGN1c3RvbSBwZXJpb2RzKS4AAAAFc3RhcnQAAAAAAAAGAAAAAAAAAAhjdXN0b21lcgAAABMAAAAAAAAACG1lcmNoYW50AAAAEwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAApwcm9kdWN0X2lkAAAAAAAQAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAACGR1cmF0aW9uAAAABgAAAAA=",
        "AAAAAAAAAAAAAAAGY2FuY2VsAAAAAAAEAAAAAAAAAAhjdXN0b21lcgAAABMAAAAAAAAACG1lcmNoYW50AAAAEwAAAAAAAAAKcHJvZHVjdF9pZAAAAAAAEAAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAANNDYWxsZWQgYnkgdGhlIGJhY2tlbmQvY3JvbiBvcGVyYXRvciB3aGVuIHRoZSBiaWxsaW5nIHBlcmlvZCBlbmRzLgpgYW1vdW50YCBpcyBjb21wdXRlZCBvZmYtY2hhaW4gZnJvbSBjdXJyZW50IGZpYXQvY3J5cHRvIHJhdGVzIGVhY2ggY3ljbGUuClBhbmljcyBvbiBpbnN1ZmZpY2llbnQgZnVuZHMg4oCUIHBlcmlvZF9lbmQgaXMgTk9UIGFkdmFuY2VkIG9uIGZhaWx1cmUuAAAAAAZjaGFyZ2UAAAAAAAQAAAAAAAAACGN1c3RvbWVyAAAAEwAAAAAAAAAIbWVyY2hhbnQAAAATAAAAAAAAAApwcm9kdWN0X2lkAAAAAAAQAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
        "AAAAAAAAAKdSZXN1bWUgYSBwYXVzZWQgc3Vic2NyaXB0aW9uLgpJZiB0aGUgcGF1c2VkIHBlcmlvZCBhbHJlYWR5IGV4cGlyZWQsIHJlc2V0cyBwZXJpb2RfZW5kIGZyb20gbm93IHNvIHRoZQpjdXN0b21lciBnZXRzIGEgZnVsbCBjeWNsZSB3aXRob3V0IGltbWVkaWF0ZWx5IHRyaWdnZXJpbmcgY2hhcmdlLgAAAAAGcmVzdW1lAAAAAAAEAAAAAAAAAAhjdXN0b21lcgAAABMAAAAAAAAACG1lcmNoYW50AAAAEwAAAAAAAAAKcHJvZHVjdF9pZAAAAAAAEAAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAANBPcGVyYXRvciBvdmVycmlkZSBmb3IgY29ycmVjdGluZyBiaWxsaW5nIHN0YXRlIChlLmcuIHN5bmNpbmcgYSB0cmlhbApjb252ZXJzaW9uKS4gR2F0ZWQgdGhlIHNhbWUgd2F5IGFzIGBjaGFyZ2VgIOKAlCBvbmx5IHRoZSBzdG9yZWQgb3BlcmF0b3IKYWRkcmVzcyBjYW4gY2FsbCB0aGlzLCBuZXZlciBhbiBhcmJpdHJhcnkgY2FsbGVyLXN1cHBsaWVkIGFkZHJlc3MuAAAABnVwZGF0ZQAAAAAABwAAAAAAAAAIY3VzdG9tZXIAAAATAAAAAAAAAAhtZXJjaGFudAAAABMAAAAAAAAACnByb2R1Y3RfaWQAAAAAABAAAAAAAAAABnN0YXR1cwAAAAAAEAAAAAAAAAAPcGVyaW9kX2R1cmF0aW9uAAAAAAYAAAAAAAAACnBlcmlvZF9lbmQAAAAAAAYAAAAAAAAACm1heF9hbW91bnQAAAAAAAsAAAAA",
        "AAAAAAAAAD9Sb3RhdGUgdGhlIG9wZXJhdG9yIGtleS4gT25seSB0aGUgY3VycmVudCBvcGVyYXRvciBjYW4gZG8gdGhpcy4AAAAACXNldF9hZG1pbgAAAAAAAAEAAAAAAAAACW5ld19hZG1pbgAAAAAAABMAAAAA",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAgAAAAAAAAA/T3BlcmF0b3IvYmFja2VuZCBhZGRyZXNzIGFsbG93ZWQgdG8gY2FsbCBgY2hhcmdlYCBhbmQgYHVwZGF0ZWAuAAAAAAVBZG1pbgAAAAAAAAEAAAC2KGN1c3RvbWVyLCBtZXJjaGFudCwgcHJvZHVjdF9pZCkg4oCUIG1lcmNoYW50IGlzIHBhcnQgb2YgdGhlIGtleSBzbyB0d28KbWVyY2hhbnRzIHJldXNpbmcgdGhlIHNhbWUgcHJvZHVjdF9pZCBmb3IgdGhlIHNhbWUgY3VzdG9tZXIgY2FuIG5ldmVyCmNvbGxpZGUgb24gdGhlIHNhbWUgc3Vic2NyaXB0aW9uIHJlY29yZC4AAAAAAANTdWIAAAAAAwAAABMAAAATAAAAEA==",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAA=",
        "AAAAAQAAAAAAAAAAAAAADFN1YnNjcmlwdGlvbgAAAAgAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAIY3VzdG9tZXIAAAATAAAAvEhhcmQgY2VpbGluZyBgY2hhcmdlYCBjYW4gbmV2ZXIgZXhjZWVkLCByZWdhcmRsZXNzIG9mIHdoYXQgYW1vdW50IGlzCnJlcXVlc3RlZC4gU2V0IG9uY2UgYXQgYHN0YXJ0YCAoYSBtdWx0aXBsZSBvZiB0aGUgYWdyZWVkIHByaWNlKSBhbmQKYWRqdXN0YWJsZSBsYXRlciBvbmx5IHZpYSB0aGUgYWRtaW4tZ2F0ZWQgYHVwZGF0ZWAuAAAACm1heF9hbW91bnQAAAAAAAsAAAAAAAAACG1lcmNoYW50AAAAEwAAAAAAAAAPcGVyaW9kX2R1cmF0aW9uAAAAAAYAAAAAAAAACnBlcmlvZF9lbmQAAAAAAAYAAAAAAAAABnN0YXR1cwAAAAAAEAAAAAAAAAAFdG9rZW4AAAAAAAAT",
        "AAAAAAAAAAAAAAAQZ2V0X3N1YnNjcmlwdGlvbgAAAAMAAAAAAAAACGN1c3RvbWVyAAAAEwAAAAAAAAAIbWVyY2hhbnQAAAATAAAAAAAAAApwcm9kdWN0X2lkAAAAAAAQAAAAAQAAB9AAAAAMU3Vic2NyaXB0aW9u",
      ]),
      options
    );
  }
  public readonly fromJSON = {
    pause: this.txFromJSON<null>,
    start: this.txFromJSON<null>,
    cancel: this.txFromJSON<null>,
    charge: this.txFromJSON<null>,
    resume: this.txFromJSON<null>,
    update: this.txFromJSON<null>,
    set_admin: this.txFromJSON<null>,
    get_subscription: this.txFromJSON<Subscription>,
  };
}
