"use client";

import React from "react";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { CustomerEmailHelpText } from "@/components/customer-email-help-text";
import { useChat, type Message as ChatMessage } from "@ai-sdk/react";
import { TextField } from "@stellartools/shared-ui";
import { CheckIcon, CopyIcon, LockIcon, MessageSquareIcon } from "lucide-react";
import Image from "next/image";

type StreamFeedback = { blocked: boolean; message: string } | null;

function getMessageText(message: ChatMessage): string {
  if (message.parts?.length) {
    return message.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("");
  }

  return typeof message.content === "string" ? message.content : "";
}

function parseStreamError(message: string): { blocked: boolean; message: string } {
  const blocked = message.includes("Access Denied") || message.includes("does not have an active subscription");
  return { blocked, message: blocked ? "Subscription required" : message };
}

export default function AiSdkPage() {
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [feedback, setFeedback] = React.useState<StreamFeedback>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const { messages, status, append, stop } = useChat({
    api: "/api/chat",
    streamProtocol: "text",
    onResponse: async (response) => {
      if (response.ok) {
        setFeedback(null);
        return;
      }

      const body = (await response
        .clone()
        .json()
        .catch(() => null)) as {
        error?: string;
        blocked?: boolean;
      } | null;
      setFeedback({
        blocked: body?.blocked === true || response.status === 403,
        message: body?.error ?? response.statusText,
      });
    },
    onError: (error) => {
      try {
        const parsed = JSON.parse(error.message) as { blocked?: boolean; error?: string };
        setFeedback({
          blocked: parsed.blocked === true,
          message: parsed.error ?? error.message,
        });
      } catch {
        setFeedback(parseStreamError(error.message));
      }
    },
  });

  const handleSubmit = ({ text }: { text: string }) => {
    if (!text.trim()) return;
    setFeedback(null);
    append({ role: "user", content: text }, { body: { customerEmail } });
  };

  const isStreaming = status === "streaming" || status === "submitted";
  const visibleMessages = messages.filter((m) => m.role === "user" || m.role === "assistant");
  const lastAssistantMessage = [...visibleMessages].reverse().find((m) => m.role === "assistant");
  const lastAssistantText = lastAssistantMessage ? getMessageText(lastAssistantMessage) : "";
  const showTypingShimmer = isStreaming && !lastAssistantText.trim();

  const handleCopy = async (messageId: string, text: string) => {
    if (!text.trim()) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      window.setTimeout(() => setCopiedId((current) => (current === messageId ? null : current)), 2000);
    } catch {
      // Clipboard can fail outside secure contexts.
    }
  };

  return (
    <div className="flex h-[calc(100vh-112px)] flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <Image
            src="/images/integrations/aisdk.jpg"
            alt="AI SDK"
            width={26}
            height={26}
            className="rounded-lg object-contain"
          />
          <h1 className="text-xl font-semibold tracking-tight">AI SDK</h1>
        </div>
        <TextField
          id="customer-email"
          label="Customer email"
          type="email"
          value={customerEmail}
          onChange={setCustomerEmail}
          placeholder="jane@example.com"
          helpText={<CustomerEmailHelpText />}
          className="max-w-md shadow-none"
          error={null}
        />
      </div>

      <div className="border-border flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
        <Conversation className="min-h-0 flex-1">
          <ConversationContent>
            {visibleMessages.length === 0 && !feedback ? (
              <ConversationEmptyState
                icon={<MessageSquareIcon className="size-6" />}
                title="AI SDK Adapter"
                description="Enter a customer email and send a message to test the subscription gate."
              />
            ) : (
              <>
                {visibleMessages.map((message, i) => {
                  const isLastAssistant = message.role === "assistant" && i === visibleMessages.length - 1;
                  const messageText = getMessageText(message);

                  return (
                  <Message key={message.id} from={message.role as "user" | "assistant"}>
                    <MessageContent>
                      {message.parts?.map((part, j) =>
                        part.type === "text" ? (
                          <MessageResponse key={j} isAnimating={isLastAssistant && status === "streaming"}>
                            {part.text}
                          </MessageResponse>
                        ) : null
                      ) ?? (
                        <MessageResponse isAnimating={isLastAssistant && status === "streaming"}>
                          {message.content}
                        </MessageResponse>
                      )}
                    </MessageContent>
                    {message.role === "assistant" &&
                      messageText.trim() &&
                      (!isLastAssistant || !isStreaming) && (
                      <MessageActions className="opacity-0 transition-opacity group-hover:opacity-100">
                        <MessageAction
                          tooltip={copiedId === message.id ? "Copied" : "Copy"}
                          className="text-muted-foreground hover:text-foreground size-7"
                          onClick={() => void handleCopy(message.id, messageText)}
                        >
                          {copiedId === message.id ? (
                            <CheckIcon className="size-3.5" />
                          ) : (
                            <CopyIcon className="size-3.5" />
                          )}
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
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-border border-t p-3">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputBody>
              <PromptInputTextarea placeholder="Ask anything…" />
            </PromptInputBody>
            <PromptInputFooter className="px-1 pb-1">
              <PromptInputSubmit
                status={status}
                onStop={stop}
                className="bg-foreground text-background hover:bg-foreground/90 rounded-lg"
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}

function TypingShimmer() {
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

function ServerMessage({ message }: { message: string }) {
  return (
    <Message from="assistant">
      <MessageContent>
        <p className="text-muted-foreground text-sm">{message}</p>
      </MessageContent>
    </Message>
  );
}

function ShieldCta() {
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
