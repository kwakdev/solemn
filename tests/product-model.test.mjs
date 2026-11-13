import assert from "node:assert/strict";
import test from "node:test";
import { databaseRowToProduct, productToDatabaseRow } from "../src/lib/product-model.js";

const product = {
  name: "T-shirt", slug: "t-shirt", priceCents: 3000, salePriceCents: 2400,
  placement: "new_arrivals", description: ["Cotton"], images: ["/products/shirt.png"],
  sizes: [{ label: "M", stock: 4, shopifyVariantId: "12345678901234567890" }],
};

test("catalog round trip preserves checkout variant strings, sale pricing and stock", () => {
  const result = databaseRowToProduct({ ...productToDatabaseRow(product), id: "shirt" });
  assert.equal(result.sizes[0].shopifyVariantId, "12345678901234567890");
  assert.equal(result.priceCents, 3000);
  assert.equal(result.salePriceCents, 2400);
  assert.equal(result.priceValue, 24);
  assert.equal(result.regularPriceValue, 30);
  assert.equal(result.stock, 4);
  assert.equal(result.soldOut, false);
});

test("legacy products keep blank checkout mapping without inventing identifiers", () => {
  const row = productToDatabaseRow({ ...product, sizes: [{ label: "One size", stock: 0 }] });
  assert.equal(row.sizes[0].shopifyVariantId, "");
  assert.equal(databaseRowToProduct(row).soldOut, true);
  assert.equal(databaseRowToProduct({ ...row, sizes: [{ label: "M", stock: 1, shopifyVariantId: 123 }] }).sizes[0].shopifyVariantId, "");
  assert.throws(() => productToDatabaseRow({ ...product, sizes: [{ label: "M", stock: 1, shopifyVariantId: 12345678901234567890 }] }), /as text/);
});

test("invalid prices, duplicate sizes, and malformed variant IDs are rejected", () => {
  assert.throws(() => productToDatabaseRow({ ...product, salePriceCents: 3000 }), /Sale price/);
  assert.throws(() => productToDatabaseRow({ ...product, priceCents: 1.5 }), /regular price/);
  assert.throws(() => productToDatabaseRow({ ...product, sizes: [product.sizes[0], product.sizes[0]] }), /unique label/);
  for (const shopifyVariantId of ["123:4", "123,456", "gid://shopify/Product/123", "0", "1e3"]) {
    assert.throws(() => productToDatabaseRow({ ...product, sizes: [{ label: "M", stock: 1, shopifyVariantId }] }), /numeric Shopify variant ID/);
  }
  assert.throws(() => productToDatabaseRow({ ...product, sizes: [{ label: "M", stock: -1 }] }), /valid stock/);
});

test("image URLs and product URL paths are validated before persistence", () => {
  assert.throws(() => productToDatabaseRow({ ...product, images: ["javascript:alert(1)"] }), /image URLs/);
  assert.throws(() => productToDatabaseRow({ ...product, images: ["//untrusted.example/image.png"] }), /image URLs/);
  assert.throws(() => productToDatabaseRow({ ...product, slug: "../other" }), /product URL/);
});
