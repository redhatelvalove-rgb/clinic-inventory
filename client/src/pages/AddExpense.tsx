import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Receipt, Save, Camera, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { EXPENSE_CATEGORIES } from "@/lib/expenseCategories";
import { NURSING_STAFF } from "@/lib/staff";

const STAFF = [...NURSING_STAFF, "管理者"];

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AddExpense() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().slice(0, 10);

  const [expenseDate, setExpenseDate] = useState(today);
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [amount, setAmount] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [description, setDescription] = useState("");
  const [recordedBy, setRecordedBy] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [lastRecord, setLastRecord] = useState<{ category: string; amount: string } | null>(null);

  const selectedCat = EXPENSE_CATEGORIES.find(c => c.label === category);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 壓縮：若超過 1MB 就縮小
    const b64 = await toBase64(file);
    setPhotoBase64(b64);
    setPhotoPreview(b64);
  };

  const removePhoto = () => {
    setPhotoBase64(null);
    setPhotoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const mutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/expenses", {
        expenseDate,
        category,
        subcategory: subcategory || null,
        amount: Number(amount),
        description: description || null,
        vendorName: vendorName || null,
        receiptPhoto: photoBase64 || null,
        recordedBy,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setLastRecord({ category, amount });
      toast({ title: "費用已記錄", description: `${category} $${Number(amount).toLocaleString()} 元` });
      setDone(true);
    },
    onError: (e: any) => {
      toast({ title: "記錄失敗", description: e?.message || "請確認欄位填寫完整。", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!expenseDate) { toast({ title: "請選擇日期", variant: "destructive" }); return; }
    if (!category) { toast({ title: "請選擇費用分類", variant: "destructive" }); return; }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { toast({ title: "請輸入正確金額", variant: "destructive" }); return; }
    if (!recordedBy) { toast({ title: "請選擇記錄人員", variant: "destructive" }); return; }
    mutation.mutate();
  };

  const resetForm = () => {
    setCategory(""); setSubcategory(""); setAmount(""); setVendorName("");
    setDescription(""); setPhotoBase64(null); setPhotoPreview(null);
    setDone(false); setLastRecord(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  if (done) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
          <Receipt className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-xl font-semibold mb-1">費用記錄完成</h2>
        {lastRecord && (
          <p className="text-muted-foreground mb-6">
            {lastRecord.category} · <span className="font-semibold text-foreground">${Number(lastRecord.amount).toLocaleString()}</span> 元
          </p>
        )}
        <div className="flex gap-3">
          <Button variant="outline" onClick={resetForm}>繼續記錄費用</Button>
          <Button onClick={() => window.location.hash = "/expenses"}>查看費用清單</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <Receipt className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-semibold">記錄費用</h1>
      </div>

      {/* ── 基本資訊 ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">基本資訊</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          {/* 日期 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">費用日期 <span className="text-red-500">*</span></label>
            <Input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} className="h-11" />
          </div>

          {/* 分類 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">費用分類 <span className="text-red-500">*</span></label>
            <Select value={category} onValueChange={v => { setCategory(v); setSubcategory(""); }}>
              <SelectTrigger className="h-11" data-testid="select-category">
                <SelectValue placeholder="選擇分類" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map(c => (
                  <SelectItem key={c.label} value={c.label}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 細項（若有子分類） */}
          {selectedCat?.subcategories && selectedCat.subcategories.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">細項 <span className="text-muted-foreground font-normal">（選填）</span></label>
              <Select value={subcategory} onValueChange={setSubcategory}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="選擇細項" />
                </SelectTrigger>
                <SelectContent>
                  {selectedCat.subcategories.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 金額 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">金額（含稅）<span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="h-11 pl-8 text-lg font-semibold"
                data-testid="input-amount"
              />
            </div>
          </div>

          {/* 廠商/店家 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">廠商 / 店家 <span className="text-muted-foreground font-normal">（選填）</span></label>
            <Input
              placeholder="例：東橋儀器、全聯、中華電信..."
              value={vendorName}
              onChange={e => setVendorName(e.target.value)}
              className="h-11"
              data-testid="input-vendor"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── 憑證拍照 ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">憑證 / 發票 <span className="font-normal normal-case text-muted-foreground/70">（選填）</span></CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          {photoPreview ? (
            <div className="relative">
              <img
                src={photoPreview}
                alt="憑證照片"
                className="w-full max-h-64 object-contain rounded-lg border border-border"
              />
              <button
                onClick={removePhoto}
                className="absolute top-2 right-2 w-7 h-7 bg-background/90 border border-border rounded-full flex items-center justify-center shadow hover:bg-muted transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full h-28 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
              data-testid="btn-photo"
            >
              <Camera className="w-7 h-7" />
              <span className="text-sm">拍照或選擇圖片</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhoto}
            data-testid="input-photo"
          />
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            照片儲存於系統本機，僅供內部查帳使用
          </p>
        </CardContent>
      </Card>

      {/* ── 備註 + 記錄人 ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">備註 & 記錄人</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">備註 <span className="text-muted-foreground font-normal">（選填）</span></label>
            <Textarea
              placeholder="例：4月份護理師 PPF、月底補貨採購..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              data-testid="textarea-description"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">記錄人員 <span className="text-red-500">*</span></label>
            <Select value={recordedBy} onValueChange={setRecordedBy}>
              <SelectTrigger className="h-11" data-testid="select-recorded-by">
                <SelectValue placeholder="選擇人員" />
              </SelectTrigger>
              <SelectContent>
                {STAFF.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── 提交 ─────────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border -mx-4 md:-mx-6 px-4 md:px-6 py-3">
        <Button
          className="w-full h-12 text-base font-semibold"
          onClick={handleSubmit}
          disabled={mutation.isPending}
          data-testid="button-submit"
        >
          <Save className="w-4 h-4 mr-2" />
          {mutation.isPending ? "儲存中..." : "儲存費用紀錄"}
        </Button>
      </div>
      <div className="h-4" />
    </div>
  );
}
