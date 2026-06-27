import { z as Schema, StellarTools } from "@stellartools/core";
import { UploadThingError, createUploadthing } from "uploadthing/server";

const schema = Schema.object({
  apiKey: Schema.string(),
  productId: Schema.string(),
});

type ShieldConfig = Schema.infer<typeof schema>;

/**
 * Returns an UploadThing factory pre-wired with StellarTools access control.
 *
 * It intercepts the upload request and verifies the customer's subscription
 * status before allowing the file to be processed by UploadThing.
 */
export const shield = (config: ShieldConfig): ((routeConfig: any, options?: any) => any) => {
  const { error, data } = schema.safeParse(config);

  if (error) throw new Error(`Invalid config: ${error.message}`);

  const st = new StellarTools({ api_key: data.apiKey });

  const f = createUploadthing();

  return (routeConfig: any, options?: any) =>
    f(routeConfig, options).middleware(async ({ req }) => {
      // 1. Identify the customer
      const customerId = req.headers.get("x-customer-id");

      if (!customerId) {
        throw new UploadThingError({
          code: "BAD_REQUEST",
          message: "Missing x-customer-id header",
        });
      }

      // 2. Verify Access directly via the SDK
      const subs = await st.subscriptions.list(customerId);
      const hasAccess = subs.some((s) => s.product_id === config.productId && s.status === "active");

      if (!hasAccess) {
        throw new UploadThingError({
          code: "FORBIDDEN",
          message: `Access Denied: Customer "${customerId}" does not have an active subscription to "${config.productId}".`,
        });
      }

      // 3. Return metadata to the 'onUploadComplete' handler
      return { customerId, productId: config.productId };
    });
};
