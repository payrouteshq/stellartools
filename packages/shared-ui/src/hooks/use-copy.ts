"use client";
import React from "react";

import { toast } from "../ui/toast";

export function useCopy() {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async ({ text, message }: { text: string; message: string }) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(message);
    setTimeout(() => setCopied(false), 2000);
  };

  return { copied, handleCopy };
}
