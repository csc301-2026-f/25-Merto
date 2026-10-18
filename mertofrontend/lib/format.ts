// The dealership's local time, so pages read the same wherever the server runs.
const dateTime = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Toronto",
});

export const formatDateTime = (iso: string | null) => (iso ? dateTime.format(new Date(iso)) : "—");

// "appointment_set" → "appointment set"
export const label = (value: string) => value.replaceAll("_", " ");
