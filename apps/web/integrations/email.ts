import "server-only";

import { Resend as ResendClient } from "resend";

const resend = new ResendClient(process.env.RESEND_API_KEY);

type SendEmailOptions = {
  cc?: string[];
  replyTo?: string;
};

export const sendEmail = async (
  email: string,
  subject: string,
  content: string | React.ReactNode,
  options?: SendEmailOptions
) => {
  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: email,
    subject,
    ...(typeof content === "string" ? { text: content } : { react: content }),
    ...(options?.cc && { cc: options.cc }),
    ...(options?.replyTo && { reply_to: options.replyTo }),
  });
  return result;
};
