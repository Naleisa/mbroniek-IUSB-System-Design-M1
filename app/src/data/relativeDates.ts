// Seed dates are written relative to today (ADR-21): `today`, `today+20`, `today-3 10:05`.
const RELATIVE_DATE = /^today(?:([+-])(\d+))?(?: (\d{2}:\d{2}))?$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Formats a moment as a local `YYYY-MM-DDTHH:MM`, the same format resolved seed times use. */
export function formatLocalDateTime(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Resolves a relative seed date to a local `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`. Other values are returned unchanged. */
export function resolveRelativeDate(value: string, today: Date): string {
  const match = RELATIVE_DATE.exec(value.trim());
  if (!match) {
    return value;
  }

  const [, sign, amount, time] = match;
  const offset = amount ? Number(amount) * (sign === '-' ? -1 : 1) : 0;
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  return time ? `${day}T${time}` : day;
}
