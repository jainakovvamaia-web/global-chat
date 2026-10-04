// Форматирование дат и чисел для интерфейса (русская локаль)

const timeFormatter = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const dayMonthFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const shortDayMonthFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const daysBetween = (date: Date, now: Date) => {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOf(now) - startOf(date)) / 86_400_000);
};

// 09:42
export const formatTime = (iso: string) => timeFormatter.format(new Date(iso));

// «Сегодня», «Вчера» или «15 сентября» — для разделителей между днями в чате
export function formatDayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const diff = daysBetween(date, now);
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Вчера";
  return dayMonthFormatter.format(date);
}

// Время для списков: «09:42», «вчера» или «15 сент.»
export function formatShortDate(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const diff = daysBetween(date, now);
  if (diff === 0) return formatTime(iso);
  if (diff === 1) return "вчера";
  return shortDayMonthFormatter.format(date);
}

export const isSameDayIso = (a: string, b: string) => isSameDay(new Date(a), new Date(b));

// 1240 → «1 240»
export const formatCount = (value: number) => value.toLocaleString("ru-RU");

// «только что», «10 мин», «2 ч», затем «вчера» / «15 сент.» — для уведомлений и журнала
export function formatRelative(iso: string, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} ч`;
  return formatShortDate(iso, now);
}

const fullDateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });

// «15 сентября 2023 г.»
export const formatFullDate = (iso: string) => fullDateFormatter.format(new Date(iso));

// «4 октября» — день события без времени
export const formatDayMonth = (iso: string) => dayMonthFormatter.format(new Date(iso));
