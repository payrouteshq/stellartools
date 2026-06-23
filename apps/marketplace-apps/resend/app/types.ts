export type EmailStats = {
  totalSent: number;
  deliveredRate: string;
  bounceRate: string;
  daily: { day: number; sent: number }[];
  emails: { id: string; to: string; subject: string; status: string; sentAt: string }[];
};
