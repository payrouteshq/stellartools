"use client";

import React from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const useAuth = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [dismissedError, setDismissedError] = React.useState(false);

  const error = searchParams?.get("error");
  const next = searchParams?.get("next");

  React.useEffect(() => {
    if (dismissedError && error) {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete("error");
      router.replace(`${pathname}?${newParams.toString()}`);
      setDismissedError(false);
    }
  }, [dismissedError, error, router, searchParams, pathname]);

  const handleGoogleSignIn = React.useCallback(() => {
    const authUrlParams = {
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      redirect_uri: `${process.env.NEXT_PUBLIC_DASHBOARD_URL!}/~api/verify-callback`,
      response_type: "code",
      scope: "openid profile email",
      access_type: "offline",
      prompt: "consent",
      state: btoa(JSON.stringify({ intent: pathname.includes("signup") ? "SIGN_UP" : "SIGN_IN", next })),
    };
    router.push(`https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams(authUrlParams)}`);
  }, [router, next, pathname]);

  return { error, handleGoogleSignIn, setDismissedError };
};
