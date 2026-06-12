import { retrieveOrganization, retrieveOrganizationIdAndSecret } from "@/actions/organization";
import { retrieveProducts } from "@/actions/product";
import { Network } from "@/db";
import TOML from "@iarna/toml";

const DEFAULT_LOGO_URL = "https://stellartools.dev/default-logo.png";
const PLATFORM_WEB_AUTH_ENDPOINT = "https://api.stellartools.dev/auth";
const PLATFORM_PHYSICAL_ADDRESS = "123 Stellar Way, San Francisco, CA 94102, United States";
const PLATFORM_OFFICIAL_EMAIL = "odii@stellartools.dev";
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

export async function GET(request: Request) {
  const host = request.headers.get("host") || "";
  const orgId = host.split(".")[0];

  const searchParams = new URL(request.url).searchParams;
  const environment = (searchParams.get("mode") as Network) ?? "mainnet";

  if (!orgId) {
    return new Response("Organization not found", { status: 404 });
  }

  try {
    const org = await retrieveOrganization(orgId);
    const { secret } = await retrieveOrganizationIdAndSecret(orgId, environment);

    const productsWithAssets = await retrieveProducts(org.id, environment);

    const networkPassphrase = environment === "testnet" ? TESTNET_PASSPHRASE : MAINNET_PASSPHRASE;

    const orgLogo = org.logoUrl || DEFAULT_LOGO_URL;
    const orgUrl = `https://${orgId}.stellartools.dev`;
    const orgSupportEmail = `${orgId}@stellartools.dev`;
    const orgDescription = org.description || `${org.name} - Powered by Stellar Tools`;

    const currencies = productsWithAssets.map((product) => {
      const productImage = product.images?.[0] || org.logoUrl;

      const currency: Record<string, unknown> = {
        code: product.currencyCode,
        name: product.name,
        desc: product.description || `${product.name} by ${org.name}`,
        image: productImage || orgLogo,
        status: "live",
        is_asset_anchored: false,
        redemption_instructions: `Purchase at ${orgUrl}/checkout`,
      };

      if (product.type === "metered") {
        currency.conditions = `Metered billing: ${product.totalCredits?.toString()} credits included`;
      } else if (product.type === "subscription") {
        currency.conditions = "Recurring subscription";
      }

      return currency;
    });

    const tomlData = {
      NETWORK_PASSPHRASE: networkPassphrase,
      ACCOUNTS: secret?.publicKey ? [secret.publicKey] : [],
      WEB_AUTH_ENDPOINT: PLATFORM_WEB_AUTH_ENDPOINT,
      DOCUMENTATION: {
        ORG_NAME: org.name,
        ORG_URL: orgUrl,
        ORG_LOGO: orgLogo,
        ORG_DESCRIPTION: orgDescription,
        ORG_PHYSICAL_ADDRESS: PLATFORM_PHYSICAL_ADDRESS,
        ORG_OFFICIAL_EMAIL: PLATFORM_OFFICIAL_EMAIL,
        ORG_SUPPORT_EMAIL: orgSupportEmail,
      },
      PRINCIPALS: [{ name: "Stellar Tools Support", email: PLATFORM_OFFICIAL_EMAIL }],
      CURRENCIES: currencies,
    };

    const tomlString = TOML.stringify(tomlData as Parameters<typeof TOML.stringify>[0]);

    return new Response(tomlString, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Organization not found") {
      return new Response("Organization not found", { status: 404 });
    }

    return new Response("Internal server error", { status: 500 });
  }
}
