import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, Link2, ArrowRight, SendHorizonal, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: "secondary", pending: "secondary", approved: "default",
    sent: "default", paid: "default", failed: "destructive", cancelled: "destructive",
  };
  return <Badge variant={(map[status] || "outline") as any} className="text-xs capitalize">{status.replace("_", " ")}</Badge>;
}

function SettlementTable({ adviceType }: { adviceType: "borrower_settlement" | "funder_settlement" }) {
  const { profile } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [chainOpen, setChainOpen] = useState<string | null>(null);
  const [chain, setChain] = useState<any[]>([]);
  const [chainLoading, setChainLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const fetchItems = () => {
    if (!profile?.organization_id) return;
    setLoading(true);
    supabase
      .from("settlement_advices")
      .select(`
        *,
        collection:collection_id(collection_number, amount, currency),
        disbursement_memo:disbursement_memo_id(memo_number)
      `)
      .eq("organization_id", profile.organization_id)
      .eq("advice_type", adviceType)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false); });
  };

  useEffect(() => { fetchItems(); }, [profile?.organization_id, adviceType]);

  const loadChain = async (settlementId: string) => {
    setChainOpen(settlementId);
    setChainLoading(true);
    const { data } = await (supabase as any)
      .from("transaction_links")
      .select("*")
      .or(`source_id.eq.${settlementId},target_id.eq.${settlementId}`)
      .order("created_at");
    setChain(data || []);
    setChainLoading(false);
  };

  // FIN-S2: Mark settlement advice as sent
  const handleSend = async (s: any) => {
    setSendingId(s.id);
    const { error } = await supabase
      .from("settlement_advices" as any)
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", s.id);
    if (error) {
      toast.error(`Failed to send: ${error.message}`);
    } else {
      toast.success(`Settlement advice ${s.settlement_number || s.id.slice(0, 8)} marked as sent`);
      fetchItems();
    }
    setSendingId(null);
  };

  const filtered = items.filter(i =>
    (i.settlement_number || "").toLowerCase().includes(search.toLowerCase()) ||
    (i.status || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search settlements..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary">{items.length} record{items.length !== 1 ? "s" : ""}</Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Settlement #</TableHead>
            <TableHead>Collection #</TableHead>
            <TableHead>Disbursement #</TableHead>
            <TableHead>Net Amount</TableHead>
            <TableHead>Fee</TableHead>
            <TableHead>Currency</TableHead>
            <TableHead>Fee Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No settlements found</TableCell></TableRow>
          )}
          {filtered.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-mono text-xs">{s.settlement_number || s.id.slice(0, 8)}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{s.collection?.collection_number || "—"}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{s.disbursement_memo?.memo_number || "—"}</TableCell>
              <TableCell className="font-mono text-sm">{formatCurrency(s.net_amount, s.currency)}</TableCell>
              {/* FIN-S4: NaN guard — originator_fee may be null */}
              <TableCell className="font-mono text-sm text-muted-foreground">
                {formatCurrency((s.originator_fee || 0) + (s.funder_fee || 0), s.currency)}
              </TableCell>
              <TableCell>{s.currency}</TableCell>
              <TableCell>
                {s.fee_resolution_source ? (
                  <Badge variant="outline" className="text-[10px]">{s.fee_resolution_source.replace(/_/g, " ")}</Badge>
                ) : "—"}
              </TableCell>
              <TableCell>{statusBadge(s.status)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {/* FIN-S2: Send action for draft/pending advices */}
                  {(s.status === "draft" || s.status === "pending" || s.status === "issued") && (
                    <Button
                      variant="ghost" size="sm" className="h-7 gap-1 text-xs text-emerald-600 hover:text-emerald-700"
                      disabled={sendingId === s.id}
                      onClick={() => handleSend(s)}
                    >
                      {sendingId === s.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <SendHorizonal className="h-3 w-3" />}
                      Send
                    </Button>
                  )}
                  {s.status === "sent" && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-600 mr-1">
                      <CheckCircle2 className="h-3 w-3" /> Sent
                    </span>
                  )}
                  <Button
                    variant="ghost" size="sm" className="gap-1"
                    onClick={() => loadChain(s.id)}
                  >
                    <Link2 className="h-3 w-3" />Chain
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Transaction chain dialog — FIN-S1: Waterfall distribution shown */}
      <Dialog open={!!chainOpen} onOpenChange={() => setChainOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Transaction Chain & Waterfall</DialogTitle></DialogHeader>
          {chainLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="space-y-4">
              {/* Settlement waterfall breakdown for the selected advice */}
              {(() => {
                const selectedAdvice = items.find(i => i.id === chainOpen);
                if (!selectedAdvice?.fee_breakdown) return null;
                const breakdown: any[] = typeof selectedAdvice.fee_breakdown === 'string'
                  ? JSON.parse(selectedAdvice.fee_breakdown)
                  : selectedAdvice.fee_breakdown;
                return (
                  <div className="rounded-lg border p-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Waterfall Distribution (Priority Order)</p>
                    {breakdown.map((item: any, idx: number) => (
                      <div key={idx} className={`flex justify-between items-center text-sm py-1 ${idx === breakdown.length - 1 ? 'font-bold border-t pt-2' : ''}`}>
                        <span className={item.type === 'net' ? 'text-emerald-600' : item.type === 'gross' ? 'text-foreground' : 'text-muted-foreground'}>
                          {idx > 0 && idx < breakdown.length - 1 && '→ '}
                          {item.label}
                        </span>
                        <span className={`font-mono ${item.amount < 0 ? 'text-destructive' : item.type === 'net' ? 'text-emerald-600' : ''}`}>
                          {selectedAdvice.currency} {Math.abs(item.amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {chain.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No linked transactions found.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transaction Links</p>
                  {chain.map((link) => (
                    <div key={link.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                      <div className="flex-1">
                        <span className="font-mono text-xs">{link.source_ref}</span>
                        <span className="text-muted-foreground text-xs ml-1">({link.source_type})</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Badge variant="outline" className="text-xs">{link.link_type.replace(/_/g, " ")}</Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 text-right">
                        <span className="font-mono text-xs">{link.target_ref}</span>
                        <span className="text-muted-foreground text-xs ml-1">({link.target_type})</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Settlements() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Settlements</h1>
          <p className="text-muted-foreground text-sm mt-1">View borrower and funder settlement advices with full transaction chain traceability and waterfall distribution.</p>
        </div>

        <Tabs defaultValue="borrower">
          <TabsList>
            <TabsTrigger value="borrower">Borrower Settlements</TabsTrigger>
            <TabsTrigger value="funder">Funder Settlements</TabsTrigger>
          </TabsList>
          <TabsContent value="borrower" className="mt-4">
            <Card><CardContent className="pt-6"><SettlementTable adviceType="borrower_settlement" /></CardContent></Card>
          </TabsContent>
          <TabsContent value="funder" className="mt-4">
            <Card><CardContent className="pt-6"><SettlementTable adviceType="funder_settlement" /></CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}



