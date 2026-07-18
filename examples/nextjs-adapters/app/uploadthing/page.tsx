"use client";

import React from "react";

import { CustomerEmailHelpText } from "@/components/customer-email-help-text";
import { Button } from "@/components/ui/button";
import { capture } from "@/lib/posthog";
import type { FileRouter } from "@/lib/uploadthing";
import { TextField } from "@stellartools/shared-ui";
import { useCopy } from "@stellartools/shared-ui";
import { generateUploadDropzone } from "@uploadthing/react";
import { CheckCircle2Icon, CheckIcon, CopyIcon } from "lucide-react";
import Image from "next/image";

const UploadDropzone = generateUploadDropzone<FileRouter>();

function getUploadErrorMessage(error: { message: string; cause?: unknown; data?: { message?: string } }) {
  if (error.data?.message) return error.data.message;
  if (error.message !== "Failed to run middleware") return error.message;

  const { cause } = error;
  if (cause instanceof Error && cause.message) return cause.message;
  if (typeof cause === "string" && cause) return cause;

  return error.message;
}

export default function UploadThingPage() {
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [result, setResult] = React.useState<{ url: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const { handleCopy, copied } = useCopy();

  return (
    <div className="flex h-[calc(100vh-112px)] flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <Image
            src="/images/integrations/uploadthing.png"
            alt="UploadThing"
            width={26}
            height={26}
            className="rounded-lg object-contain"
          />
          <h1 className="text-xl font-semibold tracking-tight">UploadThing</h1>
        </div>
        <TextField
          id="customer-email"
          label="Customer email"
          type="email"
          value={customerEmail}
          onChange={setCustomerEmail}
          placeholder="jane@example.com"
          helpText={<CustomerEmailHelpText />}
          className="max-w-md shadow-none"
          error={null}
        />
      </div>

      <div className="upload-dropzone flex min-h-0 flex-1 flex-col items-center justify-center gap-6">
        <UploadDropzone
          endpoint="imageUploader"
          headers={{ "x-customer-email": customerEmail }}
          onUploadBegin={() => {
            setResult(null);
            setError(null);
            capture("playground_upload_started", { customer_email_set: !!customerEmail });
          }}
          onClientUploadComplete={(files) => {
            setResult(files[0]?.serverData ?? null);
            capture("playground_upload_success");
          }}
          onUploadError={(err) => {
            setResult(null);
            const msg = getUploadErrorMessage(err);
            setError(msg);
            const blocked = err.message === "Failed to run middleware" || !!err.data?.message;
            capture(blocked ? "playground_upload_blocked" : "playground_upload_error");
          }}
          className="border-border bg-muted/20 hover:bg-muted/30 ut-label:text-foreground ut-allowed-content:text-muted-foreground ut-upload-icon:text-muted-foreground ut-button:bg-foreground ut-button:text-background ut-button:data-[state=ready]:bg-foreground ut-button:data-[state=uploading]:bg-foreground/80 ut-button:data-[state=readying]:bg-foreground/80 ut-button:hover:bg-foreground/90 w-full max-w-md rounded-xl border-2 border-dashed p-10 transition-colors"
        />

        {result && (
          <div className="border-border w-full max-w-md space-y-3 rounded-xl border p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2Icon className="size-4 text-green-500" />
              <p className="text-sm font-medium">Upload successful</p>
            </div>
            <img
              src={result.url}
              alt="Uploaded"
              className="border-border max-h-48 w-full rounded-lg border object-contain"
            />
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs">{result.url}</p>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => handleCopy({ text: result.url, message: "File URL copied to clipboard" })}
                aria-label="Copy file URL"
              >
                {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-destructive/5 border-destructive/20 w-full max-w-md rounded-xl border p-4">
            <p className="text-destructive text-sm font-medium">Upload blocked</p>
            <p className="text-muted-foreground mt-1 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
