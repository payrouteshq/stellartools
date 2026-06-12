import type { Meta, StoryObj } from "@storybook/react";

import { CodeBlock } from "./code-block";

const sampleTsx = `export function Button({ children }: { children: React.ReactNode }) {
  return (
    <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
      {children}
    </button>
  );
}`;

const sampleTypescript = `interface User {
  id: string;
  email: string;
  createdAt: Date;
}

async function fetchUser(id: string): Promise<User> {
  const res = await fetch(\`/api/users/\${id}\`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}`;

const sampleJson = `{
  "name": "my-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build"
  }
}`;

const sampleBash = `# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build`;

const longCode = `// A longer file to demonstrate scrolling
import * as React from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = React.useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(error);
    }
  };

  return [storedValue, setValue] as const;
}`;

const meta = {
  title: "Components/CodeBlock",
  component: CodeBlock,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    language: {
      control: "select",
      options: ["tsx", "typescript", "json", "bash", "shell", "sh", "zsh"],
    },
    filename: {
      control: "text",
    },
    showCopyButton: {
      control: "boolean",
    },
    maxHeight: {
      control: "text",
    },
  },
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    language: "tsx",
    children: sampleTsx,
  },
};

export const WithFilename: Story = {
  args: {
    language: "tsx",
    children: sampleTsx,
    filename: "components/Button.tsx",
  },
};

export const WithLogo: Story = {
  args: {
    language: "tsx",
    children: sampleTsx,
    filename: "Button.tsx",
    logo: "/images/logo-light.png",
  },
};

export const TypeScript: Story = {
  args: {
    language: "typescript",
    children: sampleTypescript,
    filename: "lib/user.ts",
  },
};

export const JSON: Story = {
  args: {
    language: "json",
    children: sampleJson,
    filename: "package.json",
  },
};

export const Bash: Story = {
  args: {
    language: "bash",
    children: sampleBash,
  },
};

export const ShellWithFilename: Story = {
  args: {
    language: "shell",
    children: sampleBash,
    filename: "scripts/setup.sh",
  },
};

export const NoCopyButton: Story = {
  args: {
    language: "tsx",
    children: sampleTsx,
    filename: "example.tsx",
    showCopyButton: false,
  },
};

export const MaxHeight: Story = {
  args: {
    language: "typescript",
    children: longCode,
    filename: "useLocalStorage.ts",
    maxHeight: "200px",
  },
};

export const LongCode: Story = {
  args: {
    language: "tsx",
    children: longCode,
    filename: "hooks/use-local-storage.tsx",
  },
};

export const MinimalCode: Story = {
  args: {
    language: "tsx",
    children: "const x = 1;",
  },
};
