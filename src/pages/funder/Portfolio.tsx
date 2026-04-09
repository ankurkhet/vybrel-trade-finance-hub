import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Wallet, TrendingUp, CheckCircle2, Clock, Activity, Handshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ActorWalletCard } from "@/components/ledger/ActorWalletCard";

export default function FunderPortfolio() {
  const { user } = useAuth();
  const [offers, setOffers] = useState<any[]>([]);
  const [msas, setMsas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchOffers();
  }, [user]);

  const fetchOffers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("funding_offers" as any)
      .select("*, invoices(invoice_number, debtor_name, amount, currency, due_date, status)")
      .eq("funder_user_id", user!.id)
      .order("created_at", { ascending: false });

    // Fetch active MSAs
    const { data: msaData } = await supabase
      .from("funder_relationships")
      .select("*, organization:organizations(name)")
      .eq("funder_user_id", user!.id)
      .eq("agreement_status", "active");

    if (msaData) setMsas(msaData);
    setOffers((data as any[]) || []);
    setLoading(false);
  };

  const acceptedOffers = offers.filter((o: any) => o.status === "accepted");
  
  const stats = {
    totalOffers: offers.length,
    totalFunded: acceptedOffers.reduce((s: number, o: any) => s + Number(o.offer_amount), 0),
    expectedYield: acceptedOffers.reduce((s: number, o: any) => s + (Number(o.offer_amount) * (Number(o.discount_rate || 0) / 100)), 0),
    pending: offers.filter((o: any) => o.status === "pending").length,
    accepted: acceptedOffers.length,
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case "accepted": return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "pending": return <Clock className="h-4 w-4 text-yellow-600" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Portfolio</h1>
          <p className="text-sm text-muted-foreground">Track your funding offers and active investments</p>
        </div>

        {msas.length > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex gap-4 items-center">
            <div className="bg-primary/10 p-3 rounded-lg"><Handshake className="h-6 w-6 text-primary" /></div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground flex items-center gap-2">Active Master Agreements</h3>
              <div className="flex flex-wrap gap-4 mt-2">
                {msas.map(msa => (
                  <Badge key={msa.id} variant="outline" className="bg-background text-sm py-1 font-normal border-primary/20">
                    <span className="font-semibold mr-1">{(msa as any).organization?.name || "Originator"}</span>
                    | {msa.master_base_rate_type} +{msa.master_margin_pct}%
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {user?.id && <ActorWalletCard actorId={user.id} />}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2"><Wallet className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Funded</p>
                  <p className="text-xl font-bold text-foreground">${stats.totalFunded.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2"><TrendingUp className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Offers</p>
                  <p className="text-xl font-bold text-foreground">{stats.totalOffers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-500/10 p-2"><Activity className="h-5 w-5 text-green-600" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Expected Return</p>
                  <p className="text-xl font-bold text-green-600">${stats.expectedYield.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Active Facilities</p>
              <p className="text-xl font-bold text-foreground">{stats.accepted}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="investments" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="investments">Active Investments</TabsTrigger>
            <TabsTrigger value="offers">My Bids & Offers</TabsTrigger>
          </TabsList>
          
          <TabsContent value="investments" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active Investments Ledger</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : acceptedOffers.length === 0 ? (
                  <div className="flex flex-col items-center py-12">
                    <Activity className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">You don't have any active investments yet.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Debtor</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Capital Deployed</TableHead>
                        <TableHead>Your Auth. Discount Rate</TableHead>
                        <TableHead>Est. Yield</TableHead>
                        <TableHead>Settlement Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {acceptedOffers.map((o: any) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-medium">{(o.invoices as any)?.debtor_name || "—"}</TableCell>
                          <TableCell>{(o.invoices as any)?.invoice_number || "—"}</TableCell>
                          <TableCell className="font-medium">
                            {(o.invoices as any)?.currency} {Number(o.offer_amount).toLocaleString()}
                          </TableCell>
                          <TableCell>{o.discount_rate ? `${o.discount_rate}%` : "—"}</TableCell>
                          <TableCell className="text-green-600 font-medium">
                            +{(o.invoices as any)?.currency} {(Number(o.offer_amount) * (Number(o.discount_rate || 0) / 100)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            {(o.invoices as any)?.due_date ? new Date((o.invoices as any).due_date).toLocaleDateString() : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="offers" className="mt-4">
            <Card>
          <CardHeader>
            <CardTitle className="text-base">Funding Offers</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : offers.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <Wallet className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No funding offers yet. Browse the marketplace to get started.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Debtor</TableHead>
                    <TableHead>Invoice Amount</TableHead>
                    <TableHead>Your Offer</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offers.map((o: any) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{(o.invoices as any)?.invoice_number || "—"}</TableCell>
                      <TableCell>{(o.invoices as any)?.debtor_name || "—"}</TableCell>
                      <TableCell>
                        {(o.invoices as any)?.currency} {Number((o.invoices as any)?.amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium">${Number(o.offer_amount).toLocaleString()}</TableCell>
                      <TableCell>{o.discount_rate ? `${o.discount_rate}%` : "—"}</TableCell>
                      <TableCell>
                        {(o.invoices as any)?.due_date ? new Date((o.invoices as any).due_date).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {statusIcon(o.status)}
                          <Badge variant={o.status === "accepted" ? "default" : "secondary"} className="capitalize text-xs">
                            {o.status}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
