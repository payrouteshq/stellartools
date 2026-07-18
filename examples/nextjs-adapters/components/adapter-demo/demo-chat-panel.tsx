"use client";

import type { ReactNode } from "react";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import type { ChatStatus } from "ai";

import { type ChatFeedback, type DemoChatMessage, DemoChatMessages } from "./chat-ui";

type DemoChatPanelProps = {
  messages: DemoChatMessage[];
  feedback: ChatFeedback;
  isStreaming: boolean;
  showTypingShimmer: boolean;
  status: ChatStatus;
  copiedId: string | null;
  onCopy: (messageId: string, text: string) => void;
  onSubmit: (text: string) => void;
  onStop?: () => void;
  inputPlaceholder?: string;
  emptyState: {
    icon: ReactNode;
    title: string;
    description: string;
  };
};

export function DemoChatPanel({
  messages,
  feedback,
  isStreaming,
  showTypingShimmer,
  status,
  copiedId,
  onCopy,
  onSubmit,
  onStop,
  inputPlaceholder = "Ask anything…",
  emptyState,
}: DemoChatPanelProps) {
  const showEmpty = messages.length === 0 && !feedback;

  return (
    <div className="border-border flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent>
          {showEmpty ? (
            <ConversationEmptyState
              icon={emptyState.icon}
              title={emptyState.title}
              description={emptyState.description}
            />
          ) : (
            <DemoChatMessages
              messages={messages}
              feedback={feedback}
              isStreaming={isStreaming}
              showTypingShimmer={showTypingShimmer}
              copiedId={copiedId}
              onCopy={onCopy}
            />
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-border border-t p-3">
        <PromptInput onSubmit={({ text }) => onSubmit(text)}>
          <PromptInputBody>
            <PromptInputTextarea placeholder={inputPlaceholder} />
          </PromptInputBody>
          <PromptInputFooter className="px-1 pb-1">
            <PromptInputSubmit
              status={status}
              onStop={onStop}
              className="bg-foreground text-background hover:bg-foreground/90 rounded-lg"
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
