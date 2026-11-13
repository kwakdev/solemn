import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { validateMigrationRows } from "./migration-product-data.mjs";

const { values } = parseArgs({
  options: {
    input: { type: "string" },
    "project-id": { type: "string" },
    write: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  console.log("Usage: node scripts/migrate-products-to-firebase.mjs --input products.json [--project-id PROJECT_ID --write]");
  console.log("Without --write, validate the local export only; no Firebase credentials or network needed.");
} else {
  try {
    if (!values.input) throw new Error("Provide a Supabase product JSON export using --input.");
    const products = validateMigrationRows(JSON.parse(await readFile(values.input, "utf8")));
    console.log(`Validated ${products.length} products, including prices, sizes, checkout IDs, and image URLs.`);
    if (!values.write) {
      console.log("Dry run complete. Nothing was written. Add --project-id PROJECT_ID --write to import.");
    } else {
      if (!values["project-id"]) throw new Error("--write requires an explicit --project-id.");
      // Two documents per product fit Firestore's atomic batch limit. Larger
      // catalogs must be split deliberately; never leave a partial batch import.
      if (products.length > 250) throw new Error("Import at most 250 products per file; split larger exports before writing.");
      if (products.length) {
        const { initializeApp, applicationDefault } = await import("firebase-admin/app");
        const { getFirestore, Timestamp } = await import("firebase-admin/firestore");
        const app = initializeApp({ credential: applicationDefault(), projectId: values["project-id"] });
        const db = getFirestore(app);
        const existingProducts = await db.collection("products").select("slug").get();
        const existingIds = new Set(existingProducts.docs.map((document) => document.id));
        const existingSlugs = new Set(existingProducts.docs.map((document) => document.get("slug")));
        for (const product of products) {
          if (existingIds.has(product.id) || existingSlugs.has(product.data.slug)) throw new Error(`Product ${product.data.slug} already exists. Import cancelled; no changes written.`);
        }
        const batch = db.batch();
        const now = Timestamp.now();
        for (const product of products) {
          batch.create(db.doc(`products/${product.id}`), {
            ...product.data,
            created_at: product.createdAt ? Timestamp.fromDate(new Date(product.createdAt)) : now,
            updated_at: product.updatedAt ? Timestamp.fromDate(new Date(product.updatedAt)) : now,
          });
          batch.create(db.doc(`productSlugs/${product.data.slug}`), { productId: product.id });
        }
        await batch.commit();
      }
      console.log(`Imported ${products.length} products into ${values["project-id"]}; existing documents were not overwritten.`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
