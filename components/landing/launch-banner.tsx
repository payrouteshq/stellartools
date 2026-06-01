"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { useCookieState } from "@/hooks/use-cookie-state";
import { appendToGoogleSheet } from "@/integrations/google-sheet";
import { execute } from "@/lib/action-handler";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Rocket, X } from "lucide-react";
import * as RHF from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  email: z.email(),
});

type FormValues = z.infer<typeof schema>;

export function LaunchBanner() {
  const [dismissed, setDismissed] = useCookieState("launch_banner_dismissed", false);
  const [visible, setVisible] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const form = RHF.useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  React.useEffect(() => {
    if (!dismissed) {
      const t = setTimeout(() => setVisible(true), 80);
      return () => clearTimeout(t);
    }
  }, [dismissed]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => setDismissed(true), 400);
  };

  const { mutate: submitEmail, isPending } = useMutation({
    mutationFn: (data: FormValues) =>
      execute(
        appendToGoogleSheet(process.env.NEXT_PUBLIC_LEADS_SHEET_ID!, "A1:B1", [[data.email, new Date().toISOString()]])
      ),
    onSuccess: () => {
      form.reset();
      setTimeout(() => {
        setSubmitted(true);
        setVisible(false);
        setTimeout(() => setDismissed(true), 400);
      }, 2500);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (dismissed) return null;

  return (
    <div
      className="overflow-hidden transition-all duration-500 ease-out"
      style={{ maxHeight: visible ? 56 : 0, opacity: visible ? 1 : 0 }}
    >
      <div className="bg-primary text-primary-foreground flex h-14 items-center gap-4 px-4 sm:px-6">
        <Rocket className="size-3.5 shrink-0" />

        <div className="flex flex-1 items-center gap-3">
          {submitted ? (
            <p className="text-sm font-medium">You&apos;re on the list — we&apos;ll be in touch. 🎉</p>
          ) : showForm ? (
            <form onSubmit={form.handleSubmit((data) => submitEmail(data))} className="flex flex-1 items-start gap-2">
              <div className="flex flex-1 flex-col">
                <RHF.Controller
                  control={form.control}
                  name="email"
                  render={({ field, fieldState: { error } }) => (
                    <Input
                      {...field}
                      type="email"
                      autoFocus
                      placeholder="your@email.com"
                      aria-invalid={!!error}
                      className="border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/50 focus-visible:border-primary-foreground/60 focus-visible:ring-primary-foreground/20 h-8 max-w-xs"
                    />
                  )}
                />
              </div>
              <Button
                type="submit"
                size="sm"
                isLoading={isPending}
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 h-8 shrink-0"
              >
                Notify me
              </Button>
            </form>
          ) : (
            <div className="flex flex-1 items-center justify-between gap-4">
              <p className="text-sm opacity-90">Mainnet is coming</p>
              <Button
                size="sm"
                onClick={() => setShowForm(true)}
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 h-7 shrink-0 px-3 text-xs"
              >
                Get early access
              </Button>
            </div>
          )}
        </div>

        {!submitted && (
          <button onClick={handleDismiss} className="shrink-0 opacity-70 transition-opacity hover:opacity-100">
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
