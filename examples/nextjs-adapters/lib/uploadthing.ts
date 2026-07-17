import { shield } from "@stellartools/uploadthing-adapter";

// shield() replaces createUploadthing() — it adds subscription middleware automatically
const f = shield({
  apiKey: process.env.STELLAR_API_KEY!,
  productId: process.env.STELLAR_PRODUCT_ID!,
});

export const fileRouter = {
  imageUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } }).onUploadComplete(async ({ metadata, file }) => {
    console.log("[uploadthing-adapter] upload complete", { customer: metadata.customerId, url: file.ufsUrl });
    return { url: file.ufsUrl, customerId: metadata.customerId };
  }),
};

export type FileRouter = typeof fileRouter;
