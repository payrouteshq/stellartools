import { APP_TOKEN_PREFIX, STELLARTOOLS_ID, decodeJwt, verifyJwt } from "@stellartools/core";

import { AppContext } from "./types";

export function parseAppContext(appToken: string, appSecret: string): AppContext | null {
  if (!appToken.startsWith(APP_TOKEN_PREFIX)) {
    throw new Error("Invalid token format");
  }

  const rawJwt = appToken.replace(APP_TOKEN_PREFIX, "");

  const verified = verifyJwt<AppContext>(rawJwt, appSecret, STELLARTOOLS_ID);

  if (!verified) return null;

  return decodeJwt<AppContext>(rawJwt);
}
