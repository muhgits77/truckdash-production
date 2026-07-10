/**
 * Built-in Event Calendar — monthly grid + list.
 * Merges TruckEvent entries with This Week schedule (recurring Fri markets, etc.).
 * High-contrast ink tokens for light & dark Kentucky palette.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useMemo, useState } from "react";
import { PageShell, TipCard } from "@/components/page-shell";
import { type TruckEvent, useTruckState } from "@/lib/truck-state";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — TruckDash" },
      {
        name: "description",
        content:
          "Festivals, catering, and weekly markets for your Kentucky food truck. Integrates with This Week schedule.",
      },
    ],
  }),
  component: CalendarPage,
});

const KIND_LABEL: Record<TruckEvent["kind"], string> = {
  festival: "Festival",
  catering: "Catering",
  market: "Market",
  other: "Event",
};

const DOW_TO_SCHEDULE: Record<number, string> = {
  0: "SUN",
  1: "MON",
  2: "TUE",
  3: "WED",
  4: "THU",
  5: "FRI",
  6: "SAT",
};

function CalendarPage() {
  const [state, setState] = useTruckState();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date>(() => new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<TruckEvent>>({
    title: "",
    date: format(new Date(), "yyyy-MM-dd"),
    hoursStart: "11:00 AM",
    hoursEnd: "2:00 PM",
    location: "",
    kind: "festival",
    recurring: false,
    note: "",
  });

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  /** Events on a given day: stored events + open schedule days matching weekday */
  const eventsOn = (day: Date): { title: string; meta: string; kind: string }[] => {
    const ymd = format(day, "yyyy-MM-dd");
    const out: { title: string; meta: string; kind: string }[] = [];

    for (const ev of state.events) {
      if (ev.date && ev.date === ymd) {
        out.push({
          title: ev.title,
          meta: [ev.location, `${ev.hoursStart}–${ev.hoursEnd}`].filter(Boolean).join(" · "),
          kind: ev.kind,
        });
      }
      if (ev.recurring && ev.recurringWeekday != null && day.getDay() === ev.recurringWeekday) {
        if (!ev.date || ev.date !== ymd) {
          out.push({
            title: `${ev.title} (weekly)`,
            meta: [ev.location, `${ev.hoursStart}–${ev.hoursEnd}`].filter(Boolean).join(" · "),
            kind: ev.kind,
          });
        }
      }
    }

    const schedKey = DOW_TO_SCHEDULE[day.getDay()];
    const sched = state.schedule.find((s) => s.day === schedKey && !s.closed);
    if (sched) {
      out.push({
        title: sched.neighborhood || "Service",
        meta: [sched.spot, sched.hoursStart && `${sched.hoursStart}–${sched.hoursEnd}`]
          .filter(Boolean)
          .join(" · "),
        kind: "schedule",
      });
    }

    return out;
  };

  const selectedEvents = eventsOn(selected);

  const saveEvent = () => {
    if (!draft.title?.trim() || !draft.date) return;
    const ev: TruckEvent = {
      id: crypto.randomUUID(),
      title: draft.title.trim(),
      date: draft.date,
      hoursStart: draft.hoursStart || "",
      hoursEnd: draft.hoursEnd || "",
      location: draft.location || "",
      kind: (draft.kind as TruckEvent["kind"]) || "other",
      recurring: !!draft.recurring,
      recurringWeekday: draft.recurring ? parseISO(draft.date).getDay() : null,
      note: draft.note || "",
    };
    setState({ ...state, events: [...state.events, ev] });
    setFormOpen(false);
    setDraft({
      title: "",
      date: draft.date,
      hoursStart: "11:00 AM",
      hoursEnd: "2:00 PM",
      location: "",
      kind: "festival",
      recurring: false,
      note: "",
    });
  };

  const removeEvent = (id: string) => {
    setState({ ...state, events: state.events.filter((e) => e.id !== id) });
  };

  return (
    <PageShell title="Calendar" eyebrow="Events & markets" pro>
      <TipCard>
        <p className="td-section-label mb-1.5">How to use Calendar</p>
        <p className="text-sm leading-relaxed text-[color:var(--td-ink)]">
          Add festivals and catering gigs. Weekly service from{" "}
          <Link to="/this-week" className="text-brand-orange font-semibold underline">
            This Week
          </Link>{" "}
          appears automatically on matching weekdays.
        </p>
      </TipCard>

      <section className="td-card td-card-pad pro-feature-surface">
        <div className="flex items-center justify-between gap-3 mb-5">
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, -1))}
            className="size-10 rounded-xl border border-[color:var(--border)] font-bold text-[color:var(--td-ink)] bg-[color:var(--surface-2)] transition-all duration-200 hover:border-brand-gold/40 active:scale-95"
            aria-label="Previous month"
          >
            ‹
          </button>
          <h2 className="font-display text-lg tracking-tight text-[color:var(--td-ink)]">
            {format(cursor, "MMMM yyyy")}
          </h2>
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="size-10 rounded-xl border border-[color:var(--border)] font-bold text-[color:var(--td-ink)] bg-[color:var(--surface-2)] transition-all duration-200 hover:border-brand-gold/40 active:scale-95"
            aria-label="Next month"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-[color:var(--td-ink-muted)] mb-2">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {monthDays.map((day) => {
            const inMonth = isSameMonth(day, cursor);
            const sel = isSameDay(day, selected);
            const has = eventsOn(day).length > 0;
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => {
                  setSelected(day);
                  setDraft((d) => ({ ...d, date: format(day, "yyyy-MM-dd") }));
                }}
                className={`aspect-square rounded-xl text-sm font-semibold relative transition-all duration-200 active:scale-[0.96] ${
                  sel
                    ? "bg-brand-orange text-white shadow-md shadow-brand-orange/20 ring-2 ring-brand-gold/35 ring-offset-1 ring-offset-[color:var(--surface)]"
                    : inMonth
                      ? "bg-[color:var(--surface-2)] text-[color:var(--td-ink)] hover:border-brand-gold/35 border border-transparent"
                      : "text-[color:var(--td-ink-muted)] opacity-45"
                }`}
              >
                {format(day, "d")}
                {has && (
                  <span
                    className={`absolute bottom-1 left-1/2 -translate-x-1/2 size-1.5 rounded-full ${
                      sel ? "bg-white" : "bg-brand-gold"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="td-card td-card-pad space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg tracking-tight text-[color:var(--td-ink)]">
            {format(selected, "EEE · MMM d")}
          </h2>
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="text-xs font-bold uppercase tracking-wider text-brand-orange shrink-0"
          >
            {formOpen ? "Cancel" : "+ Add event"}
          </button>
        </div>

        {formOpen && (
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-2)] p-4 space-y-3">
            <input
              value={draft.title || ""}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Event title (e.g. Wayne County Fair)"
              className="td-input"
            />
            <input
              type="date"
              value={draft.date || ""}
              onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
              className="td-input"
            />
            <div className="grid grid-cols-2 gap-2.5">
              <input
                value={draft.hoursStart || ""}
                onChange={(e) => setDraft((d) => ({ ...d, hoursStart: e.target.value }))}
                placeholder="Start"
                className="td-input"
              />
              <input
                value={draft.hoursEnd || ""}
                onChange={(e) => setDraft((d) => ({ ...d, hoursEnd: e.target.value }))}
                placeholder="End"
                className="td-input"
              />
            </div>
            <input
              value={draft.location || ""}
              onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
              placeholder="Location"
              className="td-input"
            />
            <select
              value={draft.kind || "festival"}
              onChange={(e) =>
                setDraft((d) => ({ ...d, kind: e.target.value as TruckEvent["kind"] }))
              }
              className="td-input"
            >
              <option value="festival">Festival</option>
              <option value="catering">Catering</option>
              <option value="market">Market</option>
              <option value="other">Other</option>
            </select>
            <label className="flex items-center gap-2.5 text-sm text-[color:var(--td-ink)]">
              <input
                type="checkbox"
                checked={!!draft.recurring}
                onChange={(e) => setDraft((d) => ({ ...d, recurring: e.target.checked }))}
                className="size-4 accent-brand-orange"
              />
              Recurring weekly
            </label>
            <button
              type="button"
              onClick={saveEvent}
              className="w-full py-3 rounded-xl bg-brand-deep text-white dark:bg-brand-orange dark:text-[#0f2419] font-bold text-sm"
            >
              Save event
            </button>
          </div>
        )}

        <ul className="divide-y divide-[color:var(--border)]">
          {selectedEvents.length === 0 && (
            <li className="py-4 text-sm text-[color:var(--td-ink-muted)] leading-relaxed">
              Nothing scheduled this day.
            </li>
          )}
          {selectedEvents.map((ev, i) => (
            <li key={`${ev.title}-${i}`} className="py-3.5 flex justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold tracking-tight text-[color:var(--td-ink)]">
                  {ev.title}
                </p>
                {ev.meta && (
                  <p className="text-xs text-[color:var(--td-ink-muted)] mt-1 leading-snug">
                    {ev.meta}
                  </p>
                )}
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-orange mt-1.5 inline-block">
                  {ev.kind === "schedule"
                    ? "This Week"
                    : KIND_LABEL[ev.kind as TruckEvent["kind"]] || ev.kind}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="td-card td-card-pad">
        <h2 className="font-display text-lg tracking-tight mb-4 text-[color:var(--td-ink)]">
          Your events
        </h2>
        <ul className="divide-y divide-[color:var(--border)]">
          {state.events.filter((e) => e.title).length === 0 && (
            <li className="py-3 text-sm text-[color:var(--td-ink-muted)] leading-relaxed">
              No custom events yet.
            </li>
          )}
          {state.events.map((ev) => (
            <li key={ev.id} className="py-3.5 flex justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold tracking-tight text-[color:var(--td-ink)]">
                  {ev.title}{" "}
                  <span className="text-[color:var(--td-ink-muted)] font-normal text-xs">
                    {ev.recurring ? "· weekly" : ev.date}
                  </span>
                </p>
                <p className="text-xs text-[color:var(--td-ink-muted)] mt-1 leading-snug">
                  {KIND_LABEL[ev.kind]}
                  {ev.location ? ` · ${ev.location}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeEvent(ev.id)}
                className="text-xs font-bold text-brand-orange shrink-0 self-start px-1 py-1"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
