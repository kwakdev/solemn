# Solemn Memory

React + Vite storefront using Firebase Authentication for admin sign-in, Cloud
Firestore for the catalog, and Cloud Storage for product photos. Checkout uses
Shopify cart permalinks, with the variant IDs entered in the product admin.

## Firebase setup

1. Create or select a project in the [Firebase console](https://console.firebase.google.com/),
   register a **Web app**, and copy its web configuration.
2. Enable **Authentication > Sign-in method > Email/Password**. Create the admin
   account under **Authentication > Users**. Add the production/preview domains
   and `localhost` under **Authentication > Settings > Authorized domains**.
3. Create a **Cloud Firestore** database in production mode and initialize
   **Storage**. Photo storage requires the Blaze billing plan; see the
   [Firebase Storage billing requirements](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).
4. Copy `.env.example` to `.env.local` and replace every placeholder with your
   project's configuration. Set `VITE_SHOPIFY_STORE_URL` to the store that owns
   your products. Use the exact Storage bucket from Firebase settings, which
   may end in `.firebasestorage.app` or `.appspot.com`.
5. Install the dependencies, then deploy the included security rules:

   ```sh
   npm install
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage --project YOUR_PROJECT_ID
   ```

6. Grant the existing admin account its `admin: true` custom claim from a trusted
   local environment using Application Default Credentials. For example, set
   `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON file kept outside
   this repository, then run:

   ```sh
   node scripts/firebase-admin.mjs --project-id YOUR_PROJECT_ID --email ADMIN_EMAIL
   ```

   This preserves any other custom claims. Sign out and back in after a claim
   change. Append `--revoke` to remove admin access; existing ID tokens can
   remain valid for up to an hour. See [Firebase custom claims](https://firebase.google.com/docs/auth/admin/custom-claims).
7. Set the same `VITE_` configuration in the hosting provider's environment
   settings and rebuild/redeploy. Visit `/admin` and sign in.

Firebase web configuration is intended for the browser. Service-account keys,
Admin SDK credentials, and other private credentials must never be placed in a
`VITE_` variable or committed. Authentication alone does not grant catalog write
access: the deployed Firestore and Storage rules require the admin claim. The app
does not expose account registration or claim assignment.

## Moving the existing catalog

The application no longer reads Supabase. Before production cutover:

1. Export `public.products` from Supabase as a JSON array, preserving `id`,
   `slug`, prices, descriptions, sizes/stock, images, placement, and timestamps.
   Resume the old project temporarily if necessary to retrieve your data.
2. Re-upload existing Supabase photos through Firebase Storage, copy the new
   download URLs into the export, or re-upload them from `/admin` after creating
   the products without those old photos. Local `/products/...` assets can stay
   unchanged. The importer rejects Supabase-hosted photo URLs so a paused old
   project cannot silently break the migrated catalog. It never downloads photos.
3. Validate the export locally; this dry run does not need credentials or write
   to Firebase:

   ```sh
   node scripts/migrate-products-to-firebase.mjs --input path/to/products.json
   ```

4. With Application Default Credentials available, run the reviewed import:

   ```sh
   node scripts/migrate-products-to-firebase.mjs --input path/to/products.json --project-id YOUR_PROJECT_ID --write
   ```

   Each file imports atomically, creates both product and unique-slug documents,
   and refuses to overwrite an existing product or slug. Limit each file to 250
   products. Existing product IDs are retained, preserving saved cart references.
   Keep the source export as a backup; this script never changes Supabase.
5. Re-create admin accounts in Firebase and grant their claims as above. Supabase
   sessions and passwords are not migrated by this script. Existing users must
   use their new Firebase credentials.
6. Verify catalog reads, admin sign-in, product create/edit/delete, image upload,
   and checkout against the configured project before retiring Supabase. Remove
   the old `VITE_SUPABASE_*` environment variables from local and hosted settings.

The `supabase/` SQL files are historical migration references and are not used at
runtime. Product documents retain the old snake_case field names; every size
can additionally store a `shopifyVariantId` string. Unique slugs are reserved in
`productSlugs/{slug}`. Do not import products directly without those reservations.

## Checkout product IDs

The link builder follows [lightmerch's checkout](https://github.com/kwakdev/lightmerch):
`https://YOUR_STORE.myshopify.com/cart/VARIANT_ID:QUANTITY,VARIANT_ID:QUANTITY`.
Shopify requires a **variant ID**, not the parent product ID. Each size has its
own variant ID, including the default variant of a product with one size.

In `/admin`, add the product, enter its stock and Shopify variant ID for each
size, then save. IDs are stored as text so long IDs retain every digit. Products
with missing IDs can still be saved, but their checkout remains unavailable
until configured. Store and variant IDs are never inferred from the example
project. Shopify controls final prices, taxes, shipping, availability, and payment;
keep Shopify prices and inventory aligned with the catalog. This permalink
integration does not synchronize orders or decrement Firestore stock.

## Sale pricing

In **Admin**, enter the regular price, check **Put this product on sale**, enter
a lower sale price, and save. **Remove sale** restores the regular price after
saving. `priceCents` remains the regular price and `salePriceCents` is optional.
Storefront `price` and `priceValue` reflect the sale price when present. The
corresponding Shopify variant must have the intended checkout price too.

## Development and checks

Use Node.js 24.12 or newer for the installed Firebase SDK.

```sh
npm install
npm run dev
npm run lint
npm test
npm run build
```

To exercise security rules locally, start the Firebase emulators with a demo
project (requires Java for Firestore):

```sh
npx firebase-tools emulators:exec --only firestore,storage --project demo-solemn-rules "node --test tests/firebase-rules.test.mjs"
```

For local browser testing, run `npx firebase-tools emulators:start --only auth,firestore,storage --project demo-solemn-rules`.
Use demo Firebase web configuration and set `VITE_USE_FIREBASE_EMULATORS=true` in
`.env.local`, then restart Vite. The development app connects only to local Auth
on port 9099, Firestore on 8080, and Storage on 9199. This flag is ignored in
production builds. Remove it before working against a real project.

Production Firebase services and Shopify checkout require real project/store configuration.
The local build cannot verify production credentials, security-rule deployment,
or the ownership of an entered Shopify variant ID.
