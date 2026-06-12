"use client";

import * as React from "react";

import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { MixinProps, splitProps } from "../../lib/mixin";
import { cn } from "../../lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { CodeBlock } from "../code-block";

export interface MarkdownProps
  extends
    Omit<React.ComponentProps<typeof ReactMarkdown>, "components" | "remarkPlugins" | "rehypePlugins">,
    MixinProps<"container", Omit<React.ComponentProps<"div">, "children">>,
    MixinProps<"codeBlock", Omit<React.ComponentProps<typeof CodeBlock>, "children">> {
  content: string;
}

export const Markdown = ({ content, ...mixProps }: MarkdownProps) => {
  const { container, codeBlock, rest } = splitProps(mixProps, "container", "codeBlock");

  return (
    <div className={cn("prose prose-neutral dark:prose-invert max-w-none", container.className)}>
      <ReactMarkdown
        {...rest}
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={{
          code({
            inline,
            className,
            children,
            ...props
          }: {
            inline?: boolean;
            className?: string;
            children?: React.ReactNode;
            [key: string]: any;
          }) {
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "text";

            if (inline) {
              return (
                <code className="bg-muted rounded-md px-1.5 py-0.5 font-mono text-sm" {...props}>
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock {...codeBlock} language={language} showCopyButton={true} maxHeight="none" className="my-4">
                {String(children).replace(/\n$/, "")}
              </CodeBlock>
            );
          },

          table: ({ children }: { children?: React.ReactNode }) => <Table>{children}</Table>,
          thead: ({ children }: { children?: React.ReactNode }) => <TableHeader>{children}</TableHeader>,
          tbody: ({ children }: { children?: React.ReactNode }) => <TableBody>{children}</TableBody>,
          tr: ({ children }: { children?: React.ReactNode }) => <TableRow>{children}</TableRow>,
          th: ({ children }: { children?: React.ReactNode }) => <TableHead>{children}</TableHead>,
          td: ({ children }: { children?: React.ReactNode }) => <TableCell>{children}</TableCell>,
          // Responsive Images (using img for markdown compatibility)
          img: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img {...props} className="mx-auto rounded-xl border shadow-sm" loading="lazy" alt={alt || ""} />
          ),
          // Custom Link handling (external links open in new tab)
          a: ({ children, href, ...props }: { children?: React.ReactNode; href?: string; [key: string]: any }) => {
            const isExternal = href?.startsWith("http");
            return (
              <a
                href={href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className="text-primary font-medium no-underline hover:underline"
                {...props}
              >
                {children}
              </a>
            );
          },
          // Blockquotes
          blockquote: ({ children }: { children?: React.ReactNode }) => (
            <blockquote className="border-primary text-muted-foreground border-l-2 pl-4 italic">{children}</blockquote>
          ),
          hr: () => <hr className="border-border my-6" />,
          ul: ({ children }: { children?: React.ReactNode }) => (
            <ul className="my-4 ml-6 list-disc space-y-2">{children}</ul>
          ),
          ol: ({ children }: { children?: React.ReactNode }) => (
            <ol className="my-4 ml-6 list-decimal space-y-2">{children}</ol>
          ),
          li: ({ children }: { children?: React.ReactNode }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }: { children?: React.ReactNode }) => (
            <h1 className="mt-6 mb-4 text-4xl font-bold">{children}</h1>
          ),
          h2: ({ children }: { children?: React.ReactNode }) => (
            <h2 className="mt-5 mb-3 text-3xl font-semibold">{children}</h2>
          ),
          h3: ({ children }: { children?: React.ReactNode }) => (
            <h3 className="mt-4 mb-3 text-2xl font-semibold">{children}</h3>
          ),
          h4: ({ children }: { children?: React.ReactNode }) => (
            <h4 className="mt-3 mb-2 text-xl font-semibold">{children}</h4>
          ),
          h5: ({ children }: { children?: React.ReactNode }) => (
            <h5 className="mt-3 mb-2 text-lg font-semibold">{children}</h5>
          ),
          h6: ({ children }: { children?: React.ReactNode }) => (
            <h6 className="mt-3 mb-2 text-base font-semibold">{children}</h6>
          ),
          p: ({ children }: { children?: React.ReactNode }) => <p className="mb-4 leading-relaxed">{children}</p>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
