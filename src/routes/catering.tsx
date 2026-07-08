import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTruckState, type CateringInquiry } from "@/lib/truck-state";

export const Route = createFileRoute("/catering")({
  head: () => ({
    meta: [
      { title: "Catering & Events — Bluegrass Kitchen | TruckDash" },
      {
        name: "description",
        content:
          "Book Bluegrass Kitchen for your next event. Corporate, weddings, festivals and private parties in the Lake Cumberland area. Warm Kentucky hospitality, honest food.",
      },
    ],
  }),
  component: CateringPublicPage,
});

/**
 * PUBLIC CUSTOMER-FACING CATERING FORM
 * Route: /catering
 *
 * This is the shareable page owners promote.
 * Warm, premium, approachable. Uses live truck data from shared localStorage
 * so changes in the owner dashboard are reflected immediately.
 */
function CateringPublicPage() {
  const [state] = useTruckState();
  const c = state.catering;

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    eventDate: "",
    eventTime: "",
    guests: "",
    location: "",
    eventType: "Private Party",
    menuInterests: "",
    budget: "$750–$1,500",
    notes: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [inquiryId, setInquiryId] = useState<string | null>(null);

  const eventTypes = [
    "Corporate",
    "Wedding",
    "Private Party",
    "Festival",
    "Family Gathering",
    "Other",
  ];

  const budgetOptions = ["Under $750", "$750–$1,500", "$1,500–$3,000", "$3,000+"];

  const update = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name || !form.email || !form.eventDate || !form.location) {
      alert("Please fill out your name, email, event date, and location.");
      return;
    }

    setSubmitting(true);

    const inquiry: CateringInquiry = {
      id: crypto.randomUUID(),
      submittedAt: new Date().toISOString(),
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      eventDate: form.eventDate,
      eventTime: form.eventTime,
      guests: parseInt(form.guests, 10) || 0,
      location: form.location.trim(),
      eventType: form.eventType,
      menuInterests: form.menuInterests.trim(),
      budget: form.budget,
      notes: form.notes.trim(),
      status: "new",
    };

    // Persist to shared storage so owner dashboard sees it immediately.
    // (Simulates "sending to dashboard / email" for this demo.)
    try {
      const raw = localStorage.getItem("truckdash.catering.inquiries");
      const list: CateringInquiry[] = raw ? JSON.parse(raw) : [];
      list.unshift(inquiry); // newest first
      localStorage.setItem("truckdash.catering.inquiries", JSON.stringify(list.slice(0, 50)));
    } catch {
      // non-fatal
    }

    // For real email later: could POST to a serverless endpoint.
    // For now we log + store.
    console.log("[Catering Inquiry received]", inquiry);

    // Simulate short processing
    await new Promise((r) => setTimeout(r, 420));

    setInquiryId(inquiry.id);
    setSubmitted(true);
    setSubmitting(false);
  };

  const resetForm = () => {
    setSubmitted(false);
    setInquiryId(null);
    setForm({
      name: "",
      email: "",
      phone: "",
      eventDate: "",
      eventTime: "",
      guests: "",
      location: "",
      eventType: "Private Party",
      menuInterests: "",
      budget: "$750–$1,500",
      notes: "",
    });
  };

  const truckName = state.name;
  const contactPhone = c.contactPhone || state.phone;
  const contactEmail = c.contactEmail;

  return (
    <div className="min-h-screen bg-brand-sand text-brand-green">
      {/* Warm, premium header */}
      <header className="border-b border-brand-green/10 bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-5 flex items-center justify-between">
          <div>
            <Link to="/" className="text-xs uppercase tracking-[0.2em] text-brand-orange font-bold">
              ← TruckDash
            </Link>
            <div className="flex items-center gap-2 mt-1">
              <span className="size-2 rounded-full bg-brand-orange" />
              <span className="font-display text-2xl font-bold tracking-tight">{truckName}</span>
            </div>
            <p className="text-xs text-brand-green/60 tracking-wider">
              CATERING &amp; PRIVATE EVENTS
            </p>
          </div>

          <a
            href={`tel:${contactPhone.replace(/[^\d]/g, "")}`}
            className="text-sm font-semibold px-4 py-2 rounded-2xl border border-brand-green/15 bg-white hover:bg-brand-sand transition"
          >
            Call {contactPhone}
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-8 pb-20">
        {!submitted ? (
          <>
            {/* Hero messaging — authentic Kentucky soul */}
            <div className="text-center mb-8">
              <div className="inline-block px-3 py-1 rounded-full bg-brand-orange/10 text-brand-orange text-xs font-bold tracking-[0.2em] mb-3">
                LAKE CUMBERLAND • CENTRAL KENTUCKY
              </div>
              <h1 className="font-display text-4xl leading-none tracking-[-1px] mb-3">
                Bring the flavor
                <br />
                to your next event.
              </h1>
              <p className="max-w-md mx-auto text-brand-green/70">{c.introMessage}</p>
              <p className="mt-3 text-sm font-medium text-brand-green/60">
                Weddings • Corporate • Festivals • Private Parties • Family Gatherings
              </p>
            </div>

            {/* Signature packages preview (warm & honest) */}
            <div className="mb-8 grid gap-3 sm:grid-cols-3">
              {c.signaturePackages.slice(0, 3).map((pkg) => (
                <div key={pkg.id} className="bg-white rounded-3xl p-4 border border-brand-green/10">
                  <div className="font-semibold text-base">{pkg.name}</div>
                  <div className="text-xs text-brand-orange font-medium mt-0.5">{pkg.serves}</div>
                  <p className="mt-2 text-sm text-brand-green/70 leading-snug">{pkg.description}</p>
                </div>
              ))}
            </div>

            {/* The actual inquiry form — clean, conversion focused */}
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-3xl border border-brand-green/10 shadow-sm p-6 space-y-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Your Name">
                  <input
                    required
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    className="w-full rounded-2xl border border-brand-green/15 bg-brand-sand px-4 py-3 text-sm focus:outline-none focus:border-brand-orange"
                    placeholder="Alex Rivera"
                  />
                </Field>
                <Field label="Email Address">
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    className="w-full rounded-2xl border border-brand-green/15 bg-brand-sand px-4 py-3 text-sm focus:outline-none focus:border-brand-orange"
                    placeholder="you@email.com"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Phone Number">
                  <input
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    className="w-full rounded-2xl border border-brand-green/15 bg-brand-sand px-4 py-3 text-sm focus:outline-none focus:border-brand-orange"
                    placeholder="(555) 867-5309"
                  />
                </Field>
                <Field label="Number of Guests">
                  <input
                    type="number"
                    min={10}
                    value={form.guests}
                    onChange={(e) => update("guests", e.target.value)}
                    className="w-full rounded-2xl border border-brand-green/15 bg-brand-sand px-4 py-3 text-sm focus:outline-none focus:border-brand-orange"
                    placeholder="35"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Event Date">
                  <input
                    required
                    type="date"
                    value={form.eventDate}
                    onChange={(e) => update("eventDate", e.target.value)}
                    className="w-full rounded-2xl border border-brand-green/15 bg-brand-sand px-4 py-3 text-sm focus:outline-none focus:border-brand-orange"
                  />
                </Field>
                <Field label="Event Time (approx)">
                  <input
                    type="time"
                    value={form.eventTime}
                    onChange={(e) => update("eventTime", e.target.value)}
                    className="w-full rounded-2xl border border-brand-green/15 bg-brand-sand px-4 py-3 text-sm focus:outline-none focus:border-brand-orange"
                  />
                </Field>
              </div>

              <Field label="Event Location">
                <input
                  required
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                  className="w-full rounded-2xl border border-brand-green/15 bg-brand-sand px-4 py-3 text-sm focus:outline-none focus:border-brand-orange"
                  placeholder="Private farm • Lake Cumberland State Dock • Your backyard in Monticello..."
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Type of Event">
                  <select
                    value={form.eventType}
                    onChange={(e) => update("eventType", e.target.value)}
                    className="w-full rounded-2xl border border-brand-green/15 bg-brand-sand px-4 py-3 text-sm focus:outline-none focus:border-brand-orange"
                  >
                    {eventTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Budget Range">
                  <select
                    value={form.budget}
                    onChange={(e) => update("budget", e.target.value)}
                    className="w-full rounded-2xl border border-brand-green/15 bg-brand-sand px-4 py-3 text-sm focus:outline-none focus:border-brand-orange"
                  >
                    {budgetOptions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Menu Interests or Dietary Needs">
                <textarea
                  value={form.menuInterests}
                  onChange={(e) => update("menuInterests", e.target.value)}
                  rows={2}
                  className="w-full rounded-2xl border border-brand-green/15 bg-brand-sand px-4 py-3 text-sm focus:outline-none focus:border-brand-orange"
                  placeholder="Vegetarian options, bourbon-glazed pork, gluten-free desserts, heavy apps only..."
                />
              </Field>

              <Field label="Additional Notes">
                <textarea
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-brand-green/15 bg-brand-sand px-4 py-3 text-sm focus:outline-none focus:border-brand-orange"
                  placeholder="Tell us more about the vibe, setup needs, or special requests..."
                />
              </Field>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 rounded-3xl bg-brand-orange text-white font-bold text-base shadow-lg shadow-brand-orange/25 active:scale-[0.985] transition disabled:opacity-70"
              >
                {submitting ? "Sending your inquiry..." : "Request Catering Quote"}
              </button>

              <p className="text-center text-xs text-brand-green/50">
                We usually reply within 24 hours. No obligation — just good conversation about great
                food.
              </p>
            </form>

            <div className="mt-6 text-center text-xs text-brand-green/50">
              Serving the Lake Cumberland region with pride • {contactPhone} • {contactEmail}
            </div>
          </>
        ) : (
          /* Success state — warm and reassuring */
          <div className="max-w-md mx-auto text-center py-10">
            <div className="mx-auto size-16 rounded-full bg-brand-orange/10 flex items-center justify-center mb-5">
              <span className="text-3xl">🍂</span>
            </div>
            <h2 className="font-display text-3xl tracking-tight">
              Thank you, {form.name.split(" ")[0]}.
            </h2>
            <p className="mt-3 text-lg text-brand-green/70">
              Your inquiry has been received. We’ll reach out within a day to talk through the
              details and lock in your date.
            </p>

            <div className="mt-8 bg-white rounded-3xl p-5 text-left border border-brand-green/10">
              <div className="uppercase text-[10px] tracking-widest text-brand-orange font-bold mb-1">
                Next steps
              </div>
              <ul className="text-sm space-y-1.5 text-brand-green/80">
                <li>• We’ll call or email to confirm availability and discuss menu.</li>
                <li>• You’ll receive a simple proposal with pricing and timing.</li>
                <li>• Once confirmed, we handle the rest — you just enjoy your event.</li>
              </ul>
            </div>

            <div className="mt-6 text-sm">
              Questions right away? Call{" "}
              <a
                href={`tel:${contactPhone.replace(/[^\d]/g, "")}`}
                className="font-semibold underline"
              >
                {contactPhone}
              </a>
            </div>

            <button
              onClick={resetForm}
              className="mt-8 text-xs uppercase tracking-[0.2em] font-bold text-brand-orange"
            >
              Submit another inquiry
            </button>

            <div className="mt-10">
              <Link to="/" className="text-xs text-brand-green/50 hover:text-brand-green">
                Back to TruckDash home
              </Link>
            </div>
          </div>
        )}
      </main>

      <footer className="text-center text-[10px] py-6 text-brand-green/40 border-t border-brand-green/10">
        Bluegrass Kitchen • Authentic Kentucky cooking for the moments that matter
      </footer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-brand-green/60 mb-1.5">
        {label}
      </div>
      {children}
    </label>
  );
}
