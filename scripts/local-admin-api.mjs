import { createClerkClient } from "@clerk/backend";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const placements = new Set(["new_arrivals", "collection", "memories"]);
const defaultAdminEmails = ["evankwak19@gmail.com", "kwakdev03@gmail.com"];
const defaultProducts = [
  {
    id: "1",
    slug: "tole-tole-cuddle",
    name: "TOLE TOLE “CUDDLE MODE”",
    priceCents: 13800,
    placement: "new_arrivals",
    description: [
      "TOLE TOLE BEING HELD LIKE A TINY BABY",
      "EXTRA LARGE EYES AND A VERY SERIOUS FACE",
      "MAXIMUM CUDDLE MODE",
      "VERY PATIENT AND SLIGHTLY CONFUSED",
      "THE ORIGINAL TOLE TOLE PORTRAIT",
    ],
    sizes: [
      { label: "1", stock: 8 },
      { label: "2", stock: 8 },
      { label: "3", stock: 8 },
      { label: "4", stock: 8 },
    ],
    images: ["/products/cat.png"],
  },
  {
    id: "2",
    slug: "tole-tole-pineapple",
    name: "TOLE TOLE “PINEAPPLE QUEEN”",
    priceCents: 24200,
    placement: "new_arrivals",
    description: [
      "TOLE TOLE WEARING A PINEAPPLE CROWN",
      "FULL TROPICAL FRUIT ENERGY",
      "MATCHING PINEAPPLE SLICE INCLUDED IN THE PHOTO",
      "CALM, REGAL, AND SLIGHTLY JUICY",
      "THE QUEEN OF THE FRUIT BOWL",
    ],
    sizes: [
      { label: "1", stock: 8 },
      { label: "2", stock: 8 },
      { label: "3", stock: 8 },
      { label: "4", stock: 8 },
    ],
    images: ["/products/cat2.png"],
  },
  {
    id: "3",
    slug: "tole-tole-strawberry-bob",
    name: "TOLE TOLE “STRAWBERRY BOB”",
    priceCents: 5800,
    placement: "collection",
    description: [
      "TOLE TOLE WEARING A LONG BROWN BOB WIG",
      "STRAWBERRY HAIR CLIPS ON BOTH SIDES",
      "FRESH SALON LOOK",
      "SERVING A VERY SERIOUS BEAUTY POSE",
      "READY FOR HER CLOSE-UP",
    ],
    sizes: [
      { label: "1", stock: 8 },
      { label: "2", stock: 8 },
      { label: "3", stock: 8 },
      { label: "4", stock: 8 },
    ],
    images: ["/products/cat3.png"],
  },
  {
    id: "4",
    slug: "tole-tole-busy-bee",
    name: "TOLE TOLE “BUSY BEE”",
    priceCents: 13800,
    placement: "collection",
    description: [
      "TOLE TOLE WEARING A BLACK-AND-YELLOW BEE COSTUME",
      "HOOD WITH TWO SOFT ANTENNAE",
      "SITTING POLITELY IN THE KITCHEN",
      "BUSY BEE ENERGY WITHOUT THE BUZZING",
      "READY TO POLLINATE THE SNACK CABINET",
    ],
    sizes: [
      { label: "1", stock: 8 },
      { label: "2", stock: 8 },
      { label: "3", stock: 8 },
      { label: "4", stock: 8 },
    ],
    images: ["/products/cat4.png"],
  },
  {
    id: "5",
    slug: "tole-tole-cheese-head",
    name: "TOLE TOLE “CHEESE HEAD”",
    priceCents: 23200,
    placement: "memories",
    description: [
      "TOLE TOLE WEARING A GIANT CHEESE-SLICE HAT",
      "BOLD YELLOW COLOR",
      "A LITTLE ANNOYED BUT STILL FASHIONABLE",
      "SERVING SHARP CHEDDAR ATTITUDE",
      "NOT ACTUALLY MADE OF CHEESE",
    ],
    sizes: [
      { label: "1", stock: 1 },
      { label: "2", stock: 1 },
      { label: "3", stock: 1 },
      { label: "4", stock: 0 },
    ],
    images: ["/products/cat5.png"],
  },
];

function normalizeSizes(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((size) => ({
      label: String(size?.label ?? "").trim().slice(0, 20),
      stock: Math.max(0, Math.floor(Number(size?.stock) || 0)),
    }))
    .filter((size) => size.label)
    .slice(0, 20);
}

function normalizeProduct(product) {
  const sizes = normalizeSizes(product.sizes);
  const images = Array.isArray(product.images)
    ? product.images.filter((image) => typeof image === "string" && image)
    : [];
  const stock = sizes.reduce((total, size) => total + size.stock, 0);
  const priceCents = Math.max(0, Math.round(Number(product.priceCents) || 0));

  return {
    ...product,
    id: String(product.id),
    priceCents,
    priceValue: priceCents / 100,
    price: `$${(priceCents / 100).toFixed(2)}`,
    sizes: sizes.map((size) => ({ ...size, available: size.stock > 0 })),
    images,
    image: images[0] ?? "",
    stock,
    soldOut: stock === 0,
  };
}

function validateProduct(payload) {
  const name = String(payload?.name ?? "").trim().slice(0, 160);
  const slug = String(payload?.slug ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  const priceCents = Math.max(0, Math.round(Number(payload?.priceCents) || 0));
  const placement = placements.has(payload?.placement)
    ? payload.placement
    : "new_arrivals";
  const description = Array.isArray(payload?.description)
    ? payload.description
        .map((line) => String(line).trim().slice(0, 300))
        .filter(Boolean)
        .slice(0, 20)
    : [];
  const sizes = normalizeSizes(payload?.sizes);
  const images = Array.isArray(payload?.images)
    ? payload.images
        .map((image) => String(image).trim())
        .filter(
          (image) => image.startsWith("/products/") || image.startsWith("/uploads/"),
        )
        .slice(0, 10)
    : [];

  if (!name || !slug) return { error: "Product name and URL slug are required." };
  if (sizes.length === 0) return { error: "Add at least one size and stock level." };
  if (images.length === 0) return { error: "Upload at least one product photo." };

  return {
    product: { name, slug, priceCents, placement, description, sizes, images },
  };
}

function sendJson(response, data, status = 200) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(data));
}

function requestHeaders(request) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  }
  return headers;
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function webRequest(request, body) {
  const host = request.headers.host || "localhost:5173";
  const url = new URL(request.url || "/", `http://${host}`);
  const init = {
    method: request.method,
    headers: requestHeaders(request),
  };

  if (body?.length) {
    init.body = body;
    init.duplex = "half";
  }

  return new Request(url, init);
}

export function localAdminApi({ env, root = process.cwd() }) {
  const dataDirectory = resolve(root, ".local");
  const productsFile = resolve(dataDirectory, "products.json");
  const uploadsDirectory = resolve(root, "public", "uploads");
  const publishableKey =
    env.CLERK_PUBLISHABLE_KEY || env.VITE_CLERK_PUBLISHABLE_KEY || "";
  const secretKey = env.CLERK_SECRET_KEY || "";
  const configuredEmails = String(env.CLERK_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const allowedEmails = configuredEmails.length
    ? configuredEmails
    : defaultAdminEmails;

  async function loadProducts() {
    try {
      const stored = JSON.parse(await readFile(productsFile, "utf8"));
      if (Array.isArray(stored)) return stored.map(normalizeProduct);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }

    await mkdir(dataDirectory, { recursive: true });
    await writeFile(productsFile, `${JSON.stringify(defaultProducts, null, 2)}\n`);
    return defaultProducts.map(normalizeProduct);
  }

  async function persistProducts(products) {
    await mkdir(dataDirectory, { recursive: true });
    await writeFile(productsFile, `${JSON.stringify(products, null, 2)}\n`);
  }

  async function requireAdmin(request) {
    if (!publishableKey || !secretKey) {
      return { error: "Clerk is not configured in .env.local.", status: 503 };
    }

    const clerk = createClerkClient({ publishableKey, secretKey });
    const incoming = webRequest(request);
    const origin = new URL(incoming.url).origin;
    const requestState = await clerk.authenticateRequest(incoming, {
      authorizedParties: [origin, "http://localhost:5173", "http://127.0.0.1:5173"],
    });

    if (!requestState.isAuthenticated) {
      return { error: "Sign in to continue.", status: 401 };
    }

    const { userId } = requestState.toAuth();
    const user = await clerk.users.getUser(userId);
    const email =
      user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)
        ?.emailAddress || user.emailAddresses[0]?.emailAddress || "";

    if (!email || !allowedEmails.includes(email.toLowerCase())) {
      return { error: "This account does not have admin access.", status: 403 };
    }

    return {
      user: { id: userId, email, name: user.fullName || email },
    };
  }

  return {
    name: "solemn-local-admin-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(
          request.url || "/",
          `http://${request.headers.host || "localhost:5173"}`,
        );

        if (!url.pathname.startsWith("/api/")) return next();

        try {
          if (url.pathname === "/api/products" && request.method === "GET") {
            return sendJson(response, { products: await loadProducts() });
          }

          if (url.pathname === "/api/admin/me" && request.method === "GET") {
            const admin = await requireAdmin(request);
            if (admin.error) return sendJson(response, { error: admin.error }, admin.status);
            return sendJson(response, { user: admin.user });
          }

          const isCreate =
            url.pathname === "/api/admin/products" && request.method === "POST";
          const productMatch = url.pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
          const isUpdate = Boolean(productMatch) && request.method === "PUT";

          if (isCreate || isUpdate) {
            const admin = await requireAdmin(request);
            if (admin.error) return sendJson(response, { error: admin.error }, admin.status);

            const payload = JSON.parse((await readRequestBody(request)).toString("utf8") || "{}");
            const validation = validateProduct(payload);
            if (validation.error) return sendJson(response, { error: validation.error }, 400);

            const products = await loadProducts();
            const id = isUpdate ? decodeURIComponent(productMatch[1]) : randomUUID();
            const duplicate = products.find(
              (product) => product.slug === validation.product.slug && product.id !== id,
            );
            if (duplicate) {
              return sendJson(response, { error: "That product URL is already in use." }, 409);
            }

            const saved = normalizeProduct({
              ...validation.product,
              id,
              updatedAt: new Date().toISOString(),
            });
            const index = products.findIndex((product) => product.id === id);
            if (index >= 0) products[index] = saved;
            else products.unshift(saved);
            await persistProducts(products);
            return sendJson(
              response,
              { product: saved, savedBy: admin.user.email },
              isCreate ? 201 : 200,
            );
          }

          if (url.pathname === "/api/admin/upload" && request.method === "POST") {
            const admin = await requireAdmin(request);
            if (admin.error) return sendJson(response, { error: admin.error }, admin.status);

            const body = await readRequestBody(request);
            const formData = await webRequest(request, body).formData();
            const file = formData.get("file");
            if (!file || typeof file.arrayBuffer !== "function" || !file.type?.startsWith("image/")) {
              return sendJson(response, { error: "Choose a valid image file." }, 400);
            }
            if (file.size > 10 * 1024 * 1024) {
              return sendJson(response, { error: "Each product photo must be 10 MB or smaller." }, 413);
            }

            const extensions = {
              "image/png": ".png",
              "image/webp": ".webp",
              "image/gif": ".gif",
              "image/jpeg": ".jpg",
            };
            const originalExtension = extname(file.name || "").toLowerCase();
            const extension = extensions[file.type] || originalExtension || ".jpg";
            const filename = `${randomUUID()}${extension}`;
            await mkdir(uploadsDirectory, { recursive: true });
            await writeFile(resolve(uploadsDirectory, filename), Buffer.from(await file.arrayBuffer()));
            return sendJson(
              response,
              { url: `/uploads/${filename}`, name: file.name },
              201,
            );
          }

          return sendJson(response, { error: "Not found." }, 404);
        } catch (error) {
          server.config.logger.error(error instanceof Error ? error.stack || error.message : String(error));
          return sendJson(
            response,
            { error: error instanceof Error ? error.message : "Unexpected server error." },
            500,
          );
        }
      });
    },
  };
}
