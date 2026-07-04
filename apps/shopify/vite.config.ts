import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig, type Plugin, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

function requestLogger(): Plugin {
  return {
    name: "request-logger",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        console.log(`[vite] ${req.method} ${req.url}`);
        next();
      });
    },
  };
}

const host = new URL(process.env.SHOPIFY_APP_URL || process.env.HOST || "http://localhost").hostname;

let hmrConfig;
if (host === "localhost") {
  hmrConfig = {
    protocol: "ws",
    host: "localhost",
    port: 64999,
    clientPort: 64999,
  };
} else {
  hmrConfig = {
    protocol: "wss",
    host,
    port: parseInt(process.env.FRONTEND_PORT || "8002", 10),
    clientPort: 443,
  };
}

export default defineConfig({
  server: {
    port: Number(process.env.PORT || 3555),
    hmr: hmrConfig,
    allowedHosts: true,
    fs: {
      allow: ["app", "node_modules"],
    },
  },
  plugins: [
    requestLogger(),
    remix({
      ignoredRouteFiles: ["**/.*"],
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: false,
      },
    }),
    tsconfigPaths(),
  ],
  build: {
    assetsInlineLimit: 0,
  },
  ssr: {
    noExternal: ["@shopify/shopify-app-remix"],
  },
}) satisfies UserConfig;
