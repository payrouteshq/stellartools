"use server";

import { type AppContext } from "@stellartools/app-sdk";
import { APP_TOKEN_PREFIX, STELLARTOOLS_ID, decodeJwt, verifyJwt } from "@stellartools/core";

export async function resolveAppContext(token: string): Promise<AppContext | null> {
  if (!token.startsWith(APP_TOKEN_PREFIX)) return null;
  const rawJwt = token.replace(APP_TOKEN_PREFIX, "");
  const verified = verifyJwt<AppContext>(rawJwt, process.env.POSTHOG_APP_SECRET!, STELLARTOOLS_ID);

  if (!verified) return null;

  return decodeJwt<AppContext>(rawJwt);
}
