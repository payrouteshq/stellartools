"use server";

import { retrieveAccount } from "@/actions/account";
import { generateAndSetSession } from "@/actions/auth";
import { AuthProvider } from "@/constant/schema.client";
import { accounts, db } from "@/db";
import { TwoFaDisableVerificationEmail } from "@/emails/2fa-disable-verification";
import { deleteCookies, getCookie } from "@/integrations/cookie-manager";
import { sendEmail } from "@/integrations/email";
import { decrypt, encrypt } from "@/integrations/encryption";
import { signJwt, verifyJwt } from "@/integrations/jwt";
import { AppError, safeAction } from "@/lib/action-handler";
import { randomInt } from "crypto";
import { eq } from "drizzle-orm";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";

interface Pending2faPayload {
  accountId: string;
  provider: AuthProvider;
  iat: number;
  exp: number;
}

export const setup2fa = safeAction(async (accountId: string) => {
  const account = await retrieveAccount({ id: accountId });
  if (!account) throw new AppError("Account not found");

  const existingEncrypted = account.metadata?.pending2faSecret as string | undefined;
  const secret = existingEncrypted ? decrypt(existingEncrypted) : generateSecret();

  if (!existingEncrypted) {
    await db
      .update(accounts)
      .set({ metadata: { ...(account.metadata ?? {}), pending2faSecret: encrypt(secret) } })
      .where(eq(accounts.id, accountId));
  }

  const otpauthUrl = generateURI({ issuer: "StellarTools", label: account.email, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return { secret, qrCodeDataUrl };
});

export const initiate2faReset = safeAction(async (accountId: string) => {
  const account = await retrieveAccount({ id: accountId });
  if (!account) throw new AppError("Account not found");
  if (!account.$2faSecret) throw new AppError("2FA is not enabled on this account");

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const resetToken = signJwt({ accountId, code }, "10m");

  await sendEmail(account.email, "Your 2FA disable verification code", TwoFaDisableVerificationEmail({ code }));

  return { success: true, resetToken };
});

export const toggle2fa = safeAction(
  async (
    accountId: string,
    code: string,
    setupSecret?: string // Only provided when enabling
  ) => {
    const account = await retrieveAccount({ id: accountId });

    if (!account) throw new AppError("Account not found");

    const isEnabling = !!setupSecret;

    const secretToVerify = isEnabling ? setupSecret : account.$2faSecret ? decrypt(account.$2faSecret) : null;

    if (!secretToVerify) throw new AppError("2FA configuration not found");

    const { valid } = verifySync({ token: code, secret: secretToVerify });

    if (!valid) throw new AppError("Invalid verification code");

    const { pending2faSecret: _drop, ...cleanMetadata } = (account.metadata ?? {}) as any;

    await db
      .update(accounts)
      .set({
        $2faSecret: isEnabling ? encrypt(setupSecret) : null,
        metadata: cleanMetadata,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, accountId));

    return { success: true, enabled: isEnabling };
  }
);

export const reset2fa = safeAction(async (accountId: string, code: string, resetToken: string) => {
  const account = await retrieveAccount({ id: accountId });
  if (!account) throw new AppError("Account not found");

  const payload = verifyJwt<{ accountId: string; code: string }>(resetToken);
  if (payload.accountId !== accountId) throw new AppError("Invalid reset token");
  if (payload.code !== code) throw new AppError("Invalid verification code");

  const { pending2faSecret: _drop, ...cleanMetadata } = (account.metadata ?? {}) as Record<string, unknown>;

  await db
    .update(accounts)
    .set({ $2faSecret: null, metadata: cleanMetadata, updatedAt: new Date() })
    .where(eq(accounts.id, accountId));

  return { success: true };
});

export const complete2fa = safeAction(async (code: string) => {
  const pendingToken = await getCookie("2fa_pending");

  if (!pendingToken) throw new AppError("Session expired. Please sign in again.");

  const payload = verifyJwt<Pending2faPayload>(pendingToken);

  const account = await retrieveAccount({ id: payload.accountId });
  if (!account) throw new AppError("Account not found");
  if (!account.$2faSecret) throw new AppError("2FA not configured");

  const { valid } = verifySync({ token: code, secret: decrypt(account.$2faSecret) });

  if (!valid) throw new AppError("Invalid verification code");

  await Promise.all([generateAndSetSession(account, payload.provider), deleteCookies(["2fa_pending"])]);

  return { success: true };
});
