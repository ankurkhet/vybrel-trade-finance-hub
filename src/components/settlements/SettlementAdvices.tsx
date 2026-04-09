import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Receipt, Loader2, Clock, Inbox, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const PRODUCT_LABELS: Record<string, string> = {
  receivables_purchase: "Receivables Purchase",
  reverse_factoring: "Reverse Factoring",
  payables_finance: "Payables Finance",
};

export default function SettlementAdvices({ role }: { role: "borrower" | "funder" }) {
  const { user } = useAuth();
  const [advices, setAdvices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailAdvice, setDetailAdvice] = useState<any>(null);

  useEffect(() => {
    if (user) fetchAdvices();
  }, [user]);

  const fetchAdvices = async () => {
    setLoading(true);
    let query = supabase
      .from("settlement_advices")
      .select("*, invoices(invoice_number, debtor_name)")
      .order("created_at", { ascending: false });

    if (role === "borrower") {
      // Get borrower ID first
      const { data: b } = await supabase
        .from("borrowers")
        .select("id")
        .eq("user_id", user!.id)
        .single();
        
      query = query.eq("advice_type", "borrower_settlement");
      if (b) {
        query = query.eq("to_borrower_id", b.id);
      } else {
        // Force no results if no borrower profile
        query = query.eq("to_borrower_id", "00000000-0000-0000-0000-000000000000");
      }
    } else {
      query = query.eq("advice_type", "funder_settlement");
      query = query.eq("to_funder_user_id", user!.id);
    }

    const { data } = await query;
    setAdvices(data || []);
    setLoading(false);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "issued": return <Badge variant="default" className="text-xs">Issued</Badge>;
      case "acknowledged": return <Badge className="text-xs bg-primary/80">Acknowledged</Badge>;
      case "paid": return <Badge className="text-xs bg-primary">Paid</Badge>;
      default: return <Badge variant="secondary" className="text-xs">Draft</Badge>;
    }
  };

  const totalNet = advices.reduce((sum, a) => sum + Number(a.net_amount || 0), 0);

  const printSettlement = (advice: any) => {
    const piEntries = advice.payment_instructions
      ? Object.entries(advice.payment_instructions as Record<string, string>)
          .map(([k, v]) => `<tr><td style="color:#6b7280;padding:5px 0">${k.replace(/_/g, " ")}</td><td style="font-weight:600;text-align:right;padding:5px 0">${v}</td></tr>`)
          .join("")
      : "";

    const breakdownRows = ((advice.fee_breakdown as any[]) || [])
      .map((item: any) => {
        const isNet = item.type === "net";
        const rowStyle = isNet
          ? 'style="font-weight:700;font-size:14px;border-top:2px solid #e5e7eb;background:#f9fafb"'
          : "";
        const amtColor = item.amount < 0 ? "color:#dc2626" : "";
        return `<tr ${rowStyle}>
          <td style="padding:7px 12px;${isNet ? "" : "color:#374151"}">${item.label}</td>
          <td style="padding:7px 12px;text-align:right;${amtColor}">${advice.currency} ${Math.abs(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        </tr>`;
      })
      .join("");

    const invoiceNumber = (advice.invoices as any)?.invoice_number || "—";
    const issuedAt = advice.issued_at ? new Date(advice.issued_at).toLocaleString() : "—";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Settlement Advice ${advice.advice_number}</title>
      <style>
        body{font-family:sans-serif;font-size:13px;color:#111;margin:40px;max-width:600px}
        h1{font-size:20px;margin:0 0 4px}
        .sub{color:#6b7280;font-size:12px;margin-bottom:24px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}
        .cell .label{font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em}
        .cell .value{font-size:14px;font-weight:600;margin-top:2px}
        table{width:100%;border-collapse:collapse;margin-bottom:20px}
        td{padding:7px 12px;border-bottom:1px solid #f3f4f6}
        h3{font-size:13px;font-weight:600;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280}
        .footer{margin-top:32px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px}
        @media print{body{margin:20px}}
      </style>
    </head><body>
      <h1>Settlement Advice</h1>
      <div class="sub">${advice.advice_number} &nbsp;·&nbsp; Issued: ${issuedAt}</div>
      <div class="grid">
        <div class="cell"><div class="label">From</div><div class="value">${advice.from_party_name}</div></div>
        <div class="cell"><div class="label">To</div><div class="value">${advice.to_party_name}</div></div>
        <div class="cell"><div class="label">Invoice</div><div class="value">${invoiceNumber}</div></div>
        <div class="cell"><div class="label">Product</div><div class="value">${PRODUCT_LABELS[advice.product_type] || advice.product_type}</div></div>
      </div>
      <h3>Fee Breakdown</h3>
      <table>${breakdownRows}</table>
      ${piEntries ? `<h3>Payment Instructions</h3><table>${piEntries}</table>` : ""}
      <div class="footer">Generated by Vybrel Platform &nbsp;·&nbsp; ${new Date().toLocaleDateString()}</div>
    </body></html>`;

    const win = window.open("", "_blank", "width=700,height=900");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    // Short delay so styles render before print dialog opens
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settlement Advices</h1>
          <p className="text-sm text-muted-foreground">
            {role === "borrower"
              ? "View settlement advices from your originator showing collected amounts and fees"
              : "View settlement advices showing your returns on funded invoices"}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{advices.length}</p>
                <p className="text-xs text-muted-foreground">Total Advices</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {advices[0]?.currency || "GBP"} {totalNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">Total Net Amount</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : advices.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No settlement advices yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Advice #</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advices.map((sa) => (
                    <TableRow key={sa.id}>
                      <TableCell className="font-medium text-xs">{sa.advice_number}</TableCell>
                      <TableCell>{(sa.invoices as any)?.invoice_number || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {PRODUCT_LABELS[sa.product_type] || sa.product_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{sa.from_party_name}</TableCell>
                      <TableCell>{sa.currency} {Number(sa.gross_amount).toLocaleString()}</TableCell>
                      <TableCell className="font-medium">{sa.currency} {Number(sa.net_amount).toLocaleString()}</TableCell>
                      <TableCell>{statusBadge(sa.status)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => setDetailAdvice(sa)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailAdvice} onOpenChange={() => setDetailAdvice(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Settlement Advice
            </DialogTitle>
            <DialogDescription>{detailAdvice?.advice_number}</DialogDescription>
          </DialogHeader>
          {detailAdvice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">From</span>
                  <p className="font-medium">{detailAdvice.from_party_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">To</span>
                  <p className="font-medium">{detailAdvice.to_party_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Invoice</span>
                  <p className="font-medium">{(detailAdvice.invoices as any)?.invoice_number || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Product</span>
                  <p className="font-medium">{PRODUCT_LABELS[detailAdvice.product_type] || detailAdvice.product_type}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Breakdown</h4>
                <div className="rounded-lg border">
                  {(detailAdvice.fee_breakdown as any[])?.map((item: any, i: number) => (
                    <div
                      key={i}
                      className={`flex justify-between px-4 py-2 text-sm ${
                        item.type === "net" ? "font-bold border-t bg-muted/50" : ""
                      }`}
                    >
                      <span className={item.type === "net" ? "text-foreground" : "text-muted-foreground"}>
                        {item.label}
                      </span>
                      <span className={item.amount < 0 ? "text-destructive" : "text-foreground"}>
                        {detailAdvice.currency} {Math.abs(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {detailAdvice.payment_instructions && Object.keys(detailAdvice.payment_instructions).length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Payment Instructions</h4>
                    <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                      {Object.entries(detailAdvice.payment_instructions).map(([key, val]) => (
                        <div key={key} className="flex justify-between py-1">
                          <span className="capitalize">{key.replace(/_/g, " ")}</span>
                          <span className="font-medium text-foreground">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>Issued: {detailAdvice.issued_at ? new Date(detailAdvice.issued_at).toLocaleString() : "—"}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => detailAdvice && printSettlement(detailAdvice)}
            >
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
