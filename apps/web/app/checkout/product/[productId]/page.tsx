import { createProductCheckoutSession } from "@/actions/checkout";
import { retrieveProducts } from "@/actions/product";
import { PackageX } from "lucide-react";
import { redirect } from "next/navigation";

function Unavailable() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="bg-muted/50 flex h-14 w-14 items-center justify-center rounded-full border">
        <PackageX className="text-muted-foreground h-7 w-7" />
      </div>
      <h1 className="text-xl font-semibold">This payment link is unavailable</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        The product may have been removed or is no longer accepting payments. Please contact the seller for an updated
        link.
      </p>
    </div>
  );
}

export default async function ProductPermalinkPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;

  const {
    data: [product],
  } = await retrieveProducts(undefined, undefined, { productId, requiresAuth: false });

  if (!product || product.status !== "active") {
    return <Unavailable />;
  }

  let checkoutId: string;

  try {
    const checkout = await createProductCheckoutSession({
      productId,
      orgId: product.organizationId,
      env: product.environment,
    });
    checkoutId = checkout.id;
  } catch {
    return <Unavailable />;
  }

  redirect(`/${checkoutId}`);
}
