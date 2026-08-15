import { createClerkClient } from "@clerk/backend";

const PRODUCT_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL DEFAULT 0,
    placement TEXT NOT NULL DEFAULT 'new_arrivals',
    description_json TEXT NOT NULL DEFAULT '[]',
    sizes_json TEXT NOT NULL DEFAULT '[]',
    images_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const PRODUCT_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS products_placement_idx
  ON products (placement, updated_at DESC)
`;

const placements = new Set([
  "new_arrivals",
  "collection",
  "memories",
]);

function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeSizes(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((size) => ({
      label: String(size?.label ?? "").trim().slice(0, 20),
      stock: Math.max(0, Math.floor(Number(size?.stock) || 0)),
    }))
    .filter((size) => size.label);
}

function rowToProduct(row) {
  const sizes = normalizeSizes(parseJson(row.sizes_json, []));
  const images = parseJson(row.images_json, []).filter(
    (image) => typeof image === "string" && image,
  );
  const stock = sizes.reduce((total, size) => total + size.stock, 0);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: `$${(row.price_cents / 100).toFixed(2)}`,
    priceValue: row.price_cents / 100,
    priceCents: row.price_cents,
    placement: row.placement,
    description: parseJson(row.description_json, []),
    sizes: sizes.map((size) => ({
      ...size,
      available: size.stock > 0,
    })),
    images,
    image: images[0] ?? "",
    stock,
    soldOut: stock === 0,
    updatedAt: row.updated_at,
  };
}

async function ensureSchema(env) {
  if (!env.DB) {
    throw new Error("Product database is unavailable.");
  }

  await env.DB.batch([
    env.DB.prepare(PRODUCT_TABLE_SQL),
    env.DB.prepare(PRODUCT_INDEX_SQL),
  ]);
}

function validateProduct(payload) {
  const name = String(payload?.name ?? "").trim().slice(0, 160);
  const slug = String(payload?.slug ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  const priceCents = Math.max(
    0,
    Math.round(Number(payload?.priceCents) || 0),
  );
  const placement = placements.has(payload?.placement)
    ? payload.placement
    : "new_arrivals";
  const description = Array.isArray(payload?.description)
    ? payload.description
        .map((line) => String(line).trim().slice(0, 300))
        .filter(Boolean)
        .slice(0, 20)
    : [];
  const sizes = normalizeSizes(payload?.sizes).slice(0, 20);
  const images = Array.isArray(payload?.images)
    ? payload.images
        .map((image) => String(image).trim())
        .filter(
          (image) =>
            image.startsWith("/api/media/") ||
            image.startsWith("/products/"),
        )
        .slice(0, 10)
    : [];

  if (!name || !slug) {
    return { error: "Product name and URL slug are required." };
  }

  if (sizes.length === 0) {
    return { error: "Add at least one size and stock level." };
  }

  if (images.length === 0) {
    return { error: "Upload at least one product photo." };
  }

  return {
    product: {
      name,
      slug,
      priceCents,
      placement,
      description,
      sizes,
      images,
    },
  };
}

async function requireAdmin(request, env) {
  if (!env.CLERK_SECRET_KEY || !env.CLERK_PUBLISHABLE_KEY) {
    return {
      error: json(
        { error: "Clerk has not been configured for this site." },
        { status: 503 },
      ),
    };
  }

  const origin = new URL(request.url).origin;
  const clerk = createClerkClient({
    secretKey: env.CLERK_SECRET_KEY,
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
  });
  const requestState = await clerk.authenticateRequest(request, {
    authorizedParties: [origin],
  });

  if (!requestState.isAuthenticated) {
    return {
      error: json({ error: "Sign in to continue." }, { status: 401 }),
    };
  }

  const { userId } = requestState.toAuth();
  const user = await clerk.users.getUser(userId);
  const primaryEmail =
    user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId,
    )?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    "";
  const allowedEmails = String(env.CLERK_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!primaryEmail || !allowedEmails.includes(primaryEmail.toLowerCase())) {
    return {
      error: json(
        { error: "This account does not have admin access." },
        { status: 403 },
      ),
    };
  }

  return {
    user: {
      id: userId,
      email: primaryEmail,
      name: user.fullName || primaryEmail,
    },
  };
}

async function listProducts(request, env) {
  await ensureSchema(env);
  const placement = new URL(request.url).searchParams.get("placement");
  const query =
    placement && placements.has(placement)
      ? env.DB.prepare(
          "SELECT * FROM products WHERE placement = ? ORDER BY updated_at DESC, created_at DESC",
        ).bind(placement)
      : env.DB.prepare(
          "SELECT * FROM products ORDER BY updated_at DESC, created_at DESC",
        );
  const { results = [] } = await query.all();

  return json({
    products: results.map(rowToProduct),
  });
}

async function saveProduct(request, env, productId) {
  const admin = await requireAdmin(request, env);
  if (admin.error) {
    return admin.error;
  }

  await ensureSchema(env);
  const validation = validateProduct(await request.json());

  if (validation.error) {
    return json({ error: validation.error }, { status: 400 });
  }

  const product = validation.product;
  const id = productId || crypto.randomUUID();

  try {
    await env.DB.prepare(
      `INSERT INTO products (
        id, slug, name, price_cents, placement,
        description_json, sizes_json, images_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        name = excluded.name,
        price_cents = excluded.price_cents,
        placement = excluded.placement,
        description_json = excluded.description_json,
        sizes_json = excluded.sizes_json,
        images_json = excluded.images_json,
        updated_at = CURRENT_TIMESTAMP`,
    )
      .bind(
        id,
        product.slug,
        product.name,
        product.priceCents,
        product.placement,
        JSON.stringify(product.description),
        JSON.stringify(product.sizes),
        JSON.stringify(product.images),
      )
      .run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      return json(
        { error: "That product URL is already in use." },
        { status: 409 },
      );
    }

    throw error;
  }

  const row = await env.DB.prepare(
    "SELECT * FROM products WHERE id = ?",
  )
    .bind(id)
    .first();

  return json(
    { product: rowToProduct(row), savedBy: admin.user.email },
    { status: productId ? 200 : 201 },
  );
}

async function uploadProductImage(request, env) {
  const admin = await requireAdmin(request, env);
  if (admin.error) {
    return admin.error;
  }

  if (!env.PRODUCT_IMAGES) {
    return json(
      { error: "Product image storage is unavailable." },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return json({ error: "Choose a valid image file." }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return json(
      { error: "Each product photo must be 10 MB or smaller." },
      { status: 413 },
    );
  }

  const extension =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";
  const key = `products/${crypto.randomUUID()}.${extension}`;

  await env.PRODUCT_IMAGES.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      uploadedBy: admin.user.email,
      originalName: file.name.slice(0, 200),
    },
  });

  return json(
    {
      url: `/api/media/${key}`,
      name: file.name,
    },
    { status: 201 },
  );
}

async function serveMedia(request, env, key) {
  if (!env.PRODUCT_IMAGES || !key.startsWith("products/")) {
    return new Response("Not found", { status: 404 });
  }

  const object = await env.PRODUCT_IMAGES.get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
}

async function handleApi(request, env, url) {
  if (url.pathname === "/api/config" && request.method === "GET") {
    return json({
      clerkPublishableKey: env.CLERK_PUBLISHABLE_KEY ?? "",
    });
  }

  if (url.pathname === "/api/products" && request.method === "GET") {
    return listProducts(request, env);
  }

  if (url.pathname === "/api/admin/me" && request.method === "GET") {
    const admin = await requireAdmin(request, env);
    return admin.error ?? json({ user: admin.user });
  }

  if (url.pathname === "/api/admin/products" && request.method === "POST") {
    return saveProduct(request, env, null);
  }

  const productMatch = url.pathname.match(
    /^\/api\/admin\/products\/([^/]+)$/,
  );
  if (productMatch && request.method === "PUT") {
    return saveProduct(
      request,
      env,
      decodeURIComponent(productMatch[1]),
    );
  }

  if (url.pathname === "/api/admin/upload" && request.method === "POST") {
    return uploadProductImage(request, env);
  }

  const mediaMatch = url.pathname.match(/^\/api\/media\/(.+)$/);
  if (mediaMatch && request.method === "GET") {
    return serveMedia(request, env, decodeURIComponent(mediaMatch[1]));
  }

  return json({ error: "Not found." }, { status: 404 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (error) {
        return json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Unexpected server error.",
          },
          { status: 500 },
        );
      }
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) {
      return response;
    }

    const fallbackUrl = new URL(request.url);
    fallbackUrl.pathname = "/index.html";
    return env.ASSETS.fetch(new Request(fallbackUrl, request));
  },
};
