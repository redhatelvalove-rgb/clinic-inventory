/**
 * shared/date-utils.ts — 台北時區日期工具（前後端共用）
 *
 * 背景：VPS 系統時區是 UTC，若用 new Date().toISOString() 取「今天」，
 * 台灣每天 00:00–08:00 之間會差一天 → 過期批次可出庫、報表歸錯天。
 * 所有「今天是哪一天」「這筆交易屬於哪一天」的判斷一律用本檔工具。
 * （txn_time 等時間戳仍以 ISO UTC 儲存，只在判斷與顯示時轉台北時區。）
 */

const TAIPEI_TZ = "Asia/Taipei";

/** 台北時區的今天，格式 YYYY-MM-DD（en-CA locale 恰好輸出此格式） */
export function taipeiToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TAIPEI_TZ }).format(new Date());
}

/** 台北時區今天起算 N 天後的日期，格式 YYYY-MM-DD */
export function taipeiDatePlusDays(days: number): string {
  // 以台北今天 00:00（UTC+8，無日光節約）為基準加天數
  const start = new Date(`${taipeiToday()}T00:00:00+08:00`);
  const target = new Date(start.getTime() + days * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TAIPEI_TZ }).format(target);
}

/** 某個 ISO 時間戳在台北時區屬於哪一天，格式 YYYY-MM-DD */
export function taipeiDateOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TAIPEI_TZ }).format(new Date(iso));
}

/**
 * 台北時區某一天（預設今天）對應的 UTC 時間範圍 [startUtc, endUtc)。
 * 給「今日進出量」這類以 txn_time（UTC ISO）篩選的 SQL 用。
 */
export function taipeiDayRangeUtc(dateStr?: string): { startUtc: string; endUtc: string } {
  const d = dateStr ?? taipeiToday();
  const start = new Date(`${d}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 86400000);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

/**
 * 台北時區某個月（YYYY-MM）對應的 UTC 時間範圍 [startUtc, endUtc)。
 * 給月報表以 txn_time（UTC ISO）篩選整月交易用。
 */
export function taipeiMonthRangeUtc(month: string): { startUtc: string; endUtc: string } {
  const [y, m] = month.split("-").map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return {
    startUtc: new Date(`${month}-01T00:00:00+08:00`).toISOString(),
    endUtc: new Date(`${nextMonth}-01T00:00:00+08:00`).toISOString(),
  };
}

/** ISO 時間戳 → 台北時區顯示字串「2026/07/04 14:30」；空值回空字串 */
export function formatTaipeiDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: TAIPEI_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}
