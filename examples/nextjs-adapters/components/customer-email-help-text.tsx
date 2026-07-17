import Link from "next/link";

export function CustomerEmailHelpText() {
  return (
    <>
      Use the email from checkout for{" "}
      <Link href="/" className="text-foreground underline underline-offset-2">
        this product
      </Link>
      .
    </>
  );
}
