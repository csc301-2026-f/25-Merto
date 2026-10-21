"use client";

import { startTransition, useActionState, useMemo, useState, type FormEvent } from "react";
import { saveAppointment } from "@/app/appointments/actions";
import { APPOINTMENT_STATUSES, type Appointment } from "@/lib/appointments";
import type { Deal } from "@/lib/deals";
import { formatDateTime, label, torontoDateTimeLocal, torontoDateTimeToIso } from "@/lib/format";

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayInToronto(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric" }).format(date);
}

function dayTitle(key: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric",
  }).format(new Date(`${key}T12:00:00Z`));
}

function localDefault(key: string): string {
  return `${key}T09:00`;
}

function AppointmentForm({
  deals,
  selectedDate,
  appointment,
  onCancel,
}: {
  deals: Deal[];
  selectedDate: string;
  appointment: Appointment | null;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(saveAppointment, undefined);
  const [localError, setLocalError] = useState<string | null>(null);
  const defaultDate = appointment
    ? torontoDateTimeLocal(appointment.scheduledFor)
    : localDefault(selectedDate);
  const knownDeal = appointment && !deals.some((deal) => deal.dealId === appointment.dealId)
    ? appointment
    : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const localDate = form.elements.namedItem("scheduledForLocal");
    if (!(localDate instanceof HTMLInputElement)) return;
    try {
      const data = new FormData(form);
      data.set("scheduledFor", torontoDateTimeToIso(localDate.value));
      setLocalError(null);
      startTransition(() => formAction(data));
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Enter a valid appointment date and time.");
    }
  }

  return (
    <form key={appointment?.id ?? selectedDate} action={formAction} onSubmit={submit} className="space-y-4">
      <input type="hidden" name="appointmentId" value={appointment?.id ?? ""} />
      {appointment && <input type="hidden" name="dealId" value={appointment.dealId} />}

      {!appointment && (
        <div className="flex flex-col gap-1">
          <label htmlFor="dealIdSelect" className="font-semibold">Customer</label>
          <select
            id="dealIdSelect"
            name="dealId"
            required
            defaultValue=""
            disabled={pending}
            className="rounded border-2 px-2 py-2"
          >
            <option value="" disabled>Select a customer…</option>
            {deals.map((deal) => (
              <option key={deal.dealId} value={deal.dealId}>
                {deal.buyer} · {deal.vehicleInterest}
              </option>
            ))}
          </select>
          {deals.length === 0 && <p className="text-sm opacity-70">No active customers are available.</p>}
        </div>
      )}

      {appointment && (
        <p className="font-semibold">
          {appointment.buyer} <span className="font-normal opacity-70">· {appointment.vehicleInterest}</span>
          {knownDeal?.owner && <span className="block text-sm font-normal">Owner: {knownDeal.owner}</span>}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="scheduledForLocal" className="font-semibold">Date and time (Toronto)</label>
        <input
          id="scheduledForLocal"
          name="scheduledForLocal"
          type="datetime-local"
          required
          defaultValue={defaultDate}
          disabled={pending}
          className="rounded border-2 px-2 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="appointmentStatus" className="font-semibold">Status</label>
        <select
          id="appointmentStatus"
          name="status"
          defaultValue={appointment?.status ?? "requested"}
          disabled={pending}
          className="rounded border-2 px-2 py-2"
        >
          {APPOINTMENT_STATUSES.map((status) => (
            <option key={status} value={status}>{label(status)}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="outcomeNote" className="font-semibold">Notes</label>
        <textarea
          id="outcomeNote"
          name="outcomeNote"
          maxLength={500}
          rows={3}
          defaultValue={appointment?.outcomeNote ?? ""}
          disabled={pending}
          className="rounded border-2 px-2 py-2"
        />
      </div>

      {(localError || state?.error) && (
        <p role="alert" className="text-sm text-red-700">{localError ?? state?.error}</p>
      )}
      {state?.success && <p role="status" className="text-sm text-green-700">{state.success}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending || (!appointment && deals.length === 0)}
          className="rounded border-2 px-4 py-2 font-semibold disabled:opacity-50"
        >
          {pending ? "Saving…" : appointment ? "Save changes" : "Create appointment"}
        </button>
        {appointment && (
          <button type="button" onClick={onCancel} className="rounded border-2 px-4 py-2">
            Cancel edit
          </button>
        )}
      </div>
    </form>
  );
}

export function AppointmentCalendar({
  role,
  appointments,
  deals,
}: {
  role: "manager" | "rep";
  appointments: Appointment[];
  deals: Deal[];
}) {
  const today = todayInToronto();
  const [selectedDate, setSelectedDate] = useState(today);
  const [month, setMonth] = useState(() => {
    const [year, monthNumber] = today.split("-").map(Number);
    return new Date(year, monthNumber - 1, 1);
  });
  const [editing, setEditing] = useState<Appointment | null>(null);

  const appointmentsByDate = useMemo(() => {
    const grouped = new Map<string, Appointment[]>();
    for (const appointment of appointments) {
      const key = torontoDateTimeLocal(appointment.scheduledFor).slice(0, 10);
      grouped.set(key, [...(grouped.get(key) ?? []), appointment]);
    }
    return grouped;
  }, [appointments]);

  const calendarDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
    return Array.from({ length: 42 }, (_value, index) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [month]);

  function changeMonth(offset: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function chooseDate(date: Date) {
    setSelectedDate(dateKey(date));
    setEditing(null);
  }

  const dayAppointments = appointmentsByDate.get(selectedDate) ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="mt-1 opacity-70">Create and manage customer appointments. Times are shown in Toronto time.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="rounded border-2 px-4 py-2 font-semibold"
        >
          New appointment
        </button>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <section aria-label="Appointment calendar" className="rounded border-2 p-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <button type="button" onClick={() => changeMonth(-1)} className="rounded border-2 px-3 py-1">
              Previous
            </button>
            <h2 className="text-xl font-semibold">{monthLabel(month)}</h2>
            <button type="button" onClick={() => changeMonth(1)} className="rounded border-2 px-3 py-1">
              Next
            </button>
          </div>
          <div className="grid grid-cols-7 border-l border-t">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
              <div key={weekday} className="border-b border-r p-2 text-center text-sm font-semibold">
                {weekday}
              </div>
            ))}
            {calendarDays.map((date) => {
              const key = dateKey(date);
              const entries = appointmentsByDate.get(key) ?? [];
              const isCurrentMonth = date.getMonth() === month.getMonth();
              return (
                <div key={key} className={`min-h-28 border-b border-r p-1 ${isCurrentMonth ? "" : "opacity-50"}`}>
                  <button
                    type="button"
                    onClick={() => chooseDate(date)}
                    aria-pressed={selectedDate === key}
                    className={`mb-1 grid h-8 w-8 place-items-center rounded-full text-sm ${
                      selectedDate === key ? "bg-black text-white" : key === today ? "border-2 font-bold" : ""
                    }`}
                  >
                    {date.getDate()}
                  </button>
                  <div className="space-y-1">
                    {entries.slice(0, 2).map((appointment) => (
                      <button
                        key={appointment.id}
                        type="button"
                        onClick={() => {
                          setSelectedDate(key);
                          setEditing(appointment);
                        }}
                        className="block w-full truncate rounded bg-blue-100 px-1 py-0.5 text-left text-xs text-blue-950 hover:underline"
                        title={`${appointment.buyer} · ${formatDateTime(appointment.scheduledFor)}`}
                      >
                        {torontoDateTimeLocal(appointment.scheduledFor).slice(11)} {appointment.buyer}
                      </button>
                    ))}
                    {entries.length > 2 && <p className="px-1 text-xs">+{entries.length - 2} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded border-2">
            <header className="border-b-2 p-3">
              <h2 className="font-semibold">{dayTitle(selectedDate)}</h2>
              <p className="text-sm opacity-70">{dayAppointments.length} appointment{dayAppointments.length === 1 ? "" : "s"}</p>
            </header>
            {dayAppointments.length === 0 ? (
              <p className="p-4 text-sm opacity-70">No appointments scheduled.</p>
            ) : (
              <ul className="divide-y-2">
                {dayAppointments.map((appointment) => (
                  <li key={appointment.id} className="space-y-1 p-4">
                    <p className="font-semibold">{appointment.buyer}</p>
                    <p>{formatDateTime(appointment.scheduledFor)}</p>
                    <p className="text-sm opacity-70">
                      {appointment.vehicleInterest} · {label(appointment.status)}
                      {role === "manager" && appointment.owner ? ` · ${appointment.owner}` : ""}
                    </p>
                    {appointment.outcomeNote && <p className="text-sm">{appointment.outcomeNote}</p>}
                    <button
                      type="button"
                      onClick={() => setEditing(appointment)}
                      className="pt-1 text-sm font-semibold underline"
                    >
                      Edit appointment
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded border-2 p-4">
            <h2 className="mb-4 text-lg font-semibold">
              {editing ? "Edit appointment" : "Create appointment"}
            </h2>
            <AppointmentForm
              key={`${editing?.id ?? "new"}-${selectedDate}`}
              deals={deals}
              selectedDate={selectedDate}
              appointment={editing}
              onCancel={() => setEditing(null)}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
