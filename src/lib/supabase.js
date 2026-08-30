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
  const stock = sizes.reduce((total, size) => total + size.stock, 0);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: `$${(priceCents / 100).toFixed(2)}`,
    priceValue: priceCents / 100,
    priceCents,
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

export async function saveSupabaseProduct(product) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const row = {
    slug: product.slug,
    name: product.name,
    price_cents: product.priceCents,
    placement: product.placement,
    description: product.description,
    sizes: product.sizes,
    images: product.images,
  };

  const query = product.id
    ? supabase.from("products").update(row).eq("id", product.id)
    : supabase.from("products").insert(row);
  const { data, error } = await query.select().single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("That product URL is already in use.");
    }

    throw error;
  }

  return databaseRowToProduct(data);
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
