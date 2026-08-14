import type { Meta, StoryObj } from "@storybook/react";

import { useState } from "react";

import { Button } from "../../ui/button";
import { AppModal, AppModalProvider } from "../app-modal/index";

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

const STEPS = [
  {
    key: "step-1",
    title: "Basic information",
    description: "Tell us a bit about your organization to get started.",
    body: "Enter your organization name, industry, and a short description. This helps us personalise your experience.",
  },
  {
    key: "step-2",
    title: "Contact details",
    description: "How should customers and teammates reach you?",
    body: "Add your support email, phone number, and physical address. These appear on invoices and payment pages.",
  },
  {
    key: "step-3",
    title: "You're all set",
    description: "Your workspace is ready.",
    body: "We've created your organization. You can now invite teammates, set up products, and start accepting payments.",
  },
];

const MultiStepContent = () => {
  const [index, setIndex] = useState(0);
  const step = STEPS[index]!;
  const isLast = index === STEPS.length - 1;

  const goNext = () => {
    if (isLast) {
      AppModal.close();
      return;
    }
    AppModal.updateConfig({
      title: step.title,
      description: step.description,
      stepKey: STEPS[index + 1]!.key,
      content: <StepBody text={STEPS[index + 1]!.body} />,
      footer: (
        <StepFooter
          step={index + 1}
          total={STEPS.length}
          isLast={index + 1 === STEPS.length - 1}
          onNext={() => {
            setIndex((i) => i + 1);
          }}
          onBack={() => {
            AppModal.updateConfig({
              title: STEPS[index]!.title,
              description: STEPS[index]!.description,
              stepKey: STEPS[index]!.key,
              stepDirection: "backward",
              content: <StepBody text={STEPS[index]!.body} />,
            });
            setIndex((i) => i - 1);
          }}
        />
      ),
    });
    setIndex((i) => i + 1);
  };

  const goBack = () => {
    if (index === 0) return;
    AppModal.updateConfig({
      title: STEPS[index - 1]!.title,
      description: STEPS[index - 1]!.description,
      stepKey: STEPS[index - 1]!.key,
      stepDirection: "backward",
      content: <StepBody text={STEPS[index - 1]!.body} />,
    });
    setIndex((i) => i - 1);
  };

  return (
    <div className="space-y-4">
      <StepBody text={step.body} />
      <StepFooter step={index} total={STEPS.length} isLast={isLast} onNext={goNext} onBack={goBack} />
    </div>
  );
};

const StepBody = ({ text }: { text: string }) => (
  <p className="text-muted-foreground leading-relaxed">{text}</p>
);

const StepFooter = ({
  step,
  total,
  isLast,
  onNext,
  onBack,
}: {
  step: number;
  total: number;
  isLast: boolean;
  onNext: () => void;
  onBack: () => void;
}) => (
  <div className="flex w-full items-center justify-between">
    <span className="text-muted-foreground text-sm">
      Step {step + 1} of {total}
    </span>
    <div className="flex gap-2">
      {step > 0 && (
        <Button variant="outline" size="sm" onClick={onBack}>
          Back
        </Button>
      )}
      <Button size="sm" onClick={onNext}>
        {isLast ? "Finish" : "Continue →"}
      </Button>
    </div>
  </div>
);

export const MultiStep: Story = {
  render: () => (
    <Button
      onClick={() => {
        const first = STEPS[0]!;
        AppModal.open({
          title: first.title,
          description: first.description,
          stepKey: first.key,
          content: <MultiStepContent />,
          size: "medium",
          showCloseButton: true,
        });
      }}
    >
      Open multi-step modal
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
