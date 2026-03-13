import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2 } from "lucide-react";

interface MFAChallengeProps {
  method: "totp" | "sms" | "email";
  onVerify: (code: string) => Promise<boolean>;
  onResend?: () => void;
  title?: string;
  description?: string;
}

export function MFAChallenge({
  method,
  onVerify,
  onResend,
  title = "Two-Factor Authentication",
  description,
}: MFAChallengeProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const defaultDesc =
    method === "totp"
      ? "Enter the 6-digit code from your authenticator app"
      : method === "sms"
        ? "Enter the code sent to your phone"
        : "Enter the code sent to your email";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const success = await onVerify(code);
      if (!success) setError("Invalid code. Please try again.");
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mx-auto max-w-sm animate-fade-in">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description || defaultDesc}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Verification Code</Label>
            <Input
              id="mfa-code"
              placeholder="000000"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
                setError("");
              }}
              maxLength={6}
              className="text-center text-2xl tracking-widest"
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={code.length !== 6 || loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify
          </Button>
          {(method === "sms" || method === "email") && onResend && (
            <Button type="button" variant="ghost" className="w-full text-sm" onClick={onResend}>
              Resend Code
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
