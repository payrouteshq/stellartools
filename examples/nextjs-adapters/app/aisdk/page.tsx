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
import { useChat } from "@ai-sdk/react";
import { TextField } from "@stellartools/shared-ui";
import { CopyIcon, LockIcon, MessageSquareIcon } from "lucide-react";
import Image from "next/image";

export default function AiSdkPage() {
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [shieldBlocked, setShieldBlocked] = React.useState(false);

  const { messages, status, append, stop } = useChat({
    api: "/api/chat",
    onError: () => setShieldBlocked(true),
    onResponse: () => setShieldBlocked(false),
  });

  const handleSubmit = ({ text }: { text: string }) => {
    if (!text.trim()) return;
    setShieldBlocked(false);
    append({ role: "user", content: text }, { body: { customerEmail } });
  };

  const isStreaming = status === "streaming" || status === "submitted";
  const visibleMessages = messages.filter((m) => m.role === "user" || m.role === "assistant");

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
            {visibleMessages.length === 0 && !shieldBlocked ? (
              <ConversationEmptyState
                icon={<MessageSquareIcon className="size-6" />}
                title="AI SDK Adapter"
                description="Enter a customer email and send a message to test the subscription gate."
              />
            ) : (
              <>
                {visibleMessages.map((message, i) => (
                  <Message key={message.id} from={message.role as "user" | "assistant"}>
                    <MessageContent>
                      {message.parts?.map((part, j) =>
                        part.type === "text" ? <MessageResponse key={j}>{part.text}</MessageResponse> : null
                      ) ?? <MessageResponse>{message.content}</MessageResponse>}
                    </MessageContent>
                    {message.role === "assistant" && i === visibleMessages.length - 1 && !isStreaming && (
                      <MessageActions>
                        <MessageAction
                          tooltip="Copy"
                          onClick={() =>
                            navigator.clipboard.writeText(
                              message.parts
                                ?.filter((p) => p.type === "text")
                                .map((p) => (p as any).text)
                                .join("") ?? message.content
                            )
                          }
                        >
                          <CopyIcon className="size-3.5" />
                        </MessageAction>
                      </MessageActions>
                    )}
                  </Message>
                ))}
                {shieldBlocked && <ShieldCta />}
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
            <PromptInputFooter>
              <PromptInputSubmit status={status} onStop={stop} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
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
            href="https://stellartools.dev/pricing"
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
