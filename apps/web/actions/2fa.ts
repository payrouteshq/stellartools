"use server";

import { retrieveAccount } from "@/actions/account";
import { generateAndSetSession } from "@/actions/auth";
import { SENSITIVE_KEY_PREFIX } from "@/constant";
import { AuthProvider } from "@/constant/schema.client";
import { accounts, db } from "@/db";
import { TwoFaDisableVerificationEmail } from "@/emails/2fa-disable-verification";
import { deleteCookies, getCookie } from "@/integrations/cookie-manager";
import { sendEmail } from "@/integrations/email";
import { decrypt, encrypt } from "@/integrations/encryption";
import { AppError, safeAction } from "@/lib/action-handler";
import { STELLARTOOLS_ID, signJwt, verifyJwt } from "@stellartools/core";
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

export const initiate2faReset = safeAction(async (accountId: string) => {
  const account = await retrieveAccount({ id: accountId });
  if (!account) throw new AppError("Account not found");
  if (!account.$2faSecret) throw new AppError("2FA is not enabled on this account");

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  const resetToken = signJwt({ accountId, code }, "10m", process.env.JWT_SECRET!, STELLARTOOLS_ID);

  await sendEmail(account.email, "Your 2FA disable verification code", TwoFaDisableVerificationEmail({ code }));

  return { success: true, resetToken };
});

export const setup2fa = safeAction(async (accountId: string) => {
  const account = await retrieveAccount({ id: accountId });
  if (!account) throw new AppError("Account not found");

  const existingEncrypted = account.metadata?.pending2faSecret as string | undefined;
  const secret = existingEncrypted ? decrypt(existingEncrypted.replace(SENSITIVE_KEY_PREFIX, "")) : generateSecret();

  if (!existingEncrypted) {
    const pending2faSecret = `${SENSITIVE_KEY_PREFIX}${encrypt(secret)}`;

    await db
      .update(accounts)
      .set({ metadata: { ...(account.metadata ?? {}), pending2faSecret } })
      .where(eq(accounts.id, accountId));
  }

  const otpauthUrl = generateURI({ issuer: "StellarTools", label: account.email, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return { secret, qrCodeDataUrl };
});

export const toggle2fa = safeAction(
  async (
    accountId: string,
    code: string,
    setupSecret?: string, // Only provided when enabling
    resetToken?: string // Only provided when disabling
  ) => {
    const account = await retrieveAccount({ id: accountId });

    if (!account) throw new AppError("Account not found");

    const isEnabling = !!setupSecret;

    if (resetToken) {
      const payload = verifyJwt<{ accountId: string; code: string }>(
        resetToken,
        process.env.JWT_SECRET!,
        STELLARTOOLS_ID
      );

      if (payload.accountId !== accountId) throw new AppError("Invalid verification token");
      if (payload.code !== code) throw new AppError("Invalid email verification code");
    } else {
      const secretToVerify = isEnabling
        ? setupSecret
        : account.$2faSecret
          ? decrypt(account.$2faSecret?.replace(SENSITIVE_KEY_PREFIX, "") ?? "")
          : null;

      if (!secretToVerify) throw new AppError("2FA configuration not found");

      const { valid } = verifySync({ token: code, secret: secretToVerify });

      if (!valid) throw new AppError("Invalid verification code");
    }

    const { pending2faSecret: _drop, ...cleanMetadata } = account.metadata ?? {};

    await db
      .update(accounts)
      .set({
        $2faSecret: isEnabling ? `${SENSITIVE_KEY_PREFIX}${encrypt(setupSecret)}` : null,
        metadata: cleanMetadata,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, accountId));

    return { success: true, enabled: isEnabling };
  }
);

export const complete2fa = safeAction(async (code: string) => {
  const pendingToken = await getCookie("2fa_pending");

  if (!pendingToken) throw new AppError("Session expired. Please sign in again.");

  const payload = verifyJwt<Pending2faPayload>(pendingToken, process.env.JWT_SECRET!, STELLARTOOLS_ID);

  const account = await retrieveAccount({ id: payload.accountId });
  if (!account) throw new AppError("Account not found");
  if (!account.$2faSecret) throw new AppError("2FA not configured");

  const { valid } = verifySync({
    token: code,
    secret: decrypt(account.$2faSecret?.replace(SENSITIVE_KEY_PREFIX, "") ?? ""),
  });

  if (!valid) throw new AppError("Invalid verification code");

  await Promise.all([generateAndSetSession(account, payload.provider), deleteCookies(["2fa_pending"])]);

  return { success: true };
});
