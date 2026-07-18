"use client";

import React from "react";

import {
  type ChatFeedback,
  type DemoChatMessage,
  getDemoMessageText,
  parseStreamError,
  useCopyMessage,
} from "@/components/adapter-demo/chat-ui";
import { DemoChatPanel } from "@/components/adapter-demo/demo-chat-panel";
import { DemoPageHeader } from "@/components/adapter-demo/demo-page-header";
import { capture } from "@/lib/posthog";
import { useChat } from "@ai-sdk/react";
import { MessageSquareIcon } from "lucide-react";

export default function AiSdkPage() {
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [feedback, setFeedback] = React.useState<ChatFeedback>(null);
  const { copiedId, copy } = useCopyMessage();

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
      const blocked = body?.blocked === true || response.status === 403;
      setFeedback({ blocked, message: body?.error ?? response.statusText });
      capture(blocked ? "playground_message_blocked" : "playground_message_error", { adapter: "aisdk" });
    },
    onError: (error) => {
      try {
        const parsed = JSON.parse(error.message) as { blocked?: boolean; error?: string };
        const blocked = parsed.blocked === true;
        setFeedback({ blocked, message: parsed.error ?? error.message });
        capture(blocked ? "playground_message_blocked" : "playground_message_error", { adapter: "aisdk" });
      } catch {
        setFeedback(parseStreamError(error.message));
        capture("playground_message_error", { adapter: "aisdk" });
      }
    },
  });

  const handleSubmit = (text: string) => {
    if (!text.trim()) return;
    setFeedback(null);
    capture("playground_message_sent", {
      adapter: "aisdk",
      customer_email_set: !!customerEmail,
      message_length: text.length,
    });
    append({ role: "user", content: text }, { body: { customerEmail } });
  };

  const isStreaming = status === "streaming" || status === "submitted";
  const visibleMessages: DemoChatMessage[] = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : "",
      parts: m.parts,
    }));
  const lastAssistantMessage = [...visibleMessages].reverse().find((m) => m.role === "assistant");
  const lastAssistantText = lastAssistantMessage ? getDemoMessageText(lastAssistantMessage) : "";
  const showTypingShimmer = isStreaming && !lastAssistantText.trim();

  return (
    <div className="flex h-[calc(100vh-112px)] flex-col gap-4">
      <DemoPageHeader
        iconSrc="/images/integrations/aisdk.jpg"
        iconAlt="AI SDK"
        title="AI SDK"
        customerEmail={customerEmail}
        onCustomerEmailChange={setCustomerEmail}
      />

      <DemoChatPanel
        messages={visibleMessages}
        feedback={feedback}
        isStreaming={isStreaming}
        showTypingShimmer={showTypingShimmer}
        status={status}
        copiedId={copiedId}
        onCopy={copy}
        onSubmit={handleSubmit}
        onStop={stop}
        emptyState={{
          icon: <MessageSquareIcon className="size-6" />,
          title: "AI SDK Adapter",
          description: "Enter a customer email and send a message to test the subscription gate.",
        }}
      />
    </div>
  );
}
