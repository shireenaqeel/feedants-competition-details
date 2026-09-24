import type { Lang } from '@/i18n/strings';

/** Indian digit grouping (1,50,000) without relying on Intl support in the JS engine. */
function groupIndian(n: number): string {
  const s = String(Math.trunc(Math.abs(n)));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/** Amounts come from the API in paise. 150000 → "₹ 1,500"; 9950 → "₹ 99.50". */
export function formatMoney(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const fraction = paise % 100;
  return `₹ ${groupIndian(rupees)}${fraction ? `.${String(fraction).padStart(2, '0')}` : ''}`;
}

const MONTHS: Record<Lang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'],
  hi: ['जन', 'फ़र', 'मार्च', 'अप्रै', 'मई', 'जून', 'जुल', 'अग', 'सितं', 'अक्टू', 'नव', 'दिस'],
};

/** "10 Aug 26" in the device's time zone. */
export function formatDate(iso: string | Date, lang: Lang): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[lang][d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

/** "11:50 PM" */
export function formatTime(iso: string | Date): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

export function countdownParts(msLeft: number): CountdownParts {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    done: total === 0,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "01d : 06h : 28m : 32s" */
export function formatCountdown(p: CountdownParts): string {
  return `${pad(p.days)}d : ${pad(p.hours)}h : ${pad(p.minutes)}m : ${pad(p.seconds)}s`;
}

/** Short form for buttons: "1d 6h", "28m 32s", "09:41". */
export function formatShortDuration(p: CountdownParts): string {
  if (p.days > 0) return `${p.days}d ${p.hours}h`;
  if (p.hours > 0) return `${p.hours}h ${p.minutes}m`;
  return `${pad(p.minutes)}:${pad(p.seconds)}`;
}

export function ordinal(n: number, lang: Lang): string {
  if (lang === 'hi') return ['प्रथम', 'द्वितीय', 'तृतीय', 'चतुर्थ', 'पंचम', 'षष्ठ'][n - 1] ?? `${n}वाँ`;
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}
