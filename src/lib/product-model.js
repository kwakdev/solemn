export function validateProductPricing(priceCents, salePriceCents) {
  if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > 2147483647) {
    throw new Error("Enter a regular price from $0 to $21,474,836.47, with up to two decimal places.");
  }
  if (salePriceCents != null && (!Number.isInteger(salePriceCents) || salePriceCents < 0 || salePriceCents >= priceCents)) {
    throw new Error("Sale price must be $0 or more and lower than the regular price.");
  }
}

function normalizeSizes(value) {
  return (Array.isArray(value) ? value : []).map((size) => {
    const stock = Math.max(0, Math.floor(Number(size?.stock) || 0));
    return {
      label: String(size?.label ?? "").trim().slice(0, 20),
      stock,
      available: stock > 0,
      shopifyVariantId: typeof size?.shopifyVariantId === "string" ? size.shopifyVariantId.trim() : "",
    };
  }).filter((size) => size.label);
}

export function databaseRowToProduct(row) {
  const sizes = normalizeSizes(row.sizes);
  const images = Array.isArray(row.images) ? row.images.filter((image) => typeof image === "string" && image) : [];
  const priceCents = Math.max(0, Math.round(Number(row.price_cents) || 0));
  const salePriceCents = Number.isInteger(row.sale_price_cents) && row.sale_price_cents >= 0 && row.sale_price_cents < priceCents ? row.sale_price_cents : null;
  const sellingPriceCents = salePriceCents ?? priceCents;
  const stock = sizes.reduce((total, size) => total + size.stock, 0);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: `$${(sellingPriceCents / 100).toFixed(2)}`,
    priceValue: sellingPriceCents / 100,
    priceCents,
    salePriceCents,
    regularPrice: `$${(priceCents / 100).toFixed(2)}`,
    regularPriceValue: priceCents / 100,
    placement: row.placement,
    description: Array.isArray(row.description) ? row.description.filter((line) => typeof line === "string") : [],
    sizes,
    images,
    image: images[0] ?? "",
    stock,
    soldOut: stock === 0,
    updatedAt: row.updated_at?.toDate?.().toISOString() ?? row.updated_at,
  };
}

export function productToDatabaseRow(product) {
  validateProductPricing(product.priceCents, product.salePriceCents);
  const name = String(product.name ?? "").trim();
  const slug = String(product.slug ?? "").trim();
  if (!name || name.length > 200) throw new Error("Enter a product name of up to 200 characters.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 160) {
    throw new Error("Enter a product URL using lowercase letters, numbers, and hyphens (up to 160 characters).");
  }
  if (!["new_arrivals", "collection", "memories"].includes(product.placement)) throw new Error("Choose a valid product placement.");
  if (!Array.isArray(product.sizes) || product.sizes.length > 50) throw new Error("Add no more than 50 sizes.");
  const labels = new Set();
  const sizes = product.sizes.map((size) => {
    const label = String(size.label ?? "").trim();
    if (size.shopifyVariantId != null && typeof size.shopifyVariantId !== "string") {
      throw new Error(`Enter the Shopify variant ID for size ${label} as text so all digits are preserved.`);
    }
    const shopifyVariantId = String(size.shopifyVariantId ?? "").trim();
    if (!label || label.length > 20 || labels.has(label)) throw new Error("Each size needs a unique label of up to 20 characters.");
    labels.add(label);
    if (!Number.isInteger(size.stock) || size.stock < 0 || size.stock > 2147483647) throw new Error(`Enter valid stock for size ${label}.`);
    if (shopifyVariantId && (!/^[1-9]\d*$/.test(shopifyVariantId) || shopifyVariantId.length > 30)) {
      throw new Error(`Enter a numeric Shopify variant ID for size ${label}.`);
    }
    return { label, stock: size.stock, shopifyVariantId };
  });
  if (!Array.isArray(product.description) || product.description.length > 50 || product.description.some((line) => typeof line !== "string" || line.length > 2000)) {
    throw new Error("Use up to 50 description lines, each no longer than 2,000 characters.");
  }
  if (!Array.isArray(product.images) || product.images.length > 10 || product.images.some((url) => typeof url !== "string" || url.length > 4096 || !/^(https?:\/\/|\/(?!\/))/.test(url))) {
    throw new Error("Use up to 10 product image URLs beginning with https://, http://, or /.");
  }
  return {
    slug, name,
    price_cents: product.priceCents,
    sale_price_cents: product.salePriceCents ?? null,
    placement: product.placement,
    description: [...product.description],
    sizes,
    images: [...product.images],
  };
}
