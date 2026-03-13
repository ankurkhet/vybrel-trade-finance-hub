import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2, AlertTriangle } from "lucide-react";

interface TransactionMFAModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (code: string) => Promise<boolean>;
  transactionType: string;
  transactionAmount?: string;
  transactionCurrency?: string;
  mfaMethod?: "totp" | "sms" | "email";
}

export function TransactionMFAModal({
  open,
  onOpenChange,
  onConfirm,
  transactionType,
  transactionAmount,
  transactionCurrency,
  mfaMethod = "totp",
}: TransactionMFAModalProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    setLoading(true);
    setError("");
    try {
      const success = await onConfirm(code);
      if (success) {
        setCode("");
        onOpenChange(false);
      } else {
        setError("Invalid verification code");
      }
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
            <AlertTriangle className="h-6 w-6 text-warning" />
          </div>
          <DialogTitle className="text-center">Transaction Verification Required</DialogTitle>
          <DialogDescription className="text-center">
            Confirm this {transactionType} with your two-factor authentication code
          </DialogDescription>
        </DialogHeader>

        {transactionAmount && (
          <div className="rounded-lg border bg-muted/50 p-4 text-center">
            <p className="text-sm text-muted-foreground">Amount</p>
            <p className="text-2xl font-bold text-foreground">
              {transactionCurrency || "USD"} {transactionAmount}
            </p>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="tx-mfa-code" className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              {mfaMethod === "totp" ? "Authenticator Code" : mfaMethod === "sms" ? "SMS Code" : "Email Code"}
            </Label>
            <Input
              id="tx-mfa-code"
              placeholder="000000"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
                setError("");
              }}
              maxLength={6}
              className="text-center text-xl tracking-widest"
              autoFocus
            />
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleConfirm} disabled={code.length !== 6 || loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
