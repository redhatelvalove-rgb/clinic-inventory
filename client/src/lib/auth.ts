// JWT 存在 React 狀態中（不用 localStorage，符合沙盒規定）
// 透過 React Context 傳遞到整個 App

export interface AuthUser {
  userId: string;
  username: string;
  role: "superadmin" | "staff";
  clinicId: string | null;
  displayName: string;
}

// API 登入
export async function loginApi(username: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "登入失敗");
  }
  return res.json();
}
