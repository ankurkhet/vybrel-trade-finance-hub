import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, TrendingUp, Wallet, ArrowDownLeft, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

function statusBadge(status: string) {
  const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    disbursed: "default",
    approved: "secondary",
    pending: "secondary",
    issued: "default",
    sent: "default",
    paid: "default",
    failed: "destructive",
    cancelled: "destructive",
  };
  return <Badge variant={map[status] || "outline"} className="text-xs capitalize">{status.replace(/_/g, " ")}</Badge>;
}

function formatAmt(val: number | null | undefined, currency?: string) {
  if (val == null) return "—";
  const cur = currency || "GBP";
  return `${cur} ${Number(val).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;
}

export default function BorrowerFinancingHistory() {
  const { profile, user } = useAuth();
  const [disbursements, setDisbursements] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.organization_id) return;
    const orgId = profile.organization_id;

    const load = async () => {
      setLoading(true);

      // Fetch disbursement memos for this borrower's org
      const { data: disb } = await (supabase as any)
        .from("disbursement_memos")
        .select(`
          id, memo_number, disbursement_amount, currency, advance_rate,
          status, disbursed_at, payment_reference,
          invoices(invoice_number, amount, currency)
        `)
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      // Fetch borrower settlement advices for this org
      const { data: settle } = await (supabase as any)
        .from("settlement_advices")
        .select(`
          id, advice_number, net_amount, currency, status,
          discount_amount, originator_fee, funder_fee, gross_amount,
          issued_at, metadata
        `)
        .eq("organization_id", orgId)
        .eq("advice_type", "borrower_settlement")
        .order("created_at", { ascending: false });

      setDisbursements(disb || []);
      setSettlements(settle || []);
      setLoading(false);
    };

    load();
  }, [profile?.organization_id]);

  // Summary stats
  const totalDisbursed = disbursements
    .filter(d => d.status === "disbursed")
    .reduce((sum, d) => sum + Number(d.disbursement_amount || 0), 0);

  const totalSettled = settlements
    .filter(s => ["sent", "paid"].includes(s.status))
    .reduce((sum, s) => sum + Number(s.net_amount || 0), 0);

  const outstanding = disbursements.filter(d => d.status === "approved" || d.status === "disbursed").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            Financing History
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your disbursements received and settlement advices from your trade finance facility.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <ArrowDownLeft className="h-6 w-6 text-emerald-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Disbursed</p>
                  <p className="text-xl font-bold">{formatAmt(totalDisbursed, "GBP")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <Receipt className="h-6 w-6 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Settled</p>
                  <p className="text-xl font-bold">{formatAmt(totalSettled, "GBP")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-amber-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Outstanding Memos</p>
                  <p className="text-xl font-bold">{outstanding}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="disbursements">
            <TabsList>
              <TabsTrigger value="disbursements">Disbursements ({disbursements.length})</TabsTrigger>
              <TabsTrigger value="settlements">Settlement Advices ({settlements.length})</TabsTrigger>
            </TabsList>

            {/* ── Disbursements tab ─────────────────────────── */}
            <TabsContent value="disbursements" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Disbursements Received</CardTitle>
                  <CardDescription>Funding disbursed against your invoices</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Memo #</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Invoice Value</TableHead>
                        <TableHead>Advance Rate</TableHead>
                        <TableHead>Disbursed Amount</TableHead>
                        <TableHead>Payment Ref</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {disbursements.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            No disbursements yet
                          </TableCell>
                        </TableRow>
                      )}
                      {disbursements.map(d => (
                        <TableRow key={d.id}>
                          <TableCell className="font-mono text-xs">{d.memo_number || d.id.slice(0, 8)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{d.invoices?.invoice_number || "—"}</TableCell>
                          <TableCell className="text-sm">{formatAmt(d.invoices?.amount, d.invoices?.currency)}</TableCell>
                          <TableCell className="text-sm">{d.advance_rate != null ? `${d.advance_rate}%` : "—"}</TableCell>
                          <TableCell className="text-sm font-semibold">{formatAmt(d.disbursement_amount, d.currency)}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{d.payment_reference || "—"}</TableCell>
                          <TableCell>{statusBadge(d.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {d.disbursed_at ? new Date(d.disbursed_at).toLocaleDateString() : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Settlements tab ────────────────────────────── */}
            <TabsContent value="settlements" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Settlement Advices</CardTitle>
                  <CardDescription>
                    Your net settlement amounts. Shows discounting rate and advance rate.
                    Originator margins and funder fees are not shown here.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Advice #</TableHead>
                        <TableHead>Gross Collection</TableHead>
                        <TableHead>Discount Charged</TableHead>
                        <TableHead>Net to You</TableHead>
                        <TableHead>Effective Rate</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Issued</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {settlements.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No settlement advices yet
                          </TableCell>
                        </TableRow>
                      )}
                      {settlements.map(s => {
                        // FIN-BR2: Show discount charged (NOT funder/originator margin breakdown)
                        const effectiveRate = s.metadata?.effective_discount_rate;
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="font-mono text-xs">{s.advice_number || s.id.slice(0, 8)}</TableCell>
                            <TableCell className="text-sm">{formatAmt(s.gross_amount, s.currency)}</TableCell>
                            <TableCell className="text-sm text-destructive">
                              {s.discount_amount != null ? `- ${formatAmt(s.discount_amount, s.currency)}` : "—"}
                            </TableCell>
                            <TableCell className="text-sm font-bold text-emerald-600">{formatAmt(s.net_amount, s.currency)}</TableCell>
                            {/* FIN-BR2: Show effective discounting rate only — no originator/funder margin */}
                            <TableCell className="text-xs text-muted-foreground">
                              {effectiveRate != null ? `${Number(effectiveRate).toFixed(2)}% disc.` : "—"}
                            </TableCell>
                            <TableCell>{statusBadge(s.status)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {s.issued_at ? new Date(s.issued_at).toLocaleDateString() : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
