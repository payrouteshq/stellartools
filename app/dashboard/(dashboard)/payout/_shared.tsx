import { PayoutReceipt } from "@/components/payout/payout-receipt";
import { Payout } from "@/db";
import { AppError } from "@/lib/error-handler";
import { pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";

export async function generateAndDownloadReceipt(
  payout: Payout,
  organizationName?: string,
  organizationAddress?: string,
  organizationEmail?: string
): Promise<void> {
  try {
    const doc = (
      <PayoutReceipt
        payout={payout}
        organizationName={organizationName}
        organizationAddress={organizationAddress}
        organizationEmail={organizationEmail}
      />
    );

    const blob = await pdf(doc).toBlob();

    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `stellartools-payout-receipt-${payout.id}-${dateStr}.pdf`;
    saveAs(blob, filename);
  } catch (error) {
    console.error("Error generating receipt:", error);
    throw new AppError("Failed to generate receipt");
  }
}
