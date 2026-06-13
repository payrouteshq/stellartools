import type { Meta, StoryObj } from "@storybook/react";

import { CircularProgress as Self } from "./index";

const meta = {
  title: "Components/CircularProgress",
  component: Self,
} satisfies Meta<typeof Self>;

export default meta;

export const Default: StoryObj<typeof meta> = {
  args: {
    value: 50,
    max: 100,
    size: 30,
  },
};
