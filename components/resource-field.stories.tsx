import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react";

import { ResourceField, ResourceFieldItem } from "./resource-field";

type SampleResource = {
  id: string;
  name: string;
  description?: string;
  image?: string;
  email?: string;
  phone?: string;
  disabled?: boolean;
};

const sampleItems: SampleResource[] = [
  { id: "1", name: "Project Alpha", description: "Main dashboard project" },
  { id: "2", name: "Project Beta", description: "API integration" },
  { id: "3", name: "Project Gamma", description: "Mobile app" },
  { id: "4", name: "Project Delta", description: "Analytics pipeline" },
  { id: "5", name: "Project Epsilon", description: "Customer portal" },
];

const sampleCustomers: SampleResource[] = [
  {
    id: "c1",
    name: "Alice Johnson",
    email: "alice@example.com",
    phone: "+1 555 0101",
    image: "https://i.pravatar.cc/150?u=alice",
  },
  {
    id: "c2",
    name: "Bob Smith",
    email: "bob@example.com",
    phone: "+1 555 0102",
    image: "https://i.pravatar.cc/150?u=bob",
  },
  {
    id: "c3",
    name: "Carol White",
    email: "carol@example.com",
    image: "https://i.pravatar.cc/150?u=carol",
  },
  {
    id: "c4",
    name: "David Brown",
    email: "david@example.com",
    image: "https://i.pravatar.cc/150?u=david",
  },
];

const sampleWithDisabled: SampleResource[] = [
  { id: "1", name: "Project Alpha", description: "Available" },
  { id: "2", name: "Project Beta", description: "Unavailable", disabled: true },
  { id: "3", name: "Project Gamma", description: "Available" },
  { id: "4", name: "Project Delta", description: "Unavailable", disabled: true },
  { id: "5", name: "Project Epsilon", description: "Available" },
];

const renderItem = (item: SampleResource): ResourceFieldItem => ({
  id: item.id,
  title: item.name,
  subtitle: item.description,
  searchValue: [item.name, item.description].filter(Boolean).join(" "),
  disabled: item.disabled,
});

const renderCustomerItem = (item: SampleResource): ResourceFieldItem => ({
  id: item.id,
  title: item.name,
  subtitle: item.email,
  searchValue: [item.name, item.email].filter(Boolean).join(" "),
  image: item.image ? { src: item.image, alt: item.name } : undefined,
});

const meta: Meta = {
  title: "Components/ResourceField",
  component: ResourceField,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

const Wrapper = ({ args, initialValue = [] }: { args: any; initialValue?: string[] }) => {
  const [value, setValue] = useState<string[]>(initialValue);
  return (
    <div className="w-[420px]">
      <ResourceField {...args} value={value} onChange={setValue} />
    </div>
  );
};

export const Default: Story = {
  render: () => (
    <Wrapper
      args={{
        label: "Resource",
        placeholder: "Search resources...",
        items: sampleItems,
        renderItem,
      }}
    />
  ),
};

export const WithInitialValue: Story = {
  render: () => (
    <Wrapper
      initialValue={["1"]}
      args={{
        label: "Resource",
        placeholder: "Search resources...",
        items: sampleItems,
        renderItem,
      }}
    />
  ),
};

export const SearchHighlight: Story = {
  render: () => (
    <Wrapper
      args={{
        label: "Resource",
        placeholder: "Search resources...",
        items: sampleItems,
        renderItem,
        searchHighlight: true,
      }}
    />
  ),
};

export const WithDisabledItems: Story = {
  render: () => (
    <Wrapper
      args={{
        label: "Resource",
        placeholder: "Search resources...",
        items: sampleWithDisabled,
        renderItem,
      }}
    />
  ),
};

export const WithAddNew: Story = {
  render: () => (
    <Wrapper
      args={{
        label: "Resource",
        placeholder: "Search resources...",
        items: sampleItems,
        renderItem,
        onAddNew: () => alert("Create new clicked"),
        addNewLabel: "New resource",
      }}
    />
  ),
};

export const WithDetailPanel: Story = {
  render: () => (
    <Wrapper
      initialValue={["1"]}
      args={{
        label: "Resource",
        placeholder: "Search resources...",
        items: sampleItems,
        renderItem,
        renderSelected: (item: ResourceFieldItem) => (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold">Title</p>
              <p className="text-sm text-muted-foreground">{item.title}</p>
            </div>
            {item.subtitle && (
              <div>
                <p className="text-sm font-semibold">Description</p>
                <p className="text-sm text-muted-foreground">{item.subtitle}</p>
              </div>
            )}
          </div>
        ),
      }}
    />
  ),
};

export const WithAsyncDetailPanel: Story = {
  render: () => (
    <Wrapper
      initialValue={["c1"]}
      args={{
        label: "Customer",
        placeholder: "Select customer...",
        items: sampleCustomers,
        renderItem: renderCustomerItem,
        imgClassName: "object-cover",
        renderSelected: async (item: ResourceFieldItem) => {
          await new Promise((r) => setTimeout(r, 1200));
          const customer = sampleCustomers.find((c) => c.id === item.id);
          if (!customer) return null;
          return (
            <div className="space-y-3">
              {customer.email && (
                <div>
                  <p className="text-sm font-semibold">Email</p>
                  <p className="text-sm text-muted-foreground">{customer.email}</p>
                </div>
              )}
              {customer.phone && (
                <div>
                  <p className="text-sm font-semibold">Phone</p>
                  <p className="text-sm text-muted-foreground">{customer.phone}</p>
                </div>
              )}
            </div>
          );
        },
      }}
    />
  ),
};

export const WithRemove: Story = {
  render: () => {
    const [value, setValue] = useState<string[]>(["c2"]);
    return (
      <div className="w-[420px]">
        <ResourceField
          label="Customer"
          placeholder="Select customer..."
          items={sampleCustomers}
          value={value}
          onChange={setValue}
          renderItem={renderCustomerItem}
          imgClassName="object-cover"
          renderSelected={(item) => (
            <div>
              <p className="text-sm font-semibold">Email</p>
              <p className="text-sm text-muted-foreground">
                {sampleCustomers.find((c) => c.id === item.id)?.email}
              </p>
            </div>
          )}
          onRemove={() => setValue([])}
        />
      </div>
    );
  },
};

export const Loading: Story = {
  render: () => (
    <Wrapper
      args={{
        label: "Resource",
        placeholder: "Search resources...",
        items: [],
        renderItem,
        isLoading: true,
      }}
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <Wrapper
      args={{
        label: "Resource",
        placeholder: "Search resources...",
        items: [],
        renderItem,
      }}
    />
  ),
};

export const EmptyWithAddNew: Story = {
  render: () => (
    <Wrapper
      args={{
        label: "Resource",
        placeholder: "Search resources...",
        items: [],
        renderItem,
        onAddNew: () => alert("Create new clicked"),
        addNewLabel: "New resource",
      }}
    />
  ),
};

export const CustomEmptyText: Story = {
  render: () => (
    <Wrapper
      args={{
        label: "Resource",
        placeholder: "Search resources...",
        items: [],
        renderItem,
        emptyText: "Nothing here yet. Create your first resource.",
      }}
    />
  ),
};

export const WithError: Story = {
  render: () => (
    <Wrapper
      args={{
        label: "Resource",
        placeholder: "Search resources...",
        items: sampleItems,
        renderItem,
        error: "Please select a resource",
      }}
    />
  ),
};

export const WithoutLabel: Story = {
  render: () => (
    <Wrapper
      args={{
        placeholder: "Search resources...",
        items: sampleItems,
        renderItem,
      }}
    />
  ),
};

export const CustomRecentLabel: Story = {
  render: () => (
    <Wrapper
      args={{
        label: "Resource",
        placeholder: "Search resources...",
        items: sampleItems,
        renderItem,
        recentLabel: "All resources",
      }}
    />
  ),
};
