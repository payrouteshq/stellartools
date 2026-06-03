"use client";

import * as React from "react";

import { sendBookCallEmail } from "@/actions/email";
import { AuroraBackground } from "@/components/aurora-background";
import { FooterSection } from "@/components/landing/footer-section";
import { TextAreaField, TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/navbar";
import { useAction } from "@/hooks/use-action";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import * as RHF from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Please enter a valid email"),
  message: z.string().min(10, "Please tell us a bit more (at least 10 characters)"),
});

type FormValues = z.infer<typeof schema>;

export default function BookCallPage() {
  const [submitted, setSubmitted] = React.useState(false);

  const form = RHF.useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", message: "" },
  });

  const { mutate: sendBookCallEmailAction, isPending: isSendingBookCallEmail } = useAction(sendBookCallEmail, {
    onSuccess: () => {
      setSubmitted(true);
      form.reset();
    },
  });

  return (
    <AuroraBackground className="bg-background min-h-screen scroll-smooth">
      <Header />

      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-lg flex-col justify-center px-6 py-20">
        {submitted ? (
          <div className="text-center">
            <div className="bg-primary/10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full">
              <svg
                className="text-primary size-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-foreground mb-2 text-2xl font-bold">We&apos;ll be in touch</h2>
            <p className="text-muted-foreground mb-8 text-base leading-relaxed">
              Thanks for reaching out. We&apos;ll review your message and get back to you shortly.
            </p>
            <Button variant="outline" onClick={() => setSubmitted(false)}>
              Send another message
            </Button>
          </div>
        ) : (
          <>
            <Link
              href={process.env.NEXT_PUBLIC_APP_URL!}
              className="text-muted-foreground hover:text-foreground mb-10 flex w-fit items-center gap-1.5 text-sm no-underline transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </Link>

            <div className="mb-10">
              <h1 className="text-foreground mb-3 text-4xl font-bold tracking-tight">Let&apos;s talk</h1>
              <p className="text-muted-foreground text-base leading-relaxed">
                Whether it&apos;s a feature request, integration idea, or you just want to chat — drop us a note and
                we&apos;ll get back to you.
              </p>
            </div>

            <form onSubmit={form.handleSubmit((data) => sendBookCallEmailAction(data))} className="flex flex-col gap-5">
              <RHF.Controller
                control={form.control}
                name="name"
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    id="name"
                    label="Name"
                    placeholder="Jane Smith"
                    error={error?.message ?? null}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />

              <RHF.Controller
                control={form.control}
                name="email"
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    id="email"
                    type="email"
                    label="Email"
                    placeholder="you@company.com"
                    error={error?.message ?? null}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />

              <RHF.Controller
                control={form.control}
                name="message"
                render={({ field, fieldState: { error } }) => (
                  <TextAreaField
                    id="message"
                    label="Tell us more"
                    placeholder="What would you like to discuss?"
                    error={error?.message ?? null}
                    value={field.value}
                    onChange={field.onChange}
                    rows={5}
                  />
                )}
              />

              <Button
                type="submit"
                disabled={isSendingBookCallEmail}
                isLoading={isSendingBookCallEmail}
                className="bg-primary text-primary-foreground mt-1 w-full"
              >
                Send message →
              </Button>
            </form>
          </>
        )}
      </div>

      <FooterSection />
    </AuroraBackground>
  );
}
