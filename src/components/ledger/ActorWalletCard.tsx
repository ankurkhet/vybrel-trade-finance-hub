import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WalletBalance } from "@/lib/ledger-types";
import { formatCurrency } from "@/lib/utils";
import { WalletDrillDownDialog } from "./WalletDrillDownDialog";

interface ActorWalletCardProps {
  actorId: string;
}

export const ActorWalletCard: React.FC<ActorWalletCardProps> = ({ actorId }) => {
  const [wallets, setWallets] = useState<WalletBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [drillDownOpen, setDrillDownOpen] = useState(false);

  useEffect(() => {
    const fetchWallets = async () => {
      setLoading(true);
      const { data, error } = await (supabase
        .from("wallets" as any)
        .select("*")
        .eq("actor_id", actorId) as any);
      
      if (!error && data) {
        setWallets(data as unknown as WalletBalance[]);
      }
      setLoading(false);
    };

    fetchWallets();
  }, [actorId]);

  // Derive the primary wallet (default GBP or the first available) to display
  const primaryWallet = wallets.find(w => w.currency === "GBP") || wallets[0];
  const totalCurrencies = new Set(wallets.map(w => w.currency)).size;
  const isMultiCurrency = totalCurrencies > 1;

  if (loading) {
    return (
      <Card className="opacity-70 animate-pulse">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Total Wallet Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-8 w-24 bg-muted rounded"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card 
        className="cursor-pointer hover:border-primary/50 transition-colors group" 
        onClick={() => setDrillDownOpen(true)}
      >
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Total Wallet Balance
          </CardTitle>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {primaryWallet ? formatCurrency(primaryWallet.balance, primaryWallet.currency) : formatCurrency(0, "GBP")}
          </div>
          {isMultiCurrency && (
            <p className="text-xs text-muted-foreground mt-1">
              + {totalCurrencies - 1} other currencies
            </p>
          )}
          {!isMultiCurrency && (
            <p className="text-xs text-muted-foreground mt-1">
              Click to view ledgers
            </p>
          )}
        </CardContent>
      </Card>

      <WalletDrillDownDialog 
        open={drillDownOpen} 
        onOpenChange={setDrillDownOpen} 
        wallets={wallets} 
        actorId={actorId} 
      />
    </>
  );
};
