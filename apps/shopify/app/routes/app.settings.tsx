import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  ChoiceList,
  Divider,
  FormLayout,
  Icon,
  InlineStack,
  Layout,
  Link,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { CheckCircleIcon, KeyIcon, LockIcon } from "@shopify/polaris-icons";
import { useCallback, useState } from "react";
import { eq } from "drizzle-orm";
import { StellarTools } from "@stellartools/core";
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
  const intent = form.get("intent") as string;
  const apiKey = (form.get("apiKey") as string)?.trim();
  const environment = form.get("environment") as "testnet" | "mainnet";

  if (!apiKey) {
    return { error: "API key is required", success: false, valid: false, intent };
  }

  if (intent === "test") {
    try {
        const st = new StellarTools({ api_key: apiKey });
      await st.balance.retrieve();
      return { error: null, success: false, valid: true, intent };
    } catch {
      return { error: "Could not connect — check your API key and try again.", success: false, valid: false, intent };
    }
  }

  await db
    .update(shopifyShops)
    .set({ stellartoolsApiKey: apiKey, environment })
    .where(eq(shopifyShops.shopDomain, session.shop));

  return { error: null, success: true, valid: true, intent };
}

export default function Settings() {
  const { shop } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();

  const isConfigured = !!shop?.stellartoolsApiKey;
  const isSaving = navigation.state === "submitting" && navigation.formData?.get("intent") === "save";
  const isTesting = navigation.state === "submitting" && navigation.formData?.get("intent") === "test";

  const [apiKey, setApiKey] = useState(shop?.stellartoolsApiKey ?? "");
  const [environment, setEnvironment] = useState<string[]>([shop?.environment ?? "testnet"]);

  const handleSubmit = useCallback((intent: "save" | "test") => {
    const data = new FormData();
    data.set("intent", intent);
    data.set("apiKey", apiKey);
    data.set("environment", environment[0]);
    submit(data, { method: "POST" });
  }, [apiKey, environment, submit]);

  return (
    <Page title="Settings">
      <Layout>
        {/* Status banner */}
        <Layout.Section>
          {actionData?.success && (
            <Banner title="Settings saved successfully" tone="success" onDismiss={() => {}} />
          )}
          {actionData?.intent === "test" && actionData?.valid && !actionData?.error && (
            <Banner title="Connection successful — your API key is valid" tone="success" onDismiss={() => {}} />
          )}
          {actionData?.error && (
            <Banner title={actionData.error} tone="critical" onDismiss={() => {}} />
          )}
        </Layout.Section>

        <Layout.Section>
          <BlockStack gap="500">

            {/* Connection status card */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="headingMd" as="h2">Connection status</Text>
                    <Text as="p" tone="subdued">
                      {isConfigured
                        ? `Connected to StellarTools on ${shop.environment}`
                        : "Not connected — add your API key below"}
                    </Text>
                  </BlockStack>
                  <Badge tone={isConfigured ? "success" : "warning"}>
                    {isConfigured ? "Connected" : "Not configured"}
                  </Badge>
                </InlineStack>

                {isConfigured && (
                  <>
                    <Divider />
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={CheckCircleIcon} tone="success" />
                      <Text as="p" tone="subdued">
                        API key ending in ···{shop.stellartoolsApiKey!.slice(-4)}
                      </Text>
                    </InlineStack>
                  </>
                )}
              </BlockStack>
            </Card>

            {/* API key setup card */}
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="200" blockAlign="center">
                  <Icon source={KeyIcon} />
                  <Text variant="headingMd" as="h2">StellarTools API key</Text>
                </InlineStack>

                <Text as="p" tone="subdued">
                  Get your API key from{" "}
                  <Link url="https://app.stellartools.dev/settings/api-keys" external>
                    StellarTools → Settings → API Keys
                  </Link>
                  . Use a testnet key while developing and switch to mainnet for live payments.
                </Text>

                <FormLayout>
                  <TextField
                    label="API key"
                    value={apiKey}
                    onChange={setApiKey}
                    type="password"
                    autoComplete="off"
                    placeholder="st_live_... or st_test_..."
                    prefix={<Icon source={LockIcon} />}
                    helpText="Your API key is stored encrypted and never exposed to customers."
                  />
                </FormLayout>

                <Divider />

                <ChoiceList
                  title="Network"
                  choices={[
                    {
                      label: "Testnet",
                      value: "testnet",
                      helpText: "Use test wallets and fake funds — no real money moves",
                    },
                    {
                      label: "Mainnet",
                      value: "mainnet",
                      helpText: "Live payments with real assets on the Stellar network",
                    },
                  ]}
                  selected={environment}
                  onChange={setEnvironment}
                />
              </BlockStack>
            </Card>

            {/* How it works card */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">How it works</Text>
                <BlockStack gap="200">
                  {[
                    "Customers add items to their cart and click \"Pay with Stellar\"",
                    "They're taken to a StellarTools hosted checkout page",
                    "Payment is made in USDC, EURC, XLM, or other Stellar assets",
                    "You receive a webhook notification when payment completes",
                  ].map((step, i) => (
                    <InlineStack key={i} gap="300" blockAlign="start">
                      <Box
                        background="bg-fill-active"
                        borderRadius="full"
                        paddingInline="200"
                        paddingBlock="050"
                        minWidth="24px"
                      >
                        <Text as="span" variant="bodySm" fontWeight="semibold" alignment="center">
                          {i + 1}
                        </Text>
                      </Box>
                      <Text as="p">{step}</Text>
                    </InlineStack>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>

          </BlockStack>
        </Layout.Section>

        <Layout.Section>
          <InlineStack gap="300">
            <Button
              variant="primary"
              onClick={() => handleSubmit("save")}
              loading={isSaving}
              disabled={!apiKey.trim()}
            >
              Save settings
            </Button>
            <Button
              onClick={() => handleSubmit("test")}
              loading={isTesting}
              disabled={!apiKey.trim()}
            >
              Test connection
            </Button>
          </InlineStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
