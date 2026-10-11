import { NavLink } from "react-router-dom";

// Store-approved contact and policy copy can be maintained here.
const contactEmail = "evankwak19@gmail.com";
const shippingDetails = "Shipping and taxes are calculated at checkout.";

export function ShippingInformation() {
  return (
    <div className="space-y-4">
      <p>{shippingDetails}</p>
      <p>
        For shipping questions, please{" "}
        <NavLink to="/contact" className="underline underline-offset-4">
          contact us
        </NavLink>
        .
      </p>
    </div>
  );
}

function InformationPage({ title, children }) {
  return (
    <section className="min-h-screen bg-white px-5 pb-24 pt-40 sm:px-[8vw] sm:pt-48 lg:pl-[22vw]">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        <div className="mt-10 space-y-8 text-base leading-8 sm:text-lg">
          {children}
        </div>
      </div>
    </section>
  );
}

export function PoliciesPage() {
  return (
    <InformationPage title="Policies">
      <section>
        <h2 className="mb-4 text-2xl">Shipping</h2>
        <ShippingInformation />
      </section>
      <section>
        <h2 className="mb-4 text-2xl">Returns &amp; exchanges</h2>
        <p>
          Please{" "}
          <NavLink to="/contact" className="underline underline-offset-4">
            contact us
          </NavLink>{" "}
          with any questions about returns or exchanges before placing an order.
        </p>
      </section>
    </InformationPage>
  );
}

export function ContactPage() {
  return (
    <InformationPage title="Contact">
      <p>For questions about products, shipping, or an order, get in touch with Solemn Memory.</p>
      <a href={`mailto:${contactEmail}`} className="inline-block break-all underline underline-offset-4">
        {contactEmail}
      </a>
    </InformationPage>
  );
}
