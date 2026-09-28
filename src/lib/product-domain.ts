export const PRODUCT_DOMAIN = "guildbook.io";

/** The domain to show in copy: the configured root, or the product domain on localhost. */
export function displayDomain(rootDomain: string): string {
  return rootDomain === "localhost" ? PRODUCT_DOMAIN : rootDomain;
}
