import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

function normalizeSizes(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((size) => ({
      label: String(size?.label ?? "").trim().slice(0, 20),
      stock: Math.max(0, Math.floor(Number(size?.stock) || 0)),
    }))
    .filter((size) => size.label)
    .map((size) => ({ ...size, available: size.stock > 0 }));
}

export function databaseRowToProduct(row) {
  const sizes = normalizeSizes(row.sizes);
  const images = Array.isArray(row.images)
    ? row.images.filter((image) => typeof image === "string" && image)
    : [];
  const priceCents = Math.max(0, Math.round(Number(row.price_cents) || 0));
  const salePriceCents =
    Number.isInteger(row.sale_price_cents) &&
    row.sale_price_cents >= 0 &&
    row.sale_price_cents < priceCents
      ? row.sale_price_cents
      : null;
  const sellingPriceCents = salePriceCents ?? priceCents;
  const stock = sizes.reduce((total, size) => total + size.stock, 0);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: `$${(sellingPriceCents / 100).toFixed(2)}`,
    priceValue: sellingPriceCents / 100,
    priceCents,
    salePriceCents,
    regularPrice: `$${(priceCents / 100).toFixed(2)}`,
    regularPriceValue: priceCents / 100,
    placement: row.placement,
    description: Array.isArray(row.description) ? row.description : [],
    sizes,
    images,
    image: images[0] ?? "",
    stock,
    soldOut: stock === 0,
    updatedAt: row.updated_at,
  };
}

export async function loadSupabaseProducts() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(databaseRowToProduct);
}

export async function verifyAdmin() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Sign in to continue.");
  }

  const { data, error } = await supabase
    .from("admin_users")
    .select("email")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("This account does not have admin access.");
  }

  return {
    id: user.id,
    email: user.email ?? data.email,
    name: user.user_metadata?.full_name || user.email || data.email,
  };
}

export function validateProductPricing(priceCents, salePriceCents) {
  if (
    !Number.isInteger(priceCents) ||
    priceCents < 0 ||
    priceCents > 2147483647
  ) {
    throw new Error(
      "Enter a regular price from $0 to $21,474,836.47, with up to two decimal places.",
    );
  }

  if (
    salePriceCents != null &&
    (!Number.isInteger(salePriceCents) ||
      salePriceCents < 0 ||
      salePriceCents >= priceCents)
  ) {
    throw new Error(
      "Sale price must be $0 or more and lower than the regular price.",
    );
  }
}

export async function saveSupabaseProduct(product) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  validateProductPricing(product.priceCents, product.salePriceCents);

  const row = {
    slug: product.slug,
    name: product.name,
    price_cents: product.priceCents,
    sale_price_cents: product.salePriceCents ?? null,
    placement: product.placement,
    description: product.description,
    sizes: product.sizes,
    images: product.images,
  };

  async function persistRow(nextRow) {
    const query = product.id
      ? supabase.from("products").update(nextRow).eq("id", product.id)
      : supabase.from("products").insert(nextRow);
    return query.select().single();
  }

  let { data, error } = await persistRow(row);
  const missingSaleColumn =
    error?.code === "PGRST204" &&
    error.message?.includes("sale_price_cents");

  if (missingSaleColumn) {
    if (row.sale_price_cents !== null) {
      throw new Error(
        "Sale pricing setup is required. Run the sale-pricing migration in Supabase, then save again.",
      );
    }

    // Catalogs created before sale pricing can still save ordinary products.
    // Retry only when the server explicitly confirms the column is absent.
    const legacyRow = { ...row };
    delete legacyRow.sale_price_cents;
    ({ data, error } = await persistRow(legacyRow));
  }

  if (error) {
    if (error.code === "23505") {
      throw new Error("That product URL is already in use.");
    }

    throw error;
  }

  return databaseRowToProduct(data);
}

export async function deleteSupabaseProduct(productId) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  if (!productId) {
    throw new Error("Choose a saved product to delete.");
  }

  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      "Product could not be deleted. It may already have been removed or you may no longer have admin access. Refresh and try again.",
    );
  }
}

export async function uploadSupabaseProductImage(file, userId) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a valid image file.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Each product photo must be 10 MB or smaller.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}
