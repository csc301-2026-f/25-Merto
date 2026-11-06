const configuredTimeZone = process.env.DEALERSHIP_TIME_ZONE ?? 'America/Toronto';

export const dealershipTimeZone = new Intl.DateTimeFormat('en-US', {
  timeZone: configuredTimeZone,
}).resolvedOptions().timeZone;
