import { CircularProgress as Self } from "@stellartools/shared-ui";
import type { Meta, StoryObj } from "@storybook/react";

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
