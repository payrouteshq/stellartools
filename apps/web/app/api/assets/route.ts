import { retrieveSupportedAssets } from "@/actions/asset";
import { apiHandler, createOptionsHandler } from "@/lib/api-handler";
import { Result } from "@stellartools/core";

export const OPTIONS = createOptionsHandler();

export const GET = apiHandler({
  auth: ["apikey"],
  mcp: { name: "retrieve_supported_assets", description: "Retrieve supported assets" },
  handler: async ({ auth: { environment } }) => {
    const assets = await retrieveSupportedAssets(null, environment);
    return Result.ok(
      assets.map((a) => ({
        code: a.code,
        description: a.description,
        canonicalIssuer: a.canonicalIssuer ?? null,
        images: a.images ?? [],
      }))
    );
  },
});
