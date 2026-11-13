import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_STORAGE_EMULATOR_HOST);
let environment;
before(async () => {
  if (!enabled) return;
  environment = await initializeTestEnvironment({
    projectId: "demo-solemn-rules",
    firestore: { rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8") },
    storage: { rules: await readFile(new URL("../storage.rules", import.meta.url), "utf8") },
  });
});
after(async () => { await environment?.cleanup(); });

function product(slug, extra = {}) {
  return {
    name: "Test product", slug, price_cents: 2000, sale_price_cents: null,
    placement: "new_arrivals", description: [], sizes: [{ label: "M", stock: 1, shopifyVariantId: "123" }], images: [],
    created_at: serverTimestamp(), updated_at: serverTimestamp(), ...extra,
  };
}
function createProduct(database, id, slug, extra = {}) {
  const batch = writeBatch(database);
  batch.set(doc(database, "products", id), product(slug, extra));
  batch.set(doc(database, "productSlugs", slug), { productId: id });
  return batch.commit();
}

test("anonymous and ordinary authenticated accounts cannot write products or grant admin", { skip: !enabled }, async () => {
  for (const context of [environment.unauthenticatedContext(), environment.authenticatedContext("customer")]) {
    const database = context.firestore();
    await assertFails(createProduct(database, "blocked", "blocked"));
    await assertFails(setDoc(doc(database, "admin_users", "customer"), { admin: true }));
  }
});

test("admins can create, rename and delete a product with its unique slug", { skip: !enabled }, async () => {
  const database = environment.authenticatedContext("admin-crud", { admin: true }).firestore();
  await assertSucceeds(createProduct(database, "crud", "original"));
  await assertSucceeds(getDoc(doc(environment.unauthenticatedContext().firestore(), "products", "crud")));
  await assertFails(createProduct(database, "collision", "original"));
  const rename = writeBatch(database);
  rename.update(doc(database, "products", "crud"), { slug: "renamed", updated_at: serverTimestamp() });
  rename.delete(doc(database, "productSlugs", "original"));
  rename.set(doc(database, "productSlugs", "renamed"), { productId: "crud" });
  await assertSucceeds(rename.commit());
  const remove = writeBatch(database);
  remove.delete(doc(database, "products", "crud"));
  remove.delete(doc(database, "productSlugs", "renamed"));
  await assertSucceeds(remove.commit());
  await assertSucceeds(createProduct(database, "reuse", "renamed"));
});

test("server rules reject invalid pricing and products without slug reservation", { skip: !enabled }, async () => {
  const database = environment.authenticatedContext("admin-validation", { admin: true }).firestore();
  await assertFails(createProduct(database, "invalid-price", "invalid-price", { sale_price_cents: 2000 }));
  await assertFails(createProduct(database, "negative-price", "negative-price", { price_cents: -1 }));
  await assertFails(createProduct(database, "extra-field", "extra-field", { secret: "value" }));
  await assertFails(setDoc(doc(database, "products", "unreserved"), product("unreserved")));
});

test("photo uploads require admin identity, permitted image type and size", { skip: !enabled }, async () => {
  const admin = environment.authenticatedContext("photo-admin", { admin: true }).storage();
  const customer = environment.authenticatedContext("customer").storage();
  const anonymous = environment.unauthenticatedContext().storage();
  const png = new Uint8Array([137, 80, 78, 71]);
  await assertFails(uploadBytes(ref(anonymous, "product-images/anon/image.png"), png, { contentType: "image/png" }));
  await assertFails(uploadBytes(ref(customer, "product-images/customer/image.png"), png, { contentType: "image/png" }));
  await assertFails(uploadBytes(ref(admin, "product-images/someone-else/image.png"), png, { contentType: "image/png" }));
  await assertFails(uploadBytes(ref(admin, "product-images/photo-admin/image.svg"), png, { contentType: "image/svg+xml" }));
  await assertFails(uploadBytes(ref(admin, "product-images/photo-admin/large.png"), new Uint8Array(10 * 1024 * 1024 + 1), { contentType: "image/png" }));
  await assertSucceeds(uploadBytes(ref(admin, "product-images/photo-admin/image.png"), png, { contentType: "image/png" }));
  await assertSucceeds(getBytes(ref(anonymous, "product-images/photo-admin/image.png")));
});
