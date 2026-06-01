"use client";

export default function Error({ error }: { error: Error & { digest?: string } }) {
  const message = error.digest ?? "Something went wrong.";

  return <div className="flex h-screen w-screen items-center justify-center">{message}</div>;
}
