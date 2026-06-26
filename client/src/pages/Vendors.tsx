import { useQuery } from "@tanstack/react-query";
import { Building2, Phone, Mail, Clock, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const VENDOR_MEDS: Record<string, string[]> = {
  "V001": ["Prolia 保骼麗"],
  "V002": ["Evenity 益穩挺"],
  "V003": ["Durolane 膝舒適"],
  "V004": ["Artzdispo 雅節", "ArtiAid Plus 優節益", "Polyxal 玻麗舒", "Density 特適體", "Probone 補骨立素"],
  "V005": ["Botox 肉毒桿菌素"],
};

export default function Vendors() {
  const { data: vendors = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/vendors"] });

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">廠商目錄</h1>
        <p className="text-sm text-muted-foreground mt-0.5">藥品供應商聯絡資訊與前置天數</p>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {vendors.map((v: any) => (
            <Card key={v.id} className="hover:border-primary/40 transition-colors" data-testid={`vendor-${v.id}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 size={16} className="text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{v.company_name}</div>
                      {v.notes && <div className="text-xs text-muted-foreground">{v.notes}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                    <Clock size={11} />
                    {v.lead_time_days} 天
                  </div>
                </div>

                {/* Contact info */}
                <div className="space-y-1">
                  {v.contact_person ? (
                    <div className="text-xs text-muted-foreground">{v.contact_person}</div>
                  ) : (
                    <div className="text-xs text-muted-foreground/50 italic">聯絡人待填入</div>
                  )}
                  <div className="flex gap-3">
                    {v.phone ? (
                      <a href={`tel:${v.phone}`} className="flex items-center gap-1 text-xs text-primary">
                        <Phone size={11} />{v.phone}
                      </a>
                    ) : <span className="text-xs text-muted-foreground/50 flex items-center gap-1"><Phone size={11} />待填入</span>}
                    {v.email && (
                      <a href={`mailto:${v.email}`} className="flex items-center gap-1 text-xs text-primary">
                        <Mail size={11} />{v.email}
                      </a>
                    )}
                  </div>
                </div>

                {/* Associated meds */}
                {VENDOR_MEDS[v.id] && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
                    {VENDOR_MEDS[v.id].map(m => (
                      <span key={m} className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        <Package size={10} />{m}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
