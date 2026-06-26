import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Camera, Barcode, CheckCircle2, PackagePlus, AlertCircle, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

/* ── html5-qrcode 掃描器元件 ── */
function BarcodeModal({ onScan, onClose }: { onScan: (code: string) => void; onClose: () => void }) {
  const scannerRef = useRef<any>(null);
  const divId = "qr-reader-modal";

  useEffect(() => {
    let scanner: any = null;
    // 動態 import html5-qrcode（避免 SSR 問題）
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      scanner = new Html5Qrcode(divId);
      scannerRef.current = scanner;
      scanner.start(
        { facingMode: "environment" }, // 後鏡頭
        { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.777 },
        (decodedText: string) => {
          // 成功掃到
          scanner.stop().then(() => {
            onScan(decodedText);
            onClose();
          });
        },
        () => {} // 掃描中（忽略持續錯誤）
      ).catch(() => {
        // 相機權限被拒或不支援
      });
    });
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
      <div className="bg-card rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Camera size={16} className="text-primary" />
            掃描藥品條碼
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
            <X size={15} />
          </button>
        </div>
        {/* Scanner area */}
        <div className="p-3">
          <div id={divId} className="w-full rounded-lg overflow-hidden" />
          <p className="text-xs text-center text-muted-foreground mt-2">
            將鏡頭對準條碼（EAN-13 / QR Code）
          </p>
        </div>
        <div className="px-4 pb-4">
          <Button variant="outline" className="w-full h-9 text-sm" onClick={onClose}>
            取消
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── 主入庫頁面 ── */
export default function StockIn() {
  const { toast } = useToast();
  const [medId, setMedId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastScanned, setLastScanned] = useState("");

  const { data: meds = [] } = useQuery<any[]>({ queryKey: ["/api/medications"] });
  const selectedMed = meds.find((m: any) => m.id === medId);

  const mutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/stock/in", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      setSubmitted(true);
      toast({ title: "入庫成功", description: `已新增 ${quantity} ${selectedMed?.unit} 至庫存` });
    },
    onError: () => {
      toast({ title: "入庫失敗", variant: "destructive" });
    },
  });

  const handleScan = (code: string) => {
    setLastScanned(code);
    // 嘗試比對條碼到藥品
    const found = meds.find((m: any) => m.barcode === code);
    if (found) {
      setMedId(found.id);
      toast({ title: "條碼比對成功", description: found.name });
    } else {
      toast({ title: `掃描到條碼：${code}`, description: "此條碼尚未建立藥品資料，請手動選擇或新增", variant: "destructive" });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medId || !batchNumber || !quantity || !expiryDate) return;
    mutation.mutate({ medId, batchNumber, quantity: parseInt(quantity), expiryDate, unitCost: unitCost ? parseFloat(unitCost) : undefined, poNumber: poNumber || undefined });
  };

  const handleReset = () => {
    setMedId(""); setBatchNumber(""); setQuantity(""); setExpiryDate(""); setUnitCost(""); setPoNumber(""); setSubmitted(false); setLastScanned("");
  };

  const daysLeft = expiryDate ? Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000) : null;

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {showScanner && <BarcodeModal onScan={handleScan} onClose={() => setShowScanner(false)} />}

      <div>
        <h1 className="text-xl font-semibold text-foreground">入庫登記</h1>
        <p className="text-sm text-muted-foreground mt-0.5">新增藥品批次與庫存數量</p>
      </div>

      {submitted ? (
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="py-10 text-center">
            <CheckCircle2 size={44} className="text-emerald-500 mx-auto mb-3" />
            <h2 className="text-base font-semibold text-foreground mb-1">入庫完成</h2>
            <p className="text-sm text-muted-foreground mb-5">
              {selectedMed?.name}｜{quantity} {selectedMed?.unit}<br />
              批號 {batchNumber}｜效期 {expiryDate}
            </p>
            <Button onClick={handleReset} size="sm" data-testid="button-new-entry">繼續入庫</Button>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 條碼掃描 CTA — 手機優先大按鈕 */}
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-primary/40
                       bg-primary/5 hover:bg-primary/10 text-primary transition-colors active:scale-[0.98]"
            data-testid="button-scan">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Camera size={20} />
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold">掃描條碼入庫</div>
              <div className="text-xs opacity-70">啟動相機，對準藥品外包裝</div>
            </div>
            {lastScanned && (
              <div className="ml-auto text-xs mono bg-primary/10 px-2 py-0.5 rounded">
                {lastScanned.slice(0, 13)}
              </div>
            )}
          </button>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <PackagePlus size={14} className="text-primary" />
                入庫資料
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Med select */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium" htmlFor="med-select">藥品名稱 *</Label>
                <Select value={medId} onValueChange={setMedId}>
                  <SelectTrigger id="med-select" className="h-10 text-sm" data-testid="select-medication">
                    <SelectValue placeholder="選擇藥品..." />
                  </SelectTrigger>
                  <SelectContent>
                    {meds.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                        <span className="text-muted-foreground ml-1">({m.unit})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Selected med info */}
              {selectedMed && (
                <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs space-y-1.5">
                  <div className="grid grid-cols-2 gap-1">
                    <div><span className="text-muted-foreground">現有庫存</span> <span className="font-semibold mono ml-1">{selectedMed.current_stock} {selectedMed.unit}</span></div>
                    <div><span className="text-muted-foreground">安全量</span> <span className="font-semibold mono ml-1">{selectedMed.safety_stock} {selectedMed.unit}</span></div>
                  </div>
                  <div className="text-muted-foreground">{selectedMed.storage_condition}</div>
                </div>
              )}

              {/* Row: batch + qty — bigger touch targets */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium" htmlFor="batch-input">批號 *</Label>
                  <Input id="batch-input" className="h-10 text-sm mono" placeholder="2024-ABC-001"
                    value={batchNumber} onChange={e => setBatchNumber(e.target.value)} data-testid="input-batch" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium" htmlFor="qty-input">數量 *</Label>
                  <Input id="qty-input" className="h-10 text-sm mono" type="number" min="1" inputMode="numeric"
                    placeholder="0" value={quantity} onChange={e => setQuantity(e.target.value)} data-testid="input-quantity" />
                </div>
              </div>

              {/* Expiry — full width, large */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium" htmlFor="expiry-input">
                  效期 * <span className="text-primary font-normal">（最重要，務必確認）</span>
                </Label>
                <Input id="expiry-input" className="h-10 text-sm" type="date"
                  value={expiryDate} onChange={e => setExpiryDate(e.target.value)} data-testid="input-expiry" />
                {daysLeft !== null && (
                  <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md
                    ${daysLeft <= 30 ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400" :
                      daysLeft <= 90 ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" :
                      "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"}`}>
                    <AlertCircle size={11} className="shrink-0" />
                    距到期 <strong>{daysLeft}</strong> 天
                    {daysLeft <= 30 && " ⚠ 此批次效期極短，請確認後入庫"}
                  </div>
                )}
              </div>

              {/* Cost + PO */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium" htmlFor="cost-input">單位成本 (NT$)</Label>
                  <Input id="cost-input" className="h-10 text-sm mono" type="number" min="0" step="0.01"
                    inputMode="decimal" placeholder="0" value={unitCost} onChange={e => setUnitCost(e.target.value)} data-testid="input-cost" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium" htmlFor="po-input">採購單號</Label>
                  <Input id="po-input" className="h-10 text-sm mono" placeholder="選填"
                    value={poNumber} onChange={e => setPoNumber(e.target.value)} data-testid="input-po" />
                </div>
              </div>

              {/* Submit — large mobile-friendly button */}
              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold mt-2"
                disabled={!medId || !batchNumber || !quantity || !expiryDate || mutation.isPending}
                data-testid="button-submit">
                {mutation.isPending ? "處理中..." : "確認入庫"}
              </Button>
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}
