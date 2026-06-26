import { useState } from "react";
import { loginApi } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, User } from "lucide-react";

interface Props {
  onLogin: (token: string, user: AuthUser) => void;
}

export default function Login({ onLogin }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { token, user } = await loginApi(username, password);
      onLogin(token, user);
    } catch (err: any) {
      toast({ title: "登入失敗", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <svg viewBox="0 0 32 32" width="36" height="36" fill="none">
              <path d="M16 8v16M8 16h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="16" cy="16" r="5" stroke="white" strokeWidth="1.5" fill="none"/>
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">骨立診所</h1>
            <p className="text-sm text-muted-foreground">庫存管理系統</p>
          </div>
        </div>

        {/* 登入表單 */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm">帳號</Label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  data-testid="input-username"
                  className="pl-9"
                  placeholder="輸入帳號"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm">密碼</Label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  data-testid="input-password"
                  type="password"
                  className="pl-9"
                  placeholder="輸入密碼"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              data-testid="button-login"
            >
              {loading ? <><Loader2 size={15} className="mr-2 animate-spin" />登入中...</> : "登入"}
            </Button>
          </form>
        </div>

        {/* 版本資訊 */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          CIMS v1.1 · 骨立診所醫療系統
        </p>
      </div>
    </div>
  );
}
