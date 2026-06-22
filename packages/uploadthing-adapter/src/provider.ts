import {
  InsufficientCreditsError,
  type MeteredPlugin,
  type MeteredPluginConfig,
  createMeteredPlugin,
} from "@stellartools/plugin-sdk";
import { UploadThingError, createUploadthing } from "uploadthing/server";
import type { ExpandedRouteConfig } from "uploadthing/types";

interface StellarContext {
  customerId: string;
  productId: string;
  chargedAmount: number;
}

export class MeteredUploadthing {
  private plugin: MeteredPlugin;
  private f = createUploadthing();

  constructor(config: MeteredPluginConfig) {
    this.plugin = createMeteredPlugin(config);
  }

  public routerFactory<T extends ExpandedRouteConfig>(
    config: T,
    options?: Parameters<typeof this.f>[1]
  ): ReturnType<ReturnType<typeof createUploadthing>> {
    const builder = this.f(config, options);

    return {
      input: builder.input.bind(builder),

      middleware: <TOutput extends Record<string, unknown>>(
        userMiddleware?: (opts: any) => Promise<TOutput> | TOutput
      ) => {
        return builder.middleware(async (opts) => {
          const customerId = opts.req.headers.get("x-customer-id");
          const productId = opts.req.headers.get("x-product-id");

          if (!customerId) {
            throw new UploadThingError({ code: "FORBIDDEN", message: "Missing x-customer-id header" });
          }

          if (!productId) {
            throw new UploadThingError({ code: "FORBIDDEN", message: "Missing x-product-id header" });
          }

          const totalBytes = opts.files.reduce((sum, f) => sum + f.size, 0);

          try {
            await this.plugin.preflight(customerId, productId);
            await this.plugin.charge(customerId, productId, totalBytes, {
              operation: "upload",
              files: opts.files.map((f) => f.name),
            });
          } catch (err) {
            if (err instanceof InsufficientCreditsError) {
              throw new UploadThingError({
                code: "FORBIDDEN",
                message: err instanceof Error ? err.message : "Insufficient credits",
              });
            }
            throw new UploadThingError({ code: "INTERNAL_SERVER_ERROR", message: "Billing error" });
          }

          const metadata = userMiddleware ? await userMiddleware(opts) : ({} as TOutput);

          return {
            ...metadata,
            __stellar: { customerId, chargedAmount: totalBytes, productId } satisfies StellarContext,
          };
        });
      },
      //todo: @odii figure out where to call charge because we no longer have refund API, so maybe listen for the lifecycle for upload complete

      onUploadError: (fn?: (opts: any) => Promise<void> | void) => {
        return builder.onUploadError(async (opts) => {
          const stellar = (opts.error.data as any)?.__stellar as StellarContext | undefined;

          if (stellar?.customerId && stellar.chargedAmount > 0) {
            await this.plugin.refund(stellar.customerId, stellar.productId, stellar.chargedAmount, "upload_failed");
          }

          await fn?.(opts);
        });
      },

      onUploadComplete: (fn: (opts: any) => void) => builder.onUploadComplete(fn),
    } as unknown as typeof builder;
  }
}
