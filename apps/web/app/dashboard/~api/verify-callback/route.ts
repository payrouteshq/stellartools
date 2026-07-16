import { retrieveAccount } from "@/actions/account";
import { accountValidator } from "@/actions/auth";
import { AppError } from "@/lib/action-handler";
import { Result } from "@stellartools/core";
import { OAuth2Client } from "google-auth-library";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const state = searchParams.get("state");

    if (error) {
      const errorDescription = searchParams.get("error_description") ?? "Authentication failed";

      return NextResponse.redirect(
        new URL(
          process.env.NEXT_PUBLIC_DASHBOARD_URL! +
            `/signin?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription)}`,
          req.url
        )
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL(
          process.env.NEXT_PUBLIC_DASHBOARD_URL! +
            `/signin?error=no_code&error_description=${encodeURIComponent("No authorization code received")}`,
          req.url
        )
      );
    }

    const stateDataResult = Result.try<{ intent: string; next: string }>(() =>
      JSON.parse(Buffer.from(state ?? "", "base64").toString())
    );

    if (stateDataResult.isErr()) {
      throw new AppError("Invalid state data: " + stateDataResult.error.message);
    }

    const stateData = stateDataResult.value;

    const client = new OAuth2Client(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      `${process.env.NEXT_PUBLIC_DASHBOARD_URL!}/~api/verify-callback`
    );

    const { tokens } = await client.getToken(code);

    if (!tokens.id_token) {
      throw new AppError("No ID token received from Google");
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new AppError("Invalid token payload");
    }

    if (payload.aud !== process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      throw new AppError("Token audience mismatch");
    }

    if (!payload.email) {
      throw new AppError("Email not found in token");
    }
    const nameParts = payload.name?.split(/\s+/) || [];
    const firstName = payload.given_name || nameParts[0] || "";
    const lastName = payload.family_name || nameParts.slice(1).join(" ") || "";

    if (stateData.intent === "SIGN_UP") {
      const existingAccount = await retrieveAccount({ email: payload.email });

      if (existingAccount?.sso?.values?.some((s) => s.provider === "local")) {
        // Already fully registered — send to sign-in with an informative message
        return NextResponse.redirect(
          new URL(
            `${process.env.NEXT_PUBLIC_DASHBOARD_URL!}/signin?error=already_registered&error_description=${encodeURIComponent("An account with this email already exists. Please sign in.")}`,
            req.url
          )
        );
      }
    }

    // Google verifies the email for us — create/link the account and log the
    // user straight in, no separate "set a password" step required.
    const account = await accountValidator(
      payload.email,
      { provider: "google", sub: payload.sub },
      stateData.intent === "SIGN_UP" ? "SIGN_UP" : "SIGN_IN",
      { firstName, lastName, avatarUrl: payload.picture },
      { ...stateData }
    );

    if (account && "requires2fa" in account && account.requires2fa) {
      const next = stateData.next ? `?next=${encodeURIComponent(stateData.next)}` : "";
      return NextResponse.redirect(new URL(`/2fa${next}`, process.env.NEXT_PUBLIC_DASHBOARD_URL!));
    }

    return NextResponse.redirect(new URL(stateData.next ?? "/", process.env.NEXT_PUBLIC_DASHBOARD_URL!));
  } catch (error) {
    console.error("OAuth callback error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");

    return NextResponse.json({ error: "Failed to verify callback" }, { status: 500 });
  }
}
