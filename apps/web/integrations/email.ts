import "server-only";

import { Resend as ResendClient } from "resend";

type SendEmailOptions = {
  cc?: string[];
  replyTo?: string;
  scheduledAt?: string;
};

export const sendEmail = async (
  email: string,
  subject: string,
  content: string | React.ReactNode,
  options?: SendEmailOptions
) => {
  const resend = new ResendClient(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: email,
    subject,
    ...(typeof content === "string" ? { text: content } : { react: content }),
    ...(options?.cc && { cc: options.cc }),
    ...(options?.replyTo && { reply_to: options.replyTo }),
    ...(options?.scheduledAt && { scheduledAt: options.scheduledAt }),
  });
  return result;
};
