"use client";

import dynamic from "next/dynamic";
import Image from "next/image";

const BetterAuthContent = dynamic(() => import("./_content"), { ssr: false });

export default function BetterAuthPage() {
  return (
    <div className="flex h-[calc(100vh-112px)] flex-col gap-4">
      <div className="flex shrink-0 items-center gap-2">
        <Image
          src="/images/integrations/better-auth.png"
          alt="BetterAuth"
          width={26}
          height={26}
          className="rounded-lg object-contain"
        />
        <h1 className="text-xl font-semibold tracking-tight">BetterAuth</h1>
      </div>
      <BetterAuthContent />
    </div>
  );
}
