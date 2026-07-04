// 行政區登入：access token 存 sessionStorage（分頁關閉即登出，適合共用裝置），
// 並同步到 queryClient 的記憶體 token 供 API 請求帶 Authorization。
import { setAuthToken } from "@/lib/queryClient";

export interface AuthUser {
  userId: string;
  username: string;
  role: "superadmin" | "manager" | "staff";
  clinicId: string | null;
  displayName: string;
}

const TOKEN_KEY = "cims_admin_token";
const USER_KEY = "cims_admin_user";

/** App 啟動時呼叫：把 sessionStorage 的 token 還原到記憶體（重新整理不掉登入） */
export function initAuthFromSession(): AuthUser | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const userJson = sessionStorage.getItem(USER_KEY);
  if (!token || !userJson) return null;
  setAuthToken(token);
  try { return JSON.parse(userJson) as AuthUser; } catch { return null; }
}

export function getStoredUser(): AuthUser | null {
  const userJson = sessionStorage.getItem(USER_KEY);
  if (!userJson) return null;
  try { return JSON.parse(userJson) as AuthUser; } catch { return null; }
}

/** 登入：後端回 { accessToken, refreshToken, user } */
export async function loginApi(username: string, password: string): Promise<AuthUser> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "登入失敗");
  }
  const data = await res.json();
  setAuthToken(data.accessToken);
  sessionStorage.setItem(TOKEN_KEY, data.accessToken);
  sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user as AuthUser;
}

export function logout() {
  setAuthToken(null);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}
