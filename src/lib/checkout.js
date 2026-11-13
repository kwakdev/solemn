export function isShopifyVariantId(value) {
  return typeof value === "string" && /^[1-9]\d{0,29}$/.test(value);
}

export function normalizeShopifyStoreUrl(value) {
  const input = typeof value === "string" ? value.trim() : "";
  if (!input) return "";

  try {
    const url = new URL(input.includes("://") ? input : `https://${input}`);
    if (
      url.protocol !== "https:" ||
      url.username || url.password || url.port || url.search || url.hash ||
      (url.pathname !== "/" && url.pathname !== "") ||
      !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(url.hostname)
    ) return "";
    return url.origin;
  } catch {
    return "";
  }
}

function productKey(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Number.isSafeInteger(value) && value > 0) return String(value);
  return "";
}

export function cartItemKey(productId, size) {
  return JSON.stringify([productKey(productId), size]);
}

// Retain malformed lines so the buyer can see and remove them rather than
// silently checking out only part of a damaged or outdated saved cart.
export function normalizeSavedCart(value) {
  if (!Array.isArray(value)) return [];
  const lines = new Map();
  value.forEach((item, index) => {
    const productId = productKey(item?.productId);
    const size = typeof item?.size === "string" ? item.size.trim() : "";
    const validQuantity = Number.isSafeInteger(item?.quantity) && item.quantity > 0;
    const valid = Boolean(productId && size && validQuantity);
    const cartKey = valid ? cartItemKey(productId, size) : `invalid-${index}`;
    const existing = lines.get(cartKey);
    const quantity = validQuantity ? item.quantity : 0;
    lines.set(cartKey, {
      cartKey,
      productId,
      size,
      quantity: existing ? existing.quantity + quantity : quantity,
    });
  });
  return [...lines.values()];
}

function sellingPriceCents(product) {
  const regular = product.priceCents ?? Math.round(product.priceValue * 100);
  const sale = product.salePriceCents;
  if (!Number.isSafeInteger(regular) || regular < 0) return null;
  if (sale == null) return regular;
  return Number.isSafeInteger(sale) && sale >= 0 && sale < regular ? sale : null;
}

export function resolveCart(cartItems, products) {
  const catalog = new Map((Array.isArray(products) ? products : [])
    .map((product) => [productKey(product.id), product]));
  const errors = [];
  const variantTotals = new Map();
  const sizeTotals = new Map();
  let subtotalCents = 0;

  const items = (Array.isArray(cartItems) ? cartItems : []).map((item, index) => {
    const product = catalog.get(productKey(item?.productId));
    const size = product?.sizes?.find((entry) => entry.label === item?.size);
    const quantity = item?.quantity;
    const validQuantity = Number.isSafeInteger(quantity) && quantity > 0;
    const priceCents = product ? sellingPriceCents(product) : null;
    const maxQuantity = Number.isSafeInteger(size?.stock) && size.stock > 0 ? size.stock : 0;
    const name = product?.name || "Unavailable product";
    const label = `${name}${item?.size ? ` (size ${item.size})` : ""}`;
    const variantId = size?.shopifyVariantId;

    if (!product) errors.push("A product in your cart is no longer available. Remove it to continue.");
    else if (!size) errors.push(`${name}: this size is no longer available. Remove it and choose another size.`);
    else if (maxQuantity === 0) errors.push(`${label} is sold out. Remove it to continue.`);
    else if (!isShopifyVariantId(variantId)) errors.push(`${label} is not ready for checkout. Remove it or contact the store.`);
    if (!validQuantity) errors.push(`${label}: remove this item and add it again with a valid quantity.`);
    if (product && priceCents === null) errors.push(`${name}: pricing is unavailable. Please contact the store.`);

    if (product && size && validQuantity) {
      const key = cartItemKey(product.id, size.label);
      const total = (sizeTotals.get(key) || 0) + quantity;
      sizeTotals.set(key, total);
      if (total > maxQuantity) errors.push(`${label}: only ${maxQuantity} available. Reduce the quantity or remove it.`);
      if (isShopifyVariantId(variantId)) {
        const existing = variantTotals.get(variantId);
        variantTotals.set(variantId, {
          quantity: (existing?.quantity || 0) + quantity,
          stock: Math.min(existing?.stock ?? maxQuantity, maxQuantity),
          label,
        });
      }
    }
    if (validQuantity && priceCents !== null) subtotalCents += priceCents * quantity;

    return {
      cartKey: item?.cartKey || `invalid-${index}`,
      productId: productKey(item?.productId),
      size: typeof item?.size === "string" ? item.size : "",
      quantity: validQuantity ? quantity : 0,
      name,
      slug: product?.slug || "",
      image: product?.image || product?.images?.[0] || "",
      priceValue: (priceCents ?? 0) / 100,
      maxQuantity,
      shopifyVariantId: variantId || "",
    };
  });

  for (const { quantity, stock, label } of variantTotals.values()) {
    if (!Number.isSafeInteger(quantity) || quantity > stock) {
      errors.push(`${label}: the combined quantity exceeds available stock. Reduce the quantity or remove it.`);
    }
  }
  if (!Number.isSafeInteger(subtotalCents)) errors.push("Your cart total is invalid. Reduce quantities or clear your cart.");
  if (!Array.isArray(cartItems)) errors.push("Your saved cart is invalid. Clear it and add your items again.");

  return {
    items,
    errors: [...new Set(errors)],
    subtotal: Number.isSafeInteger(subtotalCents) ? subtotalCents / 100 : 0,
    variantTotals,
  };
}

export function buildShopifyCheckoutUrl({ storeUrl, cartItems, products }) {
  const resolved = resolveCart(cartItems, products);
  const errors = [...resolved.errors];
  const origin = normalizeShopifyStoreUrl(storeUrl);
  if (!origin) errors.push("Online checkout is not available yet. Please contact the store.");
  if (!resolved.items.length) errors.push("Add an item to your cart before checking out.");
  const lineItems = [...resolved.variantTotals].map(([id, item]) => `${id}:${item.quantity}`).join(",");
  return {
    ...resolved,
    errors,
    url: errors.length ? "" : `${origin}/cart/${lineItems}`,
  };
}
