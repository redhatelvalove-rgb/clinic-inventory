/**
 * server/routes.ts
 *
 * 安全修正版本（2026-06-26）：
 * ✅ 1. 所有 POST/PATCH 均使用 Zod schema 驗證（parseBody）
 * ✅ 2. Demo 模式使用 demoAuth middleware，Auth 架構已就緒可一鍵切換
 * ✅ 3. 回傳 JSON 不含 password_hash 等敏感欄位
 * ✅ 4. 所有 DB 操作透過 Drizzle ORM 或 better-sqlite3 prepare（無字串拼接）
 * ✅ 5. FEFO 出庫邏輯正確（先取最早到期批次）
 * ✅ 6. JWT login / refresh token 路由就緒
 */

import type { Express } from "express";
import type { Server } from "http";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { selectFefoBatches, computeDisposal, computeAdjustmentDelta } from "./inventory-logic";
import { taipeiToday } from "@shared/date-utils";
import {
  demoAuth,
  requireAuth,
  requireSuperAdmin,
  getClinicId,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "./auth";
import {
  parseBody,
  parseQuery,
  loginSchema,
  refreshSchema,
  createMedicationSchema,
  updateMedicationSchema,
  stockInSchema,
  stockOutSchema,
  disposalSchema,
  adjustmentSchema,
  approveSchema,
  rejectSchema,
  createConsumableSchema,
  updateConsumableSchema,
  restockConsumableSchema,
  fridgeTempSchema,
  createInventoryCountSchema,
  createExpenseSchema,
  updateExpenseSchema,
  monthParamSchema,
} from "./schemas";

// ── Demo 模式設定 ─────────────────────────────────────────────────────────────
// TODO: VPS 上線後，將 USE_DEMO 改為 false，並確保 JWT_SECRET 已設定
const USE_DEMO = true;

// Demo 模式固定值（USE_DEMO=true 時有效）
const DEMO_CLINIC_ID = "C001";
const DEMO_PERFORMED_BY = "骨立診所（Demo）";

/** 根據模式選擇 auth middleware */
const auth = USE_DEMO ? demoAuth : requireAuth;

/** 取得當次請求的 clinicId */
function clinicId(req: import("express").Request): string {
  if (USE_DEMO) return DEMO_CLINIC_ID;
  return getClinicId(req);
}

/** 取得當次操作人員名稱 */
function performedBy(req: import("express").Request, fallback?: string): string {
  if (USE_DEMO) return fallback ?? DEMO_PERFORMED_BY;
  const user = (req as any).user;
  return user?.displayName ?? fallback ?? "系統";
}

export async function registerRoutes(httpServer: Server, app: Express) {

  // ══════════════════════════════════════════════════════════════════════════
  // 認證路由（不需 auth middleware）
  // ══════════════════════════════════════════════════════════════════════════

  /** POST /api/auth/login → 取得 access + refresh token */
  app.post("/api/auth/login", (req, res) => {
    const body = parseBody(req, res, loginSchema);
    if (!body) return;

    // raw SQL 回傳 snake_case、型別宣告是 camelCase，故 as any 後雙讀（?? 後備）
    const user = storage.getUserByUsername(body.username) as any;
    if (!user) {
      return res.status(401).json({ error: "帳號或密碼錯誤" });
    }
    const valid = bcrypt.compareSync(body.password, user.passwordHash ?? user.password_hash ?? "");
    if (!valid) {
      return res.status(401).json({ error: "帳號或密碼錯誤" });
    }
    if (!user.isActive && !user.is_active) {
      return res.status(403).json({ error: "帳號已停用" });
    }

    const basePayload = {
      userId:      user.id,
      username:    user.username,
      role:        user.role as "superadmin" | "staff",
      clinicId:    user.clinicId ?? user.clinic_id ?? null,
      displayName: user.displayName ?? user.display_name ?? user.username,
    };

    res.json({
      accessToken:  signAccessToken(basePayload),
      refreshToken: signRefreshToken(basePayload),
      user: {
        id:          user.id,
        username:    user.username,
        role:        user.role,
        clinicId:    user.clinicId ?? user.clinic_id,
        displayName: user.displayName ?? user.display_name,
      },
      // ⚠️ password_hash 絕對不回傳
    });
  });

  /** POST /api/auth/refresh → 用 refresh token 換新 access token */
  app.post("/api/auth/refresh", (req, res) => {
    const body = parseBody(req, res, refreshSchema);
    if (!body) return;

    const payload = verifyRefreshToken(body.refreshToken);
    if (!payload) {
      return res.status(401).json({ error: "Refresh token 無效或已過期，請重新登入" });
    }

    const basePayload = {
      userId:      payload.userId,
      username:    payload.username,
      role:        payload.role,
      clinicId:    payload.clinicId,
      displayName: payload.displayName,
    };

    res.json({
      accessToken:  signAccessToken(basePayload),
      // 重新發 refresh token（rolling refresh）
      refreshToken: signRefreshToken(basePayload),
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Dashboard
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/dashboard", auth, (req, res) => {
    const cid = clinicId(req);
    const stats              = storage.getDashboardStats(cid);
    const expiring           = storage.getExpiringBatches(cid, 30);
    const lowStock           = storage.getLowStockMedications(cid);
    const recentTxns         = storage.getTransactions(cid);
    const lowStockConsumables = storage.getLowStockConsumables(cid);
    const fridgeLogs = storage.getFridgeTempsByDate(cid, taipeiToday());
    res.json({
      stats,
      expiring,
      lowStock,
      recentTxns: recentTxns.slice(0, 10),
      lowStockConsumables: lowStockConsumables.slice(0, 5),
      fridgeToday: {
        am: fridgeLogs.find((l: any) => l.slot === "AM") ?? null,
        pm: fridgeLogs.find((l: any) => l.slot === "PM") ?? null,
      },
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 藥品 (Medications)
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/medications", auth, (req, res) => {
    res.json(storage.getMedications(clinicId(req)));
  });

  // ⚠️ 靜態路徑必須在 /:id 之前註冊，否則 "pending" 會被當成藥品 id 而 404
  app.get("/api/medications/pending", auth, (req, res) => {
    res.json(storage.getPendingMedications(clinicId(req)));
  });

  app.get("/api/medications/pending/count", auth, (req, res) => {
    res.json({ count: storage.getPendingCount(clinicId(req)) });
  });

  app.get("/api/medications/:id", auth, (req, res) => {
    const cid = clinicId(req);
    const med = storage.getMedicationById(String(req.params.id), cid);
    if (!med) return res.status(404).json({ error: "找不到藥品" });
    const batches = storage.getBatches(cid, String(req.params.id));
    res.json({ ...med, batches });
  });

  app.post("/api/medications", auth, (req, res) => {
    const body = parseBody(req, res, createMedicationSchema);
    if (!body) return;
    const med = storage.createMedication({ ...body, clinicId: clinicId(req) });
    res.json(med);
  });

  app.patch("/api/medications/:id", auth, (req, res) => {
    const body = parseBody(req, res, updateMedicationSchema);
    if (!body) return;
    const med = storage.updateMedication(String(req.params.id), clinicId(req), body);
    if (!med) return res.status(404).json({ error: "找不到藥品" });
    res.json(med);
  });

  // ── 批次 ────────────────────────────────────────────────────────────────

  app.get("/api/batches/expiring", auth, (req, res) => {
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);
    res.json(storage.getExpiringBatches(clinicId(req), days));
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 入庫 / 出庫
  // ══════════════════════════════════════════════════════════════════════════

  /** POST /api/stock/in — 新增批次入庫 */
  app.post("/api/stock/in", auth, (req, res) => {
    const body = parseBody(req, res, stockInSchema);
    if (!body) return;

    const cid = clinicId(req);
    const med = storage.getMedicationById(body.medId, cid);
    if (!med) return res.status(404).json({ error: "找不到藥品" });
    // raw SQL 回傳 snake_case，不可用 med.currentStock（會是 undefined → NaN）
    const currentStock = (med as any).current_stock as number;

    const batch = storage.runInTransaction(() => {
      const batch = storage.createBatch({
        clinicId:    cid,
        medId:       body.medId,
        batchNumber: body.batchNumber,
        quantity:    body.quantity,
        remainingQty: body.quantity,
        expiryDate:  body.expiryDate,
        receivedDate: taipeiToday(),
        unitCost:    body.unitCost ?? null,
        poNumber:    body.poNumber ?? null,
      });

      storage.updateMedication(body.medId, cid, {
        currentStock: currentStock + body.quantity,
      });

      storage.createTransaction({
        clinicId:    cid,
        medId:       body.medId,
        batchId:     batch.id,
        txnType:     "IN",
        quantity:    body.quantity,
        reason:      "入庫",
        performedBy: body.performedBy ?? performedBy(req, "入庫"),
        txnTime:     new Date().toISOString(),
      });

      return batch;
    });

    res.json({ success: true, batch });
  });

  /**
   * POST /api/stock/out — FEFO 出庫
   *
   * FEFO (First Expired, First Out)：
   * 優先扣除最近到期的批次，確保不浪費藥品。
   * 若前端指定 batchId 則直接扣該批次（人工覆蓋，需確認）。
   */
  app.post("/api/stock/out", auth, (req, res) => {
    const body = parseBody(req, res, stockOutSchema);
    if (!body) return;

    const cid = clinicId(req);
    const med = storage.getMedicationById(body.medId, cid);
    if (!med) return res.status(404).json({ error: "找不到藥品" });
    // raw SQL 回傳 snake_case，不可用 med.currentStock（會是 undefined，檢查失效）
    const currentStock = (med as any).current_stock as number;
    if (currentStock < body.quantity) {
      return res.status(400).json({ error: `庫存不足（現有 ${currentStock}，欲出庫 ${body.quantity}）` });
    }

    // ── FEFO 邏輯（純函式，已排除過期批次）──────────────────────────────────
    const today = taipeiToday(); // 台北日，避免 UTC 造成凌晨 0–8 點過期批次仍可出庫
    // getBatches 回傳 snake_case，正規化成 NormBatch 再交給純函式
    const rawBatches = storage.getBatches(cid, body.medId) as any[];
    const normBatches = rawBatches.map(b => ({ id: b.id, remainingQty: b.remaining_qty, expiryDate: b.expiry_date }));

    const result = selectFefoBatches(normBatches, body.quantity, today, body.batchId);
    if (!result.ok) {
      const msg: Record<string, string> = {
        NO_BATCH: "無可用批次（可能全數已過期，請改用報廢）",
        NOT_FOUND: "指定批次不存在或庫存為 0",
        EXPIRED: "指定批次已過期，不可出庫（請改用報廢）",
        BATCH_INSUFFICIENT: `指定批次庫存不足（批次剩 ${result.batchRemaining}，欲出庫 ${body.quantity}）`,
        INSUFFICIENT: "批次庫存不足以完成出庫",
      };
      const status = result.code === "NOT_FOUND" ? 404 : 400;
      return res.status(status).json({ error: msg[result.code] });
    }
    const usedBatches = result.usedBatches;

    storage.runInTransaction(() => {
      // 寫入批次剩餘數量
      for (const { batchId, qty } of usedBatches) {
        const b = normBatches.find(x => x.id === batchId)!;
        storage.updateBatchRemaining(batchId, b.remainingQty - qty);
      }

      // 更新藥品總庫存
      storage.updateMedication(body.medId, cid, {
        currentStock: currentStock - body.quantity,
      });

      // 記錄交易（每個批次一筆）
      for (const { batchId, qty } of usedBatches) {
        storage.createTransaction({
          clinicId:    cid,
          medId:       body.medId,
          batchId,
          txnType:     "OUT",
          quantity:    -qty,
          reason:      body.reason ?? "出庫",
          performedBy: body.performedBy ?? performedBy(req, "出庫"),
          txnTime:     new Date().toISOString(),
        });
      }
    });

    res.json({ success: true, usedBatches });
  });

  /**
   * POST /api/inventory/disposals — 報廢
   * 將指定批次的數量報廢（過期、破損、汙染等），扣批次剩餘與藥品總庫存，
   * 並寫一筆 DISPOSAL 交易（留軌跡）。允許對已過期批次報廢。
   */
  app.post("/api/inventory/disposals", auth, (req, res) => {
    const body = parseBody(req, res, disposalSchema);
    if (!body) return;

    const cid = clinicId(req);
    const med = storage.getMedicationById(body.medId, cid);
    if (!med) return res.status(404).json({ error: "找不到藥品" });

    const batch = storage.getBatches(cid, body.medId).find(b => b.id === body.batchId) as any;
    if (!batch) return res.status(404).json({ error: "找不到批次" });
    const disp = computeDisposal(batch.remaining_qty, body.quantity);
    if (!disp.ok) {
      return res.status(400).json({ error: `批次剩餘不足（剩 ${batch.remaining_qty}，欲報廢 ${body.quantity}）` });
    }

    // raw SQL 回傳 snake_case，不可用 med.currentStock
    const currentStock = (med as any).current_stock as number;
    storage.runInTransaction(() => {
      storage.updateBatchRemaining(batch.id, disp.newRemaining);
      storage.updateMedication(body.medId, cid, {
        currentStock: currentStock - body.quantity,
      });
      storage.createTransaction({
        clinicId:    cid,
        medId:       body.medId,
        batchId:     batch.id,
        txnType:     "DISCARD",
        quantity:    -body.quantity,
        reason:      body.reason,
        performedBy: body.performedBy ?? performedBy(req, "報廢"),
        txnTime:     new Date().toISOString(),
      });
    });

    res.json({ success: true });
  });

  /**
   * POST /api/inventory/adjustments — 手動調整
   * 將指定批次的剩餘量直接設為新值（盤點修正），差額同步藥品總庫存，
   * 並寫一筆 ADJUST 交易（留軌跡）。
   */
  app.post("/api/inventory/adjustments", auth, (req, res) => {
    const body = parseBody(req, res, adjustmentSchema);
    if (!body) return;

    const cid = clinicId(req);
    const med = storage.getMedicationById(body.medId, cid);
    if (!med) return res.status(404).json({ error: "找不到藥品" });

    const batch = storage.getBatches(cid, body.medId).find(b => b.id === body.batchId) as any;
    if (!batch) return res.status(404).json({ error: "找不到批次" });

    const delta = computeAdjustmentDelta(batch.remaining_qty, body.newRemainingQty); // 正=增加，負=減少
    if (delta === 0) return res.status(400).json({ error: "數量未變動" });

    // raw SQL 回傳 snake_case，不可用 med.currentStock
    const currentStock = (med as any).current_stock as number;
    storage.runInTransaction(() => {
      storage.updateBatchRemaining(batch.id, body.newRemainingQty);
      storage.updateMedication(body.medId, cid, {
        currentStock: currentStock + delta,
      });
      storage.createTransaction({
        clinicId:    cid,
        medId:       body.medId,
        batchId:     batch.id,
        txnType:     "ADJUST",
        quantity:    delta,
        reason:      body.reason,
        performedBy: body.performedBy ?? performedBy(req, "調整"),
        txnTime:     new Date().toISOString(),
      });
    });

    res.json({ success: true });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 交易紀錄
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/transactions", auth, (req, res) => {
    const medId = typeof req.query.medId === "string" ? req.query.medId : undefined;
    res.json(storage.getTransactions(clinicId(req), medId));
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 廠商
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/vendors", auth, (req, res) => {
    res.json(storage.getVendors(clinicId(req)));
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 藥品新增審核流程
  // ══════════════════════════════════════════════════════════════════════════

  app.post("/api/medications/submit", auth, (req, res) => {
    const body = parseBody(req, res, createMedicationSchema);
    if (!body) return;

    const med = storage.submitMedication({
      clinicId:     clinicId(req),
      name:         body.name,
      genericName:  body.genericName ?? null,
      category:     body.category,
      unit:         body.unit,
      safetyStock:  Number(body.safetyStock),
      reorderPoint: body.reorderPoint ?? null,
      reorderQty:   body.reorderQty ?? null,
      storageCondition: body.storageCondition ?? null,
      vendorId:     body.vendorId ?? null,
      barcode:      body.barcode ?? null,
      notes:        body.notes ?? null,
      isActive:     false,
      submittedBy:  body.submittedBy ?? performedBy(req, "未填寫"),
    });
    res.json(med);
  });

  app.post("/api/medications/:id/approve", auth, (req, res) => {
    const body = parseBody(req, res, approveSchema);
    if (!body) return;
    const med = storage.approveMedication(
      String(req.params.id),
      clinicId(req),
      body.reviewedBy ?? performedBy(req, "管理者")
    );
    if (!med) return res.status(404).json({ error: "找不到或已處理" });
    res.json(med);
  });

  app.post("/api/medications/:id/reject", auth, (req, res) => {
    const body = parseBody(req, res, rejectSchema);
    if (!body) return;
    const med = storage.rejectMedication(
      String(req.params.id),
      clinicId(req),
      body.reviewedBy ?? performedBy(req, "管理者"),
      body.reason ?? "不符合規格"
    );
    if (!med) return res.status(404).json({ error: "找不到或已處理" });
    res.json(med);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 衛材 (Consumables) — Phase 2
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/consumables/categories", auth, (req, res) => {
    res.json(storage.getConsumableCategories(clinicId(req)));
  });

  app.get("/api/consumables/low-stock", auth, (req, res) => {
    res.json(storage.getLowStockConsumables(clinicId(req)));
  });

  app.get("/api/consumables", auth, (req, res) => {
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    res.json(storage.getConsumables(clinicId(req), category));
  });

  app.get("/api/consumables/:id", auth, (req, res) => {
    const sup = storage.getConsumableById(String(req.params.id), clinicId(req));
    if (!sup) return res.status(404).json({ error: "找不到該品項" });
    res.json(sup);
  });

  app.post("/api/consumables", auth, (req, res) => {
    const body = parseBody(req, res, createConsumableSchema);
    if (!body) return;
    const sup = storage.createConsumable({
      clinicId:    clinicId(req),
      name:        body.name,
      category:    body.category,
      unit:        body.unit,
      currentStock: 0,
      safetyStock: body.safetyStock ?? 0,
      isDurable:   body.isDurable ?? false,
      vendorId:    body.vendorId ?? null,
      notes:       body.notes ?? null,
      isActive:    true,
    });
    res.json(sup);
  });

  app.patch("/api/consumables/:id", auth, (req, res) => {
    const body = parseBody(req, res, updateConsumableSchema);
    if (!body) return;
    const sup = storage.updateConsumable(String(req.params.id), clinicId(req), body);
    if (!sup) return res.status(404).json({ error: "找不到該品項" });
    res.json(sup);
  });

  /**
   * POST /api/consumables/:id/restock — 衛材進貨
   * 加庫存＋以盤點紀錄留軌跡（前值→新值、經手人、備註「進貨」）。
   * 定期盤點制下，進貨必須記錄，否則月盤點算出的消耗量會失真。
   */
  app.post("/api/consumables/:id/restock", auth, (req, res) => {
    const body = parseBody(req, res, restockConsumableSchema);
    if (!body) return;

    const cid = clinicId(req);
    const sup = storage.getConsumableById(String(req.params.id), cid);
    if (!sup) return res.status(404).json({ error: "找不到該品項" });

    const prev = Number((sup as any).current_stock) || 0; // raw SQL 回傳 snake_case
    const newStock = prev + body.quantity;

    // createInventoryCount 內含 transaction：寫軌跡＋更新庫存一體完成
    storage.createInventoryCount({
      clinicId:  cid,
      countedBy: body.performedBy,
      notes:     body.notes ? `進貨：${body.notes}` : "進貨",
      items:     [{ consumableId: String(req.params.id), countedStock: newStock }],
    } as any);

    res.json({ success: true, previousStock: prev, newStock });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 盤點 (Inventory Count)
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/inventory-counts", auth, (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    res.json(storage.getInventoryCounts(clinicId(req), limit));
  });

  app.get("/api/inventory-counts/:id", auth, (req, res) => {
    const count = storage.getInventoryCountById(String(req.params.id), clinicId(req));
    if (!count) return res.status(404).json({ error: "找不到盤點紀錄" });
    res.json(count);
  });

  app.post("/api/inventory-counts", auth, (req, res) => {
    const body = parseBody(req, res, createInventoryCountSchema);
    if (!body) return;
    const count = storage.createInventoryCount({
      clinicId:  clinicId(req),
      countedBy: body.countedBy,
      notes:     body.notes ?? undefined,
      items:     body.items,
    });
    res.json(count);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 費用記錄 (Expenses) — Phase 2.5
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/expenses", auth, (req, res) => {
    const cid = clinicId(req);
    const month    = typeof req.query.month    === "string" ? req.query.month    : undefined;
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const limitRaw = parseInt(req.query.limit as string);
    const limit    = !isNaN(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : undefined; // 夾在 1–500，負數會變 SQLite 無上限
    res.json(storage.getExpenses(cid, { month, category, limit }));
  });

  app.get("/api/expenses/summary", auth, (req, res) => {
    const query = parseQuery(req, res, monthParamSchema);
    if (!query) return;
    res.json(storage.getExpenseSummaryByMonth(clinicId(req), query.month));
  });

  app.get("/api/expenses/:id", auth, (req, res) => {
    const item = storage.getExpenseById(String(req.params.id), clinicId(req));
    if (!item) return res.status(404).json({ error: "找不到該費用紀錄" });
    // 回傳時移除 receipt_photo（大 base64）以節省頻寬；前端需要時另呼叫 /photo
    const { receipt_photo, ...rest } = item as any;
    res.json({ ...rest, hasPhoto: !!receipt_photo });
  });

  /** GET /api/expenses/:id/photo — 單獨取得憑證照片 */
  app.get("/api/expenses/:id/photo", auth, (req, res) => {
    const item = storage.getExpenseById(String(req.params.id), clinicId(req));
    if (!item) return res.status(404).json({ error: "找不到該費用紀錄" });
    if (!(item as any).receipt_photo) {
      return res.status(404).json({ error: "此紀錄無憑證照片" });
    }
    res.json({ receiptPhoto: (item as any).receipt_photo });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 冰箱溫度（冷藏藥品保存紀錄，2–8°C）
  // ══════════════════════════════════════════════════════════════════════════

  /** POST /api/fridge-temps — 記錄一次量測（同日同時段重送＝覆蓋修正） */
  app.post("/api/fridge-temps", auth, (req, res) => {
    const body = parseBody(req, res, fridgeTempSchema);
    if (!body) return;

    const abnormal = body.temperature < 2 || body.temperature > 8;
    if (abnormal && !body.actionTaken?.trim()) {
      return res.status(400).json({ error: `溫度 ${body.temperature}°C 超出 2–8°C 標準，請填寫異常處理措施（通報誰、藥品移置何處）` });
    }

    const entry = storage.upsertFridgeTemp({
      clinicId:    clinicId(req),
      logDate:     taipeiToday(),
      slot:        body.slot,
      temperature: body.temperature,
      abnormal,
      actionTaken: abnormal ? body.actionTaken!.trim() : null,
      recordedBy:  body.performedBy,
    });
    res.json({ success: true, entry, abnormal });
  });

  /** GET /api/fridge-temps?month=YYYY-MM — 整月紀錄（報表用） */
  app.get("/api/fridge-temps", auth, (req, res) => {
    const query = parseQuery(req, res, monthParamSchema);
    if (!query) return;
    res.json(storage.getFridgeTempsByMonth(clinicId(req), query.month));
  });

  /** GET /api/fridge-temps/today — 今日兩時段狀態 */
  app.get("/api/fridge-temps/today", auth, (req, res) => {
    const logs = storage.getFridgeTempsByDate(clinicId(req), taipeiToday());
    res.json({
      date: taipeiToday(),
      am: logs.find((l: any) => l.slot === "AM") ?? null,
      pm: logs.find((l: any) => l.slot === "PM") ?? null,
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 報表（衛生局檢查／內部管理，皆可列印）
  // ══════════════════════════════════════════════════════════════════════════

  /** GET /api/reports/category?month=&category= — 分類進出庫月報（預設玻尿酸＝關節注射） */
  app.get("/api/reports/category", auth, (req, res) => {
    const query = parseQuery(req, res, monthParamSchema);
    if (!query) return;
    const category = typeof req.query.category === "string" && req.query.category ? req.query.category : "關節注射";
    res.json(storage.getCategoryMonthlyReport(clinicId(req), query.month, category));
  });

  /** GET /api/reports/consumables?month= — 衛材月進貨/消耗 */
  app.get("/api/reports/consumables", auth, (req, res) => {
    const query = parseQuery(req, res, monthParamSchema);
    if (!query) return;
    res.json(storage.getConsumableMonthlyReport(clinicId(req), query.month));
  });

  app.post("/api/expenses", auth, (req, res) => {
    const body = parseBody(req, res, createExpenseSchema);
    if (!body) return;
    const expense = storage.createExpense({
      clinicId:     clinicId(req),
      expenseDate:  body.expenseDate,
      category:     body.category,
      subcategory:  body.subcategory ?? null,
      amount:       body.amount,
      description:  body.description ?? null,
      vendorName:   body.vendorName ?? null,
      receiptPhoto: body.receiptPhoto ?? null,
      recordedBy:   body.recordedBy,
    });
    res.json(expense);
  });

  app.patch("/api/expenses/:id", auth, (req, res) => {
    const body = parseBody(req, res, updateExpenseSchema);
    if (!body) return;
    const item = storage.updateExpense(String(req.params.id), clinicId(req), body as any);
    if (!item) return res.status(404).json({ error: "找不到該費用紀錄" });
    res.json(item);
  });

  app.delete("/api/expenses/:id", auth, (req, res) => {
    const ok = storage.deleteExpense(String(req.params.id), clinicId(req));
    if (!ok) return res.status(404).json({ error: "找不到該費用紀錄" });
    res.json({ success: true });
  });

  return httpServer;
}
