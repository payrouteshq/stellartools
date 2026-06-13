import { defineConfig } from "tsup";

import pkg from "./package.json";

const external = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
  // Runtime deps that are always external
  "react/jsx-runtime",
  "next/image",
  "next/link",
];

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: false,
  clean: true,
  sourcemap: false,
  splitting: false,
  treeshake: true,
  jsx: "react-jsx",
  outDir: "dist",
  external,
});
