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
  approveSchema,
  rejectSchema,
  createConsumableSchema,
  updateConsumableSchema,
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

    const user = storage.getUserByUsername(body.username);
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
    res.json({
      stats,
      expiring,
      lowStock,
      recentTxns: recentTxns.slice(0, 10),
      lowStockConsumables: lowStockConsumables.slice(0, 5),
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 藥品 (Medications)
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/medications", auth, (req, res) => {
    res.json(storage.getMedications(clinicId(req)));
  });

  app.get("/api/medications/:id", auth, (req, res) => {
    const cid = clinicId(req);
    const med = storage.getMedicationById(req.params.id, cid);
    if (!med) return res.status(404).json({ error: "找不到藥品" });
    const batches = storage.getBatches(cid, req.params.id);
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
    const med = storage.updateMedication(req.params.id, clinicId(req), body);
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

    const batch = storage.createBatch({
      clinicId:    cid,
      medId:       body.medId,
      batchNumber: body.batchNumber,
      quantity:    body.quantity,
      remainingQty: body.quantity,
      expiryDate:  body.expiryDate,
      receivedDate: new Date().toISOString().split("T")[0],
      unitCost:    body.unitCost ?? null,
      poNumber:    body.poNumber ?? null,
    });

    storage.updateMedication(body.medId, cid, {
      currentStock: med.currentStock + body.quantity,
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
    if (med.currentStock < body.quantity) {
      return res.status(400).json({ error: `庫存不足（現有 ${med.currentStock}，欲出庫 ${body.quantity}）` });
    }

    // ── FEFO 邏輯 ──────────────────────────────────────────────────────────
    // 取得該藥品所有批次，依到期日升冪（最早到期優先）
    const allBatches = storage.getBatches(cid, body.medId)
      .filter(b => b.remainingQty > 0)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

    if (allBatches.length === 0) {
      return res.status(400).json({ error: "無可用批次" });
    }

    let remaining = body.quantity;
    const usedBatches: { batchId: string; qty: number }[] = [];

    // 若前端指定 batchId（人工覆蓋），只扣該批次
    if (body.batchId) {
      const targetBatch = allBatches.find(b => b.id === body.batchId);
      if (!targetBatch) {
        return res.status(404).json({ error: "指定批次不存在或庫存為 0" });
      }
      if (targetBatch.remainingQty < body.quantity) {
        return res.status(400).json({
          error: `指定批次庫存不足（批次剩 ${targetBatch.remainingQty}，欲出庫 ${body.quantity}）`,
        });
      }
      usedBatches.push({ batchId: targetBatch.id, qty: body.quantity });
      remaining = 0;
    } else {
      // 自動 FEFO：從最早到期批次開始扣
      for (const batch of allBatches) {
        if (remaining <= 0) break;
        const deduct = Math.min(batch.remainingQty, remaining);
        usedBatches.push({ batchId: batch.id, qty: deduct });
        remaining -= deduct;
      }
    }

    if (remaining > 0) {
      return res.status(400).json({ error: "批次庫存不足以完成出庫" });
    }

    // 寫入批次剩餘數量
    for (const { batchId, qty } of usedBatches) {
      const b = allBatches.find(x => x.id === batchId)!;
      storage.updateBatchRemaining(batchId, b.remainingQty - qty);
    }

    // 更新藥品總庫存
    storage.updateMedication(body.medId, cid, {
      currentStock: med.currentStock - body.quantity,
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

    res.json({ success: true, usedBatches });
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

  app.get("/api/medications/pending", auth, (req, res) => {
    res.json(storage.getPendingMedications(clinicId(req)));
  });

  app.get("/api/medications/pending/count", auth, (req, res) => {
    res.json({ count: storage.getPendingCount(clinicId(req)) });
  });

  app.post("/api/medications/:id/approve", auth, (req, res) => {
    const body = parseBody(req, res, approveSchema);
    if (!body) return;
    const med = storage.approveMedication(
      req.params.id,
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
      req.params.id,
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
    const sup = storage.getConsumableById(req.params.id, clinicId(req));
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
    const sup = storage.updateConsumable(req.params.id, clinicId(req), body);
    if (!sup) return res.status(404).json({ error: "找不到該品項" });
    res.json(sup);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 盤點 (Inventory Count)
  // ══════════════════════════════════════════════════════════════════════════

  app.get("/api/inventory-counts", auth, (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    res.json(storage.getInventoryCounts(clinicId(req), limit));
  });

  app.get("/api/inventory-counts/:id", auth, (req, res) => {
    const count = storage.getInventoryCountById(req.params.id, clinicId(req));
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
    const limit    = !isNaN(limitRaw) ? Math.min(limitRaw, 500) : undefined;
    res.json(storage.getExpenses(cid, { month, category, limit }));
  });

  app.get("/api/expenses/summary", auth, (req, res) => {
    const query = parseQuery(req, res, monthParamSchema);
    if (!query) return;
    res.json(storage.getExpenseSummaryByMonth(clinicId(req), query.month));
  });

  app.get("/api/expenses/:id", auth, (req, res) => {
    const item = storage.getExpenseById(req.params.id, clinicId(req));
    if (!item) return res.status(404).json({ error: "找不到該費用紀錄" });
    // 回傳時移除 receipt_photo（大 base64）以節省頻寬；前端需要時另呼叫 /photo
    const { receipt_photo, ...rest } = item as any;
    res.json({ ...rest, hasPhoto: !!receipt_photo });
  });

  /** GET /api/expenses/:id/photo — 單獨取得憑證照片 */
  app.get("/api/expenses/:id/photo", auth, (req, res) => {
    const item = storage.getExpenseById(req.params.id, clinicId(req));
    if (!item) return res.status(404).json({ error: "找不到該費用紀錄" });
    if (!(item as any).receipt_photo) {
      return res.status(404).json({ error: "此紀錄無憑證照片" });
    }
    res.json({ receiptPhoto: (item as any).receipt_photo });
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
    const item = storage.updateExpense(req.params.id, clinicId(req), body as any);
    if (!item) return res.status(404).json({ error: "找不到該費用紀錄" });
    res.json(item);
  });

  app.delete("/api/expenses/:id", auth, (req, res) => {
    const ok = storage.deleteExpense(req.params.id, clinicId(req));
    if (!ok) return res.status(404).json({ error: "找不到該費用紀錄" });
    res.json({ success: true });
  });

  return httpServer;
}
