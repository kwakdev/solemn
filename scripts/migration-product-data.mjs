import { productToDatabaseRow } from "../src/lib/product-model.js";

export function validateMigrationRows(rows) {
  if (!Array.isArray(rows)) throw new Error("The export must contain a JSON array of product rows.");
  const ids = new Set();
  const slugs = new Set();
  return rows.map((row, index) => {
    const label = `Product ${index + 1}`;
    if (!row || typeof row !== "object") throw new Error(`${label} must be an object.`);
    if (typeof row.id !== "string" || !row.id || row.id.length > 128 || row.id.includes("/") || row.id === "." || row.id === "..") throw new Error(`${label} has an invalid id.`);
    if (typeof row.name !== "string" || typeof row.slug !== "string") throw new Error(`${label} name and slug must be strings.`);
    if (!Array.isArray(row.sizes) || row.sizes.some((size) => !size || typeof size.label !== "string" || (size.shopifyVariantId != null && typeof size.shopifyVariantId !== "string"))) throw new Error(`${label} sizes need string labels and string Shopify variant IDs.`);
    // Validate raw fields before saving; the display converter intentionally
    // coerces legacy data and must not silently repair a migration export.
    const data = productToDatabaseRow({
      slug: row.slug,
      name: row.name,
      priceCents: row.price_cents,
      salePriceCents: row.sale_price_cents ?? null,
      placement: row.placement,
      description: row.description,
      images: row.images,
      sizes: row.sizes,
    });
    if (ids.has(row.id) || slugs.has(data.slug)) throw new Error(`${label} duplicates an id or slug in the export.`);
    ids.add(row.id);
    slugs.add(data.slug);
    for (const image of data.images) {
      if (image.startsWith("/") && !image.startsWith("//")) continue;
      const url = new URL(image);
      if (/(^|\.)supabase\.(co|in|net)$/.test(url.hostname)) throw new Error(`${label} still uses Supabase-hosted photos. Re-upload them to Firebase and replace those URLs before importing.`);
    }
    for (const field of ["created_at", "updated_at"]) {
      if (row[field] != null && (typeof row[field] !== "string" || !Number.isFinite(Date.parse(row[field])))) throw new Error(`${label} has an invalid ${field} timestamp.`);
    }
    return { id: row.id, data, createdAt: row.created_at, updatedAt: row.updated_at };
  });
}
