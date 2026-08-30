import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  NavLink,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import AdminPage, {
  AdminSetupPage,
} from "./AdminPage";

const CART_STORAGE_KEY = "solemn-cart";

function normalizeCatalogProduct(product) {
  const sizes = (product.sizes ?? []).map((size) => ({
    ...size,
    stock: Math.max(
      0,
      Number(
        size.stock ??
          (size.available ? 1 : 0),
      ) || 0,
    ),
    available:
      Number(
        size.stock ??
          (size.available ? 1 : 0),
      ) > 0,
  }));
  const stock = sizes.reduce(
    (total, size) => total + size.stock,
    0,
  );

  return {
    ...product,
    sizes,
    images:
      product.images?.length > 0
        ? product.images
        : product.image
          ? [product.image]
          : [],
    image:
      product.image ??
      product.images?.[0] ??
      "",
    stock,
    soldOut: stock === 0,
  };
}

const products = [
  {
    id: 1,
    slug: "tole-tole-cuddle",
    name: 'TOLE TOLE “CUDDLE MODE”',
    price: "$138.00",
    priceValue: 138,
    image: "/products/cat.png",

    images: ["/products/cat.png"],

    sizes: [
      { label: "1", stock: 8, available: true },
      { label: "2", stock: 8, available: true },
      { label: "3", stock: 8, available: true },
      { label: "4", stock: 8, available: true },
    ],

    placement: "new_arrivals",
    soldOut: false,

    description: [
      "TOLE TOLE BEING HELD LIKE A TINY BABY",
      "EXTRA LARGE EYES AND A VERY SERIOUS FACE",
      "MAXIMUM CUDDLE MODE",
      "VERY PATIENT AND SLIGHTLY CONFUSED",
      "THE ORIGINAL TOLE TOLE PORTRAIT",
    ],
  },

  {
    id: 2,
    slug: "tole-tole-pineapple",
    name: 'TOLE TOLE “PINEAPPLE QUEEN”',
    price: "$242.00",
    priceValue: 242,
    image: "/products/cat2.png",

    images: ["/products/cat2.png"],

    sizes: [
      { label: "1", stock: 8, available: true },
      { label: "2", stock: 8, available: true },
      { label: "3", stock: 8, available: true },
      { label: "4", stock: 8, available: true },
    ],

    placement: "new_arrivals",
    soldOut: false,

    description: [
      "TOLE TOLE WEARING A PINEAPPLE CROWN",
      "FULL TROPICAL FRUIT ENERGY",
      "MATCHING PINEAPPLE SLICE INCLUDED IN THE PHOTO",
      "CALM, REGAL, AND SLIGHTLY JUICY",
      "THE QUEEN OF THE FRUIT BOWL",
    ],
  },

  {
    id: 3,
    slug: "tole-tole-strawberry-bob",
    name: 'TOLE TOLE “STRAWBERRY BOB”',
    price: "$58.00",
    priceValue: 58,
    image: "/products/cat3.png",

    images: ["/products/cat3.png"],

    sizes: [
      { label: "1", stock: 8, available: true },
      { label: "2", stock: 8, available: true },
      { label: "3", stock: 8, available: true },
      { label: "4", stock: 8, available: true },
    ],

    placement: "collection",
    soldOut: false,

    description: [
      "TOLE TOLE WEARING A LONG BROWN BOB WIG",
      "STRAWBERRY HAIR CLIPS ON BOTH SIDES",
      "FRESH SALON LOOK",
      "SERVING A VERY SERIOUS BEAUTY POSE",
      "READY FOR HER CLOSE-UP",
    ],
  },

  {
    id: 4,
    slug: "tole-tole-busy-bee",
    name: 'TOLE TOLE “BUSY BEE”',
    price: "$138.00",
    priceValue: 138,
    image: "/products/cat4.png",

    images: ["/products/cat4.png"],

    sizes: [
      { label: "1", stock: 8, available: true },
      { label: "2", stock: 8, available: true },
      { label: "3", stock: 8, available: true },
      { label: "4", stock: 8, available: true },
    ],

    placement: "collection",
    soldOut: false,

    description: [
      "TOLE TOLE WEARING A BLACK-AND-YELLOW BEE COSTUME",
      "HOOD WITH TWO SOFT ANTENNAE",
      "SITTING POLITELY IN THE KITCHEN",
      "BUSY BEE ENERGY WITHOUT THE BUZZING",
      "READY TO POLLINATE THE SNACK CABINET",
    ],
  },

  {
    id: 5,
    slug: "tole-tole-cheese-head",
    name: 'TOLE TOLE “CHEESE HEAD”',
    price: "$232.00",
    priceValue: 232,
    image: "/products/cat5.png",

    images: ["/products/cat5.png"],

    sizes: [
      { label: "1", stock: 1, available: true },
      { label: "2", stock: 1, available: true },
      { label: "3", stock: 1, available: true },
      { label: "4", stock: 0, available: false },
    ],

    placement: "memories",
    soldOut: false,

    description: [
      "TOLE TOLE WEARING A GIANT CHEESE-SLICE HAT",
      "BOLD YELLOW COLOR",
      "A LITTLE ANNOYED BUT STILL FASHIONABLE",
      "SERVING SHARP CHEDDAR ATTITUDE",
      "NOT ACTUALLY MADE OF CHEESE",
    ],
  },
];

const loopingProducts = Array.from(
  { length: 3 },
  (_, copyIndex) =>
    products.map((product, productIndex) => ({
      ...product,
      copyIndex,
      productIndex,
      instanceKey: `${copyIndex}-${product.id}`,
    })),
).flat();

function loadSavedCart() {
  try {
    const savedCart =
      window.localStorage.getItem(
        CART_STORAGE_KEY,
      );

    if (!savedCart) {
      return [];
    }

    const parsedCart = JSON.parse(savedCart);

    return Array.isArray(parsedCart)
      ? parsedCart
      : [];
  } catch {
    return [];
  }
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(value);
}

function CartButton({ itemCount }) {
  return (
    <NavLink
      to="/cart"
      aria-label={`Open cart with ${itemCount} items`}
      className="fixed right-3 top-3 z-[200] no-underline sm:right-[5vw] sm:top-[5vh]"
    >
      <div className="relative">
        <img
          src="/cart.png"
          alt=""
          draggable="false"
          className="h-14 w-14 object-contain sm:h-24 sm:w-24"
        />

        {itemCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-black px-1.5 text-xs text-white sm:-right-1 sm:-top-1 sm:h-7 sm:min-w-7 sm:px-2 sm:text-xs">
            {itemCount}
          </span>
        )}
      </div>
    </NavLink>
  );
}

function Navigation({
  isMenuOpen,
  setIsMenuOpen,
}) {
  const linkClasses =
    "py-2 text-2xl leading-none text-[#0F4C81] no-underline transition-opacity duration-300 hover:opacity-40 sm:py-0 sm:text-2xl";

  return (
    <>
      <button
        type="button"
        aria-label={
          isMenuOpen
            ? "Close navigation menu"
            : "Open navigation menu"
        }
        aria-expanded={isMenuOpen}
        aria-controls="primary-navigation"
        onClick={() => {
          setIsMenuOpen(
            (currentValue) =>
              !currentValue,
          );
        }}
        className="fixed left-3 top-3 z-[210] flex h-14 w-14 items-center justify-center bg-transparent text-[#0F4C81] outline-none sm:hidden"
      >
        {isMenuOpen ? (
          <span
            aria-hidden="true"
            className="relative block h-9 w-9"
          >
            <span className="absolute left-1/2 top-1/2 h-0.5 w-10 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-current" />
            <span className="absolute left-1/2 top-1/2 h-0.5 w-10 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-current" />
          </span>
        ) : (
          <img
            src="/drawer.png"
            alt=""
            aria-hidden="true"
            draggable="false"
            className="h-full w-full object-contain"
          />
        )}
      </button>

      <nav
        id="primary-navigation"
        aria-label="Primary navigation"
        className={`fixed inset-0 z-[200] flex min-h-[100dvh] flex-col items-center justify-center bg-white/65 px-6 py-24 backdrop-blur-sm transition-opacity duration-500 ease-out sm:inset-auto sm:left-[5vw] sm:top-[6vh] sm:min-h-0 sm:items-start sm:justify-start sm:gap-6 sm:bg-transparent sm:p-0 sm:opacity-100 sm:backdrop-blur-none sm:transition-none ${
          isMenuOpen
            ? "opacity-100"
            : "pointer-events-none opacity-0 sm:pointer-events-auto"
        }`}
      >
        <NavLink
          to="/"
          onClick={() => {
            setIsMenuOpen(false);
          }}
          className={`mb-10 whitespace-nowrap text-4xl leading-none text-[#0F4C81] no-underline transition-all duration-500 sm:hidden ${
            isMenuOpen
              ? "translate-y-0 opacity-100"
              : "translate-y-4 opacity-0"
          }`}
        >
          solemn memory.
        </NavLink>

        <div
          className={`flex flex-col items-center gap-5 transition-all delay-75 duration-500 sm:items-start sm:gap-6 sm:transform-none sm:opacity-100 ${
            isMenuOpen
              ? "translate-y-0 opacity-100"
              : "translate-y-5 opacity-0"
          }`}
        >
          <NavLink
            to="/shop"
            onClick={() => {
              setIsMenuOpen(false);
            }}
            className={linkClasses}
          >
            New Arrivals
          </NavLink>

          <NavLink
            to="/collection"
            onClick={() => {
              setIsMenuOpen(false);
            }}
            className={linkClasses}
          >
            Collection
          </NavLink>

          <NavLink
            to="/memories"
            onClick={() => {
              setIsMenuOpen(false);
            }}
            className={linkClasses}
          >
            Memories
          </NavLink>

          <NavLink
            to="/about"
            onClick={() => {
              setIsMenuOpen(false);
            }}
            className={linkClasses}
          >
            About
          </NavLink>

          <NavLink
            to="/admin"
            onClick={() => {
              setIsMenuOpen(false);
            }}
            className={linkClasses}
          >
            Admin
          </NavLink>
        </div>
      </nav>
    </>
  );
}

function Header({
  cartItemCount,
  isMenuOpen,
  setIsMenuOpen,
}) {
  return (
    <header>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[190] h-20 bg-white sm:hidden"
      />

      <Navigation
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
      />

      <NavLink
        to="/"
        className={`fixed left-1/2 top-7 z-[200] -translate-x-1/2 whitespace-nowrap text-xl leading-none text-[#0F4C81] no-underline transition-opacity duration-300 sm:top-[5vh] sm:text-6xl sm:opacity-100 ${
          isMenuOpen
            ? "opacity-0"
            : "opacity-100"
        }`}
      >
        solemn memory.
      </NavLink>

      <CartButton
        itemCount={cartItemCount}
      />
    </header>
  );
}

function ShopPage({ products }) {
  const productTrackRef = useRef(null);
  const styleFrameRef = useRef(null);
  const inertiaFrameRef = useRef(null);
  const clickTimerRef = useRef(null);

  const isRepositioningRef =
    useRef(false);

  const suppressClickRef =
    useRef(false);

  const dragState = useRef({
    isDown: false,
    startX: 0,
    startTime: 0,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
    moved: false,
  });

  const [isDragging, setIsDragging] =
    useState(false);

  function getCarouselMeasurements() {
    const track =
      productTrackRef.current;

    if (!track) {
      return null;
    }

    const cards = track.querySelectorAll(
      "[data-product-card]",
    );

    if (
      cards.length <
      products.length * 3
    ) {
      return null;
    }

    const secondCopyStart =
      cards[products.length].offsetLeft;

    const thirdCopyStart =
      cards[products.length * 2]
        .offsetLeft;

    const segmentWidth =
      thirdCopyStart -
      secondCopyStart;

    return {
      track,
      cards,
      secondCopyStart,
      thirdCopyStart,
      segmentWidth,
    };
  }

  function centerMiddleProduct() {
    const measurements =
      getCarouselMeasurements();

    if (!measurements) {
      return;
    }

    const { track, cards } =
      measurements;

    const middleProductIndex =
      Math.floor(
        products.length / 2,
      );

    const middleCard =
      cards[
        products.length +
          middleProductIndex
      ];

    track.scrollLeft =
      middleCard.offsetLeft +
      middleCard.offsetWidth / 2 -
      track.clientWidth / 2;
  }

  function normalizeInfiniteScroll() {
    if (
      isRepositioningRef.current
    ) {
      return;
    }

    const measurements =
      getCarouselMeasurements();

    if (!measurements) {
      return;
    }

    const {
      track,
      secondCopyStart,
      thirdCopyStart,
      segmentWidth,
    } = measurements;

    const viewportCenter =
      track.scrollLeft +
      track.clientWidth / 2;

    if (
      viewportCenter <
      secondCopyStart
    ) {
      isRepositioningRef.current =
        true;

      track.scrollLeft += segmentWidth;

      isRepositioningRef.current =
        false;
    } else if (
      viewportCenter >=
      thirdCopyStart
    ) {
      isRepositioningRef.current =
        true;

      track.scrollLeft -= segmentWidth;

      isRepositioningRef.current =
        false;
    }
  }

  function updateProductStyles() {
    const track =
      productTrackRef.current;

    if (!track) {
      styleFrameRef.current = null;
      return;
    }

    const trackRect =
      track.getBoundingClientRect();

    const trackCenter =
      trackRect.left +
      trackRect.width / 2;

    const cards = track.querySelectorAll(
      "[data-product-card]",
    );

    cards.forEach((card) => {
      const cardRect =
        card.getBoundingClientRect();

      const cardCenter =
        cardRect.left +
        cardRect.width / 2;

      const distanceFromCenter =
        Math.abs(
          trackCenter - cardCenter,
        );

      const fadeDistance = Math.max(
        trackRect.width * 0.48,
        500,
      );

      const progress = Math.min(
        distanceFromCenter /
          fadeDistance,
        1,
      );

      const centerStrength =
        1 - progress;

      const translateY =
        18 -
        centerStrength * 48;

      const scale =
        0.86 +
        centerStrength * 0.14;

      const opacity =
        0.18 +
        centerStrength * 0.82;

      card.style.transform = `
        translate3d(0, ${translateY}px, 0)
        scale(${scale})
      `;

      card.style.opacity =
        String(opacity);

      card.style.zIndex = String(
        Math.round(
          centerStrength * 100,
        ),
      );
    });

    styleFrameRef.current = null;
  }

  function requestProductUpdate() {
    if (
      styleFrameRef.current !== null
    ) {
      return;
    }

    styleFrameRef.current =
      window.requestAnimationFrame(() => {
        updateProductStyles();
      });
  }

  function handleTrackScroll() {
    normalizeInfiniteScroll();
    requestProductUpdate();
  }

  function stopInertia() {
    if (
      inertiaFrameRef.current !== null
    ) {
      window.cancelAnimationFrame(
        inertiaFrameRef.current,
      );

      inertiaFrameRef.current = null;
    }
  }

  function startInertia(
    startingVelocity,
  ) {
    const track =
      productTrackRef.current;

    if (
      !track ||
      Math.abs(startingVelocity) <
        0.03
    ) {
      return;
    }

    stopInertia();

    let velocity =
      startingVelocity;

    let previousTime =
      performance.now();

    function animate(currentTime) {
      const currentTrack =
        productTrackRef.current;

      if (!currentTrack) {
        inertiaFrameRef.current =
          null;

        return;
      }

      const elapsed = Math.min(
        currentTime - previousTime,
        32,
      );

      previousTime = currentTime;

      currentTrack.scrollLeft +=
        velocity * elapsed;

      normalizeInfiniteScroll();
      requestProductUpdate();

      const friction = Math.pow(
        0.95,
        elapsed / 16.67,
      );

      velocity *= friction;

      if (
        Math.abs(velocity) <
        0.015
      ) {
        inertiaFrameRef.current =
          null;

        return;
      }

      inertiaFrameRef.current =
        window.requestAnimationFrame(
          animate,
        );
    }

    inertiaFrameRef.current =
      window.requestAnimationFrame(
        animate,
      );
  }

  function handleWheel(event) {
    const track =
      productTrackRef.current;

    if (!track) {
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    stopInertia();

    let movement =
      Math.abs(event.deltaX) >
      Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;

    if (event.deltaMode === 1) {
      movement *= 16;
    }

    if (event.deltaMode === 2) {
      movement *=
        window.innerHeight;
    }

    track.scrollLeft += movement;

    normalizeInfiniteScroll();
    requestProductUpdate();
  }

  useLayoutEffect(() => {
    const track =
      productTrackRef.current;

    if (!track) {
      return undefined;
    }

    track.addEventListener(
      "wheel",
      handleWheel,
      {
        passive: false,
      },
    );

    centerMiddleProduct();
    updateProductStyles();

    let secondFrame = null;
    let thirdFrame = null;

    const firstFrame =
      window.requestAnimationFrame(() => {
        centerMiddleProduct();
        updateProductStyles();

        secondFrame =
          window.requestAnimationFrame(
            () => {
              centerMiddleProduct();
              updateProductStyles();

              thirdFrame =
                window.requestAnimationFrame(
                  () => {
                    centerMiddleProduct();
                    updateProductStyles();
                  },
                );
            },
          );
      });

    function handleResize() {
      centerMiddleProduct();
      requestProductUpdate();
    }

    window.addEventListener(
      "resize",
      handleResize,
    );

    return () => {
      track.removeEventListener(
        "wheel",
        handleWheel,
      );

      window.cancelAnimationFrame(
        firstFrame,
      );

      if (secondFrame !== null) {
        window.cancelAnimationFrame(
          secondFrame,
        );
      }

      if (thirdFrame !== null) {
        window.cancelAnimationFrame(
          thirdFrame,
        );
      }

      window.removeEventListener(
        "resize",
        handleResize,
      );

      if (
        styleFrameRef.current !== null
      ) {
        window.cancelAnimationFrame(
          styleFrameRef.current,
        );

        styleFrameRef.current = null;
      }

      if (
        clickTimerRef.current !== null
      ) {
        window.clearTimeout(
          clickTimerRef.current,
        );
      }

      stopInertia();
    };
  }, []);

  function handlePointerDown(event) {
    if (
      event.pointerType === "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    stopInertia();

    const currentTime =
      performance.now();

    dragState.current = {
      isDown: true,
      startX: event.clientX,
      startTime: currentTime,
      lastX: event.clientX,
      lastTime: currentTime,
      velocity: 0,
      moved: false,
    };

    suppressClickRef.current = false;
  }

  function handlePointerMove(event) {
    const track =
      productTrackRef.current;

    const drag =
      dragState.current;

    if (
      !track ||
      !drag.isDown
    ) {
      return;
    }

    const totalMovement =
      event.clientX - drag.startX;

    if (
      !drag.moved &&
      Math.abs(totalMovement) < 8
    ) {
      return;
    }

    const currentTime =
      performance.now();

    let movementX;
    let elapsed;

    if (!drag.moved) {
      drag.moved = true;

      movementX = totalMovement;

      elapsed = Math.max(
        currentTime -
          drag.startTime,
        1,
      );

      setIsDragging(true);

      if (
        !track.hasPointerCapture(
          event.pointerId,
        )
      ) {
        track.setPointerCapture(
          event.pointerId,
        );
      }
    } else {
      movementX =
        event.clientX -
        drag.lastX;

      elapsed = Math.max(
        currentTime -
          drag.lastTime,
        1,
      );
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    track.scrollLeft -= movementX;

    normalizeInfiniteScroll();

    const instantVelocity =
      -movementX / elapsed;

    drag.velocity =
      drag.velocity * 0.65 +
      instantVelocity * 0.35;

    drag.lastX = event.clientX;
    drag.lastTime = currentTime;

    requestProductUpdate();
  }

  function finishDragging(
    event,
    cancelled = false,
  ) {
    const track =
      productTrackRef.current;

    const drag =
      dragState.current;

    if (!drag.isDown) {
      return;
    }

    const wasDragging =
      drag.moved;

    const endingVelocity =
      drag.velocity;

    drag.isDown = false;

    setIsDragging(false);

    if (
      track?.hasPointerCapture(
        event.pointerId,
      )
    ) {
      track.releasePointerCapture(
        event.pointerId,
      );
    }

    if (cancelled) {
      drag.velocity = 0;
      drag.moved = false;
      return;
    }

    if (wasDragging) {
      suppressClickRef.current = true;

      if (
        clickTimerRef.current !== null
      ) {
        window.clearTimeout(
          clickTimerRef.current,
        );
      }

      clickTimerRef.current =
        window.setTimeout(() => {
          suppressClickRef.current =
            false;

          dragState.current.moved =
            false;
        }, 250);

      startInertia(endingVelocity);
    }
  }

  function handleProductClick(event) {
    if (
      suppressClickRef.current ||
      dragState.current.moved
    ) {
      event.preventDefault();
      event.stopPropagation();

      suppressClickRef.current = false;
      dragState.current.moved = false;

      if (
        clickTimerRef.current !== null
      ) {
        window.clearTimeout(
          clickTimerRef.current,
        );

        clickTimerRef.current = null;
      }
    }
  }

  void [
    productTrackRef,
    isDragging,
    loopingProducts,
    handleTrackScroll,
    handlePointerDown,
    handlePointerMove,
    finishDragging,
    handleProductClick,
  ];

  return (
    <section className="min-h-screen bg-white px-4 pb-24 pt-28 sm:px-[6vw] sm:pb-32 sm:pt-44">
      <div className="mx-auto max-w-2xl space-y-20 sm:space-y-28">
        {products.length === 0 && (
          <p className="py-40 text-center text-xl">
            No products in this section yet.
          </p>
        )}

        {products.map((product) => (
          <article key={product.id}>
            <NavLink
              to={`/products/${product.slug}`}
              className="group block text-[#0F4C81] no-underline"
            >
              <div className="mx-auto flex aspect-[4/5] max-h-[620px] w-full items-center justify-center overflow-hidden bg-neutral-50">
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="mt-5 text-center">
                <h2 className="text-lg leading-relaxed">
                  {product.name}
                </h2>

                <p className="mt-1 text-base">
                  {product.price}
                </p>

                {product.stock > 0 &&
                  product.stock <= 3 && (
                    <p className="mt-2 text-sm uppercase tracking-[0.14em]">
                      Only {product.stock} left
                    </p>
                  )}

                {product.soldOut && (
                  <p className="mt-2 text-sm uppercase tracking-[0.14em]">
                    Sold out
                  </p>
                )}
              </div>
            </NavLink>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductPage({
  addToCart,
  products,
}) {
  const { productSlug } =
    useParams();

  return (
    <ProductPageDetails
      key={productSlug}
      productSlug={productSlug}
      addToCart={addToCart}
      products={products}
    />
  );
}

function ProductPageDetails({
  addToCart,
  products,
  productSlug,
}) {
  const product = products.find(
    (item) =>
      item.slug === productSlug,
  );

  const [
    selectedSize,
    setSelectedSize,
  ] = useState("");

  const [quantity, setQuantity] =
    useState(1);

  const [
    activeImage,
    setActiveImage,
  ] = useState(0);

  const [
    addedMessage,
    setAddedMessage,
  ] = useState("");

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "auto",
    });
  }, [productSlug]);

  if (!product) {
    return (
      <section className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <h1 className="text-4xl">
          Product not found
        </h1>

        <NavLink
          to="/shop"
          className="mt-8 text-xl text-[#0F4C81] underline underline-offset-4"
        >
          Return to shop
        </NavLink>
      </section>
    );
  }

  const availableSizes =
    product.sizes.filter(
      (size) => size.available,
    );

  const cannotPurchase =
    product.soldOut ||
    availableSizes.length === 0 ||
    selectedSize === "";

  const selectedSizeDetails =
    product.sizes.find(
      (size) =>
        size.label === selectedSize,
    );

  const selectedStock =
    selectedSizeDetails?.stock ?? 0;

  function decreaseQuantity() {
    setQuantity(
      (currentQuantity) =>
        Math.max(
          1,
          currentQuantity - 1,
        ),
    );
  }

  function increaseQuantity() {
    setQuantity(
      (currentQuantity) =>
        Math.min(
          Math.max(1, selectedStock),
          currentQuantity + 1,
        ),
    );
  }

  function handleAddToCart() {
    if (cannotPurchase) {
      return;
    }

    addToCart(
      product,
      selectedSize,
      quantity,
    );

    setAddedMessage(
      `${quantity} × ${product.name}, size ${selectedSize}, added to cart.`,
    );
  }

  return (
    <section className="min-h-screen bg-white px-4 pb-20 pt-36 sm:px-[5vw] sm:pb-24 sm:pt-40 lg:pl-[18vw] lg:pt-56">
      <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] lg:gap-16">
        <div>
          <div className="flex h-[50vh] min-h-[280px] items-center justify-center overflow-hidden bg-neutral-50 sm:h-[65vh] lg:h-[calc(100vh-16rem)] lg:min-h-[480px] lg:max-h-[720px]">
            <img
              src={
                product.images[
                  activeImage
                ]
              }
              alt={`${product.name} view ${
                activeImage + 1
              }`}
              draggable="false"
              className="h-full w-full object-contain"
            />
          </div>

          {product.images.length >
            1 && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              {product.images.map(
                (
                  imagePath,
                  index,
                ) => (
                  <button
                    key={`${imagePath}-${index}`}
                    type="button"
                    onClick={() => {
                      setActiveImage(
                        index,
                      );
                    }}
                    aria-label={`Show product image ${
                      index + 1
                    }`}
                    className={`flex aspect-square items-center justify-center overflow-hidden bg-neutral-50 transition-opacity ${
                      activeImage ===
                      index
                        ? "opacity-100"
                        : "opacity-40 hover:opacity-70"
                    }`}
                  >
                    <img
                      src={imagePath}
                      alt=""
                      draggable="false"
                      className="h-full w-full object-contain"
                    />
                  </button>
                ),
              )}
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-56 lg:self-start">
          <NavLink
            to="/shop"
            className="mb-8 inline-block text-sm text-[#0F4C81]/50 no-underline transition-opacity hover:opacity-50"
          >
            ← Back to shop
          </NavLink>

          <h1 className="text-2xl leading-relaxed sm:text-3xl">
            {product.name}
          </h1>

          <p className="mt-3 text-xl">
            {product.price}
          </p>

          <div className="mt-10">
            <p className="mb-4 text-lg">
              Size
            </p>

            <div className="grid grid-cols-4 gap-3">
              {product.sizes.map(
                (size) => {
                  const isSelected =
                    selectedSize ===
                    size.label;

                  return (
                    <button
                      key={size.label}
                      type="button"
                      disabled={
                        !size.available
                      }
                      onClick={() => {
                        setSelectedSize(
                          size.label,
                        );
                        setQuantity(1);

                        setAddedMessage(
                          "",
                        );
                      }}
                      className={`relative border px-4 py-3 text-lg transition ${
                        !size.available
                          ? "cursor-not-allowed border-black/20 text-[#0F4C81]/25 line-through"
                          : isSelected
                            ? "border-black bg-black text-white"
                            : "border-black bg-white text-[#0F4C81] hover:bg-black hover:text-white"
                      }`}
                    >
                      {size.label}
                    </button>
                  );
                },
              )}
            </div>

            {selectedSize &&
              selectedStock > 0 &&
              selectedStock <= 3 && (
                <p className="mt-4 text-sm uppercase tracking-[0.14em]">
                  Only {selectedStock} left
                  in size {selectedSize}
                </p>
              )}
          </div>

          <div className="mt-8">
            <p className="mb-4 text-lg">
              Quantity
            </p>

            <div className="flex w-fit items-center border border-black">
              <button
                type="button"
                onClick={
                  decreaseQuantity
                }
                aria-label="Decrease quantity"
                className="flex h-12 w-12 items-center justify-center text-xl transition hover:bg-black hover:text-white"
              >
                −
              </button>

              <span className="flex h-12 min-w-12 items-center justify-center border-x border-black px-4 text-lg">
                {quantity}
              </span>

              <button
                type="button"
                onClick={
                  increaseQuantity
                }
                disabled={
                  selectedSize === "" ||
                  quantity >=
                    selectedStock
                }
                aria-label="Increase quantity"
                className="flex h-12 w-12 items-center justify-center text-xl transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-white disabled:hover:text-[#0F4C81]"
              >
                +
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={cannotPurchase}
            onClick={handleAddToCart}
            className={`mt-8 w-full border border-black px-6 py-4 text-lg transition ${
              cannotPurchase
                ? "cursor-not-allowed bg-neutral-200 text-[#0F4C81]/40"
                : "bg-black text-white hover:bg-white hover:text-[#0F4C81]"
            }`}
          >
            {product.soldOut ||
            availableSizes.length ===
              0
              ? "Sold out"
              : selectedSize === ""
                ? "Select a size"
                : "Add to cart"}
          </button>

          {addedMessage && (
            <div className="mt-5">
              <p className="text-sm leading-6">
                {addedMessage}
              </p>

              <NavLink
                to="/cart"
                className="mt-3 inline-block text-sm text-[#0F4C81] underline underline-offset-4"
              >
                View cart
              </NavLink>
            </div>
          )}

          <div className="mt-12 border-t border-black pt-8">
            <h2 className="text-xl">
              Product details
            </h2>

            <div className="mt-6 space-y-4 text-sm leading-7 sm:text-base">
              {product.description.map(
                (detail) => (
                  <p key={detail}>
                    — {detail}
                  </p>
                ),
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function CartPage({
  cartItems,
  updateCartQuantity,
  removeFromCart,
  clearCart,
}) {
  const subtotal = useMemo(() => {
    return cartItems.reduce(
      (total, item) =>
        total +
        item.priceValue *
          item.quantity,
      0,
    );
  }, [cartItems]);

  if (cartItems.length === 0) {
    return (
      <section className="min-h-screen bg-white px-4 pb-20 pt-40 sm:px-6 sm:pt-52">
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="text-4xl sm:text-5xl">
            Your cart
          </h1>

          <p className="mt-12 text-xl">
            Your cart is empty.
          </p>

          <NavLink
            to="/shop"
            className="mt-8 inline-block text-lg text-[#0F4C81] underline underline-offset-4"
          >
            Continue shopping
          </NavLink>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-white px-4 pb-20 pt-36 sm:px-[5vw] sm:pb-24 sm:pt-48 lg:pl-[18vw]">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between gap-4 border-b border-black pb-5">
          <h1 className="text-3xl sm:text-5xl">
            Your cart
          </h1>

          <button
            type="button"
            onClick={clearCart}
            className="text-sm underline underline-offset-4 transition-opacity hover:opacity-50"
          >
            Clear cart
          </button>
        </div>

        <div className="divide-y divide-black/20">
          {cartItems.map((item) => (
            <article
              key={item.cartKey}
              className="grid gap-5 py-7 sm:grid-cols-[160px_1fr_auto] sm:items-center sm:gap-6 sm:py-8"
            >
              <NavLink
                to={`/products/${item.slug}`}
                className="block max-w-[220px] bg-neutral-50 sm:max-w-none"
              >
                <img
                  src={item.image}
                  alt={item.name}
                  className="aspect-square h-full w-full object-contain"
                />
              </NavLink>

              <div>
                <NavLink
                  to={`/products/${item.slug}`}
                  className="text-xl text-[#0F4C81] no-underline transition-opacity hover:opacity-50"
                >
                  {item.name}
                </NavLink>

                <p className="mt-2 text-sm">
                  Size: {item.size}
                </p>

                <p className="mt-2">
                  {formatMoney(
                    item.priceValue,
                  )}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    removeFromCart(
                      item.cartKey,
                    );
                  }}
                  className="mt-5 text-sm underline underline-offset-4 transition-opacity hover:opacity-50"
                >
                  Remove
                </button>
              </div>

              <div className="flex w-fit items-center border border-black">
                <button
                  type="button"
                  onClick={() => {
                    updateCartQuantity(
                      item.cartKey,
                      item.quantity - 1,
                    );
                  }}
                  aria-label={`Decrease ${item.name} quantity`}
                  className="flex h-12 w-12 items-center justify-center text-xl transition hover:bg-black hover:text-white"
                >
                  −
                </button>

                <span className="flex h-12 min-w-12 items-center justify-center border-x border-black px-4">
                  {item.quantity}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    updateCartQuantity(
                      item.cartKey,
                      item.quantity + 1,
                    );
                  }}
                  aria-label={`Increase ${item.name} quantity`}
                  className="flex h-12 w-12 items-center justify-center text-xl transition hover:bg-black hover:text-white"
                >
                  +
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="ml-auto mt-10 max-w-md border-t border-black pt-7">
          <div className="flex items-center justify-between text-xl">
            <span>Subtotal</span>

            <span>
              {formatMoney(subtotal)}
            </span>
          </div>

          <p className="mt-4 text-sm leading-6 text-[#0F4C81]/60">
            Shipping and taxes are
            calculated at checkout.
          </p>

          <button
            type="button"
            className="mt-7 w-full border border-black bg-black px-6 py-4 text-lg text-white transition hover:bg-white hover:text-[#0F4C81]"
          >
            Checkout
          </button>

          <NavLink
            to="/shop"
            className="mt-5 block text-center text-sm text-[#0F4C81] underline underline-offset-4"
          >
            Continue shopping
          </NavLink>
        </div>
      </div>
    </section>
  );
}

function HomePage({ isMenuOpen }) {
  return (
    <section className="flex min-h-screen items-center justify-center bg-white pt-20 sm:px-[6vw] sm:pb-8 sm:pt-36">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label="Solemn Memory featured video"
        className={`h-[calc(100dvh-5rem)] w-full origin-center object-contain transition-[transform,filter,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transform-none motion-reduce:transition-none sm:h-[calc(100vh-11rem)] ${
          isMenuOpen
            ? "scale-[0.82] blur-[1px] opacity-55"
            : "scale-100 blur-0 opacity-100"
        }`}
      >
        <source
          src="/videos/main-page.mp4"
          type="video/mp4"
        />

        Your browser does not support the
        video element.
      </video>
    </section>
  );
}

function EmptyPage() {
  return null;
}

function AboutPage() {
  return (
    <section className="flex min-h-screen items-center justify-center bg-white px-5 pb-20 pt-40 sm:px-[8vw] sm:pb-24 sm:pt-48 lg:px-[10vw] lg:py-40">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl sm:text-4xl">
          About
        </h1>

        <div className="mt-10 space-y-6 text-base leading-8 sm:mt-12 sm:text-lg sm:leading-9">
          <p>
            Solemn Memory is created with
            the intention of putting memories
            into clothing.
          </p>

          <p>
            Every collection begins with a
            memory. Sometimes it is our own.
            Sometimes it is inspired by
            someone else&apos;s life.
          </p>

          <p>
            We believe that even if a memory
            is not yours, it can still feel
            familiar. A place, a routine, or
            a moment from someone else&apos;s
            story may remind you of your own.
          </p>

          <p>
            Through thoughtful design, we
            hope each garment carries a
            memory that stays with you.
          </p>

          <p>
            Solemn Memory exists to remember,
            preserve, and share the moments
            that shape us.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function App({
  clerkEnabled = false,
}) {
  const [cartItems, setCartItems] =
    useState(loadSavedCart);
  const [isMenuOpen, setIsMenuOpen] =
    useState(false);
  const [
    catalogProducts,
    setCatalogProducts,
  ] = useState(() =>
    products.map(
      normalizeCatalogProduct,
    ),
  );

  useEffect(() => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify(cartItems),
    );
  }, [cartItems]);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        const response = await fetch(
          "/api/products",
        );

        if (!response.ok) {
          return;
        }

        const data =
          await response.json();

        if (
          !cancelled &&
          Array.isArray(data.products)
        ) {
          setCatalogProducts(
            data.products.map(
              normalizeCatalogProduct,
            ),
          );
        }
      } catch {
        // The static catalog remains available
        // during local development or an API outage.
      }
    }

    loadProducts();
    window.addEventListener(
      "solemn-products-updated",
      loadProducts,
    );

    return () => {
      cancelled = true;
      window.removeEventListener(
        "solemn-products-updated",
        loadProducts,
      );
    };
  }, []);

  const cartItemCount = useMemo(() => {
    return cartItems.reduce(
      (total, item) =>
        total + item.quantity,
      0,
    );
  }, [cartItems]);

  function addToCart(
    product,
    selectedSize,
    quantity,
  ) {
    const cartKey =
      `${product.id}-${selectedSize}`;

    setCartItems((currentItems) => {
      const existingItem =
        currentItems.find(
          (item) =>
            item.cartKey === cartKey,
        );

      if (existingItem) {
        return currentItems.map(
          (item) =>
            item.cartKey === cartKey
              ? {
                  ...item,
                  quantity:
                    item.quantity +
                    quantity,
                }
              : item,
        );
      }

      return [
        ...currentItems,
        {
          cartKey,
          productId: product.id,
          slug: product.slug,
          name: product.name,
          image: product.image,
          priceValue:
            product.priceValue,
          size: selectedSize,
          quantity,
        },
      ];
    });
  }

  function updateCartQuantity(
    cartKey,
    newQuantity,
  ) {
    if (newQuantity <= 0) {
      setCartItems((currentItems) =>
        currentItems.filter(
          (item) =>
            item.cartKey !== cartKey,
        ),
      );

      return;
    }

    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.cartKey === cartKey
          ? {
              ...item,
              quantity: newQuantity,
            }
          : item,
      ),
    );
  }

  function removeFromCart(cartKey) {
    setCartItems((currentItems) =>
      currentItems.filter(
        (item) =>
          item.cartKey !== cartKey,
      ),
    );
  }

  function clearCart() {
    setCartItems([]);
  }

  return (
    <main className="solemn-font min-h-screen bg-white">
      <Header
        cartItemCount={cartItemCount}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
      />

      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              isMenuOpen={isMenuOpen}
            />
          }
        />

        <Route
          path="/shop"
          element={
            <ShopPage
              products={catalogProducts.filter(
                (product) =>
                  product.placement ===
                  "new_arrivals",
              )}
            />
          }
        />

        <Route
          path="/products/:productSlug"
          element={
            <ProductPage
              addToCart={addToCart}
              products={catalogProducts}
            />
          }
        />

        <Route
          path="/wardrobe"
          element={<EmptyPage />}
        />

        <Route
          path="/collection"
          element={
            <ShopPage
              products={catalogProducts.filter(
                (product) =>
                  product.placement ===
                  "collection",
              )}
            />
          }
        />

        <Route
          path="/memories"
          element={
            <ShopPage
              products={catalogProducts.filter(
                (product) =>
                  product.placement ===
                  "memories",
              )}
            />
          }
        />

        <Route
          path="/about"
          element={<AboutPage />}
        />

        <Route
          path="/cart"
          element={
            <CartPage
              cartItems={cartItems}
              updateCartQuantity={
                updateCartQuantity
              }
              removeFromCart={
                removeFromCart
              }
              clearCart={clearCart}
            />
          }
        />

        <Route
          path="/admin"
          element={
            clerkEnabled ? (
              <AdminPage />
            ) : (
              <AdminSetupPage />
            )
          }
        />
      </Routes>
    </main>
  );
}
