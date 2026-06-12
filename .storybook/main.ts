import type { StorybookConfig } from "@storybook/react-vite";
import path from "path";

const projectRoot = path.resolve(process.cwd());

const config: StorybookConfig = {
  stories: ["../packages/shared-ui/src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-essentials"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  staticDirs: ["../apps/web/public"],
  async viteFinal(config) {
    const webRoot = path.resolve(projectRoot, "apps/web");
    return {
      ...config,
      define: {
        ...config.define,
        // Next.js Link expects process in the browser; Vite doesn't provide it
        process: {
          env: {
            NODE_ENV: "development",
            __NEXT_ROUTER_BASEPATH: "",
          },
        },
      },
      resolve: {
        ...config.resolve,
        alias: {
          ...config.resolve?.alias,
          "@": webRoot,
          "@stellartools/shared-ui": path.resolve(projectRoot, "packages/shared-ui/src/index.ts"),
          "lucide-react": path.resolve(projectRoot, "node_modules/lucide-react/dist/cjs/lucide-react.js"),
        },
      },
      server: {
        ...config.server,
        fs: {
          ...config.server?.fs,
          allow: [projectRoot],
        },
      },
    };
  },
};

export default config;
