
"use client";

import {
  useCallback,
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveAppointment } from "@/app/appointments/actions";
import { APPOINTMENT_STATUSES, type Appointment, type AppointmentOverview } from "@/lib/appointments";
import type { Deal, Rep } from "@/lib/deals";
import {
  dealershipTimeZone,
  formatDateTime,
  label,
  dealershipDateTimeLocal,
  dealershipDateTimeToIso,
} from "@/lib/format";

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayInDealershipTimeZone(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: dealershipTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function dayTitle(key: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${key}T12:00:00Z`));
}

function localDefault(key: string): string {
  return `${key}T09:00`;
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-black focus:border-[#d5bd91] focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white";

const buttonClass =
  "rounded-lg border border-zinc-300 px-3 py-2 font-semibold transition hover:bg-zinc-200 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

const primaryButtonClass =
  "rounded-lg px-4 py-2 font-semibold text-black transition bg-[#d5bd91] hover:bg-[#e3cda6] disabled:opacity-50";

function AppointmentForm({
  deals,
  selectedDate,
  appointment,
  role,
  onCancel,
  onSaved,
}: {
  deals: Deal[];
  selectedDate: string;
  appointment: Appointment | null;
  role: "manager" | "rep";
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [state, formAction, pending] = useActionState(
    saveAppointment,
    undefined
  );
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (state?.success) onSaved(state.success);
  }, [onSaved, state]);

  const defaultDate = appointment
    ? dealershipDateTimeLocal(appointment.scheduledFor)
    : localDefault(selectedDate);

  const knownDeal =
    appointment && !deals.some((deal) => deal.dealId === appointment.dealId)
      ? appointment
      : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const localDate = form.elements.namedItem("scheduledForLocal");

    if (!(localDate instanceof HTMLInputElement)) return;

    try {
      const data = new FormData(form);
      data.set("scheduledFor", dealershipDateTimeToIso(localDate.value));
      setLocalError(null);
      startTransition(() => formAction(data));
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "Enter a valid appointment date and time."
      );
    }
  }

  return (
    <form
      key={appointment?.id ?? selectedDate}
      action={formAction}
      onSubmit={submit}
      className="space-y-4"
    >
      <input
        type="hidden"
        name="appointmentId"
        value={appointment?.id ?? ""}
      />
      {appointment && (
        <input type="hidden" name="dealId" value={appointment.dealId} />
      )}

      {!appointment && (
        <div className="flex flex-col gap-1">
          <label htmlFor="dealIdSelect" className="font-semibold">
            Customer
          </label>

          <select
            id="dealIdSelect"
            name="dealId"
            required
            defaultValue=""
            disabled={pending}
            className={inputClass}
          >
            <option className="text-black" value="" disabled>
              Select a customer…
            </option>
            {deals.map((deal) => (
              <option
                className="text-black bg-white"
                key={deal.dealId}
                value={deal.dealId}
              >
                {deal.buyer} · {deal.vehicleInterest}
              </option>
            ))}
          </select>

          {deals.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No active customers are available.
            </p>
          )}
        </div>
      )}

      {appointment && (
        <div className="rounded-lg bg-zinc-200 p-3 dark:bg-zinc-800">
          <p className="font-semibold">
            {appointment.buyer}
            <span className="font-normal text-zinc-600 dark:text-zinc-400">
              {" "}· {appointment.vehicleInterest}
            </span>
          </p>

          {knownDeal?.owner && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Owner: {knownDeal.owner}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="scheduledForLocal" className="font-semibold">
          Date and time ({dealershipTimeZone})
        </label>
        <input
          id="scheduledForLocal"
          name="scheduledForLocal"
          type="datetime-local"
          required
          defaultValue={defaultDate}
          disabled={pending}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="appointmentStatus" className="font-semibold">
          Status
        </label>
        <select
          id="appointmentStatus"
          name="status"
          defaultValue={appointment?.status ?? (role === "rep" ? "confirmed" : "requested")}
          disabled={pending}
          className={inputClass}
        >
          {(appointment
            ? APPOINTMENT_STATUSES
            : [role === "rep" ? "confirmed" : "requested"]
          ).map((status) => (
            <option className="text-black bg-white" key={status} value={status}>
              {label(status)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="outcomeNote" className="font-semibold">
          Notes
        </label>
        <textarea
          id="outcomeNote"
          name="outcomeNote"
          maxLength={500}
          rows={3}
          defaultValue={appointment?.outcomeNote ?? ""}
          disabled={pending}
          className={inputClass}
        />
      </div>

      {(localError || state?.error) && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {localError ?? state?.error}
        </p>
      )}

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={pending || (!appointment && deals.length === 0)}
          className={primaryButtonClass}
        >
          {pending
            ? "Saving…"
            : appointment
              ? "Save change"
              : "Create appointment"}
        </button>

        {(
          <button
            type="button"
            onClick={onCancel}
            className={buttonClass}
          >
            {appointment ? "Cancel edit" : "Cancel"}
          </button>
        )}
      </div>
    </form>
  );
}

export function AppointmentCalendar({
  role,
  overview,
  deals,
  reps,
}: {
  role: "manager" | "rep";
  overview: AppointmentOverview;
  deals: Deal[];
  reps: Rep[];
}) {
  const today = todayInDealershipTimeZone();
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedRepId, setSelectedRepId] = useState("");
  const [panel, setPanel] = useState<"appointments" | "edit" | "create">("appointments");
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const router = useRouter();

  const [month, setMonth] = useState(() => {
    const [year, monthNumber] = today.split("-").map(Number);
    return new Date(year, monthNumber - 1, 1);
  });

  const appointments = useMemo(
    () => selectedRepId
      ? overview.appointments.filter((appointment) => appointment.ownerId === selectedRepId)
      : overview.appointments,
    [overview.appointments, selectedRepId],
  );
  const requestedToConfirm = selectedRepId
    ? overview.requestedToConfirm.filter((appointment) => appointment.ownerId === selectedRepId)
    : overview.requestedToConfirm;
  const showAppointmentList = useCallback((message?: string) => {
    setPanel("appointments");
    setEditing(null);
    setNotice(message ?? null);
    if (message) router.refresh();
  }, [router]);

  const startCreate = () => {
    setEditing(null);
    setNotice(null);
    setPanel("create");
  };

  const startEdit = (appointment: Appointment) => {
    const appointmentDate = dealershipDateTimeLocal(appointment.scheduledFor).slice(0, 10);
    const [year, monthNumber] = appointmentDate.split("-").map(Number);
    setSelectedDate(appointmentDate);
    setMonth(new Date(year, monthNumber - 1, 1));
    setEditing(appointment);
    setNotice(null);
    setPanel("edit");
  };

  const appointmentsByDate = useMemo(() => {
    const grouped = new Map<string, Appointment[]>();

    for (const appointment of appointments) {
      const key = dealershipDateTimeLocal(appointment.scheduledFor).slice(0, 10);
      grouped.set(key, [...(grouped.get(key) ?? []), appointment]);
    }

    return grouped;
  }, [appointments]);

  const calendarDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(
      first.getFullYear(),
      first.getMonth(),
      1 - first.getDay()
    );

    return Array.from({ length: 42 }, (_value, index) =>
      new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + index
      )
    );
  }, [month]);

  function changeMonth(offset: number) {
    setMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1)
    );
  }

  function chooseDate(date: Date) {
    setSelectedDate(dateKey(date));
    setPanel("appointments");
    setEditing(null);
    setNotice(null);
  }

  const dayAppointments = appointmentsByDate.get(selectedDate) ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Appointments</h1>
        </div>

      </header>

      {role === "manager" && (
        <section aria-label="Appointments requested but not confirmed">
          <AppointmentExceptionList
            appointments={requestedToConfirm}
            expandedId={expandedRequestId}
            onToggle={(id) => setExpandedRequestId((current) => current === id ? null : id)}
            onEdit={startEdit}
          />
        </section>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        {/* Calendar */}
        <section
          aria-label="Appointment calendar"
          className="rounded-xl bg-slate-100 p-4 shadow-sm dark:bg-zinc-900"
        >
          {role === "manager" && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <label htmlFor="calendarRepFilter" className="font-semibold">Show appointments for</label>
              <select
                id="calendarRepFilter"
                value={selectedRepId}
                onChange={(event) => setSelectedRepId(event.target.value)}
                className={`${inputClass} max-w-xs`}
              >
                <option value="">All representatives</option>
                {reps.map((rep) => (
                  <option key={rep.id} value={rep.id}>{rep.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className={buttonClass}
            >
              Previous
            </button>

            <h2 className="text-lg font-semibold sm:text-xl">
              {monthLabel(month)}
            </h2>

            <button
              type="button"
              onClick={() => changeMonth(1)}
              className={buttonClass}
            >
              Next
            </button>
          </div>

          <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (weekday) => (
                <div
                  key={weekday}
                  className="border-b border-r border-zinc-300 bg-zinc-200 p-2 text-center text-xs font-semibold last:border-r-0 dark:border-zinc-700 dark:bg-zinc-800 sm:text-sm"
                >
                  {weekday}
                </div>
              )
            )}

            {calendarDays.map((date) => {
              const key = dateKey(date);
              const entries = appointmentsByDate.get(key) ?? [];
              const isCurrentMonth = date.getMonth() === month.getMonth();

              return (
                <div
                  key={key}
                  className={`min-h-24 border-b border-r border-zinc-300 p-1 dark:border-zinc-700 sm:min-h-28 sm:p-2 ${
                    isCurrentMonth
                      ? "bg-white dark:bg-zinc-900"
                      : "bg-zinc-100 text-zinc-400 dark:bg-zinc-950 dark:text-zinc-600"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => chooseDate(date)}
                    aria-pressed={selectedDate === key}
                    className={`mb-1 grid h-7 w-7 place-items-center rounded-full text-xs font-medium transition sm:h-8 sm:w-8 sm:text-sm ${
                      selectedDate === key
                        ? "bg-[#d5bd91] font-bold text-black"
                        : key === today
                          ? "border-2 border-[#d5bd91] font-bold text-[#918163] dark:text-amber-400"
                          : "hover:bg-zinc-200 dark:hover:bg-zinc-800"
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
                          startEdit(appointment);
                        }}
                        className="block w-full truncate rounded bg-amber-100 px-1 py-1 text-left text-[10px] text-[#594a2e] transition hover:bg-[#d5bd91] sm:text-xs dark:bg-[#d5bd91]/20 dark:text-amber-200 dark:hover:bg-[#d5bd91]/30"
                        title={`${appointment.buyer} · ${formatDateTime(appointment.scheduledFor)}`}
                      >
                        {dealershipDateTimeLocal(
                          appointment.scheduledFor
                        ).slice(11)}{" "}
                        {appointment.buyer}
                      </button>
                    ))}

                    {entries.length > 2 && (
                      <p className="px-1 text-[10px] text-zinc-500 sm:text-xs dark:text-zinc-400">
                        +{entries.length - 2} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Single appointment panel: list, edit, or create. */}
        <aside>
          <section className="flex h-full flex-col overflow-hidden rounded-xl bg-slate-100 shadow-sm dark:bg-zinc-900">
            <header className="border-b border-zinc-300 p-4 dark:border-zinc-700">
              <h2 className="font-semibold">
                {panel === "appointments" ? "Appointments" : panel === "edit" ? "Edit Appointment" : "Create Appointment"}
              </h2>
              {panel === "appointments" && (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {dayTitle(selectedDate)} · {dayAppointments.length} appointment{dayAppointments.length === 1 ? "" : "s"}
                </p>
              )}
            </header>

            {notice && panel === "appointments" && (
              <p role="status" className="px-4 pt-3 font-semibold text-green-700 dark:text-green-400">
                {notice}
              </p>
            )}

            <div className="flex-1 p-4">
              {panel === "appointments" ? (
                dayAppointments.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No appointments scheduled.</p>
                ) : (
                  <ul className="divide-y divide-zinc-300 dark:divide-zinc-700">
                    {dayAppointments.map((appointment) => (
                      <li key={appointment.id} className="space-y-2 py-4 first:pt-0">
                        <p className="font-semibold">{appointment.buyer}</p>
                        <p className="text-sm">{formatDateTime(appointment.scheduledFor)}</p>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          {appointment.vehicleInterest} · {label(appointment.status)}
                        </p>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          Rep: {appointment.owner ?? "Unassigned"}
                          {" · "}
                          {appointment.status === "completed"
                            ? "Showed up"
                            : appointment.status === "no_show"
                              ? "Did not show"
                              : "Attendance not recorded"}
                        </p>
                        {appointment.outcomeNote && (
                          <p className="text-sm text-zinc-600 dark:text-zinc-300">{appointment.outcomeNote}</p>
                        )}
                        <button
                          type="button"
                          onClick={() => startEdit(appointment)}
                          className="pt-1 text-sm font-semibold text-[#d5bd91] hover:underline"
                        >
                          Edit Appointment
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <AppointmentForm
                  key={`${panel}-${editing?.id ?? "new"}-${selectedDate}`}
                  deals={deals}
                  selectedDate={selectedDate}
                  appointment={panel === "edit" ? editing : null}
                  role={role}
                  onCancel={() => showAppointmentList()}
                  onSaved={showAppointmentList}
                />
              )}
            </div>

            {panel === "appointments" && (
              <footer className="border-t border-zinc-300 p-4 dark:border-zinc-700">
                <button type="button" onClick={startCreate} className={primaryButtonClass}>
                  New Appointment
                </button>
              </footer>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function AppointmentExceptionList({
  appointments,
  expandedId,
  onToggle,
  onEdit,
}: {
  appointments: Appointment[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onEdit: (appointment: Appointment) => void;
}) {
  return (
    <section className="rounded-xl bg-slate-100 p-4 shadow-sm dark:bg-zinc-900">
      <h2 className="mb-3 font-semibold">Appointments requested but not confirmed ({appointments.length})</h2>
      {appointments.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">None right now.</p>
      ) : (
        <ul className="divide-y divide-zinc-300 dark:divide-zinc-700">
          {appointments.map((appointment) => (
            <li key={appointment.id} className="py-3">
              <button
                type="button"
                aria-expanded={expandedId === appointment.id}
                onClick={() => onToggle(appointment.id)}
                className="grid w-full gap-1 text-left text-sm hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 sm:grid-cols-2"
              >
                <span><span className="font-semibold">Rep:</span> {appointment.owner ?? "Unassigned"}</span>
                <span><span className="font-semibold">Customer:</span> {appointment.buyer}</span>
                <span><span className="font-semibold">Model:</span> {appointment.vehicleInterest}</span>
                <span><span className="font-semibold">Requested:</span> {appointment.createdAt
                  ? formatDateTime(appointment.createdAt)
                  : "Historical request time unavailable"}</span>
                <span className="sm:col-span-2">
                  <span className="font-semibold">Requested appointment:</span> {formatDateTime(appointment.scheduledFor)}
                </span>
              </button>
              {expandedId === appointment.id && (
                <div className="mt-3 space-y-3 rounded-lg bg-white p-3 text-sm dark:bg-zinc-800">
                  <dl className="grid gap-1 sm:grid-cols-2">
                    <div><dt className="font-semibold">Request source</dt><dd>
                      {appointment.requestedBy ?? label(appointment.requestedByType)}
                    </dd></div>
                    <div><dt className="font-semibold">Status</dt><dd>{label(appointment.status)}</dd></div>
                  </dl>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => onEdit(appointment)}
                      className={primaryButtonClass}
                    >
                      Edit Appointment
                    </button>
                    <Link
                      href={`/manager/deal-details/${encodeURIComponent(appointment.dealId)}`}
                      className={buttonClass}
                    >
                      View Full Record
                    </Link>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
