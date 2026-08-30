import {
  Show,
  SignIn,
  UserButton,
  useAuth,
} from "@clerk/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { NavLink } from "react-router-dom";

const emptyProduct = {
  id: "",
  name: "",
  slug: "",
  priceCents: 0,
  placement: "new_arrivals",
  description: [],
  sizes: [
    { label: "1", stock: 0 },
    { label: "2", stock: 0 },
    { label: "3", stock: 0 },
    { label: "4", stock: 0 },
  ],
  images: [],
};

const placementLabels = {
  new_arrivals: "New Arrivals",
  collection: "Collection",
  memories: "Memories",
};

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function productToDraft(product) {
  return {
    ...emptyProduct,
    ...product,
    priceCents:
      product.priceCents ??
      Math.round(Number(product.priceValue ?? 0) * 100),
    description: [...(product.description ?? [])],
    sizes: (product.sizes ?? []).map((size) => ({
      label: size.label,
      stock: Number(size.stock ?? (size.available ? 1 : 0)),
    })),
    images: [...(product.images ?? [])],
  };
}

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      "The local admin API is not running. Restart npm run dev, then reload this page.",
    );
  }

  return response.json();
}

function AdminDashboard() {
  const { getToken } = useAuth();
  const [products, setProducts] = useState([]);
  const [draft, setDraft] = useState(emptyProduct);
  const [descriptionText, setDescriptionText] = useState("");
  const [adminState, setAdminState] = useState({
    loading: true,
    user: null,
    error: "",
  });
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const authenticatedFetch = useCallback(
    async (url, options = {}) => {
      const token = await getToken();
      const headers = new Headers(
        options.headers,
      );

      if (token) {
        headers.set(
          "authorization",
          `Bearer ${token}`,
        );
      }

      return fetch(url, {
        ...options,
        headers,
      });
    },
    [getToken],
  );

  const loadProducts = useCallback(
    async () => {
      const response = await fetch(
        "/api/products",
      );
      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load products.",
        );
      }

      setProducts(data.products ?? []);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const response = await authenticatedFetch("/api/admin/me");
        const data = await readJsonResponse(response);

        if (!response.ok) {
          throw new Error(data.error || "Admin access could not be verified.");
        }

        if (!cancelled) {
          setAdminState({
            loading: false,
            user: data.user,
            error: "",
          });
          await loadProducts();
        }
      } catch (error) {
        if (!cancelled) {
          setAdminState({
            loading: false,
            user: null,
            error:
              error instanceof Error
                ? error.message
                : "Admin access could not be verified.",
          });
        }
      }
    }

    initialize();
    return () => {
      cancelled = true;
    };
  }, [authenticatedFetch, loadProducts]);

  const totalStock = useMemo(
    () =>
      draft.sizes.reduce(
        (total, size) => total + Math.max(0, Number(size.stock) || 0),
        0,
      ),
    [draft.sizes],
  );

  function startNewProduct() {
    setDraft({
      ...emptyProduct,
      sizes: emptyProduct.sizes.map((size) => ({ ...size })),
      images: [],
      description: [],
    });
    setDescriptionText("");
    setStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editProduct(product) {
    const nextDraft = productToDraft(product);
    setDraft(nextDraft);
    setDescriptionText(nextDraft.description.join("\n"));
    setStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateDraft(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateSize(index, field, value) {
    setDraft((current) => ({
      ...current,
      sizes: current.sizes.map((size, sizeIndex) =>
        sizeIndex === index
          ? {
              ...size,
              [field]:
                field === "stock"
                  ? Math.max(0, Math.floor(Number(value) || 0))
                  : value,
            }
          : size,
      ),
    }));
  }

  function addSize() {
    setDraft((current) => ({
      ...current,
      sizes: [...current.sizes, { label: "", stock: 0 }],
    }));
  }

  function removeSize(index) {
    setDraft((current) => ({
      ...current,
      sizes: current.sizes.filter((_, sizeIndex) => sizeIndex !== index),
    }));
  }

  async function uploadPhotos(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    setIsUploading(true);
    setStatus("Uploading photos…");

    try {
      const uploaded = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const response = await authenticatedFetch("/api/admin/upload", {
          method: "POST",
          body: formData,
        });
        const data = await readJsonResponse(response);

        if (!response.ok) {
          throw new Error(data.error || `Could not upload ${file.name}.`);
        }

        uploaded.push(data.url);
      }

      setDraft((current) => ({
        ...current,
        images: [...current.images, ...uploaded].slice(0, 10),
      }));
      setStatus(
        `${uploaded.length} photo${uploaded.length === 1 ? "" : "s"} uploaded.`,
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Photo upload failed.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function saveProduct(event) {
    event.preventDefault();
    setIsSaving(true);
    setStatus("Saving product…");

    const payload = {
      ...draft,
      name: draft.name.trim(),
      slug: slugify(draft.slug || draft.name),
      priceCents: Math.max(0, Math.round(Number(draft.priceCents) || 0)),
      description: descriptionText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      sizes: draft.sizes
        .map((size) => ({
          label: size.label.trim(),
          stock: Math.max(0, Math.floor(Number(size.stock) || 0)),
        }))
        .filter((size) => size.label),
    };

    try {
      const url = draft.id
        ? `/api/admin/products/${encodeURIComponent(draft.id)}`
        : "/api/admin/products";
      const response = await authenticatedFetch(url, {
        method: draft.id ? "PUT" : "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Unable to save this product.");
      }

      await loadProducts();
      const savedDraft = productToDraft(data.product);
      setDraft(savedDraft);
      setDescriptionText(savedDraft.description.join("\n"));
      setStatus("Product saved and storefront updated.");
      window.dispatchEvent(new Event("solemn-products-updated"));
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to save this product.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (adminState.loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-xl">
        Verifying admin access…
      </div>
    );
  }

  if (adminState.error) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl">Admin access unavailable</h1>
        <p className="mt-5 text-lg leading-8">{adminState.error}</p>
        <p className="mt-3 text-sm opacity-60">
          Sign in with the email address included in the site’s admin allowlist.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-8 sm:pt-36">
      <div className="flex flex-col gap-6 border-b border-[#0F4C81]/20 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] opacity-55">
            Solemn Memory
          </p>
          <h1 className="mt-2 text-4xl sm:text-5xl">Product Admin</h1>
          <p className="mt-3 text-sm opacity-60">
            Signed in as {adminState.user.email}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <NavLink
            to="/shop"
            className="border border-[#0F4C81] px-5 py-3 text-sm no-underline transition hover:bg-[#0F4C81] hover:text-white"
          >
            View storefront
          </NavLink>
          <UserButton />
        </div>
      </div>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <form onSubmit={saveProduct} className="space-y-9">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl">
              {draft.id ? "Edit product" : "Add product"}
            </h2>
            <button
              type="button"
              onClick={startNewProduct}
              className="text-sm underline underline-offset-4"
            >
              New blank product
            </button>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm">Product name</span>
              <input
                required
                value={draft.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setDraft((current) => ({
                    ...current,
                    name,
                    slug: current.id ? current.slug : slugify(name),
                  }));
                }}
                className="w-full border border-[#0F4C81]/35 bg-white px-4 py-3 outline-none focus:border-[#0F4C81]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm">Product URL</span>
              <input
                required
                value={draft.slug}
                onChange={(event) =>
                  updateDraft("slug", slugify(event.target.value))
                }
                className="w-full border border-[#0F4C81]/35 bg-white px-4 py-3 outline-none focus:border-[#0F4C81]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm">Price (USD)</span>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={(draft.priceCents / 100).toFixed(2)}
                onChange={(event) =>
                  updateDraft(
                    "priceCents",
                    Math.round(Number(event.target.value) * 100),
                  )
                }
                className="w-full border border-[#0F4C81]/35 bg-white px-4 py-3 outline-none focus:border-[#0F4C81]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm">Store section</span>
              <select
                value={draft.placement}
                onChange={(event) =>
                  updateDraft("placement", event.target.value)
                }
                className="w-full border border-[#0F4C81]/35 bg-white px-4 py-3 outline-none focus:border-[#0F4C81]"
              >
                {Object.entries(placementLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm">
              Description — one line per detail
            </span>
            <textarea
              rows="6"
              value={descriptionText}
              onChange={(event) => setDescriptionText(event.target.value)}
              className="w-full resize-y border border-[#0F4C81]/35 bg-white px-4 py-3 leading-7 outline-none focus:border-[#0F4C81]"
            />
          </label>

          <fieldset>
            <div className="flex items-end justify-between gap-4">
              <div>
                <legend className="text-xl">Stock by size</legend>
                <p className="mt-1 text-sm opacity-55">
                  Total stock: {totalStock}
                </p>
              </div>
              <button
                type="button"
                onClick={addSize}
                className="text-sm underline underline-offset-4"
              >
                Add size
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {draft.sizes.map((size, index) => (
                <div
                  key={`${index}-${size.label}`}
                  className="grid grid-cols-[1fr_1fr_auto] gap-3"
                >
                  <input
                    aria-label={`Size ${index + 1}`}
                    placeholder="Size"
                    value={size.label}
                    onChange={(event) =>
                      updateSize(index, "label", event.target.value)
                    }
                    className="min-w-0 border border-[#0F4C81]/35 px-4 py-3 outline-none focus:border-[#0F4C81]"
                  />
                  <input
                    aria-label={`Stock for size ${size.label || index + 1}`}
                    type="number"
                    min="0"
                    step="1"
                    value={size.stock}
                    onChange={(event) =>
                      updateSize(index, "stock", event.target.value)
                    }
                    className="min-w-0 border border-[#0F4C81]/35 px-4 py-3 outline-none focus:border-[#0F4C81]"
                  />
                  <button
                    type="button"
                    onClick={() => removeSize(index)}
                    className="px-3 text-2xl"
                    aria-label={`Remove size ${size.label || index + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xl">Product photos</legend>
            <p className="mt-1 text-sm opacity-55">
              Upload up to 10 JPG, PNG, GIF, or WebP images. The first photo is
              used as the main image.
            </p>

            <label className="mt-4 flex cursor-pointer items-center justify-center border border-dashed border-[#0F4C81]/50 px-5 py-8 text-center transition hover:bg-[#0F4C81]/5">
              <span>{isUploading ? "Uploading…" : "Choose product photos"}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={isUploading}
                onChange={uploadPhotos}
                className="sr-only"
              />
            </label>

            {draft.images.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {draft.images.map((image, index) => (
                  <div
                    key={`${image}-${index}`}
                    className="relative aspect-square overflow-hidden bg-neutral-50"
                  >
                    <img
                      src={image}
                      alt={`Product upload ${index + 1}`}
                      className="h-full w-full object-contain"
                    />
                    <button
                      type="button"
                      aria-label={`Remove photo ${index + 1}`}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          images: current.images.filter(
                            (_, imageIndex) => imageIndex !== index,
                          ),
                        }))
                      }
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-xl shadow"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </fieldset>

          <div className="flex flex-wrap items-center gap-5">
            <button
              type="submit"
              disabled={isSaving || isUploading}
              className="bg-[#0F4C81] px-8 py-4 text-white transition hover:opacity-80 disabled:cursor-wait disabled:opacity-45"
            >
              {isSaving ? "Saving…" : "Save product"}
            </button>
            {status && <p className="text-sm">{status}</p>}
          </div>
        </form>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl">Catalog</h2>
              <p className="mt-1 text-sm opacity-55">
                {products.length} product{products.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="mt-5 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            {products.map((product) => {
              const lowStock = product.stock > 0 && product.stock <= 3;

              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => editProduct(product)}
                  className={`grid w-full grid-cols-[72px_1fr] gap-4 border p-3 text-left transition ${
                    draft.id === product.id
                      ? "border-[#0F4C81] bg-[#0F4C81]/5"
                      : "border-[#0F4C81]/20 hover:border-[#0F4C81]/60"
                  }`}
                >
                  <div className="aspect-square overflow-hidden bg-neutral-50">
                    {product.image && (
                      <img
                        src={product.image}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate">{product.name}</p>
                    <p className="mt-1 text-xs opacity-55">
                      {placementLabels[product.placement]} · {product.stock} in
                      stock
                    </p>
                    {lowStock && (
                      <p className="mt-2 text-xs uppercase tracking-[0.15em]">
                        Only {product.stock} left
                      </p>
                    )}
                    {product.soldOut && (
                      <p className="mt-2 text-xs uppercase tracking-[0.15em]">
                        Sold out
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function AdminSetupPage() {
  return (
    <section className="flex min-h-screen items-center justify-center px-6 py-32 text-center">
      <div className="max-w-xl">
        <p className="text-sm uppercase tracking-[0.25em] opacity-55">
          Solemn Memory
        </p>
        <h1 className="mt-4 text-4xl">Admin setup required</h1>
        <p className="mt-6 text-lg leading-8">
          Clerk is not configured for this version of the site yet. Add the
          Clerk publishable key, secret key, and admin email to activate the
          protected product manager.
        </p>
      </div>
    </section>
  );
}

export default function AdminPage() {
  return (
    <section className="min-h-screen bg-[#fdfdfc] text-[#0F4C81]">
      <Show when="signed-out">
        <div className="flex min-h-screen items-center justify-center px-5 py-28">
          <div className="w-full max-w-md">
            <p className="mb-8 text-center text-3xl">solemn memory.</p>
            <SignIn
              routing="hash"
              fallbackRedirectUrl="/admin"
              appearance={{
                variables: {
                  colorPrimary: "#0F4C81",
                  colorText: "#0F4C81",
                  borderRadius: "0px",
                },
              }}
            />
          </div>
        </div>
      </Show>

      <Show when="signed-in">
        <AdminDashboard />
      </Show>
    </section>
  );
}
