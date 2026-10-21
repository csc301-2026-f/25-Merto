// The dealership's local time, so pages read the same wherever the server runs.
const dateTime = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Toronto",
});

export const formatDateTime = (iso: string | null) => (iso ? dateTime.format(new Date(iso)) : "—");

// "appointment_set" → "appointment set"
export const label = (value: string) => value.replaceAll("_", " ");

const torontoParts = (date: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
}).formatToParts(date);

export function torontoDateTimeLocal(iso: string): string {
  const parts = Object.fromEntries(torontoParts(new Date(iso)).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function torontoDateTimeToIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Enter a valid appointment date and time.");
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  let timestamp = target;

  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = Object.fromEntries(torontoParts(new Date(timestamp)).map(({ type, value: part }) => [type, part]));
    const displayed = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute),
    );
    const difference = target - displayed;
    if (difference === 0) return new Date(timestamp).toISOString();
    timestamp += difference;
  }
  throw new Error("That local time does not exist in Toronto because of a daylight-saving change.");
}
