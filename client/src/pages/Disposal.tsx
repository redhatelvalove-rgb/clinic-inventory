import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { NURSING_STAFF } from "@/lib/staff";

import { taipeiToday, formatTaipeiDateTime } from "@shared/date-utils";

const today = () => taipeiToday();

export default function Disposal() {
  const { toast } = useToast();
  const [medId, setMedId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [performer, setPerformer] = useState("");
  const [done, setDone] = useState(false);

  const { data: medications = [] } = useQuery<any[]>({ queryKey: ["/api/medications"] });
  const activeMeds = medications.filter(m => m.is_active);
  const selectedMed = activeMeds.find(m => m.id === medId);

  const { data: medDetail } = useQuery<any>({ queryKey: ["/api/medications", medId], enabled: !!medId });
  const batches: any[] = (medDetail?.batches ?? [])
    .filter((b: any) => b.remaining_qty > 0)
    .sort((a: any, b: any) => a.expiry_date.localeCompare(b.expiry_date));
  const selectedBatch = batches.find(b => b.id === batchId);

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/inventory/disposals", {
        medId, batchId, quantity, reason: reason.trim(),
        performedBy: performer.trim() || "未填寫",
      }).then(r => r.json()),
    onSuccess: () => {
      setDone(true);
      queryClient.invalidateQueries({ queryKey: ["/api/medications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/medications", medId] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches/expiring"] });
    },
    onError: (err: any) => toast({ title: "報廢失敗", description: err.message, variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!medId) return toast({ title: "請選擇藥品", variant: "destructive" });
    if (!batchId) return toast({ title: "請選擇批次", variant: "destructive" });
    if (!reason.trim()) return toast({ title: "請填寫報廢原因", variant: "destructive" });
    if (!performer) return toast({ title: "請選擇操作人員", variant: "destructive" });
    if (selectedBatch && quantity > selectedBatch.remaining_qty)
      return toast({ title: "數量超過批次剩餘", variant: "destructive" });
    mutation.mutate();
  }

  function handleReset() {
    setMedId(""); setBatchId(""); setQuantity(1); setReason(""); setPerformer(""); setDone(false);
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto pt-8 px-2">
        <div className="bg-card border border-border rounded-xl p-6 text-center shadow-sm">
          <CheckCircle2 size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-1">報廢完成</h2>
          <p className="text-muted-foreground text-sm mb-6">已記錄報廢並更新庫存，可於交易紀錄查詢。</p>
          <Button onClick={handleReset} className="w-full" data-testid="button-next-disposal">繼續下一筆報廢</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-5">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Trash2 size={20} className="text-primary" />藥品報廢
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">過期、破損、汙染等須報廢的批次，會留下軌跡</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-5">
        {/* 藥品 */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">藥品名稱 <span className="text-red-500">*</span></Label>
          <select value={medId} onChange={e => { setMedId(e.target.value); setBatchId(""); setQuantity(1); }}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="select-medication">
            <option value="">— 請選擇藥品 —</option>
            {activeMeds.map(m => <option key={m.id} value={m.id}>{m.name}（庫存 {m.current_stock} {m.unit}）</option>)}
          </select>
        </div>

        {/* 批次 */}
        {selectedMed && (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">批次 <span className="text-red-500">*</span></Label>
            {batches.length === 0 ? (
              <p className="text-xs text-muted-foreground">此藥品無可報廢批次。</p>
            ) : (
              <select value={batchId} onChange={e => { setBatchId(e.target.value); setQuantity(1); }}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="select-batch">
                <option value="">— 請選擇批次 —</option>
                {batches.map(b => {
                  const expired = b.expiry_date < today();
                  return <option key={b.id} value={b.id}>
                    批號 {b.batch_number}｜效期 {b.expiry_date}{expired ? "（已過期）" : ""}｜剩 {b.remaining_qty}
                  </option>;
                })}
              </select>
            )}
            {selectedBatch && selectedBatch.expiry_date < today() && (
              <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={12} />此批次已過期</p>
            )}
          </div>
        )}

        {/* 數量 */}
        {selectedBatch && (
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">報廢數量 <span className="text-red-500">*</span></Label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-md border border-input bg-background text-lg font-bold flex items-center justify-center hover:bg-muted">−</button>
              <Input type="number" min={1} max={selectedBatch.remaining_qty} value={quantity}
                onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="text-center text-lg font-semibold h-10" data-testid="input-quantity" />
              <button type="button" onClick={() => setQuantity(q => Math.min(selectedBatch.remaining_qty, q + 1))}
                className="w-10 h-10 rounded-md border border-input bg-background text-lg font-bold flex items-center justify-center hover:bg-muted">+</button>
              <span className="text-sm text-muted-foreground">{selectedMed?.unit}</span>
            </div>
            <p className="text-xs text-muted-foreground">此批次剩餘 {selectedBatch.remaining_qty}</p>
          </div>
        )}

        {/* 原因 */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">報廢原因 <span className="text-red-500">*</span></Label>
          <Input placeholder="例如：已過效期 / 破損 / 汙染" value={reason} onChange={e => setReason(e.target.value)} data-testid="input-reason" />
        </div>

        {/* 操作人員 */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">操作人員 <span className="text-red-500">*</span></Label>
          <select value={performer} onChange={e => setPerformer(e.target.value)}
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="select-performer">
            <option value="">— 請選擇護理師 —</option>
            {NURSING_STAFF.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>

        <Button type="submit" variant="destructive" className="w-full h-12 text-base"
          disabled={mutation.isPending || !batchId || !reason.trim() || !performer}
          data-testid="button-submit-disposal">
          {mutation.isPending
            ? <><Loader2 size={16} className="mr-2 animate-spin" />處理中...</>
            : <><Trash2 size={16} className="mr-2" />確認報廢</>}
        </Button>
      </form>
    </div>
  );
}
