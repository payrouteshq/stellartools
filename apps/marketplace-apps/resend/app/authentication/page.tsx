"use client";

import { Suspense } from "react";

import { validateApiKeyAndConnect } from "@/app/actions/resend";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, TextAreaField } from "@stellartools/shared-ui";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  resendApiKey: z.string().min(1, "API key is required").regex(/^re_/, "API key must start with re_"),
});

type FormData = z.infer<typeof schema>;

function AuthenticationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appToken = searchParams.get("st_token");

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { resendApiKey: "" },
  });

  const { isSubmitting } = form.formState;

  const onSubmit = async (data: FormData) => {
    if (!appToken) {
      form.setError("resendApiKey", { message: "App token not found" });
      return;
    }

    const validation = await validateApiKeyAndConnect(data.resendApiKey, appToken, {
      fromEmail: undefined,
    });

    if (validation !== true) {
      form.setError("resendApiKey", { message: validation });
      return;
    }

    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";

    router.push(`/dashboard${qs}`);
  };

  return (
    <div className="bg-background min-h-screen px-5">
      <section className="mx-auto flex w-full max-w-md flex-col gap-6 py-8">
        <div className="space-y-1">
          <h2 className="text-base font-medium">Connect your account</h2>
          <p className="text-muted-foreground text-sm">Add your Resend API key to start sending emails.</p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <Controller
            control={form.control}
            name="resendApiKey"
            render={({ field, fieldState }) => (
              <TextAreaField
                {...field}
                id="api-key"
                label="API key"
                placeholder="re_..."
                error={fieldState.error?.message ?? null}
                rows={3}
                className="resize-none font-mono text-sm shadow-none"
              />
            )}
          />

          <Button type="submit" className="w-full shadow-none" isLoading={isSubmitting}>
            {isSubmitting ? "Saving…" : "Continue"}
          </Button>
        </form>
      </section>
    </div>
  );
}

export default function AuthenticationPage() {
  return (
    <Suspense>
      <AuthenticationForm />
    </Suspense>
  );
}
