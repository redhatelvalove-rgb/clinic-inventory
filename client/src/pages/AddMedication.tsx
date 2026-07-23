import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, CheckCircle2, Camera } from "lucide-react";
import { NURSING_STAFF } from "@/lib/staff";
import BarcodeScanner from "@/components/BarcodeScanner";
import type { Vendor } from "@shared/schema";
import { MED_CATEGORIES as CATEGORIES } from "@/lib/medicationCategories";

const UNITS = ["支", "盒", "包", "條", "瓶", "片", "個"];
const STORAGE = ["室溫 15–30°C，避光", "冷藏 2–8°C，禁凍避光", "冷藏 2–8°C，禁凍", "室溫，避光"];

export default function AddMedication() {
  const { toast } = useToast();
  const [done, setDone] = useState(false);
  const [submittedName, setSubmittedName] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  const [form, setForm] = useState({
    name: "", genericName: "", category: "", unit: "",
    safetyStock: "", reorderPoint: "", reorderQty: "",
    storageCondition: "", vendorId: "", barcode: "",
    notes: "", submittedBy: "",
  });
  const [customCategory, setCustomCategory] = useState("");
  const [customUnit, setCustomUnit] = useState("");
  const [customStorage, setCustomStorage] = useState("");
  const [newVendorName, setNewVendorName] = useState("");

  const { data: vendors = [] } = useQuery<Vendor[]>({ queryKey: ["/api/vendors"] });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const effectiveCategory = form.category === "__custom__" ? customCategory.trim() : form.category;
  const effectiveUnit = form.unit === "__custom__" ? customUnit.trim() : form.unit;
  const effectiveStorage = form.storageCondition === "__custom__" ? customStorage.trim() : form.storageCondition;

  const vendorMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/vendors", { companyName: newVendorName.trim() }).then(r => r.json()),
    onSuccess: (v: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setForm(f => ({ ...f, vendorId: v.id }));
      setNewVendorName("");
      toast({ title: "廠商已建立", description: `「${v.company_name || v.companyName}」已加入廠商目錄。` });
    },
    onError: (err: any) => toast({ title: "廠商建立失敗", description: err.message, variant: "destructive" }),
  });

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/medications/submit", {
      ...form,
      category: effectiveCategory,
      unit: effectiveUnit,
      storageCondition: effectiveStorage,
      vendorId: form.vendorId === "__new__" ? "" : form.vendorId,
    }).then(r => r.json()),
    onSuccess: () => {
      setSubmittedName(form.name);
      setDone(true);
      queryClient.invalidateQueries({ queryKey: ["/api/medications"] });
    },
    onError: (err: any) => toast({ title: "提交失敗", description: err.message, variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !effectiveCategory || !effectiveUnit || !form.safetyStock)
      return toast({ title: "請填寫必填欄位", variant: "destructive" });
    mutation.mutate();
  }

  function handleReset() {
    setForm({ name: "", genericName: "", category: "", unit: "",
      safetyStock: "", reorderPoint: "", reorderQty: "",
      storageCondition: "", vendorId: "", barcode: "", notes: "", submittedBy: "" });
    setCustomCategory(""); setCustomUnit(""); setCustomStorage(""); setNewVendorName("");
    setDone(false);
  }

  // ── 完成畫面 ─────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="max-w-md mx-auto pt-8 px-2">
        <div className="bg-card border border-border rounded-xl p-6 text-center shadow-sm">
          <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-foreground mb-1">新增完成</h2>
          <p className="text-sm text-muted-foreground mb-5">
            「{submittedName}」已加入藥品清單，可直接入庫。
          </p>
          <Button onClick={handleReset} className="w-full" variant="outline">
            繼續新增品項
          </Button>
        </div>
      </div>
    );
  }

  // ── 表單 ─────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto">
      {showScanner && (
        <BarcodeScanner
          onScan={(code) => setForm(f => ({ ...f, barcode: code }))}
          onClose={() => setShowScanner(false)}
        />
      )}
      <div className="mb-5">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <PlusCircle size={20} className="text-primary" />
          新增藥品／耗材
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">填寫完成後即加入藥品清單</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">

        {/* 藥品名稱 */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">藥品／耗材名稱 <span className="text-red-500">*</span></Label>
          <Input placeholder="例如：Prolia 保骼麗" value={form.name} onChange={set("name")} data-testid="input-med-name" />
        </div>

        {/* 學名 */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">學名（選填）</Label>
          <Input placeholder="例如：Denosumab 60mg/mL" value={form.genericName} onChange={set("genericName")} data-testid="input-generic-name" />
        </div>

        {/* 分類 + 單位（並排） */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">分類 <span className="text-red-500">*</span></Label>
            <select value={form.category} onChange={set("category")}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="select-category">
              <option value="">— 選擇 —</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__custom__">＋ 自訂分類...</option>
            </select>
            {form.category === "__custom__" && (
              <Input className="mt-2" placeholder="輸入新分類名稱"
                value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                data-testid="input-custom-category" />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">單位 <span className="text-red-500">*</span></Label>
            <select value={form.unit} onChange={set("unit")}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="select-unit">
              <option value="">— 選擇 —</option>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              <option value="__custom__">＋ 自訂單位...</option>
            </select>
            {form.unit === "__custom__" && (
              <Input className="mt-2" placeholder="輸入新單位"
                value={customUnit} onChange={e => setCustomUnit(e.target.value)}
                data-testid="input-custom-unit" />
            )}
          </div>
        </div>

        {/* 安全庫存 + 補貨點（並排） */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">安全庫存量 <span className="text-red-500">*</span></Label>
            <Input type="number" min={1} placeholder="例如：10" value={form.safetyStock} onChange={set("safetyStock")} data-testid="input-safety-stock" />
            <p className="text-xs text-muted-foreground">低於此數字發警示</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">建議補貨點（選填）</Label>
            <Input type="number" min={1} placeholder="例如：15" value={form.reorderPoint} onChange={set("reorderPoint")} data-testid="input-reorder-point" />
          </div>
        </div>

        {/* 儲存條件 */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">儲存條件（選填）</Label>
          <select value={form.storageCondition} onChange={set("storageCondition")}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="select-storage">
            <option value="">— 選擇 —</option>
            {STORAGE.map(s => <option key={s} value={s}>{s}</option>)}
            <option value="__custom__">＋ 自訂儲存條件...</option>
          </select>
          {form.storageCondition === "__custom__" && (
            <Input className="mt-2" placeholder="輸入儲存條件，例：陰涼乾燥處"
              value={customStorage} onChange={e => setCustomStorage(e.target.value)}
              data-testid="input-custom-storage" />
          )}
        </div>

        {/* 廠商 */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">廠商（選填）</Label>
          <select value={form.vendorId} onChange={set("vendorId")}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="select-vendor">
            <option value="">— 選擇廠商 —</option>
            {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.company_name || v.companyName}</option>)}
            <option value="__new__">＋ 新增廠商...</option>
          </select>
          {form.vendorId === "__new__" && (
            <div className="flex gap-2 mt-2">
              <Input className="flex-1" placeholder="輸入廠商名稱"
                value={newVendorName} onChange={e => setNewVendorName(e.target.value)}
                data-testid="input-new-vendor" />
              <Button type="button" variant="outline" className="h-10 px-3 shrink-0"
                disabled={!newVendorName.trim() || vendorMutation.isPending}
                onClick={() => vendorMutation.mutate()}
                data-testid="button-create-vendor">
                {vendorMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : "建立"}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">聯絡資訊可之後到「廠商」頁補填</p>
        </div>

        {/* 條碼 */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">條碼（選填）</Label>
          <div className="flex gap-2">
            <Input className="flex-1" placeholder="掃描或手動輸入" value={form.barcode} onChange={set("barcode")} data-testid="input-barcode" />
            <Button type="button" variant="outline" className="h-10 px-3 shrink-0"
              onClick={() => setShowScanner(true)} data-testid="button-scan-barcode">
              <Camera size={16} className="mr-1.5" />掃描
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">直接掃描藥盒上的原廠條碼即可填入</p>
        </div>

        {/* 備註 */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">備註（選填）</Label>
          <Input placeholder="任何補充說明" value={form.notes} onChange={set("notes")} data-testid="input-notes" />
        </div>

        {/* 提交人 */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">提交人 <span className="text-red-500">*</span></Label>
          <select
            value={form.submittedBy}
            onChange={set("submittedBy")}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="select-submitted-by"
          >
            <option value="">— 請選擇護理師 —</option>
            {NURSING_STAFF.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div className="pt-1">
          <Button type="submit" className="w-full h-12 text-base" disabled={mutation.isPending} data-testid="button-submit-med">
            {mutation.isPending
              ? <><Loader2 size={16} className="mr-2 animate-spin" />儲存中...</>
              : <><PlusCircle size={16} className="mr-2" />儲存品項</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
