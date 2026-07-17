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
import { TextField } from "@stellartools/shared-ui";
import { CopyIcon, LockIcon, MessageSquareIcon } from "lucide-react";
import Image from "next/image";

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  cta?: boolean;
};

export default function LangChainPage() {
  const [messages, setMessages] = React.useState<ChatMsg[]>([]);
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const isFirstMessage = messages.length === 0;
  const status = loading ? ("submitted" as const) : ("ready" as const);

  const handleSubmit = async ({ text }: { text: string }) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/langchain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, customerEmail, free: isFirstMessage }),
      });
      const json = await res.json();

      if (res.status === 403 || json.blocked) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: json.error ?? "Subscription required", cta: true },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: typeof json.content === "string" ? json.content : JSON.stringify(json.content, null, 2),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: "Request failed. Check your API configuration." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-112px)] flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <Image
            src="/images/integrations/langchain.png"
            alt="LangChain"
            width={26}
            height={26}
            className="rounded-lg object-contain"
          />
          <h1 className="text-xl font-semibold tracking-tight">LangChain</h1>
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
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<MessageSquareIcon className="size-6" />}
                title="LangChain Adapter"
                description="First message is free. Add a customer email to test the subscription gate on the next message."
              />
            ) : (
              messages.map((msg, i) => (
                <Message key={msg.id} from={msg.role}>
                  <MessageContent>
                    {msg.cta ? <SubscribeCta /> : <MessageResponse>{msg.content}</MessageResponse>}
                  </MessageContent>
                  {msg.role === "assistant" && !msg.cta && i === messages.length - 1 && !loading && (
                    <MessageActions>
                      <MessageAction tooltip="Copy" onClick={() => navigator.clipboard.writeText(msg.content)}>
                        <CopyIcon className="size-3.5" />
                      </MessageAction>
                    </MessageActions>
                  )}
                </Message>
              ))
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="border-border border-t p-3">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputBody>
              <PromptInputTextarea placeholder={isFirstMessage ? "First message is free…" : "Ask anything…"} />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputSubmit status={status} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}

function SubscribeCta() {
  return (
    <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
      <LockIcon className="size-3.5 shrink-0" />
      Subscription required.{" "}
      <a
        href="https://stellartools.dev/pricing"
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground underline underline-offset-2"
      >
        Subscribe to continue
      </a>
    </p>
  );
}
