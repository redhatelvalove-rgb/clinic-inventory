import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { NURSING_STAFF } from "@/lib/staff";

interface Props {
  medId: string;
  batch: { id: string; batch_number: string; remaining_qty: number; expiry_date: string };
  unit: string;
  onClose: () => void;
}

export default function AdjustBatchModal({ medId, batch, unit, onClose }: Props) {
  const { toast } = useToast();
  const [newQty, setNewQty] = useState(String(batch.remaining_qty));
  const [reason, setReason] = useState("");
  const [performer, setPerformer] = useState("");

  const changed = Number(newQty) !== batch.remaining_qty;

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/inventory/adjustments", {
        medId, batchId: batch.id,
        newRemainingQty: Number(newQty),
        reason: reason.trim(),
        performedBy: performer.trim() || "未填寫",
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medications", medId] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "調整已記錄", description: `批號 ${batch.batch_number} 已更新。` });
      onClose();
    },
    onError: (e: any) => toast({ title: "調整失敗", description: e?.message || "請稍後再試。", variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!changed) return toast({ title: "數量未變動", variant: "destructive" });
    if (!reason.trim()) return toast({ title: "請填寫調整原因", variant: "destructive" });
    if (!performer) return toast({ title: "請選擇調整人", variant: "destructive" });
    mutation.mutate();
  };

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={handleBackdrop}>
      <div className="bg-background w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl overflow-y-auto max-h-[92dvh]">
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-background z-10">
          <h2 className="font-semibold text-base">調整批次數量</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            批號 <span className="font-medium">{batch.batch_number}</span>　效期 {batch.expiry_date}
            <div className="text-xs text-muted-foreground mt-1">目前剩餘：{batch.remaining_qty} {unit}</div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">新剩餘數量 <span className="text-red-500">*</span></label>
            <Input type="number" inputMode="numeric" min={0} value={newQty} onChange={e => setNewQty(e.target.value)} className="h-11" data-testid="adjust-input-qty" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">調整原因 <span className="text-red-500">*</span></label>
            <Input placeholder="例如：盤點發現實際數量不符" value={reason} onChange={e => setReason(e.target.value)} className="h-11" data-testid="adjust-input-reason" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">調整人 <span className="text-red-500">*</span></label>
            <Select value={performer} onValueChange={setPerformer}>
              <SelectTrigger className="h-11" data-testid="adjust-select-performer"><SelectValue placeholder="— 請選擇 —" /></SelectTrigger>
              <SelectContent>{NURSING_STAFF.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-1 pb-2">
            <Button variant="outline" className="flex-1 h-11" onClick={onClose} disabled={mutation.isPending}>取消</Button>
            <Button className="flex-1 h-11 font-semibold" onClick={handleSubmit} disabled={mutation.isPending} data-testid="adjust-save">
              <Save className="w-4 h-4 mr-1" />{mutation.isPending ? "儲存中..." : "儲存調整"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
