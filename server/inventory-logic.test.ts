import { describe, it, expect } from "vitest";
import { selectFefoBatches, computeDisposal, computeAdjustmentDelta, type NormBatch } from "./inventory-logic";

const TODAY = "2026-06-29";

const batches: NormBatch[] = [
  { id: "B-LATE",    remainingQty: 5, expiryDate: "2026-12-31" },
  { id: "B-EARLY",   remainingQty: 3, expiryDate: "2026-07-10" },
  { id: "B-EXPIRED", remainingQty: 9, expiryDate: "2026-06-01" }, // 已過期
  { id: "B-EMPTY",   remainingQty: 0, expiryDate: "2026-08-01" }, // 無剩餘
];

describe("selectFefoBatches — FEFO 依序扣批次", () => {
  it("優先扣最早到期（未過期）批次", () => {
    const r = selectFefoBatches(batches, 2, TODAY);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.usedBatches).toEqual([{ batchId: "B-EARLY", qty: 2 }]);
  });

  it("數量跨批次時，扣完最早再扣次早，跳過過期與空批次", () => {
    const r = selectFefoBatches(batches, 5, TODAY); // 3(早) + 2(晚)
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.usedBatches).toEqual([
      { batchId: "B-EARLY", qty: 3 },
      { batchId: "B-LATE", qty: 2 },
    ]);
  });

  it("可用批次總量不足 → INSUFFICIENT", () => {
    const r = selectFefoBatches(batches, 99, TODAY);
    expect(r).toEqual({ ok: false, code: "INSUFFICIENT" });
  });
});

describe("selectFefoBatches — 已過期批次禁止出庫", () => {
  it("只剩過期批次時 → NO_BATCH", () => {
    const onlyExpired: NormBatch[] = [{ id: "X", remainingQty: 10, expiryDate: "2026-01-01" }];
    expect(selectFefoBatches(onlyExpired, 1, TODAY)).toEqual({ ok: false, code: "NO_BATCH" });
  });

  it("FEFO 不會選到過期批次（B-EXPIRED 不被使用）", () => {
    const r = selectFefoBatches(batches, 8, TODAY); // 3+5=8 全來自未過期
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.usedBatches.map(u => u.batchId)).not.toContain("B-EXPIRED");
  });

  it("人工指定過期批次 → EXPIRED", () => {
    expect(selectFefoBatches(batches, 1, TODAY, "B-EXPIRED")).toEqual({ ok: false, code: "EXPIRED" });
  });
});

describe("selectFefoBatches — 人工指定批次（覆蓋 FEFO）", () => {
  it("指定有效批次只扣該批次", () => {
    const r = selectFefoBatches(batches, 4, TODAY, "B-LATE");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.usedBatches).toEqual([{ batchId: "B-LATE", qty: 4 }]);
  });

  it("指定批次剩餘不足 → BATCH_INSUFFICIENT 並回傳剩餘", () => {
    expect(selectFefoBatches(batches, 10, TODAY, "B-EARLY")).toEqual({ ok: false, code: "BATCH_INSUFFICIENT", batchRemaining: 3 });
  });

  it("指定不存在批次 → NOT_FOUND", () => {
    expect(selectFefoBatches(batches, 1, TODAY, "NOPE")).toEqual({ ok: false, code: "NOT_FOUND" });
  });
});

describe("computeDisposal — 報廢扣量", () => {
  it("正常報廢回傳新剩餘", () => {
    expect(computeDisposal(5, 2)).toEqual({ ok: true, newRemaining: 3 });
  });
  it("報廢量超過剩餘 → INSUFFICIENT", () => {
    expect(computeDisposal(2, 5)).toEqual({ ok: false, code: "INSUFFICIENT" });
  });
});

describe("computeAdjustmentDelta — 調整差額", () => {
  it("增加為正、減少為負", () => {
    expect(computeAdjustmentDelta(3, 8)).toBe(5);
    expect(computeAdjustmentDelta(8, 3)).toBe(-5);
    expect(computeAdjustmentDelta(4, 4)).toBe(0);
  });
});
