"use client";

import React from "react";

import type { FileRouter } from "@/lib/uploadthing";
import { Input } from "@stellartools/shared-ui";
import { generateUploadDropzone } from "@uploadthing/react";
import { CheckCircle2Icon } from "lucide-react";
import Image from "next/image";

const UploadDropzone = generateUploadDropzone<FileRouter>();

export default function UploadThingPage() {
  const [customerId, setCustomerId] = React.useState("");
  const [result, setResult] = React.useState<{ url: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="flex h-[calc(100vh-112px)] flex-col gap-4">
      <div className="flex shrink-0 items-center gap-2.5">
        <Image
          src="/images/integrations/uploadthing.png"
          alt="UploadThing"
          width={26}
          height={26}
          className="rounded-lg object-contain"
        />
        <h1 className="shrink-0 text-xl font-semibold tracking-tight">UploadThing</h1>
        <span className="text-muted-foreground/40 shrink-0 text-sm">·</span>
        <Input
          value={customerId}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerId(e.target.value)}
          placeholder="Customer ID (cus_...)"
          className="flex-1 font-mono"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6">
        <UploadDropzone
          endpoint="imageUploader"
          headers={{ "x-customer-id": customerId }}
          onUploadBegin={() => {
            setResult(null);
            setError(null);
          }}
          onClientUploadComplete={(files) => {
            setResult(files[0]?.serverData ?? null);
          }}
          onUploadError={(err) => {
            setResult(null);
            setError(err.message);
          }}
          className="border-border bg-muted/20 hover:bg-muted/30 ut-label:text-foreground ut-allowed-content:text-muted-foreground ut-upload-icon:text-muted-foreground w-full max-w-md rounded-xl border-2 border-dashed p-10 transition-colors"
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
            <p className="text-muted-foreground truncate font-mono text-xs">{result.url}</p>
          </div>
        )}

        {error && (
          <div className="border-border bg-destructive/5 border-destructive/20 w-full max-w-md rounded-xl border p-4">
            <p className="text-destructive text-sm font-medium">Upload blocked</p>
            <p className="text-muted-foreground mt-1 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
