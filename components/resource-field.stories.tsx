"use client";

import * as React from "react";

import type { Meta, StoryObj } from "@storybook/react";
import { Plus } from "lucide-react";

import { ResourceField } from "./resource-field";
import { Button } from "./ui/button";
import { Label } from "./ui/label";

type Sample = { id: string; name: string; email?: string; desc?: string; img?: string; disabled?: boolean };

const customers: Sample[] = [
  { id: "c1", name: "Alice Johnson", email: "alice@ironkey.investments", img: "https://i.pravatar.cc/150?u=1" },
  { id: "c2", name: "Jayson Quinones", email: "jayson@ironkey.investments", img: "https://i.pravatar.cc/150?u=2" },
  { id: "c3", name: "Bryan Mayorga", email: "mayorga101@gmail.com", img: "https://i.pravatar.cc/150?u=3" },
  { id: "c4", name: "Reginald Bishop", email: "johnsonladray@gmail.com", img: "https://i.pravatar.cc/150?u=4" },
];

const customerConfig = {
  items: customers,
  pickerLabel: "Customer",
  getItemTitle: (i: Sample) => i.name,
  searchFilter: (i: Sample, q: string) =>
    i.name.toLowerCase().includes(q.toLowerCase()) || (i.email?.toLowerCase().includes(q.toLowerCase()) ?? false),

  renderSearchItem: (i: Sample) => (
    <div className="flex cursor-pointer items-center gap-3 p-2.5 transition-colors">
      <img src={i.img} className="size-7 rounded-full" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] leading-none font-semibold">{i.name}</p>
        <p className="text-muted-foreground truncate text-[11px] leading-relaxed">{i.email}</p>
      </div>
    </div>
  ),

  renderSummary: (i: Sample) => (
    <div className="flex items-center gap-3">
      <img src={i.img} className="size-10 rounded-full" />
      <div>
        <p className="text-sm font-bold">{i.name}</p>
        <p className="text-muted-foreground text-xs">{i.email}</p>
      </div>
    </div>
  ),

  renderDetail: (i: Sample, { close, remove, picker }: any) => (
    <div className="space-y-5 pt-4">
      {picker}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <Label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">Email</Label>
          <p className="text-[13px]">{i.email}</p>
        </div>
        <div>
          <Label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">Invoice Prefix</Label>
          <p className="font-mono text-[13px]">5D9MEYQR</p>
        </div>
      </div>
      <div className="flex justify-between border-t pt-4">
        <Button variant="destructive" size="sm" onClick={remove}>
          Remove
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={close}>
            Edit
          </Button>
          <Button size="sm" className="bg-primary" onClick={close}>
            Confirm
          </Button>
        </div>
      </div>
    </div>
  ),

  renderActions: (
    <button
      onClick={() => alert("Create Modal")}
      className="text-foreground hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-[13px] transition-colors"
    >
      <Plus className="size-3.5" />
      New customer
    </button>
  ),
  recentLabel: "Recent customers",
};

const FieldDemo = ({ initialValue = null, ...props }: any) => {
  const [val, setVal] = React.useState<Sample | null>(initialValue);
  return (
    <div className="w-[420px]">
      <ResourceField {...props} value={val} onChange={setVal} />
    </div>
  );
};

const meta: Meta<typeof ResourceField> = {
  title: "Components/ResourceField",
  component: ResourceField,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof ResourceField>;

export const SpecImplementation: Story = {
  render: () => <FieldDemo label="Customer" placeholder="Select customer" {...customerConfig} />,
};

export const ActiveLifecycle: Story = {
  render: () => <FieldDemo label="Customer" initialValue={customers[1]} {...customerConfig} />,
};

export const WithError: Story = {
  render: () => (
    <FieldDemo label="Customer" error="You must select a customer to generate an invoice" {...customerConfig} />
  ),
};

export const LoadingState: Story = {
  render: () => <FieldDemo {...customerConfig} label="Customer" items={[]} />,
};
