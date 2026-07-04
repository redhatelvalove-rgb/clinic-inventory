import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CATEGORY_ORDER } from "@/lib/consumableCategories";
import { NURSING_STAFF } from "@/lib/staff";

interface Consumable {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  safety_stock: number;
  is_durable: boolean;
  is_active: boolean;
  vendor_id?: string | null;
  notes?: string | null;
}

interface Vendor { id: string; name: string; }

const UNITS = ["個", "片", "包", "捲", "條", "瓶", "盒", "袋", "組", "副", "雙", "支", "張", "cc", "ml"];

interface Props {
  item: Consumable;
  onClose: () => void;
}

export default function EditConsumableModal({ item, onClose }: Props) {
  const { toast } = useToast();

  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(
    CATEGORY_ORDER.includes(item.category) ? item.category : "__custom__"
  );
  const [customCategory, setCustomCategory] = useState(
    CATEGORY_ORDER.includes(item.category) ? "" : item.category
  );
  const [unit, setUnit] = useState(UNITS.includes(item.unit) ? item.unit : "__custom__");
  const [customUnit, setCustomUnit] = useState(UNITS.includes(item.unit) ? "" : item.unit);
  const [safetyStock, setSafetyStock] = useState(String(item.safety_stock));
  const [currentStock, setCurrentStock] = useState(String(item.current_stock));
  const [adjustedBy, setAdjustedBy] = useState("");
  const [vendorId, setVendorId] = useState(item.vendor_id || "none");
  // SQLite 回傳 0/1，須轉真布林，否則後端 z.boolean() 驗證會 400
  const [isDurable, setIsDurable] = useState(Boolean(item.is_durable));
  const [isActive, setIsActive] = useState(Boolean(item.is_active));
  const [notes, setNotes] = useState(item.notes || "");

  const { data: vendors = [] } = useQuery<Vendor[]>({ queryKey: ["/api/vendors"] });

  const effectiveCategory = category === "__custom__" ? customCategory : category;
  const effectiveUnit = unit === "__custom__" ? customUnit : unit;

  // 數量是否被改動（決定要不要記錄盤點調整軌跡）
  const stockChanged = Number(currentStock) !== item.current_stock;

  const mutation = useMutation({
    mutationFn: async () => {
      // 1) 更新品項基本資料
      await apiRequest("PATCH", `/api/consumables/${item.id}`, {
        name: name.trim(),
        category: effectiveCategory.trim(),
        unit: effectiveUnit.trim(),
        safetyStock: Number(safetyStock) || 0,
        vendorId: vendorId === "none" ? null : vendorId,
        isDurable,
        isActive,
        notes: notes.trim() || null,
      });
      // 2) 數量有變動：透過盤點 API 記錄軌跡（前值→新值、誰、何時，會進盤點紀錄）
      if (stockChanged) {
        await apiRequest("POST", "/api/inventory-counts", {
          countedBy: adjustedBy,
          notes: "清單編輯調整數量",
          items: [{ consumableId: item.id, countedStock: Number(currentStock) }],
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consumables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-counts"] });
      toast({ title: "修改已儲存", description: `「${name}」已更新。` });
      onClose();
    },
    onError: (e: any) => {
      toast({ title: "儲存失敗", description: e?.message || "請稍後再試。", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) { toast({ title: "請輸入品名", variant: "destructive" }); return; }
    if (!effectiveCategory.trim()) { toast({ title: "請選擇或輸入分類", variant: "destructive" }); return; }
    if (!effectiveUnit.trim()) { toast({ title: "請選擇或輸入單位", variant: "destructive" }); return; }
    if (stockChanged && !adjustedBy) { toast({ title: "請選擇調整人", description: "數量有變動，需記錄是誰調整的。", variant: "destructive" }); return; }
    mutation.mutate();
  };

  // 點背景關閉
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-background w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl overflow-y-auto max-h-[92dvh] sm:max-h-[85vh]">
        {/* 標題列 */}
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-background z-10">
          <h2 className="font-semibold text-base">編輯品項</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 品名 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">品名 <span className="text-red-500">*</span></label>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-11" data-testid="edit-input-name" />
          </div>

          {/* 分類 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">分類 <span className="text-red-500">*</span></label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11">
                <SelectValue />
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
                placeholder="輸入自訂分類"
                value={customCategory}
                onChange={e => setCustomCategory(e.target.value)}
              />
            )}
          </div>

          {/* 單位 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">單位 <span className="text-red-500">*</span></label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger className="h-11">
                <SelectValue />
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
              />
            )}
          </div>

          {/* 目前數量 + 安全水位（並排） */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">目前數量</label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={currentStock}
                onChange={e => setCurrentStock(e.target.value)}
                className="h-11"
                data-testid="edit-input-current-stock"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">安全水位</label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                value={safetyStock}
                onChange={e => setSafetyStock(e.target.value)}
                className="h-11"
                data-testid="edit-input-safety"
              />
            </div>
          </div>

          {/* 調整人：只有改了數量才出現（記錄軌跡用） */}
          {stockChanged && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-1.5">
              <label className="text-sm font-medium block">
                調整人 <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-muted-foreground">
                數量將從 {item.current_stock} 改為 {currentStock || 0}，會記入盤點紀錄。
              </p>
              <Select value={adjustedBy} onValueChange={setAdjustedBy}>
                <SelectTrigger className="h-11" data-testid="edit-select-adjusted-by">
                  <SelectValue placeholder="— 請選擇調整人 —" />
                </SelectTrigger>
                <SelectContent>
                  {NURSING_STAFF.map(n => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 廠商 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">廠商</label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不指定</SelectItem>
                {vendors.map((v: Vendor) => (
                  <SelectItem key={v.id} value={v.id}>{(v as any).company_name || v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 器械器具 */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium">器械器具（不需盤點）</p>
              <p className="text-xs text-muted-foreground">開啟後不列入盤點統計</p>
            </div>
            <button
              type="button"
              onClick={() => setIsDurable(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${isDurable ? "bg-primary" : "bg-muted"}`}
              data-testid="edit-toggle-durable"
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isDurable ? "translate-x-5" : ""}`} />
            </button>
          </div>

          {/* 啟用狀態 */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium">啟用品項</p>
              <p className="text-xs text-muted-foreground">停用後不出現在盤點與清單中</p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${isActive ? "bg-primary" : "bg-muted"}`}
              data-testid="edit-toggle-active"
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isActive ? "translate-x-5" : ""}`} />
            </button>
          </div>

          {/* 備註 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">備註</label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="備註說明..."
              data-testid="edit-textarea-notes"
            />
          </div>

          {/* 操作按鈕 */}
          <div className="flex gap-2 pt-1 pb-2">
            <Button variant="outline" className="flex-1 h-11" onClick={onClose} disabled={mutation.isPending}>
              取消
            </Button>
            <Button className="flex-1 h-11 font-semibold" onClick={handleSubmit} disabled={mutation.isPending} data-testid="edit-button-save">
              <Save className="w-4 h-4 mr-1" />
              {mutation.isPending ? "儲存中..." : "儲存變更"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
