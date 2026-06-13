import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";

const meta = {
  title: "UI/Collapsible",
  component: Collapsible,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Collapsible>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Collapsible className="w-[350px]">
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          Toggle
          <span className="transition-transform data-[state=open]:rotate-180">▼</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-md border p-4 text-sm">Collapsible content. This can be shown or hidden.</div>
      </CollapsibleContent>
    </Collapsible>
  ),
};
