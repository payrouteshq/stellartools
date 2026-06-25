export type SendType = "transactional" | "event";

export const EMAIL_TYPE_PREFIX = {
  TRANSACTIONAL: "A",
  WORKFLOW: "B",
} as const;

export type ActivityStats = {
  totalSent: number;
  transactionalCount: number;
  eventCount: number;
  logs: { id: string; email: string; eventType: string; sendType: SendType; emailConfig: string; sentAt: string }[];
};

export type EmailOption = { value: string; label: string };
export type MailingList = { id: string; name: string };
