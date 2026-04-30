"use server";

import { sendEmail } from "@/integrations/email";

export const sendBookCallEmail = async (data: { name: string; email: string; message: string }) => {
  return await sendEmail(
    "odii@stellartools.dev",
    `Book a call: ${data.name}`,
    `Name: ${data.name}\nEmail: ${data.email}\nMessage:\n${data.message}`,
    { cc: ["emmanuelodii80@gmail.com"], replyTo: data.email }
  );
};
