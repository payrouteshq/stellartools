"use client";

import React from "react";

import { type ChatFeedback, type DemoChatMessage, useCopyMessage } from "@/components/adapter-demo/chat-ui";
import { DemoChatPanel } from "@/components/adapter-demo/demo-chat-panel";
import { DemoPageHeader } from "@/components/adapter-demo/demo-page-header";
import { capture } from "@/lib/posthog";
import { MessageSquareIcon } from "lucide-react";

export default function LangChainPage() {
  const [messages, setMessages] = React.useState<DemoChatMessage[]>([]);
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [feedback, setFeedback] = React.useState<ChatFeedback>(null);
  const [loading, setLoading] = React.useState(false);
  const { copiedId, copy } = useCopyMessage();

  const status = loading ? ("submitted" as const) : ("ready" as const);
  const isStreaming = loading;
  const showTypingShimmer = loading;

  const handleSubmit = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: DemoChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setFeedback(null);
    setLoading(true);
    capture("playground_message_sent", {
      adapter: "langchain",
      customer_email_set: !!customerEmail,
      message_length: text.length,
    });

    try {
      const res = await fetch("/api/langchain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, customerEmail }),
      });
      const json = (await res.json()) as { content?: unknown; error?: string; blocked?: boolean };

      if (res.status === 403 || json.blocked) {
        setFeedback({ blocked: true, message: json.error ?? "Subscription required" });
        capture("playground_message_blocked", { adapter: "langchain" });
        return;
      }

      if (!res.ok) {
        setFeedback({ blocked: false, message: json.error ?? "Something went wrong." });
        capture("playground_message_error", { adapter: "langchain" });
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: typeof json.content === "string" ? json.content : JSON.stringify(json.content, null, 2),
        },
      ]);
    } catch {
      setFeedback({ blocked: false, message: "Request failed. Check your API configuration." });
      capture("playground_message_error", { adapter: "langchain" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-112px)] flex-col gap-4">
      <DemoPageHeader
        iconSrc="/images/integrations/langchain.png"
        iconAlt="LangChain"
        title="LangChain"
        customerEmail={customerEmail}
        onCustomerEmailChange={setCustomerEmail}
      />

      <DemoChatPanel
        messages={messages}
        feedback={feedback}
        isStreaming={isStreaming}
        showTypingShimmer={showTypingShimmer}
        status={status}
        copiedId={copiedId}
        onCopy={copy}
        onSubmit={handleSubmit}
        emptyState={{
          icon: <MessageSquareIcon className="size-6" />,
          title: "LangChain Adapter",
          description: "Enter a customer email and send a message to test the subscription gate.",
        }}
      />
    </div>
  );
}
