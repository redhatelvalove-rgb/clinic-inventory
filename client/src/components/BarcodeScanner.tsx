import { useRef, useEffect } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/* ── html5-qrcode 掃描器（共用元件，入庫 / 新增藥品 等共用） ── */
export default function BarcodeScanner({
  onScan,
  onClose,
  title = "掃描藥品條碼",
}: {
  onScan: (code: string) => void;
  onClose: () => void;
  title?: string;
}) {
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
            {title}
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
