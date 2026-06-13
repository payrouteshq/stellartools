import React from "react";

import type { Meta, StoryObj } from "@storybook/react";

import { OptionFlow } from "./index";

const meta: Meta<typeof OptionFlow> = {
  title: "Components/OptionFlow",
  component: OptionFlow,
  parameters: { layout: "centered" },
};

export default meta;

const billingItems = [
  {
    value: "flexible",
    label: "Flexible (recommended)",
    description:
      "Unlocks advanced billing features, multiple intervals, bill upfront, and all future billing features.",
  },
  {
    value: "classic",
    label: "Classic",
    description: "For compatibility with existing integrations.",
  },
];

export const BillingMode: StoryObj<typeof OptionFlow> = {
  render: () => {
    const [mode, setMode] = React.useState("classic");

    return (
      <div className="w-[500px]">
        <OptionFlow label="Billing mode" value={mode} onSave={setMode} items={billingItems} />
      </div>
    );
  },
};

export const WithError: StoryObj<typeof OptionFlow> = {
  render: () => {
    const [mode, setMode] = React.useState("classic");

    return (
      <div className="w-[500px]">
        <OptionFlow
          label="Billing mode"
          value={mode}
          onSave={setMode}
          items={billingItems}
          error="You must select a billing mode before continuing."
        />
      </div>
    );
  },
};
