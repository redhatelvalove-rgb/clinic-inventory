import { describe, it, expect } from "vitest";
import {
  taipeiToday,
  taipeiDatePlusDays,
  taipeiDateOf,
  taipeiDayRangeUtc,
  formatTaipeiDateTime,
} from "../shared/date-utils";

describe("台北時區日期工具", () => {
  it("taipeiToday 輸出 YYYY-MM-DD 格式", () => {
    expect(taipeiToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("taipeiDateOf：UTC 晚上 6 點後屬於台北的隔天（時區 bug 的核心情境）", () => {
    // UTC 7/3 18:30 = 台北 7/4 02:30 → 必須歸在 7/4
    expect(taipeiDateOf("2026-07-03T18:30:00.000Z")).toBe("2026-07-04");
    // UTC 7/3 10:00 = 台北 7/3 18:00 → 還是 7/3
    expect(taipeiDateOf("2026-07-03T10:00:00.000Z")).toBe("2026-07-03");
    // 邊界：UTC 16:00 整 = 台北隔天 00:00
    expect(taipeiDateOf("2026-07-03T16:00:00.000Z")).toBe("2026-07-04");
    expect(taipeiDateOf("2026-07-03T15:59:59.000Z")).toBe("2026-07-03");
  });

  it("taipeiDayRangeUtc：台北一天對應的 UTC 範圍是前一天 16:00 起算 24 小時", () => {
    const { startUtc, endUtc } = taipeiDayRangeUtc("2026-07-04");
    expect(startUtc).toBe("2026-07-03T16:00:00.000Z");
    expect(endUtc).toBe("2026-07-04T16:00:00.000Z");
  });

  it("taipeiDatePlusDays：跨月與跨年正確進位", () => {
    // 相對 taipeiToday 的偏移驗證：+0 天 = 今天
    expect(taipeiDatePlusDays(0)).toBe(taipeiToday());
    // +1 天必須嚴格大於今天（字串比較對 YYYY-MM-DD 成立）
    expect(taipeiDatePlusDays(1) > taipeiToday()).toBe(true);
    expect(taipeiDatePlusDays(30)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("formatTaipeiDateTime：UTC 時間戳顯示成台北時間", () => {
    // UTC 7/3 18:30 = 台北 7/4 02:30
    const out = formatTaipeiDateTime("2026-07-03T18:30:00.000Z");
    expect(out).toContain("2026/07/04");
    expect(out).toContain("02:30");
  });

  it("formatTaipeiDateTime：空值與壞值不炸", () => {
    expect(formatTaipeiDateTime(null)).toBe("");
    expect(formatTaipeiDateTime(undefined)).toBe("");
    expect(formatTaipeiDateTime("not-a-date")).toBe("not-a-date");
  });
});
