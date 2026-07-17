import { z as Schema, StellarTools, internal$hasSubscriptionAccess } from "@stellartools/core";
import { UploadThingError, createUploadthing } from "uploadthing/server";
import type { FileRoute, UploadedFileData } from "uploadthing/types";

const schema = Schema.object({
  apiKey: Schema.string(),
  productId: Schema.string(),
});

type ShieldConfig = Schema.infer<typeof schema>;

export type ShieldMetadata = {
  customerId: string;
  productId: string;
};

export type ShieldUploadCompleteArgs = {
  metadata: ShieldMetadata;
  file: UploadedFileData;
  req: Request;
};

export interface ShieldRouteBuilder {
  onUploadComplete: <TOutput extends Record<string, unknown> | void>(
    fn: (opts: ShieldUploadCompleteArgs) => TOutput | Promise<TOutput>
  ) => FileRoute<{
    input: undefined;
    output: TOutput extends void | undefined ? null : TOutput;
    errorShape: { message: string };
  }>;
}

type ShieldFactory = (...args: Parameters<ReturnType<typeof createUploadthing>>) => ShieldRouteBuilder;

type UploadThingErrorCode = "BAD_REQUEST" | "NOT_FOUND" | "FORBIDDEN" | "INTERNAL_SERVER_ERROR";

const asShieldError = (error: unknown, code: UploadThingErrorCode = "INTERNAL_SERVER_ERROR"): UploadThingError => {
  if (error instanceof UploadThingError) return error;

  const message = error instanceof Error && error.message ? error.message : "Upload access check failed";

  return new UploadThingError({ code, message, cause: error });
};

/**
 * Returns an UploadThing factory pre-wired with StellarTools access control.
 *
 * It intercepts the upload request and verifies the customer's subscription
 * status before allowing the file to be processed by UploadThing.
 * 
 * @example 
 * 
 * const f = shield({
 * apiKey: process.env.STELLARTOOLS_API_KEY!,
 * productId: process.env.STELLARTOOLS_PRODUCT_ID!,
 * });
 * 
 * const fileRouter = {
 * imageUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } }).onUploadComplete(async ({ metadata, file }) => {
 * console.log("[uploadthing-adapter] upload complete", { customer: metadata.customerId, url: file.ufsUrl });
 * return { url: file.ufsUrl, customerId: metadata.customerId };
 * }),
 * };
 
 */
export const shield = (config: ShieldConfig): ShieldFactory => {
  const f = createUploadthing({
    errorFormatter: (error) => {
      const cause = error.cause;
      if (error.message === "Failed to run middleware" && cause instanceof Error && cause.message) {
        return { message: cause.message };
      }
      return { message: error.message };
    },
  });
  let client: StellarTools | undefined;
  let settings: ShieldConfig | undefined;

  const getSettings = () => {
    if (settings) return { settings, client: client! };

    const parsed = schema.safeParse(config);
    if (parsed.error) {
      throw new UploadThingError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Invalid StellarTools config: ${parsed.error.message}`,
      });
    }

    settings = parsed.data;
    client = new StellarTools({ api_key: settings.apiKey });
    return { settings, client };
  };

  return (...args) =>
    f(...args).middleware(async ({ req }) => {
      try {
        const { settings: cfg, client: st } = getSettings();

        const email = req.headers.get("x-customer-email")?.trim();
        if (!email) {
          throw new UploadThingError({
            code: "BAD_REQUEST",
            message: "Enter the customer email used at checkout.",
          });
        }

        let customers;
        try {
          customers = await st.customers.list({ email });
        } catch (error) {
          throw asShieldError(error);
        }

        const customerId = customers[0]?.id;

        if (!customerId) {
          throw new UploadThingError({
            code: "NOT_FOUND",
            message: `No StellarTools customer found for "${email}". Complete checkout first.`,
          });
        }

        let subs;
        try {
          subs = await st.subscriptions.list(customerId);
        } catch (error) {
          throw asShieldError(error);
        }

        const hasAccess = subs.some((s) => s.product_id === cfg.productId && internal$hasSubscriptionAccess(s));

        if (!hasAccess) {
          throw new UploadThingError({
            code: "FORBIDDEN",
            message: `No active subscription for "${email}". Subscribe to upload files.`,
          });
        }

        return { customerId, productId: cfg.productId };
      } catch (error) {
        throw asShieldError(error);
      }
    }) as unknown as ShieldRouteBuilder;
};
