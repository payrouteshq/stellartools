import React from "react";

import type { Meta, StoryObj } from "@storybook/react";

import { NumberField } from "../number-field";
import { SelectField } from "../select-field";
import { EmbeddedFieldRow, FieldStack } from "./index";

const meta: Meta<typeof EmbeddedFieldRow> = {
  title: "Components/EmbeddedFieldRow",
  component: EmbeddedFieldRow,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    when: { control: "boolean" },
    layout: { control: "radio", options: ["inline", "stack"] },
  },
};

export default meta;

export const Inline: StoryObj<typeof EmbeddedFieldRow> = {
  render: () => {
    const [visible, setVisible] = React.useState(true);
    const [trialDays, setTrialDays] = React.useState("7");

    return (
      <div className="w-105">
        <FieldStack>
          <SelectField
            id="show-trial"
            label="Product type"
            value={visible ? "subscription" : "one-time"}
            onChange={(value) => setVisible(value === "subscription")}
            items={[
              { value: "subscription", label: "Subscription" },
              { value: "one-time", label: "One-time" },
            ]}
          />
          <EmbeddedFieldRow when={visible}>
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

export const Stack: StoryObj<typeof EmbeddedFieldRow> = {
  render: () => {
    const [operator, setOperator] = React.useState("between");
    const [min, setMin] = React.useState("");
    const [max, setMax] = React.useState("");

    return (
      <div className="w-105">
        <FieldStack>
          <SelectField
            id="operator"
            label="Operator"
            value={operator}
            onChange={setOperator}
            items={[
              { value: "eq", label: "Equals" },
              { value: "between", label: "Between" },
            ]}
          />
          <EmbeddedFieldRow when={operator === "between"} layout="stack" className="gap-2">
            <NumberField
              id="min"
              label="Min"
              value={min}
              onChange={(v) => setMin(v as string)}
              placeholder="Min"
              allowDecimal
            />
            <NumberField
              id="max"
              label="Max"
              value={max}
              onChange={(v) => setMax(v as string)}
              placeholder="Max"
              allowDecimal
            />
          </EmbeddedFieldRow>
        </FieldStack>
      </div>
    );
  },
};

export const Hidden: StoryObj<typeof EmbeddedFieldRow> = {
  render: () => (
    <div className="w-105">
      <FieldStack>
        <SelectField
          id="parent"
          label="Parent field"
          value="one-time"
          onChange={() => {}}
          items={[
            { value: "subscription", label: "Subscription" },
            { value: "one-time", label: "One-time" },
          ]}
        />
        <EmbeddedFieldRow when={false}>
          <EmbeddedFieldRow.Label>Nested field</EmbeddedFieldRow.Label>
          <NumberField id="hidden" value="" onChange={() => {}} placeholder="0" className="w-24" />
        </EmbeddedFieldRow>
      </FieldStack>
    </div>
  ),
};
