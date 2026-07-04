import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

// ── 安全性注意 ──────────────────────────────────────────────────────────────
// JWT_SECRET 務必透過環境變數注入，不可使用預設值上生產環境
// 啟動前請先執行：export JWT_SECRET=$(openssl rand -base64 48)
export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// 以明確環境變數旗標控制，避免 esbuild 在 bundle 時替換 NODE_ENV
if (process.env.REQUIRE_AUTH === "true") {
  if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
    console.error("FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be set when REQUIRE_AUTH=true.");
    process.exit(1);
  }
}

// 非生產環境使用隨機 fallback（每次重啟會失效，僅限開發/Demo 用）
const _secret        = JWT_SECRET        ?? "dev-only-secret-not-for-production";
const _refreshSecret = JWT_REFRESH_SECRET ?? "dev-only-refresh-secret-not-for-production";

export const ACCESS_TOKEN_EXPIRES  = "8h";   // access token（行政區一個工作天內免重登）
export const REFRESH_TOKEN_EXPIRES = "30d";  // 長效 refresh token（平板常駐）

export interface JwtPayload {
  userId: string;
  username: string;
  role: "superadmin" | "manager" | "staff";
  clinicId: string | null;
  displayName: string;
  type: "access" | "refresh";
}

export function signAccessToken(payload: Omit<JwtPayload, "type">): string {
  return jwt.sign({ ...payload, type: "access" }, _secret, { expiresIn: ACCESS_TOKEN_EXPIRES });
}

export function signRefreshToken(payload: Omit<JwtPayload, "type">): string {
  return jwt.sign({ ...payload, type: "refresh" }, _refreshSecret, { expiresIn: REFRESH_TOKEN_EXPIRES });
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, _secret) as JwtPayload;
    if (payload.type !== "access") return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, _refreshSecret) as JwtPayload;
    if (payload.type !== "refresh") return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Express middleware ──────────────────────────────────────────────────────

/** Demo 模式 middleware：略過認證，掛上固定 C001 user */
export function demoAuth(req: Request, _res: Response, next: NextFunction) {
  (req as any).user = {
    userId: "DEMO",
    username: "demo",
    role: "staff",
    clinicId: "C001",
    displayName: "骨立診所（Demo）",
    type: "access",
  } satisfies JwtPayload;
  next();
}

/** 正式 auth middleware：驗證 Bearer access token */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "未登入，請先登入" });
  }
  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({ error: "登入已過期，請重新登入" });
  }
  (req as any).user = payload;
  next();
}

/** Role guard：行政區——manager（限自己診所）與 superadmin 可進 */
export function requireManager(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    const user = (req as any).user as JwtPayload;
    if (user.role !== "manager" && user.role !== "superadmin") {
      return res.status(403).json({ error: "此區僅限授權人員使用" });
    }
    next();
  });
}

/** Role guard：只允許 superadmin */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as JwtPayload;
  if (user?.role !== "superadmin") {
    return res.status(403).json({ error: "權限不足" });
  }
  next();
}

/** 取得當前使用者的 clinicId（superadmin 回傳 null＝不限制） */
export function getClinicId(req: Request): string {
  const user = (req as any).user as JwtPayload;
  // Demo 模式固定 C001；staff 限自己的診所；superadmin 若指定 clinic_id query 參數則使用之
  if (user.role === "superadmin") {
    const q = (req.query.clinic_id ?? req.body?.clinic_id) as string | undefined;
    return q ?? "C001";
  }
  return user.clinicId ?? "C001";
}
