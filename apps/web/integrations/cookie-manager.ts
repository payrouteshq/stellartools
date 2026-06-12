import { SuggestedString } from "@stellartools/core";
import { cookies } from "next/headers";

type CookieKey = SuggestedString<"accessToken" | "refreshToken" | "selectedOrg">;

const BASE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NEXT_PUBLIC_APP_URL?.includes("https") ?? false,
  sameSite: "lax" as const,
  path: "/",
};

export const getCookie = async (key: CookieKey) => {
  const store = await cookies();
  return store.get(key)?.value;
};

export const setCookies = async (params: { key: CookieKey; value: string; maxAge?: number }[]): Promise<void> => {
  const store = await cookies();
  params.forEach(({ key, value, maxAge }) => {
    console.log("setting cookie", key, value, maxAge);
    store.set(key, value, { ...BASE_OPTIONS, maxAge });
  });
};

export const deleteCookies = async (keys: CookieKey[]): Promise<void> => {
  const store = await cookies();
  keys.forEach((key) => store.delete(key));
};
