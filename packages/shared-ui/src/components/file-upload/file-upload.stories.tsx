import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react";

import type { FileWithPreview } from "./file-upload";
import { FileUpload } from "./file-upload";

function createNonImageFile(name: string, type: string): FileWithPreview {
  const file = new File([], name, { type });
  return Object.assign(file, { preview: "#" });
}

const FileUploadWithState = (args: any) => {
  const [value, setValue] = useState<FileWithPreview[]>(args.value ?? []);
  return (
    <div className="w-full max-w-md min-w-[400px]">
      <FileUpload
        value={value}
        onFilesChange={setValue}
        onFilesRejected={args.onFilesRejected}
        label={args.label}
        error={args.error}
        description={args.description}
        placeholder={args.placeholder}
        disabled={args.disabled}
        enableTransformation={args.enableTransformation}
        targetFormat={args.targetFormat}
        dropzoneMultiple={args.dropzoneMultiple}
        dropzoneAccept={args.dropzoneAccept}
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
    placeholder: undefined,
    shape: "circle",
    dropzoneAccept: { "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"] },
    dropzoneMaxSize: 5 * 1024 * 1024,
    dropzoneMultiple: false,
    enableTransformation: true,
    targetFormat: "image/png",
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
