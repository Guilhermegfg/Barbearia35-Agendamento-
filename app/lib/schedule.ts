export type BusinessHours = Record<string, [string, string] | null>;

export const defaultBusinessHours: BusinessHours = {
  "0": null,
  "1": ["09:00", "19:00"],
  "2": ["09:00", "19:00"],
  "3": ["09:00", "19:00"],
  "4": ["09:00", "19:00"],
  "5": ["09:00", "19:00"],
  "6": ["09:00", "18:00"],
};

export function toMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function overlaps(startA: number, durationA: number, startB: number, durationB: number) {
  return startA < startB + durationB && startB < startA + durationA;
}

export function weekday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function todayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function parseBusinessHours(value?: string | null): BusinessHours {
  if (!value) return defaultBusinessHours;
  try {
    return { ...defaultBusinessHours, ...(JSON.parse(value) as BusinessHours) };
  } catch {
    return defaultBusinessHours;
  }
}
