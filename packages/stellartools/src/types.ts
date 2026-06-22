export type OverrideProps<T, V> = V & Omit<T, keyof V>;

export type MaybeArray<T> = T | Array<T>;

export type MaybePromise<T> = T | Promise<T>;

export type SuggestedString<T extends string> = T | (string & {});

export type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type Network = "testnet" | "mainnet";

type CamelCase<S extends string> = S extends `${infer P1}_${infer P2}${infer P3}`
  ? `${Lowercase<P1>}${Uppercase<P2>}${CamelCase<P3>}`
  : S;

/**
 * ALPHA LOGIC: If an object has both 'units_per_credit' and 'unitsPerCredit',
 * this utility omits 'units_per_credit' so the override wins.
 */
type CleanKeys<T> = {
  [K in keyof T as K extends string
    ? CamelCase<K> extends keyof T
      ? K extends CamelCase<K>
        ? K
        : never
      : K
    : K]: T[K];
};

export type Camelize<T> = T extends Date
  ? T
  : T extends Array<infer U>
    ? Array<Camelize<U>>
    : T extends object
      ? { [K in keyof CleanKeys<T> as CamelCase<string & K>]: Camelize<CleanKeys<T>[K]> }
      : T;

type SnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? T extends Uppercase<T>
    ? T extends Lowercase<T>
      ? `${T}${SnakeCase<U>}`
      : `_${Lowercase<T>}${SnakeCase<U>}`
    : `${T}${SnakeCase<U>}`
  : S;

// Removes the leading underscore if the original key was already PascalCase
type SnakizeKey<S extends string> = SnakeCase<S> extends `_${infer T}` ? T : SnakeCase<S>;

export type Snakize<T> = T extends Date
  ? T
  : T extends Array<infer U>
    ? Array<Snakize<U>>
    : T extends object
      ? { [K in keyof T as SnakizeKey<string & K>]: Snakize<T[K]> }
      : T;
