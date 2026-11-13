import assert from "node:assert/strict";
import { test } from "node:test";
import { validateMigrationRows } from "../scripts/migration-product-data.mjs";

const row = {
  id: "old-product-id",
  slug: "shirt",
  name: "Shirt",
  price_cents: 5000,
  sale_price_cents: 4000,
  placement: "new_arrivals",
  description: ["Cotton shirt"],
  sizes: [{ label: "M", stock: 5, shopifyVariantId: "12345678901234567890" }],
  images: ["/products/shirt.png"],
  created_at: "2026-01-01T00:00:00Z",
};

test("migration preserves existing IDs, prices, timestamps and long variant IDs", () => {
  const [result] = validateMigrationRows([row]);
  assert.equal(result.id, row.id);
  assert.equal(result.data.sale_price_cents, 4000);
  assert.equal(result.data.sizes[0].shopifyVariantId, row.sizes[0].shopifyVariantId);
  assert.equal(result.createdAt, row.created_at);
});

test("migration rejects invalid values instead of silently coercing them", () => {
  assert.throws(() => validateMigrationRows([{ ...row, price_cents: "5000" }]), /regular price/);
  assert.throws(() => validateMigrationRows([{ ...row, sale_price_cents: 5000 }]), /Sale price/);
  assert.throws(() => validateMigrationRows([{ ...row, sizes: [{ label: "M", stock: 5, shopifyVariantId: 123 }] }]), /string Shopify/);
  assert.throws(() => validateMigrationRows([{ ...row, created_at: "not-a-date" }]), /timestamp/);
});

test("migration rejects duplicate identities and paused-Supabase image dependencies", () => {
  assert.throws(() => validateMigrationRows([row, row]), /duplicates/);
  assert.throws(() => validateMigrationRows([row, { ...row, id: "different-id" }]), /duplicates/);
  assert.throws(() => validateMigrationRows([{ ...row, images: ["https://example.supabase.co/storage/v1/object/public/product-images/test.png"] }]), /Supabase-hosted photos/);
});

test("legacy sizes without variant IDs remain editable after import", () => {
  const [result] = validateMigrationRows([{ ...row, sizes: [{ label: "M", stock: 5 }] }]);
  assert.equal(result.data.sizes[0].shopifyVariantId, "");
});
