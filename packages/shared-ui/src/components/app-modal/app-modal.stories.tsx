import { AppModal, AppModalProvider, Button } from "@stellartools/shared-ui";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "Components/AppModal",
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <AppModalProvider>
        <Story />
      </AppModalProvider>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const lorem =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.";

export const Small: Story = {
  render: () => (
    <Button
      onClick={() =>
        AppModal.open({
          title: "Small modal",
          description: "A compact dialog for confirmations or short forms.",
          content: <p className="text-muted-foreground">{lorem}</p>,
          size: "small",
          showCloseButton: true,
          primaryButton: { children: "Confirm", onClick: () => AppModal.close() },
          secondaryButton: { children: "Cancel", onClick: () => AppModal.close() },
        })
      }
    >
      Open small modal
    </Button>
  ),
};

export const Medium: Story = {
  render: () => (
    <Button
      onClick={() =>
        AppModal.open({
          title: "Medium modal",
          description: "Use this for forms or content that need more width.",
          content: (
            <div className="space-y-4">
              <p className="text-muted-foreground">{lorem}</p>
              <p className="text-muted-foreground">{lorem}</p>
            </div>
          ),
          size: "medium",
          showCloseButton: true,
          primaryButton: { children: "Save", onClick: () => AppModal.close() },
          secondaryButton: { children: "Cancel", onClick: () => AppModal.close() },
        })
      }
    >
      Open medium modal
    </Button>
  ),
};

export const Full: Story = {
  render: () => (
    <Button
      onClick={() =>
        AppModal.open({
          title: "Full screen modal",
          description: "This modal fills the entire viewport. Use for long forms or multi-step flows.",
          content: (
            <div className="space-y-6">
              <p className="text-muted-foreground">{lorem}</p>
              <p className="text-muted-foreground">{lorem}</p>
              <p className="text-muted-foreground">{lorem}</p>
            </div>
          ),
          size: "full",
          showCloseButton: true,
          primaryButton: { children: "Done", onClick: () => AppModal.close() },
          secondaryButton: { children: "Cancel", onClick: () => AppModal.close() },
        })
      }
    >
      Open full-screen modal
    </Button>
  ),
};

export const CustomFooter: Story = {
  render: () => (
    <Button
      onClick={() =>
        AppModal.open({
          title: "Custom footer",
          description: "You can pass a custom footer element.",
          content: <p className="text-muted-foreground">{lorem}</p>,
          size: "small",
          footer: (
            <div className="flex w-full items-center justify-between">
              <span className="text-muted-foreground text-sm">Optional helper text</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => AppModal.close()}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => AppModal.close()}>
                  Submit
                </Button>
              </div>
            </div>
          ),
        })
      }
    >
      Open with custom footer
    </Button>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Button
      variant="destructive"
      onClick={() =>
        AppModal.open({
          title: "Delete item?",
          description: "This action cannot be undone.",
          content: (
            <p className="text-muted-foreground">
              You are about to permanently delete this item. All associated data will be removed.
            </p>
          ),
          size: "small",
          primaryButton: {
            children: "Delete",
            variant: "destructive",
            onClick: () => AppModal.close(),
          },
          secondaryButton: { children: "Cancel", onClick: () => AppModal.close() },
        })
      }
    >
      Open delete confirmation
    </Button>
  ),
};

export const NoCloseButton: Story = {
  render: () => (
    <Button
      variant="outline"
      onClick={() =>
        AppModal.open({
          title: "Required action",
          description: "This modal has no X button; user must use Cancel or Confirm.",
          content: <p className="text-muted-foreground">{lorem}</p>,
          size: "small",
          showCloseButton: false,
          primaryButton: { children: "Confirm", onClick: () => AppModal.close() },
          secondaryButton: { children: "Cancel", onClick: () => AppModal.close() },
        })
      }
    >
      Open (no X button)
    </Button>
  ),
};
