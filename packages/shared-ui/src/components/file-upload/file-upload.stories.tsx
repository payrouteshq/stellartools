import * as React from "react";

import type { Meta, StoryObj } from "@storybook/react";

import { cn } from "../../lib/utils";
import { FileUpload, type FileWithPreview } from "./index";

function createNonImageFile(name: string, type: string): FileWithPreview {
  const file = new File([], name, { type });
  return Object.assign(file, { preview: "#" });
}

const FileUploadWithState = ({ value: initialValue, ...props }: React.ComponentProps<typeof FileUpload>) => {
  const [value, setValue] = React.useState<FileWithPreview[]>(initialValue ?? []);
  const isCircle = props.shape === "circle";

  return (
    <div className={isCircle ? "w-fit" : "w-full max-w-md min-w-[400px]"}>
      <FileUpload
        {...props}
        value={value}
        onFilesChange={setValue}
        className={cn(isCircle && "w-fit", props.className)}
      />
    </div>
  );
};

const meta = {
  title: "Components/FileUpload",
  component: FileUpload,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[480px]">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    label: {
      control: "text",
    },
    error: {
      control: "text",
    },
    description: {
      control: "text",
    },
    placeholder: {
      control: "text",
    },
    disabled: {
      control: "boolean",
    },
    enableTransformation: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof FileUpload>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FileUploadSquare: Story = {
  render: (args) => <FileUploadWithState {...args} />,
  args: {
    label: "Upload file",
    placeholder: "Drag & drop an image here, or click to select",
    shape: "square",
  },
};

export const FileUploadCircle: Story = {
  render: (args) => <FileUploadWithState {...args} />,
  args: {
    label: "Upload picture",
    placeholder: "",
    description: "",
    shape: "circle",
    className: "w-fit",
    dropzoneAccept: { "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"] },
    dropzoneMaxSize: 5 * 1024 * 1024,
    dropzoneMultiple: false,
    enableTransformation: true,
    targetFormat: "image/png",
    maxDimension: 1024,
  },
};

export const FileUploadSquareWithError: Story = {
  render: (args) => <FileUploadWithState {...args} />,
  args: {
    label: "Upload file",
    placeholder: "Drag & drop an image here, or click to select",
    error: "Please upload an image file",
    shape: "square",
  },
};

export const FileUploadSquareDisabled: Story = {
  render: (args) => <FileUploadWithState {...args} />,
  args: {
    label: "Upload file",
    placeholder: "Drag & drop an image here, or click to select",
    disabled: true,
    shape: "square",
  },
};

export const FileUploadSquareWithNonImageFile: Story = {
  render: (args) => <FileUploadWithState {...args} />,
  args: {
    label: "Upload file",
    placeholder: "Drag & drop an image here, or click to select",
    value: [createNonImageFile("document.pdf", "application/pdf")],
  },
};
