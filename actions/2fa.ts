"use server";

import { retrieveAccount } from "@/actions/account";
import { generateAndSetSession } from "@/actions/auth";
import { AuthProvider } from "@/constant/schema.client";
import { accounts, db } from "@/db";
import { deleteCookies, getCookie, setCookies } from "@/integrations/cookie-manager";
import { decrypt, encrypt } from "@/integrations/encryption";
import { sendEmail } from "@/integrations/email";
import { signJwt, verifyJwt } from "@/integrations/jwt";
import { AppError, safeAction } from "@/lib/action-handler";
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

  const secret = generateSecret();
  const otpauthUrl = generateURI({ issuer: "StellarTools", label: account.email, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return { secret, qrCodeDataUrl };
});

interface Reset2faPayload {
  accountId: string;
  code: string;
}

export const initiate2faReset = safeAction(async (accountId: string) => {
  const account = await retrieveAccount({ id: accountId });
  if (!account) throw new AppError("Account not found");
  if (!account.$2faSecret) throw new AppError("2FA is not enabled on this account");

  const { randomInt } = await import("crypto");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  const token = signJwt({ accountId, code }, "10m");
  await setCookies([{ key: "2fa_reset_pending", value: token, maxAge: 10 * 60 }]);
  console.log("Sending email to", account.email, "with code", code);
  await sendEmail(
    account.email,
    "Your 2FA disable verification code",
    `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2 style="font-size:20px;margin-bottom:8px">Disable Two-Factor Authentication</h2>
      <p style="color:#555">Use the code below to confirm disabling 2FA on your account. It expires in <strong>10 minutes</strong>.</p>
      <div style="background:#f4f4f5;border-radius:8px;padding:24px;text-align:center;margin:24px 0">
        <span style="font-size:36px;font-weight:bold;letter-spacing:10px;font-family:monospace">${code}</span>
      </div>
      <p style="color:#888;font-size:12px">If you did not request this, secure your account immediately.</p>
    </div>`
  );

  return { success: true };
});

export const toggle2fa = safeAction(
  async (
    accountId: string,
    code: string,
    setupSecret?: string, // Only provided when enabling
    emailCode?: string    // Required when disabling
  ) => {
    const account = await retrieveAccount({ id: accountId });

    if (!account) throw new AppError("Account not found");

    const isEnabling = !!setupSecret;

    if (!isEnabling) {
      if (!emailCode) throw new AppError("Email verification code is required");

      const resetToken = await getCookie("2fa_reset_pending");
      if (!resetToken) throw new AppError("No verification code found. Please request a new one.");

      const payload = verifyJwt<Reset2faPayload>(resetToken);
      if (payload.accountId !== accountId) throw new AppError("Invalid verification token");
      if (payload.code !== emailCode) throw new AppError("Invalid email verification code");

      await deleteCookies(["2fa_reset_pending"]);
    }

    const secretToVerify = isEnabling ? setupSecret : account.$2faSecret ? decrypt(account.$2faSecret) : null;

    if (!secretToVerify) throw new AppError("2FA configuration not found");

    const { valid } = verifySync({ token: code, secret: secretToVerify });

    if (!valid) throw new AppError("Invalid verification code");

    await db
      .update(accounts)
      .set({
        $2faSecret: isEnabling ? encrypt(setupSecret) : null,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, accountId));

    return { success: true, enabled: isEnabling };
  }
);

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
