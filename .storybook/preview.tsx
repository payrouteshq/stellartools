import React from "react";

import type { Preview } from "@storybook/react";

import "../packages/shared-ui/src/global.css";
import "./preview.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "light",
      values: [
        {
          name: "light",
          value: "oklch(0.9843 0.0017 247.8393)",
        },
        {
          name: "dark",
          value: "oklch(0.2079 0.0399 265.7275)",
        },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div
        className="bg-background text-foreground antialiased"
        style={
          {
            "--font-dm-sans": '"DM Sans", sans-serif',
            "--font-instrument-serif": '"Instrument Serif", serif',
            "--font-jetbrains-mono": '"JetBrains Mono", monospace',
          } as React.CSSProperties
        }
      >
        <Story />
      </div>
    ),
  ],
};

export default preview;
