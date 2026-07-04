import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  FolderLock, LogOut, Plus, FileText, Search, Paperclip,
  Download, Archive, X, NotebookPen, ShieldAlert
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { loginApi, logout, getStoredUser, type AuthUser } from "@/lib/auth";
import { taipeiToday, formatTaipeiDateTime } from "@shared/date-utils";

const DOC_TYPES = ["公文收文", "公文發文", "會議記錄", "合約", "其他"] as const;
const TYPE_BADGE: Record<string, string> = {
  "公文收文": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "公文發文": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  "會議記錄": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "合約":     "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "其他":     "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

/* ── 登入閘門 ── */
function LoginGate({ onLogin }: { onLogin: (u: AuthUser) => void }) {
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await loginApi(username.trim(), password);
      onLogin(user);
    } catch (err: any) {
      toast({ title: "登入失敗", description: err?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto pt-16">
      <Card>
        <CardContent className="pt-6 pb-6 space-y-4">
          <div className="text-center">
            <FolderLock className="w-10 h-10 text-primary mx-auto mb-2" />
            <h1 className="text-lg font-semibold">行政文件區</h1>
            <p className="text-xs text-muted-foreground mt-1">此區僅限授權人員，請以個人帳號登入</p>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <Input placeholder="帳號" value={username} onChange={e => setUsername(e.target.value)}
              autoComplete="username" className="h-11" data-testid="login-username" />
            <Input placeholder="密碼" type="password" value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="current-password" className="h-11" data-testid="login-password" />
            <Button type="submit" className="w-full h-11" disabled={!username || !password || busy} data-testid="login-submit">
              {busy ? "登入中..." : "登入"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center">關閉分頁即自動登出</p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── 新增/編輯視窗 ── */
function DocModal({ mode, onClose }: { mode: "doc" | "minutes"; onClose: () => void }) {
  const { toast } = useToast();
  const isMinutes = mode === "minutes";
  const [docType, setDocType] = useState(isMinutes ? "會議記錄" : "公文收文");
  const [title, setTitle] = useState(isMinutes ? `${taipeiToday().slice(0, 7)} 診所會議記錄` : "");
  const [docNumber, setDocNumber] = useState("");
  const [docDate, setDocDate] = useState(taipeiToday());
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) { toast({ title: "請輸入標題", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const res = await apiRequest("POST", "/api/docs", {
        docType, title: title.trim(),
        docNumber: docNumber.trim() || null,
        docDate: docDate || null,
        tags: tags.trim() || null,
        content: content.trim() || null,
      });
      const doc = await res.json();
      if (file) {
        await fetch(`/api/docs/${doc.id}/file`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${sessionStorage.getItem("cims_admin_token")}`,
            "Content-Type": file.type || "application/octet-stream",
            "x-file-name": encodeURIComponent(file.name),
          },
          body: file,
        }).then(async r => { if (!r.ok) throw new Error((await r.json()).error || "附件上傳失敗"); });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/docs"] });
      toast({ title: "已儲存", description: title });
      onClose();
    } catch (err: any) {
      toast({ title: "儲存失敗", description: err?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-background w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl overflow-y-auto max-h-[92dvh]">
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-background z-10">
          <h2 className="font-semibold text-base flex items-center gap-2">
            {isMinutes ? <NotebookPen className="w-4 h-4 text-primary" /> : <FileText className="w-4 h-4 text-primary" />}
            {isMinutes ? "寫會議記錄" : "登記公文"}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          {!isMinutes && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">類型</label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.filter(t => t !== "會議記錄").map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-1.5 block">標題 <span className="text-red-500">*</span></label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="h-11" placeholder={isMinutes ? "" : "例：衛生局來函—藥品管理查核"} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!isMinutes && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">文號</label>
                <Input value={docNumber} onChange={e => setDocNumber(e.target.value)} className="h-11 mono" placeholder="選填" />
              </div>
            )}
            <div className={isMinutes ? "col-span-2" : ""}>
              <label className="text-sm font-medium mb-1.5 block">{isMinutes ? "會議日期" : "公文日期"}</label>
              <Input type="date" value={docDate} onChange={e => setDocDate(e.target.value)} className="h-11" />
            </div>
          </div>
          {isMinutes ? (
            <div>
              <label className="text-sm font-medium mb-1.5 block">會議內容 <span className="text-muted-foreground font-normal">（可全文搜尋）</span></label>
              <Textarea value={content} onChange={e => setContent(e.target.value)} rows={10}
                placeholder={"出席：\n\n討論事項：\n1.\n\n決議：\n1."} />
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium mb-1.5 block">摘要/備註 <span className="text-muted-foreground font-normal">（選填，可全文搜尋）</span></label>
              <Textarea value={content} onChange={e => setContent(e.target.value)} rows={3} placeholder="這份公文的重點、辦理期限..." />
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-1.5 block">標籤 <span className="text-muted-foreground font-normal">（選填，逗號分隔）</span></label>
            <Input value={tags} onChange={e => setTags(e.target.value)} className="h-11" placeholder="例：衛生局, 查核, 玻尿酸" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">附件 <span className="text-muted-foreground font-normal">（PDF/圖片/Word/Excel，25MB 內）</span></label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm file:mr-3 file:h-9 file:px-3 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary file:text-sm" />
          </div>
          <Button className="w-full h-12 text-base font-semibold" onClick={submit} disabled={busy || !title.trim()}>
            {busy ? "儲存中..." : "儲存"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── 文件詳情 ── */
function DocDetail({ docId, onClose }: { docId: string; onClose: () => void }) {
  const { toast } = useToast();
  const { data: doc } = useQuery<any>({
    queryKey: ["/api/docs", docId],
    queryFn: () => apiRequest("GET", `/api/docs/${docId}`).then(r => r.json()),
  });

  const download = async () => {
    try {
      const res = await fetch(`/api/docs/${docId}/file`, {
        headers: { "Authorization": `Bearer ${sessionStorage.getItem("cims_admin_token")}` },
      });
      if (!res.ok) throw new Error((await res.json()).error || "下載失敗");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = doc?.file_name || "attachment"; a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "下載失敗", description: err?.message, variant: "destructive" });
    }
  };

  const archive = useMutation({
    mutationFn: () => apiRequest("POST", `/api/docs/${docId}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docs"] });
      toast({ title: "已封存" });
      onClose();
    },
    onError: (e: any) => toast({ title: "封存失敗", description: e?.message, variant: "destructive" }),
  });

  if (!doc) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-background w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl overflow-y-auto max-h-[92dvh]">
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-background z-10">
          <span className={`text-xs px-2 py-0.5 rounded ${TYPE_BADGE[doc.doc_type] || TYPE_BADGE["其他"]}`}>{doc.doc_type}</span>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <h2 className="text-lg font-semibold">{doc.title}</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {doc.doc_number && <div><span className="text-muted-foreground">文號</span><p className="mono">{doc.doc_number}</p></div>}
            {doc.doc_date && <div><span className="text-muted-foreground">日期</span><p>{doc.doc_date}</p></div>}
            <div><span className="text-muted-foreground">建立者</span><p>{doc.created_by}</p></div>
            <div><span className="text-muted-foreground">建立時間</span><p>{formatTaipeiDateTime(doc.created_at)}</p></div>
          </div>
          {doc.tags && <div className="flex gap-1.5 flex-wrap">{doc.tags.split(/[,，]/).map((t: string) => t.trim()).filter(Boolean).map((t: string) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div>}
          {doc.content && (
            <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-sm whitespace-pre-wrap">{doc.content}</div>
          )}
          <div className="flex gap-2 pt-1">
            {doc.file_path && (
              <Button variant="outline" className="flex-1 h-11" onClick={download}>
                <Download className="w-4 h-4 mr-1.5" />下載附件（{doc.file_name}）
              </Button>
            )}
            <Button variant="outline" className="h-11 text-red-600 hover:text-red-700"
              onClick={() => { if (confirm("確定封存這份文件？（不會刪除，可請管理者復原）")) archive.mutate(); }}>
              <Archive className="w-4 h-4 mr-1.5" />封存
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 主頁 ── */
export default function AdminDocs() {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());
  const [typeFilter, setTypeFilter] = useState("全部");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"doc" | "minutes" | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: docs = [], error } = useQuery<any[]>({
    queryKey: ["/api/docs", typeFilter, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (typeFilter !== "全部") params.set("type", typeFilter);
      if (search.trim()) params.set("q", search.trim());
      return apiRequest("GET", `/api/docs?${params}`).then(r => r.json());
    },
    enabled: !!user && user.role !== "staff",
    retry: false,
  });

  // token 過期 → 回登入
  if (error && String((error as any)?.message || "").includes("登入")) {
    logout();
    if (user) setUser(null);
  }

  if (!user) return <LoginGate onLogin={setUser} />;

  if (user.role === "staff") {
    return (
      <div className="max-w-sm mx-auto pt-16 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto" />
        <p className="text-sm">此帳號（{user.displayName}）沒有行政文件區的權限。</p>
        <Button variant="outline" onClick={() => { logout(); setUser(null); }}>改用其他帳號登入</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      {modal && <DocModal mode={modal} onClose={() => setModal(null)} />}
      {detailId && <DocDetail docId={detailId} onClose={() => setDetailId(null)} />}

      {/* 頁頭 */}
      <div className="flex items-center gap-2 flex-wrap">
        <FolderLock className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-semibold flex-1">行政文件</h1>
        <span className="text-xs text-muted-foreground">{user.displayName}</span>
        <Button variant="ghost" size="sm" onClick={() => { logout(); setUser(null); }} data-testid="btn-logout">
          <LogOut className="w-4 h-4 mr-1" />登出
        </Button>
      </div>

      {/* 新增 */}
      <div className="flex gap-2">
        <Button className="flex-1 h-11" onClick={() => setModal("doc")} data-testid="btn-new-doc">
          <Plus className="w-4 h-4 mr-1" />登記公文
        </Button>
        <Button variant="outline" className="flex-1 h-11" onClick={() => setModal("minutes")} data-testid="btn-new-minutes">
          <NotebookPen className="w-4 h-4 mr-1" />寫會議記錄
        </Button>
      </div>

      {/* 篩選 */}
      <div className="flex gap-2 flex-wrap">
        {["全部", ...DOC_TYPES].map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-3 h-8 rounded-full text-xs font-medium border transition-colors ${
              typeFilter === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="搜尋標題、文號、標籤、內文..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
      </div>

      {/* 清單 */}
      {docs.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{search || typeFilter !== "全部" ? "查無符合的文件" : "尚無文件，點上方按鈕開始建檔"}</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {docs.map((d: any) => (
              <button key={d.id} className="w-full text-left px-4 py-3 hover:bg-muted/20 transition-colors flex items-center gap-3"
                onClick={() => setDetailId(d.id)} data-testid={`doc-row-${d.id}`}>
                <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${TYPE_BADGE[d.doc_type] || TYPE_BADGE["其他"]}`}>{d.doc_type}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.doc_date || d.created_at?.slice(0, 10)}
                    {d.doc_number && <span className="mono">　{d.doc_number}</span>}
                    　{d.created_by}
                  </p>
                </div>
                {!!d.has_file && <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
              </button>
            ))}
          </CardContent>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">所有開啟與下載都有存取紀錄。文件封存後可請管理者復原。</p>
    </div>
  );
}
