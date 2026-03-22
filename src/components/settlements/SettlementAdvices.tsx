import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Receipt, Loader2, Clock, Inbox } from "lucide-react";
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
      query = query.eq("advice_type", "borrower_settlement");
    } else {
      query = query.eq("advice_type", "funder_settlement");
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
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
