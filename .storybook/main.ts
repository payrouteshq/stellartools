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
    const sharedUiRoot = path.resolve(projectRoot, "packages/shared-ui");

    return {
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...config.resolve?.alias,
          "@": webRoot,
          "@stellartools/shared-ui": path.resolve(sharedUiRoot, "src/index.ts"),
        },
        // Prevent duplicate React instances across packages
        dedupe: ["react", "react-dom", "react/jsx-runtime"],
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
