"use server";

import { safeAction } from "@/lib/action-handler";
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

export const appendToGoogleSheet = safeAction(async (sheetId: string, range: string, values: unknown[][]) => {
  const credentials = JSON.parse(Buffer.from(process.env.GSHEETS_SERVICE_ACCOUNT_KEY_B64!, "base64").toString("utf-8"));

  const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
});
