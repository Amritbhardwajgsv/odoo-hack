// Shared local-date helpers. `new Date().toISOString()` converts to UTC
// first, which silently shows yesterday's or tomorrow's date for part of
// the day depending on the browser's timezone offset - every "default to
// today" field in this app reads from here instead so that mistake can't
// get reintroduced one form at a time.

function pad(value: number) {
  return String(value).padStart(2, '0');
}

// The browser's own local calendar date, as YYYY-MM-DD.
export function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function startOfYearIso(date = new Date()) {
  return `${date.getFullYear()}-01-01`;
}

export function endOfYearIso(date = new Date()) {
  return `${date.getFullYear()}-12-31`;
}

export function startOfMonthIso(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Plain-text time entry, deliberately not <input type="time"> - that native
// widget's own internal per-segment validity tracking throws a browser
// "Invalid value" bubble on values it considers incomplete (most often the
// AM/PM segment) even when a value was set programmatically as a complete,
// correct time and looks complete on screen. A text field with our own
// regex check has no such internal state to get confused, and puts the
// error message in the same place every other validation error in this app
// already appears instead of an un-stylable, undismissable native tooltip.
// Accepts "9:30" as well as "09:30" - typing a time by hand naturally skips
// the leading zero, and the field shouldn't punish that when the intent is
// unambiguous. Returns the zero-padded "HH:MM" form, or null if the input
// doesn't parse as a time at all.
export function normalizeTime(value: string): string | null {
  const trimmed = value.trim();
  const loose = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  const padded = loose ? `${loose[1].padStart(2, '0')}:${loose[2]}` : trimmed;
  return TIME_PATTERN.test(padded) ? padded : null;
}

export function isValidTime(value: string) {
  return normalizeTime(value) !== null;
}
