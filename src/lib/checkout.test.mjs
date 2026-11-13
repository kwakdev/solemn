import assert from "node:assert/strict";
import test from "node:test";
import {
  buildShopifyCheckoutUrl,
  isShopifyVariantId,
  normalizeSavedCart,
  normalizeShopifyStoreUrl,
} from "./checkout.js";

const storeUrl = "https://solemn-example.myshopify.com";
const products = [{
  id: "hoodie",
  name: "Hoodie",
  slug: "hoodie",
  priceCents: 8000,
  salePriceCents: 6000,
  sizes: [
    { label: "S", stock: 5, shopifyVariantId: "46029714522309" },
    { label: "M", stock: 8, shopifyVariantId: "90071992547409931234" },
  ],
}];
const line = (size = "S", quantity = 1) => ({ productId: "hoodie", size, quantity });
const checkout = (cartItems, catalog = products, store = storeUrl) => buildShopifyCheckoutUrl({
  cartItems, products: catalog, storeUrl: store,
});

test("builds the reference cart permalink with exact string variant IDs and current sale prices", () => {
  const result = checkout([
    { ...line("S", 2), shopifyVariantId: "123", priceValue: 0.01 },
    line("M", 1),
  ]);
  assert.equal(result.url, `${storeUrl}/cart/46029714522309:2,90071992547409931234:1`);
  assert.equal(result.subtotal, 180);
  assert.deepEqual(result.errors, []);
});

test("aggregates duplicate variant lines and checks their combined stock", () => {
  assert.equal(checkout([line("S", 2), line("S", 3)]).url, `${storeUrl}/cart/46029714522309:5`);
  const invalid = checkout([line("S", 3), line("S", 3)]);
  assert.equal(invalid.url, "");
  assert.match(invalid.errors.join(" "), /quantity|available/);
});

test("never skips an invalid line and creates a partial checkout", () => {
  const cases = [
    { ...line(), productId: "deleted" },
    line("deleted-size"),
    null,
    { ...line(), quantity: "2" },
    line("S", 0),
    line("S", -1),
    line("S", 1.5),
    line("S", Infinity),
    line("S", Number.MAX_SAFE_INTEGER + 1),
  ];
  for (const invalidLine of cases) {
    const result = checkout([line("M"), invalidLine]);
    assert.equal(result.url, "", JSON.stringify(invalidLine));
    assert.ok(result.errors.length);
  }
});

test("requires a numeric string variant ID on the selected size", () => {
  for (const id of [undefined, "", "0", "01", "1:2,3", "123?x=y", "-123", 123, "gid://shopify/ProductVariant/123"]) {
    assert.equal(isShopifyVariantId(id), false);
    const catalog = [{ ...products[0], shopifyVariantId: "123", sizes: [{ label: "S", stock: 5, shopifyVariantId: id }] }];
    assert.equal(checkout([line()], catalog).url, "");
  }
});

test("uses changed catalog IDs, stock, and prices instead of saved metadata", () => {
  const catalog = [{ ...products[0], salePriceCents: null, priceCents: 7000,
    sizes: [{ label: "S", stock: 2, shopifyVariantId: "77777777777777" }] }];
  const result = checkout([{ ...line(), shopifyVariantId: "111", priceValue: 0 }], catalog);
  assert.equal(result.url, `${storeUrl}/cart/77777777777777:1`);
  assert.equal(result.subtotal, 70);
  assert.equal(checkout([line("S", 3)], catalog).url, "");
  assert.equal(checkout([line()], [{ ...catalog[0], sizes: [] }]).url, "");
  assert.equal(checkout([line()], []).url, "");
  assert.equal(checkout([line()], [{ ...catalog[0], sizes: [{ label: "S", stock: 0, shopifyVariantId: "777" }] }]).url, "");
});

test("validates merchant origin and prevents path, credential, and protocol injection", () => {
  assert.equal(normalizeShopifyStoreUrl("  solemn-example.myshopify.com/  "), storeUrl);
  assert.equal(normalizeShopifyStoreUrl("https://shop.example.com"), "https://shop.example.com");
  for (const invalid of ["", "http://shop.example.com", "javascript:alert(1)", "https://user:pass@shop.example.com", `${storeUrl}/cart/123:1`, `${storeUrl}?x=1`, `${storeUrl}#x`, "https://localhost", "https://shop.example.com:8080"]) {
    assert.equal(checkout([line()], products, invalid).url, "", invalid);
  }
});

test("normalizes legacy carts without trusting display data and leaves malformed lines removable", () => {
  const saved = normalizeSavedCart([
    { ...line("S", 2), cartKey: "old-key", name: "stale", priceValue: 0, shopifyVariantId: "123" },
    line("S", 1),
    null,
    { productId: "hoodie", size: "S", quantity: "2" },
  ]);
  assert.equal(saved.length, 3);
  assert.equal(saved[0].quantity, 3);
  assert.equal(saved[0].name, undefined);
  assert.equal(saved[0].shopifyVariantId, undefined);
  assert.equal(new Set(saved.map((item) => item.cartKey)).size, saved.length);
  assert.equal(checkout(saved).url, "");
  assert.equal(checkout(saved.slice(0, 1)).url, `${storeUrl}/cart/46029714522309:3`);
  assert.deepEqual(normalizeSavedCart({}), []);
});

test("empty and invalid-price carts cannot check out", () => {
  assert.equal(checkout([]).url, "");
  assert.equal(checkout(null).url, "");
  assert.equal(checkout([line()], [{ ...products[0], priceCents: -1 }]).url, "");
  assert.equal(checkout([line()], [{ ...products[0], salePriceCents: 9000 }]).url, "");
});
