import type { Meta, StoryObj } from "@storybook/react";

import { Markdown } from "./markdown";

const meta = {
  title: "Components/Markdown",
  component: Markdown,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    content: {
      control: "text",
    },
  },
} satisfies Meta<typeof Markdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: "Hello, this is **markdown** content with _emphasis_.",
  },
};

export const WithHeadings: Story = {
  args: {
    content: `# Heading 1
## Heading 2
### Heading 3

A paragraph after headings.`,
  },
};

export const WithList: Story = {
  args: {
    content: `- Item one
- Item two
- Item three

1. First
2. Second
3. Third`,
  },
};

export const WithCodeBlock: Story = {
  args: {
    content: `\`\`\`typescript
function greet(name: string) {
  return \`Hello, \${name}!\`;
}
\`\`\``,
  },
};

export const WithInlineCode: Story = {
  args: {
    content: "Use the `npm install` command to install dependencies.",
  },
};

export const WithTable: Story = {
  args: {
    content: `| Name   | Value |
|--------|-------|
| Alpha  | 1     |
| Beta   | 2     |
| Gamma  | 3     |`,
  },
};

export const WithBlockquote: Story = {
  args: {
    content: `> This is a blockquote.
> It can span multiple lines.`,
  },
};

export const WithLinks: Story = {
  args: {
    content: `[Internal link](#section) and [external link](https://example.com).`,
  },
};

export const WithHorizontalRule: Story = {
  args: {
    content: `Section one

---

Section two`,
  },
};

export const Combined: Story = {
  args: {
    content: `# Markdown

Renders **markdown** with GFM, tables, and code blocks.

## Features

- Headings
- **Bold** and _italic_
- \`inline code\`
- [Links](https://example.com)

## Code

\`\`\`js
console.log("Hello");
\`\`\`

> Blockquotes are supported.`,
  },
};
