export type SendType = "transactional" | "event";

export type ActivityStats = {
  totalSent: number;
  transactionalCount: number;
  eventCount: number;
  logs: { id: string; email: string; eventType: string; sendType: SendType; templateId: string; sentAt: string }[];
};

export type EmailOption = { value: string; label: string };
export type MailingList = { id: string; name: string };
