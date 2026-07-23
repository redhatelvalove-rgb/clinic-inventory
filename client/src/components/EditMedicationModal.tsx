import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Save, X, Camera, PackagePlus, PackageMinus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import BarcodeScanner from "@/components/BarcodeScanner";
import type { Vendor } from "@shared/schema";

import { MED_CATEGORIES as CATEGORIES } from "@/lib/medicationCategories";
const UNITS = ["支", "盒", "包", "條", "瓶", "片", "個"];
const STORAGE = ["室溫 15–30°C，避光", "冷藏 2–8°C，禁凍避光", "冷藏 2–8°C，禁凍", "室溫，避光"];

interface Med {
  id: string;
  name: string;
  generic_name?: string | null;
  category: string;
  unit: string;
  current_stock: number;
  safety_stock: number;
  reorder_point?: number | null;
  reorder_qty?: number | null;
  storage_condition?: string | null;
  vendor_id?: string | null;
  barcode?: string | null;
  notes?: string | null;
}

export default function EditMedicationModal({ item, onClose }: { item: Med; onClose: () => void }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showScanner, setShowScanner] = useState(false);

  const [name, setName] = useState(item.name);
  const [genericName, setGenericName] = useState(item.generic_name || "");
  const [category, setCategory] = useState(item.category);
  const [unit, setUnit] = useState(item.unit);
  const [safetyStock, setSafetyStock] = useState(String(item.safety_stock));
  const [reorderPoint, setReorderPoint] = useState(item.reorder_point != null ? String(item.reorder_point) : "");
  const [reorderQty, setReorderQty] = useState(item.reorder_qty != null ? String(item.reorder_qty) : "");
  const [storageCondition, setStorageCondition] = useState(item.storage_condition || "");
  const [vendorId, setVendorId] = useState(item.vendor_id || "");
  const [barcode, setBarcode] = useState(item.barcode || "");
  const [notes, setNotes] = useState(item.notes || "");

  const { data: vendors = [] } = useQuery<Vendor[]>({ queryKey: ["/api/vendors"] });

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/medications/${item.id}`, {
        name: name.trim(),
        genericName: genericName.trim() || null,
        category,
        unit,
        safetyStock: Number(safetyStock) || 0,
        reorderPoint: reorderPoint === "" ? null : Number(reorderPoint),
        reorderQty: reorderQty === "" ? null : Number(reorderQty),
        storageCondition: storageCondition || null,
        vendorId: vendorId || null,
        barcode: barcode.trim() || null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "修改已儲存", description: `「${name}」已更新。` });
      onClose();
    },
    onError: (e: any) =>
      toast({ title: "儲存失敗", description: e?.message || "請稍後再試。", variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!name.trim()) { toast({ title: "請輸入藥品名稱", variant: "destructive" }); return; }
    if (!category) { toast({ title: "請選擇分類", variant: "destructive" }); return; }
    if (!unit) { toast({ title: "請選擇單位", variant: "destructive" }); return; }
    mutation.mutate();
  };

  const goAndClose = (path: string) => { onClose(); setLocation(path); };

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const selectCls = "w-full h-11 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={handleBackdrop}>
      {showScanner && (
        <BarcodeScanner onScan={(code) => setBarcode(code)} onClose={() => setShowScanner(false)} />
      )}
      <div className="bg-background w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl overflow-y-auto max-h-[92dvh] sm:max-h-[85vh]">
        {/* 標題列 */}
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-background z-10">
          <h2 className="font-semibold text-base">編輯藥品</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 目前數量（唯讀，導向入庫/出庫） */}
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">目前庫存</span>
              <span className="text-lg font-bold">{item.current_stock} {item.unit}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2 flex items-start gap-1">
              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500" />
              藥品數量依「效期批次」管理，請用入庫/出庫調整，以正確追蹤效期。
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 h-9 text-sm" onClick={() => goAndClose("/stock-in")} data-testid="edit-med-goto-stockin">
                <PackagePlus size={15} className="mr-1" />去入庫
              </Button>
              <Button type="button" variant="outline" className="flex-1 h-9 text-sm" onClick={() => goAndClose("/stock-out")} data-testid="edit-med-goto-stockout">
                <PackageMinus size={15} className="mr-1" />去出庫
              </Button>
            </div>
          </div>

          {/* 藥品名稱 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">藥品名稱 <span className="text-red-500">*</span></label>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-11" data-testid="edit-med-name" />
          </div>

          {/* 學名 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">學名</label>
            <Input value={genericName} onChange={e => setGenericName(e.target.value)} className="h-11" data-testid="edit-med-generic" />
          </div>

          {/* 分類 + 單位 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">分類 <span className="text-red-500">*</span></label>
              <select value={category} onChange={e => setCategory(e.target.value)} className={selectCls} data-testid="edit-med-category">
                {!CATEGORIES.includes(category) && <option value={category}>{category}</option>}
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">單位 <span className="text-red-500">*</span></label>
              <select value={unit} onChange={e => setUnit(e.target.value)} className={selectCls} data-testid="edit-med-unit">
                {!UNITS.includes(unit) && <option value={unit}>{unit}</option>}
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* 安全庫存 + 補貨點 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">安全庫存量</label>
              <Input type="number" inputMode="numeric" min={0} value={safetyStock} onChange={e => setSafetyStock(e.target.value)} className="h-11" data-testid="edit-med-safety" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">補貨點</label>
              <Input type="number" inputMode="numeric" min={0} value={reorderPoint} onChange={e => setReorderPoint(e.target.value)} className="h-11" data-testid="edit-med-reorder-point" />
            </div>
          </div>

          {/* 建議補貨量 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">建議補貨量</label>
            <Input type="number" inputMode="numeric" min={0} value={reorderQty} onChange={e => setReorderQty(e.target.value)} className="h-11" data-testid="edit-med-reorder-qty" />
          </div>

          {/* 儲存條件 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">儲存條件</label>
            <select value={storageCondition} onChange={e => setStorageCondition(e.target.value)} className={selectCls} data-testid="edit-med-storage">
              <option value="">— 選擇 —</option>
              {!STORAGE.includes(storageCondition) && storageCondition && <option value={storageCondition}>{storageCondition}</option>}
              {STORAGE.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* 廠商 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">廠商</label>
            <select value={vendorId} onChange={e => setVendorId(e.target.value)} className={selectCls} data-testid="edit-med-vendor">
              <option value="">— 不指定 —</option>
              {vendors.map((v: any) => <option key={v.id} value={v.id}>{v.company_name || v.companyName}</option>)}
            </select>
          </div>

          {/* 條碼 + 掃描 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">條碼</label>
            <div className="flex gap-2">
              <Input className="flex-1 h-11" placeholder="掃描或手動輸入" value={barcode} onChange={e => setBarcode(e.target.value)} data-testid="edit-med-barcode" />
              <Button type="button" variant="outline" className="h-11 px-3 shrink-0" onClick={() => setShowScanner(true)} data-testid="edit-med-scan">
                <Camera size={16} className="mr-1.5" />掃描
              </Button>
            </div>
          </div>

          {/* 備註 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">備註</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="備註說明..." data-testid="edit-med-notes" />
          </div>

          {/* 操作按鈕 */}
          <div className="flex gap-2 pt-1 pb-2">
            <Button variant="outline" className="flex-1 h-11" onClick={onClose} disabled={mutation.isPending}>取消</Button>
            <Button className="flex-1 h-11 font-semibold" onClick={handleSubmit} disabled={mutation.isPending} data-testid="edit-med-save">
              <Save className="w-4 h-4 mr-1" />
              {mutation.isPending ? "儲存中..." : "儲存變更"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
