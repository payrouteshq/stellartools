import React from "react";

import type { Meta, StoryObj } from "@storybook/react";

import { NumberField } from "../number-field";
import { SelectField } from "../select-field";
import { EmbeddedFieldRow, FieldStack } from "./index";

const meta: Meta<typeof FieldStack> = {
  title: "Components/FieldStack",
  component: FieldStack,
  parameters: { layout: "centered" },
};

export default meta;

export const TrialDays: StoryObj<typeof FieldStack> = {
  render: () => {
    const [productId, setProductId] = React.useState("sub");
    const [trialDays, setTrialDays] = React.useState("7");

    const isSubscription = productId === "sub";

    return (
      <div className="w-[420px]">
        <FieldStack>
          <SelectField
            id="product"
            label="Product"
            value={productId}
            onChange={setProductId}
            items={[
              { value: "sub", label: "Premium - $50.00 / every month" },
              { value: "once", label: "One-time - $100.00" },
            ]}
          />
          <EmbeddedFieldRow when={isSubscription}>
            <EmbeddedFieldRow.Label>Free trial</EmbeddedFieldRow.Label>
            <NumberField
              id="trial-days"
              value={trialDays}
              onChange={(v) => setTrialDays(v as string)}
              placeholder="0"
              className="w-24"
            />
            <EmbeddedFieldRow.Suffix>days</EmbeddedFieldRow.Suffix>
          </EmbeddedFieldRow>
        </FieldStack>
      </div>
    );
  },
};

export const CustomBillingPeriod: StoryObj<typeof FieldStack> = {
  render: () => {
    const [period, setPeriod] = React.useState("custom");
    const [qty, setQty] = React.useState("1");

    return (
      <div className="w-[420px]">
        <FieldStack className="gap-3">
          <SelectField
            id="period"
            label="Billing period"
            value={period}
            onChange={setPeriod}
            items={[
              { value: "month", label: "Monthly" },
              { value: "year", label: "Yearly" },
              { value: "custom", label: "Custom" },
            ]}
          />
          <EmbeddedFieldRow when={period === "custom"}>
            <EmbeddedFieldRow.Label>Every</EmbeddedFieldRow.Label>
            <NumberField
              id="custom-qty"
              value={qty}
              onChange={(v) => setQty(v as string)}
              placeholder="1"
              className="w-24"
            />
            <SelectField
              id="custom-unit"
              value="month"
              onChange={() => {}}
              items={[
                { value: "day", label: "days" },
                { value: "week", label: "weeks" },
                { value: "month", label: "months" },
              ]}
              triggerClassName="h-9 w-28"
            />
          </EmbeddedFieldRow>
        </FieldStack>
      </div>
    );
  },
};
