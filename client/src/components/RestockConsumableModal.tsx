import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PackagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { NURSING_STAFF } from "@/lib/staff";

interface Consumable {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
}

interface Props {
  item: Consumable;
  onClose: () => void;
}

/**
 * 衛材進貨視窗：輸入進貨量＋經手人，系統自動加庫存並留軌跡。
 * 定期盤點制下「進貨要記、耗用不記」，這裡就是記進貨的入口。
 */
export default function RestockConsumableModal({ item, onClose }: Props) {
  const { toast } = useToast();
  const [quantity, setQuantity] = useState("");
  const [performer, setPerformer] = useState("");
  const [notes, setNotes] = useState("");

  const qty = Number(quantity);
  const validQty = quantity !== "" && !isNaN(qty) && qty > 0;
  const newStock = validQty ? item.current_stock + qty : null;

  const mutation = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/consumables/${item.id}/restock`, {
        quantity: qty,
        performedBy: performer,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consumables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-counts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "進貨完成", description: `${item.name}：${item.current_stock} → ${newStock} ${item.unit}` });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "進貨失敗", description: err?.message || "請稍後再試", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!validQty) { toast({ title: "請輸入正確的進貨數量", variant: "destructive" }); return; }
    if (!performer) { toast({ title: "請選擇經手人", variant: "destructive" }); return; }
    mutation.mutate();
  };

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
          <h2 className="font-semibold text-base flex items-center gap-2">
            <PackagePlus className="w-4 h-4 text-primary" />衛材進貨
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 品項資訊 */}
          <div className="rounded-lg bg-muted/50 px-3 py-2.5">
            <p className="text-sm font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              目前庫存 <span className="font-semibold mono">{item.current_stock}</span> {item.unit}
            </p>
          </div>

          {/* 進貨數量 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">進貨數量 <span className="text-red-500">*</span></label>
            <Input
              type="number" min="1" inputMode="numeric" placeholder="0"
              value={quantity} onChange={e => setQuantity(e.target.value)}
              className="h-11 text-lg font-semibold mono"
              data-testid="restock-input-qty" autoFocus
            />
            {newStock !== null && (
              <p className="text-xs text-muted-foreground mt-1.5">
                入庫後：{item.current_stock} → <span className="font-semibold text-foreground">{newStock}</span> {item.unit}
              </p>
            )}
          </div>

          {/* 經手人 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">經手人 <span className="text-red-500">*</span></label>
            <select
              value={performer} onChange={e => setPerformer(e.target.value)}
              className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="restock-select-performer"
            >
              <option value="">— 請選擇護理師 —</option>
              {NURSING_STAFF.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>

          {/* 備註 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">備註 <span className="text-muted-foreground font-normal">（選填）</span></label>
            <Textarea
              placeholder="例：廠商名稱、單號..."
              value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              data-testid="restock-textarea-notes"
            />
          </div>

          {/* 送出 */}
          <Button
            className="w-full h-12 text-base font-semibold"
            onClick={handleSubmit}
            disabled={!validQty || !performer || mutation.isPending}
            data-testid="restock-button-submit"
          >
            {mutation.isPending ? "處理中..." : "確認進貨"}
          </Button>
        </div>
      </div>
    </div>
  );
}
