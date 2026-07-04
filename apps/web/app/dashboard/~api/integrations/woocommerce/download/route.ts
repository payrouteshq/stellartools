import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { ZipArchive } from "archiver";
import { access, constants } from "fs/promises";
import path from "path";
import { PassThrough } from "stream";

export const OPTIONS = createOptionsHandler();

export const GET = apiHandler({
  auth: [],
  convertToSnakeCase: false,
  handler: async () => {
    const source = path.join(process.cwd(), "../../packages/woocommerce-adapter");
    await access(source, constants.R_OK);

    const zip = await new Promise<Buffer>((resolve, reject) => {
      const passthrough = new PassThrough();
      const chunks: Buffer[] = [];

      passthrough.on("data", (chunk: Buffer) => chunks.push(chunk));
      passthrough.on("end", () => resolve(Buffer.concat(chunks)));
      passthrough.on("error", reject);

      const archive = new ZipArchive({ zlib: { level: 9 } });
      archive.on("error", reject);
      archive.pipe(passthrough);
      archive.directory(source, "stellartools");
      void archive.finalize().catch(reject);
    });

    return new Response(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="stellartools-woocommerce.zip"',
        "Cache-Control": "no-store",
      },
    });
  },
});
