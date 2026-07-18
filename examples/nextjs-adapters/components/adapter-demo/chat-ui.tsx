"use client";

import React from "react";

import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { CheckIcon, CopyIcon, LockIcon } from "lucide-react";

export type ChatFeedback = { blocked: boolean; message: string } | null;

export type DemoChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts?: Array<{ type: string; text?: string }>;
};

export function parseStreamError(message: string): { blocked: boolean; message: string } {
  const blocked = message.includes("Access Denied") || message.includes("does not have an active subscription");
  return { blocked, message: blocked ? "Subscription required" : message };
}

export function getDemoMessageText(message: DemoChatMessage): string {
  if (message.parts?.length) {
    return message.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("");
  }

  return message.content;
}

export function useCopyMessage() {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const copy = React.useCallback(async (messageId: string, text: string) => {
    if (!text.trim()) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      window.setTimeout(() => setCopiedId((current) => (current === messageId ? null : current)), 2000);
    } catch {
      // Clipboard can fail outside secure contexts.
    }
  }, []);

  return { copiedId, copy };
}

export function TypingShimmer() {
  return (
    <Message from="assistant">
      <MessageContent>
        <div className="flex flex-col gap-2 py-0.5">
          <div className="bg-muted-foreground/15 h-2.5 w-44 animate-pulse rounded-full" />
          <div className="bg-muted-foreground/10 h-2.5 w-28 animate-pulse rounded-full [animation-delay:150ms]" />
        </div>
      </MessageContent>
    </Message>
  );
}

export function ServerMessage({ message }: { message: string }) {
  return (
    <Message from="assistant">
      <MessageContent>
        <p className="text-muted-foreground text-sm">{message}</p>
      </MessageContent>
    </Message>
  );
}

export function ShieldCta() {
  return (
    <Message from="assistant">
      <MessageContent>
        <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <LockIcon className="size-3.5 shrink-0" />
          Subscription required.{" "}
          <a
            href={process.env.NEXT_PUBLIC_STELLARTOOLS_PRODUCT_PERMALINK!}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-2"
          >
            Subscribe to continue
          </a>
        </p>
      </MessageContent>
    </Message>
  );
}

type DemoChatMessagesProps = {
  messages: DemoChatMessage[];
  feedback: ChatFeedback;
  isStreaming: boolean;
  showTypingShimmer: boolean;
  copiedId: string | null;
  onCopy: (messageId: string, text: string) => void;
};

export function DemoChatMessages({
  messages,
  feedback,
  isStreaming,
  showTypingShimmer,
  copiedId,
  onCopy,
}: DemoChatMessagesProps) {
  return (
    <>
      {messages.map((message, i) => {
        const isLastAssistant = message.role === "assistant" && i === messages.length - 1;
        const messageText = getDemoMessageText(message);

        return (
          <Message key={message.id} from={message.role}>
            <MessageContent>
              {message.parts?.length ? (
                message.parts.map((part, j) =>
                  part.type === "text" ? (
                    <MessageResponse key={j} isAnimating={isLastAssistant && isStreaming}>
                      {part.text}
                    </MessageResponse>
                  ) : null
                )
              ) : (
                <MessageResponse isAnimating={isLastAssistant && isStreaming}>{message.content}</MessageResponse>
              )}
            </MessageContent>
            {message.role === "assistant" && messageText.trim() && (!isLastAssistant || !isStreaming) && (
              <MessageActions className="opacity-0 transition-opacity group-hover:opacity-100">
                <MessageAction
                  tooltip={copiedId === message.id ? "Copied" : "Copy"}
                  className="text-muted-foreground hover:text-foreground size-7"
                  onClick={() => void onCopy(message.id, messageText)}
                >
                  {copiedId === message.id ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                </MessageAction>
              </MessageActions>
            )}
          </Message>
        );
      })}
      {showTypingShimmer && <TypingShimmer />}
      {feedback?.blocked && <ShieldCta />}
      {feedback && !feedback.blocked && <ServerMessage message={feedback.message} />}
    </>
  );
}
