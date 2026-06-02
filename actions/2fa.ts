"use server";

import { retrieveAccount } from "@/actions/account";
import { Account, accounts, auth, db } from "@/db";
import { deleteCookies, getCookie, setCookies } from "@/integrations/cookie-manager";
import { decrypt, encrypt } from "@/integrations/encryption";
import { signJwt, verifyJwt } from "@/integrations/jwt";
import { AppError, safeAction } from "@/lib/action-handler";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

interface PendingTwoFactorPayload {
  purpose: string;
  accountId: string;
  provider: string;
  iat: number;
  exp: number;
}

export const generateTwoFactorSetup = safeAction(async (accountId: string) => {
  const account = await retrieveAccount({ id: accountId });
  if (!account) throw new AppError("Account not found");

  const secret = generateSecret();
  const otpauthUrl = generateURI({ issuer: "StellarTools", label: account.email, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return { secret, qrCodeDataUrl };
});

export const enableTwoFactor = safeAction(async (accountId: string, plainSecret: string, code: string) => {
  const account = await retrieveAccount({ id: accountId });
  if (!account) throw new AppError("Account not found");

  const { valid } = verifySync({ token: code, secret: plainSecret });
  if (!valid) throw new AppError("Invalid verification code. Please try again.");

  const encryptedSecret = encrypt(plainSecret);

  await db
    .update(accounts)
    .set({ twoFactorSecret: encryptedSecret, twoFactorEnabled: true, updatedAt: new Date() })
    .where(eq(accounts.id, accountId));

  return { success: true };
});

export const disableTwoFactor = safeAction(async (accountId: string, code: string) => {
  const account = await retrieveAccount({ id: accountId });
  if (!account) throw new AppError("Account not found");

  if (!account.twoFactorSecret) throw new AppError("Two-factor authentication is not set up");

  const secret = decrypt(account.twoFactorSecret);
  const { valid } = verifySync({ token: code, secret });
  if (!valid) throw new AppError("Invalid verification code. Please try again.");

  await db
    .update(accounts)
    .set({ twoFactorSecret: null, twoFactorEnabled: false, updatedAt: new Date() })
    .where(eq(accounts.id, accountId));

  return { success: true };
});

export const completeTwoFactorSignIn = safeAction(async (code: string) => {
  const pendingToken = await getCookie("2fa_pending");
  if (!pendingToken) throw new AppError("Session expired. Please sign in again.");

  let payload: PendingTwoFactorPayload;
  try {
    payload = verifyJwt<PendingTwoFactorPayload>(pendingToken);
  } catch {
    await deleteCookies(["2fa_pending"]);
    throw new AppError("Session expired. Please sign in again.");
  }

  if (payload.purpose !== "2fa_pending") {
    await deleteCookies(["2fa_pending"]);
    throw new AppError("Invalid session token. Please sign in again.");
  }

  const account = await retrieveAccount({ id: payload.accountId });
  if (!account) throw new AppError("Account not found");

  if (!account.twoFactorSecret) throw new AppError("Two-factor authentication is not configured");

  const secret = decrypt(account.twoFactorSecret);
  const { valid } = verifySync({ token: code, secret });
  if (!valid) throw new AppError("Invalid code. Please check your authenticator app and try again.");

  const sessionPayload = { accountId: account.id, email: account.email };
  const accessToken = signJwt(sessionPayload, "6h");
  const refreshToken = signJwt(sessionPayload, "30d");

  await setCookies([
    { key: "accessToken", value: accessToken, maxAge: 6 * 60 * 60 },
    { key: "refreshToken", value: refreshToken, maxAge: 30 * 24 * 60 * 60 },
  ]);

  await db.insert(auth).values({
    id: `au_${nanoid(25)}`,
    accountId: account.id,
    provider: payload.provider as Account["sso"]["values"][number]["provider"],
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    isRevoked: false,
  });

  await deleteCookies(["2fa_pending"]);

  return { success: true };
});
