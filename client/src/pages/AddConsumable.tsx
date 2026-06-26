import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PackagePlus, Save, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CATEGORY_ORDER } from "@/lib/consumableCategories";

interface Vendor { id: string; name: string; }

const UNITS = ["個", "片", "包", "捲", "條", "瓶", "盒", "袋", "組", "副", "雙", "支", "張", "cc", "ml"];

export default function AddConsumable() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [customUnit, setCustomUnit] = useState("");
  const [safetyStock, setSafetyStock] = useState("0");
  const [vendorId, setVendorId] = useState("none");
  const [isDurable, setIsDurable] = useState(false);
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState(false);

  const { data: vendors = [] } = useQuery<Vendor[]>({ queryKey: ["/api/vendors"] });

  const effectiveCategory = category === "__custom__" ? customCategory : category;
  const effectiveUnit = unit === "__custom__" ? customUnit : unit;

  const mutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/consumables", {
        name: name.trim(),
        category: effectiveCategory.trim(),
        unit: effectiveUnit.trim(),
        safetyStock: Number(safetyStock) || 0,
        vendorId: vendorId === "none" ? null : vendorId,
        isDurable,
        notes: notes.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consumables"] });
      toast({ title: "新增成功", description: `「${name}」已加入衛材清單。` });
      setDone(true);
    },
    onError: (e: any) => {
      toast({ title: "新增失敗", description: e?.message || "請確認欄位填寫完整。", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) { toast({ title: "請輸入品名", variant: "destructive" }); return; }
    if (!effectiveCategory.trim()) { toast({ title: "請選擇或輸入分類", variant: "destructive" }); return; }
    if (!effectiveUnit.trim()) { toast({ title: "請選擇或輸入單位", variant: "destructive" }); return; }
    mutation.mutate();
  };

  if (done) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <PackagePlus className="w-14 h-14 text-green-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">品項新增完成！</h2>
        <p className="text-muted-foreground mb-6">「{name}」已成功加入衛材清單。</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => {
            setName(""); setCategory(""); setCustomCategory(""); setUnit(""); setCustomUnit("");
            setSafetyStock("0"); setVendorId("none"); setIsDurable(false); setNotes(""); setDone(false);
          }}>
            繼續新增
          </Button>
          <Button onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4 mr-1" />返回清單
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <PackagePlus className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-semibold">新增衛材品項</h1>
      </div>

      {/* 基本資料 */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">基本資料</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          {/* 品名 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">品名 <span className="text-red-500">*</span></label>
            <Input
              placeholder="例：乾棉球（滅菌）"
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-11"
              data-testid="input-name"
            />
          </div>

          {/* 分類 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">分類 <span className="text-red-500">*</span></label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11" data-testid="select-category">
                <SelectValue placeholder="選擇分類" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_ORDER.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
                <SelectItem value="__custom__">＋ 自訂分類...</SelectItem>
              </SelectContent>
            </Select>
            {category === "__custom__" && (
              <Input
                className="mt-2 h-10"
                placeholder="輸入自訂分類名稱"
                value={customCategory}
                onChange={e => setCustomCategory(e.target.value)}
                data-testid="input-custom-category"
              />
            )}
          </div>

          {/* 單位 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">單位 <span className="text-red-500">*</span></label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger className="h-11" data-testid="select-unit">
                <SelectValue placeholder="選擇單位" />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map(u => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
                <SelectItem value="__custom__">＋ 自訂單位...</SelectItem>
              </SelectContent>
            </Select>
            {unit === "__custom__" && (
              <Input
                className="mt-2 h-10"
                placeholder="輸入自訂單位"
                value={customUnit}
                onChange={e => setCustomUnit(e.target.value)}
                data-testid="input-custom-unit"
              />
            )}
          </div>

          {/* 安全水位 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">安全水位（最低庫存警示）</label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={safetyStock}
              onChange={e => setSafetyStock(e.target.value)}
              className="h-11"
              data-testid="input-safety-stock"
            />
            <p className="text-xs text-muted-foreground mt-1">庫存低於此數量時，系統會顯示警示。設 0 表示不警示。</p>
          </div>
        </CardContent>
      </Card>

      {/* 進階設定 */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">進階設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          {/* 廠商 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">廠商 <span className="text-muted-foreground font-normal">（選填）</span></label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger className="h-11" data-testid="select-vendor">
                <SelectValue placeholder="選擇廠商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不指定</SelectItem>
                {vendors.map((v: Vendor) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 器械器具 toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium">器械器具（不需盤點）</p>
              <p className="text-xs text-muted-foreground">開啟後此品項不列入庫存消耗統計</p>
            </div>
            <button
              type="button"
              onClick={() => setIsDurable(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${isDurable ? "bg-primary" : "bg-muted"}`}
              data-testid="toggle-durable"
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isDurable ? "translate-x-5" : ""}`} />
            </button>
          </div>

          {/* 備註 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">備註 <span className="text-muted-foreground font-normal">（選填）</span></label>
            <Textarea
              placeholder="例：適用於傷口清潔、需冷藏保存..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              data-testid="textarea-notes"
            />
          </div>
        </CardContent>
      </Card>

      {/* 提交 */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border -mx-4 md:-mx-6 px-4 md:px-6 py-3">
        <Button
          className="w-full h-12 text-base font-semibold"
          onClick={handleSubmit}
          disabled={mutation.isPending}
          data-testid="button-submit"
        >
          <Save className="w-4 h-4 mr-2" />
          {mutation.isPending ? "儲存中..." : "儲存品項"}
        </Button>
      </div>
      <div className="h-4" />
    </div>
  );
}
