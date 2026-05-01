export class BillingError extends Error {
  constructor(
    message: string,
    public readonly code: "INSUFFICIENT_CREDITS" | "INVALID_CUSTOMER" | "PRODUCT_NOT_FOUND" | "INVALID_PRODUCT_TYPE" | "UNKNOWN"
  ) {
    super(message);
    this.name = "BillingError";
  }
}

export class InsufficientCreditsError extends BillingError {
  constructor(
    message: string,
    public readonly required: number,
    public readonly available: number
  ) {
    super(message, "INSUFFICIENT_CREDITS");
    this.name = "InsufficientCreditsError";
  }
}

export class InvalidCustomerError extends BillingError {
  constructor(message: string) {
    super(message, "INVALID_CUSTOMER");
    this.name = "InvalidCustomerError";
  }
}

export class ProductNotFoundError extends BillingError {
  constructor(message: string) {
    super(message, "PRODUCT_NOT_FOUND");
    this.name = "ProductNotFoundError";
  }
}

export class InvalidProductTypeError extends BillingError {
  constructor(productId: string) {
    super(
      `Product "${productId}" is not a metered product. Only metered products are supported with this plugin.`,
      "INVALID_PRODUCT_TYPE"
    );
    this.name = "InvalidProductTypeError";
  }
}
