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
