import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useActionData, useLoaderData, useSubmit } from "@remix-run/react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  ChoiceList,
  Divider,
  FormLayout,
  Layout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { useCallback, useState } from "react";
import { eq } from "drizzle-orm";
import { db, shopifyShops } from "~/db.server";
import { authenticate } from "~/shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  const shop = await db
    .select()
    .from(shopifyShops)
    .where(eq(shopifyShops.shopDomain, session.shop))
    .limit(1)
    .then((r) => r[0] ?? null);

  return { shop };
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();

  const apiKey = form.get("apiKey") as string;
  const environment = form.get("environment") as "testnet" | "mainnet";
  const syncProducts = form.get("syncProducts") === "true";
  const syncCustomers = form.get("syncCustomers") === "true";

  if (!apiKey?.trim()) {
    return { error: "API key is required", success: false };
  }

  await db
    .update(shopifyShops)
    .set({
      stellartoolsApiKey: apiKey,
      environment,
      settings: { syncProducts, syncCustomers },
    })
    .where(eq(shopifyShops.shopDomain, session.shop));

  return { error: null, success: true };
}

export default function Settings() {
  const { shop } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  const [apiKey, setApiKey] = useState(shop?.stellartoolsApiKey ?? "");
  const [environment, setEnvironment] = useState<string[]>([
    shop?.environment ?? "testnet",
  ]);
  const [syncProducts, setSyncProducts] = useState(
    shop?.settings?.syncProducts ?? true
  );
  const [syncCustomers, setSyncCustomers] = useState(
    shop?.settings?.syncCustomers ?? true
  );

  const handleSave = useCallback(() => {
    const data = new FormData();
    data.set("apiKey", apiKey);
    data.set("environment", environment[0]);
    data.set("syncProducts", syncProducts.toString());
    data.set("syncCustomers", syncCustomers.toString());
    submit(data, { method: "POST" });
  }, [apiKey, environment, syncProducts, syncCustomers, submit]);

  return (
    <Page
      title="Settings"
      primaryAction={{ content: "Save", onAction: handleSave }}
    >
      <Layout>
        {actionData?.success && (
          <Layout.Section>
            <Banner title="Settings saved" tone="success" />
          </Layout.Section>
        )}
        {actionData?.error && (
          <Layout.Section>
            <Banner title={actionData.error} tone="critical" />
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                StellarTools account
              </Text>
              <Text as="p" tone="subdued">
                Find your API key in StellarTools → Settings → API Keys.
              </Text>
              <FormLayout>
                <TextField
                  label="API Key"
                  value={apiKey}
                  onChange={setApiKey}
                  type="password"
                  autoComplete="off"
                  placeholder="st_key_..."
                />
              </FormLayout>

              <Divider />

              <ChoiceList
                title="Network"
                choices={[
                  {
                    label: "Testnet (for development)",
                    value: "testnet",
                  },
                  {
                    label: "Mainnet (live payments)",
                    value: "mainnet",
                  },
                ]}
                selected={environment}
                onChange={setEnvironment}
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Sync settings
              </Text>
              <Checkbox
                label="Sync Shopify products to StellarTools"
                checked={syncProducts}
                onChange={setSyncProducts}
                helpText="Keeps your product catalog in sync for direct product checkouts."
              />
              <Checkbox
                label="Sync Shopify customers to StellarTools"
                checked={syncCustomers}
                onChange={setSyncCustomers}
                helpText="Matches customers by email so payment history is linked."
              />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
