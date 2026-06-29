/**
 * 純函式庫存邏輯（無 DB、無 I/O，方便單元測試）。
 *
 * 路由層負責把 DB 的 snake_case 批次列正規化成下方的 NormBatch 後再呼叫。
 */

export interface NormBatch {
  id: string;
  remainingQty: number;
  expiryDate: string; // YYYY-MM-DD
}

export type FefoResult =
  | { ok: true; usedBatches: { batchId: string; qty: number }[] }
  | { ok: false; code: "NO_BATCH" | "NOT_FOUND" | "EXPIRED" | "BATCH_INSUFFICIENT" | "INSUFFICIENT"; batchRemaining?: number };

/**
 * 依 FEFO（最早到期先出）選批次出庫。
 * - 排除已過期（expiryDate < today）與剩餘為 0 的批次。
 * - 若指定 batchId（人工覆蓋）只扣該批次；指定到已過期批次會被擋。
 */
export function selectFefoBatches(
  allBatches: NormBatch[],
  quantity: number,
  today: string,
  batchId?: string | null,
): FefoResult {
  const usable = allBatches
    .filter(b => b.remainingQty > 0 && b.expiryDate >= today)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  if (usable.length === 0) return { ok: false, code: "NO_BATCH" };

  if (batchId) {
    const target = usable.find(b => b.id === batchId);
    if (!target) {
      const existsExpired = allBatches.some(b => b.id === batchId && b.expiryDate < today);
      return { ok: false, code: existsExpired ? "EXPIRED" : "NOT_FOUND" };
    }
    if (target.remainingQty < quantity) {
      return { ok: false, code: "BATCH_INSUFFICIENT", batchRemaining: target.remainingQty };
    }
    return { ok: true, usedBatches: [{ batchId: target.id, qty: quantity }] };
  }

  let remaining = quantity;
  const usedBatches: { batchId: string; qty: number }[] = [];
  for (const b of usable) {
    if (remaining <= 0) break;
    const deduct = Math.min(b.remainingQty, remaining);
    usedBatches.push({ batchId: b.id, qty: deduct });
    remaining -= deduct;
  }
  if (remaining > 0) return { ok: false, code: "INSUFFICIENT" };
  return { ok: true, usedBatches };
}

/** 報廢驗證：回傳新的批次剩餘量，或錯誤。 */
export function computeDisposal(batchRemaining: number, quantity: number):
  | { ok: true; newRemaining: number }
  | { ok: false; code: "INSUFFICIENT" } {
  if (quantity > batchRemaining) return { ok: false, code: "INSUFFICIENT" };
  return { ok: true, newRemaining: batchRemaining - quantity };
}

/** 手動調整：回傳差額（正=增加，負=減少），用於同步藥品總庫存。 */
export function computeAdjustmentDelta(batchRemaining: number, newRemaining: number): number {
  return newRemaining - batchRemaining;
}
