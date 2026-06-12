import { Meta, StoryObj } from "@storybook/react";

import { Spinner } from "./spinner";

const meta = {
  title: "Components/Spinner",
  component: Spinner,
} satisfies Meta<typeof Spinner>;

export default meta;

export const Default: StoryObj<typeof meta> = {
  args: {
    size: 30,
  },
};
