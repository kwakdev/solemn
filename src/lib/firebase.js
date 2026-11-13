import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, getIdTokenResult } from "firebase/auth";
import { collection, connectFirestoreEmulator, doc, getDocsFromServer, getFirestore, limit, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { connectStorageEmulator, getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { databaseRowToProduct, productToDatabaseRow } from "./product-model.js";

export { databaseRowToProduct, validateProductPricing } from "./product-model.js";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
};
export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);
const app = isFirebaseConfigured ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;
export const auth = app ? getAuth(app) : null;
const database = app ? getFirestore(app) : null;
const storage = app ? getStorage(app) : null;

// Development-only opt-in. A production build never contacts the emulators.
if (app && import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true" && !auth.emulatorConfig) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(database, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}

function requireFirebase() {
  if (!app) throw new Error("Firebase is not configured.");
}

export async function verifyAdmin(user = auth?.currentUser) {
  requireFirebase();
  if (!user) throw new Error("Sign in to continue.");
  const token = await getIdTokenResult(user, true);
  if (token.claims.admin !== true) throw new Error("This account does not have admin access.");
  return { id: user.uid, email: user.email ?? "", name: user.displayName || user.email || "Admin" };
}

export async function loadFirebaseProducts() {
  if (!database) return null;
  // Sort locally so older imported documents without updated_at still appear.
  // Checkout also uses this loader: never accept an offline cached catalog as
  // confirmation of the current variant mapping, availability or price.
  const snapshot = await getDocsFromServer(collection(database, "products"));
  return snapshot.docs.map((entry) => databaseRowToProduct({ ...entry.data(), id: entry.id }))
    .sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
}

export async function saveFirebaseProduct(product) {
  requireFirebase();
  const row = productToDatabaseRow(product);
  const productRef = product.id ? doc(database, "products", String(product.id)) : doc(collection(database, "products"));
  const slugRef = doc(database, "productSlugs", row.slug);
  // Catch legacy documents imported without a slug reservation. New writes also
  // reserve the slug transactionally, so concurrent creates cannot collide.
  const duplicates = await getDocsFromServer(query(collection(database, "products"), where("slug", "==", row.slug), limit(2)));
  if (duplicates.docs.some((entry) => entry.id !== productRef.id)) throw new Error("That product URL is already in use.");
  await runTransaction(database, async (transaction) => {
    const existing = await transaction.get(productRef);
    const reservation = await transaction.get(slugRef);
    if (product.id && !existing.exists()) throw new Error("This product was removed. Refresh before saving.");
    if (reservation.exists() && reservation.data().productId !== productRef.id) throw new Error("That product URL is already in use.");
    const previousSlug = existing.data()?.slug;
    const previousSlugRef = previousSlug && previousSlug !== row.slug ? doc(database, "productSlugs", previousSlug) : null;
    const previousReservation = previousSlugRef ? await transaction.get(previousSlugRef) : null;
    transaction.set(productRef, {
      ...row,
      created_at: existing.data()?.created_at ?? serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    transaction.set(slugRef, { productId: productRef.id });
    if (previousReservation?.data()?.productId === productRef.id) transaction.delete(previousSlugRef);
  });
  return databaseRowToProduct({ ...row, id: productRef.id, updated_at: new Date().toISOString() });
}

export async function deleteFirebaseProduct(productId) {
  requireFirebase();
  if (!productId) throw new Error("Choose a saved product to delete.");
  const productRef = doc(database, "products", String(productId));
  await runTransaction(database, async (transaction) => {
    const product = await transaction.get(productRef);
    if (!product.exists()) throw new Error("Product could not be deleted. It may already have been removed. Refresh and try again.");
    const slugRef = doc(database, "productSlugs", product.data().slug);
    const reservation = await transaction.get(slugRef);
    transaction.delete(productRef);
    if (reservation.data()?.productId === productRef.id) transaction.delete(slugRef);
  });
}

export async function uploadFirebaseProductImage(file, userId) {
  requireFirebase();
  if (!auth.currentUser || auth.currentUser.uid !== userId) throw new Error("Sign in to upload photos.");
  const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
  const extension = extensions[file.type];
  if (!extension) throw new Error("Choose a JPEG, PNG, WebP, or GIF image.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Each product photo must be 10 MB or smaller.");
  const imageRef = ref(storage, `product-images/${userId}/${crypto.randomUUID()}.${extension}`);
  await uploadBytes(imageRef, file, { cacheControl: "public,max-age=31536000", contentType: file.type });
  return getDownloadURL(imageRef);
}
