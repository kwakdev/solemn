import { NavLink } from "react-router-dom";

export default function CartPage() {
  return (
    <section className="min-h-screen bg-white px-[5vw] pb-16 pt-52">
      <div className="mx-auto max-w-5xl">
        <h1 className="gloria-font text-center text-5xl">
          Your Cart
        </h1>

        <div className="mt-16 border-t border-black">
          <div className="flex min-h-64 flex-col items-center justify-center text-center">
            <p className="gloria-font text-2xl">
              Your cart is empty.
            </p>

            <NavLink
              to="/shop"
              className="gloria-font mt-8 text-xl text-[#0F4C81] underline underline-offset-4"
            >
              Continue Shopping
            </NavLink>
          </div>
        </div>
      </div>
    </section>
  );
}
